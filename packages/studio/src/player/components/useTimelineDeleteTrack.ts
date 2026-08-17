import { useCallback } from "react";
import type { TimelineElement } from "../store/playerStore";

type DeleteElement = (element: TimelineElement) => Promise<void> | void;

export function useTimelineDeleteTrack(onDeleteElement?: DeleteElement) {
  return useCallback(
    async (elements: readonly TimelineElement[]) => {
      if (!onDeleteElement) return;
      for (const element of elements) await onDeleteElement(element);
    },
    [onDeleteElement],
  );
}
