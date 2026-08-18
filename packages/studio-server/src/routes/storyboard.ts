import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { Hono } from "hono";
import type { StudioApiAdapter } from "../types.js";
import { resolveWithinProject } from "../helpers/safePath.js";
import { resolveProjectAndSignature } from "../helpers/projectSignature.js";
import {
  parseStoryboard,
  SCRIPT_FILENAME,
  STORYBOARD_FILENAME,
  type StoryboardFrame,
  type StoryboardKind,
  type StoryboardTargetProfile,
} from "@hyperframes/core/storyboard";

/** A frame enriched with disk-resolution info the Studio needs to render tiles. */
interface ResolvedStoryboardFrame extends StoryboardFrame {
  /** Whether `src` resolves to an existing file inside the project. */
  srcExists: boolean;
}

interface StoryboardDocument {
  path: string;
  label: string;
  kind?: StoryboardKind;
  groupId?: string;
  templateId?: string;
  templateRevision?: number;
  compositionPath?: string;
  analysisId?: string;
  referenceAsset?: string;
  sourceUrl?: string;
  targetProfile?: StoryboardTargetProfile;
}

interface StoryboardCollections {
  storyboards: StoryboardDocument[];
  archivedStoryboards: StoryboardDocument[];
}

function isStoryboardPath(path: string): boolean {
  return path === STORYBOARD_FILENAME || /^storyboards\/[^/\\]+\.md$/i.test(path);
}

function fallbackStoryboardLabel(path: string): string {
  if (path === STORYBOARD_FILENAME) return "Main";
  const filename = path.slice("storyboards/".length, -3);
  return filename
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function storyboardMetadata(
  projectDir: string,
  path: string,
): StoryboardDocument & { archived: boolean } {
  const abs = resolveWithinProject(projectDir, path);
  if (abs) {
    try {
      const globals = parseStoryboard(readFileSync(abs, "utf-8")).globals;
      const authoredTitle = (globals.title ?? globals.extra.title)?.trim();
      const relationship =
        globals.kind && globals.kind !== "standalone"
          ? {
              kind: globals.kind,
              groupId: globals.groupId,
              templateId: globals.templateId,
              templateRevision: globals.templateRevision,
              compositionPath: globals.compositionPath,
              analysisId: globals.analysisId,
              referenceAsset: globals.referenceAsset,
              sourceUrl: globals.sourceUrl,
              targetProfile: globals.targetProfile,
            }
          : {};
      return {
        path,
        label: authoredTitle || fallbackStoryboardLabel(path),
        archived: globals.extra.archived?.trim().toLowerCase() === "true",
        ...relationship,
      };
    } catch {
      // A readable board with a malformed or missing title still gets a stable fallback label.
    }
  }
  return { path, label: fallbackStoryboardLabel(path), archived: false };
}

function listStoryboards(projectDir: string): StoryboardCollections {
  const paths: string[] = [];
  const main = resolveWithinProject(projectDir, STORYBOARD_FILENAME);
  if (main && existsSync(main)) paths.push(STORYBOARD_FILENAME);

  const directory = resolveWithinProject(projectDir, "storyboards");
  if (directory && existsSync(directory)) {
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
          paths.push(`storyboards/${entry.name}`);
        }
      }
    } catch {
      // The main board remains usable even when an optional directory cannot be read.
    }
  }

  const documents = paths
    .sort((a, b) => {
      if (a === STORYBOARD_FILENAME) return -1;
      if (b === STORYBOARD_FILENAME) return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    })
    .map((path) => storyboardMetadata(projectDir, path));
  return {
    storyboards: documents
      .filter((document) => !document.archived)
      .map(({ archived: _archived, ...document }) => document),
    archivedStoryboards: documents
      .filter((document) => document.archived)
      .map(({ archived: _archived, ...document }) => document),
  };
}

function resolveFrames(projectDir: string, frames: StoryboardFrame[]): ResolvedStoryboardFrame[] {
  return frames.map((frame) => {
    let srcExists = false;
    if (frame.src) {
      const abs = resolveWithinProject(projectDir, frame.src);
      srcExists = abs ? existsSync(abs) : false;
    }
    return { ...frame, srcExists };
  });
}

/** Read the companion SCRIPT.md narration doc if it exists alongside the storyboard. */
function readScript(projectDir: string): { exists: boolean; path: string; content: string } {
  const abs = resolveWithinProject(projectDir, SCRIPT_FILENAME);
  if (abs && existsSync(abs)) {
    try {
      return { exists: true, path: SCRIPT_FILENAME, content: readFileSync(abs, "utf-8") };
    } catch {
      /* fall through to absent */
    }
  }
  return { exists: false, path: SCRIPT_FILENAME, content: "" };
}

export function registerStoryboardRoutes(api: Hono, adapter: StudioApiAdapter): void {
  // Parsed storyboard manifest for a project. Markdown (STORYBOARD.md) stays
  // canonical on disk; this returns the derived, normalized structure. When the
  // file is absent we return `exists: false` with empty frames rather than 404,
  // so the Studio can render an opt-in empty state.
  api.get("/projects/:id/storyboard", async (c) => {
    // The signature lets the board bust poster caches and lets the client tell
    // whether this payload is already current (see /projects/:id/signature).
    const resolved = await resolveProjectAndSignature(adapter, c.req.param("id"));
    if (!resolved) return c.json({ error: "not found" }, 404);
    const { project, signature } = resolved;

    const storyboardPath = c.req.query("path") ?? STORYBOARD_FILENAME;
    if (!isStoryboardPath(storyboardPath)) {
      return c.json({ error: "invalid storyboard path" }, 400);
    }
    const { storyboards, archivedStoryboards } = listStoryboards(project.dir);

    const abs = resolveWithinProject(project.dir, storyboardPath);
    if (!abs || !existsSync(abs)) {
      return c.json({
        exists: false,
        path: storyboardPath,
        storyboards,
        archivedStoryboards,
        globals: { extra: {} },
        frames: [],
        warnings: [],
        script: readScript(project.dir),
        signature,
      });
    }

    let source: string;
    try {
      source = readFileSync(abs, "utf-8");
    } catch {
      return c.json({ error: "failed to read storyboard" }, 500);
    }

    const manifest = parseStoryboard(source);
    return c.json({
      exists: true,
      path: storyboardPath,
      storyboards,
      archivedStoryboards,
      globals: manifest.globals,
      frames: resolveFrames(project.dir, manifest.frames),
      warnings: manifest.warnings,
      script: readScript(project.dir),
      signature,
    });
  });
}
