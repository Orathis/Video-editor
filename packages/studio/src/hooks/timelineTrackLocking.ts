import { useCallback } from "react";
import { usePlayerStore, type TimelineElement } from "../player";
import { useExpandedTimelineElements } from "../player/hooks/useExpandedTimelineElements";
import {
  timelineTrackOrder,
  trackDisplayNumber,
  trackDisplaySuffix,
} from "../player/components/timelineTrackDisplay";
import { saveProjectFilesWithHistory } from "../utils/studioFileHistory";
import { readTagSnippetByTarget, type PatchOperation } from "../utils/sourcePatcher";
import {
  applyPatchByTarget,
  buildPatchTarget,
  findTimelineElementInIframe,
  readFileContent,
  type RecordEditInput,
} from "./timelineEditingHelpers";

interface MutableRef<T> {
  current: T;
}

interface ReadonlyRef<T> {
  readonly current: T;
}

interface ToggleTimelineTrackLockedInput {
  projectId: string;
  activeCompPath: string | null;
  timelineElements: readonly TimelineElement[];
  track: number;
  locked: boolean;
  previewIframe: HTMLIFrameElement | null;
  writeProjectFile: (path: string, content: string) => Promise<void>;
  recordEdit: (input: RecordEditInput) => Promise<void>;
  domEditSaveTimestampRef: MutableRef<number>;
  pendingTimelineEditPathRef: MutableRef<Set<string>>;
}

interface UseTimelineTrackLockingEditingInput extends Omit<
  ToggleTimelineTrackLockedInput,
  "projectId" | "track" | "locked" | "previewIframe" | "timelineElements"
> {
  projectIdRef: ReadonlyRef<string | null>;
  previewIframeRef: ReadonlyRef<HTMLIFrameElement | null>;
  showToast: (message: string, tone?: "error" | "info") => void;
  isRecordingRef?: ReadonlyRef<boolean>;
  forceReloadSdkSession?: () => void;
}

function targetPath(element: TimelineElement, activeCompPath: string | null): string {
  return element.sourceFile || activeCompPath || "index.html";
}

function patchLiveLockState(
  iframe: HTMLIFrameElement | null,
  elements: readonly TimelineElement[],
  locked: boolean,
  activeCompPath: string | null,
): void {
  for (const element of elements) {
    const target = findTimelineElementInIframe(iframe, element, activeCompPath);
    if (!target) continue;
    if (locked) target.setAttribute("data-timeline-locked", "");
    else target.removeAttribute("data-timeline-locked");
  }
}

export async function toggleTimelineTrackLocked({
  projectId,
  activeCompPath,
  timelineElements,
  track,
  locked,
  previewIframe,
  writeProjectFile,
  recordEdit,
  domEditSaveTimestampRef,
  pendingTimelineEditPathRef,
}: ToggleTimelineTrackLockedInput): Promise<string[]> {
  const elements = timelineElements.filter((element) => element.track === track);
  if (elements.length === 0) return [];

  const suffix = trackDisplaySuffix(
    trackDisplayNumber(timelineTrackOrder(timelineElements), track),
  );
  const operation: PatchOperation = {
    type: "attribute",
    property: "timeline-locked",
    value: locked ? "" : null,
  };
  const byPath = new Map<string, TimelineElement[]>();
  for (const element of elements) {
    const path = targetPath(element, activeCompPath);
    byPath.set(path, [...(byPath.get(path) ?? []), element]);
  }

  patchLiveLockState(previewIframe, elements, locked, activeCompPath);
  const originals = new Map<string, string>();
  const files: Record<string, string> = {};
  try {
    for (const [path, fileElements] of byPath) {
      let content = await readFileContent(projectId, path);
      originals.set(path, content);
      for (const element of fileElements) {
        const patchTarget = buildPatchTarget(element);
        if (!patchTarget || readTagSnippetByTarget(content, patchTarget) === undefined) {
          throw new Error(`Unable to lock timeline element ${element.id} in ${path}`);
        }
        content = applyPatchByTarget(content, patchTarget, operation);
      }
      files[path] = content;
      pendingTimelineEditPathRef.current.add(path);
    }

    domEditSaveTimestampRef.current = Date.now();
    const changedPaths = await saveProjectFilesWithHistory({
      projectId,
      label: locked ? `Lock track${suffix}` : `Unlock track${suffix}`,
      kind: "timeline",
      files,
      readFile: async (path) => originals.get(path) ?? readFileContent(projectId, path),
      writeFile: writeProjectFile,
      recordEdit,
    });
    domEditSaveTimestampRef.current = Date.now();
    for (const element of elements) {
      usePlayerStore.getState().updateElement(element.key ?? element.id, {
        timelineLocked: locked,
      });
    }
    return changedPaths;
  } catch (error) {
    patchLiveLockState(previewIframe, elements, !locked, activeCompPath);
    throw error;
  }
}

export function useTimelineTrackLockingEditing({
  projectIdRef,
  activeCompPath,
  showToast,
  writeProjectFile,
  recordEdit,
  domEditSaveTimestampRef,
  previewIframeRef,
  pendingTimelineEditPathRef,
  isRecordingRef,
  forceReloadSdkSession,
}: UseTimelineTrackLockingEditingInput): (track: number, locked: boolean) => Promise<void> {
  const expandedElements = useExpandedTimelineElements();
  return useCallback(
    async (track: number, locked: boolean) => {
      if (isRecordingRef?.current) {
        showToast("Cannot edit timeline while recording", "error");
        return;
      }
      const projectId = projectIdRef.current;
      if (!projectId) return;
      try {
        await toggleTimelineTrackLocked({
          projectId,
          activeCompPath,
          timelineElements: expandedElements,
          track,
          locked,
          previewIframe: previewIframeRef.current,
          writeProjectFile,
          recordEdit,
          domEditSaveTimestampRef,
          pendingTimelineEditPathRef,
        });
        forceReloadSdkSession?.();
      } catch (error) {
        console.error("[Timeline] Failed to toggle track lock", error);
        showToast(error instanceof Error ? error.message : "Failed to toggle track lock", "error");
      }
    },
    [
      activeCompPath,
      domEditSaveTimestampRef,
      expandedElements,
      forceReloadSdkSession,
      isRecordingRef,
      pendingTimelineEditPathRef,
      previewIframeRef,
      projectIdRef,
      recordEdit,
      showToast,
      writeProjectFile,
    ],
  );
}
