// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { useDomEditCompositionRect } from "./useDomEditCompositionRect";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

// happy-dom holds a MutationObserver's callback via a WeakRef; a GC between
// observe() and the mutation silently drops delivery. Same pin as
// offCanvasIndicatorRefresh.test.tsx.
const RealWeakRef = globalThis.WeakRef;
class StrongRef<T extends WeakKey> {
  #value: T;
  constructor(value: T) {
    this.#value = value;
  }
  deref(): T {
    return this.#value;
  }
}
beforeAll(() => {
  (globalThis as { WeakRef: unknown }).WeakRef = StrongRef;
});
afterAll(() => {
  globalThis.WeakRef = RealWeakRef;
});

function domRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

async function flushAnimationFrames(count = 3): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await act(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    );
  }
}

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

interface Harness {
  stage: HTMLDivElement;
  iframeWidth: () => number;
  setIframeWidth: (value: number) => void;
  layoutReads: () => number;
  readScaleX: () => number;
}

function mountHook(): Harness {
  const stage = document.createElement("div");
  const iframe = document.createElement("iframe");
  stage.append(iframe);
  document.body.append(stage);
  const doc = iframe.contentDocument;
  if (!doc) throw new Error("Expected iframe content document");
  doc.body.innerHTML = `<div data-composition-id="root" data-width="800" data-height="450"></div>`;

  const overlay = document.createElement("div");
  document.body.append(overlay);

  let width = 800;
  let reads = 0;
  Element.prototype.getBoundingClientRect = function (): DOMRect {
    reads += 1;
    if (this === iframe) return domRect(0, 0, width, 450);
    return domRect(0, 0, 1000, 600);
  };

  let scaleX = 0;
  function Probe(): React.ReactElement {
    const rect = useDomEditCompositionRect({
      iframeRef: { current: iframe },
      overlayRef: { current: overlay },
    });
    scaleX = rect.scaleX;
    return <span>{rect.width}</span>;
  }

  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Probe />));

  return {
    stage,
    iframeWidth: () => width,
    setIframeWidth: (value: number) => {
      width = value;
    },
    layoutReads: () => reads,
    readScaleX: () => scaleX,
  };
}

describe("useDomEditCompositionRect", () => {
  it("reads no layout at idle", async () => {
    const harness = mountHook();
    await flushAnimationFrames(4);

    const settled = harness.layoutReads();
    expect(settled).toBeGreaterThan(0);

    await flushAnimationFrames(10);
    expect(harness.layoutReads()).toBe(settled);
  });

  it("re-measures when the preview stage's transform changes", async () => {
    const harness = mountHook();
    await flushAnimationFrames(4);
    expect(harness.readScaleX()).toBeCloseTo(1, 5);
    const settled = harness.layoutReads();

    // Zooming writes `transform` on an ancestor of the iframe — a change no
    // ResizeObserver reports, because the iframe's layout box is unchanged.
    harness.setIframeWidth(1600);
    harness.stage.style.transform = "scale(2)";
    await flushAnimationFrames(4);

    expect(harness.layoutReads()).toBeGreaterThan(settled);
    expect(harness.readScaleX()).toBeCloseTo(2, 5);
  });
});
