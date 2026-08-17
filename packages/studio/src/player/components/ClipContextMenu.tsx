import { memo } from "react";
import { createPortal } from "react-dom";
import type { TimelineElement } from "../store/playerStore";
import { canSplitElement } from "../../utils/timelineElementSplit";
import { useContextMenuDismiss } from "../../hooks/useContextMenuDismiss";

interface ClipContextMenuProps {
  x: number;
  y: number;
  element: TimelineElement;
  currentTime: number;
  onClose: () => void;
  onSplit: (element: TimelineElement, splitTime: number) => void;
  onDuplicate: (element: TimelineElement) => void;
  onDelete: (element: TimelineElement) => void;
}

export const ClipContextMenu = memo(function ClipContextMenu({
  x,
  y,
  element,
  currentTime,
  onClose,
  onSplit,
  onDuplicate,
  onDelete,
}: ClipContextMenuProps) {
  const menuRef = useContextMenuDismiss(onClose);
  const locked = element.timelineLocked === true;

  const isSplittable = canSplitElement(element) && ["video", "audio", "img"].includes(element.tag);
  const canSplit =
    isSplittable && currentTime > element.start && currentTime < element.start + element.duration;

  const splitLabel = !isSplittable
    ? null
    : canSplit
      ? `Split at ${currentTime.toFixed(2)}s`
      : "Split (move playhead inside clip)";
  const menuWidth = 200;
  const menuHeight = 80 + (splitLabel ? 40 : 0);
  const overflowY = y + menuHeight - window.innerHeight;
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const adjustedY = overflowY > 0 ? y - overflowY - 8 : y;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg py-1 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {splitLabel && (
        <>
          <button
            type="button"
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left ${
              canSplit
                ? "text-neutral-300 hover:bg-neutral-800 cursor-pointer"
                : "text-neutral-600 cursor-not-allowed"
            }`}
            disabled={!canSplit}
            onClick={() => {
              if (canSplit) {
                onSplit(element, currentTime);
                onClose();
              }
            }}
          >
            <span>{splitLabel}</span>
            <span className="text-neutral-500 text-[10px] ml-3">S</span>
          </button>
          <div className="my-1 border-t border-neutral-700/60" />
        </>
      )}

      <button
        type="button"
        disabled={locked}
        title={locked ? "Unlock the track to duplicate this clip" : undefined}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left ${
          locked
            ? "text-neutral-600 cursor-not-allowed"
            : "text-neutral-300 hover:bg-neutral-800 cursor-pointer"
        }`}
        onClick={() => {
          onDuplicate(element);
          onClose();
        }}
      >
        <span>Duplicate</span>
      </button>

      <button
        type="button"
        disabled={locked}
        title={locked ? "Unlock the track to delete this clip" : undefined}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left ${
          locked
            ? "text-neutral-600 cursor-not-allowed"
            : "text-red-400 hover:bg-neutral-800 cursor-pointer"
        }`}
        onClick={() => {
          onDelete(element);
          onClose();
        }}
      >
        <span>Delete</span>
        <span className="text-neutral-500 text-[10px] ml-3">⌫</span>
      </button>
    </div>,
    document.body,
  );
});
