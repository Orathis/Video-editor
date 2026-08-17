import { useRef, useMemo, useCallback, memo } from "react";
import { usePlayerStore, type TimelineElement } from "../store/playerStore";
import { defaultTimelineTheme } from "./timelineTheme";
import { useTimelineRangeSelection } from "./useTimelineRangeSelection";
import { useTimelinePlayhead } from "./useTimelinePlayhead";
import { useTimelineAssetDrop } from "./timelineDragDrop";
import { TimelineEmptyState } from "./TimelineEmptyState";
import { TimelineCanvas } from "./TimelineCanvas";
import { useTimelineClipDrag } from "./useTimelineClipDrag";
import { TimelineOverlays } from "./TimelineOverlays";
import { useTimelineEditPinning } from "./useTimelineEditPinning";
import { useTimelineStackingSync } from "./useTimelineStackingSync";
import { useTimelineGeometry } from "./useTimelineGeometry";
import { LABEL_COL_W } from "./timelineLayout";
import { useTimelineScrollViewport } from "./useTimelineScrollViewport";
import { useResolvedTimelineEditCallbacks } from "./useResolvedTimelineEditCallbacks";
import type { TimelineProps } from "./TimelineTypes";
import { getTrackStyle, useTimelineDisplayLayout } from "./useTimelineTrackLayout";
import { useTimelineKeyframeHandlers } from "./useTimelineKeyframeHandlers";
import { useTrackGapMenu } from "./useTrackGapMenu";
import { useTimelineGapHighlights } from "./useTimelineGapHighlights";
import { TimelineRazorGuide, useTimelineRazorInteraction } from "./TimelineRazorInteraction";
import { useTimelinePerformanceTelemetry } from "./useTimelinePerformanceTelemetry";
import { getTimelinePreviewElement } from "./timelineViewModel";
import { useTimelineSelectionLifecycle } from "./useTimelineSelectionLifecycle";
import { useTimelineTicks } from "./useTimelineTicks";
import { getTimelineElementIdentity } from "../lib/timelineElementHelpers";
import { useTimelineClipRenderWindow } from "./useTimelineClipRenderWindow";
import { useTimelineActiveClips } from "./useTimelineActiveClips";
import { useTimelineLogicalFocus } from "./useTimelineLogicalFocus";
import { TimelineAddFrameButton } from "./TimelineAddFrameButton";
import { useTimelineModel } from "./useTimelineModel";
import { useTimelineDeleteTrack } from "./useTimelineDeleteTrack";

export {
  shouldAutoScrollTimeline,
  getTimelineScrollLeftForZoomTransition,
  getTimelineScrollLeftForZoomAnchor,
  getTimelinePlaybackFollowScrollLeft,
  getTimelinePlayheadLeft,
  getTimelineCanvasHeight,
  shouldShowTimelineShortcutHint,
  resolveTimelineAssetDrop,
  shouldHandleTimelineDeleteKey,
  getDefaultDroppedTrack,
} from "./timelineLayout";
export { formatTimelineTickLabel, generateTicks } from "./timelineRulerGeometry";

export {
  getTimelineScrollTopForGeometryChange,
  getTimelineVisibleTimeRange,
} from "./timelineViewportGeometry";
export const Timeline = memo(function Timeline({
  onSeek,
  onDrillDown,
  renderClipContent,
  renderClipOverlay,
  onFileDrop,
  onAssetDrop,
  onBlockDrop,
  onCompositionDrop,
  onDuplicateElement: _onDuplicateElement,
  onDeleteElement: _onDeleteElement,
  onAddFrameTrack,
  onMoveElement: onMoveElementOverride,
  onMoveElements: onMoveElementsOverride,
  onResizeElement: onResizeElementOverride,
  onResizeElements: onResizeElementsOverride,
  onBlockedEditAttempt: onBlockedEditAttemptOverride,
  onSplitElement: onSplitElementOverride,
  onSelectElement,
  theme: themeOverrides,
  sessionEpoch = 0,
}: TimelineProps = {}) {
  const {
    onMoveElement,
    onMoveElements,
    onResizeElement,
    onResizeElements,
    onBlockedEditAttempt,
    onSplitElement,
    onRazorSplitAll,
    onDeleteKeyframe,
    onDeleteAllKeyframes,
    onMoveKeyframeToPlayhead,
    onMoveKeyframe,
  } = useResolvedTimelineEditCallbacks({
    onMoveElement: onMoveElementOverride,
    onMoveElements: onMoveElementsOverride,
    onResizeElement: onResizeElementOverride,
    onResizeElements: onResizeElementsOverride,
    onBlockedEditAttempt: onBlockedEditAttemptOverride,
    onSplitElement: onSplitElementOverride,
  });
  const theme = useMemo(() => ({ ...defaultTimelineTheme, ...themeOverrides }), [themeOverrides]);
  const handleDeleteTrack = useTimelineDeleteTrack(_onDeleteElement);
  const {
    refreshAfterLaneMove,
    expandedElements,
    adjustedBeatAnalysis,
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
    tracks,
    trackStyles,
    trackOrder,
    trackOrderRef,
    laneCounts,
    rowGeometry,
    rowGeometryRef,
  } = useTimelineModel(sessionEpoch);
  const expandedElementsRef = useRef(expandedElements);
  expandedElementsRef.current = expandedElements;
  const durationRef = useRef(effectiveDuration);
  durationRef.current = effectiveDuration;
  const fitPpsRef = useRef(100);
  const {
    pinZoomBeforeEdit,
    setRangeSelectionRef,
    pinnedOnMoveElement,
    pinnedOnMoveElements,
    pinnedOnResizeElement,
    pinnedOnResizeElements,
    pinnedOnFileDrop,
    pinnedOnAssetDrop,
    pinnedOnBlockDrop,
    pinnedOnCompositionDrop,
  } = useTimelineEditPinning({
    ppsRef,
    fitPpsRef,
    onMoveElement,
    onMoveElements,
    onResizeElement,
    onResizeElements,
    onFileDrop,
    onAssetDrop,
    onBlockDrop,
    onCompositionDrop,
  });
  const { readClipZIndex, applyStackingPatches, zSyncEnabled } = useTimelineStackingSync({
    expandedElementsRef,
  });
  const {
    gapMenuModel,
    gapHighlight,
    setHoveredGapAction,
    openGapMenu,
    dismissGapMenu,
    closeTrackGap,
    closeAllTrackGaps,
  } = useTrackGapMenu({
    tracks,
    expandedElementsRef,
    trackOrderRef,
    onMoveElement: pinnedOnMoveElement,
    onMoveElements: pinnedOnMoveElements,
  });

  const {
    draggedClip,
    setDraggedClip,
    resizingClip,
    setResizingClip,
    blockedClipRef,
    suppressClickRef,
  } = useTimelineClipDrag({
    scrollRef,
    ppsRef,
    durationRef,
    trackOrderRef,
    rowGeometryRef,
    onMoveElement: pinnedOnMoveElement,
    onMoveElements: pinnedOnMoveElements,
    onResizeElement: pinnedOnResizeElement,
    onResizeElements: pinnedOnResizeElements,
    onBlockedEditAttempt,
    setShowPopover,
    setRangeSelectionRef,
    readZIndex: zSyncEnabled ? readClipZIndex : undefined,
    onStackingPatches: zSyncEnabled ? applyStackingPatches : undefined,
    refreshAfterLaneMove,
    sessionEpoch,
  });

  const assetDrop = useTimelineAssetDrop({
    scrollRef,
    ppsRef,
    durationRef,
    trackOrderRef,
    rowGeometryRef,
    contentOrigin,
    onFileDrop: pinnedOnFileDrop,
    onAssetDrop: pinnedOnAssetDrop,
    onBlockDrop: pinnedOnBlockDrop,
    onCompositionDrop: pinnedOnCompositionDrop,
    sessionEpoch,
  });
  const displayLayout = useTimelineDisplayLayout(draggedClip, trackOrder, rowGeometry);
  const resizingElementIds =
    resizingClip?.groupPreview?.map((change) => change.key) ??
    (resizingClip ? [getTimelineElementIdentity(resizingClip.element)] : undefined);
  const { recordTimelineScroll } = useTimelinePerformanceTelemetry({
    totalClipCount: expandedElements.length,
    totalRowCount: displayLayout.displayTrackOrder.length,
    zoomMode,
  });
  const { viewport, showShortcutHint, setScrollRef, syncScrollViewport } =
    useTimelineScrollViewport(scrollRef, [
      timelineReady,
      expandedElements.length,
      displayLayout.totalH,
    ]);
  const { pps, fitPps, displayContentWidth, displayDuration, zoomModeRef, manualZoomPercentRef } =
    useTimelineGeometry({
      viewportWidth: viewport.clientWidth,
      effectiveDuration,
      minimumDisplayDuration: handPanExtentSeconds,
      zoomMode,
      manualZoomPercent,
      manualPixelsPerSecond,
      ppsRef,
      fitPpsRef,
      draggedClip,
      resizingClip,
      expandedElements,
      isDragging,
      scrollRef,
      lastScrollLeftRef,
      contentOrigin,
    });
  const timelineFocus = useTimelineLogicalFocus({
    scrollRef,
    tracks,
    layout: displayLayout,
    laneCounts,
    selectedElementId,
    selectedElementIds,
    gsapAnimations,
    elements: expandedElements,
    pixelsPerSecond: pps,
    contentOrigin,
    allowHorizontal: zoomMode === "manual",
    viewport,
    sessionEpoch,
    draggedRowKey: draggedClip?.started ? draggedClip.previewTrack : undefined,
    resizingElementIds,
    clipContextMenuRowKey: clipContextMenu?.element.track,
    keyframeContextMenuRowKey: kfContextMenu?.element.track,
    lastScrollLeftRef,
    syncScrollViewport,
  });
  const selectedKeyframes = usePlayerStore((s) => s.selectedKeyframes);
  const toggleSelectedKeyframe = usePlayerStore((s) => s.toggleSelectedKeyframe);
  const { onClickKeyframe, onSelectSegment, onShiftClickKeyframe, onContextMenuKeyframe } =
    useTimelineKeyframeHandlers({
      expandedElements,
      keyframeCache,
      onSelectElement,
      onSeek,
      setSelectedElementId,
      setKfContextMenu,
      toggleSelectedKeyframe,
    });

  const { clipIndex, renderTimeRange, visibleTimeRange, pinnedClipIdentities } =
    useTimelineClipRenderWindow({
      tracks,
      viewport,
      pixelsPerSecond: pps,
      contentOrigin,
      duration: displayDuration,
      selectedElementId: selectedElementId ?? undefined,
      draggedElementId: draggedClip ? getTimelineElementIdentity(draggedClip.element) : undefined,
      resizingElementIds,
      focusedElementId: timelineFocus.pinnedElementId,
      focusedEaseElementId: focusedEaseSegment?.elementId,
      clipContextMenuElementId: clipContextMenu
        ? getTimelineElementIdentity(clipContextMenu.element)
        : undefined,
      keyframeContextMenuElementId: kfContextMenu
        ? getTimelineElementIdentity(kfContextMenu.element)
        : undefined,
    });
  useTimelineActiveClips({
    scrollRef,
    currentTime,
    clipStateVersion: renderTimeRange,
    elementStateVersion: expandedElements,
  });
  const laneGapStrips = useTimelineGapHighlights({
    gapHighlight,
    tracks,
    selectedElementId,
    selectedElementIds,
    expandedElements,
    dragActive: draggedClip?.started === true || resizingClip != null,
    displayDuration,
  });

  const { seekFromX, autoScrollDuringDrag, dragScrollRaf } = useTimelinePlayhead({
    playheadRef,
    scrollRef,
    ppsRef,
    durationRef,
    isDragging,
    currentTime,
    zoomMode,
    manualZoomPercent,
    zoomModeRef,
    manualZoomPercentRef,
    fitPps,
    fitPpsRef,
    effectiveDuration,
    pps,
    timelineReady,
    elementsLength: expandedElements.length,
    setZoomMode,
    setManualZoomPercent,
    onSeek,
    contentOrigin,
  });
  const { razorGuideX, updateRazorGuide, clearRazorGuide, splitAllAtPointer } =
    useTimelineRazorInteraction({
      active: activeTool === "razor",
      scrollRef,
      contentOrigin,
      pixelsPerSecond: pps,
      onSplitAll: onRazorSplitAll,
    });

  const {
    rangeSelection,
    setRangeSelection,
    shiftClickClipRef,
    marqueeRect,
    isScrubbing,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useTimelineRangeSelection({
    scrollRef,
    ppsRef,
    effectiveDuration,
    pps,
    onSeek,
    seekFromX,
    autoScrollDuringDrag,
    dragScrollRaf,
    isDragging,
    setShowPopover,
    elementsRef: expandedElementsRef,
    clipIndex,
    rowGeometryRef,
    onSelectElement,
    contentOrigin,
    sessionEpoch,
  });
  setRangeSelectionRef.current = setRangeSelection; // stable ref consumed by useTimelineClipDrag

  useTimelineSelectionLifecycle(expandedElements, selectedElementId, setShowPopover, () =>
    setRangeSelection(null),
  );

  const { major, minor, majorTickInterval } = useTimelineTicks(
    displayDuration,
    pps,
    timeDisplayMode,
    timelineFocus.rowVirtualizationActive ? renderTimeRange : undefined,
  );

  const getPreviewElement = useCallback(
    (element: TimelineElement): TimelineElement => getTimelinePreviewElement(element, resizingClip),
    [resizingClip],
  );

  if (!timelineReady || expandedElements.length === 0) {
    return (
      <TimelineEmptyState
        isDragOver={assetDrop.isDragOver}
        onFileDrop={!!onFileDrop}
        onDragOver={assetDrop.handleAssetDragOver}
        onDragLeave={assetDrop.handleAssetDragLeave}
        onDrop={assetDrop.handleAssetDrop}
      />
    );
  }

  return (
    <div
      ref={setContainerRef}
      aria-label="Timeline"
      data-timeline-element-count={expandedElements.length}
      className={`relative border-t select-none h-full overflow-hidden ${assetDrop.isDragOver ? "ring-1 ring-inset ring-studio-accent/60" : ""} ${activeTool === "razor" ? "cursor-crosshair" : "cursor-default"}`}
      onPointerEnter={handPan.handlePointerEnter}
      onPointerLeave={handPan.handlePointerLeave}
      onClickCapture={handPan.handleClickCapture}
      onAuxClickCapture={handPan.handleClickCapture}
      onDoubleClickCapture={handPan.handleClickCapture}
      onContextMenuCapture={handPan.handleContextMenuCapture}
      onMouseMove={updateRazorGuide}
      onMouseLeave={clearRazorGuide}
      style={{
        touchAction: "pan-x pan-y",
        background: theme.shellBackground,
        borderColor: theme.shellBorder,
      }}
    >
      <TimelineAddFrameButton onAddFrameTrack={onAddFrameTrack} />
      <div
        ref={setScrollRef}
        // Stable owner for gestures that must survive virtual row/clip unmounts.
        data-timeline-scroll-viewport
        data-timeline-auto-scroll-left-inset={labelMode ? LABEL_COL_W : 0}
        tabIndex={-1}
        className={`${zoomMode === "fit" ? "overflow-x-hidden" : "overflow-x-auto"} overflow-y-auto h-full outline-none`}
        // The timeline owns geometry anchoring; browser anchoring otherwise competes with it
        // as drag overlays mount/unmount, making the whole track block snap back.
        style={{ overflowAnchor: "none" }}
        onScroll={(e) => {
          lastScrollLeftRef.current = e.currentTarget.scrollLeft; // restored across post-edit reload
          recordTimelineScroll(e.currentTarget);
          syncScrollViewport(e.currentTarget, true);
        }}
        {...timelineFocus.timelineFocusProps}
        onDragOver={assetDrop.handleAssetDragOver}
        onDragLeave={assetDrop.handleAssetDragLeave}
        onDrop={assetDrop.handleAssetDrop}
        onPointerDownCapture={handPan.handlePointerDownCapture}
        onPointerMoveCapture={handPan.handlePointerMoveCapture}
        onPointerUpCapture={handPan.handlePointerEndCapture}
        onPointerCancelCapture={handPan.handlePointerEndCapture}
        onPointerDown={(e) => {
          // Interactive controls own their clicks; scrubbing would preventDefault and eat them.
          if (e.target instanceof Element && e.target.closest("button, input, select, a")) return;
          if (splitAllAtPointer(e)) return;
          handlePointerDown(e);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
      >
        <TimelineCanvas
          major={major}
          minor={minor}
          pps={pps}
          contentOrigin={contentOrigin}
          contentGutter={contentGutter}
          trackContentWidth={displayContentWidth}
          totalH={displayLayout.totalH}
          effectiveDuration={effectiveDuration}
          majorTickInterval={majorTickInterval}
          rangeSelection={rangeSelection}
          marqueeRect={marqueeRect}
          laneGapStrips={laneGapStrips}
          theme={theme}
          displayTrackOrder={displayLayout.displayTrackOrder}
          rowHeights={displayLayout.displayRowHeights}
          rowGeometry={displayLayout.rowGeometry}
          virtualRows={timelineFocus.virtualRows}
          logicalRows={timelineFocus.logicalRows}
          focusedTargetId={timelineFocus.focusedTargetId}
          rowsVirtualized={timelineFocus.rowVirtualizationActive}
          clipIndex={clipIndex}
          renderTimeRange={renderTimeRange}
          visibleTimeRange={visibleTimeRange}
          pinnedClipIdentities={pinnedClipIdentities}
          trackOrder={trackOrder}
          tracks={tracks}
          trackStyles={trackStyles}
          laneCounts={laneCounts}
          selectedElementId={selectedElementId}
          selectedElementIds={selectedElementIds}
          hoveredClip={hoveredClip}
          draggedClip={draggedClip}
          resizingClip={resizingClip}
          isScrubbing={isScrubbing}
          blockedClipRef={blockedClipRef}
          suppressClickRef={suppressClickRef}
          scrollRef={scrollRef}
          // Windowing drops content to mount a row cheaply; unvirtualized it is pure cost.
          renderClipContent={
            timelineFocus.rowVirtualizationActive && viewport.isScrolling
              ? undefined
              : renderClipContent
          }
          renderClipOverlay={renderClipOverlay}
          playheadRef={playheadRef}
          onDrillDown={onDrillDown}
          onSelectElement={onSelectElement}
          onDeleteTrack={handleDeleteTrack}
          setHoveredClip={setHoveredClip}
          setShowPopover={setShowPopover}
          setRangeSelection={setRangeSelection}
          setResizingClip={setResizingClip}
          setDraggedClip={setDraggedClip}
          setSelectedElementId={setSelectedElementId}
          shiftClickClipRef={shiftClickClipRef}
          getPreviewElement={getPreviewElement}
          getTrackStyle={getTrackStyle}
          keyframeCache={keyframeCache}
          gsapAnimations={gsapAnimations}
          selectedKeyframes={selectedKeyframes}
          currentTime={currentTime}
          onSeek={onSeek}
          beatAnalysis={adjustedBeatAnalysis}
          onSelectSegment={onSelectSegment}
          onClickKeyframe={onClickKeyframe}
          onShiftClickKeyframe={onShiftClickKeyframe}
          onMoveKeyframe={onMoveKeyframe}
          onContextMenuKeyframe={onContextMenuKeyframe}
          onContextMenuClip={(e, el) => {
            e.preventDefault();
            setSelectedElementId(el.key ?? el.id);
            onSelectElement?.(el);
            dismissGapMenu();
            setClipContextMenu({
              x: e.clientX,
              y: e.clientY,
              element: el,
              sessionEpoch: usePlayerStore.getState().timelineSessionEpoch,
            });
          }}
          onContextMenuLane={(e, track, time) => {
            if (draggedClip?.started || resizingClip) return;
            setClipContextMenu(null);
            openGapMenu({ x: e.clientX, y: e.clientY, track, time });
          }}
        />
        {activeTool === "razor" && razorGuideX !== null && <TimelineRazorGuide x={razorGuideX} />}
      </div>
      <TimelineOverlays
        elements={expandedElements}
        elementsRef={expandedElementsRef}
        theme={theme}
        showShortcutHint={showShortcutHint}
        showPopover={showPopover}
        rangeSelection={rangeSelection}
        setShowPopover={setShowPopover}
        setRangeSelection={setRangeSelection}
        kfContextMenu={kfContextMenu}
        setKfContextMenu={setKfContextMenu}
        onDeleteKeyframe={onDeleteKeyframe}
        onDeleteAllKeyframes={onDeleteAllKeyframes}
        onMoveKeyframeToPlayhead={onMoveKeyframeToPlayhead}
        clipContextMenu={clipContextMenu}
        setClipContextMenu={setClipContextMenu}
        currentTime={currentTime}
        onSplitElement={onSplitElement}
        pinZoomBeforeEdit={pinZoomBeforeEdit}
        onDuplicateElement={_onDuplicateElement}
        onDeleteElement={_onDeleteElement}
        gapContextMenu={gapMenuModel}
        onDismissGapContextMenu={dismissGapMenu}
        onCloseTrackGap={closeTrackGap}
        onCloseAllTrackGaps={closeAllTrackGaps}
        onHoverGapAction={setHoveredGapAction}
      />
    </div>
  );
});
