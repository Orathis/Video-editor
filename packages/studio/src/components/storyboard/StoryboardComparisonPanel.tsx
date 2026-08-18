import { useEffect, useState, type ReactNode } from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import {
  appendStoryboardFrame,
  removeStoryboardFrame,
  setFrameDuration,
  setFrameImage,
  setFrameTransition,
} from "@hyperframes/core/storyboard";
import { useStoryboard, type StoryboardFrameView } from "../../hooks/useStoryboard";
import { useFileManagerContext } from "../../contexts/FileManagerContext";
import { useStudioShellContext } from "../../contexts/StudioContext";
import { StoryboardFrameTile } from "./StoryboardFrameTile";
import { StoryboardFrameFocus } from "./StoryboardFrameFocus";
import {
  APPLY_STORYBOARD_FEEDBACK_MESSAGE,
  AgentChatMessageButton,
} from "./AgentChatMessageButton";
import { useFrameComments } from "./useFrameComments";
import {
  commitStoryboardEdit,
  STUDIO_HISTORY_APPLIED_EVENT,
  type StoryboardRecordEdit,
} from "./storyboardHistory";

export function StoryboardComparisonPanel({
  projectId,
  referencePath,
  referenceLabel,
  secondaryPath,
  secondaryLabel,
  onClose,
  onFrameCountsChange,
  recordEdit,
}: {
  projectId: string;
  referencePath: string;
  referenceLabel: string;
  secondaryPath: string;
  secondaryLabel: string;
  onClose: () => void;
  onFrameCountsChange?: (reference: number, secondary: number) => void;
  recordEdit: StoryboardRecordEdit;
}) {
  const [versionPanelOpen, setVersionPanelOpen] = useState(true);
  const reference = useStoryboard(projectId, referencePath);
  const secondary = useStoryboard(projectId, secondaryPath);
  const reloadReference = reference.reload;
  const reloadSecondary = secondary.reload;
  const loading = reference.loading || secondary.loading;
  const error = reference.error || secondary.error;
  const referenceFrameCount = reference.data?.frames.length;
  const secondaryFrameCount = secondary.data?.frames.length;

  useEffect(() => {
    const reloadBoth = () => {
      reloadReference();
      reloadSecondary();
    };
    window.addEventListener(STUDIO_HISTORY_APPLIED_EVENT, reloadBoth);
    return () => window.removeEventListener(STUDIO_HISTORY_APPLIED_EVENT, reloadBoth);
  }, [reloadReference, reloadSecondary]);
  useEffect(() => {
    if (referenceFrameCount == null || secondaryFrameCount == null) return;
    onFrameCountsChange?.(referenceFrameCount, secondaryFrameCount);
  }, [onFrameCountsChange, referenceFrameCount, secondaryFrameCount]);

  return (
    <section
      role="region"
      aria-label="Reference and version storyboards"
      className="flex h-[calc(100vh-10rem)] min-h-[560px] flex-col overflow-hidden bg-neutral-950"
    >
      {loading ? (
        <p className="px-4 py-12 text-center text-xs text-neutral-500">Loading storyboards…</p>
      ) : error || !reference.data || !secondary.data ? (
        <p role="alert" className="px-4 py-12 text-center text-xs text-red-400">
          Couldn’t load both storyboards{error ? `: ${error}` : "."}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden bg-neutral-950">
          <ComparisonBoard
            projectId={projectId}
            eyebrow="Reference"
            label={referenceLabel}
            storyboardPath={referencePath}
            frames={reference.data.frames}
            signature={reference.data.signature}
            reload={reference.reload}
            recordEdit={recordEdit}
          />
          <aside
            aria-label="Our version storyboard panel"
            className={`${
              versionPanelOpen ? "w-[min(46vw,760px)]" : "w-11"
            } relative flex min-w-0 shrink-0 bg-neutral-900/60 transition-[width] duration-200 ease-out motion-reduce:transition-none`}
          >
            <button
              type="button"
              title={versionPanelOpen ? "Hide our version panel" : "Show our version panel"}
              aria-label={versionPanelOpen ? "Hide our version panel" : "Show our version panel"}
              aria-expanded={versionPanelOpen}
              onClick={() => setVersionPanelOpen((open) => !open)}
              className="absolute left-0 top-3 z-20 flex h-10 w-5 -translate-x-full items-center justify-center rounded-l-full bg-neutral-800/90 text-neutral-400 shadow-sm transition-colors hover:bg-neutral-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {versionPanelOpen ? <CaretRight size={15} /> : <CaretLeft size={15} />}
            </button>
            {versionPanelOpen ? (
              <ComparisonBoard
                projectId={projectId}
                eyebrow="Our version"
                label={secondaryLabel}
                storyboardPath={secondaryPath}
                frames={secondary.data.frames}
                signature={secondary.data.signature}
                reload={secondary.reload}
                recordEdit={recordEdit}
                headerActions={
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close storyboard comparison"
                    title="Close comparison"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <X size={13} weight="bold" />
                  </button>
                }
              />
            ) : (
              <span className="m-auto [writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Our version
              </span>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function ComparisonBoard({
  projectId,
  eyebrow,
  label,
  storyboardPath,
  frames,
  signature,
  reload,
  recordEdit,
  headerActions,
}: {
  projectId: string;
  eyebrow: "Reference" | "Our version";
  label: string;
  storyboardPath: string;
  frames: StoryboardFrameView[];
  signature?: string;
  reload: () => void;
  recordEdit: StoryboardRecordEdit;
  headerActions?: ReactNode;
}) {
  const { readProjectFile, writeProjectFile, uploadProjectFiles } = useFileManagerContext();
  const { setActiveCompPath } = useStudioShellContext();
  const comments = useFrameComments(projectId, frames, recordEdit);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [addingFrame, setAddingFrame] = useState(false);
  const [deletingFrameIndex, setDeletingFrameIndex] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [feedbackMessageCopied, setFeedbackMessageCopied] = useState(false);

  const editStoryboard = async (label: string, edit: (source: string) => string) => {
    const source = await readProjectFile(storyboardPath);
    const changed = await commitStoryboardEdit({
      projectId,
      path: storyboardPath,
      before: source,
      after: edit(source),
      label,
      writeFile: writeProjectFile,
      recordEdit,
    });
    if (changed) reload();
  };

  const addFrame = async () => {
    if (addingFrame) return;
    setAddingFrame(true);
    setEditError(null);
    try {
      await editStoryboard("Add storyboard frame", appendStoryboardFrame);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : String(error));
    } finally {
      setAddingFrame(false);
    }
  };

  const deleteFrame = async (index: number) => {
    if (deletingFrameIndex !== null || frames.length <= 1) return;
    setDeletingFrameIndex(index);
    setEditError(null);
    try {
      await editStoryboard("Delete storyboard frame", (source) =>
        removeStoryboardFrame(source, index),
      );
    } catch (error) {
      setEditError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingFrameIndex(null);
    }
  };

  const saveFeedback = async () => {
    const saved = await comments.submit();
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(APPLY_STORYBOARD_FEEDBACK_MESSAGE);
      setFeedbackMessageCopied(true);
    } catch {
      setFeedbackMessageCopied(false);
    }
  };

  const focusedFrame =
    focusedIndex == null ? null : (frames.find((frame) => frame.index === focusedIndex) ?? null);
  if (focusedFrame) {
    return (
      <section
        className={`flex h-full min-w-0 flex-1 overflow-hidden ${
          eyebrow === "Our version" ? "bg-neutral-900/60" : "bg-neutral-950"
        }`}
      >
        <StoryboardFrameFocus
          key={`${storyboardPath}:${focusedFrame.index}`}
          projectId={projectId}
          storyboardPath={storyboardPath}
          frame={focusedFrame}
          frameCount={frames.length}
          onBack={() => setFocusedIndex(null)}
          onNavigate={(delta) =>
            setFocusedIndex(Math.max(1, Math.min(frames.length, focusedFrame.index + delta)))
          }
          onSaved={reload}
          recordEdit={recordEdit}
          onSelectComposition={setActiveCompPath}
          scriptExists={false}
          commentDraft={comments.drafts[focusedFrame.index] ?? ""}
          onCommentDraftChange={(text) => comments.setDraft(focusedFrame.index, text)}
          pendingComment={
            comments.pending?.find((entry) => entry.frame === focusedFrame.index)?.text ?? null
          }
          pendingCommentCount={comments.pending?.length ?? 0}
          commentDraftCount={comments.draftCount}
          commentsSubmitState={comments.submitState}
          commentsSubmitError={comments.submitError}
          feedbackMessageCopied={feedbackMessageCopied}
          onFeedbackMessageCopied={() => setFeedbackMessageCopied(true)}
          onSaveFeedback={() => void saveFeedback()}
          posterVersion={signature}
        />
      </section>
    );
  }

  return (
    <section
      className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden ${
        eyebrow === "Our version" ? "bg-neutral-900/60" : "bg-neutral-950"
      }`}
    >
      <header className="flex shrink-0 items-end justify-between gap-3 px-3 pb-3 pt-2 sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            {eyebrow}
          </p>
          <h3 className="truncate text-sm font-medium text-neutral-100">{label}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {comments.draftCount > 0 ? (
            <button
              type="button"
              disabled={comments.submitState === "saving"}
              onClick={() => void saveFeedback()}
              className="rounded-full bg-sky-950/70 px-2.5 py-1 text-[10px] font-medium text-sky-200 transition hover:bg-sky-900/70 disabled:opacity-50"
            >
              {comments.submitState === "saving"
                ? "Saving…"
                : `Save feedback (${comments.draftCount})`}
            </button>
          ) : feedbackMessageCopied && (comments.pending?.length ?? 0) > 0 ? (
            <AgentChatMessageButton
              message={APPLY_STORYBOARD_FEEDBACK_MESSAGE}
              label="Copy prompt"
              onCopied={() => setFeedbackMessageCopied(true)}
            />
          ) : null}
          {headerActions}
          <span className="text-[10px] text-neutral-600">{frames.length} frames</span>
        </div>
      </header>
      <div className="storyboard-comparison-scroll min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 xl:grid-cols-2 2xl:grid-cols-3">
          {frames.map((frame) => (
            <StoryboardFrameTile
              key={frame.index}
              projectId={projectId}
              frame={frame}
              onOpen={setFocusedIndex}
              commentDraft={comments.drafts[frame.index] ?? ""}
              onCommentDraftChange={comments.setDraft}
              pendingComment={
                comments.pending?.find((entry) => entry.frame === frame.index)?.text ?? null
              }
              posterVersion={signature}
              onDurationChange={(index, seconds) =>
                editStoryboard("Change frame duration", (source) =>
                  setFrameDuration(source, index, seconds),
                )
              }
              onTransitionChange={(index, transition) =>
                editStoryboard("Change frame transition", (source) =>
                  setFrameTransition(source, index, transition),
                )
              }
              onImageDrop={async (index, file) => {
                const [imagePath] = await uploadProjectFiles([file], "assets/storyboard");
                if (!imagePath) throw new Error("Image upload failed.");
                await editStoryboard("Attach storyboard image", (source) =>
                  setFrameImage(source, index, imagePath),
                );
              }}
              onDelete={(index) => void deleteFrame(index)}
              deleting={deletingFrameIndex === frame.index}
              deleteDisabled={frames.length <= 1 || deletingFrameIndex !== null}
              presentation="comparison"
            />
          ))}
          <div className="flex min-h-36 items-center justify-center">
            <button
              type="button"
              disabled={addingFrame}
              onClick={() => void addFrame()}
              className="group inline-flex items-center gap-2 rounded-full bg-neutral-800/80 px-4 py-2 text-xs font-semibold text-neutral-300 transition hover:-translate-y-0.5 hover:bg-neutral-700 hover:text-white disabled:opacity-50"
            >
              <span className="text-base font-light transition-transform duration-200 group-hover:rotate-90">
                +
              </span>
              {addingFrame ? "Adding…" : "Add frame"}
            </button>
          </div>
        </div>
        {editError ? (
          <p role="alert" className="mt-3 text-center text-xs text-red-400">
            {editError}
          </p>
        ) : null}
        {comments.submitError ? (
          <p role="alert" className="mt-3 text-center text-xs text-red-400">
            {comments.submitError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
