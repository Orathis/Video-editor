import { describe, expect, it } from "vitest";
import type { StoryboardDocument } from "../../hooks/useStoryboard";
import { resolveSplitComparisonPair, resolveStoryboardComparison } from "./SplitComparisonControl";

const documents: StoryboardDocument[] = [
  {
    path: "storyboards/reference.md",
    label: "Original",
    kind: "reference",
    groupId: "group-1",
    compositionPath: "compositions/reference.html",
  },
  {
    path: "storyboards/template.md",
    label: "Reusable template",
    kind: "template",
    groupId: "group-1",
    compositionPath: "compositions/template.html",
  },
  {
    path: "storyboards/version.md",
    label: "Launch cut",
    kind: "version",
    groupId: "group-1",
    compositionPath: "compositions/version.html",
  },
];

describe("resolveSplitComparisonPair", () => {
  it("pairs the active Template with its Reference", () => {
    expect(resolveSplitComparisonPair(documents, "compositions\\template.html")).toEqual({
      referenceStoryboardPath: "storyboards/reference.md",
      referenceLabel: "Original",
      referenceComposition: "compositions/reference.html",
      secondaryStoryboardPath: "storyboards/template.md",
      secondaryComposition: "compositions/template.html",
      secondaryLabel: "Reusable template",
    });
  });

  it("pairs the Reference with the first available Version", () => {
    expect(resolveSplitComparisonPair(documents, "compositions/reference.html")).toEqual({
      referenceStoryboardPath: "storyboards/reference.md",
      referenceLabel: "Original",
      referenceComposition: "compositions/reference.html",
      secondaryStoryboardPath: "storyboards/version.md",
      secondaryComposition: "compositions/version.html",
      secondaryLabel: "Launch cut",
    });
  });

  it("falls back to the available Template Group from an unrelated composition", () => {
    expect(resolveSplitComparisonPair(documents, "compositions/standalone.html")).toEqual({
      referenceStoryboardPath: "storyboards/reference.md",
      referenceLabel: "Original",
      referenceComposition: "compositions/reference.html",
      secondaryStoryboardPath: "storyboards/version.md",
      secondaryComposition: "compositions/version.html",
      secondaryLabel: "Launch cut",
    });
  });

  it("keeps split view available when the URL has no composition selection", () => {
    expect(resolveSplitComparisonPair(documents, null)).toEqual({
      referenceStoryboardPath: "storyboards/reference.md",
      referenceLabel: "Original",
      referenceComposition: "compositions/reference.html",
      secondaryStoryboardPath: "storyboards/version.md",
      secondaryComposition: "compositions/version.html",
      secondaryLabel: "Launch cut",
    });
  });

  it("lists Template and Version choices for the contextual storyboard control", () => {
    expect(
      resolveStoryboardComparison(documents, "storyboards/reference.md", "storyboards/template.md"),
    ).toEqual({
      pair: {
        referenceStoryboardPath: "storyboards/reference.md",
        referenceLabel: "Original",
        referenceComposition: "compositions/reference.html",
        secondaryStoryboardPath: "storyboards/template.md",
        secondaryComposition: "compositions/template.html",
        secondaryLabel: "Reusable template",
      },
      options: [
        { path: "storyboards/template.md", label: "Reusable template", kind: "template" },
        { path: "storyboards/version.md", label: "Launch cut", kind: "version" },
      ],
    });
  });
});
