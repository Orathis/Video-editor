import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useTimelineHandPan } from "./useTimelineHandPan";

interface TimelineExtendedHandPanOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  contentOrigin: number;
  sessionEpoch: number;
  enabled: boolean;
}

export function useTimelineExtendedHandPan({
  containerRef,
  scrollRef,
  contentOrigin,
  sessionEpoch,
  enabled,
}: TimelineExtendedHandPanOptions) {
  const ppsRef = useRef(100);
  const [handPanExtentSeconds, setHandPanExtentSeconds] = useState(0);
  useEffect(() => setHandPanExtentSeconds(0), [sessionEpoch]);
  const onExtendEnd = useCallback(
    (minimumScrollWidth: number) => {
      const pps = ppsRef.current;
      if (!(pps > 0)) return;
      const minimumDuration = Math.max(0, (minimumScrollWidth - contentOrigin) / pps);
      setHandPanExtentSeconds((current) => Math.max(current, minimumDuration));
    },
    [contentOrigin],
  );
  const handPan = useTimelineHandPan({ containerRef, scrollRef, enabled, onExtendEnd });
  return { handPan, handPanExtentSeconds, ppsRef };
}
