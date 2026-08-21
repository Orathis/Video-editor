import { useCallback, useEffect, useMemo, useState } from "react";
import { useFileManagerContext } from "../../contexts/FileManagerContext";
import type { StoryboardFrameView } from "../../hooks/useStoryboard";
import {
  FRAME_COMMENTS_PATH,
  buildCommentsFile,
  parseCommentsFile,
  type FrameCommentEntry,
} from "./frameComments";
import { commitStoryboardEdit, type StoryboardRecordEdit } from "./storyboardHistory";

export type CommentsSubmitState = "idle" | "saving";

export interface FrameCommentsValue {
  /** Draft text per frame index — "" / absent means no comment. */
  drafts: Record<number, string>;
  setDraft: (index: number, text: string) => void;
  /** How many frames currently carry a non-empty draft. */
  draftCount: number;
  submitState: CommentsSubmitState;
  /** Most recent submit failure, shown next to the submit action. */
  submitError: string | null;
  /** Write the batch to `.hyperframes/frame-comments.json` and clear the drafts. */
  submit: () => Promise<boolean>;
  /**
   * Comments already submitted but not yet consumed by the agent (the file
   * still exists on disk). Refreshed on mount, after submit, and on window
   * focus — the agent deletes the file once it has applied the feedback.
   */
  pending: FrameCommentEntry[] | null;
  /** Re-read the comments file — callers hook this to board data refreshes. */
  refreshPending: () => Promise<void>;
}

/** Per-frame comment drafts + the batch submit that writes the comments file. */
export function useFrameComments(
  projectId: string,
  frames: StoryboardFrameView[],
  recordEdit: StoryboardRecordEdit,
): FrameCommentsValue {
  const { writeProjectFile, readOptionalProjectFile } = useFileManagerContext();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [submitState, setSubmitState] = useState<CommentsSubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState<FrameCommentEntry[] | null>(null);

  const refreshPending = useCallback(async () => {
    try {
      const parsed = parseCommentsFile(await readOptionalProjectFile(FRAME_COMMENTS_PATH));
      setPending(parsed && parsed.comments.length > 0 ? parsed.comments : null);
    } catch {
      // Transient read failure — keep whatever is currently shown.
    }
  }, [readOptionalProjectFile]);

  useEffect(() => {
    void refreshPending();
    const onFocus = () => void refreshPending();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPending]);

  const setDraft = useCallback((index: number, text: string) => {
    setDrafts((prev) => ({ ...prev, [index]: text }));
  }, []);

  const draftCount = useMemo(
    () => Object.values(drafts).filter((text) => text.trim().length > 0).length,
    [drafts],
  );

  // One guarded async transaction owns loading, success, failure, and cleanup state.
  // fallow-ignore-next-line complexity
  const submit = useCallback(async () => {
    if (draftCount === 0 || submitState === "saving") return false;
    setSubmitState("saving");
    setSubmitError(null);
    try {
      const previousSource = await readOptionalProjectFile(FRAME_COMMENTS_PATH);
      const previous = parseCommentsFile(previousSource);
      const file = buildCommentsFile(frames, drafts, previous, new Date().toISOString());
      await commitStoryboardEdit({
        projectId,
        path: FRAME_COMMENTS_PATH,
        before: previousSource,
        after: `${JSON.stringify(file, null, 2)}\n`,
        label: "Save storyboard feedback",
        writeFile: writeProjectFile,
        recordEdit,
      });
      setDrafts({});
      setPending(file.comments);
      return true;
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit comments");
      return false;
    } finally {
      setSubmitState("idle");
    }
  }, [
    draftCount,
    submitState,
    frames,
    drafts,
    projectId,
    readOptionalProjectFile,
    recordEdit,
    writeProjectFile,
  ]);

  return {
    drafts,
    setDraft,
    draftCount,
    submitState,
    submitError,
    submit,
    pending,
    refreshPending,
  };
}
