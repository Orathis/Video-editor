import type { RefObject } from "react";

/**
 * The one notification that preview geometry may have moved.
 *
 * Every canvas overlay measures elements that live inside the preview iframe,
 * so nothing they draw can go stale without one of three things happening: the
 * preview document mutating (a seek writing inline styles, an edit landing, an
 * element appearing), the iframe navigating to another document, or React
 * swapping the iframe element itself. This watches all three and calls
 * `onChange` once per change — which is what lets the overlay loops park when
 * idle instead of polling for it sixty times a second.
 *
 * The iframe element is handed around as a ref, so a swap announces itself to
 * nobody; `poll` is that missing announcement and is meant to be called from a
 * render effect. It is a pair of identity comparisons — calling it often costs
 * nothing, and it notifies only when something actually changed.
 */
export interface PreviewDomWatch {
  poll: () => void;
  dispose: () => void;
}

// data-hidden is included explicitly: hiding an element writes data-hidden, and
// although the runtime honoring also writes display:"none" (a style mutation
// we'd catch anyway), keying on the attribute directly makes the coupling
// robust to any future throttling of that runtime sync.
const WATCHED_ATTRIBUTES = ["style", "class", "transform", "width", "height", "data-hidden"];

export function startPreviewDomWatch(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  onChange: () => void,
): PreviewDomWatch {
  let observedIframe: HTMLIFrameElement | null = null;
  let observedDoc: Document | null = null;
  let observer: MutationObserver | null = null;
  let started = false;

  const observeDoc = (doc: Document | null) => {
    observer?.disconnect();
    observer = null;
    observedDoc = doc;
    if (!doc?.documentElement) return;
    const Observer = doc.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    if (!Observer) return;
    observer = new Observer(onChange);
    observer.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: WATCHED_ATTRIBUTES,
      childList: true,
      subtree: true,
    });
  };

  const poll = () => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument ?? null;
    if (started && iframe === observedIframe && doc === observedDoc) return;
    started = true;
    if (iframe !== observedIframe) {
      observedIframe?.removeEventListener("load", poll);
      observedIframe = iframe;
      iframe?.addEventListener("load", poll);
    }
    if (doc !== observedDoc) observeDoc(doc);
    onChange();
  };

  poll();

  return {
    poll,
    dispose: () => {
      observer?.disconnect();
      observer = null;
      observedIframe?.removeEventListener("load", poll);
      observedIframe = null;
      observedDoc = null;
    },
  };
}
