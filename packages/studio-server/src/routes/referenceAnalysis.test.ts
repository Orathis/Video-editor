import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReferenceAnalysisManifest } from "@hyperframes/core/storyboard";
import type { StudioApiAdapter } from "../types.js";
import { registerReferenceAnalysisRoutes } from "./referenceAnalysis.js";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function manifest(id: string): ReferenceAnalysisManifest {
  return {
    version: 1,
    id,
    groupId: "group-1",
    createdAt: "2026-08-17T00:00:00.000Z",
    analyzerVersion: "test",
    source: {
      assetPath: "assets/references/source.mp4",
      sha256: "abc",
      durationSeconds: 2,
      width: 1080,
      height: 1920,
      frameRate: { num: 30, den: 1 },
      timebase: { num: 1, den: 30 },
      variableFrameRate: false,
      videoStartSeconds: 0,
      audioStartSeconds: 0,
      audioSampleRate: 48_000,
      audioChannels: 2,
    },
    frames: [
      { frameIndex: 0, pts: 0, timeSeconds: 0, durationSeconds: 1 / 30, keyframe: true },
      { frameIndex: 30, pts: 30, timeSeconds: 1, durationSeconds: 1 / 30, keyframe: true },
    ],
    cuts: [
      {
        id: "cut-0",
        kind: "start",
        frameIndex: 0,
        pts: 0,
        timeSeconds: 0,
        score: 1,
        confidence: "high",
        provenance: "ffprobe",
      },
    ],
    transitions: [],
    audioEvents: [],
    textDetections: [],
    scenes: [
      {
        id: "scene-1",
        title: "Scene 1",
        startFrame: 0,
        endFrame: 30,
        startSeconds: 0,
        endSeconds: 2,
        transitionIn: "start",
        confidence: "high",
      },
    ],
    warnings: [],
  };
}

describe("reference analysis routes", () => {
  it("imports a direct video URL and assigns its inferred name", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reference-link-route-"));
    dirs.push(dir);
    const sourcePath = join(dir, "assets", "references", "linked.mp4");
    mkdirSync(join(dir, "assets", "references"), { recursive: true });
    writeFileSync(sourcePath, "video");
    const adapter = { resolveProject: () => ({ id: "p", dir }) } as unknown as StudioApiAdapter;
    const app = new Hono();
    const downloadRemote = vi.fn(async () => ({
      sourcePath,
      assetPath: "assets/references/linked.mp4",
      title: "Instagram Launch Reel",
    }));
    registerReferenceAnalysisRoutes(app, adapter, {
      analyze: async (input) => manifest(input.analysisId ?? "missing"),
      downloadRemote,
    });

    const response = await app.request("/projects/p/reference-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl: "https://cdn.example.com/launch.mp4" }),
    });
    expect(response.status).toBe(202);
    const payload = (await response.json()) as { title: string; assetPath: string };
    expect(payload).toMatchObject({
      title: "Instagram Launch Reel",
      assetPath: "assets/references/linked.mp4",
    });
    expect(downloadRemote).toHaveBeenCalledWith({
      url: "https://cdn.example.com/launch.mp4",
      projectDir: dir,
    });
  });

  it("commits a reviewed analysis as linked, authored project files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reference-import-"));
    dirs.push(dir);
    const source = join(dir, "assets", "references", "source.mp4");
    mkdirSync(join(dir, "assets", "references"), { recursive: true });
    writeFileSync(source, "video");
    const adapter = { resolveProject: () => ({ id: "p", dir }) } as unknown as StudioApiAdapter;
    const app = new Hono();
    registerReferenceAnalysisRoutes(app, adapter, {
      analyze: async (input) => manifest(input.analysisId ?? "missing"),
    });
    const started = await app.request("/projects/p/reference-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputPath: "assets/references/source.mp4", title: "Reel" }),
    });
    const { analysisId } = (await started.json()) as { analysisId: string };
    await Promise.resolve();
    const committed = await app.request(`/projects/p/reference-analysis/${analysisId}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Reel", targetProfile: "9:16" }),
    });
    expect(committed.status).toBe(200);
    const payload = (await committed.json()) as {
      templateId: string;
      templateBoard: string;
      templateComposition: string;
    };
    expect(existsSync(join(dir, payload.templateBoard))).toBe(true);
    expect(readFileSync(join(dir, payload.templateBoard), "utf8")).toContain("kind: template");
    expect(readFileSync(join(dir, payload.templateComposition), "utf8")).toContain(
      'data-media-start="0"',
    );

    const versionResponse = await app.request(
      `/projects/p/templates/${payload.templateId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My version", targetProfile: "9:16" }),
      },
    );
    expect(versionResponse.status).toBe(201);
    const version = (await versionResponse.json()) as {
      versionId: string;
      compositionPath: string;
    };
    mkdirSync(join(dir, "assets", "template-slots"), { recursive: true });
    writeFileSync(join(dir, "assets", "template-slots", "replacement.mp4"), "replacement");
    const replaced = await app.request(`/projects/p/templates/${version.versionId}/slots/scene-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetPath: "assets/template-slots/replacement.mp4" }),
    });
    expect(replaced.status).toBe(200);
    const composition = readFileSync(join(dir, version.compositionPath), "utf8");
    expect(composition).toContain('src="../../assets/template-slots/replacement.mp4"');
    expect(composition).toContain('data-media-start="0"');
  });
});
