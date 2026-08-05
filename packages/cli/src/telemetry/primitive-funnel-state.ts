import { closeSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import type { PrimitiveFunnelContext } from "./primitive-funnel.js";

const FUNNEL_STATE_DIR = ".hyperframes";
const FUNNEL_STATE_FILE = "primitive-funnel.json";
const FUNNEL_CLAIM_DIR = "primitive-funnel-claims";

interface PersistedPrimitiveFunnelContext extends PrimitiveFunnelContext {
  emittedEventIds: string[];
}

function statePath(projectDir: string): string {
  return join(projectDir, FUNNEL_STATE_DIR, FUNNEL_STATE_FILE);
}

function createClaimMarker(projectDir: string, eventId: string): boolean {
  const directory = join(projectDir, FUNNEL_STATE_DIR, FUNNEL_CLAIM_DIR);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const digest = createHash("sha256").update(eventId).digest("hex");
  try {
    const descriptor = openSync(join(directory, `${digest}.claim`), "wx", 0o600);
    closeSync(descriptor);
    return true;
  } catch {
    return false;
  }
}

function isContext(value: unknown): value is PrimitiveFunnelContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return [
    "funnelId",
    "installId",
    "primitiveId",
    "artifactId",
    "versionId",
    "catalogVersion",
    "queryFingerprint",
  ].every((key) => typeof record[key] === "string" && record[key].length > 0);
}

export function readPrimitiveFunnelContext(projectDir: string): PrimitiveFunnelContext | null {
  try {
    const value: unknown = JSON.parse(readFileSync(statePath(projectDir), "utf8"));
    if (!isContext(value)) return null;
    const {
      funnelId,
      installId,
      primitiveId,
      artifactId,
      versionId,
      catalogVersion,
      queryFingerprint,
    } = value;
    return {
      funnelId,
      installId,
      primitiveId,
      artifactId,
      versionId,
      catalogVersion,
      queryFingerprint,
    };
  } catch {
    return null;
  }
}

function writeState(projectDir: string, state: PersistedPrimitiveFunnelContext): void {
  const directory = join(projectDir, FUNNEL_STATE_DIR);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = statePath(projectDir);
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, path);
}

export function writePrimitiveFunnelContext(
  projectDir: string,
  context: PrimitiveFunnelContext,
): void {
  writeState(projectDir, { ...context, emittedEventIds: [] });
}

/** Atomically claim a stable terminal id before enqueueing cross-command telemetry. */
export function claimPrimitiveFunnelEvent(projectDir: string, eventId: string): boolean {
  try {
    const value: unknown = JSON.parse(readFileSync(statePath(projectDir), "utf8"));
    if (!isContext(value)) return false;
    const record = value as PrimitiveFunnelContext & { emittedEventIds?: unknown };
    const emittedEventIds = Array.isArray(record.emittedEventIds)
      ? record.emittedEventIds.filter(
          (candidate): candidate is string => typeof candidate === "string",
        )
      : [];
    if (emittedEventIds.includes(eventId)) return false;
    const context = readPrimitiveFunnelContext(projectDir);
    if (!context) return false;
    if (!createClaimMarker(projectDir, eventId)) return false;
    try {
      writeState(projectDir, { ...context, emittedEventIds: [...emittedEventIds, eventId] });
    } catch {
      // The permanent O_EXCL marker is the authoritative claim. Retaining it
      // fails closed if the compatibility state rewrite cannot complete.
    }
    return true;
  } catch {
    return false;
  }
}
