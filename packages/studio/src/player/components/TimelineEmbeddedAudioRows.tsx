import type { ReactNode } from "react";
import type { TimelineElement } from "../store/playerStore";
import { hasTimelineAudio } from "../../utils/timelineInspector";
import { AUTOMATION_LANE_H } from "./automationLaneHeight";
import { getTimelineLaneTop } from "./timelineLayout";
import type { TimelineClipRenderContext } from "./TimelineTypes";

interface TimelineEmbeddedAudioRowsProps {
  elements: readonly TimelineElement[];
  pixelsPerSecond: number;
  laneCount: number;
  labelColor: string;
  renderClipContent?: (
    element: TimelineElement,
    style: { clip: string; label: string },
    context: TimelineClipRenderContext,
  ) => ReactNode;
}

/**
 * Full-height waveform children for A/V video clips.
 *
 * These sit in the first audio-automation row, directly below their owning
 * video bars. They are deliberately not timeline elements of their own: moving
 * or trimming the video therefore keeps picture and sound linked, while audio-
 * only music/ambience/SFX continue to live in the separate audio zone.
 */
export function TimelineEmbeddedAudioRows({
  elements,
  pixelsPerSecond,
  laneCount,
  labelColor,
  renderClipContent,
}: TimelineEmbeddedAudioRowsProps) {
  if (!renderClipContent) return null;
  const top = getTimelineLaneTop(laneCount);
  return elements
    .filter((element) => element.tag.trim().toLowerCase() === "video" && hasTimelineAudio(element))
    .map((element) => {
      const key = element.key ?? element.id;
      return (
        <div
          key={key}
          data-timeline-embedded-audio={key}
          className="timeline-embedded-audio-row pointer-events-none absolute overflow-hidden"
          style={{
            left: element.start * pixelsPerSecond,
            top,
            width: Math.max(element.duration * pixelsPerSecond, 4),
            height: AUTOMATION_LANE_H,
          }}
        >
          {renderClipContent(
            element,
            { clip: "transparent", label: labelColor },
            { priority: "visible", rich: false, audioOnly: true },
          )}
        </div>
      );
    });
}
