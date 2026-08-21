import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import {
  appendStoryboardFrame,
  setStoryboardArchived,
  setStoryboardTitle,
} from "@hyperframes/core/storyboard";
import { useStoryboard } from "../../hooks/useStoryboard";
import { useProjectSignaturePoll } from "../../hooks/useProjectSignaturePoll";
import { useFileManagerContext } from "../../contexts/FileManagerContext";
import { copyTextToClipboard } from "../../utils/clipboard";
import { Button } from "../ui/Button";
import { StoryboardLoaded } from "./StoryboardLoaded";
import {
  commitStoryboardEdit,
  STUDIO_HISTORY_APPLIED_EVENT,
  type StoryboardRecordEdit,
} from "./storyboardHistory";

export interface StoryboardViewProps {
  projectId: string;
  recordEdit: StoryboardRecordEdit;
  /** Select a composition in the timeline (used by the frame focus "Open in Preview"). */
  onSelectComposition: (path: string) => void;
}

const DEFAULT_STORYBOARD_PATH = "STORYBOARD.md";

function selectedStoryboardStorageKey(projectId: string): string {
  return `hf:storyboard:${projectId}:selected`;
}

function readSelectedStoryboard(projectId: string): string {
  try {
    return (
      sessionStorage.getItem(selectedStoryboardStorageKey(projectId)) || DEFAULT_STORYBOARD_PATH
    );
  } catch {
    return DEFAULT_STORYBOARD_PATH;
  }
}

function nextStoryboardPath(paths: ReadonlyArray<{ path: string }>): string {
  const existing = new Set(paths.map((storyboard) => storyboard.path.toLowerCase()));
  let number = 2;
  while (existing.has(`storyboards/storyboard-${number}.md`)) number += 1;
  return `storyboards/storyboard-${number}.md`;
}

/**
 * Top-level storyboard stage. Replaces the timeline/preview when the view mode
 * is `storyboard`. Handles the load states here; once a storyboard exists,
 * {@link StoryboardLoaded} owns the Board ↔ Source experience.
 */
// fallow-ignore-next-line complexity
export function StoryboardView({
  projectId,
  recordEdit,
  onSelectComposition,
}: StoryboardViewProps) {
  const { readProjectFile, writeProjectFile, refreshFileTree } = useFileManagerContext();
  const [storyboardPath, setStoryboardPath] = useState(() => readSelectedStoryboard(projectId));
  const [creatingStoryboard, setCreatingStoryboard] = useState(false);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);
  const [mutatingStoryboardPath, setMutatingStoryboardPath] = useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const { data, loading, error, reload } = useStoryboard(projectId, storyboardPath);
  // Keep the board current while an agent writes to the project: when the
  // project signature moves past the one `data` was loaded with, refetch. Also
  // upgrades the empty state the moment STORYBOARD.md lands on disk.
  useProjectSignaturePoll(projectId, data?.signature, reload);
  useEffect(() => {
    const onHistoryApplied = () => {
      setHistoryRevision((revision) => revision + 1);
      reload();
    };
    window.addEventListener(STUDIO_HISTORY_APPLIED_EVENT, onHistoryApplied);
    return () => window.removeEventListener(STUDIO_HISTORY_APPLIED_EVENT, onHistoryApplied);
  }, [reload]);

  const selectStoryboard = useCallback(
    (path: string) => {
      setStoryboardPath(path);
      setStoryboardError(null);
      try {
        sessionStorage.setItem(selectedStoryboardStorageKey(projectId), path);
      } catch {
        // Selection still works for this session when storage is unavailable.
      }
    },
    [projectId],
  );

  const createStoryboard = useCallback(
    async (title: string): Promise<boolean> => {
      if (!data || creatingStoryboard) return false;
      const normalizedTitle = title.trim();
      if (!normalizedTitle) {
        setStoryboardError("Enter a storyboard name.");
        return false;
      }
      setCreatingStoryboard(true);
      setStoryboardError(null);
      try {
        const path = nextStoryboardPath([...data.storyboards, ...data.archivedStoryboards]);
        const source = setStoryboardTitle(appendStoryboardFrame(""), normalizedTitle);
        await writeProjectFile(path, source);
        await refreshFileTree();
        selectStoryboard(path);
        return true;
      } catch (nextError) {
        setStoryboardError(nextError instanceof Error ? nextError.message : String(nextError));
        return false;
      } finally {
        setCreatingStoryboard(false);
      }
    },
    [creatingStoryboard, data, refreshFileTree, selectStoryboard, writeProjectFile],
  );

  const renameStoryboard = useCallback(
    async (path: string, title: string): Promise<boolean> => {
      if (mutatingStoryboardPath) return false;
      const normalizedTitle = title.trim();
      if (!normalizedTitle) {
        setStoryboardError("Enter a storyboard name.");
        return false;
      }
      setMutatingStoryboardPath(path);
      setStoryboardError(null);
      try {
        const source = await readProjectFile(path);
        await commitStoryboardEdit({
          projectId,
          path,
          before: source,
          after: setStoryboardTitle(source, normalizedTitle),
          label: `Rename storyboard to ${normalizedTitle}`,
          writeFile: writeProjectFile,
          recordEdit,
        });
        reload();
        return true;
      } catch (nextError) {
        setStoryboardError(nextError instanceof Error ? nextError.message : String(nextError));
        return false;
      } finally {
        setMutatingStoryboardPath(null);
      }
    },
    [mutatingStoryboardPath, projectId, readProjectFile, recordEdit, reload, writeProjectFile],
  );

  const updateStoryboardArchive = useCallback(
    async (path: string, archived: boolean): Promise<boolean> => {
      if (!data || mutatingStoryboardPath) return false;
      if (archived && data.storyboards.length <= 1) {
        setStoryboardError("A project must keep at least one active storyboard.");
        return false;
      }
      setMutatingStoryboardPath(path);
      setStoryboardError(null);
      try {
        const source = await readProjectFile(path);
        await commitStoryboardEdit({
          projectId,
          path,
          before: source,
          after: setStoryboardArchived(source, archived),
          label: `${archived ? "Archive" : "Unarchive"} storyboard`,
          writeFile: writeProjectFile,
          recordEdit,
        });
        if (archived && path === data.path) {
          const fallback = data.storyboards.find((storyboard) => storyboard.path !== path);
          if (fallback) selectStoryboard(fallback.path);
        } else {
          reload();
        }
        return true;
      } catch (nextError) {
        setStoryboardError(nextError instanceof Error ? nextError.message : String(nextError));
        return false;
      } finally {
        setMutatingStoryboardPath(null);
      }
    },
    [
      data,
      mutatingStoryboardPath,
      projectId,
      readProjectFile,
      recordEdit,
      reload,
      selectStoryboard,
      writeProjectFile,
    ],
  );

  if (loading) return <StoryboardFrame>{<Message>Loading storyboard…</Message>}</StoryboardFrame>;
  if (error) {
    return (
      <StoryboardFrame>
        <Message tone="error">Couldn’t load the storyboard: {error}</Message>
        <div className="flex justify-center">
          <Button size="sm" variant="secondary" onClick={reload}>
            Retry
          </Button>
        </div>
      </StoryboardFrame>
    );
  }
  if (!data) return <StoryboardFrame>{null}</StoryboardFrame>;
  if (!data.exists) {
    return (
      <StoryboardFrame>
        <EmptyState path={data.path} />
      </StoryboardFrame>
    );
  }

  return (
    <StoryboardLoaded
      key={data.path}
      projectId={projectId}
      data={data}
      reload={reload}
      historyRevision={historyRevision}
      recordEdit={recordEdit}
      onSelectComposition={onSelectComposition}
      onSelectStoryboard={selectStoryboard}
      onCreateStoryboard={createStoryboard}
      onRenameStoryboard={renameStoryboard}
      onArchiveStoryboard={(path) => updateStoryboardArchive(path, true)}
      onUnarchiveStoryboard={(path) => updateStoryboardArchive(path, false)}
      creatingStoryboard={creatingStoryboard}
      mutatingStoryboardPath={mutatingStoryboardPath}
      storyboardError={storyboardError}
    />
  );
}

function StoryboardFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 min-h-0 overflow-auto bg-neutral-950 text-neutral-200">
      <div className="mx-auto max-w-[1400px] px-8 py-8">{children}</div>
    </div>
  );
}

function Message({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <div
      className={`px-6 py-12 text-center text-sm ${
        tone === "error" ? "text-red-400" : "text-neutral-500"
      }`}
    >
      {children}
    </div>
  );
}

function handoffPrompt(path: string): string {
  return `Create a \`${path}\` at the project root to plan this video frame by frame.

Use this format:

---
format: 1920x1080
message: <the one-line takeaway of the video>
arc: <the narrative shape, e.g. Problem → Solution>
audience: <who it's for>
---

## Frame 1 — <title>
- duration: 5s
- transition_in: crossfade
- status: outline
- src: compositions/frames/01-<slug>.html

<A sentence or two: what's on screen and what the narration says.>

Add one \`## Frame N\` section per beat. Keep the arc tight.

Then run the review loop from the hyperframes-core skill (references/review-loop.md): present the plan as a proposal, offer wireframe sketches on this board, and build on the confirmed layouts.`;
}

function EmptyState({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const prompt = handoffPrompt(path);

  const onCopy = async () => {
    if (await copyTextToClipboard(prompt)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div className="rounded-lg border border-dashed border-neutral-800 px-6 py-10 text-center">
        <h2 className="text-base font-semibold text-neutral-300">No storyboard yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
          Add a <code className="rounded bg-neutral-900 px-1 py-0.5 text-neutral-400">{path}</code>{" "}
          at the project root to plan this video frame by frame. Hand this prompt to your coding
          agent to scaffold it.
        </p>

        <div className="mx-auto mt-6 max-w-2xl overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 text-left">
          <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
            <span className="font-mono text-xs text-neutral-500">Prompt for your agent</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={onCopy}
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
            >
              {copied ? "Copied" : "Copy prompt"}
            </Button>
          </div>
          <pre className="max-h-64 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed text-neutral-400 whitespace-pre-wrap">
            {prompt}
          </pre>
        </div>
      </div>

      <SkeletonPreview />
    </div>
  );
}

/** Faded placeholder of a filled board so landing here isn't a dead end —
 *  it previews the contact-sheet layout {@link StoryboardGrid} renders. */
function SkeletonPreview() {
  return (
    <div aria-hidden="true" className="mt-10 select-none opacity-40">
      <div className="mb-4 text-center text-xs uppercase tracking-wide text-neutral-600">
        Preview
      </div>
      <div className="grid gap-x-6 gap-y-8 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            <div className="aspect-video w-full rounded bg-neutral-800/60" />
            <div className="mt-3 h-3 w-2/3 rounded bg-neutral-800/60" />
            <div className="mt-2 h-2.5 w-full rounded bg-neutral-800/40" />
            <div className="mt-1.5 h-2.5 w-4/5 rounded bg-neutral-800/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
