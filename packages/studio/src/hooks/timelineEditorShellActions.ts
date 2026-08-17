import type { useTimelineEditing } from "./useTimelineEditing";

export function getTimelineEditorShellActions(editing: ReturnType<typeof useTimelineEditing>) {
  return {
    handleTimelineElementDuplicate: editing.handleTimelineElementDuplicate,
    handleTimelineElementDelete: editing.handleTimelineElementDelete,
    handleTimelineFrameAdd: editing.handleTimelineFrameAdd,
    handleTimelineAssetDrop: editing.handleTimelineAssetDrop,
    handleTimelineCompositionDrop: editing.handleTimelineCompositionDrop,
    handleTimelineFileDrop: editing.handleTimelineFileDrop,
    handleTimelineElementMove: editing.handleTimelineElementMove,
    handleTimelineElementResize: editing.handleTimelineElementResize,
    handleTimelineGroupResize: editing.handleTimelineGroupResize,
    handleToggleTrackHidden: editing.handleToggleTrackHidden,
    handleToggleTrackLocked: editing.handleToggleTrackLocked,
    handleTimelineElementRename: editing.handleTimelineElementRename,
    handleTimelineTrackRename: editing.handleTimelineTrackRename,
    handleBlockedTimelineEdit: editing.handleBlockedTimelineEdit,
    handleTimelineElementSplit: editing.handleTimelineElementSplit,
    handleRazorSplit: editing.handleRazorSplit,
    handleRazorSplitAll: editing.handleRazorSplitAll,
  };
}
