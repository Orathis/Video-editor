import { useCallback, type RefObject } from "react";
import type { TimelineElement } from "../player";
import { usePlayerStore } from "../player";
import {
  buildTimelineAssetId,
  extendCompositionDurationIfNeeded,
  insertTimelineAssetIntoSource,
} from "../utils/timelineAssetDrop";
import { collectHtmlIds, getTimelineElementLabel } from "../utils/studioHelpers";
import { generateId } from "../utils/generateId";
import { saveProjectFilesWithHistory } from "../utils/studioFileHistory";
import { getStudioSaveErrorMessage } from "../utils/studioSaveDiagnostics";
import { studioWriteHeaders } from "../utils/studioFileVersion";
import {
  applyPatchByTarget,
  buildPatchTarget,
  extendRootDurationIfNeeded,
  findTimelineElementInIframe,
  formatTimelineAttributeNumber,
  type PersistTimelineEditInput,
} from "./timelineEditingHelpers";
import { captureDurationRollback, readFileContent } from "./timelineTimingSync";
import type { UseTimelineEditingOptions } from "./useTimelineEditingTypes";

type ClipOperationOptions = Pick<
  UseTimelineEditingOptions,
  | "activeCompPath"
  | "timelineElements"
  | "showToast"
  | "writeProjectFile"
  | "recordEdit"
  | "domEditSaveTimestampRef"
  | "reloadPreview"
  | "previewIframeRef"
  | "isRecordingRef"
  | "forceReloadSdkSession"
> & {
  projectIdRef: RefObject<string | null>;
  enqueueEdit: (
    element: TimelineElement,
    label: string,
    buildPatches: PersistTimelineEditInput["buildPatches"],
    coalesceKey?: string,
  ) => Promise<void>;
};

export function useTimelineClipOperations({
  projectIdRef,
  activeCompPath,
  timelineElements,
  showToast,
  writeProjectFile,
  recordEdit,
  domEditSaveTimestampRef,
  reloadPreview,
  previewIframeRef,
  isRecordingRef,
  forceReloadSdkSession,
  enqueueEdit,
}: ClipOperationOptions) {
  const handleTimelineElementRename = useCallback(
    async (element: TimelineElement, requestedLabel: string) => {
      const nextLabel = requestedLabel.trim();
      const elementKey = element.key ?? element.id;
      if (!nextLabel || nextLabel === element.label) return;
      if (element.timelineLocked) {
        showToast("Unlock this track before renaming its clip.", "info");
        return;
      }
      if (isRecordingRef?.current) {
        showToast("Cannot edit timeline while recording", "error");
        return;
      }

      const previousLabel = element.label;
      const liveElement = findTimelineElementInIframe(
        previewIframeRef.current,
        element,
        activeCompPath,
      );
      liveElement?.setAttribute("data-timeline-label", nextLabel);
      usePlayerStore.getState().updateElement(elementKey, { label: nextLabel });

      try {
        await enqueueEdit(element, `Rename ${previousLabel || element.id}`, (original, target) =>
          applyPatchByTarget(original, target, {
            type: "attribute",
            property: "timeline-label",
            value: nextLabel,
          }),
        );
      } catch (error) {
        if (previousLabel) liveElement?.setAttribute("data-timeline-label", previousLabel);
        else liveElement?.removeAttribute("data-timeline-label");
        usePlayerStore.getState().updateElement(elementKey, { label: previousLabel });
        showToast(getStudioSaveErrorMessage(error), "error");
      }
    },
    [activeCompPath, enqueueEdit, isRecordingRef, previewIframeRef, showToast],
  );

  const handleTimelineTrackRename = useCallback(
    async (elements: readonly TimelineElement[], requestedLabel: string) => {
      const owner = elements[0];
      const nextLabel = requestedLabel.trim();
      if (!owner || !nextLabel || nextLabel === owner.trackLabel) return;
      if (elements.some((element) => element.timelineLocked)) {
        showToast("Unlock this track before renaming it.", "info");
        return;
      }
      if (isRecordingRef?.current) {
        showToast("Cannot edit timeline while recording", "error");
        return;
      }

      const ownerKey = owner.key ?? owner.id;
      const previousLabel = owner.trackLabel;
      const liveElement = findTimelineElementInIframe(
        previewIframeRef.current,
        owner,
        activeCompPath,
      );
      liveElement?.setAttribute("data-timeline-track-label", nextLabel);
      usePlayerStore.getState().updateElement(ownerKey, { trackLabel: nextLabel });

      try {
        await enqueueEdit(owner, `Rename track to ${nextLabel}`, (original, target) =>
          applyPatchByTarget(original, target, {
            type: "attribute",
            property: "timeline-track-label",
            value: nextLabel,
          }),
        );
      } catch (error) {
        if (previousLabel) liveElement?.setAttribute("data-timeline-track-label", previousLabel);
        else liveElement?.removeAttribute("data-timeline-track-label");
        usePlayerStore.getState().updateElement(ownerKey, { trackLabel: previousLabel });
        showToast(getStudioSaveErrorMessage(error), "error");
      }
    },
    [activeCompPath, enqueueEdit, isRecordingRef, previewIframeRef, showToast],
  );

  const handleTimelineFrameAdd = useCallback(async () => {
    if (isRecordingRef?.current) {
      showToast("Cannot edit timeline while recording", "error");
      return;
    }
    const pid = projectIdRef.current;
    if (!pid) return;
    const targetPath = activeCompPath || "index.html";
    try {
      const originalContent = await readFileContent(pid, targetPath);
      const relevantElements = timelineElements.filter(
        (element) => (element.sourceFile || activeCompPath || "index.html") === targetPath,
      );
      const newTrack =
        Math.max(-1, ...relevantElements.map((element) => element.authoredTrack ?? element.track)) +
        1;
      const playerState = usePlayerStore.getState();
      const compositionDuration = Math.max(0, playerState.duration);
      const currentTime =
        compositionDuration > 0
          ? Math.min(Math.max(0, playerState.currentTime), Math.max(0, compositionDuration - 0.1))
          : Math.max(0, playerState.currentTime);
      const frameDuration =
        compositionDuration > 0 ? Math.max(0.1, Math.min(5, compositionDuration - currentTime)) : 5;
      const frameEnd = currentTime + frameDuration;
      const frameId = buildTimelineAssetId("frame", collectHtmlIds(originalContent));
      const frameName = `Frame ${newTrack + 1}`;
      const zIndex = Math.max(0, ...relevantElements.map((element) => element.zIndex ?? 0)) + 1;
      const frameHtml = `<div id="${frameId}" data-hf-id="hf-${generateId()}" class="clip" data-timeline-label="${frameName}" data-timeline-track-label="${frameName}" data-start="${formatTimelineAttributeNumber(currentTime)}" data-duration="${frameDuration}" data-track-index="${newTrack}" data-layout-ignore="" style="z-index: ${zIndex}"></div>`;
      const patchedContent = extendCompositionDurationIfNeeded(
        insertTimelineAssetIntoSource(originalContent, frameHtml),
        frameEnd,
      );

      domEditSaveTimestampRef.current = Date.now();
      await saveProjectFilesWithHistory({
        projectId: pid,
        label: "Add frame track",
        kind: "timeline",
        files: { [targetPath]: patchedContent },
        readFile: async () => originalContent,
        writeFile: writeProjectFile,
        recordEdit,
      });
      forceReloadSdkSession?.();
      reloadPreview();
      showToast(`Added ${frameName} at the playhead.`, "info");
    } catch (error) {
      showToast(getStudioSaveErrorMessage(error), "error");
    }
  }, [
    activeCompPath,
    domEditSaveTimestampRef,
    forceReloadSdkSession,
    isRecordingRef,
    projectIdRef,
    recordEdit,
    reloadPreview,
    showToast,
    timelineElements,
    writeProjectFile,
  ]);

  const handleTimelineElementDuplicate = useCallback(
    async (element: TimelineElement) => {
      if (element.timelineLocked) {
        showToast("Unlock this track before duplicating its clips.", "info");
        return;
      }
      if (isRecordingRef?.current) {
        showToast("Cannot edit timeline while recording", "error");
        return;
      }
      const pid = projectIdRef.current;
      if (!pid) throw new Error("No active project");

      const targetPath = element.sourceFile || activeCompPath || "index.html";
      const duplicateStart = element.start + element.duration;
      const duplicateEnd = duplicateStart + element.duration;
      const baseId = (element.domId || element.id || "clip").replace(/[^a-zA-Z0-9_-]+/g, "-");
      try {
        const originalContent = await readFileContent(pid, targetPath);
        const patchTarget = buildPatchTarget(element);
        if (!patchTarget) {
          throw new Error(`Timeline element ${element.id} is missing a patchable target`);
        }
        const response = await fetch(
          `/api/projects/${pid}/file-mutations/duplicate-element/${encodeURIComponent(targetPath)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...studioWriteHeaders() },
            body: JSON.stringify({
              target: patchTarget,
              newId: `${baseId}-copy`,
              duplicateStart,
              elementDuration: element.duration,
            }),
          },
        );
        if (!response.ok) throw new Error(`Failed to duplicate ${element.id}`);
        const data = (await response.json()) as { changed?: boolean; content?: string };
        if (!data.changed || typeof data.content !== "string") {
          throw new Error(`Could not find ${element.id} in ${targetPath}`);
        }

        const patchedContent = extendCompositionDurationIfNeeded(data.content, duplicateEnd);
        const rollbackDuration = captureDurationRollback(previewIframeRef.current);
        if (targetPath === (activeCompPath || "index.html"))
          extendRootDurationIfNeeded(duplicateEnd);
        domEditSaveTimestampRef.current = Date.now();
        try {
          await saveProjectFilesWithHistory({
            projectId: pid,
            label: "Duplicate timeline clip",
            kind: "timeline",
            files: { [targetPath]: patchedContent },
            readFile: async () => originalContent,
            diskContent: { [targetPath]: data.content },
            writeFile: writeProjectFile,
            recordEdit,
          });
        } catch (error) {
          rollbackDuration();
          throw error;
        }

        forceReloadSdkSession?.();
        reloadPreview();
        showToast(`Duplicated ${getTimelineElementLabel(element)}`, "info");
      } catch (error) {
        showToast(getStudioSaveErrorMessage(error), "error");
      }
    },
    [
      activeCompPath,
      domEditSaveTimestampRef,
      forceReloadSdkSession,
      isRecordingRef,
      previewIframeRef,
      projectIdRef,
      recordEdit,
      reloadPreview,
      showToast,
      writeProjectFile,
    ],
  );

  return {
    handleTimelineElementRename,
    handleTimelineTrackRename,
    handleTimelineFrameAdd,
    handleTimelineElementDuplicate,
  };
}
