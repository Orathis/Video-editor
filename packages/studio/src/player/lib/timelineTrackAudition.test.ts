// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import type { TimelineElement } from "../store/playerStore";
import { applyTimelineTrackAudition, shouldMuteTimelineTrack } from "./timelineTrackAudition";

describe("timeline track audition", () => {
  it("combines global mute, per-track mute, and solo exclusion", () => {
    expect(shouldMuteTimelineTrack(1, true, new Set(), new Set())).toBe(true);
    expect(shouldMuteTimelineTrack(1, false, new Set([1]), new Set())).toBe(true);
    expect(shouldMuteTimelineTrack(1, false, new Set(), new Set([2]))).toBe(true);
    expect(shouldMuteTimelineTrack(2, false, new Set(), new Set([2]))).toBe(false);
  });

  it("mutes only the preview media resolved for non-solo tracks", () => {
    const doc = document.implementation.createHTMLDocument("preview");
    const first = doc.createElement("audio");
    first.id = "first";
    const second = doc.createElement("video");
    second.id = "second";
    doc.body.append(first, second);
    const elements: TimelineElement[] = [
      { id: "first", domId: "first", tag: "audio", start: 0, duration: 4, track: 1 },
      {
        id: "second",
        domId: "second",
        tag: "video",
        start: 0,
        duration: 4,
        track: 2,
        hasAudio: true,
      },
    ];
    applyTimelineTrackAudition(
      { contentDocument: doc } as HTMLIFrameElement,
      elements,
      false,
      new Set(),
      new Set([2]),
    );
    expect(first.muted).toBe(true);
    expect(second.muted).toBe(false);
  });
});
