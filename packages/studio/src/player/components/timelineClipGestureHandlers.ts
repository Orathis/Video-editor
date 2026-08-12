import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { usePlayerStore, type TimelineElement } from "../store/playerStore";
import type { DraggedClipState, ResizingClipState, BlockedClipState } from "./useTimelineClipDrag";
import { resolveBlockedTimelineEditIntent } from "./timelineEditing";
import type { TimelineEditCapabilities } from "./timelineEditCapabilities";
import type { TimelineEditCallbacks } from "./timelineCallbacks";
import { CLIP_HANDLE_W } from "./timelineLayout";
import { SPLIT_BOUNDARY_EPSILON_S } from "../../utils/timelineElementSplit";

export interface ClipGestureDeps {
  pps: number;
  onResizeElement?: TimelineEditCallbacks["onResizeElement"];
  onMoveElement?: TimelineEditCallbacks["onMoveElement"];
  onRazorSplit?: (element: TimelineElement, splitTime: number) => Promise<void> | void;
  onRazorSplitAll?: (splitTime: number) => Promise<void> | void;
  blockedClipRef: React.RefObject<BlockedClipState | null>;
  shiftClickClipRef: React.RefObject<{
    element: TimelineElement;
    anchorX: number;
    anchorY: number;
  } | null>;
  suppressClickRef: React.RefObject<boolean>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  setShowPopover(v: boolean): void;
  setRangeSelection(v: null): void;
  setResizingClip(v: ResizingClipState | null): void;
  setDraggedClip(v: DraggedClipState | null): void;
  setSelectedElementId(id: string | null): void;
  onSelectElement?: (element: TimelineElement | null) => void;
}

/**
 * The three pointer/click gestures a clip bar answers to. Factored out of
 * TimelineLanes' render loop — one call per rendered clip, closing over that
 * clip's own `el`/`elementKey`/`previewElement`/`capabilities` — so the huge
 * per-track map body reads as JSX instead of ~120 lines of gesture logic.
 */
export function createClipGestureHandlers(
  el: TimelineElement,
  elementKey: string,
  previewElement: TimelineElement,
  capabilities: TimelineEditCapabilities,
  deps: ClipGestureDeps,
) {
  const {
    pps,
    onResizeElement,
    onMoveElement,
    onRazorSplit,
    onRazorSplitAll,
    blockedClipRef,
    shiftClickClipRef,
    suppressClickRef,
    scrollRef,
    setShowPopover,
    setRangeSelection,
    setResizingClip,
    setDraggedClip,
    setSelectedElementId,
    onSelectElement,
  } = deps;

  const onResizeStart = (edge: "start" | "end", e: ReactPointerEvent): void => {
    if (e.button !== 0 || e.shiftKey || !onResizeElement) return;
    if (edge === "start" && !capabilities.canTrimStart) return;
    if (edge === "end" && !capabilities.canTrimEnd) return;
    e.stopPropagation();
    blockedClipRef.current = null;
    setShowPopover(false);
    setRangeSelection(null);
    setResizingClip({
      pointerId: e.pointerId,
      element: el,
      edge,
      originClientX: e.clientX,
      originScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      previewStart: el.start,
      previewDuration: el.duration,
      previewPlaybackStart: el.playbackStart,
      started: false,
    });
  };

  const onPointerDown = (e: ReactPointerEvent): void => {
    if (e.button !== 0) return;
    if (usePlayerStore.getState().activeTool === "razor") return;
    if (e.shiftKey) {
      shiftClickClipRef.current = { element: el, anchorX: e.clientX, anchorY: e.clientY };
      return;
    }
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const blockedIntent = resolveBlockedTimelineEditIntent({
      width: rect.width,
      offsetX: e.clientX - rect.left,
      handleWidth: CLIP_HANDLE_W,
      capabilities,
    });
    if (
      blockedIntent &&
      ((blockedIntent === "move" && onMoveElement) || (blockedIntent !== "move" && onResizeElement))
    ) {
      blockedClipRef.current = {
        pointerId: e.pointerId,
        element: el,
        intent: blockedIntent,
        originClientX: e.clientX,
        originClientY: e.clientY,
        started: false,
      };
      return;
    }
    if (!onMoveElement || !capabilities.canMove) return;
    blockedClipRef.current = null;
    setShowPopover(false);
    setRangeSelection(null);
    setDraggedClip({
      pointerId: e.pointerId,
      element: el,
      originClientX: e.clientX,
      originClientY: e.clientY,
      originScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      originScrollTop: scrollRef.current?.scrollTop ?? 0,
      pointerClientX: e.clientX,
      pointerClientY: e.clientY,
      pointerOffsetX: e.clientX - rect.left,
      pointerOffsetY: e.clientY - rect.top,
      previewStart: el.start,
      previewTrack: el.track,
      desiredTrack: el.track,
      insertRow: null,
      snapTime: null,
      snapType: null,
      started: false,
    });
  };

  const onClick = (e: ReactMouseEvent): void => {
    e.stopPropagation();
    if (suppressClickRef.current) return;
    const { activeTool } = usePlayerStore.getState();
    if (activeTool === "razor" && onRazorSplit) {
      const clipRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clickOffsetX = e.clientX - clipRect.left;
      const splitTime = previewElement.start + clickOffsetX / pps;
      const clampedTime = Math.max(
        previewElement.start + SPLIT_BOUNDARY_EPSILON_S,
        Math.min(
          previewElement.start + previewElement.duration - SPLIT_BOUNDARY_EPSILON_S,
          splitTime,
        ),
      );
      if (e.shiftKey && onRazorSplitAll) {
        onRazorSplitAll(clampedTime);
      } else {
        onRazorSplit(el, clampedTime);
      }
      return;
    }
    // Clip selection is idempotent; empty timeline space owns deselection.
    setSelectedElementId(elementKey);
    onSelectElement?.(el);
  };

  return { onResizeStart, onPointerDown, onClick };
}
