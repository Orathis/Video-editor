# Automation Lane Time Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drag-select a time range on an audio automation lane, then delete, fill with a shape (ramp/swell/dip), simplify, copy/paste, or stretch it.

**Architecture:** Ephemeral selection in a new zustand slice (`keyframeSlice` pattern); all range math as pure functions composing one mutator (`replaceRange`) whose invariant is that the envelope outside the selection never moves; every write flows through the lane's existing `commitPoints` preview/persist split so undo and drafts are inherited. Spec: `plans/automation-time-selection-design.md`.

**Tech Stack:** React 18 + zustand (studio), vitest + happy-dom, `@hyperframes/core/audio-automation` model. No new dependencies.

## Global Constraints

- Repo: worktree `/Users/vanceingalls/src/wt/hyperframes/webaudio-fx`. All paths below relative to it.
- Package manager: bun. Lint/format: `bunx oxlint <paths>` / `bunx oxfmt <paths>` (never eslint/prettier/biome).
- TypeScript: no `any`, no `as T` assertions, **no `!` non-null assertions** — guards and fallbacks instead. `exactOptionalPropertyTypes` is on: optional props consumed by hooks should be typed `| undefined` explicitly (see `UseAutomationLaneGesturesInput`).
- Studio files hard-capped at 600 lines (pre-commit `filesize` reads the git **index**). Fallow pre-commit gates complexity (cyclomatic ≤ ~10/function) and dead code.
- Tests colocated: `foo.ts` → `foo.test.ts`, `// @vitest-environment happy-dom` for DOM tests. Run: `cd packages/studio && bunx vitest run <file>`.
- Commits: conventional (`feat(studio): …`), lefthook pre-commit must pass.
- Branch/PR flow per PR: `git checkout <parent-branch> && gh stack add <branch-name>` (creates + checks out the branch registered in stack #3027), implement with commits, then `gh stack submit`. Never `gt` here — this stack uses `gh stack`.
- Existing signatures consumed everywhere (do not redefine):
  - `HfAutomationPoint { t: number; v: number; curve?: number }`, `HfAutomationLane { target: string; points: HfAutomationPoint[] }` — `@hyperframes/core/audio-automation`
  - `sampleAutomationLane(lane, t, scale): number`, `MAX_AUTOMATION_POINTS = 512`, `AutomationRange { min, max, step, unit, label, scale, default }` — same module
  - `toUnit(range, v)`, `fromUnit(range, unit)`, `laneFor(automation, target)`, `withLane(automation, lane)`, `POINT_MERGE_SEC = 0.02`, `snapLaneTime(t, targets, threshold)` — `packages/studio/src/player/components/automationLaneGeometry.ts`
  - `useAutomationLaneGestures` input/result — `packages/studio/src/player/components/useAutomationLaneGestures.ts`
  - `UseAutomationLanesResult.bind(element, isSelected): AutomationLaneBinding { automation, lanes, chain, onPreview, onCommit, onSelect, readOnly }` — `useAutomationLanes.ts`

---

# PR 1 — wa-15-lane-selection (branch off wa-14-lane-gestures)

Setup once: `git checkout wa-14-lane-gestures && gh stack add wa-15-lane-selection`

### Task 1: Pure range ops — `pointsIn` + `replaceRange`

**Files:**
- Create: `packages/studio/src/player/components/automationLaneSelection.ts`
- Test: `packages/studio/src/player/components/automationLaneSelection.test.ts`

**Interfaces:**
- Consumes: `sampleAutomationLane`, `MAX_AUTOMATION_POINTS`, `POINT_MERGE_SEC`, core types.
- Produces (all later tasks build on these exact signatures):
  ```ts
  export function pointsIn(lane: HfAutomationLane, t0: number, t1: number): HfAutomationPoint[];
  export function replaceRange(input: {
    lane: HfAutomationLane;
    range: AutomationRange;      // axis — sampling needs its scale
    t0: number;
    t1: number;
    inner: HfAutomationPoint[];  // absolute clip-local times inside [t0, t1]
  }): HfAutomationPoint[];       // full replacement point list for commitPoints
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// packages/studio/src/player/components/automationLaneSelection.test.ts
import { describe, expect, it } from "vitest";
import { pointsIn, replaceRange } from "./automationLaneSelection";
import { sampleAutomationLane, VOLUME_RANGE } from "@hyperframes/core/audio-automation";
import type { HfAutomationLane } from "@hyperframes/core/audio-automation";

const ramp: HfAutomationLane = {
  target: "volume",
  points: [
    { t: 0, v: 1 },
    { t: 2, v: 0.6 },
    { t: 3, v: 0.4 },
    { t: 6, v: 0 },
  ],
};

describe("pointsIn", () => {
  it("returns only the points inside the range, endpoints inclusive", () => {
    expect(pointsIn(ramp, 2, 3).map((p) => p.t)).toEqual([2, 3]);
    expect(pointsIn(ramp, 2.1, 2.9)).toEqual([]);
  });
});

describe("replaceRange", () => {
  it("never moves the envelope outside the selection", () => {
    // THE invariant. Deleting the middle of a ramp must not reshape the rest.
    const next: HfAutomationLane = {
      target: "volume",
      points: replaceRange({ lane: ramp, range: VOLUME_RANGE, t0: 1.5, t1: 3.5, inner: [] }),
    };
    for (const t of [0, 0.5, 1.0, 1.5, 3.5, 4, 5, 6]) {
      expect(sampleAutomationLane(next, t, "linear")).toBeCloseTo(
        sampleAutomationLane(ramp, t, "linear"),
        5,
      );
    }
  });

  it("pins anchors at both edges when the interior empties", () => {
    const pts = replaceRange({ lane: ramp, range: VOLUME_RANGE, t0: 1.5, t1: 3.5, inner: [] });
    const times = pts.map((p) => p.t);
    expect(times).toContain(1.5);
    expect(times).toContain(3.5);
    expect(times).not.toContain(2);
    expect(times).not.toContain(3);
  });

  it("lets inner points at the edges stand in for the anchors", () => {
    // A ramp generator emits its own boundary points; pinning a second anchor
    // at the same time would fight it.
    const pts = replaceRange({
      lane: ramp,
      range: VOLUME_RANGE,
      t0: 2,
      t1: 3,
      inner: [
        { t: 2, v: 0 },
        { t: 3, v: 1 },
      ],
    });
    expect(pts.filter((p) => p.t === 2)).toHaveLength(1);
    expect(pts.find((p) => p.t === 2)?.v).toBe(0);
  });

  it("sorts and respects the point cap", () => {
    const dense = Array.from({ length: 600 }, (_, i) => ({ t: 1.5 + i * 0.001, v: 0.5 }));
    const pts = replaceRange({ lane: ramp, range: VOLUME_RANGE, t0: 1.5, t1: 3.5, inner: dense });
    expect(pts.length).toBeLessThanOrEqual(512);
    expect([...pts].sort((a, b) => a.t - b.t)).toEqual(pts);
  });

  it("keeps a constant flat when the lane has no points", () => {
    const empty: HfAutomationLane = { target: "volume", points: [] };
    const pts = replaceRange({ lane: empty, range: VOLUME_RANGE, t0: 1, t1: 2, inner: [] });
    // Nothing to preserve, nothing to pin: an empty lane stays empty.
    expect(pts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/studio && bunx vitest run src/player/components/automationLaneSelection.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/studio/src/player/components/automationLaneSelection.ts
/**
 * Range operations over one automation lane.
 *
 * `replaceRange` is the only mutator every range feature (delete, shapes,
 * paste, stretch) composes, and it carries the invariant that makes them safe:
 * the envelope OUTSIDE the selection never moves. It samples the lane at both
 * edges first and pins anchor points there, so cutting the middle out of a
 * ramp cannot reshape the rest of the clip.
 *
 * Exact for linear segments. A curved segment straddling an edge keeps its
 * edge VALUE but reshapes slightly between its own start and the anchor — the
 * curve exponent now runs over a shorter span. Accepted: the alternative is
 * splitting curves analytically for a difference the ear cannot place.
 */

import {
  MAX_AUTOMATION_POINTS,
  sampleAutomationLane,
  type AutomationRange,
  type HfAutomationLane,
  type HfAutomationPoint,
} from "@hyperframes/core/audio-automation";
import { POINT_MERGE_SEC } from "./automationLaneGeometry";

/** Points inside [t0, t1], endpoints inclusive. */
export function pointsIn(lane: HfAutomationLane, t0: number, t1: number): HfAutomationPoint[] {
  return lane.points.filter((p) => p.t >= t0 && p.t <= t1);
}

/** An anchor, unless `inner` already provides the edge within the merge radius. */
function anchor(
  lane: HfAutomationLane,
  range: AutomationRange,
  t: number,
  inner: readonly HfAutomationPoint[],
): HfAutomationPoint[] {
  if (inner.some((p) => Math.abs(p.t - t) <= POINT_MERGE_SEC)) return [];
  return [{ t, v: sampleAutomationLane(lane, t, range.scale) }];
}

export function replaceRange(input: {
  lane: HfAutomationLane;
  range: AutomationRange;
  t0: number;
  t1: number;
  inner: HfAutomationPoint[];
}): HfAutomationPoint[] {
  const { lane, range, t0, t1, inner } = input;
  // An empty lane draws a flat default; there is nothing to preserve, and
  // pinning anchors would turn "no automation" into a constant lane.
  if (lane.points.length === 0 && inner.length === 0) return [];
  const outside = lane.points.filter((p) => p.t < t0 || p.t > t1);
  const edges =
    lane.points.length === 0
      ? []
      : [...anchor(lane, range, t0, inner), ...anchor(lane, range, t1, inner)];
  return [...outside, ...edges, ...inner]
    .sort((a, b) => a.t - b.t)
    .slice(0, MAX_AUTOMATION_POINTS);
}
```

- [ ] **Step 4: Run to verify pass**

Same command. Expected: all PASS. Also `bunx oxlint packages/studio/src/player/components/automationLaneSelection.ts && bunx oxfmt packages/studio/src/player/components/automationLaneSelection*.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/studio/src/player/components/automationLaneSelection.*
git commit -m "feat(studio): pure range ops for automation lane selections"
```

### Task 2: Selection slice

**Files:**
- Create: `packages/studio/src/player/store/automationSelectionSlice.ts`
- Modify: `packages/studio/src/player/store/playerStore.ts` (extend `PlayerState`, spread the creator — mirror lines 12/43/294 where `keyframeSlice` composes)
- Test: `packages/studio/src/player/store/automationSelectionSlice.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AutomationSelection {
    elementKey: string; // TimelineElement key ?? id
    target: string;     // "volume" | "fx.<nodeId>.<param>"
    t0: number;         // clip-local seconds, t0 < t1
    t1: number;
  }
  export interface AutomationSelectionSlice {
    automationSelection: AutomationSelection | null;
    setAutomationSelection: (sel: AutomationSelection) => void;
    clearAutomationSelection: () => void;
  }
  export function createAutomationSelectionSlice(
    set: StoreApi<AutomationSelectionSlice>["setState"],
  ): AutomationSelectionSlice;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// packages/studio/src/player/store/automationSelectionSlice.test.ts
import { describe, expect, it } from "vitest";
import { usePlayerStore } from "./playerStore";

describe("automationSelectionSlice", () => {
  it("stores one ordered selection and clears it", () => {
    const store = usePlayerStore.getState();
    store.setAutomationSelection({ elementKey: "bgm", target: "volume", t0: 2, t1: 1 });
    const sel = usePlayerStore.getState().automationSelection;
    // Ordered on write, so every consumer can assume t0 < t1.
    expect(sel).toEqual({ elementKey: "bgm", target: "volume", t0: 1, t1: 2 });
    usePlayerStore.getState().clearAutomationSelection();
    expect(usePlayerStore.getState().automationSelection).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `bunx vitest run src/player/store/automationSelectionSlice.test.ts` → FAIL (`setAutomationSelection` not a function).

- [ ] **Step 3: Implement**

```ts
// packages/studio/src/player/store/automationSelectionSlice.ts
/**
 * The active time selection on one automation lane.
 *
 * A store slice, not lane-local state, for the same reason keyframe selection
 * is one: Delete/copy/paste handlers and the shape menu live outside the lane
 * component and need to read it. Ephemeral by construction — nothing
 * serializes store state, and the selection must never survive into a render.
 */
import type { StoreApi } from "zustand";

export interface AutomationSelection {
  /** TimelineElement key (key ?? id) of the clip that owns the lane. */
  elementKey: string;
  /** Lane target: "volume" or "fx.<nodeId>.<param>". */
  target: string;
  /** Clip-local seconds; always t0 < t1 (ordered on write). */
  t0: number;
  t1: number;
}

export interface AutomationSelectionSlice {
  automationSelection: AutomationSelection | null;
  setAutomationSelection: (sel: AutomationSelection) => void;
  clearAutomationSelection: () => void;
}

export function createAutomationSelectionSlice(
  set: StoreApi<AutomationSelectionSlice>["setState"],
): AutomationSelectionSlice {
  return {
    automationSelection: null,
    setAutomationSelection: (sel) =>
      set({
        automationSelection:
          sel.t0 <= sel.t1 ? sel : { ...sel, t0: sel.t1, t1: sel.t0 },
      }),
    clearAutomationSelection: () => set({ automationSelection: null }),
  };
}
```

In `playerStore.ts`: `import { createAutomationSelectionSlice, type AutomationSelectionSlice } from "./automationSelectionSlice";`, add `AutomationSelectionSlice` to the `PlayerState extends …` clause, and spread `...createAutomationSelectionSlice(set),` beside `...createKeyframeSlice(…)`. If `playerStore.ts` would cross 600 lines, move another type out (`timelineElement.ts` precedent) — do not inline the slice.

- [ ] **Step 4: Run to verify pass** — same command, plus `bunx vitest run src/player/store` for regressions.

- [ ] **Step 5: Commit** — `git add packages/studio/src/player/store && git commit -m "feat(studio): automation selection slice"`

### Task 3: Range-drag gesture + selection render

**Files:**
- Modify: `packages/studio/src/player/components/useAutomationLaneGestures.ts` (new gesture kind)
- Modify: `packages/studio/src/player/components/TimelineAutomationLane.tsx` (render rect; new props)
- Modify: `packages/studio/src/player/components/useAutomationLanes.ts` (bind selection through)
- Modify: `packages/studio/src/player/components/TimelineAutomationLane.test.tsx`
- Test: extend `useAutomationLaneGestures` coverage via the lane tests (existing harness).

**Interfaces:**
- `UseAutomationLaneGesturesInput` gains:
  ```ts
  /** Live range-select callbacks; absent = background drags do nothing (read-only lanes). */
  onRangeSelect?: ((t0: number, t1: number) => void) | undefined;
  onRangeClear?: (() => void) | undefined;
  duration: number; // clamp bound for range endpoints
  ```
- `TimelineAutomationLaneProps` gains:
  ```ts
  /** Active selection on THIS lane, or null. */
  rangeSelection?: { t0: number; t1: number } | null | undefined;
  onRangeSelect?: ((t0: number, t1: number) => void) | undefined;
  onRangeClear?: (() => void) | undefined;
  ```
- `AutomationLaneBinding` (useAutomationLanes) gains `selection: AutomationSelection | null` plus `onRangeSelect(target: string, t0: number, t1: number): void` and `onRangeClear(): void`, implemented against the slice; the slot maps them per-lane (`selection.target === lane.target ? {t0,t1} : null`, callbacks currying `target` and `elementKey`).

- [ ] **Step 1: Write the failing tests** (append to `TimelineAutomationLane.test.tsx`, reusing `mount`/`at`/`fire` helpers; pass `onRangeSelect`/`onRangeClear`/`rangeSelection` through `laneProps` overrides)

```tsx
describe("TimelineAutomationLane range selection", () => {
  it("drag on the background selects a range, snapped to the grid", () => {
    const onRangeSelect = vi.fn();
    const { svg } = mount(ramp, { snapTimes: [1], onRangeSelect });
    fire(svg, "pointerdown", at(0.98, 0.5)); // background: no point within grab radius
    fire(svg, "pointermove", at(3, 0.5));
    fire(svg, "pointerup", at(3, 0.5));
    const last = onRangeSelect.mock.calls.at(-1);
    expect(last?.[0]).toBe(1); // snapped to the beat
    expect(last?.[1]).toBeCloseTo(3, 1);
  });

  it("a sub-threshold click clears instead of selecting", () => {
    const onRangeSelect = vi.fn();
    const onRangeClear = vi.fn();
    const { svg } = mount(ramp, { onRangeSelect, onRangeClear });
    fire(svg, "pointerdown", at(1, 0.5));
    fire(svg, "pointerup", at(1.001, 0.5));
    expect(onRangeSelect).not.toHaveBeenCalled();
    expect(onRangeClear).toHaveBeenCalled();
  });

  it("draws the selection rect between its endpoints", () => {
    const { container } = mount(ramp, { rangeSelection: { t0: 1, t1: 3 } });
    const rect = container.querySelector("[data-automation-selection]");
    expect(rect).not.toBeNull();
    expect(Number(rect?.getAttribute("x"))).toBeCloseTo(PAD + 100, 0); // xOf(1) at 400px/4s
    expect(Number(rect?.getAttribute("width"))).toBeCloseTo(200, 0);
  });

  it("point drags still win over range selection", () => {
    const onRangeSelect = vi.fn();
    const { svg, props } = mount(ramp, { onRangeSelect });
    fire(svg, "pointerdown", at(0, 1)); // exactly on a point
    fire(svg, "pointermove", at(1, 0.8));
    fire(svg, "pointerup", at(1, 0.8));
    expect(onRangeSelect).not.toHaveBeenCalled();
    expect(props.onCommit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `bunx vitest run src/player/components/TimelineAutomationLane.test.tsx` → new cases FAIL.

- [ ] **Step 3: Implement**

In `useAutomationLaneGestures.ts` add state `const [rangeDrag, setRangeDrag] = useState<{ from: number; to: number } | null>(null);` and a px-threshold ref. In `onPointerDown`, where a background press currently returns after the Alt/segment checks fail, arm instead (only when `onRangeSelect` present): capture pointer, `setRangeDrag({ from: t, to: t })` with `t` from `pointAt`. In `onPointerMove` (before the dragIndex branch): when `rangeDrag` is set, stopPropagation, compute `t` (clamped `0..duration`, snapped via `snapLaneTime(t, snapTimes ?? [], SNAP_SEC)` unless Alt), `setRangeDrag({ from, to: t })`, and call `onRangeSelect(min, max)` live when `|xOf(to) − xOf(from)| > 3`. In `endDrag`: if the drag never crossed 3 px call `onRangeClear?.()`, always `setRangeDrag(null)`. Expose nothing new in the result — the store is the render source.

In `TimelineAutomationLane.tsx` render, after the mid-rail line and before the envelope path:

```tsx
{rangeSelection ? (
  <>
    <rect
      data-automation-selection=""
      x={xOf(rangeSelection.t0)}
      y={0}
      width={Math.max(0, xOf(rangeSelection.t1) - xOf(rangeSelection.t0))}
      height={h}
      fill={accentColor}
      opacity={0.15}
      pointerEvents="none"
    />
    {[rangeSelection.t0, rangeSelection.t1].map((t) => (
      <line key={t} x1={xOf(t)} x2={xOf(t)} y1={0} y2={h} stroke={accentColor} opacity={0.5} />
    ))}
  </>
) : null}
```

In `useAutomationLanes.ts` bind: read `usePlayerStore` selection state/actions; `selection` filtered to this element (`sel.elementKey === (element.key ?? element.id) ? sel : null`); `onRangeSelect(target, t0, t1)` → `setAutomationSelection({ elementKey, target, t0, t1 })` (only when editable — same `domEdit && isSelected` guard as writes); `onRangeClear` → `clearAutomationSelection()`. In the slot, per lane: `rangeSelection={binding.selection?.target === lane.target ? { t0: binding.selection.t0, t1: binding.selection.t1 } : null}`.

- [ ] **Step 4: Run to verify pass** — lane tests + `bunx vitest run src/player/components` for the suite. Check file sizes (`wc -l` on both modified files; extract further if over 600).

- [ ] **Step 5: Commit** — `git commit -m "feat(studio): drag-select a time range on an automation lane"`

### Task 4: Delete/Escape keyboard + stale-selection guard

**Files:**
- Create: `packages/studio/src/hooks/useAutomationSelectionKeyboard.ts`
- Modify: `packages/studio/src/player/components/Timeline.tsx` (mount the hook where `useAutomationLanes` result exists)
- Test: `packages/studio/src/hooks/useAutomationSelectionKeyboard.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function useAutomationSelectionKeyboard(input: {
    lanes: UseAutomationLanesResult; // bind() reaches the write path
  }): void;
  ```
  Handles (capture phase, inert when `isTextInput(document.activeElement)`): `Escape` → clear selection; `Delete`/`Backspace` → `replaceRange(..., inner: [])` committed via the element's binding. Cmd/Ctrl combos handled in PR 3 (same hook).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/studio/src/hooks/useAutomationSelectionKeyboard.test.tsx
// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { usePlayerStore } from "../player/store/playerStore";
import { useAutomationSelectionKeyboard } from "./useAutomationSelectionKeyboard";
import type { AutomationLaneBinding, UseAutomationLanesResult } from "../player/components/useAutomationLanes";
import type { TimelineElement } from "../player/store/timelineElement";

/** Minimal valid fixture — TimelineElement only requires these five fields. */
const bgmElement: TimelineElement = { id: "bgm", key: "bgm", tag: "audio", start: 0, duration: 6, track: 0 };

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Host({ lanes }: { lanes: UseAutomationLanesResult }) {
  useAutomationSelectionKeyboard({ lanes });
  return null;
}

const key = (k: string) => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  act(() => void document.dispatchEvent(e));
};

describe("useAutomationSelectionKeyboard", () => {
  const setup = (binding: Partial<AutomationLaneBinding>) => {
    const onCommit = vi.fn();
    const lanes: UseAutomationLanesResult = {
      bind: () => ({
        automation: {
          version: 1,
          lanes: [{ target: "volume", points: [{ t: 0, v: 1 }, { t: 2, v: 0.5 }, { t: 4, v: 0 }] }],
        },
        lanes: [],
        chain: null,
        onPreview: vi.fn(),
        onCommit,
        onSelect: vi.fn(),
        readOnly: false,
        selection: null,
        onRangeSelect: vi.fn(),
        onRangeClear: vi.fn(),
        ...binding,
      }),
    };
    const host = document.createElement("div");
    document.body.append(host);
    act(() => createRoot(host).render(<Host lanes={lanes} />));
    return { onCommit };
  };

  it("Delete empties the selected range and pins anchors", () => {
    usePlayerStore.setState({ elements: [bgmElement], selectedElementId: "bgm" });
    usePlayerStore.getState().setAutomationSelection({ elementKey: "bgm", target: "volume", t0: 1, t1: 3 });
    const { onCommit } = setup({});
    key("Delete");
    const written = onCommit.mock.calls.at(-1)?.[0];
    const points = written?.lanes?.[0]?.points ?? [];
    expect(points.map((p: { t: number }) => p.t)).toEqual([0, 1, 3, 4]);
  });

  it("Escape clears the selection", () => {
    usePlayerStore.getState().setAutomationSelection({ elementKey: "bgm", target: "volume", t0: 1, t1: 3 });
    setup({});
    key("Escape");
    expect(usePlayerStore.getState().automationSelection).toBeNull();
  });

  it("is inert while a text input has focus", () => {
    usePlayerStore.getState().setAutomationSelection({ elementKey: "bgm", target: "volume", t0: 1, t1: 3 });
    const { onCommit } = setup({});
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    key("Delete");
    expect(onCommit).not.toHaveBeenCalled();
    input.remove();
  });
});
```

- [ ] **Step 2: Run to verify failure** — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/studio/src/hooks/useAutomationSelectionKeyboard.ts
/**
 * Keyboard surface for the active automation selection: Escape clears,
 * Delete/Backspace empties the range (anchors pinned, envelope outside
 * untouched). Sibling of useKeyframeKeyboard and copies its contract:
 * capture phase so playback shortcuts cannot swallow keys we act on, inert
 * while any text input has focus, and a key is only consumed when it does
 * something.
 */
import { useEffect } from "react";
import { usePlayerStore } from "../player/store/playerStore";
import { laneFor, withLane } from "../player/components/automationLaneGeometry";
import { replaceRange } from "../player/components/automationLaneSelection";
import { resolveAutomationRange } from "@hyperframes/core/audio-automation";
import type { UseAutomationLanesResult } from "../player/components/useAutomationLanes";

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

export function useAutomationSelectionKeyboard({ lanes }: { lanes: UseAutomationLanesResult }): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (isTextInput(document.activeElement)) return;
      const state = usePlayerStore.getState();
      const sel = state.automationSelection;
      if (!sel) return;

      if (e.key === "Escape") {
        state.clearAutomationSelection();
        return;
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (e.metaKey || e.ctrlKey) return;

      const element = state.elements.find((el) => (el.key ?? el.id) === sel.elementKey);
      if (!element) return;
      const binding = lanes.bind(element, sel.elementKey === state.selectedElementId);
      if (binding.readOnly) return;
      const lane = laneFor(binding.automation, sel.target);
      const range = resolveAutomationRange(sel.target, binding.chain ?? undefined);
      if (!range || lane.points.length === 0) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      const points = replaceRange({ lane, range, t0: sel.t0, t1: sel.t1, inner: [] });
      binding.onCommit(withLane(binding.automation, { target: sel.target, points }));
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [lanes]);
}
```

Mount in `Timeline.tsx` beside the other hooks: `useAutomationSelectionKeyboard({ lanes: automationLanes });` (the `useAutomationLanes()` result already exists there — follow how it reaches `TimelineLanes`). Add the stale-selection guard in `useAutomationLanes.bind`: when the bound element's automation no longer contains `sel.target`, call `clearAutomationSelection()` in an effect-safe way — a `useEffect` in the slot comparing `binding.selection` against `binding.lanes` is the cleanest seam.

- [ ] **Step 4: Run to verify pass** — hook test + full `bunx vitest run src/player/components src/hooks/useAutomationSelectionKeyboard.test.tsx`.

- [ ] **Step 5: Commit + submit PR**

```bash
git commit -m "feat(studio): delete an automation selection from the keyboard"
gh stack submit
```

PR title: `feat(studio): time selection on automation lanes`. Body: gesture, invariant, Delete/Escape. No spec files in the PR.

---

# PR 2 — wa-16-lane-shapes (branch off wa-15-lane-selection)

Setup: `git checkout wa-15-lane-selection && gh stack add wa-16-lane-shapes`

### Task 5: Shape generators

**Files:**
- Create: `packages/studio/src/player/components/automationShapes.ts`
- Test: `packages/studio/src/player/components/automationShapes.test.ts`

**Interfaces:**
- Consumes: `toUnit`/`fromUnit` (geometry), `sampleAutomationLane`.
- Produces:
  ```ts
  export type AutomationShapeId = "ramp-up" | "ramp-down" | "swell" | "dip";
  export const AUTOMATION_SHAPES: ReadonlyArray<{ id: AutomationShapeId; label: string }>;
  export function generateShape(input: {
    shape: AutomationShapeId;
    lane: HfAutomationLane;      // edge values come from the existing envelope
    range: AutomationRange;
    t0: number;
    t1: number;
  }): HfAutomationPoint[];       // absolute times in [t0, t1], feed to replaceRange as `inner`
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// packages/studio/src/player/components/automationShapes.test.ts
import { describe, expect, it } from "vitest";
import { generateShape } from "./automationShapes";
import { resolveAutomationRange, VOLUME_RANGE } from "@hyperframes/core/audio-automation";
import type { HfAutomationLane } from "@hyperframes/core/audio-automation";

const flat: HfAutomationLane = {
  target: "volume",
  points: [
    { t: 0, v: 0.8 },
    { t: 6, v: 0.8 },
  ],
};

describe("generateShape", () => {
  it("ramp-up fades in from the floor to the envelope's own value", () => {
    const pts = generateShape({ shape: "ramp-up", lane: flat, range: VOLUME_RANGE, t0: 1, t1: 3 });
    expect(pts).toEqual([
      { t: 1, v: VOLUME_RANGE.min },
      { t: 3, v: 0.8 },
    ]);
  });

  it("ramp-down fades out from the envelope's own value", () => {
    const pts = generateShape({ shape: "ramp-down", lane: flat, range: VOLUME_RANGE, t0: 1, t1: 3 });
    expect(pts).toEqual([
      { t: 1, v: 0.8 },
      { t: 3, v: VOLUME_RANGE.min },
    ]);
  });

  it("swell peaks at range max mid-selection, smoothed", () => {
    const pts = generateShape({ shape: "swell", lane: flat, range: VOLUME_RANGE, t0: 1, t1: 3 });
    expect(pts).toHaveLength(3);
    expect(pts[1]).toMatchObject({ t: 2, v: VOLUME_RANGE.max });
    expect(pts[0]?.curve).toBeDefined(); // eased, not a triangle
  });

  it("dip ducks to a quarter of the edge value in unit space", () => {
    const pts = generateShape({ shape: "dip", lane: flat, range: VOLUME_RANGE, t0: 1, t1: 3 });
    // volume is linear 0..1: unit(0.8) = 0.8, floor = 0.2
    expect(pts[1]?.v).toBeCloseTo(0.2, 5);
  });

  it("computes in unit space on a log lane", () => {
    const range = resolveAutomationRange("fx.n1.frequency", {
      version: 1,
      nodes: [{ type: "lowpass", id: "n1", params: {} }],
    });
    expect(range?.scale).toBe("log");
    if (!range) return;
    const lane: HfAutomationLane = {
      target: "fx.n1.frequency",
      points: [
        { t: 0, v: 2000 },
        { t: 6, v: 2000 },
      ],
    };
    const pts = generateShape({ shape: "dip", lane, range, t0: 1, t1: 3 });
    const floor = pts[1]?.v ?? 0;
    // A quarter of the way up the LOG axis, not 500 Hz.
    expect(floor).toBeGreaterThan(range.min);
    expect(floor).toBeLessThan(2000 * 0.25);
  });

  it("uses the range default when the lane is empty", () => {
    const empty: HfAutomationLane = { target: "volume", points: [] };
    const pts = generateShape({ shape: "ramp-down", lane: empty, range: VOLUME_RANGE, t0: 1, t1: 3 });
    expect(pts[0]?.v).toBe(VOLUME_RANGE.default);
  });
});
```

- [ ] **Step 2: Run to verify failure** — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/studio/src/player/components/automationShapes.ts
/**
 * The utility shapes a video author reaches for: fade in, fade out, swell,
 * duck. One shape scaled to the selection — this is not a DAW, nobody needs a
 * tempo-synced LFO. Edge values come from the envelope itself so a shape
 * splices into whatever is already there; vertical maths runs in unit space so
 * a log knob (frequency) behaves like the lane that draws it.
 */
import {
  sampleAutomationLane,
  type AutomationRange,
  type HfAutomationLane,
  type HfAutomationPoint,
} from "@hyperframes/core/audio-automation";
import { fromUnit, toUnit } from "./automationLaneGeometry";

export type AutomationShapeId = "ramp-up" | "ramp-down" | "swell" | "dip";

export const AUTOMATION_SHAPES: ReadonlyArray<{ id: AutomationShapeId; label: string }> = [
  { id: "ramp-up", label: "Ramp up" },
  { id: "ramp-down", label: "Ramp down" },
  { id: "swell", label: "Swell" },
  { id: "dip", label: "Dip" },
];

/** Ease used on the segments entering/leaving a swell or dip midpoint. */
const SMOOTH = 0.4;
/** A dip ducks to this fraction of the edge value, in unit space. */
const DIP_FLOOR = 0.25;

function edgeValue(lane: HfAutomationLane, range: AutomationRange, t: number): number {
  if (lane.points.length === 0) return range.default ?? (range.min + range.max) / 2;
  return sampleAutomationLane(lane, t, range.scale);
}

export function generateShape(input: {
  shape: AutomationShapeId;
  lane: HfAutomationLane;
  range: AutomationRange;
  t0: number;
  t1: number;
}): HfAutomationPoint[] {
  const { shape, lane, range, t0, t1 } = input;
  const v0 = edgeValue(lane, range, t0);
  const v1 = edgeValue(lane, range, t1);
  const mid = (t0 + t1) / 2;
  switch (shape) {
    case "ramp-up":
      return [
        { t: t0, v: range.min },
        { t: t1, v: v1 },
      ];
    case "ramp-down":
      return [
        { t: t0, v: v0 },
        { t: t1, v: range.min },
      ];
    case "swell":
      return [
        { t: t0, v: v0, curve: SMOOTH },
        { t: mid, v: range.max, curve: -SMOOTH },
        { t: t1, v: v1 },
      ];
    case "dip":
      return [
        { t: t0, v: v0, curve: -SMOOTH },
        { t: mid, v: fromUnit(range, toUnit(range, v0) * DIP_FLOOR), curve: SMOOTH },
        { t: t1, v: v1 },
      ];
  }
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(studio): ramp, swell and dip generators for automation selections"`

### Task 6: Simplify (RDP)

**Files:**
- Create: `packages/studio/src/player/components/automationSimplify.ts`
- Test: `packages/studio/src/player/components/automationSimplify.test.ts`

**Interfaces:**
- Produces: `export function simplifyPoints(points: HfAutomationPoint[], range: AutomationRange, epsilon?: number): HfAutomationPoint[]` (default `epsilon = 0.02`, vertical deviation in unit space; first/last always kept; `curve` on kept points preserved).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/studio/src/player/components/automationSimplify.test.ts
import { describe, expect, it } from "vitest";
import { simplifyPoints } from "./automationSimplify";
import { VOLUME_RANGE } from "@hyperframes/core/audio-automation";
import { toUnit } from "./automationLaneGeometry";
import type { HfAutomationPoint } from "@hyperframes/core/audio-automation";

describe("simplifyPoints", () => {
  it("collapses collinear runs to their endpoints", () => {
    const line: HfAutomationPoint[] = Array.from({ length: 50 }, (_, i) => ({
      t: i * 0.1,
      v: 1 - i * 0.01,
    }));
    const out = simplifyPoints(line, VOLUME_RANGE);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(line[0]);
    expect(out[out.length - 1]).toEqual(line[line.length - 1]);
  });

  it("keeps every survivor within epsilon of the original", () => {
    const wave: HfAutomationPoint[] = Array.from({ length: 100 }, (_, i) => ({
      t: i * 0.05,
      v: 0.5 + 0.4 * Math.sin(i * 0.2),
    }));
    const out = simplifyPoints(wave, VOLUME_RANGE, 0.02);
    expect(out.length).toBeLessThan(wave.length / 2);
    // Every dropped point must sit within epsilon (unit space) of the
    // simplified polyline — check by linear interpolation between survivors.
    for (const p of wave) {
      const rIdx = out.findIndex((q) => q.t >= p.t);
      const b = out[rIdx] ?? out[out.length - 1];
      const a = out[rIdx - 1] ?? b;
      if (!a || !b) continue;
      const span = b.t - a.t;
      const f = span > 0 ? (p.t - a.t) / span : 0;
      const approx = toUnit(VOLUME_RANGE, a.v) + f * (toUnit(VOLUME_RANGE, b.v) - toUnit(VOLUME_RANGE, a.v));
      expect(Math.abs(approx - toUnit(VOLUME_RANGE, p.v))).toBeLessThanOrEqual(0.021);
    }
  });

  it("returns short inputs untouched", () => {
    const two: HfAutomationPoint[] = [
      { t: 0, v: 1 },
      { t: 1, v: 0 },
    ];
    expect(simplifyPoints(two, VOLUME_RANGE)).toEqual(two);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
// packages/studio/src/player/components/automationSimplify.ts
/**
 * Ramer–Douglas–Peucker over an envelope's points, deviation measured
 * VERTICALLY in unit space. Vertical (not perpendicular) because an envelope
 * is a function of time — what matters is how far the value strays, and it
 * keeps the metric independent of the time axis' units. Exists for dense
 * producers: carve output and heavy hand edits.
 */
import type { AutomationRange, HfAutomationPoint } from "@hyperframes/core/audio-automation";
import { toUnit } from "./automationLaneGeometry";

export function simplifyPoints(
  points: HfAutomationPoint[],
  range: AutomationRange,
  epsilon = 0.02,
): HfAutomationPoint[] {
  if (points.length <= 2) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  const last = keep.length - 1;
  keep[0] = true;
  keep[last] = true;

  const stack: Array<[number, number]> = [[0, last]];
  while (stack.length > 0) {
    const seg = stack.pop();
    if (!seg) break;
    const [a, b] = seg;
    const pa = points[a];
    const pb = points[b];
    if (!pa || !pb || b - a < 2) continue;
    const ua = toUnit(range, pa.v);
    const ub = toUnit(range, pb.v);
    const span = pb.t - pa.t;
    let worst = -1;
    let worstDev = epsilon;
    for (let i = a + 1; i < b; i += 1) {
      const p = points[i];
      if (!p) continue;
      const f = span > 0 ? (p.t - pa.t) / span : 0;
      const dev = Math.abs(toUnit(range, p.v) - (ua + f * (ub - ua)));
      if (dev > worstDev) {
        worstDev = dev;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = true;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(studio): simplify dense automation runs"`

### Task 7: Selection context menu

**Files:**
- Create: `packages/studio/src/player/components/AutomationSelectionMenu.tsx`
- Modify: `packages/studio/src/player/components/TimelineAutomationLane.tsx` (onContextMenu on the svg opens it when the press lands inside the selection)
- Modify: `packages/studio/src/player/components/TimelineAutomationLane.test.tsx`

**Interfaces:**
- Menu component (portal + `useContextMenuDismiss`, styling mirrors `TrackGapContextMenu`):
  ```ts
  interface AutomationSelectionMenuProps {
    x: number;                 // client coords
    y: number;
    onClose(): void;
    onInsertShape(shape: AutomationShapeId): void;
    onSimplify(): void;
    canSimplify: boolean;      // ≥3 points in range; dimmed row otherwise
  }
  ```
- Lane wiring: svg `onContextMenu` → if `rangeSelection` and `pointAt(e).t` inside it (and not on a point — point right-click still deletes, its handler stops propagation), `preventDefault` + open menu at `e.clientX/Y`. Actions compose `generateShape`/`simplifyPoints` + `pointsIn` + `replaceRange` and write through `commitPoints(points, true)`.

- [ ] **Step 1: Write the failing tests** (lane test file)

```tsx
describe("TimelineAutomationLane selection menu", () => {
  it("right-click inside the selection opens the shape menu", () => {
    const { container, svg } = mount(ramp, { rangeSelection: { t0: 1, t1: 3 } });
    fire(svg, "contextmenu", at(2, 0.5));
    expect(document.querySelector(".hf-automation-menu")).not.toBeNull();
    act(() => container.remove());
  });

  it("inserting a swell replaces the range and commits once", () => {
    const { svg, props } = mount(ramp, { rangeSelection: { t0: 1, t1: 3 } });
    fire(svg, "contextmenu", at(2, 0.5));
    const swell = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".hf-automation-menu button"),
    ).find((b) => b.textContent === "Swell");
    expect(swell).toBeTruthy();
    act(() => swell?.click());
    expect(props.onCommit).toHaveBeenCalledTimes(1);
    const points =
      (props.onCommit.mock.calls.at(-1)?.[0] as HfAutomation | undefined)?.lanes[0]?.points ?? [];
    expect(points.some((p) => p.t === 2 && p.v === 1)).toBe(true); // peak at range.max
  });

  it("right-click outside the selection does not open it", () => {
    const { svg } = mount(ramp, { rangeSelection: { t0: 1, t1: 3 } });
    fire(svg, "contextmenu", at(3.8, 0.5));
    expect(document.querySelector(".hf-automation-menu")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```tsx
// packages/studio/src/player/components/AutomationSelectionMenu.tsx
/**
 * Context menu for a right-click inside an automation time selection: the four
 * utility shapes, then Simplify. Portal + dismiss handling mirror
 * TrackGapContextMenu; rows never vanish — an inapplicable Simplify dims with
 * a reason instead of leaving a shorter menu.
 */
import { memo } from "react";
import { createPortal } from "react-dom";
import { useContextMenuDismiss } from "../../hooks/useContextMenuDismiss";
import { AUTOMATION_SHAPES, type AutomationShapeId } from "./automationShapes";

interface AutomationSelectionMenuProps {
  x: number;
  y: number;
  onClose(): void;
  onInsertShape(shape: AutomationShapeId): void;
  onSimplify(): void;
  /** At least three points in the range — fewer has nothing to thin. */
  canSimplify: boolean;
}

export const AutomationSelectionMenu = memo(function AutomationSelectionMenu({
  x,
  y,
  onClose,
  onInsertShape,
  onSimplify,
  canSimplify,
}: AutomationSelectionMenuProps) {
  const menuRef = useContextMenuDismiss(onClose);
  const row =
    "block w-full px-2 py-1 text-left text-[11px] text-panel-text-1 hover:bg-panel-bg-3 disabled:opacity-40";
  return createPortal(
    <div
      ref={menuRef}
      className="hf-automation-menu fixed z-50 min-w-[140px] rounded border border-panel-border-input bg-panel-bg-2 py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {AUTOMATION_SHAPES.map((shape) => (
        <button
          key={shape.id}
          type="button"
          className={row}
          onClick={() => {
            onInsertShape(shape.id);
            onClose();
          }}
        >
          {shape.label}
        </button>
      ))}
      <div className="my-1 border-t border-panel-border-input" />
      <button
        type="button"
        className={row}
        disabled={!canSimplify}
        title={canSimplify ? undefined : "Fewer than three points in the selection"}
        onClick={() => {
          onSimplify();
          onClose();
        }}
      >
        Simplify
      </button>
    </div>,
    document.body,
  );
});
```

Lane wiring: keep `menuAt: { x: number; y: number } | null` state; svg `onContextMenu` opens it when `rangeSelection` exists and `pointAt(e.clientX, e.clientY).t` lies inside it (a point's own right-click already stops propagation and still deletes). Actions:

```tsx
const insertShape = (shape: AutomationShapeId): void => {
  if (!rangeSelection) return;
  const inner = generateShape({ shape, lane, range, t0: rangeSelection.t0, t1: rangeSelection.t1 });
  commitPoints(replaceRange({ lane, range, ...rangeSelection, inner }), true);
};
const simplifySelection = (): void => {
  if (!rangeSelection) return;
  const inner = simplifyPoints(pointsIn(lane, rangeSelection.t0, rangeSelection.t1), range);
  commitPoints(replaceRange({ lane, range, ...rangeSelection, inner }), true);
};
```

If the lane file crosses 600 lines, move these two into `automationSelectionActions.ts` as pure helpers taking `{ lane, range, selection }`.

- [ ] **Step 4: Run to verify pass** — lane tests + component suite; oxlint/oxfmt; `wc -l` both files.

- [ ] **Step 5: Commit + submit**

```bash
git commit -m "feat(studio): shape and simplify menu on an automation selection"
gh stack submit
```

---

# PR 3 — wa-17-lane-clipboard (branch off wa-16-lane-shapes)

Setup: `git checkout wa-16-lane-shapes && gh stack add wa-17-lane-clipboard`

### Task 8: Clipboard module + unit-space mapping

**Files:**
- Create: `packages/studio/src/player/components/automationClipboard.ts`
- Test: `packages/studio/src/player/components/automationClipboard.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AutomationClipboardEntry {
    sourceRange: AutomationRange;
    span: number;                    // t1 − t0 of the copied selection
    points: HfAutomationPoint[];     // times rebased to 0
  }
  export function copyRange(lane: HfAutomationLane, range: AutomationRange, t0: number, t1: number): void;
  export function readClipboard(): AutomationClipboardEntry | null;
  export function pastePoints(entry: AutomationClipboardEntry, target: AutomationRange, atT: number): HfAutomationPoint[];
  export function clearAutomationClipboard(): void; // test isolation
  ```
- Cross-parameter mapping: `v' = fromUnit(target, toUnit(source, v))`. `curve` carried through unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/studio/src/player/components/automationClipboard.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAutomationClipboard,
  copyRange,
  pastePoints,
  readClipboard,
} from "./automationClipboard";
import { resolveAutomationRange, VOLUME_RANGE } from "@hyperframes/core/audio-automation";
import type { HfAutomationLane } from "@hyperframes/core/audio-automation";

const duck: HfAutomationLane = {
  target: "volume",
  points: [
    { t: 2, v: 1, curve: -0.4 },
    { t: 3, v: 0.25 },
    { t: 4, v: 1 },
  ],
};

beforeEach(clearAutomationClipboard);

describe("automation clipboard", () => {
  it("copies the range rebased to zero", () => {
    copyRange(duck, VOLUME_RANGE, 2, 4);
    const entry = readClipboard();
    expect(entry?.span).toBe(2);
    expect(entry?.points.map((p) => p.t)).toEqual([0, 1, 2]);
    expect(entry?.points[0]?.curve).toBe(-0.4);
  });

  it("pastes at a new time on the same axis unchanged", () => {
    copyRange(duck, VOLUME_RANGE, 2, 4);
    const entry = readClipboard();
    expect(entry).not.toBeNull();
    if (!entry) return;
    const pts = pastePoints(entry, VOLUME_RANGE, 10);
    expect(pts.map((p) => p.t)).toEqual([10, 11, 12]);
    expect(pts.map((p) => p.v)).toEqual([1, 0.25, 1]);
  });

  it("maps values through unit space onto a different parameter", () => {
    const wet = resolveAutomationRange("fx.r.wet", {
      version: 1,
      nodes: [{ type: "reverb", id: "r", params: {} }],
    });
    expect(wet).toBeTruthy();
    if (!wet) return;
    copyRange(duck, VOLUME_RANGE, 2, 4);
    const entry = readClipboard();
    if (!entry) return;
    const pts = pastePoints(entry, wet, 0);
    // volume 1 (unit 1) → wet max; volume 0.25 (unit 0.25) → a quarter up wet's axis
    expect(pts[0]?.v).toBeCloseTo(wet.max, 5);
    expect(pts[1]?.v).toBeCloseTo(wet.min + 0.25 * (wet.max - wet.min), 5);
  });

  it("reads null when nothing was copied", () => {
    expect(readClipboard()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
// packages/studio/src/player/components/automationClipboard.ts
/**
 * Internal clipboard for automation ranges. Module-level, not the OS
 * clipboard — points are not text, and useClipboard is already the DOM-element
 * channel. Values cross parameters through unit space, so a volume duck
 * pasted onto a log-scaled wet knob lands proportionally, not literally.
 */
import type {
  AutomationRange,
  HfAutomationLane,
  HfAutomationPoint,
} from "@hyperframes/core/audio-automation";
import { fromUnit, toUnit } from "./automationLaneGeometry";
import { pointsIn } from "./automationLaneSelection";

export interface AutomationClipboardEntry {
  sourceRange: AutomationRange;
  span: number;
  points: HfAutomationPoint[];
}

let entry: AutomationClipboardEntry | null = null;

export function copyRange(
  lane: HfAutomationLane,
  range: AutomationRange,
  t0: number,
  t1: number,
): void {
  entry = {
    sourceRange: range,
    span: t1 - t0,
    points: pointsIn(lane, t0, t1).map((p) => ({ ...p, t: p.t - t0 })),
  };
}

export function readClipboard(): AutomationClipboardEntry | null {
  return entry;
}

export function pastePoints(
  from: AutomationClipboardEntry,
  target: AutomationRange,
  atT: number,
): HfAutomationPoint[] {
  return from.points.map((p) => ({
    ...p,
    t: atT + p.t,
    v: fromUnit(target, toUnit(from.sourceRange, p.v)),
  }));
}

export function clearAutomationClipboard(): void {
  entry = null;
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(studio): internal clipboard for automation ranges"`

### Task 9: Cmd+C / Cmd+V in the selection keyboard hook

**Files:**
- Modify: `packages/studio/src/hooks/useAutomationSelectionKeyboard.ts`
- Modify: `packages/studio/src/hooks/useAutomationSelectionKeyboard.test.tsx`

**Note (spec refinement):** the spec named `useAppHotkeys`; the hook that already guards on the automation selection is the better seam — same behaviour (never shadows clip copy/paste: copy requires an active automation selection, paste requires clipboard content **and** an audio clip selected), one keyboard surface instead of two.

**Interfaces:** none new. Behaviour:
- `Cmd/Ctrl+C` with an active automation selection → `copyRange` on that lane, consume the event.
- `Cmd/Ctrl+V` with clipboard content and a selected audio element → paste at active selection's `t0` (else playhead clip-local `currentTime − element.start`, clamped `0..duration−span`) onto the **selection's lane** when one exists, else the element's first automation lane; insert via `replaceRange` over `[atT, atT + span]`; consume. No target lane resolvable → fall through (clip paste keeps working).

- [ ] **Step 1: Write the failing tests** (extend the hook test file)

```tsx
it("Cmd+C copies the selection and Cmd+V pastes it at the playhead", () => {
  clearAutomationClipboard();
  usePlayerStore.setState({ elements: [bgmElement], currentTime: 5 });
  usePlayerStore.getState().setAutomationSelection({ elementKey: "bgm", target: "volume", t0: 2, t1: 4 });
  const { onCommit } = setup({});
  const combo = (k: string) => {
    const e = new KeyboardEvent("keydown", { key: k, metaKey: true, bubbles: true, cancelable: true });
    act(() => void document.dispatchEvent(e));
  };
  combo("c");
  expect(readClipboard()?.span).toBe(2);
  usePlayerStore.getState().clearAutomationSelection();
  combo("v");
  const written = onCommit.mock.calls.at(-1)?.[0];
  const times = (written?.lanes?.[0]?.points ?? []).map((p: { t: number }) => p.t);
  expect(times).toContain(5); // playhead 5s − element start 0
  expect(times).toContain(7);
});

it("Cmd+V without automation clipboard content falls through", () => {
  clearAutomationClipboard();
  const { onCommit } = setup({});
  const e = new KeyboardEvent("keydown", { key: "v", metaKey: true, bubbles: true, cancelable: true });
  act(() => void document.dispatchEvent(e));
  expect(e.defaultPrevented).toBe(false);
  expect(onCommit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — in the hook's handler, BEFORE the `if (!sel) return` guard (paste must work without a selection): handle `(e.metaKey || e.ctrlKey) && e.key === "c"` (requires `sel`) and `"v"` (requires `readClipboard()` + a selected audio element with a resolvable lane). Reuse `laneFor`/`resolveAutomationRange`/`replaceRange`/`withLane` exactly as Delete does; paste target lane = `sel?.target ?? binding.lanes[0]?.target`. Consume with `preventDefault` + `stopImmediatePropagation` only when acting. Update the selection to cover the pasted span afterwards (`setAutomationSelection`), so paste → paste again chains.

- [ ] **Step 4: Run to verify pass** — hook tests + `bunx vitest run src/hooks src/player/components`.

- [ ] **Step 5: Commit + submit**

```bash
git commit -m "feat(studio): copy and paste automation ranges across lanes"
gh stack submit
```

---

# PR 4 — wa-18-lane-stretch (branch off wa-17-lane-clipboard)

Setup: `git checkout wa-17-lane-clipboard && gh stack add wa-18-lane-stretch`

### Task 10: `retimeRange` pure op

**Files:**
- Modify: `packages/studio/src/player/components/automationLaneSelection.ts`
- Test: extend `automationLaneSelection.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function retimeRange(input: {
    lane: HfAutomationLane;
    range: AutomationRange;
    t0: number; t1: number;       // current selection
    newT0: number; newT1: number; // where its edges moved to (newT0 < newT1)
  }): HfAutomationPoint[];
  ```
  Semantics: interior points map `t' = newT0 + (t − t0) · (newT1 − newT0)/(t1 − t0)`; result = `replaceRange` over the UNION span `[min(t0,newT0), max(t1,newT1)]` with the retimed points as `inner` — growing eats what it covers, shrinking leaves pinned anchors behind.

- [ ] **Step 1: Write the failing tests**

```ts
describe("retimeRange", () => {
  it("scales interior points proportionally into the new span", () => {
    const pts = retimeRange({ lane: ramp, range: VOLUME_RANGE, t0: 2, t1: 3, newT0: 2, newT1: 5 });
    const moved = pts.find((p) => p.v === 0.4); // the t=3 point
    expect(moved?.t).toBe(5);
  });

  it("preserves the envelope outside the union of old and new spans", () => {
    const before: HfAutomationLane = { target: "volume", points: ramp.points };
    const after: HfAutomationLane = {
      target: "volume",
      points: retimeRange({ lane: ramp, range: VOLUME_RANGE, t0: 2, t1: 3, newT0: 2, newT1: 5 }),
    };
    for (const t of [0, 1, 1.9, 5.1, 6]) {
      expect(sampleAutomationLane(after, t, "linear")).toBeCloseTo(
        sampleAutomationLane(before, t, "linear"),
        5,
      );
    }
  });

  it("rejects a degenerate span", () => {
    expect(
      retimeRange({ lane: ramp, range: VOLUME_RANGE, t0: 2, t1: 3, newT0: 4, newT1: 4 }),
    ).toEqual(ramp.points);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
/**
 * Retime a selection: interior points scale proportionally into the new span,
 * then replaceRange runs over the UNION of old and new spans — growing eats
 * whatever it covers, shrinking pins anchors where the envelope re-enters.
 */
export function retimeRange(input: {
  lane: HfAutomationLane;
  range: AutomationRange;
  t0: number;
  t1: number;
  newT0: number;
  newT1: number;
}): HfAutomationPoint[] {
  const { lane, range, t0, t1, newT0, newT1 } = input;
  const oldSpan = t1 - t0;
  const newSpan = newT1 - newT0;
  if (oldSpan <= 0 || newSpan <= 0) return lane.points;
  const inner = pointsIn(lane, t0, t1).map((p) => ({
    ...p,
    t: newT0 + ((p.t - t0) * newSpan) / oldSpan,
  }));
  return replaceRange({
    lane,
    range,
    t0: Math.min(t0, newT0),
    t1: Math.max(t1, newT1),
    inner,
  });
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat(studio): retime an automation selection"`

### Task 11: Edge-handle gesture

**Files:**
- Modify: `packages/studio/src/player/components/useAutomationLaneGestures.ts`
- Modify: `packages/studio/src/player/components/TimelineAutomationLane.tsx` (cursor + pass selection into the hook)
- Modify: `packages/studio/src/player/components/TimelineAutomationLane.test.tsx`

**Interfaces:**
- `UseAutomationLaneGesturesInput` gains `rangeSelection?: { t0: number; t1: number } | null | undefined`.
- New gesture: pointerdown within 8 px (screen) of `xOf(t0)` or `xOf(t1)` when a selection exists — and NOT on a point (points win) — arms an edge drag. Move previews via `commitPoints(retimeRange(...), false)` with the untouched edge fixed; up persists (`commitPoints(..., true)`) and writes the moved selection back to the slice via `onRangeSelect`. Edge cannot cross its partner (clamp at `partner ± POINT_MERGE_SEC`) nor leave `[0, duration]`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe("TimelineAutomationLane stretch", () => {
  it("dragging the right edge retimes the interior and persists on release", () => {
    const withSel = { rangeSelection: { t0: 1, t1: 2 }, onRangeSelect: vi.fn() };
    const sel: HfAutomation = {
      version: 1,
      lanes: [
        {
          target: "volume",
          points: [
            { t: 0, v: 1 },
            { t: 1.5, v: 0.5 },
            { t: 2, v: 0.8 },
            { t: 4, v: 0 },
          ],
        },
      ],
    };
    const { svg, props } = mount(sel, withSel);
    fire(svg, "pointerdown", at(2, 0.5)); // on the right edge (t=2 has a point — use 2 + edge zone…)
    fire(svg, "pointermove", at(3, 0.5));
    fire(svg, "pointerup", at(3, 0.5));
    const written = props.onCommit.mock.calls.at(-1)?.[0] as HfAutomation;
    const times = (written.lanes[0]?.points ?? []).map((p) => p.t);
    expect(times).toContain(2); // 1.5 scaled: 1 + 0.5·(2/1) = 2
    expect(withSel.onRangeSelect).toHaveBeenLastCalledWith(1, expect.closeTo(3, 1));
  });
});
```

Note for the implementer: if the edge coincides with an existing point (as above), the POINT wins per the hit-order rule — place the test selection edges off any point (e.g. selection `{t0: 0.5, t1: 2.5}` around interior points) and assert accordingly. Adjust the fixture, keep the assertions' spirit: interior scaled by span ratio, persisted once, selection updated.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — in `onPointerDown`, after the point-hit check and before the range-drag arm: when `rangeSelection` exists and `|clientPx − xOf(edge)| ≤ 8` for either edge, capture and set `edgeDrag: { edge: "t0" | "t1" }`. In `onPointerMove`: compute clamped `t`, preview `commitPoints(retimeRange({ lane, range, t0, t1, newT0, newT1 }), false)` where only the dragged edge moves. In `endDrag`: persist and `onRangeSelect(newT0, newT1)`. Cursor: `col-resize` while hovering an edge zone (track via pointermove when no gesture is live, cheap `useState<boolean>`).

- [ ] **Step 4: Run to verify pass** — full component suite + oxlint/oxfmt + fallow (`bunx fallow audit --base origin/main --fail-on-issues`) + `wc -l` on the gesture hook; extract `edgeDrag` helpers to `automationLaneSelection.ts` if the hook nears 600.

- [ ] **Step 5: Commit + submit**

```bash
git commit -m "feat(studio): stretch an automation selection by its edges"
gh stack submit
```

---

## Final verification (after PR 4)

- [ ] `cd packages/studio && bunx vitest run src` — full studio suite green.
- [ ] `bunx fallow audit --base origin/main --fail-on-issues` — no new complexity/dead-code findings.
- [ ] Manual smoke in the studio (`npx hyperframes preview` on a project with music + voiceover): drag-select on a volume lane → rect renders; Delete → flat gap, ends anchored; right-click → Dip → audible duck; Cmd+C on the dip, click another lane's clip, Cmd+V → duck lands scaled; drag right edge → duck widens.
- [ ] `gh stack view` — wa-15..wa-18 stacked on wa-14, all PRs green.
