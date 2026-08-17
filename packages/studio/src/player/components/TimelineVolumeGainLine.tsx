import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type {
  AutomationRange,
  HfAutomationLane,
  HfAutomationPoint,
} from "@hyperframes/core/audio-automation";
import { fromUnit, PAD_X, toUnit } from "./automationLaneGeometry";

export function formatVolumeDb(value: number): string {
  if (value <= 0.0001) return "−∞ dB";
  const db = 20 * Math.log10(value);
  return `${db >= -0.05 ? "0.0" : db.toFixed(1)} dB`;
}

export function shiftVolumePoints(
  points: readonly HfAutomationPoint[],
  range: AutomationRange,
  deltaUnit: number,
): HfAutomationPoint[] {
  const source = points.length > 0 ? points : [{ t: 0, v: range.default }];
  return source.map((point) => ({
    ...point,
    v: fromUnit(range, toUnit(range, point.v) + deltaUnit),
  }));
}

const VOLUME_DB_FLOOR = -60;
const VOLUME_DB_DRAG_SPAN = 60;

/** Shift a whole envelope in decibels, which is how an editor reads gain. */
export function shiftVolumePointsByDb(
  points: readonly HfAutomationPoint[],
  range: AutomationRange,
  deltaDb: number,
): HfAutomationPoint[] {
  const source = points.length > 0 ? points : [{ t: 0, v: range.default }];
  const ceilingDb = 20 * Math.log10(Math.max(range.max, 0.0001));
  return source.map((point) => {
    const currentDb = point.v <= 0.001 ? VOLUME_DB_FLOOR : 20 * Math.log10(point.v);
    const nextDb = Math.min(ceilingDb, Math.max(VOLUME_DB_FLOOR, currentDb + deltaDb));
    const nextValue = nextDb <= VOLUME_DB_FLOOR ? range.min : 10 ** (nextDb / 20);
    return { ...point, v: Math.min(range.max, Math.max(range.min, nextValue)) };
  });
}

interface GainDrag {
  startY: number;
  source: HfAutomationPoint[];
  latest: HfAutomationPoint[];
}

/** Premiere-style volume rubber band layered over the real automation path. */
export function TimelineVolumeGainLine({
  path,
  lane,
  range,
  innerHeight,
  displayValue,
  displayY,
  readOnly,
  onPreview,
  onCommit,
}: {
  path: string;
  lane: HfAutomationLane;
  range: AutomationRange;
  innerHeight: number;
  displayValue: number;
  displayY: number;
  readOnly?: boolean;
  onPreview: (points: HfAutomationPoint[]) => void;
  onCommit: (points: HfAutomationPoint[]) => void;
}) {
  const drag = useRef<GainDrag | null>(null);

  const startDrag = (event: PointerEvent<SVGElement>): void => {
    if (readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const source = shiftVolumePoints(lane.points, range, 0);
    drag.current = { startY: event.clientY, source, latest: source };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<SVGElement>): void => {
    const active = drag.current;
    if (!active || readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaDb = ((active.startY - event.clientY) / innerHeight) * VOLUME_DB_DRAG_SPAN;
    active.latest = shiftVolumePointsByDb(active.source, range, deltaDb);
    onPreview(active.latest);
  };

  const finishDrag = (event: PointerEvent<SVGElement>): void => {
    const active = drag.current;
    if (!active || readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = null;
    onCommit(active.latest);
  };

  const adjustWithKeyboard = (event: KeyboardEvent<SVGPathElement>): void => {
    if (readOnly) return;
    const arrowStep = event.shiftKey ? 0.1 : 1;
    const keyDeltaDb =
      event.key === "ArrowUp"
        ? arrowStep
        : event.key === "ArrowDown"
          ? -arrowStep
          : event.key === "PageUp"
            ? 3
            : event.key === "PageDown"
              ? -3
              : null;
    if (keyDeltaDb === null && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Home" || event.key === "End") {
      const value = event.key === "Home" ? range.min : range.max;
      const source = lane.points.length > 0 ? lane.points : [{ t: 0, v: range.default }];
      onCommit(source.map((point) => ({ ...point, v: value })));
      return;
    }
    onCommit(shiftVolumePointsByDb(lane.points, range, keyDeltaDb ?? 0));
  };

  const labelY = Math.min(innerHeight + 4, Math.max(12, displayY - 6));
  const valueText = formatVolumeDb(displayValue);

  return (
    <>
      <path
        data-volume-gain-line=""
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        pointerEvents="stroke"
        role="slider"
        tabIndex={readOnly ? -1 : 0}
        aria-label="Clip volume"
        aria-valuemin={VOLUME_DB_FLOOR}
        aria-valuemax={0}
        aria-valuenow={
          displayValue <= 0.001
            ? VOLUME_DB_FLOOR
            : Number((20 * Math.log10(displayValue)).toFixed(1))
        }
        aria-valuetext={valueText}
        style={{ cursor: readOnly ? "default" : "ns-resize", outline: "none" }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={adjustWithKeyboard}
      >
        <title>
          {readOnly
            ? "Select this audio clip to edit its volume"
            : "Drag up or down to change clip volume. Double-click the lane to add keyframes."}
        </title>
      </path>
      <g
        data-volume-gain-handle=""
        aria-hidden="true"
        style={{ cursor: readOnly ? "default" : "ns-resize" }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <text
          x={PAD_X + 41}
          y={labelY - 1}
          fill="#b9f5df"
          fontSize={8.5}
          fontWeight={600}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          textAnchor="middle"
          stroke="rgba(8, 15, 14, 0.96)"
          strokeWidth={5}
          paintOrder="stroke"
          pointerEvents="bounding-box"
        >
          ↕ {valueText}
        </text>
      </g>
    </>
  );
}
