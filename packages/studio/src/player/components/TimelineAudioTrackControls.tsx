import { LinkSimple } from "@phosphor-icons/react";
import { usePlayerStore } from "../store/playerStore";

function auditionButtonClass(active: boolean, color: string): string {
  return [
    "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[9px] font-bold",
    "transition-[opacity,color,background-color,border-color] duration-150",
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3CE6AC]",
    active
      ? `${color} opacity-100`
      : "border-white/10 bg-transparent text-white/35 opacity-0 hover:border-white/20 hover:bg-white/[0.06] hover:text-white group-hover/layer:opacity-100 focus-visible:opacity-100",
  ].join(" ");
}

export function TimelineAudioTrackControls({
  track,
  hasEmbeddedVideoAudio,
}: {
  track: number;
  hasEmbeddedVideoAudio: boolean;
}) {
  const muted = usePlayerStore((state) => state.mutedTimelineTracks.has(track));
  const solo = usePlayerStore((state) => state.soloTimelineTracks.has(track));
  const setMuted = usePlayerStore((state) => state.setTimelineTrackMuted);
  const setSolo = usePlayerStore((state) => state.setTimelineTrackSolo);

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        aria-label={`${muted ? "Unmute" : "Mute"} audio track`}
        aria-pressed={muted}
        title={`${muted ? "Unmute" : "Mute"} track`}
        className={auditionButtonClass(muted, "border-amber-300/45 bg-amber-300/12 text-amber-200")}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setMuted(track, !muted);
        }}
      >
        M
      </button>
      <button
        type="button"
        aria-label={`${solo ? "Unsolo" : "Solo"} audio track`}
        aria-pressed={solo}
        title={`${solo ? "Unsolo" : "Solo"} track`}
        className={auditionButtonClass(solo, "border-sky-300/45 bg-sky-300/12 text-sky-200")}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setSolo(track, !solo);
        }}
      >
        S
      </button>
      {hasEmbeddedVideoAudio ? (
        <span
          role="img"
          aria-label="Video and embedded audio are linked"
          title="Embedded audio stays linked to this video"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-sky-300/20 bg-sky-300/[0.06] text-sky-200/65"
        >
          <LinkSimple size={12} weight="bold" aria-hidden="true" />
        </span>
      ) : null}
    </span>
  );
}
