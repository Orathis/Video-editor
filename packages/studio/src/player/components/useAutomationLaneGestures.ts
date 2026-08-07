/**
 * The pointer gestures over an automation lane.
 *
 * Its own hook because the lane component sits at the studio's file ceiling and
 * because these are the parts worth testing on their own: which of a press,
 * a drag and a modifier resolves to moving a point, bending a segment,
 * drawing a selection box, or nothing at all.
 *
 * Modifiers follow Ableton's, since that is the muscle memory an automation lane
 * inherits: Shift locks a drag to one axis and fines the value down, Alt over a
 * segment curves it, and Alt during a point drag ignores the grid.
 */

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { AutomationRange, HfAutomationLane } from "@hyperframes/core/audio-automation";
import {
  applyShiftConstraint,
  dominantDragAxis,
  curveForDrag,
  formatValue,
  GRAB_PX,
  MIN_POINT_GAP_SEC,
  POINT_MERGE_SEC,
  snapLaneTime,
} from "./automationLaneGeometry";
import { pointInSelection } from "./automationLaneSelection";
import { capturePointer } from "./automationLanePointer";

/** How far a press may travel and still count as a click rather than a drag. */
const CLICK_SLOP_PX = 3;

/** Snap radius in clip seconds. Tight on purpose: a lane is often a few seconds
 *  wide, where a generous radius makes a point unplaceable between two beats. */
const SNAP_SEC = 0.04;

/** A point's position, or the origin when the index no longer resolves. */
function originOf(point: HfAutomationLane["points"][number] | undefined): { t: number; v: number } {
  return point ? { t: point.t, v: point.v } : { t: 0, v: 0 };
}

export interface UseAutomationLaneGesturesInput {
  /** The lane's box on screen. A getter, not the ref: the hook only ever needs
   *  the rectangle, and a ref read inside a callback is a lint the rule is right
   *  about — the value is not a dependency it can track. */
  getBox(): DOMRect | null;
  lane: HfAutomationLane;
  range: AutomationRange;
  /** Pointer position as a clip-local time and a parameter value. */
  pointAt(clientX: number, clientY: number): { t: number; v: number };
  xOf(t: number): number;
  yOf(v: number): number;
  commitPoints(points: HfAutomationLane["points"], persist: boolean): void;
  /** Clip-local times a dragged point snaps to, on top of its own neighbours. */
  snapTimes?: readonly number[] | undefined;
  readOnly?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  /** Live box-select callbacks; absent = background drags do nothing (read-only lanes). */
  onRangeSelect?: ((t0: number, t1: number, v0: number, v1: number) => void) | undefined;
  onRangeClear?: (() => void) | undefined;
  duration: number; // clamp bound for box endpoints
  /** Active selection box on this lane, so a press inside it can drag its points. */
  rangeSelection?: { t0: number; t1: number; v0: number; v1: number } | null | undefined;
}

export interface UseAutomationLaneGesturesResult {
  /** Point being dragged, for the cursor and the grab circle's size. */
  dragIndex: number | null;
  /** Segment being bent, identified by the point that owns its curve. */
  curveIndex: number | null;
  /** Value readout to show while a gesture is live. */
  hint: string | null;
  hitIndex(clientX: number, clientY: number): number | null;
  segmentIndex(clientX: number, clientY: number): number | null;
  onPointerDown(e: ReactPointerEvent<SVGSVGElement>): void;
  onPointerMove(e: ReactPointerEvent<SVGSVGElement>): void;
  endDrag(e: ReactPointerEvent<SVGSVGElement>): void;
  /** Adds a point, opens the value field on one, or straightens a segment. */
  onDoubleClick(e: ReactPointerEvent<SVGSVGElement>): void;
  /** The point whose value is being typed, and the text so far. */
  editing: { index: number; text: string } | null;
  setEditingText(text: string): void;
  commitEdit(): void;
  cancelEdit(): void;
}

export function useAutomationLaneGestures({
  getBox,
  lane,
  range,
  pointAt,
  xOf,
  yOf,
  commitPoints,
  snapTimes,
  readOnly,
  onSelect,
  onRangeSelect,
  onRangeClear,
  duration,
  rangeSelection,
}: UseAutomationLaneGesturesInput): UseAutomationLaneGesturesResult {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [curveIndex, setCurveIndex] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  /** Where a point drag began, so Shift can lock an axis and fine the value. */
  const dragOrigin = useRef<{ t: number; v: number } | null>(null);
  /**
   * The set a group drag moves, snapshotted on the press.
   *
   * Snapshotted rather than recomputed per move for two reasons: every point is
   * moving, so "which ones are selected" has to mean what it meant when the
   * gesture started, and the deltas have to accumulate from the original
   * positions or a rounded move would drift on every pointermove.
   */
  const groupDrag = useRef<{
    points: HfAutomationLane["points"];
    indices: number[];
    anchor: { t: number; v: number };
    selection: { t0: number; t1: number; v0: number; v1: number };
  } | null>(null);
  /** Point whose value is being typed, and the text so far. */
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  /** A background drag in progress: the two corners of the box it is drawing,
   *  each a clip-local time and a parameter value. */
  const [rangeDrag, setRangeDrag] = useState<{
    from: { t: number; v: number };
    to: { t: number; v: number };
  } | null>(null);
  /** Whether the live drag has crossed the pixel threshold that turns a press
   *  into an actual box, rather than a click that should just clear one. */
  const rangeCrossed = useRef(false);
  /** Where a press on a point landed, and whether it has travelled since. A press
   *  that goes nowhere is a click, which is a different gesture from a drag even
   *  though both start the same way — see the Shift branch in `endDrag`. */
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const pressTravelled = useRef(false);
  /**
   * The axis Shift locked, decided on the gesture's first travel and held until
   * the drag ends or Shift is let go. Deciding per event followed whichever way
   * the last move leaned, so a drifting hand unlocked the axis mid-drag.
   */
  const shiftAxis = useRef<"time" | "value" | null>(null);

  // The value field's own handlers, above the gestures that close it: a press on the
  // lane applies whatever was typed, so onPointerDown lists commitEdit as a
  // dependency and cannot be declared before it.
  const setEditingText = useCallback((text: string): void => {
    setEditing((current) => (current ? { index: current.index, text } : null));
  }, []);

  const cancelEdit = useCallback((): void => setEditing(null), []);

  /** Apply a typed value, or drop the edit when it is not a number. */
  const commitEdit = useCallback((): void => {
    const active = editing;
    setEditing(null);
    if (!active) return;
    const typed = Number(active.text);
    if (!Number.isFinite(typed)) return;
    const clamped = Math.min(range.max, Math.max(range.min, typed));
    commitPoints(
      lane.points.map((p, i) => (i === active.index ? { ...p, v: clamped } : p)),
      true,
    );
  }, [editing, lane, range, commitPoints]);

  /** Index of a point under the pointer, or null. */
  const hitIndex = useCallback(
    (clientX: number, clientY: number): number | null => {
      const box = getBox();
      if (!box) return null;
      const px = clientX - box.left;
      const py = clientY - box.top;
      for (let i = 0; i < lane.points.length; i += 1) {
        const p = lane.points[i];
        if (p && Math.hypot(xOf(p.t) - px, yOf(p.v) - py) <= GRAB_PX * 1.6) return i;
      }
      return null;
    },
    [getBox, lane, xOf, yOf],
  );

  /** Index of the point owning the segment under the pointer, or null. */
  const segmentIndex = useCallback(
    (clientX: number, clientY: number): number | null => {
      const { t } = pointAt(clientX, clientY);
      for (let i = 0; i + 1 < lane.points.length; i += 1) {
        const a = lane.points[i];
        const b = lane.points[i + 1];
        if (a && b && t > a.t && t < b.t) return i;
      }
      return null;
    },
    [lane, pointAt],
  );

  /** What a press starts: moving a point, or — with Alt on the line — bending it. */
  const gestureAt = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): { curve: boolean; index: number } | null => {
      const index = hitIndex(e.clientX, e.clientY);
      if (index !== null) return { curve: false, index };
      if (!e.altKey) return null;
      const segment = segmentIndex(e.clientX, e.clientY);
      return segment === null ? null : { curve: true, index: segment };
    },
    [hitIndex, segmentIndex],
  );

  /**
   * A corner of the selection box under the pointer.
   *
   * Time is clamped to the clip and snaps to the grid, because the box's span is
   * also what a shape insert or a paste acts over and those want beat-aligned
   * edges. The value is taken as it lies: there is no grid on a parameter axis,
   * and rounding a dB bound would move which points the box catches.
   */
  const boxCornerAt = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): { t: number; v: number } => {
      const raw = pointAt(e.clientX, e.clientY);
      const clamped = Math.min(duration, Math.max(0, raw.t));
      return {
        t: e.altKey ? clamped : snapLaneTime(clamped, snapTimes ?? [], SNAP_SEC),
        v: raw.v,
      };
    },
    [pointAt, duration, snapTimes],
  );

  /**
   * What a press on the lane's empty background arms: a new selection box, and
   * only when a caller wants to hear about one — a read-only lane never reaches
   * here at all.
   */
  const armRangeDrag = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): void => {
      if (!onRangeSelect) return;
      e.preventDefault();
      capturePointer(e);
      const corner = boxCornerAt(e);
      rangeCrossed.current = false;
      setRangeDrag({ from: corner, to: corner });
    },
    [onRangeSelect, boxCornerAt],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): void => {
      if (e.button !== 0) return;
      // The lane owns this region either way. Letting a press through starts the
      // timeline's own gesture (scrub / marquee / clip drag), which then eats the
      // rest of the sequence — including the second half of a double-click.
      e.stopPropagation();
      // A press anywhere on the lane closes the value field, applying what was
      // typed — the same thing Enter and a blur do. It cannot rely on the blur: the
      // gesture branches below call preventDefault to keep the timeline from
      // scrubbing, and that suppresses the focus change the blur would come from,
      // so the field sat open until Enter however far away the next click landed.
      if (editing) commitEdit();
      if (readOnly) {
        // The lane sits below the clip bar, so the timeline's selection handler
        // never sees this press; selecting here is the only way in. The press then
        // goes on to arm a range drag rather than being spent on the selection: a
        // press that only selected made the first drag over any lane do nothing
        // visible, so a range took two gestures and looked broken on the first.
        onSelect?.();
        armRangeDrag(e);
        return;
      }
      const gesture = gestureAt(e);
      if (!gesture) {
        armRangeDrag(e);
        return;
      }
      e.preventDefault();
      capturePointer(e);
      if (gesture.curve) {
        setCurveIndex(gesture.index);
        return;
      }
      dragOrigin.current = originOf(lane.points[gesture.index]);
      // Pressing one of a selected set drags the whole set. Pressing a point
      // outside the selection is an ordinary single-point drag, selection or no.
      const pressed = lane.points[gesture.index];
      const indices =
        rangeSelection && pressed && pointInSelection(pressed, rangeSelection)
          ? lane.points.flatMap((p, i) => (pointInSelection(p, rangeSelection) ? [i] : []))
          : [];
      groupDrag.current =
        indices.length > 1 && pressed
          ? {
              points: lane.points.map((p) => ({ ...p })),
              indices,
              anchor: { t: pressed.t, v: pressed.v },
              selection: rangeSelection ? { ...rangeSelection } : { t0: 0, t1: 0, v0: 0, v1: 0 },
            }
          : null;
      pressAt.current = { x: e.clientX, y: e.clientY };
      pressTravelled.current = false;
      setDragIndex(gesture.index);
    },
    [
      gestureAt,
      lane,
      readOnly,
      onSelect,
      armRangeDrag,
      editing,
      commitEdit,
      // The press decides whether it starts a group drag, so it has to see the
      // selection as it is now — captured stale, a point pressed straight after
      // selecting a range read the previous selection, or none.
      rangeSelection,
    ],
  );

  /** Bend the segment under the pointer, which is what Alt-dragging the line does. */
  const bendSegment = useCallback(
    (clientX: number, clientY: number): void => {
      if (curveIndex === null) return;
      const a = lane.points[curveIndex];
      const b = lane.points[curveIndex + 1];
      if (!a || !b) return;
      const { t, v } = pointAt(clientX, clientY);
      const bend = curveForDrag({ range, a, b, t, v });
      if (bend === null) return;
      // Read out where the bend now sits along the segment, which is what the
      // pointer is choosing: a percentage means more here than a curve exponent
      // the author never types.
      setHint(`bend ${Math.round(bend.viaX * 100)}%`);
      commitPoints(
        // `curve` is dropped rather than carried: the via point supersedes it, and
        // leaving a stale exponent behind would make the segment's shape depend on
        // which of the two the reader happened to honour.
        lane.points.map((p, i) =>
          i === curveIndex ? { ...p, curve: undefined, viaX: bend.viaX, viaY: bend.viaY } : p,
        ),
        false,
      );
    },
    [curveIndex, lane, pointAt, range, commitPoints],
  );

  /**
   * Move a selected set by one delta, taken from the point under the pointer.
   *
   * The whole group has to stop when its first member reaches a boundary, not
   * each point on its own: clamping individually squashes the shape flat against
   * the edge, and the gesture is meant to preserve it. Deltas are in the
   * parameter's own units, so on a logarithmic axis a group moves by Hz rather
   * than by octaves — the same as dragging one point does.
   */
  const moveGroup = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>, group: NonNullable<typeof groupDrag.current>): void => {
      const raw = pointAt(e.clientX, e.clientY);
      const moving = group.indices.map((i) => group.points[i]!);
      let dt = raw.t - group.anchor.t;
      let dv = raw.v - group.anchor.v;
      if (e.shiftKey) {
        // The axis lock, as a single-point drag has it: keep whichever the pointer
        // has travelled further along and drop the other.
        const alongTime = Math.abs(dt * (xOf(1) - xOf(0)));
        const alongValue = Math.abs(
          (dv * (yOf(range.min) - yOf(range.max))) / (range.max - range.min),
        );
        if (alongTime >= alongValue) dv = 0;
        else dt = 0;
      } else if (!e.altKey) {
        // Snap the point under the pointer, and move the set by that same amount.
        const others = group.points.filter((_, i) => !group.indices.includes(i)).map((p) => p.t);
        dt =
          snapLaneTime(group.anchor.t + dt, [...(snapTimes ?? []), ...others], SNAP_SEC) -
          group.anchor.t;
      }
      const times = moving.map((p) => p.t);
      const values = moving.map((p) => p.v);
      // No member may cross a point that is staying put. Only stationary
      // neighbours constrain: two selected points travel together, so the gap
      // between them never changes. Per member rather than per end of the group,
      // because a box can select a non-contiguous set — the peaks of an envelope
      // and not the dip between them.
      const gapTo = (step: 1 | -1): number[] =>
        group.indices.flatMap((i) => {
          const neighbour = group.points[i + step];
          if (!neighbour || group.indices.includes(i + step)) return [];
          // Short of the neighbour, not onto it — the lane collapses points that
          // share a time, and a group drag must not consume what it runs into.
          return [Math.max(0, Math.abs(neighbour.t - group.points[i]!.t) - MIN_POINT_GAP_SEC)];
        });
      dt = Math.min(
        Math.max(dt, -Math.min(Math.min(...times), ...gapTo(-1))),
        Math.min(duration - Math.max(...times), ...gapTo(1)),
      );
      dv = Math.min(Math.max(dv, range.min - Math.min(...values)), range.max - Math.max(...values));

      // No re-sort: clamped to the neighbours, the lane's order cannot change
      // under a drag, so the point under the pointer keeps its index.
      const next = group.points.map((p, i) =>
        group.indices.includes(i) ? { ...p, t: p.t + dt, v: p.v + dv } : p,
      );
      // The box travels with the points — both axes, or a vertical nudge would
      // slide its own points out of the box that caught them and a second nudge
      // would move fewer of them.
      onRangeSelect?.(
        group.selection.t0 + dt,
        group.selection.t1 + dt,
        group.selection.v0 + dv,
        group.selection.v1 + dv,
      );
      setHint(`${group.indices.length} points ${dt >= 0 ? "+" : ""}${dt.toFixed(2)}s`);
      commitPoints(next, false);
    },
    [commitPoints, duration, onRangeSelect, pointAt, range, snapTimes, xOf, yOf],
  );

  /** Move the point being dragged, honouring the modifiers held with it. */
  const movePoint = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): void => {
      if (dragIndex === null) return;
      const group = groupDrag.current;
      if (group) {
        moveGroup(e, group);
        return;
      }
      const raw = pointAt(e.clientX, e.clientY);
      const origin = dragOrigin.current;
      if (!e.shiftKey) shiftAxis.current = null;
      let { t, v } = raw;
      if (e.shiftKey && origin) {
        shiftAxis.current ??= dominantDragAxis({ origin, raw, xOf, yOf });
        ({ t, v } = applyShiftConstraint({
          range,
          origin,
          raw,
          xOf,
          yOf,
          axis: shiftAxis.current,
        }));
      }
      // Shift is a deliberate free-hand move as much as Alt is, so neither snaps.
      if (!e.altKey && !e.shiftKey) {
        const neighbours = lane.points.filter((_, i) => i !== dragIndex).map((p) => p.t);
        t = snapLaneTime(t, [...(snapTimes ?? []), ...neighbours], SNAP_SEC);
      }
      // A breakpoint cannot cross another in time, and cannot land exactly on one
      // either: the lane collapses points that share a `t`, so arriving on top of a
      // neighbour deletes it. It stops a hair short instead, which reads as touching
      // and keeps both points. Applied after the snap, which can itself put the
      // point on a beat past a neighbour.
      const floor = (lane.points[dragIndex - 1]?.t ?? -Infinity) + MIN_POINT_GAP_SEC;
      const ceiling = (lane.points[dragIndex + 1]?.t ?? Infinity) - MIN_POINT_GAP_SEC;
      const held = lane.points[dragIndex]?.t ?? t;
      t =
        ceiling >= floor
          ? Math.min(ceiling, Math.max(floor, Math.min(duration, Math.max(0, t))))
          : // Neighbours closer together than the gap leave nowhere to go, so the
            // point stays where it is rather than being flung to one side.
            held;
      const next = lane.points.map((p, i) => (i === dragIndex ? { ...p, t, v } : p));
      setHint(`${formatValue(range, v)} @ ${t.toFixed(2)}s`);
      commitPoints(next, false);
    },
    [dragIndex, duration, lane, pointAt, range, commitPoints, snapTimes, xOf, yOf, moveGroup],
  );

  /** Update the live box-drag as the pointer moves, firing `onRangeSelect` once
   *  it has covered enough pixels along EITHER axis to count as an actual box
   *  rather than a click that should just clear one. */
  const moveRangeDrag = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): void => {
      if (rangeDrag === null) return;
      const to = boxCornerAt(e);
      const { from } = rangeDrag;
      setRangeDrag({ from, to });
      const travelled = Math.max(
        Math.abs(xOf(to.t) - xOf(from.t)),
        Math.abs(yOf(to.v) - yOf(from.v)),
      );
      if (travelled <= 3) return;
      rangeCrossed.current = true;
      onRangeSelect?.(
        Math.min(from.t, to.t),
        Math.max(from.t, to.t),
        Math.min(from.v, to.v),
        Math.max(from.v, to.v),
      );
    },
    [rangeDrag, boxCornerAt, xOf, yOf, onRangeSelect],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): void => {
      if (rangeDrag !== null) {
        e.stopPropagation();
        moveRangeDrag(e);
        return;
      }
      if (curveIndex === null && dragIndex === null) return;
      e.stopPropagation();
      const from = pressAt.current;
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > CLICK_SLOP_PX) {
        pressTravelled.current = true;
      }
      if (curveIndex !== null) bendSegment(e.clientX, e.clientY);
      else movePoint(e);
    },
    [rangeDrag, moveRangeDrag, curveIndex, dragIndex, bendSegment, movePoint],
  );

  /** A sub-threshold press clears the selection rather than leaving a
   *  zero-width one behind. */
  const finishRangeDrag = useCallback((): void => {
    if (!rangeCrossed.current) onRangeClear?.();
    rangeCrossed.current = false;
    setRangeDrag(null);
  }, [onRangeClear]);

  const endDrag = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): void => {
      if (rangeDrag !== null) {
        e.stopPropagation();
        finishRangeDrag();
        return;
      }
      if (dragIndex === null && curveIndex === null) return;
      e.stopPropagation();
      const index = dragIndex;
      const shiftClicked = index !== null && e.shiftKey && !pressTravelled.current;
      setDragIndex(null);
      setCurveIndex(null);
      dragOrigin.current = null;
      groupDrag.current = null;
      shiftAxis.current = null;
      pressAt.current = null;
      setHint(null);
      // Shift+click removes the point. Decided on RELEASE, not on the press: Shift
      // held through a drag is the axis lock, and acting on the press would take
      // that gesture away. A press that never travelled was a click.
      if (shiftClicked) {
        commitPoints(
          lane.points.filter((_, i) => i !== index),
          true,
        );
        return;
      }
      commitPoints(lane.points, true);
    },
    [rangeDrag, finishRangeDrag, curveIndex, dragIndex, lane, commitPoints],
  );

  const onDoubleClick = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>): void => {
      if (readOnly) return;
      e.stopPropagation();
      e.preventDefault();
      const onPoint = hitIndex(e.clientX, e.clientY);
      if (e.altKey) {
        // Straighten the segment back out — the counterpart to Alt-dragging it.
        const segment = onPoint ?? segmentIndex(e.clientX, e.clientY);
        if (segment === null) return;
        commitPoints(
          lane.points.map((p, i) => (i === segment ? { t: p.t, v: p.v } : p)),
          true,
        );
        return;
      }
      if (onPoint !== null) {
        // Typing beats dragging when the value has to be exact — -6.0 dB is not
        // a pixel you can find.
        const p = lane.points[onPoint];
        if (p) setEditing({ index: onPoint, text: String(Number(p.v.toFixed(3))) });
        return;
      }
      const { t, v } = pointAt(e.clientX, e.clientY);
      const kept = lane.points.filter((p) => Math.abs(p.t - t) > POINT_MERGE_SEC);
      // A lane's first point alone would be a constant, which is not what
      // clicking an empty lane means: seed the far end at the same value so the
      // envelope has somewhere to go.
      const seeded = lane.points.length === 0 && t > POINT_MERGE_SEC ? [{ t: 0, v }] : [];
      commitPoints(
        [...seeded, ...kept, { t, v }].sort((a, b) => a.t - b.t),
        true,
      );
    },
    [lane, pointAt, commitPoints, readOnly, hitIndex, segmentIndex],
  );

  return {
    dragIndex,
    curveIndex,
    hint,
    hitIndex,
    segmentIndex,
    onPointerDown,
    onPointerMove,
    endDrag,
    onDoubleClick,
    editing,
    setEditingText,
    commitEdit,
    cancelEdit,
  };
}
