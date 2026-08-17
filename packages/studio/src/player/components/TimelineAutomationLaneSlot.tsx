import { useEffect, useMemo } from "react";
import { resolveAutomationRange, type HfAutomationLane } from "@hyperframes/core/audio-automation";
import { hasTimelineAudio } from "../../utils/timelineInspector";
import { getTimelineElementIdentity } from "../lib/timelineElementHelpers";
import type { TimelineElement } from "../store/playerStore";
import { groupTimelineAutomationLanes } from "./automationLaneData";
import { AUTOMATION_LANE_H } from "./automationLaneHeight";
import { getTimelineLaneTop } from "./timelineLayout";
import { TimelineAutomationLane } from "./TimelineAutomationLane";
import type { UseAutomationLanesResult } from "./useAutomationLanes";

interface ClipLaneRow {
  lane: HfAutomationLane;
  rowIndex: number;
}

function ClipAutomationLanes({
  element,
  rows,
  isSelected,
  lanes,
  pps,
  top,
  accentColor,
  currentTime,
  beatTimes,
}: {
  element: TimelineElement;
  rows: readonly ClipLaneRow[];
  isSelected: boolean;
  lanes: UseAutomationLanesResult;
  pps: number;
  top: number;
  accentColor: string;
  currentTime: number;
  beatTimes?: readonly number[];
}) {
  const snapTimes = useMemo(
    () =>
      (beatTimes ?? [])
        .filter((time) => time >= element.start && time <= element.start + element.duration)
        .map((time) => time - element.start),
    [beatTimes, element.start, element.duration],
  );
  const bound = lanes.bind(element, isSelected);
  useEffect(() => {
    const target = bound.selection?.target;
    if (target !== undefined && !bound.lanes.some((lane) => lane.target === target)) {
      bound.onRangeClear();
    }
  }, [bound]);
  if (rows.length === 0) return null;
  const inClip = currentTime >= element.start && currentTime <= element.start + element.duration;
  return (
    <>
      {rows.map(({ lane, rowIndex }) => {
        const range = resolveAutomationRange(lane.target, bound.chain ?? undefined);
        if (!range) return null;
        return (
          <TimelineAutomationLane
            key={lane.target}
            duration={element.duration}
            widthPx={Math.max(element.duration * pps, 4)}
            leftPx={element.start * pps}
            topPx={top + rowIndex * AUTOMATION_LANE_H}
            automation={bound.automation}
            target={lane.target}
            range={range}
            accentColor={accentColor}
            playheadSec={inClip ? currentTime - element.start : null}
            onPreview={bound.onPreview}
            onCommit={bound.onCommit}
            onSelect={bound.onSelect}
            snapTimes={snapTimes}
            readOnly={bound.readOnly}
            rangeSelection={
              bound.selection?.target === lane.target
                ? {
                    t0: bound.selection.t0,
                    t1: bound.selection.t1,
                    v0: bound.selection.v0,
                    v1: bound.selection.v1,
                  }
                : null
            }
            onRangeSelect={(t0, t1, v0, v1) => bound.onRangeSelect(lane.target, t0, t1, v0, v1)}
            onRangeClear={bound.onRangeClear}
          />
        );
      })}
    </>
  );
}

export interface TimelineAutomationLaneSlotProps {
  elements: readonly TimelineElement[];
  isSelected: (element: TimelineElement) => boolean;
  lanes: UseAutomationLanesResult;
  pps: number;
  laneCount: number;
  accentColor: string;
  currentTime: number;
  beatTimes?: readonly number[];
}

export function TimelineAutomationLaneSlot({
  elements,
  isSelected,
  lanes,
  pps,
  laneCount,
  accentColor,
  currentTime,
  beatTimes,
}: TimelineAutomationLaneSlotProps) {
  const clips = elements.filter(hasTimelineAudio);
  const rowsByClip = new Map<string, ClipLaneRow[]>();
  groupTimelineAutomationLanes(clips).forEach((group, rowIndex) => {
    for (const entry of group.entries) {
      const key = getTimelineElementIdentity(entry.element);
      const rows = rowsByClip.get(key);
      if (rows) rows.push({ lane: entry.lane, rowIndex });
      else rowsByClip.set(key, [{ lane: entry.lane, rowIndex }]);
    }
  });
  const top = getTimelineLaneTop(laneCount);
  return (
    <>
      {clips.map((element) => (
        <ClipAutomationLanes
          key={getTimelineElementIdentity(element)}
          element={element}
          rows={rowsByClip.get(getTimelineElementIdentity(element)) ?? []}
          isSelected={isSelected(element)}
          lanes={lanes}
          pps={pps}
          top={top}
          accentColor={accentColor}
          currentTime={currentTime}
          beatTimes={beatTimes}
        />
      ))}
    </>
  );
}
