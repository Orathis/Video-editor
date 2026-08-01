import { useState, type RefObject } from "react";
import { useMountEffect } from "../../hooks/useMountEffect";

export interface DomEditCompositionRect {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

function sameRect(a: DomEditCompositionRect, b: DomEditCompositionRect): boolean {
  const d = (k: keyof DomEditCompositionRect) => Math.abs(a[k] - b[k]);
  return (
    d("left") < 0.5 &&
    d("top") < 0.5 &&
    d("width") < 0.5 &&
    d("height") < 0.5 &&
    d("scaleX") < 0.001 &&
    d("scaleY") < 0.001
  );
}

export function useDomEditCompositionRect({
  iframeRef,
  overlayRef,
}: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
}): DomEditCompositionRect {
  const [compRect, setCompRect] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    scaleX: 1,
    scaleY: 1,
  });

  useMountEffect(() => {
    let frame = 0;
    // Every input below changes on an observable event: the iframe or overlay
    // resizing, the preview stage's zoom/pan transform (written as `style` on
    // an ancestor of the iframe, so no ResizeObserver sees it), or the iframe
    // loading a different composition. Idle, this hook read layout twice and
    // queried the preview document once on every single frame, forever.
    //
    // The rAF loop stays only to notice that `iframeRef.current` has become a
    // DIFFERENT element — the preview Player remounts on composition switch —
    // which is the same doc-swap check `offCanvasIndicatorRefresh` makes.
    let dirty = true;
    let observed: HTMLIFrameElement | null = null;
    const markDirty = () => {
      dirty = true;
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(markDirty);
    const stageObserver =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(markDirty);

    const observe = (iframe: HTMLIFrameElement | null) => {
      if (iframe === observed) return;
      observed?.removeEventListener("load", markDirty);
      resizeObserver?.disconnect();
      stageObserver?.disconnect();
      observed = iframe;
      markDirty();
      if (!iframe) return;
      iframe.addEventListener("load", markDirty);
      resizeObserver?.observe(iframe);
      const overlayEl = overlayRef.current;
      if (overlayEl) resizeObserver?.observe(overlayEl);
      for (let node = iframe.parentElement; node; node = node.parentElement) {
        stageObserver?.observe(node, { attributes: true, attributeFilter: ["style", "class"] });
        if (node === document.body) break;
      }
    };

    // fallow-ignore-next-line complexity
    const update = () => {
      frame = requestAnimationFrame(update);
      const iframe = iframeRef.current;
      observe(iframe);
      if (!dirty) return;
      dirty = false;
      const overlayEl = overlayRef.current;
      if (!iframe || !overlayEl) return;
      const iRect = iframe.getBoundingClientRect();
      const oRect = overlayEl.getBoundingClientRect();
      const left = iRect.left - oRect.left;
      const top = iRect.top - oRect.top;
      if (iRect.width <= 0 || iRect.height <= 0) return;
      const doc = iframe.contentDocument;
      const root = doc?.querySelector<HTMLElement>("[data-composition-id]") ?? doc?.documentElement;
      const dw = Number.parseFloat(root?.getAttribute("data-width") ?? "");
      const dh = Number.parseFloat(root?.getAttribute("data-height") ?? "");
      const scaleX = dw > 0 ? iRect.width / dw : 1;
      const scaleY = dh > 0 ? iRect.height / dh : 1;
      const next = { left, top, width: iRect.width, height: iRect.height, scaleX, scaleY };
      setCompRect((prev) => (sameRect(prev, next) ? prev : next));
    };
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      stageObserver?.disconnect();
      observed?.removeEventListener("load", markDirty);
    };
  });

  return compRect;
}
