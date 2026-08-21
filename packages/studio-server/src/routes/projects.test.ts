import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerProjectRoutes } from "./projects";
import type { StudioApiAdapter } from "../types";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const COMPOSITION_HTML = '<html><body><div data-composition-id="main"></div></body></html>';

// Project layout for #1384: real compositions at the root and under
// compositions/, plus dot-directory content that exercises discovery gating
// and the file tree's backup-only hiding (#1366):
//   - .cache/examples/        a vendored dot-dir. walkDir does NOT special-case
//                             it, so it stays listed in the file tree, but it is
//                             gated out of composition discovery (isInHiddenOrVendorDir).
//   - .hyperframes/examples/  vendored under Studio's dir — also listed in the
//                             file tree, also gated out of discovery.
//   - .hyperframes/backup/    Studio's internal snapshots — the only thing hidden
//                             from the file tree (walkDir's shouldIgnoreDir).
function createProjectDir(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "hf-projects-test-"));
  tempDirs.push(projectDir);
  writeFileSync(join(projectDir, "index.html"), COMPOSITION_HTML);
  mkdirSync(join(projectDir, "compositions"));
  writeFileSync(join(projectDir, "compositions", "scene.html"), COMPOSITION_HTML);
  mkdirSync(join(projectDir, ".cache", "examples"), { recursive: true });
  writeFileSync(join(projectDir, ".cache", "examples", "preset.html"), COMPOSITION_HTML);
  mkdirSync(join(projectDir, ".hyperframes", "examples"), { recursive: true });
  writeFileSync(join(projectDir, ".hyperframes", "examples", "preset.html"), COMPOSITION_HTML);
  mkdirSync(join(projectDir, ".hyperframes", "backup"), { recursive: true });
  writeFileSync(join(projectDir, ".hyperframes", "backup", "snapshot.html"), COMPOSITION_HTML);
  return projectDir;
}

function createAdapter(projectDir: string): StudioApiAdapter {
  return {
    listProjects: () => [],
    resolveProject: async (id: string) => ({ id, dir: projectDir }),
    bundle: async () => null,
    lint: async () => ({ findings: [] }),
    runtimeUrl: "/api/runtime.js",
    rendersDir: () => "/tmp/renders",
    startRender: () => ({
      id: "job-1",
      status: "rendering",
      progress: 0,
      outputPath: "/tmp/out.mp4",
    }),
  };
}

describe("GET /projects/:id/signature", () => {
  it("returns the adapter's cached signature when provided", async () => {
    const projectDir = createProjectDir();
    const app = new Hono();
    registerProjectRoutes(app, {
      ...createAdapter(projectDir),
      getProjectSignature: () => "cached-sig",
    });

    const response = await app.request("http://localhost/projects/demo/signature");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ signature: "cached-sig" });
  });

  it("computes a signature that moves when project files change", async () => {
    const projectDir = createProjectDir();
    const app = new Hono();
    registerProjectRoutes(app, createAdapter(projectDir));

    const first = (await (
      await app.request("http://localhost/projects/demo/signature")
    ).json()) as {
      signature: string;
    };
    expect(first.signature).toMatch(/^[0-9a-f]{24}$/);

    writeFileSync(join(projectDir, "compositions", "scene.html"), "<html><body>new</body></html>");
    const second = (await (
      await app.request("http://localhost/projects/demo/signature")
    ).json()) as { signature: string };
    expect(second.signature).not.toBe(first.signature);
  });

  it("ignores generated cache writes while detecting source edits", async () => {
    const projectDir = createProjectDir();
    const app = new Hono();
    registerProjectRoutes(app, createAdapter(projectDir));
    const getSignature = async () =>
      (
        (await (await app.request("http://localhost/projects/demo/signature")).json()) as {
          signature: string;
        }
      ).signature;

    const initial = await getSignature();
    const generatedFiles = [
      [".transcode-cache", "proxy.mp4"],
      [".thumbnails", "frame.jpg"],
      [".waveform-cache", "peaks.json"],
    ] as const;
    const generatedSignatures: string[] = [];
    for (const [dir, file] of generatedFiles) {
      mkdirSync(join(projectDir, dir));
      writeFileSync(join(projectDir, dir, file), `generated ${dir}`);
      generatedSignatures.push(await getSignature());
    }

    expect(generatedSignatures).toEqual([initial, initial, initial]);

    mkdirSync(join(projectDir, "src"));
    writeFileSync(join(projectDir, "src", "scene.ts"), "export const scene = true;");
    expect(await getSignature()).not.toBe(initial);
  });

  it("404s for an unknown project", async () => {
    const app = new Hono();
    registerProjectRoutes(app, {
      ...createAdapter(createProjectDir()),
      resolveProject: async () => null,
    });
    const response = await app.request("http://localhost/projects/nope/signature");
    expect(response.status).toBe(404);
  });
});

describe("project workspace mutations", () => {
  it("separates open and archived projects", async () => {
    const projectDir = createProjectDir();
    const app = new Hono();
    registerProjectRoutes(app, {
      ...createAdapter(projectDir),
      listProjects: () => [
        { id: "demo", dir: projectDir, title: "Demo" },
        { id: "old", dir: projectDir, title: "Old cut", archived: true },
      ],
    });

    const response = await app.request("http://localhost/projects");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      projects: [{ id: "demo" }],
      archivedProjects: [{ id: "old" }],
    });
  });

  it("duplicates a project through the adapter", async () => {
    const projectDir = createProjectDir();
    const createProject = vi.fn(() => ({ id: "demo-copy", dir: projectDir, title: "Demo copy" }));
    const app = new Hono();
    registerProjectRoutes(app, { ...createAdapter(projectDir), createProject });

    const response = await app.request("http://localhost/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceProjectId: "demo" }),
    });

    expect(response.status).toBe(201);
    expect(createProject).toHaveBeenCalledWith({ sourceProjectId: "demo", title: undefined });
    expect(await response.json()).toMatchObject({ id: "demo-copy", title: "Demo copy" });
  });

  it("renames a project through the adapter", async () => {
    const projectDir = createProjectDir();
    const renameProject = vi.fn((id: string, title: string) => ({ id, dir: projectDir, title }));
    const app = new Hono();
    registerProjectRoutes(app, { ...createAdapter(projectDir), renameProject });

    const response = await app.request("http://localhost/projects/demo/title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Instagram Reference" }),
    });

    expect(response.status).toBe(200);
    expect(renameProject).toHaveBeenCalledWith("demo", "Instagram Reference");
  });

  it("archives and restores a project through the adapter", async () => {
    const projectDir = createProjectDir();
    const setProjectArchived = vi.fn((id: string, archived: boolean) => ({
      id,
      dir: projectDir,
      archived,
    }));
    const app = new Hono();
    registerProjectRoutes(app, {
      ...createAdapter(projectDir),
      listProjects: () => [
        { id: "demo", dir: projectDir },
        { id: "other", dir: projectDir },
      ],
      setProjectArchived,
    });

    const archiveResponse = await app.request("http://localhost/projects/demo/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    const restoreResponse = await app.request("http://localhost/projects/demo/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });

    expect(archiveResponse.status).toBe(200);
    expect(restoreResponse.status).toBe(200);
    expect(setProjectArchived).toHaveBeenNthCalledWith(1, "demo", true);
    expect(setProjectArchived).toHaveBeenNthCalledWith(2, "demo", false);
  });

  it("keeps at least one project open", async () => {
    const projectDir = createProjectDir();
    const setProjectArchived = vi.fn();
    const app = new Hono();
    registerProjectRoutes(app, {
      ...createAdapter(projectDir),
      listProjects: () => [{ id: "demo", dir: projectDir }],
      setProjectArchived,
    });

    const response = await app.request("http://localhost/projects/demo/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    expect(response.status).toBe(400);
    expect(setProjectArchived).not.toHaveBeenCalled();
  });
});

describe("registerProjectRoutes — composition discovery (#1384)", () => {
  it("excludes HTML inside dot-directories from compositions", async () => {
    const projectDir = createProjectDir();
    const app = new Hono();
    registerProjectRoutes(app, createAdapter(projectDir));

    const response = await app.request("http://localhost/projects/demo");
    const payload = (await response.json()) as { compositions?: string[] };

    expect(response.status).toBe(200);
    expect(payload.compositions).toContain("index.html");
    expect(payload.compositions).toContain("compositions/scene.html");
    expect(payload.compositions).not.toContain(".cache/examples/preset.html");
    expect(payload.compositions).not.toContain(".hyperframes/examples/preset.html");
  });

  it("lists vendored dot-directory files in the file tree but hides Studio backups", async () => {
    const projectDir = createProjectDir();
    const app = new Hono();
    registerProjectRoutes(app, createAdapter(projectDir));

    const response = await app.request("http://localhost/projects/demo");
    const payload = (await response.json()) as { files?: string[] };

    // Vendored dot-dirs stay browsable — discovery is gated, the file tree is not.
    expect(payload.files).toContain(".cache/examples/preset.html");
    expect(payload.files).toContain(".hyperframes/examples/preset.html");
    // Only Studio's own backup snapshots are hidden from the tree (#1366).
    expect(payload.files).not.toContain(".hyperframes/backup/snapshot.html");
  });

  it("omits generated cache files from the project file tree", async () => {
    const projectDir = createProjectDir();
    mkdirSync(join(projectDir, ".transcode-cache"));
    writeFileSync(join(projectDir, ".transcode-cache", "proxy.mp4"), "proxy");
    mkdirSync(join(projectDir, ".waveform-cache"));
    writeFileSync(join(projectDir, ".waveform-cache", "peaks.json"), "[]");
    const app = new Hono();
    registerProjectRoutes(app, createAdapter(projectDir));

    const response = await app.request("http://localhost/projects/demo");
    const payload = (await response.json()) as { files?: string[] };

    expect(payload.files).not.toContain(".transcode-cache/proxy.mp4");
    expect(payload.files).not.toContain(".waveform-cache/peaks.json");
  });
});
