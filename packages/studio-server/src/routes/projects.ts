import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Hono } from "hono";
import type { StudioApiAdapter } from "../types.js";
import { isInHiddenOrVendorDir, walkDir } from "../helpers/safePath.js";
import { resolveProjectSignature } from "../helpers/projectSignature.js";

const COMPOSITION_ID_RE = /data-composition-id\s*=/;

async function filterCompositionFiles(projectDir: string, files: string[]): Promise<string[]> {
  const htmlFiles = files.filter((f) => f.endsWith(".html") && !isInHiddenOrVendorDir(f));
  const checks = await Promise.all(
    htmlFiles.map(async (f) => {
      try {
        const content = await readFile(join(projectDir, f), "utf-8");
        return COMPOSITION_ID_RE.test(content);
      } catch {
        return false;
      }
    }),
  );
  return htmlFiles.filter((_, i) => checks[i]);
}

export function registerProjectRoutes(api: Hono, adapter: StudioApiAdapter): void {
  // List all projects
  api.get("/projects", async (c) => {
    const allProjects = await adapter.listProjects();
    return c.json({
      projects: allProjects.filter((project) => !project.archived),
      archivedProjects: allProjects.filter((project) => project.archived),
    });
  });

  api.post("/projects", async (c) => {
    if (!adapter.createProject) return c.json({ error: "Project creation is not available" }, 501);
    const body = (await c.req.json().catch(() => null)) as {
      sourceProjectId?: unknown;
      title?: unknown;
    } | null;
    const sourceProjectId =
      typeof body?.sourceProjectId === "string" ? body.sourceProjectId.trim() : "";
    const title = typeof body?.title === "string" ? body.title.trim() : undefined;
    if (!sourceProjectId) return c.json({ error: "sourceProjectId is required" }, 400);
    try {
      return c.json(await adapter.createProject({ sourceProjectId, title }), 201);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  });

  api.post("/projects/:id/title", async (c) => {
    if (!adapter.renameProject) return c.json({ error: "Project rename is not available" }, 501);
    const body = (await c.req.json().catch(() => null)) as { title?: unknown } | null;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title is required" }, 400);
    try {
      return c.json(await adapter.renameProject(c.req.param("id"), title));
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  });

  api.post("/projects/:id/archive", async (c) => {
    if (!adapter.setProjectArchived) {
      return c.json({ error: "Project archiving is not available" }, 501);
    }
    const body = (await c.req.json().catch(() => null)) as { archived?: unknown } | null;
    if (typeof body?.archived !== "boolean") {
      return c.json({ error: "archived must be a boolean" }, 400);
    }
    if (body.archived) {
      const activeProjects = (await adapter.listProjects()).filter((project) => !project.archived);
      if (
        activeProjects.length <= 1 &&
        activeProjects.some((project) => project.id === c.req.param("id"))
      ) {
        return c.json({ error: "At least one project must remain open" }, 400);
      }
    }
    try {
      return c.json(await adapter.setProjectArchived(c.req.param("id"), body.archived));
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  });

  // Resolve session to project (multi-project mode)
  api.get("/resolve-session/:sessionId", async (c) => {
    if (!adapter.resolveSession) {
      return c.json({ error: "not available" }, 404);
    }
    const { sessionId } = c.req.param();
    const result = await adapter.resolveSession(sessionId);
    if (!result) return c.json({ error: "Session not found" }, 404);
    return c.json(result);
  });

  // Current content signature for a project — a cheap poll target for clients
  // that refresh themselves when files change on disk (the storyboard board
  // re-fetches when this differs from the signature its data was loaded with).
  api.get("/projects/:id/signature", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    return c.json({ signature: resolveProjectSignature(adapter, project.dir) });
  });

  // Project file tree
  api.get("/projects/:id", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const files = walkDir(project.dir);
    const compositions = await filterCompositionFiles(project.dir, files);
    return c.json({ id: project.id, dir: project.dir, title: project.title, files, compositions });
  });
}
