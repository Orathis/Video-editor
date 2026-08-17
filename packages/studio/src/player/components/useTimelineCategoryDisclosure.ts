import { usePlayerStore } from "../store/playerStore";
import { trackStudioKeyframeLaneExpand } from "../../telemetry/events";

/**
 * Independent row-level disclosure state for visual animation and audio.
 *
 * The store persists ids per clip, while the interface presents one control per
 * track. Every clip on the row therefore opens/closes together, so changing the
 * selected clip cannot make the control lie about the row beneath it.
 */
export function useTimelineCategoryDisclosure() {
  const animationIds = usePlayerStore((state) => state.expandedClipIds);
  const audioIds = usePlayerStore((state) => state.expandedAudioClipIds);
  const expandAnimations = usePlayerStore((state) => state.expandClips);
  const setAnimationExpanded = usePlayerStore((state) => state.setClipExpanded);
  const expandAudio = usePlayerStore((state) => state.expandAudioClips);
  const setAudioExpanded = usePlayerStore((state) => state.setAudioClipExpanded);

  const toggleRow = (
    keys: readonly string[],
    expanded: ReadonlySet<string>,
    expand: (ids: readonly string[]) => void,
    setExpanded: (id: string, value: boolean) => void,
    reportAnimation: boolean,
  ) => {
    const willExpand = !keys.some((key) => expanded.has(key));
    if (reportAnimation) trackStudioKeyframeLaneExpand({ expanded: willExpand });
    if (willExpand) expand(keys);
    else for (const key of keys) setExpanded(key, false);
  };

  return {
    animationIds,
    audioIds,
    toggleAnimationRow: (keys: readonly string[]) =>
      toggleRow(keys, animationIds, expandAnimations, setAnimationExpanded, true),
    toggleAudioRow: (keys: readonly string[]) =>
      toggleRow(keys, audioIds, expandAudio, setAudioExpanded, false),
  };
}
