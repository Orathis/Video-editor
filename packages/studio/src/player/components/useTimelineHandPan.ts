import { useCallback, useEffect, useRef } from "react";

interface TimelineHandPanInput {
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  enabled?: boolean;
  onExtendEnd?: (minimumScrollWidth: number) => void;
}

interface PanGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
  captureTarget: HTMLDivElement;
}

function handPanModifier(event: KeyboardEvent, enabled: boolean): string | null {
  if (
    enabled &&
    (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.key === "Shift")
  ) {
    return event.code || "Shift";
  }
  return null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function clampScroll(value: number, size: number, viewportSize: number): number {
  return Math.max(0, Math.min(Math.max(0, size - viewportSize), value));
}

type HandPanVisualState = "idle" | "ready" | "panning";

const MIN_EXTENSION_BUFFER_PX = 600;

/** Shift + drag panning for the timeline scroll viewport. Space stays playback-only. */
export function useTimelineHandPan({
  containerRef,
  scrollRef,
  enabled = true,
  onExtendEnd,
}: TimelineHandPanInput) {
  const pressedModifiersRef = useRef(new Set<string>());
  const hoveredRef = useRef(false);
  const panRef = useRef<PanGesture | null>(null);
  const suppressClickRef = useRef(false);

  const setVisualState = useCallback(
    (state: HandPanVisualState) => {
      const container = containerRef.current;
      if (!container) return;
      container.classList.toggle("timeline-hand-pan", state !== "idle");
      container.classList.toggle("is-panning", state === "panning");
      if (state === "idle") delete container.dataset.timelineHandPan;
      else container.dataset.timelineHandPan = state;
    },
    [containerRef],
  );

  const finishPan = useCallback(() => {
    const pan = panRef.current;
    if (pan?.captureTarget.hasPointerCapture?.(pan.pointerId)) {
      pan.captureTarget.releasePointerCapture(pan.pointerId);
    }
    panRef.current = null;
    setVisualState(hoveredRef.current && pressedModifiersRef.current.size > 0 ? "ready" : "idle");
  }, [setVisualState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = handPanModifier(event, enabled);
      if (!modifier || isEditableTarget(event.target)) return;
      pressedModifiersRef.current.add(modifier);
      if (!hoveredRef.current) return;
      event.preventDefault();
      setVisualState("ready");
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      // Always release a remembered Shift, even if the tool changed while it
      // was held and panning became disabled.
      const modifier = handPanModifier(event, true);
      if (!modifier) return;
      pressedModifiersRef.current.delete(modifier);
      if (pressedModifiersRef.current.size > 0) return;
      finishPan();
    };
    const handleBlur = () => {
      pressedModifiersRef.current.clear();
      finishPan();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleBlur);
      handleBlur();
    };
  }, [enabled, finishPan, setVisualState]);

  const handlePointerEnter = useCallback(() => {
    hoveredRef.current = true;
    if (pressedModifiersRef.current.size > 0) setVisualState("ready");
  }, [setVisualState]);

  const handlePointerLeave = useCallback(() => {
    hoveredRef.current = false;
    if (panRef.current) return;
    setVisualState("idle");
  }, [setVisualState]);

  const handlePointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Shift is also carried directly on the pointer event. Reading it here
      // avoids depending on a separate window keydown reaching us first.
      const shiftPressed = [...pressedModifiersRef.current].some((key) => key.startsWith("Shift"));
      const modifierPressed = enabled && (shiftPressed || event.shiftKey);
      if (!modifierPressed) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = true;
      if (event.button !== 0) {
        setVisualState("ready");
        return;
      }
      const scroll = scrollRef.current;
      if (!scroll) return;
      scroll.setPointerCapture?.(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: scroll.scrollLeft,
        startScrollTop: scroll.scrollTop,
        captureTarget: scroll,
      };
      setVisualState("panning");
    },
    [enabled, scrollRef, setVisualState],
  );

  const handlePointerMoveCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pan = panRef.current;
      const scroll = scrollRef.current;
      if (!pan || !scroll || event.pointerId !== pan.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const requestedScrollLeft = Math.max(0, pan.startScrollLeft - (event.clientX - pan.startX));
      const canvas =
        scroll.firstElementChild instanceof HTMLElement ? scroll.firstElementChild : null;
      const canvasWidth = canvas ? Number.parseFloat(canvas.style.width) || 0 : 0;
      let availableScrollWidth = Math.max(scroll.scrollWidth, canvasWidth);
      const currentMaxScrollLeft = Math.max(0, availableScrollWidth - scroll.clientWidth);
      if (requestedScrollLeft > currentMaxScrollLeft && onExtendEnd) {
        const extensionBuffer = Math.max(scroll.clientWidth, MIN_EXTENSION_BUFFER_PX);
        const minimumScrollWidth = requestedScrollLeft + scroll.clientWidth + extensionBuffer;
        // Grow synchronously so this pointermove can scroll immediately; the
        // callback stores the same extent in React geometry for ruler/lane ticks.
        if (canvas && minimumScrollWidth > canvasWidth) {
          canvas.style.width = `${minimumScrollWidth}px`;
        }
        availableScrollWidth = Math.max(availableScrollWidth, minimumScrollWidth);
        onExtendEnd(minimumScrollWidth);
      }
      scroll.scrollLeft = clampScroll(
        requestedScrollLeft,
        availableScrollWidth,
        scroll.clientWidth,
      );
      scroll.scrollTop = clampScroll(
        pan.startScrollTop - (event.clientY - pan.startY),
        scroll.scrollHeight,
        scroll.clientHeight,
      );
    },
    [onExtendEnd, scrollRef],
  );

  const handlePointerEndCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (panRef.current?.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      finishPan();
    },
    [finishPan],
  );

  const handleClickCapture = useCallback((event: React.MouseEvent) => {
    const handActive = pressedModifiersRef.current.size > 0 || panRef.current !== null;
    if (!handActive && !suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleContextMenuCapture = useCallback((event: React.MouseEvent) => {
    if (pressedModifiersRef.current.size === 0 && panRef.current === null) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    handlePointerEnter,
    handlePointerLeave,
    handlePointerDownCapture,
    handlePointerMoveCapture,
    handlePointerEndCapture,
    handleClickCapture,
    handleContextMenuCapture,
  };
}
