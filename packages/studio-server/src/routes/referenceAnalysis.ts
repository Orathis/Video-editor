import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, posix } from "node:path";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  buildReconstructedComposition,
  buildReconstructedStoryboard,
  buildTemplateManifest,
  parseStoryboard,
  setStoryboardRelationship,
  setStoryboardTitle,
  type ReferenceAnalysisManifest,
  type StoryboardTargetProfile,
  type TemplateManifest,
} from "@hyperframes/core/storyboard";
import type { StudioApiAdapter } from "../types.js";
import { resolveWithinProject } from "../helpers/safePath.js";
import {
  analyzeReferenceVideo,
  type ReferenceAnalysisInput,
  type ReferenceAnalysisProgress,
} from "../helpers/referenceAnalysis.js";
import {
  downloadRemoteReference,
  inferReferenceTitle,
  type DownloadedReference,
} from "../helpers/referenceSource.js";

type JobStatus = "analyzing" | "review" | "failed" | "cancelled" | "committed";

interface AnalysisJob {
  id: string;
  projectId: string;
  status: JobStatus;
  progress: number;
  stage: string;
  title: string;
  controller: AbortController;
  sourcePath: string;
  assetPath: string;
  sourceUrl?: string;
  groupId?: string;
  manifest?: ReferenceAnalysisManifest;
  error?: string;
}

export interface ReferenceAnalysisRouteOptions {
  analyze?: (input: ReferenceAnalysisInput) => Promise<ReferenceAnalysisManifest>;
  downloadRemote?: (input: { url: string; projectDir: string }) => Promise<DownloadedReference>;
}

function safeId(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "reference-template"
  );
}

function analysisPath(id: string): string {
  return `storyboards/analysis/${id}.json`;
}

function templatePath(id: string): string {
  return `storyboards/templates/${id}.json`;
}

function atomicWrite(projectDir: string, relativePath: string, content: string): void {
  const target = resolveWithinProject(projectDir, relativePath);
  if (!target) throw new Error(`Unsafe project path: ${relativePath}`);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  writeFileSync(temporary, content, "utf8");
  renameSync(temporary, target);
}

function transactionalWrite(
  projectDir: string,
  files: Record<string, string>,
): Array<{ path: string; before: string; after: string }> {
  const changes = Object.entries(files).map(([path, after]) => {
    const target = resolveWithinProject(projectDir, path);
    if (!target) throw new Error(`Unsafe project path: ${path}`);
    return { path, target, before: existsSync(target) ? readFileSync(target, "utf8") : "", after };
  });
  const staged = changes.map((change) => {
    mkdirSync(dirname(change.target), { recursive: true });
    const temporary = `${change.target}.${randomUUID()}.tmp`;
    writeFileSync(temporary, change.after, "utf8");
    return { ...change, temporary };
  });
  const committed: typeof staged = [];
  try {
    for (const change of staged) {
      renameSync(change.temporary, change.target);
      committed.push(change);
    }
  } catch (error) {
    for (const change of staged) {
      if (existsSync(change.temporary)) rmSync(change.temporary, { force: true });
    }
    for (const change of committed.reverse()) {
      if (change.before) atomicWrite(projectDir, change.path, change.before);
      else rmSync(change.target, { force: true });
    }
    throw error;
  }
  return changes.map(({ path, before, after }) => ({ path, before, after }));
}

function validManifest(value: unknown): value is ReferenceAnalysisManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<ReferenceAnalysisManifest>;
  return (
    manifest.version === 1 &&
    typeof manifest.id === "string" &&
    typeof manifest.groupId === "string" &&
    Array.isArray(manifest.frames) &&
    Array.isArray(manifest.scenes) &&
    Boolean(manifest.source?.assetPath)
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceSlotSource(source: string, slotId: string, assetPath: string): string {
  const slot = escapeRegex(slotId);
  const tagPattern = new RegExp(`<(video|audio)([^>]*data-slot-id=["']${slot}["'][^>]*)>`, "i");
  return source.replace(tagPattern, (whole, tag: string, attributes: string) => {
    const nextAttributes = /\ssrc=["'][^"']*["']/i.test(attributes)
      ? attributes.replace(/\ssrc=["'][^"']*["']/i, ` src="${assetPath}"`)
      : `${attributes} src="${assetPath}"`;
    const resetMediaStart = nextAttributes.replace(
      /\sdata-media-start=["'][^"']*["']/i,
      ' data-media-start="0"',
    );
    return `<${tag}${resetMediaStart}>`;
  });
}

function replaceSlotText(source: string, slotId: string, value: string): string {
  const slot = escapeRegex(slotId);
  const pattern = new RegExp(
    `(<([a-z0-9-]+)[^>]*data-slot-id=["']${slot}["'][^>]*>)([\\s\\S]*?)(</\\2>)`,
    "i",
  );
  const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return source.replace(pattern, `$1${escaped}$4`);
}

export function registerReferenceAnalysisRoutes(
  api: Hono,
  adapter: StudioApiAdapter,
  options: ReferenceAnalysisRouteOptions = {},
): void {
  const jobs = new Map<string, AnalysisJob>();
  const analyze = options.analyze ?? analyzeReferenceVideo;
  const downloadRemote = options.downloadRemote ?? downloadRemoteReference;

  const runAnalysis = (job: AnalysisJob, projectDir: string) => {
    const controller = new AbortController();
    job.controller = controller;
    job.status = "analyzing";
    job.progress = 0;
    job.stage = "Queued";
    job.error = undefined;
    void analyze({
      sourcePath: job.sourcePath,
      assetPath: job.assetPath,
      sourceUrl: job.sourceUrl,
      groupId: job.groupId,
      analysisId: job.id,
      signal: controller.signal,
      cacheDirectory:
        resolveWithinProject(projectDir, ".hyperframes/reference-analysis-cache") ?? undefined,
      onProgress: ({ progress, stage }: ReferenceAnalysisProgress) => {
        if (job.status !== "analyzing") return;
        job.progress = progress;
        job.stage = stage;
      },
    })
      .then((manifest) => {
        if (job.controller !== controller) return;
        if (job.status === "cancelled") return;
        job.manifest = manifest;
        job.status = "review";
        job.progress = 1;
        job.stage = "Ready for review";
        atomicWrite(projectDir, analysisPath(job.id), `${JSON.stringify(manifest, null, 2)}\n`);
      })
      .catch((error: unknown) => {
        if (job.controller !== controller) return;
        if (job.status === "cancelled" || controller.signal.aborted) {
          job.status = "cancelled";
          job.stage = "Cancelled";
          return;
        }
        job.status = "failed";
        job.stage = "Analysis failed";
        job.error = error instanceof Error ? error.message : String(error);
      });
  };

  api.post("/projects/:id/reference-analysis", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json().catch(() => ({}))) as {
      inputPath?: string;
      sourceUrl?: string;
      groupId?: string;
      title?: string;
    };
    const inputPath = typeof body.inputPath === "string" ? body.inputPath : undefined;
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : undefined;
    let imported: DownloadedReference | null = null;
    if (!inputPath && sourceUrl) {
      try {
        imported = await downloadRemote({ url: sourceUrl, projectDir: project.dir });
      } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
      }
    }
    if (!inputPath && !imported) {
      return c.json({ error: "Upload a video or enter a direct video URL." }, 400);
    }
    const assetPath = imported?.assetPath ?? inputPath ?? "";
    const sourcePath = imported?.sourcePath ?? resolveWithinProject(project.dir, assetPath);
    if (!sourcePath || !existsSync(sourcePath)) {
      return c.json({ error: "source media not found" }, 404);
    }
    const title =
      body.title?.trim() || imported?.title || inferReferenceTitle(assetPath || sourceUrl || "");
    const id = randomUUID();
    const job: AnalysisJob = {
      id,
      projectId: project.id,
      status: "analyzing",
      progress: 0,
      stage: "Queued",
      title,
      controller: new AbortController(),
      sourcePath,
      assetPath,
      sourceUrl,
      groupId: body.groupId,
    };
    jobs.set(id, job);
    runAnalysis(job, project.dir);
    return c.json({ analysisId: id, status: job.status, title, assetPath }, 202);
  });

  api.get("/projects/:id/reference-analysis/:analysisId/progress", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const job = jobs.get(c.req.param("analysisId"));
    if (!job || job.projectId !== project.id) return c.json({ error: "not found" }, 404);
    return streamSSE(c, async (stream) => {
      while (true) {
        await stream.writeSSE({
          event: "progress",
          data: JSON.stringify({
            analysisId: job.id,
            status: job.status,
            progress: job.progress,
            stage: job.stage,
            error: job.error,
          }),
        });
        if (job.status !== "analyzing") break;
        await stream.sleep(250);
      }
    });
  });

  api.post("/projects/:id/reference-analysis/:analysisId/cancel", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const job = jobs.get(c.req.param("analysisId"));
    if (!job || job.projectId !== project.id) return c.json({ error: "not found" }, 404);
    if (job.status === "analyzing") {
      job.status = "cancelled";
      job.stage = "Cancelled";
      job.controller.abort();
    }
    return c.json({ status: job.status });
  });

  api.post("/projects/:id/reference-analysis/:analysisId/retry", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const job = jobs.get(c.req.param("analysisId"));
    if (!job || job.projectId !== project.id) return c.json({ error: "not found" }, 404);
    if (job.status === "analyzing") return c.json({ error: "analysis is already running" }, 409);
    if (!existsSync(job.sourcePath)) return c.json({ error: "source media no longer exists" }, 409);
    runAnalysis(job, project.dir);
    return c.json({ analysisId: job.id, status: job.status }, 202);
  });

  api.get("/projects/:id/reference-analysis/:analysisId", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const id = c.req.param("analysisId");
    if (!safeId(id)) return c.json({ error: "invalid analysis id" }, 400);
    const job = jobs.get(id);
    if (job?.projectId === project.id && job.manifest) return c.json(job.manifest);
    const path = resolveWithinProject(project.dir, analysisPath(id));
    if (!path || !existsSync(path)) return c.json({ error: "not found" }, 404);
    return c.json(JSON.parse(readFileSync(path, "utf8")) as ReferenceAnalysisManifest);
  });

  api.put("/projects/:id/reference-analysis/:analysisId", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const id = c.req.param("analysisId");
    if (!safeId(id)) return c.json({ error: "invalid analysis id" }, 400);
    const manifest = (await c.req.json().catch(() => null)) as unknown;
    if (!validManifest(manifest) || manifest.id !== id) {
      return c.json({ error: "invalid analysis manifest" }, 400);
    }
    atomicWrite(project.dir, analysisPath(id), `${JSON.stringify(manifest, null, 2)}\n`);
    const job = jobs.get(id);
    if (job?.projectId === project.id) job.manifest = manifest;
    return c.json({ saved: true });
  });

  api.post("/projects/:id/reference-analysis/:analysisId/commit", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const id = c.req.param("analysisId");
    if (!safeId(id)) return c.json({ error: "invalid analysis id" }, 400);
    const path = resolveWithinProject(project.dir, analysisPath(id));
    const job = jobs.get(id);
    const manifest =
      job?.manifest ??
      (path && existsSync(path)
        ? (JSON.parse(readFileSync(path, "utf8")) as ReferenceAnalysisManifest)
        : null);
    if (!manifest || !validManifest(manifest)) return c.json({ error: "analysis not ready" }, 409);
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: string;
      targetProfile?: StoryboardTargetProfile;
    };
    const title = body.title?.trim() || job?.title || "Imported reference";
    const base = `${slug(title)}-${id.slice(0, 6)}`;
    const templateId = `template-${id}`;
    const referenceBoard = `storyboards/${base}-reference.md`;
    const templateBoard = `storyboards/${base}-template.md`;
    const referenceComposition = `compositions/storyboards/${base}-reference.html`;
    const templateComposition = `compositions/storyboards/${base}-template.html`;
    const template = buildTemplateManifest(manifest, {
      id: templateId,
      compositionPath: templateComposition,
      targetProfile: body.targetProfile,
    });
    const files: Record<string, string> = {
      [analysisPath(id)]: `${JSON.stringify(manifest, null, 2)}\n`,
      [templatePath(templateId)]: `${JSON.stringify(template, null, 2)}\n`,
      [referenceBoard]: buildReconstructedStoryboard(manifest, {
        title: `${title} — Reference`,
        kind: "reference",
        compositionPath: referenceComposition,
        targetProfile: body.targetProfile,
      }),
      [templateBoard]: buildReconstructedStoryboard(manifest, {
        title: `${title} — Template`,
        kind: "template",
        compositionPath: templateComposition,
        templateId,
        templateRevision: 1,
        targetProfile: template.targetProfile,
      }),
      [referenceComposition]: buildReconstructedComposition(manifest, {
        compositionPath: referenceComposition,
        compositionId: `${base}-reference`,
        role: "reference",
        targetProfile: body.targetProfile,
      }),
      [templateComposition]: buildReconstructedComposition(manifest, {
        compositionPath: templateComposition,
        compositionId: `${base}-template`,
        role: "template",
        targetProfile: template.targetProfile,
      }),
    };
    const changes = transactionalWrite(project.dir, files);
    if (job) {
      job.status = "committed";
      job.stage = "Template group created";
    }
    return c.json({
      committed: true,
      groupId: manifest.groupId,
      templateId,
      referenceBoard,
      templateBoard,
      referenceComposition,
      templateComposition,
      changes,
    });
  });

  api.post("/projects/:id/templates/:templateId/versions", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const templateId = c.req.param("templateId");
    if (!safeId(templateId)) return c.json({ error: "invalid template id" }, 400);
    const source = resolveWithinProject(project.dir, templatePath(templateId));
    if (!source || !existsSync(source)) return c.json({ error: "template not found" }, 404);
    const template = JSON.parse(readFileSync(source, "utf8")) as TemplateManifest;
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: string;
      targetProfile?: StoryboardTargetProfile;
    };
    const versionId = `version-${randomUUID()}`;
    const title = body.title?.trim() || "New version";
    const base = `${slug(title)}-${versionId.slice(-6)}`;
    const compositionPath = `compositions/storyboards/${base}.html`;
    const boardPath = `storyboards/${base}.md`;
    const analysisFile = resolveWithinProject(
      project.dir,
      analysisPath(template.referenceAnalysisId),
    );
    if (!analysisFile || !existsSync(analysisFile)) {
      return c.json({ error: "template analysis companion missing" }, 409);
    }
    const analysis = JSON.parse(readFileSync(analysisFile, "utf8")) as ReferenceAnalysisManifest;
    const version: TemplateManifest = {
      ...template,
      id: versionId,
      kind: "version",
      baseTemplateRevision: template.revision,
      baseSlots: template.slots.map((slot) => ({ ...slot, replacement: { ...slot.replacement } })),
      targetProfile: body.targetProfile ?? template.targetProfile,
      compositionPath,
      slots: template.slots.map((slot) => ({ ...slot, replacement: { ...slot.replacement } })),
    };
    const changes = transactionalWrite(project.dir, {
      [templatePath(versionId)]: `${JSON.stringify(version, null, 2)}\n`,
      [compositionPath]: buildReconstructedComposition(analysis, {
        compositionPath,
        compositionId: versionId,
        role: "version",
        targetProfile: version.targetProfile,
      }),
      [boardPath]: buildReconstructedStoryboard(analysis, {
        title,
        kind: "version",
        compositionPath,
        templateId,
        templateRevision: template.revision,
        targetProfile: version.targetProfile,
      }),
    });
    return c.json({ versionId, boardPath, compositionPath, changes }, 201);
  });

  api.get("/projects/:id/templates/manifest", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const composition = c.req.query("composition");
    if (!composition) return c.json({ error: "composition is required" }, 400);
    const directory = resolveWithinProject(project.dir, "storyboards/templates");
    if (!directory || !existsSync(directory)) return c.json({ error: "not found" }, 404);
    for (const name of readdirSync(directory).filter((entry) => entry.endsWith(".json"))) {
      try {
        const manifest = JSON.parse(
          readFileSync(resolveWithinProject(directory, name)!, "utf8"),
        ) as TemplateManifest;
        if (manifest.compositionPath === composition) return c.json(manifest);
      } catch {
        // Ignore unrelated/corrupt companion files and keep looking.
      }
    }
    return c.json({ error: "not found" }, 404);
  });

  api.get("/projects/:id/templates/:templateId/update-preview", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const templateId = c.req.param("templateId");
    const versionId = c.req.query("versionId");
    if (!safeId(templateId) || !versionId || !safeId(versionId)) {
      return c.json({ error: "valid templateId and versionId are required" }, 400);
    }
    const templateFile = resolveWithinProject(project.dir, templatePath(templateId));
    const versionFile = resolveWithinProject(project.dir, templatePath(versionId));
    if (!templateFile || !versionFile || !existsSync(templateFile) || !existsSync(versionFile)) {
      return c.json({ error: "manifest not found" }, 404);
    }
    const template = JSON.parse(readFileSync(templateFile, "utf8")) as TemplateManifest;
    const version = JSON.parse(readFileSync(versionFile, "utf8")) as TemplateManifest;
    const baseById = new Map((version.baseSlots ?? []).map((slot) => [slot.id, slot]));
    const versionById = new Map(version.slots.map((slot) => [slot.id, slot]));
    const changes = template.slots
      .map((slot) => {
        const base = baseById.get(slot.id);
        const current = versionById.get(slot.id);
        const templateChanged = JSON.stringify(slot) !== JSON.stringify(base);
        const versionChanged = JSON.stringify(current) !== JSON.stringify(base);
        return {
          slotId: slot.id,
          label: slot.label,
          templateChanged,
          versionChanged,
          conflict: templateChanged && versionChanged,
          template: slot,
          current,
          base,
        };
      })
      .filter((change) => change.templateChanged || change.versionChanged);
    return c.json({
      templateRevision: template.revision,
      baseTemplateRevision: version.baseTemplateRevision,
      changes,
    });
  });

  api.post("/projects/:id/templates/:templateId/apply-update", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const templateId = c.req.param("templateId");
    const body = (await c.req.json().catch(() => ({}))) as {
      versionId?: string;
      accept?: string[];
    };
    if (!safeId(templateId) || !body.versionId || !safeId(body.versionId)) {
      return c.json({ error: "valid templateId and versionId are required" }, 400);
    }
    const templateFile = resolveWithinProject(project.dir, templatePath(templateId));
    const versionFile = resolveWithinProject(project.dir, templatePath(body.versionId));
    if (!templateFile || !versionFile || !existsSync(templateFile) || !existsSync(versionFile)) {
      return c.json({ error: "manifest not found" }, 404);
    }
    const template = JSON.parse(readFileSync(templateFile, "utf8")) as TemplateManifest;
    const version = JSON.parse(readFileSync(versionFile, "utf8")) as TemplateManifest;
    const accepted = new Set(body.accept ?? []);
    const templateById = new Map(template.slots.map((slot) => [slot.id, slot]));
    const next: TemplateManifest = {
      ...version,
      baseTemplateRevision: template.revision,
      baseSlots: template.slots.map((slot) => ({ ...slot, replacement: { ...slot.replacement } })),
      slots: version.slots.map((slot) => {
        const templateSlot = templateById.get(slot.id);
        return accepted.has(slot.id) && templateSlot
          ? { ...templateSlot, replacement: { ...templateSlot.replacement } }
          : slot;
      }),
    };
    const changes = transactionalWrite(project.dir, {
      [templatePath(body.versionId)]: `${JSON.stringify(next, null, 2)}\n`,
    });
    return c.json({ manifest: next, changes });
  });

  api.post("/projects/:id/versions/:versionId/duplicate", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const versionId = c.req.param("versionId");
    if (!safeId(versionId)) return c.json({ error: "invalid version id" }, 400);
    const sourceManifestPath = resolveWithinProject(project.dir, templatePath(versionId));
    if (!sourceManifestPath || !existsSync(sourceManifestPath)) {
      return c.json({ error: "version not found" }, 404);
    }
    const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, "utf8")) as TemplateManifest;
    if (sourceManifest.kind !== "version")
      return c.json({ error: "only Versions can be duplicated" }, 409);
    const body = (await c.req.json().catch(() => ({}))) as { title?: string; sourceBoard?: string };
    if (!body.sourceBoard || !/^storyboards\/[^/\\]+\.md$/i.test(body.sourceBoard)) {
      return c.json({ error: "sourceBoard is required" }, 400);
    }
    const boardFile = resolveWithinProject(project.dir, body.sourceBoard);
    const compositionFile = resolveWithinProject(project.dir, sourceManifest.compositionPath);
    if (!boardFile || !compositionFile || !existsSync(boardFile) || !existsSync(compositionFile)) {
      return c.json({ error: "Version source files are missing" }, 409);
    }
    const newId = `version-${randomUUID()}`;
    const title = body.title?.trim() || "Version copy";
    const base = `${slug(title)}-${newId.slice(-6)}`;
    const boardPath = `storyboards/${base}.md`;
    const compositionPath = `compositions/storyboards/${base}.html`;
    const boardSource = readFileSync(boardFile, "utf8");
    const globals = parseStoryboard(boardSource).globals;
    const nextBoard = setStoryboardRelationship(setStoryboardTitle(boardSource, title), {
      kind: "version",
      groupId: globals.groupId,
      templateId: globals.templateId,
      templateRevision: globals.templateRevision,
      compositionPath,
      analysisId: globals.analysisId,
      referenceAsset: globals.referenceAsset,
      sourceUrl: globals.sourceUrl,
      targetProfile: globals.targetProfile,
    });
    const nextManifest: TemplateManifest = {
      ...sourceManifest,
      id: newId,
      compositionPath,
      slots: sourceManifest.slots.map((slot) => ({
        ...slot,
        replacement: { ...slot.replacement },
      })),
    };
    const changes = transactionalWrite(project.dir, {
      [templatePath(newId)]: `${JSON.stringify(nextManifest, null, 2)}\n`,
      [compositionPath]: readFileSync(compositionFile, "utf8").replaceAll(versionId, newId),
      [boardPath]: nextBoard,
    });
    return c.json({ versionId: newId, boardPath, compositionPath, changes }, 201);
  });

  api.patch("/projects/:id/templates/:manifestId/slots/:slotId", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const manifestId = c.req.param("manifestId");
    const slotId = c.req.param("slotId");
    if (!safeId(manifestId) || !safeId(slotId)) return c.json({ error: "invalid id" }, 400);
    const manifestFile = resolveWithinProject(project.dir, templatePath(manifestId));
    if (!manifestFile || !existsSync(manifestFile))
      return c.json({ error: "manifest not found" }, 404);
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as TemplateManifest;
    const slotIndex = manifest.slots.findIndex((slot) => slot.id === slotId);
    const slot = manifest.slots[slotIndex];
    if (!slot) return c.json({ error: "slot not found" }, 404);
    const body = (await c.req.json().catch(() => ({}))) as {
      assetPath?: string;
      value?: string;
      timingRule?: TemplateManifest["slots"][number]["timingRule"];
      required?: boolean;
      shortMediaPolicy?: TemplateManifest["slots"][number]["replacement"]["shortMediaPolicy"];
      focalPoint?: { x: number; y: number };
    };
    const compositionFile = resolveWithinProject(project.dir, manifest.compositionPath);
    if (!compositionFile || !existsSync(compositionFile)) {
      return c.json({ error: "composition not found" }, 409);
    }
    let composition = readFileSync(compositionFile, "utf8");
    let nextSlot = { ...slot, replacement: { ...slot.replacement } };
    if (body.assetPath != null) {
      const asset = resolveWithinProject(project.dir, body.assetPath);
      if (!asset || !existsSync(asset))
        return c.json({ error: "replacement asset not found" }, 404);
      const authoredPath = posix.relative(posix.dirname(manifest.compositionPath), body.assetPath);
      composition = replaceSlotSource(
        composition,
        slotId,
        authoredPath.startsWith(".") ? authoredPath : `./${authoredPath}`,
      );
      const { referenceAsset: _referenceAsset, ...withoutReference } = nextSlot;
      nextSlot = { ...withoutReference, value: body.assetPath };
    }
    if (body.value != null && (slot.kind === "text" || slot.kind === "cta")) {
      composition = replaceSlotText(composition, slotId, body.value);
      nextSlot.value = body.value;
    }
    if (body.timingRule) nextSlot.timingRule = body.timingRule;
    if (typeof body.required === "boolean") nextSlot.required = body.required;
    if (body.shortMediaPolicy) nextSlot.replacement.shortMediaPolicy = body.shortMediaPolicy;
    if (
      body.focalPoint &&
      Number.isFinite(body.focalPoint.x) &&
      Number.isFinite(body.focalPoint.y)
    ) {
      nextSlot.replacement.focalPoint = {
        x: Math.max(0, Math.min(1, body.focalPoint.x)),
        y: Math.max(0, Math.min(1, body.focalPoint.y)),
      };
    }
    const nextManifest: TemplateManifest = {
      ...manifest,
      revision: manifest.kind === "template" ? manifest.revision + 1 : manifest.revision,
      slots: manifest.slots.map((item, index) => (index === slotIndex ? nextSlot : item)),
    };
    const changes = transactionalWrite(project.dir, {
      [templatePath(manifestId)]: `${JSON.stringify(nextManifest, null, 2)}\n`,
      [manifest.compositionPath]: composition,
    });
    return c.json({ manifest: nextManifest, changes });
  });

  api.get("/projects/:id/templates/export-validation", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const composition = c.req.query("composition");
    if (!composition) return c.json({ affected: [] });
    const directory = resolveWithinProject(project.dir, "storyboards/templates");
    if (!directory || !existsSync(directory)) return c.json({ affected: [] });
    const manifests = readdirSync(directory)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => {
        try {
          return [
            JSON.parse(
              readFileSync(resolveWithinProject(directory, name)!, "utf8"),
            ) as TemplateManifest,
          ];
        } catch {
          return [];
        }
      });
    const manifest = manifests.find((candidate) => candidate.compositionPath === composition);
    if (!manifest) return c.json({ affected: [] });
    const affected = manifest.slots
      .filter((slot) => Boolean(slot.referenceAsset))
      .map((slot) => ({
        id: slot.id,
        label: slot.label,
        kind: slot.kind,
        track: slot.track,
        startSeconds: slot.startSeconds,
        referenceAsset: slot.referenceAsset,
      }));
    return c.json({
      affected,
      warning:
        affected.length > 0
          ? "Reference footage or guide audio remains in this timeline."
          : undefined,
    });
  });
}
