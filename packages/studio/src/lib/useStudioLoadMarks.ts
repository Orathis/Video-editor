import { useEffect, useRef } from "react";
import { usePlayerStore } from "../player/store/playerStore";
import { markClipsPainted, markProjectOpenStart, markShellReady } from "./studioLoadMarks";

/**
 * Fires the three load seams the shell owns: shell-ready once the splash gate
 * clears, project-open-start whenever a distinct project resolves, and
 * clips-painted on the first frame after the timeline holds any clip.
 *
 * Clips-painted is observed from the store rather than from Timeline because
 * both App and Timeline sit at the studio 600-line cap, and because the seam
 * is "the element set became non-empty" — a store fact, not a component one.
 * Deliberately not anchored on timelineReady: that flips in initializeAdapter
 * before clip derivation runs, which would put the derivation cost outside the
 * measured window.
 */
export function useStudioLoadMarks(isPastSplashGate: boolean, projectId: string | null): void {
  const shellReadyFired = useRef(false);
  useEffect(() => {
    if (!isPastSplashGate || shellReadyFired.current) return;
    shellReadyFired.current = true;
    markShellReady();
  }, [isPastSplashGate]);

  const openStartFiredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId || openStartFiredFor.current === projectId) return;
    openStartFiredFor.current = projectId;
    markProjectOpenStart();
  }, [projectId]);

  const hasClips = usePlayerStore((state) => state.elements.length > 0);
  const clipsPaintedFired = useRef(false);
  useEffect(() => {
    if (!hasClips) {
      clipsPaintedFired.current = false;
      return;
    }
    if (clipsPaintedFired.current) return;
    clipsPaintedFired.current = true;
    const frame = requestAnimationFrame(() => markClipsPainted());
    return () => cancelAnimationFrame(frame);
  }, [hasClips]);
}
