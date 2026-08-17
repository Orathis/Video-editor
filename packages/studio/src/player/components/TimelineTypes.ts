import type { ReactNode } from "react";
import type { TimelineElement } from "../store/playerStore";
import type { TimelineDropCallbacks } from "./timelineCallbacks";
import type { TimelineTheme } from "./timelineTheme";
import type { TimelineEditOverrides } from "./useResolvedTimelineEditCallbacks";

export interface TimelineClipRenderContext {
  priority: "overscan" | "visible" | "interaction";
  rich: boolean;
  /** Render only the audible portion of A/V media. Used by the expanded child
   *  row beneath a video without requesting a second strip of video frames. */
  audioOnly?: boolean;
}

export interface TimelineProps extends TimelineDropCallbacks, TimelineEditOverrides {
  /** Project-scoped reset boundary; soft source refreshes retain the same epoch. */
  sessionEpoch?: number;
  onSeek?: (time: number) => void;
  onDrillDown?: (element: TimelineElement) => void;
  renderClipContent?: (
    element: TimelineElement,
    style: { clip: string; label: string },
    context: TimelineClipRenderContext,
  ) => ReactNode;
  renderClipOverlay?: (element: TimelineElement) => ReactNode;
  onDuplicateElement?: (element: TimelineElement) => Promise<void> | void;
  onDeleteElement?: (element: TimelineElement) => Promise<void> | void;
  onAddFrameTrack?: () => Promise<void> | void;
  onSelectElement?: (element: TimelineElement | null) => void;
  theme?: Partial<TimelineTheme>;
}
