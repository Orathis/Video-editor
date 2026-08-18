import { useCallback, useEffect, useMemo, useState } from "react";
import {
  appendStoryboardFrame,
  removeStoryboardFrame,
  setFrameDuration,
  setFrameImage,
  setFrameTransition,
} from "@hyperframes/core/storyboard";
import type { StoryboardResponse } from "../../hooks/useStoryboard";
import { useFileManagerContext } from "../../contexts/FileManagerContext";
import { Button } from "../ui/Button";
import { StoryboardDirection } from "./StoryboardDirection";
import { StoryboardGrid } from "./StoryboardGrid";
import { StoryboardScriptPanel } from "./StoryboardScriptPanel";
import { StoryboardFrameFocus } from "./StoryboardFrameFocus";
import { ReferenceImportPanel } from "./ReferenceImportPanel";
import { TemplateSlotsPanel } from "./TemplateSlotsPanel";
import { StoryboardComparisonPanel } from "./StoryboardComparisonPanel";
import {
  STORYBOARD_SPLIT_VIEW_DOCK_ID,
  resolveStoryboardComparison,
} from "./SplitComparisonControl";
import {
  AgentChatMessageButton,
  APPLY_STORYBOARD_FEEDBACK_MESSAGE,
} from "./AgentChatMessageButton";
import { useFrameComments, type CommentsSubmitState } from "./useFrameComments";
import { commitStoryboardEdit, type StoryboardRecordEdit } from "./storyboardHistory";

export interface StoryboardLoadedProps {
  projectId: string;
  data: StoryboardResponse;
  /** Re-fetch the manifest after a source edit is saved. */
  reload: () => void;
  historyRevision: number;
  recordEdit: StoryboardRecordEdit;
  /** Select a composition in the timeline (used by "Open in Preview"). */
  onSelectComposition: (path: string) => void;
  onSelectStoryboard: (path: string) => void;
  onCreateStoryboard: (title: string) => Promise<boolean>;
  onRenameStoryboard: (path: string, title: string) => Promise<boolean>;
  onArchiveStoryboard: (path: string) => Promise<boolean>;
  onUnarchiveStoryboard: (path: string) => Promise<boolean>;
  creatingStoryboard: boolean;
  mutatingStoryboardPath: string | null;
  storyboardError: string | null;
}

function clampIndex(index: number, count: number): number {
  return Math.max(1, Math.min(count, index));
}

function comparisonStorageKey(projectId: string): string {
  return `hyperframes:storyboard-comparison:${projectId}`;
}

function readStoredComparison(projectId: string): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(comparisonStorageKey(projectId)) ?? "";
}

/** A storyboard that exists on disk: visual contact sheet ↔ frame focus. */
// fallow-ignore-next-line complexity
export function StoryboardLoaded({
  projectId,
  data,
  reload,
  historyRevision,
  recordEdit,
  onSelectComposition,
  onSelectStoryboard,
  onCreateStoryboard,
  onRenameStoryboard,
  onArchiveStoryboard,
  onUnarchiveStoryboard,
  creatingStoryboard,
  mutatingStoryboardPath,
  storyboardError,
}: StoryboardLoadedProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [feedbackMessageCopied, setFeedbackMessageCopied] = useState(false);
  const [addingFrame, setAddingFrame] = useState(false);
  const [addFrameError, setAddFrameError] = useState<string | null>(null);
  const [deletingFrameIndex, setDeletingFrameIndex] = useState<number | null>(null);
  const [deleteFrameError, setDeleteFrameError] = useState<string | null>(null);
  const [importingReference, setImportingReference] = useState(false);
  const [selectedComparisonPath, setSelectedComparisonPath] = useState(() =>
    readStoredComparison(projectId),
  );
  const [pendingComparisonPaths, setPendingComparisonPaths] = useState<string[]>([]);
  const [comparisonCounts, setComparisonCounts] = useState<{
    reference: number;
    secondary: number;
  } | null>(null);
  const { readProjectFile, writeProjectFile, uploadProjectFiles } = useFileManagerContext();
  const comments = useFrameComments(projectId, data.frames, recordEdit);
  const comparison = useMemo(
    () => resolveStoryboardComparison(data.storyboards, data.path, selectedComparisonPath),
    [data.path, data.storyboards, selectedComparisonPath],
  );
  const comparisonActive = Boolean(
    selectedComparisonPath &&
    comparison?.options.some((option) => option.path === selectedComparisonPath),
  );
  const selectedComparison = comparison?.options.find(
    (option) => option.path === selectedComparisonPath,
  );
  const selectComparison = useCallback(
    (path: string) => {
      setSelectedComparisonPath(path);
      setComparisonCounts(null);
      if (path) window.sessionStorage.setItem(comparisonStorageKey(projectId), path);
      else window.sessionStorage.removeItem(comparisonStorageKey(projectId));
    },
    [projectId],
  );
  const closeComparison = useCallback(() => {
    setPendingComparisonPaths([]);
    selectComparison("");
  }, [selectComparison]);
  const comparisonSelectionPaths = useMemo(
    () =>
      comparisonActive && comparison
        ? [comparison.pair.referenceStoryboardPath, comparison.pair.secondaryStoryboardPath]
        : pendingComparisonPaths,
    [comparison, comparisonActive, pendingComparisonPaths],
  );
  const toggleComparisonSelection = useCallback(
    (path: string) => {
      if (comparisonSelectionPaths.includes(path)) {
        const next = comparisonSelectionPaths.filter((selectedPath) => selectedPath !== path);
        if (comparisonActive) selectComparison("");
        setPendingComparisonPaths(next);
        return;
      }
      const next = [...comparisonSelectionPaths, path];
      if (next.length < 2) {
        setPendingComparisonPaths(next);
        return;
      }
      const selectedDocuments = next
        .map((selectedPath) => data.storyboards.find((document) => document.path === selectedPath))
        .filter((document) => document !== undefined);
      const reference = selectedDocuments.find((document) => document.kind === "reference");
      const secondary = selectedDocuments.find(
        (document) => document.kind === "template" || document.kind === "version",
      );
      if (reference?.groupId && reference.groupId === secondary?.groupId) {
        setPendingComparisonPaths([]);
        selectComparison(secondary.path);
        return;
      }
      setPendingComparisonPaths([path]);
    },
    [comparisonActive, comparisonSelectionPaths, data.storyboards, selectComparison],
  );
  const recordComparisonCounts = useCallback(
    (reference: number, secondary: number) => setComparisonCounts({ reference, secondary }),
    [],
  );
  const comparisonSummary =
    comparisonActive && selectedComparison
      ? `${
          comparisonCounts
            ? comparisonCounts.reference === comparisonCounts.secondary
              ? `${comparisonCounts.reference} scenes`
              : `${comparisonCounts.reference} / ${comparisonCounts.secondary} scenes`
            : "Comparing"
        } · Reference ↔ ${selectedComparison.kind === "template" ? "Template" : "Version"}`
      : undefined;
  // When the board refreshes off a project change (agent revised frames), the
  // agent has likely consumed the comments file too — re-check so the pending
  // banner clears the moment revisions land, not on the next window focus.
  const { refreshPending } = comments;
  useEffect(() => {
    void refreshPending();
  }, [data.signature, refreshPending]);
  useEffect(() => {
    if (data.globals.compositionPath) onSelectComposition(data.globals.compositionPath);
  }, [data.globals.compositionPath, onSelectComposition]);
  useEffect(() => {
    if (comments.draftCount > 0) setFeedbackMessageCopied(false);
  }, [comments.draftCount]);
  useEffect(() => {
    setSelectedComparisonPath(readStoredComparison(projectId));
    setPendingComparisonPaths([]);
    setComparisonCounts(null);
  }, [projectId]);
  useEffect(() => {
    if (!selectedComparisonPath || comparisonActive) return;
    selectComparison("");
  }, [comparisonActive, selectComparison, selectedComparisonPath]);

  const saveFeedbackAndCopyMessage = async () => {
    const saved = await comments.submit();
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(APPLY_STORYBOARD_FEEDBACK_MESSAGE);
      setFeedbackMessageCopied(true);
    } catch {
      setFeedbackMessageCopied(false);
    }
  };
  const editStoryboard = async (label: string, edit: (source: string) => string) => {
    const source = await readProjectFile(data.path);
    const changed = await commitStoryboardEdit({
      projectId,
      path: data.path,
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
    setAddFrameError(null);
    try {
      await editStoryboard("Add storyboard frame", appendStoryboardFrame);
    } catch (error) {
      setAddFrameError(error instanceof Error ? error.message : String(error));
    } finally {
      setAddingFrame(false);
    }
  };

  const deleteFrame = async (index: number) => {
    if (deletingFrameIndex !== null || data.frames.length <= 1) return;
    setDeletingFrameIndex(index);
    setDeleteFrameError(null);
    try {
      await editStoryboard("Delete storyboard frame", (source) =>
        removeStoryboardFrame(source, index),
      );
    } catch (error) {
      setDeleteFrameError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingFrameIndex(null);
    }
  };

  const updateFrameDuration = async (index: number, seconds: number) => {
    await editStoryboard("Change frame duration", (source) =>
      setFrameDuration(source, index, seconds),
    );
  };

  const updateFrameTransition = async (index: number, transition: string) => {
    await editStoryboard("Change frame transition", (source) =>
      setFrameTransition(source, index, transition),
    );
  };

  const attachFrameImage = async (index: number, file: File) => {
    const [imagePath] = await uploadProjectFiles([file], "assets/storyboard");
    if (!imagePath) throw new Error("Image upload failed.");
    await editStoryboard("Attach storyboard image", (source) =>
      setFrameImage(source, index, imagePath),
    );
  };

  const focusedFrame =
    focusedIndex != null ? (data.frames.find((f) => f.index === focusedIndex) ?? null) : null;

  if (focusedFrame) {
    return (
      <StoryboardFrameFocus
        key={`${historyRevision}:${focusedFrame.index}`}
        projectId={projectId}
        storyboardPath={data.path}
        frame={focusedFrame}
        frameCount={data.frames.length}
        onBack={() => setFocusedIndex(null)}
        onNavigate={(delta) =>
          setFocusedIndex(clampIndex(focusedFrame.index + delta, data.frames.length))
        }
        onSaved={reload}
        recordEdit={recordEdit}
        onSelectComposition={onSelectComposition}
        scriptExists={Boolean(data.script?.exists)}
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
        onSaveFeedback={() => void saveFeedbackAndCopyMessage()}
        posterVersion={data.signature}
      />
    );
  }

  return (
    <div className="flex w-full max-w-[100vw] flex-1 min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-950 text-neutral-200">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="px-4 py-5 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-[1400px]">
            <StoryboardDirection
              frameCount={data.frames.length}
              storyboards={data.storyboards}
              archivedStoryboards={data.archivedStoryboards}
              activePath={data.path}
              onSelectStoryboard={onSelectStoryboard}
              onCreateStoryboard={onCreateStoryboard}
              onRenameStoryboard={onRenameStoryboard}
              onArchiveStoryboard={onArchiveStoryboard}
              onUnarchiveStoryboard={onUnarchiveStoryboard}
              creatingStoryboard={creatingStoryboard}
              mutatingStoryboardPath={mutatingStoryboardPath}
              error={storyboardError}
              onImportReference={() => setImportingReference(true)}
              comparisonSelectionPaths={comparisonSelectionPaths}
              comparisonSummary={comparisonSummary}
              onToggleComparisonSelection={toggleComparisonSelection}
            />
          </div>
          <div id={STORYBOARD_SPLIT_VIEW_DOCK_ID} className="empty:hidden">
            {comparisonActive && comparison ? (
              <StoryboardComparisonPanel
                projectId={projectId}
                referencePath={comparison.pair.referenceStoryboardPath}
                referenceLabel={comparison.pair.referenceLabel}
                secondaryPath={comparison.pair.secondaryStoryboardPath}
                secondaryLabel={comparison.pair.secondaryLabel}
                onClose={closeComparison}
                onFrameCountsChange={recordComparisonCounts}
                recordEdit={recordEdit}
              />
            ) : null}
          </div>
          <div data-storyboard-standard-content className="mx-auto max-w-[1400px]">
            {data.globals.compositionPath &&
            (data.globals.kind === "template" || data.globals.kind === "version") ? (
              <TemplateSlotsPanel
                projectId={projectId}
                compositionPath={data.globals.compositionPath}
                recordEdit={recordEdit}
              />
            ) : null}
            {(comments.draftCount > 0 ||
              (comments.pending?.length ?? 0) > 0 ||
              comments.submitError) && (
              <div className="mt-3 flex justify-end">
                <CommentsSubmitBar
                  draftCount={comments.draftCount}
                  pendingCount={comments.pending?.length ?? 0}
                  submitState={comments.submitState}
                  submitError={comments.submitError}
                  messageCopied={feedbackMessageCopied}
                  onSave={() => void saveFeedbackAndCopyMessage()}
                  onMessageCopied={() => setFeedbackMessageCopied(true)}
                />
              </div>
            )}
            <StoryboardWarnings warnings={data.warnings} />
            <StoryboardGrid
              projectId={projectId}
              frames={data.frames}
              onOpenFrame={setFocusedIndex}
              commentDrafts={comments.drafts}
              onCommentDraftChange={comments.setDraft}
              pendingComments={comments.pending}
              posterVersion={data.signature}
              onAddFrame={() => void addFrame()}
              addingFrame={addingFrame}
              addFrameError={addFrameError}
              onDeleteFrame={(index) => void deleteFrame(index)}
              deletingFrameIndex={deletingFrameIndex}
              deleteFrameError={deleteFrameError}
              onDurationChange={updateFrameDuration}
              onTransitionChange={updateFrameTransition}
              onImageDrop={attachFrameImage}
            />
            {data.script && <StoryboardScriptPanel script={data.script} />}
          </div>
        </div>
      </div>
      {importingReference ? (
        <ReferenceImportPanel
          projectId={projectId}
          recordEdit={recordEdit}
          onClose={() => setImportingReference(false)}
          onCommitted={(path) => {
            setImportingReference(false);
            onSelectStoryboard(path);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

/** Batch-submit the per-frame comment drafts to `.hyperframes/frame-comments.json`. */
function CommentsSubmitBar({
  draftCount,
  pendingCount,
  submitState,
  submitError,
  messageCopied,
  onSave,
  onMessageCopied,
}: {
  draftCount: number;
  pendingCount: number;
  submitState: CommentsSubmitState;
  submitError: string | null;
  messageCopied: boolean;
  onSave: () => void;
  onMessageCopied: () => void;
}) {
  if (pendingCount === 0 && draftCount === 0 && !submitError) return null;
  return (
    <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
      {pendingCount > 0 && (
        <>
          <span className="text-xs text-sky-300">
            {messageCopied
              ? "Feedback saved · Message copied — paste it in your terminal or IDE agent chat."
              : "Feedback saved · Agent not notified."}
          </span>
          <AgentChatMessageButton
            message={APPLY_STORYBOARD_FEEDBACK_MESSAGE}
            label={messageCopied ? "Copy again" : "Copy prompt for agent"}
            onCopied={onMessageCopied}
          />
        </>
      )}
      {submitError && (
        <span className="max-w-64 truncate text-xs text-red-400" title={submitError}>
          Couldn’t submit: {submitError}
        </span>
      )}
      {draftCount > 0 && (
        <Button
          variant="primary"
          size="sm"
          loading={submitState === "saving"}
          disabled={submitState === "saving"}
          onClick={onSave}
        >
          Save &amp; copy message ({draftCount})
        </Button>
      )}
    </div>
  );
}

function StoryboardWarnings({ warnings }: { warnings: StoryboardResponse["warnings"] }) {
  if (warnings.length === 0) return null;
  return (
    <details className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 px-4 py-2 text-xs text-amber-200">
      <summary className="cursor-pointer font-medium">
        {warnings.length} storyboard warning{warnings.length === 1 ? "" : "s"}
      </summary>
      <ul className="mt-2 space-y-1 text-amber-200/80">
        {warnings.map((warning, index) => (
          <li key={`${warning.line ?? "unknown"}-${index}`}>
            {warning.line ? `Line ${warning.line}: ` : ""}
            {warning.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
