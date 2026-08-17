import { useCallback, useMemo, useRef, useState } from "react";
import { useMusicBeatAnalysis } from "../../hooks/useMusicBeatAnalysis";
import { remapBeatAnalysisToComposition } from "../../utils/beatEditActions";
import { useExpandedTimelineElements } from "../hooks/useExpandedTimelineElements";
import { getTimelineElementIndexes } from "../lib/timelineElementIndexes";
import { usePlayerStore } from "../store/playerStore";
import type { KeyframeDiamondContextMenuState } from "./KeyframeDiamondContextMenu";
import type { ClipContextMenuState } from "./TimelineOverlays";
import { GUTTER, LABEL_COL_W, TRACKS_LEFT_PAD } from "./timelineLayout";
import { getEffectiveTimelineDuration, hasKeyframedTimelineClips } from "./timelineViewModel";
import { useTimelineExtendedHandPan } from "./useTimelineExtendedHandPan";
import { useTimelineLaneMoveRefresh } from "./useTimelineLaneMoveRefresh";
import { useTimelineTrackLayout } from "./useTimelineTrackLayout";
import { useTimelineZoom } from "./useTimelineZoom";

export function useTimelineModel(sessionEpoch: number) {
  const refreshAfterLaneMove = useTimelineLaneMoveRefresh();
  useMusicBeatAnalysis();
  const rawElements = usePlayerStore((state) => state.elements);
  const expandedElements = useExpandedTimelineElements();
  const beatAnalysis = usePlayerStore((state) => state.beatAnalysis);
  const musicElement = usePlayerStore(
    (state) => getTimelineElementIndexes(state.elements).musicElement,
  );
  const beatEdits = usePlayerStore((state) => state.beatEdits);
  const adjustedBeatAnalysis = useMemo(
    () => remapBeatAnalysisToComposition(beatAnalysis, musicElement, beatEdits),
    [beatAnalysis, musicElement, beatEdits],
  );
  const duration = usePlayerStore((state) => state.duration);
  const timeDisplayMode = usePlayerStore((state) => state.timeDisplayMode);
  const timelineReady = usePlayerStore((state) => state.timelineReady);
  const selectedElementId = usePlayerStore((state) => state.selectedElementId);
  const selectedElementIds = usePlayerStore((state) => state.selectedElementIds);
  const focusedEaseSegment = usePlayerStore((state) => state.focusedEaseSegment);
  const gsapAnimations = usePlayerStore((state) => state.gsapAnimations);
  const labelMode = useMemo(() => hasKeyframedTimelineClips(gsapAnimations), [gsapAnimations]);
  const contentOrigin = labelMode ? LABEL_COL_W + GUTTER : GUTTER + TRACKS_LEFT_PAD;
  const contentGutter = labelMode ? GUTTER : 0;
  const setSelectedElementId = usePlayerStore((state) => state.setSelectedElementId);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const { zoomMode, manualZoomPercent, setZoomMode, setManualZoomPercent } = useTimelineZoom();
  const manualPixelsPerSecond = usePlayerStore((state) => state.timelinePps);
  const playheadRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTool = usePlayerStore((state) => state.activeTool);
  const { handPan, handPanExtentSeconds, ppsRef } = useTimelineExtendedHandPan({
    containerRef,
    scrollRef,
    contentOrigin,
    sessionEpoch,
    enabled: activeTool !== "razor",
  });
  const [hoveredClip, setHoveredClip] = useState<string | null>(null);
  const isDragging = useRef(false);
  const [showPopover, setShowPopover] = useState(false);
  const [kfContextMenu, setKfContextMenu] = useState<KeyframeDiamondContextMenuState | null>(null);
  const [clipContextMenu, setClipContextMenu] = useState<ClipContextMenuState | null>(null);
  const setContainerRef = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
  }, []);
  const lastScrollLeftRef = useRef(0);
  const effectiveDuration = useMemo(
    () => getEffectiveTimelineDuration(duration, rawElements),
    [duration, rawElements],
  );
  const keyframeCache = usePlayerStore((state) => state.keyframeCache);
  const trackLayout = useTimelineTrackLayout(
    expandedElements,
    gsapAnimations,
    selectedElementId,
    selectedElementIds,
  );

  return {
    refreshAfterLaneMove,
    rawElements,
    expandedElements,
    adjustedBeatAnalysis,
    duration,
    timeDisplayMode,
    timelineReady,
    selectedElementId,
    selectedElementIds,
    focusedEaseSegment,
    gsapAnimations,
    labelMode,
    contentOrigin,
    contentGutter,
    setSelectedElementId,
    currentTime,
    zoomMode,
    manualZoomPercent,
    setZoomMode,
    setManualZoomPercent,
    manualPixelsPerSecond,
    playheadRef,
    containerRef,
    scrollRef,
    activeTool,
    handPan,
    handPanExtentSeconds,
    ppsRef,
    hoveredClip,
    setHoveredClip,
    isDragging,
    showPopover,
    setShowPopover,
    kfContextMenu,
    setKfContextMenu,
    clipContextMenu,
    setClipContextMenu,
    setContainerRef,
    lastScrollLeftRef,
    effectiveDuration,
    keyframeCache,
    ...trackLayout,
  };
}
