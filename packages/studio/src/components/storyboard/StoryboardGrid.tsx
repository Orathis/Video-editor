import type { StoryboardFrameView } from "../../hooks/useStoryboard";
import type { FrameCommentEntry } from "./frameComments";
import { StoryboardFrameTile } from "./StoryboardFrameTile";

export interface StoryboardGridProps {
  projectId: string;
  frames: StoryboardFrameView[];
  /** Open a frame in the full-area focus view. */
  onOpenFrame: (index: number) => void;
  /** Per-frame comment drafts, keyed by frame index. */
  commentDrafts: Record<number, string>;
  onCommentDraftChange: (index: number, text: string) => void;
  /** Submitted comments the agent has not consumed yet. */
  pendingComments: FrameCommentEntry[] | null;
  /** Project signature the board was loaded with (busts poster caches). */
  posterVersion?: string;
  onAddFrame: () => void;
  addingFrame: boolean;
  addFrameError: string | null;
  onDeleteFrame: (index: number) => void;
  deletingFrameIndex: number | null;
  deleteFrameError: string | null;
  onDurationChange: (index: number, seconds: number) => Promise<void>;
  onTransitionChange: (index: number, transition: string) => Promise<void>;
  onImageDrop: (index: number, file: File) => Promise<void>;
}

/** The contact sheet: ordered frame tiles in a responsive grid. */
export function StoryboardGrid({
  projectId,
  frames,
  onOpenFrame,
  commentDrafts,
  onCommentDraftChange,
  pendingComments,
  posterVersion,
  onAddFrame,
  addingFrame,
  addFrameError,
  onDeleteFrame,
  deletingFrameIndex,
  deleteFrameError,
  onDurationChange,
  onTransitionChange,
  onImageDrop,
}: StoryboardGridProps) {
  return (
    <div className="mt-8">
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
        {frames.map((frame) => (
          <StoryboardFrameTile
            key={frame.index}
            projectId={projectId}
            frame={frame}
            onOpen={onOpenFrame}
            commentDraft={commentDrafts[frame.index] ?? ""}
            onCommentDraftChange={onCommentDraftChange}
            pendingComment={
              pendingComments?.find((entry) => entry.frame === frame.index)?.text ?? null
            }
            posterVersion={posterVersion}
            onDurationChange={onDurationChange}
            onTransitionChange={onTransitionChange}
            onImageDrop={onImageDrop}
            onDelete={onDeleteFrame}
            deleting={deletingFrameIndex === frame.index}
            deleteDisabled={frames.length <= 1 || deletingFrameIndex !== null}
          />
        ))}
        <div className="flex min-h-40 items-center justify-center">
          <button
            type="button"
            onClick={onAddFrame}
            disabled={addingFrame}
            className="group inline-flex items-center gap-2.5 rounded-full border border-neutral-700 bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-neutral-200 shadow-lg shadow-black/25 transition duration-200 hover:-translate-y-0.5 hover:border-sky-500/70 hover:bg-sky-950/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-500 disabled:pointer-events-none disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-base font-light text-neutral-300 transition-[transform,background-color,color] duration-300 ease-out group-hover:rotate-90 group-hover:scale-110 group-hover:bg-sky-500/20 group-hover:text-sky-300"
            >
              {addingFrame ? <span className="animate-pulse text-xs">•••</span> : "+"}
            </span>
            {addingFrame ? "Adding frame…" : "Add frame"}
          </button>
        </div>
      </div>
      {addFrameError ? (
        <p role="alert" className="mt-2 text-center text-xs text-red-400">
          Couldn’t add frame: {addFrameError}
        </p>
      ) : null}
      {deleteFrameError ? (
        <p role="alert" className="mt-2 text-center text-xs text-red-400">
          Couldn’t delete frame: {deleteFrameError}
        </p>
      ) : null}
    </div>
  );
}
