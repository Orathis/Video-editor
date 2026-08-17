import { hasTimelineAudio } from "../../utils/timelineInspector";
import type { TimelineElement } from "../store/playerStore";
import { resolveMediaElement } from "./timelineElementHelpers";

export function shouldMuteTimelineTrack(
  track: number,
  globallyMuted: boolean,
  mutedTracks: ReadonlySet<number>,
  soloTracks: ReadonlySet<number>,
): boolean {
  return globallyMuted || mutedTracks.has(track) || (soloTracks.size > 0 && !soloTracks.has(track));
}

function findTimelineNode(doc: Document, element: TimelineElement): Element | null {
  if (element.domId) {
    const byId = doc.getElementById(element.domId);
    if (byId) return byId;
  }
  if (element.hfId) {
    const escaped = element.hfId.replaceAll('"', '\\"');
    const byHfId = doc.querySelector(`[data-hf-id="${escaped}"]`);
    if (byHfId) return byHfId;
  }
  if (!element.selector) return null;
  try {
    return doc.querySelectorAll(element.selector)[element.selectorIndex ?? 0] ?? null;
  } catch {
    return null;
  }
}

/** Apply session-local Mute/Solo monitoring directly to the live preview media. */
export function applyTimelineTrackAudition(
  iframe: HTMLIFrameElement | null,
  elements: readonly TimelineElement[],
  globallyMuted: boolean,
  mutedTracks: ReadonlySet<number>,
  soloTracks: ReadonlySet<number>,
): void {
  const doc = iframe?.contentDocument;
  if (!doc) return;
  for (const element of elements) {
    if (!hasTimelineAudio(element)) continue;
    const node = findTimelineNode(doc, element);
    if (!node) continue;
    const media = resolveMediaElement(node);
    const MediaElementCtor = doc.defaultView?.HTMLMediaElement ?? globalThis.HTMLMediaElement;
    if (!(media instanceof MediaElementCtor)) continue;
    media.muted = shouldMuteTimelineTrack(element.track, globallyMuted, mutedTracks, soloTracks);
  }
}
