// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SnapGuideOverlay, type SnapGuidesState } from "./SnapGuideOverlay";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

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

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(snapGuidesRef: { current: SnapGuidesState | null }): HTMLElement {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <SnapGuideOverlay
        snapGuidesRef={snapGuidesRef}
        compositionLeft={0}
        compositionTop={0}
        compositionWidth={800}
        compositionHeight={450}
      />,
    );
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const guideElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>("div[style]")).filter(
    (el) => el.style.position === "absolute",
  );

describe("SnapGuideOverlay", () => {
  it("writes no styles while no guides are active", async () => {
    const snapGuidesRef = { current: null as SnapGuidesState | null };
    const container = mount(snapGuidesRef);
    const [first] = guideElements(container);
    if (!first) throw new Error("Expected guide slots to render");

    // A sentinel the idle loop would clobber if it were still writing every
    // frame — the previous implementation reset display on all ten slots.
    first.style.display = "block";
    await flushAnimationFrames(5);

    expect(first.style.display).toBe("block");
  });

  it("shows a guide a drag crossed, then clears it exactly once when the drag ends", async () => {
    const snapGuidesRef = { current: null as SnapGuidesState | null };
    const container = mount(snapGuidesRef);
    const [first] = guideElements(container);
    if (!first) throw new Error("Expected guide slots to render");

    snapGuidesRef.current = {
      guides: [{ axis: "x", position: 120, from: 0, to: 450 }],
      spacingGuides: [],
    };
    await flushAnimationFrames();

    expect(first.style.display).toBe("");
    expect(first.style.left).toBe("120px");
    expect(first.style.height).toBe("450px");

    snapGuidesRef.current = null;
    await flushAnimationFrames();
    expect(first.style.display).toBe("none");

    // ...and the clearing pass is the last write: a sentinel survives after it.
    first.style.display = "block";
    await flushAnimationFrames(5);
    expect(first.style.display).toBe("block");
  });
});
