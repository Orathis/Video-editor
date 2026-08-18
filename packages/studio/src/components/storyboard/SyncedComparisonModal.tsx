import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, SpeakerHigh, X } from "@phosphor-icons/react";
import { encodePreviewPath } from "../../player/components/thumbnailUtils";
import { Button, IconButton } from "../ui/Button";

interface PlayerWindow extends Window {
  __player?: {
    seek: (time: number) => void;
    play?: () => void;
    pause?: () => void;
    getTime?: () => number;
    getDuration?: () => number;
  };
}

export interface SyncedComparisonProps {
  projectId: string;
  referenceComposition: string;
  secondaryComposition: string;
  secondaryLabel: string;
  duration: number;
  initialTime?: number;
  onClose: () => void;
}

export function SyncedComparisonPanel({
  projectId,
  referenceComposition,
  secondaryComposition,
  secondaryLabel,
  duration: initialDuration,
  initialTime = 0,
  onClose,
  presentation = "docked",
}: SyncedComparisonProps & { presentation?: "docked" | "modal" }) {
  const referenceRef = useRef<HTMLIFrameElement>(null);
  const versionRef = useRef<HTMLIFrameElement>(null);
  const [time, setTime] = useState(() =>
    Math.max(
      0,
      initialDuration > 0
        ? Math.min(initialTime, Math.max(0, initialDuration - 0.001))
        : initialTime,
    ),
  );
  const [duration, setDuration] = useState(Math.max(0, initialDuration));
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<"reference" | "version">("version");
  const source = (composition: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/preview/comp/${encodePreviewPath(composition)}`;
  const windows = useCallback(
    () =>
      [
        referenceRef.current?.contentWindow,
        versionRef.current?.contentWindow,
      ] as Array<PlayerWindow | null>,
    [],
  );
  const seek = (next: number) => {
    const clamped = Math.max(
      0,
      duration > 0 ? Math.min(Math.max(0, duration - 0.001), next) : next,
    );
    setTime(clamped);
    windows().forEach((window) => window?.__player?.seek(clamped));
  };
  const togglePlay = () => {
    const next = !playing;
    setPlaying(next);
    windows().forEach((window) => {
      const player = window?.__player;
      if (next) player?.play?.();
      else player?.pause?.();
    });
  };
  const selectAudio = (next: "reference" | "version") => {
    setAudio(next);
    const [referenceWindow, versionWindow] = windows();
    referenceWindow?.document.querySelectorAll("audio,video").forEach((element) => {
      (element as HTMLMediaElement).muted = next !== "reference";
    });
    versionWindow?.document.querySelectorAll("audio,video").forEach((element) => {
      (element as HTMLMediaElement).muted = next !== "version";
    });
  };
  const syncLoadedFrame = () => {
    const detectedDuration = Math.max(
      0,
      ...windows().map((window) => window?.__player?.getDuration?.() ?? 0),
    );
    const resolvedDuration = detectedDuration > 0 ? detectedDuration : duration;
    if (detectedDuration > 0) setDuration(detectedDuration);
    const resolvedTime = Math.max(
      0,
      resolvedDuration > 0 ? Math.min(time, Math.max(0, resolvedDuration - 0.001)) : time,
    );
    setTime(resolvedTime);
    windows().forEach((window) => window?.__player?.seek(resolvedTime));
    selectAudio(audio);
  };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  useEffect(() => {
    if (!playing) return;
    let animationFrame = 0;
    const tick = () => {
      const nextTime = windows()[0]?.__player?.getTime?.() ?? windows()[1]?.__player?.getTime?.();
      if (typeof nextTime === "number" && Number.isFinite(nextTime)) {
        setTime(nextTime);
        if (duration > 0 && nextTime >= duration - 0.001) {
          setPlaying(false);
          windows().forEach((window) => window?.__player?.pause?.());
          return;
        }
      }
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [duration, playing, windows]);

  return (
    <section
      role={presentation === "modal" ? "dialog" : "region"}
      aria-modal={presentation === "modal" ? true : undefined}
      aria-label="Reference and version comparison"
      className={`${presentation === "modal" ? "w-full max-w-[1500px] rounded-xl shadow-2xl" : "w-full rounded-lg"} overflow-hidden border border-neutral-700 bg-neutral-950`}
    >
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">Reference / Our version</h2>
          <p className="truncate text-[11px] text-neutral-500">
            {secondaryLabel} · one shared playhead
          </p>
        </div>
        <IconButton aria-label="Close comparison" icon={<X size={15} />} onClick={onClose} />
      </header>
      <div className="grid grid-cols-2 gap-px bg-neutral-800">
        <figure className="min-w-0 bg-black p-3">
          <figcaption className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Reference
          </figcaption>
          <iframe
            ref={referenceRef}
            title="Reference preview"
            src={source(referenceComposition)}
            onLoad={syncLoadedFrame}
            className="aspect-video w-full border-0 bg-black"
          />
        </figure>
        <figure className="min-w-0 bg-black p-3">
          <figcaption className="mb-2 flex min-w-0 items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            <span className="text-neutral-300">Our version</span>
            <span className="truncate text-right font-normal normal-case tracking-normal">
              {secondaryLabel}
            </span>
          </figcaption>
          <iframe
            ref={versionRef}
            title="Our version preview"
            src={source(secondaryComposition)}
            onLoad={syncLoadedFrame}
            className="aspect-video w-full border-0 bg-black"
          />
        </figure>
      </div>
      <footer className="flex flex-wrap items-center gap-3 border-t border-neutral-800 p-3">
        <IconButton
          aria-label={playing ? "Pause comparison" : "Play comparison"}
          icon={playing ? <Pause size={14} /> : <Play size={14} />}
          onClick={togglePlay}
        />
        <input
          aria-label="Shared comparison playhead"
          type="range"
          min={0}
          max={duration}
          step={0.001}
          value={time}
          onChange={(event) => seek(Number(event.target.value))}
          className="min-w-48 flex-1 accent-sky-400"
        />
        <span className="w-24 font-mono text-[11px] text-neutral-500">
          {time.toFixed(3)} / {duration.toFixed(3)}s
        </span>
        <div className="flex items-center gap-1">
          <SpeakerHigh size={13} className="text-neutral-500" />
          <Button
            size="sm"
            variant={audio === "reference" ? "primary" : "secondary"}
            onClick={() => selectAudio("reference")}
          >
            Reference
          </Button>
          <Button
            size="sm"
            variant={audio === "version" ? "primary" : "secondary"}
            onClick={() => selectAudio("version")}
          >
            Our version
          </Button>
        </div>
      </footer>
    </section>
  );
}

export function SyncedComparisonModal(props: SyncedComparisonProps) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <SyncedComparisonPanel {...props} presentation="modal" />
    </div>
  );
}
