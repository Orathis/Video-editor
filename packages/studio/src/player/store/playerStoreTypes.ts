import type { TimelineElement } from "./timelineElement";

export type TimelineElementUpdates = Partial<
  Pick<
    TimelineElement,
    | "start"
    | "duration"
    | "track"
    | "zIndex"
    | "hasExplicitZIndex"
    | "playbackStart"
    | "label"
    | "trackLabel"
    | "hidden"
    | "timelineLocked"
  >
>;

export function resolveElementSelection(
  ids: Iterable<string>,
  anchor?: string | null,
): { selectedElementIds: Set<string>; selectedElementId: string | null } {
  const selectedElementIds = new Set(ids);
  if (selectedElementIds.size === 0) return { selectedElementIds, selectedElementId: null };
  if (anchor && selectedElementIds.has(anchor)) {
    return { selectedElementIds, selectedElementId: anchor };
  }
  return {
    selectedElementIds,
    selectedElementId: selectedElementIds.values().next().value ?? null,
  };
}

export function updateNumberSet(current: ReadonlySet<number>, value: number, included: boolean) {
  const next = new Set(current);
  if (included) next.add(value);
  else next.delete(value);
  return next;
}
