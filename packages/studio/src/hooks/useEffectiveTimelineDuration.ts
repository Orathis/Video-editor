import { useMemo } from "react";

interface TimedElement {
  start: number;
  duration: number;
}

/** Includes authored elements that extend beyond the composition's declared duration. */
export function useTimelineDuration(
  elements: readonly TimedElement[],
  declaredDuration: number,
): number {
  return useMemo(() => {
    const maxEnd = elements.length
      ? Math.max(...elements.map((element) => element.start + element.duration))
      : 0;
    return Math.max(declaredDuration, maxEnd);
  }, [declaredDuration, elements]);
}
