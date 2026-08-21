import type { StoryboardDocument } from "../../hooks/useStoryboard";

export const STORYBOARD_SPLIT_VIEW_DOCK_ID = "storyboard-split-view-dock";

export interface SplitComparisonPair {
  referenceStoryboardPath: string;
  referenceLabel: string;
  referenceComposition: string;
  secondaryStoryboardPath: string;
  secondaryComposition: string;
  secondaryLabel: string;
}

export interface StoryboardComparisonOption {
  path: string;
  label: string;
  kind: "template" | "version";
}

function normalizedPath(path: string | undefined): string {
  return (path ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

export function resolveSplitComparisonPair(
  documents: StoryboardDocument[],
  activeComposition: string | null,
): SplitComparisonPair | null {
  const activePath = normalizedPath(activeComposition ?? undefined);
  const active =
    (activePath
      ? documents.find((document) => normalizedPath(document.compositionPath) === activePath)
      : undefined) ??
    documents.find(
      (document) => document.kind === "reference" && document.groupId && document.compositionPath,
    );
  if (!active?.groupId) return null;
  const group = documents.filter((document) => document.groupId === active.groupId);
  const reference = group.find(
    (document) => document.kind === "reference" && document.compositionPath,
  );
  if (!reference?.compositionPath) return null;
  const secondary =
    active.kind === "reference"
      ? (group.find((document) => document.kind === "version" && document.compositionPath) ??
        group.find((document) => document.kind === "template" && document.compositionPath))
      : active;
  if (!secondary?.compositionPath || secondary.path === reference.path) return null;
  return {
    referenceStoryboardPath: reference.path,
    referenceLabel: reference.label || "Reference",
    referenceComposition: reference.compositionPath,
    secondaryStoryboardPath: secondary.path,
    secondaryComposition: secondary.compositionPath,
    secondaryLabel: secondary.label || (secondary.kind === "template" ? "Template" : "Version"),
  };
}

export function resolveStoryboardComparison(
  documents: StoryboardDocument[],
  activeStoryboardPath: string,
  selectedSecondaryPath?: string,
): { pair: SplitComparisonPair; options: StoryboardComparisonOption[] } | null {
  const active = documents.find((document) => document.path === activeStoryboardPath);
  const groupId =
    active?.groupId ??
    documents.find((document) => document.kind === "reference" && document.groupId)?.groupId;
  if (!groupId) return null;
  const group = documents.filter((document) => document.groupId === groupId);
  const reference = group.find(
    (document) => document.kind === "reference" && document.compositionPath,
  );
  if (!reference?.compositionPath) return null;
  const candidates = group.filter(
    (
      document,
    ): document is StoryboardDocument & {
      kind: "template" | "version";
      compositionPath: string;
    } =>
      (document.kind === "template" || document.kind === "version") &&
      Boolean(document.compositionPath),
  );
  const secondary =
    candidates.find((document) => document.path === selectedSecondaryPath) ??
    candidates.find((document) => document.path === active?.path) ??
    candidates.find((document) => document.kind === "template") ??
    candidates[0];
  if (!secondary) return null;
  return {
    pair: {
      referenceStoryboardPath: reference.path,
      referenceLabel: reference.label || "Reference",
      referenceComposition: reference.compositionPath,
      secondaryStoryboardPath: secondary.path,
      secondaryComposition: secondary.compositionPath,
      secondaryLabel: secondary.label || (secondary.kind === "template" ? "Template" : "Version"),
    },
    options: candidates.map((document) => ({
      path: document.path,
      label: document.label || (document.kind === "template" ? "Template" : "Version"),
      kind: document.kind,
    })),
  };
}
