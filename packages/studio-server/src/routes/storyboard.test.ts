import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerStoryboardRoutes } from "./storyboard.js";
import type { StudioApiAdapter } from "../types.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "storyboard-route-"));
  tempDirs.push(dir);
  return dir;
}

function makeApp(projectDir: string): Hono {
  const adapter = {
    resolveProject: (id: string) => (id === "p" ? { id: "p", dir: projectDir } : null),
  } as unknown as StudioApiAdapter;
  const app = new Hono();
  registerStoryboardRoutes(app, adapter);
  return app;
}

/** Request the storyboard for project "p" and return status + parsed JSON body. */
async function getStoryboard(projectDir: string, path?: string) {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await makeApp(projectDir).request(`/projects/p/storyboard${query}`);
  return { status: res.status, body: await res.json() };
}

describe("GET /projects/:id/storyboard", () => {
  it("returns exists:false with empty frames when STORYBOARD.md is absent", async () => {
    const { status, body } = await getStoryboard(makeProject());
    expect(status).toBe(200);
    expect(body.exists).toBe(false);
    expect(body.frames).toEqual([]);
    expect(body.storyboards).toEqual([]);
  });

  it("404s for an unknown project", async () => {
    const res = await makeApp(makeProject()).request("/projects/nope/storyboard");
    expect(res.status).toBe(404);
  });

  it("parses the manifest and resolves frame src existence on disk", async () => {
    const dir = makeProject();
    mkdirSync(join(dir, "compositions", "frames"), { recursive: true });
    writeFileSync(join(dir, "compositions", "frames", "01-hook.html"), "<div></div>");
    writeFileSync(
      join(dir, "STORYBOARD.md"),
      `---
message: Hello world
---

## Frame 1 — Hook
- status: built
- src: compositions/frames/01-hook.html

Opening line.

## Frame 2 — Missing
- status: outline
- src: compositions/frames/02-missing.html

Not built yet.
`,
    );

    const { status, body } = await getStoryboard(dir);
    expect(status).toBe(200);
    expect(body.exists).toBe(true);
    expect(body.globals.message).toBe("Hello world");
    expect(body.frames).toHaveLength(2);
    expect(body.frames[0]).toMatchObject({ title: "Hook", status: "built", srcExists: true });
    expect(body.frames[1]).toMatchObject({ title: "Missing", status: "outline", srcExists: false });
  });

  it("surfaces the companion SCRIPT.md when present", async () => {
    const dir = makeProject();
    writeFileSync(join(dir, "STORYBOARD.md"), "## Frame 1\n\nHi.\n");
    writeFileSync(join(dir, "SCRIPT.md"), "# Script\n\nLine 1.\n");
    const { body } = await getStoryboard(dir);
    expect(body.script).toMatchObject({ exists: true, path: "SCRIPT.md" });
    expect(body.script.content).toContain("Line 1.");
  });

  it("discovers, sorts, and loads saved storyboards", async () => {
    const dir = makeProject();
    mkdirSync(join(dir, "storyboards"), { recursive: true });
    writeFileSync(join(dir, "STORYBOARD.md"), "## Frame 1 — Main\n\nMain board.\n");
    writeFileSync(
      join(dir, "storyboards", "storyboard-10.md"),
      "## Frame 1 — Ten\n\nTenth board.\n",
    );
    writeFileSync(
      join(dir, "storyboards", "storyboard-2.md"),
      "## Frame 1 — Two\n\nSecond board.\n",
    );

    const { status, body } = await getStoryboard(dir, "storyboards/storyboard-2.md");
    expect(status).toBe(200);
    expect(body.path).toBe("storyboards/storyboard-2.md");
    expect(body.frames[0].title).toBe("Two");
    expect(body.storyboards).toEqual([
      { path: "STORYBOARD.md", label: "Main" },
      { path: "storyboards/storyboard-2.md", label: "Storyboard 2" },
      { path: "storyboards/storyboard-10.md", label: "Storyboard 10" },
    ]);
  });

  it("uses an authored title for the saved-board tab label", async () => {
    const dir = makeProject();
    mkdirSync(join(dir, "storyboards"), { recursive: true });
    writeFileSync(join(dir, "STORYBOARD.md"), "---\ntitle: Primary Cut\n---\n");
    writeFileSync(join(dir, "storyboards", "storyboard-2.md"), "---\ntitle: Social Cut\n---\n");

    const { body } = await getStoryboard(dir);
    expect(body.storyboards).toEqual([
      { path: "STORYBOARD.md", label: "Primary Cut" },
      { path: "storyboards/storyboard-2.md", label: "Social Cut" },
    ]);
  });

  it("separates archived storyboards without deleting or hiding their source", async () => {
    const dir = makeProject();
    mkdirSync(join(dir, "storyboards"), { recursive: true });
    writeFileSync(join(dir, "STORYBOARD.md"), "---\ntitle: Main\n---\n");
    writeFileSync(
      join(dir, "storyboards", "old-cut.md"),
      "---\ntitle: Old Cut\narchived: true\n---\n\n## Frame 1 — Old\n",
    );

    const { body } = await getStoryboard(dir, "storyboards/old-cut.md");
    expect(body.exists).toBe(true);
    expect(body.storyboards).toEqual([{ path: "STORYBOARD.md", label: "Main" }]);
    expect(body.archivedStoryboards).toEqual([
      { path: "storyboards/old-cut.md", label: "Old Cut" },
    ]);
    expect(body.frames[0].title).toBe("Old");
  });

  it("returns an empty selected board without hiding other saved boards", async () => {
    const dir = makeProject();
    writeFileSync(join(dir, "STORYBOARD.md"), "## Frame 1 — Main\n\nMain board.\n");
    const { status, body } = await getStoryboard(dir, "storyboards/new-board.md");
    expect(status).toBe(200);
    expect(body.exists).toBe(false);
    expect(body.path).toBe("storyboards/new-board.md");
    expect(body.storyboards).toEqual([{ path: "STORYBOARD.md", label: "Main" }]);
  });

  it("rejects storyboard paths outside the managed board locations", async () => {
    const dir = makeProject();
    const traversal = await getStoryboard(dir, "storyboards/../SECRET.md");
    const arbitrary = await getStoryboard(dir, "notes/board.md");
    expect(traversal.status).toBe(400);
    expect(arbitrary.status).toBe(400);
  });

  it("reports script.exists=false when there is no SCRIPT.md", async () => {
    const dir = makeProject();
    writeFileSync(join(dir, "STORYBOARD.md"), "## Frame 1\n\nHi.\n");
    const { body } = await getStoryboard(dir);
    expect(body.script.exists).toBe(false);
  });

  it("does not resolve src paths that escape the project", async () => {
    const dir = makeProject();
    writeFileSync(
      join(dir, "STORYBOARD.md"),
      "## Frame 1\n- src: ../../etc/passwd\n\nEscape attempt.\n",
    );
    const { body } = await getStoryboard(dir);
    expect(body.frames[0].srcExists).toBe(false);
  });

  it("carries a project signature in both the absent and present branches", async () => {
    const dir = makeProject();
    const absent = await getStoryboard(dir);
    expect(absent.body.exists).toBe(false);
    expect(absent.body.signature).toMatch(/^[0-9a-f]{24}$/);

    writeFileSync(join(dir, "STORYBOARD.md"), "## Frame 1\n\nHi.\n");
    const present = await getStoryboard(dir);
    expect(present.body.exists).toBe(true);
    expect(present.body.signature).toMatch(/^[0-9a-f]{24}$/);
    expect(present.body.signature).not.toBe(absent.body.signature);
  });
});
