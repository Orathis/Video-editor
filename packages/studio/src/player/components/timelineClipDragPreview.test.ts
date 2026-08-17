import { describe, expect, it } from "vitest";
import type { TimelineElement } from "../store/playerStore";
import {
  computeDragPreview,
  computeResizePreview,
  getTimelineDragOverlayPosition,
  getTimelineResolvedDragActorTop,
  stabilizeTimelineDesiredTrack,
  type DragPreviewContext,
} from "./timelineClipDragPreview";
import type { DraggedClipState } from "./timelineClipDragTypes";
import { CLIP_Y, LANE_H, RULER_H, TRACKS_TOP_PAD, TRACK_H } from "./timelineLayout";

// ─────────────────────────────────────────────────────────────────────────────
// Regression bed for the live-reproduced BUG 1: a PLAIN HORIZONTAL drag of a clip
// on its own top lane armed a phantom new-track insert (the old 0.32 insert band
// reached deep into the clip body). That insert flipped the commit into the
// lane-change branch, which nudged the clip's z-index and re-sorted it off its
// lane. The invariant: a horizontal drag over a clip BODY → insertRow === null,
// previewTrack unchanged (a pure time move — zero topology change, zero z sync).
//
// Elements mirror the user's index.html shapes: a high-z "v-moodboard" alone on
// the top display lane, over several lower-lane video clips it overlaps in time,
// plus a caption. Tracks here are already the normalized DISPLAY lanes (the store
// runs normalizeToZones on discovery), matching what the drag hook passes in.
// ─────────────────────────────────────────────────────────────────────────────

const PPS = 40;

function clip(
  id: string,
  track: number,
  start: number,
  duration: number,
  zIndex: number,
  tag = "video",
): TimelineElement {
  return { id, key: id, tag, start, duration, track, zIndex, domId: id };
}

// v-moodboard: own top lane (0). Lower lane (1) carries overlapping video clips;
// captions sit on lane 2. trackOrder = [0, 1, 2].
const moodboard = clip("v-moodboard", 0, 19, 5.5, 37);
const fixtureElements: TimelineElement[] = [
  moodboard,
  clip("v-dashboard", 1, 19, 4, 16),
  clip("v-globe", 1, 23, 1.5, 17),
  clip("cap", 2, 20.82, 1.78, 0, "text"),
];

// A scroll container whose content-space y equals clientY (rect top 0, no scroll).
function fakeScroll(): HTMLDivElement {
  return {
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: 100000,
  } as unknown as HTMLDivElement;
}

function ctx(
  rowHeights?: readonly number[],
  elements: TimelineElement[] = fixtureElements,
): DragPreviewContext {
  return {
    scroll: fakeScroll(),
    pps: PPS,
    duration: 44.5,
    trackOrder: [0, 1, 2],
    elements,
    rowHeights,
    selectedKeys: new Set<string>(),
    buildSnapTargets: () => [],
    audioTracks: new Set<number>(),
  };
}

// content-space y for a fractional row index (inverse of getTimelineRowFromY).
const yForRow = (rowFloat: number) => RULER_H + TRACKS_TOP_PAD + rowFloat * TRACK_H;

// A drag grabbing `element` at vertical position `grabRowFloat` within its lane.
function horizontalDrag(
  element: TimelineElement,
  grabRowFloat: number,
  deltaSeconds: number,
): { drag: DraggedClipState; clientX: number; clientY: number } {
  const originClientX = 800;
  const originClientY = yForRow(grabRowFloat);
  const drag: DraggedClipState = {
    pointerId: 0,
    element,
    originClientX,
    originClientY,
    originScrollLeft: 0,
    originScrollTop: 0,
    pointerClientX: originClientX,
    pointerClientY: originClientY,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    previewStart: element.start,
    previewTrack: element.track,
    insertRow: null,
    snapTime: null,
    snapType: null,
    started: true,
  };
  // Horizontal: clientY stays at the grab point; only x advances by the delta.
  return { drag, clientX: originClientX + deltaSeconds * PPS, clientY: originClientY };
}

describe("computeDragPreview — plain horizontal drag never arms a phantom insert (BUG 1)", () => {
  it("dragging v-moodboard +2s while grabbing its clip body keeps it a pure time move", () => {
    const { drag, clientX, clientY } = horizontalDrag(moodboard, 0.5, 2);
    const next = computeDragPreview(drag, clientX, clientY, ctx());
    expect(next.insertRow).toBeNull(); // no phantom new-track insert
    expect(next.previewTrack).toBe(0); // stays on its own lane
    expect(next.desiredTrack).toBe(0); // pointer never left lane 0 → not a vertical aim
    expect(next.previewStart).toBeCloseTo(21, 5); // +2s moved
  });

  it("grabbing ANYWHERE across the clip body (not just dead-center) stays a pure time move", () => {
    // Sweep the whole clip body of lane 0; a horizontal drag must never insert.
    for (let grab = 0.1; grab <= 0.9 + 1e-9; grab += 0.1) {
      const { drag, clientX, clientY } = horizontalDrag(moodboard, grab, 2);
      const next = computeDragPreview(drag, clientX, clientY, ctx());
      expect(next.insertRow).toBeNull();
      expect(next.previewTrack).toBe(0);
    }
  });

  it("crosses audio-row dividers without flickering into track-insert mode", () => {
    const dragged = clip("sea-ambient", 2, 37, 35, 4, "audio");
    const audioElements = [
      clip("audio-1", 1, 0, 34, 2, "audio"),
      dragged,
      clip("audio-3", 3, 0, 34, 1, "audio"),
    ];
    const originClientY = yForRow(2.5);
    const drag: DraggedClipState = {
      pointerId: 0,
      element: dragged,
      originClientX: 800,
      originClientY,
      originScrollLeft: 0,
      originScrollTop: 0,
      pointerClientX: 800,
      pointerClientY: originClientY,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      previewStart: dragged.start,
      previewTrack: dragged.track,
      insertRow: null,
      snapTime: null,
      snapType: null,
      started: true,
    };
    const audioContext: DragPreviewContext = {
      ...ctx(undefined, audioElements),
      trackOrder: [0, 1, 2, 3],
      audioTracks: new Set([1, 2, 3]),
    };

    // One-pixel-ish movement past the divider stays on the current lane: this is
    // the deadband that absorbs hand jitter instead of alternating destinations.
    const upwardJitter = computeDragPreview(drag, 800, yForRow(1.98), audioContext);
    expect(upwardJitter.desiredTrack).toBe(2);
    expect(upwardJitter.previewTrack).toBe(2);
    expect(upwardJitter.insertRow).toBeNull();

    // A decisive movement through the deadband changes lanes without ever
    // arming track-insert mode at the divider.
    const upward = computeDragPreview(drag, 800, yForRow(1.85), audioContext);
    expect(upward.desiredTrack).toBe(1);
    expect(upward.previewTrack).toBe(1);
    expect(upward.insertRow).toBeNull();

    // Crossing the same divider downward remains a direct lane move too.
    const downwardDrag = {
      ...drag,
      element: { ...dragged, track: 1 },
      originClientY: yForRow(1.5),
    };
    const downwardJitter = computeDragPreview(downwardDrag, 800, yForRow(2.02), audioContext);
    expect(downwardJitter.desiredTrack).toBe(1);
    expect(downwardJitter.previewTrack).toBe(1);
    expect(downwardJitter.insertRow).toBeNull();

    const downward = computeDragPreview(downwardDrag, 800, yForRow(2.15), audioContext);
    expect(downward.desiredTrack).toBe(2);
    expect(downward.previewTrack).toBe(2);
    expect(downward.insertRow).toBeNull();
  });

  it("holds the aimed audio row through small pointer jitter at its boundary", () => {
    const order = [0, 1, 2, 3];

    // A deliberate move clears the 6px-equivalent deadband and enters row 2.
    expect(stabilizeTimelineDesiredTrack(2, 1, 1.7, order)).toBe(2);
    // A one-pixel-ish wobble back across the raw midpoint stays on row 2.
    expect(stabilizeTimelineDesiredTrack(1, 2, 1.48, order)).toBe(2);
    // Moving decisively back clears the reverse deadband and returns to row 1.
    expect(stabilizeTimelineDesiredTrack(1, 2, 1.3, order)).toBe(1);
  });

  it("keeps one directional reservation while hovering over an occupied audio row", () => {
    const dragged = clip("sea-ambient", 0, 0, 10, 4, "audio");
    const occupied = [
      dragged,
      clip("same-row-sibling", 0, 0, 10, 3, "audio"),
      clip("audio-1", 1, 0, 10, 2, "audio"),
      clip("audio-2", 2, 0, 10, 1, "audio"),
    ];
    const originClientY = yForRow(0.5);
    const drag: DraggedClipState = {
      pointerId: 0,
      element: dragged,
      originClientX: 800,
      originClientY,
      originScrollLeft: 0,
      originScrollTop: 0,
      pointerClientX: 800,
      pointerClientY: originClientY,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      previewStart: 0,
      previewTrack: 0,
      insertRow: null,
      snapTime: null,
      snapType: null,
      started: true,
    };
    const audioContext: DragPreviewContext = {
      ...ctx(undefined, occupied),
      trackOrder: [0, 1, 2],
      audioTracks: new Set([0, 1, 2]),
    };

    const upperHalf = computeDragPreview(drag, 800, yForRow(1.4), audioContext);
    expect(upperHalf.desiredTrack).toBe(1);
    expect(upperHalf.insertRow).toBe(1);

    // Crossing the aimed row's midpoint must not flip the reserved insertion side.
    const lowerHalf = computeDragPreview(upperHalf, 800, yForRow(1.6), audioContext);
    expect(lowerHalf.desiredTrack).toBe(1);
    expect(lowerHalf.insertRow).toBe(1);
  });

  it("aiming the gutter ABOVE the top lane arms a top insert (UX rule 2)", () => {
    // Drag v-moodboard up into the top breathing pad → insert a new top track.
    const originClientX = 800;
    const originClientY = yForRow(0.5);
    const drag: DraggedClipState = {
      pointerId: 0,
      element: moodboard,
      originClientX,
      originClientY,
      originScrollLeft: 0,
      originScrollTop: 0,
      pointerClientX: originClientX,
      pointerClientY: originClientY,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      previewStart: moodboard.start,
      previewTrack: moodboard.track,
      insertRow: null,
      snapTime: null,
      snapType: null,
      started: true,
    };
    // Pointer well above the first lane (into the top pad → rowFloat < 0).
    const next = computeDragPreview(drag, originClientX, yForRow(-0.6), ctx());
    expect(next.insertRow).toBe(0); // a new TOP track will be created on drop
  });

  it("keeps a horizontal drag in the body of an expanded row out of insert mode", () => {
    const rowHeights = [TRACK_H + 2 * LANE_H, TRACK_H, TRACK_H];
    const clientY = RULER_H + TRACKS_TOP_PAD + rowHeights[0] - 8;
    const { drag, clientX } = horizontalDrag(moodboard, 0.5, 2);
    const next = computeDragPreview(
      { ...drag, originClientY: clientY, pointerClientY: clientY },
      clientX,
      clientY,
      ctx(rowHeights),
    );
    expect(next.insertRow).toBeNull();
    expect(next.previewTrack).toBe(0);
  });

  it("uses the expanded row midpoint when choosing the side for an automatic insert", () => {
    const rowHeights = [TRACK_H + 2 * LANE_H, TRACK_H];
    const dragged = clip("dragged", 0, 0, 1, 3);
    const occupied = [dragged, clip("block-0", 0, 0, 1, 2), clip("block-1", 1, 0, 1, 1)];
    const clientY = RULER_H + TRACKS_TOP_PAD + 30;
    const drag: DraggedClipState = {
      pointerId: 0,
      element: dragged,
      originClientX: 0,
      originClientY: clientY,
      originScrollLeft: 0,
      originScrollTop: 0,
      pointerClientX: 0,
      pointerClientY: clientY,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      previewStart: 0,
      previewTrack: 0,
      insertRow: null,
      snapTime: null,
      snapType: null,
      started: true,
    };
    const next = computeDragPreview(drag, 0, clientY, {
      ...ctx(rowHeights, occupied),
      trackOrder: [0, 1],
    });
    expect(next.insertRow).toBe(0);
  });
});

describe("computeResizePreview — composition source continuity", () => {
  it("seeds a legacy composition offset and advances it at playback rate", () => {
    const element = {
      ...clip("comp", 0, 2, 4, 0, "div"),
      kind: "composition" as const,
      playbackRate: 2,
    };
    const result = computeResizePreview(
      {
        element,
        edge: "start",
        originClientX: 0,
        previewStart: 2,
        previewDuration: 4,
        started: true,
      },
      100,
      { scroll: fakeScroll(), pps: 100, buildSnapTargets: () => [] },
    );

    expect(result).toMatchObject({
      previewStart: 3,
      previewDuration: 3,
      previewPlaybackStart: 2,
    });
  });
});

describe("getTimelineDragOverlayPosition", () => {
  it("keeps the gesture actor under the pointer across two-axis autoscroll", () => {
    const { drag } = horizontalDrag(moodboard, 0.5, 2);
    const scroll = {
      scrollLeft: 500,
      scrollTop: 300,
      getBoundingClientRect: () => ({ left: 20, top: 40 }),
    } as Pick<HTMLDivElement, "scrollLeft" | "scrollTop" | "getBoundingClientRect">;
    expect(
      getTimelineDragOverlayPosition(
        {
          ...drag,
          pointerClientX: 900,
          pointerClientY: 700,
          pointerOffsetX: 25,
          pointerOffsetY: 10,
        },
        scroll,
      ),
    ).toEqual({ left: 1_355, top: 950 });
  });

  it("does not mount an actor before threshold or without the stable viewport", () => {
    const { drag } = horizontalDrag(moodboard, 0.5, 2);
    expect(getTimelineDragOverlayPosition({ ...drag, started: false }, fakeScroll())).toBeNull();
    expect(getTimelineDragOverlayPosition(drag, null)).toBeNull();
  });
});

describe("getTimelineResolvedDragActorTop", () => {
  it("locks the actor to a resolved lane instead of the pointer's visual row", () => {
    const { drag } = horizontalDrag(moodboard, 0.5, 2);
    expect(
      getTimelineResolvedDragActorTop(
        { ...drag, pointerClientY: yForRow(-4), previewTrack: 2 },
        [0, 1, 2],
      ),
    ).toBe(yForRow(2) + CLIP_Y);
  });

  it("uses the empty reserved row for an occupied audio drop", () => {
    const { drag } = horizontalDrag(moodboard, 0.5, 2);
    expect(getTimelineResolvedDragActorTop({ ...drag, insertRow: 4 }, [0, 1, 2, 3])).toBe(
      yForRow(4) + CLIP_Y,
    );
  });
});
