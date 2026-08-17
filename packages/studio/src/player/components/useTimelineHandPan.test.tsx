// @vitest-environment happy-dom

import React, { act, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimelineHandPan } from "./useTimelineHandPan";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HandPan = ReturnType<typeof useTimelineHandPan>;

function pointer(
  target: HTMLDivElement,
  input: {
    pointerId: number;
    clientX: number;
    clientY: number;
    button?: number;
    shiftKey?: boolean;
  },
): React.PointerEvent<HTMLDivElement> {
  return {
    currentTarget: target,
    target,
    pointerId: input.pointerId,
    clientX: input.clientX,
    clientY: input.clientY,
    button: input.button ?? 0,
    shiftKey: input.shiftKey ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.PointerEvent<HTMLDivElement>;
}

describe("useTimelineHandPan", () => {
  let host: HTMLDivElement;
  let current: HandPan | null;
  let container: HTMLDivElement;
  let scroll: HTMLDivElement;
  let renderCount: number;
  let onExtendEnd: ReturnType<typeof vi.fn>;
  let unmount: () => void;

  beforeEach(() => {
    current = null;
    renderCount = 0;
    onExtendEnd = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    function Harness() {
      renderCount += 1;
      const containerRef = useRef<HTMLDivElement>(null);
      const scrollRef = useRef<HTMLDivElement>(null);
      const handPan = useTimelineHandPan({ containerRef, scrollRef, onExtendEnd });
      useEffect(() => {
        current = handPan;
      });
      return (
        <div ref={containerRef} data-container>
          <div ref={scrollRef} data-scroll>
            <div data-canvas />
          </div>
        </div>
      );
    }

    act(() => root.render(<Harness />));
    container = host.querySelector("[data-container]") as HTMLDivElement;
    scroll = host.querySelector("[data-scroll]") as HTMLDivElement;
    Object.defineProperties(scroll, {
      scrollLeft: { configurable: true, writable: true, value: 300 },
      scrollTop: { configurable: true, writable: true, value: 200 },
      scrollWidth: { configurable: true, value: 1_000 },
      scrollHeight: { configurable: true, value: 800 },
      clientWidth: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 200 },
    });
    unmount = () => act(() => root.unmount());
  });

  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  });

  it("uses Shift + pointer drag to pan both timeline axes", () => {
    act(() => current?.handlePointerEnter());

    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft", key: "Shift" })),
    );
    expect(container.dataset.timelineHandPan).toBe("ready");
    expect(container.classList.contains("timeline-hand-pan")).toBe(true);

    act(() =>
      current?.handlePointerDownCapture(
        pointer(scroll, { pointerId: 7, clientX: 300, clientY: 200 }),
      ),
    );
    expect(container.dataset.timelineHandPan).toBe("panning");
    expect(container.classList.contains("is-panning")).toBe(true);

    act(() =>
      current?.handlePointerMoveCapture(
        pointer(scroll, { pointerId: 7, clientX: 250, clientY: 150 }),
      ),
    );
    expect(scroll.scrollLeft).toBe(350);
    expect(scroll.scrollTop).toBe(250);

    act(() =>
      current?.handlePointerEndCapture(
        pointer(scroll, { pointerId: 7, clientX: 250, clientY: 150 }),
      ),
    );
    expect(container.dataset.timelineHandPan).toBe("ready");
    expect(container.classList.contains("is-panning")).toBe(false);

    act(() =>
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft", key: "Shift" })),
    );
    expect(container.dataset.timelineHandPan).toBeUndefined();
  });

  it("extends the future-time canvas instead of clamping at the final clip", () => {
    scroll.scrollLeft = 600;
    act(() => current?.handlePointerEnter());
    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft", key: "Shift" })),
    );
    act(() =>
      current?.handlePointerDownCapture(
        pointer(scroll, { pointerId: 12, clientX: 300, clientY: 100 }),
      ),
    );
    act(() =>
      current?.handlePointerMoveCapture(
        pointer(scroll, { pointerId: 12, clientX: 100, clientY: 100 }),
      ),
    );

    expect(scroll.scrollLeft).toBe(800);
    expect((scroll.firstElementChild as HTMLElement).style.width).toBe("1800px");
    expect(onExtendEnd).toHaveBeenLastCalledWith(1800);

    act(() =>
      current?.handlePointerEndCapture(
        pointer(scroll, { pointerId: 12, clientX: 100, clientY: 100 }),
      ),
    );
    act(() =>
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft", key: "Shift" })),
    );
  });

  it("ignores Space so playback keeps exclusive ownership", () => {
    const rendersBeforeGesture = renderCount;
    act(() => current?.handlePointerEnter());
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " })));
    expect(container.dataset.timelineHandPan).toBeUndefined();

    act(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " " })));
    expect(container.dataset.timelineHandPan).toBeUndefined();
    expect(renderCount).toBe(rendersBeforeGesture);
  });

  it("starts panning when modifier keydown and pointerdown arrive in the same frame", () => {
    act(() => current?.handlePointerEnter());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft", key: "Shift" }));
      current?.handlePointerDownCapture(
        pointer(scroll, { pointerId: 9, clientX: 300, clientY: 200 }),
      );
    });

    expect(container.dataset.timelineHandPan).toBe("panning");
    act(() =>
      current?.handlePointerEndCapture(
        pointer(scroll, { pointerId: 9, clientX: 300, clientY: 200 }),
      ),
    );
  });

  it("starts from pointer-event Shift even if a separate keydown was not observed", () => {
    act(() => current?.handlePointerEnter());

    act(() =>
      current?.handlePointerDownCapture(
        pointer(scroll, { pointerId: 10, clientX: 300, clientY: 200, shiftKey: true }),
      ),
    );

    expect(container.dataset.timelineHandPan).toBe("panning");
    act(() =>
      current?.handlePointerEndCapture(
        pointer(scroll, { pointerId: 10, clientX: 300, clientY: 200, shiftKey: true }),
      ),
    );
    expect(container.dataset.timelineHandPan).toBeUndefined();
  });

  it("blocks clicks and context menus while the hand modifier is held", () => {
    act(() => current?.handlePointerEnter());
    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft", key: "Shift" })),
    );
    const click = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;
    const contextMenu = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    current?.handleClickCapture(click);
    current?.handleContextMenuCapture(contextMenu);

    expect(click.preventDefault).toHaveBeenCalledOnce();
    expect(click.stopPropagation).toHaveBeenCalledOnce();
    expect(contextMenu.preventDefault).toHaveBeenCalledOnce();
    expect(contextMenu.stopPropagation).toHaveBeenCalledOnce();
    act(() =>
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft", key: "Shift" })),
    );
  });

  it("clears the ready cursor when the pointer leaves the timeline", () => {
    act(() => current?.handlePointerEnter());
    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft", key: "Shift" })),
    );
    expect(container.dataset.timelineHandPan).toBe("ready");

    act(() => current?.handlePointerLeave());
    expect(container.dataset.timelineHandPan).toBeUndefined();
    act(() =>
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft", key: "Shift" })),
    );
  });
});
