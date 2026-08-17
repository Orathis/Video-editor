import { useEffect, useState } from "react";

export const TIMELINE_DISCLOSURE_DURATION_MS = 240;

export type TimelineDisclosurePhase = "closed" | "opening" | "open" | "closing";

/**
 * Keeps disclosure children mounted just long enough to animate out. The row's
 * geometry still changes immediately, so editing and keyboard state remain
 * authoritative while the old pixels finish folding away.
 */
export function useTimelineDisclosurePresence(isExpanded: boolean): {
  present: boolean;
  phase: TimelineDisclosurePhase;
} {
  const [present, setPresent] = useState(isExpanded);
  const [phase, setPhase] = useState<TimelineDisclosurePhase>(isExpanded ? "open" : "closed");

  useEffect(() => {
    if (isExpanded) {
      setPresent(true);
      setPhase("opening");
      const frame = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(frame);
    }

    setPhase("closing");
    const timeout = window.setTimeout(() => {
      setPresent(false);
      setPhase("closed");
    }, TIMELINE_DISCLOSURE_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [isExpanded]);

  return { present, phase };
}
