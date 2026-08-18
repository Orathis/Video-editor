import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import type { StoryboardFrameView } from "../../hooks/useStoryboard";
import { resolveMediaPreviewUrl } from "../../player/components/thumbnailUtils";
import { FramePoster, posterTime } from "./FramePoster";
import { FRAME_STATUS_META } from "./frameStatus";
import { isStoryboardTransition, STORYBOARD_TRANSITIONS } from "./storyboardTransitions";

export interface StoryboardFrameTileProps {
  projectId: string;
  frame: StoryboardFrameView;
  /** Open this frame in the full-area focus view. */
  onOpen: (index: number) => void;
  /** This frame's pending comment draft ("" when none). */
  commentDraft: string;
  onCommentDraftChange: (index: number, text: string) => void;
  /** A submitted comment the agent has not consumed yet (null when none). */
  pendingComment: string | null;
  /** Project signature the board was loaded with (busts the poster cache). */
  posterVersion?: string;
  onDurationChange: (index: number, seconds: number) => Promise<void>;
  onTransitionChange: (index: number, transition: string) => Promise<void>;
  onImageDrop: (index: number, file: File) => Promise<void>;
  onDelete: (index: number) => void;
  deleting: boolean;
  deleteDisabled: boolean;
  presentation?: "default" | "comparison";
}

function firstLine(text: string): string {
  return (
    text
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? ""
  );
}

function placeholderMessage(frame: StoryboardFrameView): string {
  if (frame.status === "outline") return "Not built yet";
  if (frame.src && !frame.srcExists) return "Frame file not found";
  return "No preview";
}

/** A single contact-sheet tile: poster preview + its metadata. Click to focus. */
// fallow-ignore-next-line complexity
export function StoryboardFrameTile({
  projectId,
  frame,
  onOpen,
  commentDraft,
  onCommentDraftChange,
  pendingComment,
  posterVersion,
  onDurationChange,
  onTransitionChange,
  onImageDrop,
  onDelete,
  deleting,
  deleteDisabled,
  presentation = "default",
}: StoryboardFrameTileProps) {
  const meta = FRAME_STATUS_META[frame.status];
  const renderable = frame.srcExists && frame.status !== "outline";
  const title = frame.title ?? `Frame ${frame.index}`;
  const sceneLine = frame.scene ?? firstLine(frame.narrative);
  const currentDuration = frame.durationSeconds ?? 4;
  const currentTransition = frame.transitionIn ?? "crossfade";
  const imagePath = frame.extra.image;
  const imageUrl = imagePath
    ? resolveMediaPreviewUrl(imagePath, projectId, window.location.origin)
    : null;
  const [durationDraft, setDurationDraft] = useState(String(currentDuration));
  const [savingDuration, setSavingDuration] = useState(false);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [transitionDraft, setTransitionDraft] = useState(currentTransition);
  const [savingTransition, setSavingTransition] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [draggingImage, setDraggingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setDurationDraft(String(currentDuration));
    setDurationError(null);
  }, [currentDuration]);
  useEffect(() => {
    setTransitionDraft(currentTransition);
    setTransitionError(null);
  }, [currentTransition]);
  useEffect(() => setImageLoadFailed(false), [imagePath]);

  const saveDuration = async () => {
    const seconds = Number.parseFloat(durationDraft);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      setDurationDraft(String(currentDuration));
      setDurationError("Enter a duration greater than zero.");
      return;
    }
    if (seconds === currentDuration) return;

    setSavingDuration(true);
    setDurationError(null);
    try {
      await onDurationChange(frame.index, seconds);
    } catch (error) {
      setDurationDraft(String(currentDuration));
      setDurationError(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingDuration(false);
    }
  };

  const saveTransition = async (transition: string) => {
    if (transition === currentTransition) return;
    setTransitionDraft(transition);
    setSavingTransition(true);
    setTransitionError(null);
    try {
      await onTransitionChange(frame.index, transition);
    } catch (error) {
      setTransitionDraft(currentTransition);
      setTransitionError(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingTransition(false);
    }
  };

  const dropImage = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingImage(false);
    const file = Array.from(event.dataTransfer.files).find((candidate) =>
      candidate.type.startsWith("image/"),
    );
    if (!file) {
      setImageError("Drop a PNG, JPEG, WebP, GIF, or SVG image.");
      return;
    }

    setUploadingImage(true);
    setImageError(null);
    try {
      await onImageDrop(frame.index, file);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : String(error));
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <article className="min-w-0">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDraggingImage(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDraggingImage(true);
        }}
        onDragLeave={() => setDraggingImage(false)}
        onDrop={(event) => void dropImage(event)}
        className={`group relative aspect-video w-full overflow-hidden border text-left transition-colors ${
          presentation === "comparison" ? "rounded-sm bg-black" : "rounded-lg bg-neutral-900"
        } ${
          draggingImage
            ? "border-sky-500 bg-sky-950/30"
            : presentation === "comparison"
              ? "border-transparent"
              : "border-neutral-800"
        }`}
      >
        <div className="absolute left-2 top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/70 px-1.5 text-xs font-semibold text-neutral-100">
          {frame.number ?? frame.index}
        </div>
        <button
          type="button"
          aria-label={`Delete ${title}`}
          title={
            deleteDisabled && !deleting
              ? "A storyboard must keep at least one frame"
              : "Delete frame"
          }
          disabled={deleteDisabled}
          onClick={() => onDelete(frame.index)}
          className={`absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/75 text-neutral-400 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-150 hover:border-red-500/60 hover:bg-red-950/90 hover:text-red-200 focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 group-hover:opacity-100 group-focus-within:opacity-100 disabled:cursor-not-allowed disabled:hover:border-white/10 disabled:hover:bg-black/75 disabled:hover:text-neutral-500 ${
            deleting ? "animate-pulse opacity-100" : ""
          }`}
        >
          <X size={13} weight="bold" />
        </button>
        {imageUrl && !imageLoadFailed ? (
          <img
            src={imageUrl}
            alt={`${title} reference`}
            draggable={false}
            onError={() => setImageLoadFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : renderable && frame.src ? (
          <FramePoster
            projectId={projectId}
            src={frame.src}
            seconds={posterTime(frame)}
            title={title}
            posterVersion={posterVersion}
          />
        ) : (
          <FrameTilePlaceholder frame={frame} />
        )}
        {draggingImage || uploadingImage ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/85 text-sm font-semibold text-sky-200 backdrop-blur-sm">
            {uploadingImage ? "Attaching image…" : "Drop image here"}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onOpen(frame.index)}
          className="absolute bottom-2 right-2 z-10 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[11px] font-semibold text-neutral-200 opacity-90 shadow-lg backdrop-blur-sm transition hover:border-sky-500/60 hover:bg-sky-950/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
        >
          View more
        </button>
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-medium text-neutral-200">{title}</h3>
        <span
          title={meta.tooltip}
          aria-label={`Status: ${meta.label} — ${meta.tooltip}`}
          className={`shrink-0 cursor-default rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.chipClass}`}
        >
          {meta.label}
        </span>
      </div>
      {sceneLine && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{sceneLine}</p>}
      {frame.voiceover && (
        <p className="mt-1 line-clamp-2 text-xs italic text-neutral-500">
          <span aria-hidden="true">🎙 </span>“{frame.voiceover}”
        </p>
      )}
      <div className="mt-1 flex min-h-6 items-center gap-3 text-[11px] text-neutral-600">
        <label className="flex items-center rounded-md border border-neutral-800 bg-neutral-900/70 px-1.5 transition-colors focus-within:border-sky-700">
          <span className="sr-only">Duration for {title} in seconds</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.1"
            step="0.1"
            value={durationDraft}
            disabled={savingDuration}
            onChange={(event) => setDurationDraft(event.target.value)}
            onBlur={() => void saveDuration()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label={`Duration for ${title} in seconds`}
            className="w-9 bg-transparent py-0.5 text-right font-medium tabular-nums text-neutral-300 outline-none disabled:opacity-50"
          />
          <span className="ml-0.5 text-neutral-500">s</span>
        </label>
        <label className="flex min-w-0 items-center gap-1">
          <span aria-hidden="true">↘</span>
          <span className="sr-only">Transition into {title}</span>
          <select
            value={transitionDraft}
            disabled={savingTransition}
            onChange={(event) => void saveTransition(event.target.value)}
            aria-label={`Transition into ${title}`}
            className="max-w-36 truncate rounded-md border border-neutral-800 bg-neutral-900/70 px-1.5 py-1 text-[11px] text-neutral-400 outline-none transition-colors hover:text-neutral-200 focus:border-sky-700 disabled:opacity-50"
          >
            {!isStoryboardTransition(currentTransition) ? (
              <option value={currentTransition}>{currentTransition} (custom)</option>
            ) : null}
            {STORYBOARD_TRANSITIONS.map((transition) => (
              <option key={transition.value} value={transition.value}>
                {transition.label}
              </option>
            ))}
          </select>
        </label>
        {durationError ? (
          <span role="alert" title={durationError} className="text-red-400">
            Save failed
          </span>
        ) : null}
        {transitionError ? (
          <span role="alert" title={transitionError} className="text-red-400">
            Save failed
          </span>
        ) : null}
      </div>
      {imageError ? (
        <p role="alert" className="mt-1 text-[11px] text-red-400">
          {imageError}
        </p>
      ) : null}
      <textarea
        value={commentDraft}
        onChange={(e) => onCommentDraftChange(frame.index, e.target.value)}
        rows={2}
        placeholder="Comment on this frame…"
        aria-label={`Comment on ${title}`}
        className="mt-2 w-full resize-none rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-sky-700 focus:outline-none"
      />
      {pendingComment && (
        <p className="mt-1 text-[11px] text-sky-400/90">
          <span className="font-medium">Pending:</span> “{pendingComment}”
        </p>
      )}
    </article>
  );
}

function FrameTilePlaceholder({ frame }: { frame: StoryboardFrameView }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed border-neutral-700 bg-neutral-950 text-center">
      <span className="text-xs font-medium text-neutral-400">{frame.title ?? "Outline"}</span>
      <span className="text-[11px] text-neutral-600">{placeholderMessage(frame)}</span>
    </div>
  );
}
