import { describe, expect, it } from "vitest";
import { sampleIndexAtTime, timeAtSample } from "./templateTypes.js";
import { parseStoryboard } from "./parseStoryboard.js";
import { setStoryboardRelationship } from "./editStoryboard.js";

describe("precision storyboard template types", () => {
  it("round-trips sample-aligned timing", () => {
    const sample = sampleIndexAtTime(3.217, 48_000);
    expect(sample).toBe(154_416);
    expect(timeAtSample(sample, 48_000)).toBe(3.217);
  });

  it("round-trips relationship metadata through canonical markdown", () => {
    const source = setStoryboardRelationship("## Frame 1 — Hook\n", {
      kind: "version",
      groupId: "group-launch",
      templateId: "template-main",
      templateRevision: 3,
      compositionPath: "compositions/storyboards/cut-a.html",
      analysisId: "analysis-reference",
      referenceAsset: "assets/references/source.mp4",
      sourceUrl: "https://example.com/reference",
      targetProfile: "9:16",
    });
    expect(parseStoryboard(source).globals).toMatchObject({
      kind: "version",
      groupId: "group-launch",
      templateId: "template-main",
      templateRevision: 3,
      compositionPath: "compositions/storyboards/cut-a.html",
      analysisId: "analysis-reference",
      referenceAsset: "assets/references/source.mp4",
      sourceUrl: "https://example.com/reference",
      targetProfile: "9:16",
    });
  });
});
