import { describe, expect, it } from "vitest";
import type { ReferenceAnalysisManifest } from "./templateTypes.js";
import {
  buildReconstructedComposition,
  buildReconstructedStoryboard,
  buildTemplateManifest,
} from "./reconstruction.js";
import { parseStoryboard } from "./parseStoryboard.js";

const ANALYSIS: ReferenceAnalysisManifest = {
  version: 1,
  id: "analysis-a",
  groupId: "group-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  analyzerVersion: "test",
  source: {
    assetPath: "assets/references/source.mp4",
    sha256: "abc",
    durationSeconds: 3.217,
    width: 1080,
    height: 1920,
    frameRate: { num: 30, den: 1 },
    timebase: { num: 1, den: 90_000 },
    variableFrameRate: false,
    videoStartSeconds: 0,
    audioStartSeconds: 0.125,
    audioSampleRate: 48_000,
    audioChannels: 2,
  },
  frames: [],
  cuts: [],
  transitions: [],
  audioEvents: [],
  textDetections: [],
  scenes: [
    {
      id: "scene-1",
      title: "Scene 1",
      startFrame: 0,
      endFrame: 96,
      startSeconds: 0,
      endSeconds: 3.217,
      transitionIn: "start",
      confidence: "high",
    },
  ],
  warnings: [],
};

describe("reference reconstruction compiler", () => {
  it("creates linked storyboard metadata and precise scene timing", () => {
    const source = buildReconstructedStoryboard(ANALYSIS, {
      title: "Reference",
      kind: "reference",
      compositionPath: "compositions/storyboards/reference.html",
    });
    const board = parseStoryboard(source);
    expect(board.globals).toMatchObject({
      kind: "reference",
      groupId: "group-a",
    });
    expect(board.frames[0]?.durationSeconds).toBe(3.217);
    expect(board.frames[0]?.extra.source_end_frame).toBe("96");
  });

  it("creates real trimmed media and guide-audio timeline elements", () => {
    const source = buildReconstructedComposition(ANALYSIS, {
      compositionPath: "compositions/storyboards/reference.html",
      compositionId: "reference-a",
      role: "reference",
    });
    expect(source).toContain('data-media-start="0"');
    expect(source).toContain('class="clip reference-scene"');
    expect(source).toContain("data-reference-playback data-hyperframes-ignore");
    expect(source).toContain("display: none !important");
    expect(source).toContain("z-index: 2");
    expect(source).toContain('<audio id="reference-guide" class="clip"');
    expect(source).toContain('data-timeline-role="reference-guide"');
    expect(source).toContain('data-start="0.125" data-duration="3.092" data-media-start="0.125"');
    expect(source).toContain('src="assets/references/source.mp4"');
  });

  it("turns every scene and guide track into template slots", () => {
    const manifest = buildTemplateManifest(ANALYSIS, {
      id: "template-a",
      compositionPath: "compositions/storyboards/template-a.html",
    });
    expect(manifest.targetProfile).toBe("9:16");
    expect(manifest.slots.map((slot) => slot.kind)).toEqual(["media", "audio"]);
    expect(manifest.slots[0]?.replacement.shortMediaPolicy).toBe("ask");
    expect(manifest.slots[1]).toMatchObject({
      startSeconds: 0.125,
      durationSeconds: 3.092,
    });
  });
});
