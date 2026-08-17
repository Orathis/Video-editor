import { Fragment, useId, useMemo } from "react";
import { BeatStrip, BeatBackgroundLines } from "./BeatStrip";
import { TimelineClip } from "./TimelineClip";
import { TimelineCompactDiamonds } from "./TimelineCompactDiamonds";
import { TimelinePropertyLanes } from "./TimelinePropertyLanes";
import { TimelineAutomationLaneSlot } from "./TimelineAutomationLane";
import { useAutomationLanes } from "./useAutomationLanes";
import { useAutomationSelectionKeyboard } from "../../hooks/useAutomationSelectionKeyboard";
import { TimelineTrackHeader } from "./TimelineTrackHeader";
import {
  isTrackRowExpanded,
  resolveTrackKeyframeClip,
  trackShowsBeatStrip,
} from "./useTimelineTrackLayout";
import { trackDisplayNumber, trackDisplaySuffix } from "./timelineTrackDisplay";
import { clipTimingStart } from "../../hooks/gsapShared";
import { getTimelineEditCapabilities } from "./timelineEditing";
import { CLIP_Y, TRACK_H } from "./timelineLayout";
import {
  isMultiDragActive,
  isMultiDragPassenger,
  multiDragDeltaSeconds,
  multiDragPassengerOffsetPx,
} from "./timelineMultiDragPreview";
import type { TimelineLanesProps } from "./timelineLaneProps";
import { hasTimelineAudio, isMusicTrack } from "../../utils/timelineInspector";
import { createClipGestureHandlers } from "./timelineClipGestureHandlers";
import { renderClipChildren, resolveClipRenderContext } from "./timelineClipChildren";
import { TimelineTrackRow } from "./TimelineTrackRow";
import { isTimelineClipActive } from "./useTimelineActiveClips";
import { queryTimelineClipIndex } from "../lib/timelineClipIndex";
import { getTimelineElementIdentity } from "../lib/timelineElementHelpers";
import type { TimelineLogicalRow } from "./timelineKeyboardNavigation";
import { timelineClipFocusId } from "./timelineNavigationIdentity";
import { useTimelineKeyboardActor } from "./useTimelineKeyboardActor";
import { useTimelineCategoryDisclosure } from "./useTimelineCategoryDisclosure";
import { TimelineEmbeddedAudioRows } from "./TimelineEmbeddedAudioRows";

export function TimelineLanes({
  pps,
  contentOrigin,
  contentGutter,
  trackContentWidth,
  theme,
  displayTrackOrder,
  rowGeometry,
  virtualRows,
  logicalRows,
  focusedTargetId,
  rowsVirtualized,
  clipIndex,
  renderTimeRange,
  visibleTimeRange,
  pinnedClipIdentities,
  trackOrder,
  tracks,
  trackStyles,
  laneCounts,
  selectedElementId,
  selectedElementIds,
  hoveredClip,
  draggedClip,
  multiDragPreview,
  blockedClipRef,
  suppressClickRef,
  scrollRef,
  renderClipContent,
  renderClipOverlay,
  onDrillDown,
  onSelectElement,
  onDeleteTrack,
  setHoveredClip,
  setShowPopover,
  setRangeSelection,
  setResizingClip,
  setDraggedClip,
  setSelectedElementId,
  shiftClickClipRef,
  getPreviewElement,
  getTrackStyle,
  keyframeCache,
  gsapAnimations,
  selectedKeyframes,
  currentTime,
  onSeek,
  onSelectSegment,
  onClickKeyframe,
  onShiftClickKeyframe,
  onContextMenuKeyframe,
  onMoveKeyframe,
  onContextMenuClip,
  onContextMenuLane,
  beatAnalysis,
  onToggleTrackHidden,
  onToggleTrackLocked,
  onRenameTrack,
  onTogglePropertyGroupKeyframe,
  onResizeElement,
  onMoveElement,
  onRazorSplit,
  onRazorSplitAll,
}: TimelineLanesProps) {
  // ponytail: One per-instance namespace prevents aria-controls and aria-owns
  // from resolving into a second timeline that renders the same logical rows.
  const lanesIdPrefix = `timeline-lanes${useId().replaceAll(":", "")}`;
  const {
    animationIds: expandedClipIds,
    audioIds: expandedAudioClipIds,
    toggleAnimationRow,
    toggleAudioRow,
  } = useTimelineCategoryDisclosure();
  const automationLanes = useAutomationLanes();
  useAutomationSelectionKeyboard({ lanes: automationLanes });
  const logicalRowsByTrack = useMemo(() => {
    const byTrack = new Map<number, TimelineLogicalRow[]>();
    for (const logicalRow of logicalRows) {
      const trackRows = byTrack.get(logicalRow.physicalTrackKey) ?? [];
      trackRows.push(logicalRow);
      byTrack.set(logicalRow.physicalTrackKey, trackRows);
    }
    return byTrack;
  }, [logicalRows]);
  const multiDragDelta =
    multiDragPreview && isMultiDragActive(multiDragPreview)
      ? multiDragDeltaSeconds(multiDragPreview)
      : 0;
  const actorWindows =
    rowsVirtualized && multiDragPreview && multiDragDelta !== 0
      ? [
          {
            range: {
              start: renderTimeRange.start - multiDragDelta,
              end: renderTimeRange.end - multiDragDelta,
            },
            identities: multiDragPreview.selectedKeys,
          },
        ]
      : [];
  const keyboard = useTimelineKeyboardActor({
    logicalRows,
    focusedTargetId,
    rowGeometry,
    scrollRef,
    onToggleRow: (row) => {
      const keys = (tracks.find(([track]) => track === row.physicalTrackKey)?.[1] ?? []).map(
        getTimelineElementIdentity,
      );
      if (keys.length > 0) toggleAnimationRow(keys);
    },
  });
  return (
    <div
      role="treegrid"
      aria-label="Timeline tracks"
      aria-rowcount={logicalRows.length}
      aria-colcount={2}
      onFocus={keyboard.onFocus}
      onKeyDown={keyboard.onKeyDown}
      className={rowsVirtualized ? "absolute inset-0" : undefined}
    >
      {
        // fallow-ignore-next-line complexity
        virtualRows.map(({ index: row, rowKey }) => {
          const trackNum = displayTrackOrder[row];
          if (trackNum === undefined) return null;
          const displayNumber = trackDisplayNumber(displayTrackOrder, trackNum);
          const trackLogicalRows = logicalRowsByTrack.get(trackNum) ?? [];
          const logicalRow = trackLogicalRows[0];
          if (!logicalRow) return null;
          const rowHeight = rowGeometry.getRowHeight(row);
          const els = tracks.find(([t]) => t === trackNum)?.[1] ?? [];
          const renderElements = rowsVirtualized
            ? queryTimelineClipIndex(
                clipIndex,
                trackNum,
                renderTimeRange,
                pinnedClipIdentities,
                actorWindows,
              )
            : els;
          const ts = trackStyles.get(trackNum) ?? getTrackStyle("");
          const isPendingTrack =
            draggedClip?.started === true && !trackOrder.includes(trackNum) && els.length === 0;
          // All lanes use the same uniform color — no alternating stripes.
          const rowBackground = theme.rowBackground;
          // The beat-dot strip occupies the top of this track's lane (active track,
          // or the music track when nothing is selected). When shown, keyframe
          // diamonds shrink + drop to the bottom half so they don't collide with it.
          const beatStripOnTrack = trackShowsBeatStrip(els, beatAnalysis?.beatTimes, {
            selectedElementId,
            isMusicTrack,
          });
          const isTrackHidden = els.length > 0 && els.every((element) => element.hidden === true);
          const isTrackLocked =
            els.length > 0 && els.every((element) => element.timelineLocked === true);
          const isAudioTrack = els.length > 0 && els.some(hasTimelineAudio);
          // Only the selected/most-keyframed clip owns expanded lanes on a shared track.
          const keyframeClip = resolveTrackKeyframeClip(
            els,
            laneCounts,
            selectedElementId,
            selectedElementIds,
          );
          const keyframeClipKey = keyframeClip?.key ?? keyframeClip?.id;
          const rowExpanded = isTrackRowExpanded(els, expandedClipIds);
          const audioExpanded = isAudioTrack && isTrackRowExpanded(els, expandedAudioClipIds);
          const anyCategoryExpanded = rowExpanded || audioExpanded;
          // Expanded rows cap every clip bar so waveforms never paint over property lanes.
          const clipBarHeight = anyCategoryExpanded ? TRACK_H - 2 * CLIP_Y : undefined;
          // The clips whose envelopes this row draws, at their dragged positions.
          // Once per row, not once per clip in the map below.
          const automationElements = els.map(getPreviewElement);
          // The display row gives the sticky disclosure and canvas lanes one stable id.
          const lanesId = `${lanesIdPrefix}-track-${row}`;
          // Keyframe and automation disclosures remain separate canvas regions.
          const automationLanesId = `${lanesId}-automation`;
          // Header removal uses the same persisted binding as the automation lanes.
          const headerLanes =
            keyframeClip && keyframeClipKey
              ? automationLanes.bind(
                  keyframeClip,
                  selectedElementId === keyframeClipKey || selectedElementIds.has(keyframeClipKey),
                )
              : null;
          const removeAutomationLane =
            headerLanes && !headerLanes.readOnly
              ? (target: string) =>
                  headerLanes.onCommit({
                    version: 1,
                    lanes: headerLanes.lanes.filter((lane) => lane.target !== target),
                  })
              : undefined;
          return (
            <TimelineTrackRow
              key={rowKey}
              index={row}
              rowKey={rowKey}
              logicalRow={logicalRow}
              propertyRows={trackLogicalRows.slice(1)}
              lanesId={lanesId}
              top={rowGeometry.getRowTop(row)}
              height={rowHeight}
              locked={isTrackLocked}
              virtualized={rowsVirtualized}
              background={rowBackground}
              borderColor={theme.rowBorder}
              rovingTargetId={keyboard.rovingTargetId}
            >
              <TimelineTrackHeader
                trackNumber={trackNum}
                // What gets announced. `trackNum` is a fractional z-order sort
                // key, so it stays out of every label and in every callback.
                trackDisplayNumber={displayNumber}
                trackLabel={
                  els[0]?.label ??
                  els[0]?.domId ??
                  els[0]?.id ??
                  `Track${trackDisplaySuffix(displayNumber)}`
                }
                animationLanesId={lanesId}
                audioLanesId={automationLanesId}
                contentOrigin={contentOrigin}
                keyframeClip={keyframeClip}
                trackElements={els}
                clipCount={els.length}
                isAnimationExpanded={rowExpanded}
                isAudioExpanded={audioExpanded}
                animations={keyframeClipKey ? (gsapAnimations.get(keyframeClipKey) ?? []) : []}
                currentTime={currentTime}
                isTrackHidden={isTrackHidden}
                isTrackLocked={isTrackLocked}
                isAudioTrack={isAudioTrack}
                theme={theme}
                onToggleAnimationExpanded={() => {
                  const keys = els.map(getTimelineElementIdentity);
                  if (keys.length > 0) toggleAnimationRow(keys);
                }}
                onToggleAudioExpanded={() => {
                  const keys = els.map(getTimelineElementIdentity);
                  if (keys.length > 0) toggleAudioRow(keys);
                }}
                onToggleTrackHidden={onToggleTrackHidden}
                onToggleTrackLocked={onToggleTrackLocked}
                onRenameTrack={onRenameTrack}
                onDeleteTrack={onDeleteTrack}
                onTogglePropertyGroupKeyframe={onTogglePropertyGroupKeyframe}
                onRemoveAutomationLane={removeAutomationLane}
                onSeek={onSeek}
                rovingTargetId={keyboard.rovingTargetId}
              />
              <div
                role="gridcell"
                aria-colindex={2}
                style={{
                  width: trackContentWidth,
                  marginLeft: contentGutter, // room for a 0% diamond left of t=0
                  opacity: isTrackHidden ? 0.35 : 1,
                  transition: "opacity 120ms ease",
                }}
                className="relative overflow-hidden"
                onContextMenu={(e: React.MouseEvent) => {
                  // Clip / keyframe-diamond context menus preventDefault at the
                  // target before this bubble handler runs — respect them so a
                  // right-click on a clip never also opens the gap menu.
                  if (e.defaultPrevented || !onContextMenuLane) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const time = (e.clientX - rect.left) / pps;
                  if (time < 0) return;
                  e.preventDefault();
                  onContextMenuLane(e, trackNum, time);
                }}
              >
                {/* Faint beat lines in every track's background (behind the clips);
                    the active move-snap target is highlighted. */}
                <BeatBackgroundLines
                  beatTimes={beatAnalysis?.beatTimes}
                  beatStrengths={beatAnalysis?.beatStrengths}
                  pps={pps}
                  highlightTime={
                    draggedClip?.started && draggedClip.snapType === "beat"
                      ? draggedClip.snapTime
                      : null
                  }
                  renderTimeRange={rowsVirtualized ? renderTimeRange : undefined}
                />
                {/* Beat dots on the active track (the one holding the selection),
                    falling back to the music track when nothing is selected. */}
                {beatStripOnTrack && (
                  <BeatStrip
                    beatTimes={beatAnalysis?.beatTimes}
                    beatStrengths={beatAnalysis?.beatStrengths}
                    pps={pps}
                    renderTimeRange={rowsVirtualized ? renderTimeRange : undefined}
                  />
                )}
                {isPendingTrack && (
                  <div
                    className="absolute inset-0 flex items-center"
                    style={{
                      paddingLeft: 16,
                      color: ts.label,
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      opacity: 0.5,
                    }}
                  >
                    New track
                  </div>
                )}
                {
                  // fallow-ignore-next-line complexity
                  renderElements.map((el) => {
                    const clipStyle = getTrackStyle(el.tag);
                    const elementKey = getTimelineElementIdentity(el);
                    // Only the track's active keyframe clip shows expanded lanes;
                    // other clips (incl. siblings on a shared track) show compact
                    // diamonds on their own bar instead.
                    const isTrackKeyframeClip = elementKey === keyframeClipKey;
                    const showsLanes = isTrackKeyframeClip && rowExpanded;
                    const capabilities = getTimelineEditCapabilities(el);
                    const isSelected =
                      selectedElementId === elementKey || selectedElementIds.has(elementKey);
                    const isDragSource =
                      draggedClip?.started === true &&
                      getTimelineElementIdentity(draggedClip.element) === elementKey;
                    const isComposition = !!el.compositionSrc;
                    // Element identity stays stable across clip splices and reorders.
                    const clipKey = elementKey;
                    const previewElement = getPreviewElement(el);
                    const renderContext = resolveClipRenderContext(
                      previewElement,
                      visibleTimeRange,
                      isSelected || hoveredClip === clipKey || pinnedClipIdentities.has(clipKey),
                    );
                    // Passenger of a live multi-drag: preserve the formation without changing
                    // the passenger's timeline data until the owning drag commits.
                    const isPassenger =
                      multiDragPreview != null && isMultiDragPassenger(clipKey, multiDragPreview);
                    const passengerOffsetPx = isPassenger
                      ? multiDragPassengerOffsetPx(clipKey, pps, multiDragPreview)
                      : 0;
                    const clipGestures = createClipGestureHandlers(
                      el,
                      elementKey,
                      previewElement,
                      capabilities,
                      {
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
                      },
                    );
                    const clip = (
                      <TimelineClip
                        key={clipKey}
                        onContextMenu={(e: React.MouseEvent) => {
                          e.preventDefault();
                          onContextMenuClip?.(e, el);
                        }}
                        el={previewElement}
                        pps={pps}
                        clipY={CLIP_Y}
                        clipHeight={clipBarHeight}
                        isSelected={isSelected}
                        isHovered={hoveredClip === clipKey}
                        // The source stays anchored until pointer-up, but carries
                        // its own connected-source treatment while the darker
                        // gesture actor forecasts the pending destination.
                        isDragging={isDragSource}
                        isActive={isTimelineClipActive(previewElement, currentTime)}
                        hasCustomContent={!!renderClipContent}
                        capabilities={capabilities}
                        theme={theme}
                        isComposition={isComposition}
                        tabIndex={
                          keyboard.rovingTargetId === timelineClipFocusId(elementKey) ? 0 : -1
                        }
                        onHoverStart={() => setHoveredClip(clipKey)}
                        onHoverEnd={() => setHoveredClip(null)}
                        onResizeStart={clipGestures.onResizeStart}
                        onPointerDown={clipGestures.onPointerDown}
                        onClick={clipGestures.onClick}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (suppressClickRef.current) return;
                          if (isComposition && onDrillDown) onDrillDown(el);
                        }}
                      >
                        {renderClipChildren(
                          previewElement,
                          clipStyle,
                          renderClipContent,
                          renderClipOverlay,
                          renderContext,
                        )}
                      </TimelineClip>
                    );
                    const compactKeyframes = keyframeCache?.get(elementKey);
                    const compactDiamonds = !showsLanes && compactKeyframes && (
                      <TimelineCompactDiamonds
                        key={`${clipKey}-diamonds`}
                        element={previewElement}
                        elementId={elementKey}
                        keyframesData={compactKeyframes}
                        pixelsPerSecond={pps}
                        rowHeight={rowHeight}
                        beatsActive={beatStripOnTrack}
                        accentColor={clipStyle.accent}
                        isSelected={isSelected}
                        currentTime={currentTime}
                        selectedKeyframes={selectedKeyframes}
                        rovingTargetId={keyboard.rovingTargetId}
                        onClickKeyframe={onClickKeyframe}
                        onShiftClickKeyframe={onShiftClickKeyframe}
                        onContextMenuKeyframe={onContextMenuKeyframe}
                        onMoveKeyframe={onMoveKeyframe}
                        onSelectSegment={onSelectSegment}
                        suppressClickRef={suppressClickRef}
                      />
                    );
                    // Keep this shell mounted while collapsed so aria-controls stays valid
                    // and multi-drag cannot remount the subtree mid-gesture.
                    const propertyLanes = isTrackKeyframeClip && (
                      <TimelinePropertyLanes
                        key={`${clipKey}-property-lanes`}
                        id={lanesId}
                        animations={gsapAnimations.get(elementKey) ?? []}
                        isExpanded={showsLanes}
                        // clipTimingStart, not the raw start: an expanded sub-comp
                        // child's start is host-absolute while its tweens are
                        // local to its own file.
                        clipStart={clipTimingStart(previewElement)}
                        clipDuration={previewElement.duration}
                        clipLeftPx={previewElement.start * pps}
                        clipWidthPx={Math.max(previewElement.duration * pps, 4)}
                        accentColor={clipStyle.accent}
                        isSelected={isSelected}
                        currentPercentage={
                          previewElement.duration > 0
                            ? ((currentTime - previewElement.start) / previewElement.duration) * 100
                            : 0
                        }
                        elementId={elementKey}
                        selectedKeyframes={selectedKeyframes}
                        rovingTargetId={keyboard.rovingTargetId}
                        onSelectSegment={(target) => onSelectSegment?.(elementKey, target)}
                        onClickKeyframe={(target) => onClickKeyframe?.(previewElement, target)}
                        onShiftClickKeyframe={(target) =>
                          onShiftClickKeyframe?.(elementKey, target)
                        }
                        onContextMenuKeyframe={(e, target) =>
                          onContextMenuKeyframe?.(e, elementKey, target)
                        }
                        onMoveKeyframe={(target, toClipPercentage) =>
                          onMoveKeyframe?.(elementKey, target, toClipPercentage) ??
                          Promise.resolve(false)
                        }
                        suppressClickRef={suppressClickRef}
                      />
                    );

                    // Keep one keyed top-level child per element. Returning an
                    // array here makes React reconcile the outer array by
                    // position, so a window shift remounts otherwise stable
                    // clip keys and can tear down focus mid-reveal.
                    if (!isPassenger) {
                      return (
                        <Fragment key={clipKey}>
                          {clip}
                          {compactDiamonds}
                          {propertyLanes}
                        </Fragment>
                      );
                    }
                    return (
                      <div
                        key={clipKey}
                        className="absolute inset-0"
                        style={{
                          transform: `translateX(${passengerOffsetPx}px)`,
                          opacity: 0.85,
                          zIndex: 20,
                          pointerEvents: "none",
                        }}
                      >
                        {clip}
                        {compactDiamonds}
                        {propertyLanes}
                      </div>
                    );
                  })
                }
                {/* Automation belongs to the row, not the active clip.
                    Hanging off that clip meant selecting a sibling moved the
                    whole subtree into a different clip's element and remounted
                    every lane — which threw away each lane's hover state (and
                    any gesture mid-flight), so pressing a lane to select its
                    clip made the handles you were reaching for disappear.

                    Mounted in BOTH disclosure states, empty while collapsed, so
                    the caret's aria-controls resolves either way — same reason
                    the keyframe lanes are. Absolute positions inside resolve
                    against this same relative row, so the geometry is unchanged
                    by the move. */}
                <div id={automationLanesId}>
                  {audioExpanded && isAudioTrack ? (
                    <>
                      <TimelineEmbeddedAudioRows
                        elements={automationElements}
                        pixelsPerSecond={pps}
                        laneCount={
                          rowExpanded && keyframeClipKey
                            ? (laneCounts.get(keyframeClipKey) ?? 0)
                            : 0
                        }
                        labelColor={getTrackStyle("audio").label}
                        renderClipContent={renderClipContent}
                      />
                      <TimelineAutomationLaneSlot
                        elements={automationElements}
                        isSelected={(element) => {
                          const key = getTimelineElementIdentity(element);
                          return selectedElementId === key || selectedElementIds.has(key);
                        }}
                        lanes={automationLanes}
                        pps={pps}
                        laneCount={
                          rowExpanded && keyframeClipKey
                            ? (laneCounts.get(keyframeClipKey) ?? 0)
                            : 0
                        }
                        accentColor={getTrackStyle(keyframeClip?.tag ?? "").accent}
                        currentTime={currentTime}
                        beatTimes={beatAnalysis?.beatTimes}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </TimelineTrackRow>
          );
        })
      }
    </div>
  );
}
