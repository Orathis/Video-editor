import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type PrimitiveInstallStatus =
  | "pending"
  | "awaiting-auth"
  | "completed"
  | "cancelled"
  | "failed";

export interface PendingPrimitiveInstall {
  schemaVersion: 1;
  itemName: string;
  artifactId: string;
  versionId: string;
  funnelId: string;
  installId: string;
  queryFingerprint: string;
  status: PrimitiveInstallStatus;
}

export interface PrimitiveInstallStateStore {
  load(): Promise<PendingPrimitiveInstall | null>;
  save(state: PendingPrimitiveInstall): Promise<void>;
}

export interface CreatePrimitiveInstallIntentArgs {
  itemName: string;
  query: string;
  artifactId: string;
  versionId: string;
  funnelId?: string;
  installId?: string;
}

export function filterPrimitiveCatalogItems<
  T extends { name: string; title: string; description: string },
>(items: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    [item.name, item.title, item.description].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  );
}

export function createPrimitiveInstallIntent(
  args: CreatePrimitiveInstallIntentArgs,
): PendingPrimitiveInstall {
  return {
    schemaVersion: 1,
    itemName: args.itemName,
    artifactId: args.artifactId,
    versionId: args.versionId,
    funnelId: args.funnelId ?? randomUUID(),
    installId: args.installId ?? randomUUID(),
    queryFingerprint: createHash("sha256").update(args.query).digest("hex"),
    status: "pending",
  };
}

export type PrimitiveAuthenticationOutcome = boolean | "cancelled" | "failed";

export interface PrimitiveInstallResumeDeps {
  store: PrimitiveInstallStateStore;
  isAuthenticated(): Promise<boolean>;
  authenticate(): Promise<PrimitiveAuthenticationOutcome>;
  install(intent: PendingPrimitiveInstall): Promise<void>;
}

export type PrimitiveInstallResumeResult =
  | "installed"
  | "already-installed"
  | "cancelled"
  | "failed";

/**
 * Persist the source-owned selection before OAuth and consume that same install
 * id exactly once after authentication. No authored query or message content is
 * stored in the resume state.
 */
export async function resumePrimitiveInstallExactlyOnce(
  intent: PendingPrimitiveInstall,
  deps: PrimitiveInstallResumeDeps,
): Promise<PrimitiveInstallResumeResult> {
  const persisted = await deps.store.load();
  if (persisted?.installId === intent.installId) {
    if (persisted.status === "completed") return "already-installed";
    if (persisted.status === "cancelled") return "cancelled";
    if (persisted.status === "failed") return "failed";
  }

  let state: PendingPrimitiveInstall = {
    ...(persisted?.installId === intent.installId ? persisted : intent),
  };
  await deps.store.save(state);

  if (!(await deps.isAuthenticated())) {
    state = { ...state, status: "awaiting-auth" };
    await deps.store.save(state);
    const auth = await deps.authenticate();
    if (auth !== true) {
      const terminal = auth === "cancelled" ? "cancelled" : "failed";
      state = { ...state, status: terminal };
      await deps.store.save(state);
      return terminal;
    }
  }

  try {
    await deps.install(state);
  } catch (error) {
    await deps.store.save({ ...state, status: "failed" });
    throw error;
  }
  await deps.store.save({ ...state, status: "completed" });
  return "installed";
}

export function createFilePrimitiveInstallStateStore(
  path = join(homedir(), ".hyperframes", "pending-primitive-install.json"),
): PrimitiveInstallStateStore {
  return {
    async load() {
      try {
        const parsed = JSON.parse(await readFile(path, "utf8")) as PendingPrimitiveInstall;
        return parsed.schemaVersion === 1 ? parsed : null;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || error instanceof SyntaxError) return null;
        throw error;
      }
    },
    async save(state) {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, path);
    },
  };
}
