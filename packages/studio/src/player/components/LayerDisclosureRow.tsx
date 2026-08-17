import { CaretRight, Waveform, X } from "@phosphor-icons/react";
import { useState } from "react";
import { TRACK_H } from "./timelineLayout";
import { TrackClipCount } from "./TrackClipCount";

// The first category button is Animation. Future sibling categories (Audio,
// Effects, etc.) can live beside it without mixing their controls into the row.
export function LayerDisclosureRow({
  name,
  clipCount,
  showAnimation,
  isAnimationExpanded,
  showAudio,
  isAudioExpanded,
  gutterBackground,
  columnWidth,
  animationLanesId,
  audioLanesId,
  onToggleAnimationExpanded,
  onToggleAudioExpanded,
  onRename,
  onDelete,
  deleteDisabled = false,
  children,
}: {
  /** What this row is called. The active clip's own name when it is alone on the
   *  track; the track itself once it holds several, since naming a shared row
   *  after one of its clips reads as if the rows under it were that clip's. */
  name: string;
  clipCount: number;
  showAnimation: boolean;
  isAnimationExpanded: boolean;
  showAudio: boolean;
  isAudioExpanded: boolean;
  gutterBackground: string;
  /** Same adaptive width the lane rows use: a narrowed header column must not
   *  leave this row hanging over the clips it labels. */
  columnWidth: number;
  /** Id of the CANVAS-side element holding the diamond lanes this row's caret
   *  expands (see TimelinePropertyLanes). The caret also reveals the per-lane
   *  control rows in this column, but the diamonds are what following the
   *  reference should land on. */
  animationLanesId: string;
  audioLanesId: string;
  onToggleAnimationExpanded: () => void;
  onToggleAudioExpanded: () => void;
  /** A single-clip row can persist a human label. Shared rows are generated
   *  track names and deliberately omit this callback. */
  onRename?: (name: string) => Promise<void> | void;
  /** Removes this source-backed track and every clip it contains. */
  onDelete?: () => Promise<void> | void;
  deleteDisabled?: boolean;
  /** Trailing controls that act on the LAYER (the visibility eye), not on a lane. */
  children?: React.ReactNode;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const commitName = () => {
    const nextName = draftName.trim();
    setEditingName(false);
    if (nextName && nextName !== name) void onRename?.(nextName);
    else setDraftName(name);
  };

  return (
    <div
      className="group/layer absolute left-0 top-0 flex items-center gap-1 overflow-hidden px-1.5 text-[11px]"
      style={{
        width: columnWidth,
        height: TRACK_H,
        color: "#ffffff",
        background: gutterBackground,
      }}
    >
      {editingName ? (
        <input
          autoFocus
          aria-label={`Rename ${name}`}
          data-timeline-track-name-input="true"
          className="h-6 min-w-0 flex-1 rounded border border-[#3CE6AC]/70 bg-black/55 px-1.5 text-[11px] font-medium text-white outline-none selection:bg-[#3CE6AC]/30"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commitName}
          onContextMenu={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitName();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraftName(name);
              setEditingName(false);
            }
          }}
        />
      ) : (
        <span
          data-timeline-track-name="true"
          className="min-w-0 flex-1 truncate font-medium"
          title={onRename ? `${name} · Right-click to rename` : name}
          onContextMenu={
            onRename
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDraftName(name);
                  setEditingName(true);
                }
              : undefined
          }
        >
          {name}
        </span>
      )}
      <TrackClipCount clipCount={clipCount} revealOnHover />
      {!editingName && onDelete ? (
        <button
          type="button"
          tabIndex={-1}
          disabled={deleteDisabled}
          aria-label={`Delete ${name} track`}
          title={deleteDisabled ? "Unlock this track before deleting it" : `Delete ${name} track`}
          data-timeline-delete-track="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/45 opacity-0 transition-[opacity,color,background-color,transform] duration-150 hover:bg-red-500/12 hover:text-red-300 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-red-300 group-hover/layer:opacity-100 active:scale-90 disabled:cursor-not-allowed disabled:text-white/20"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            void onDelete();
          }}
        >
          <X size={12} weight="bold" aria-hidden="true" />
        </button>
      ) : null}
      {showAnimation && (
        <CategoryDisclosureButton
          category="animation"
          name={name}
          expanded={isAnimationExpanded}
          controls={animationLanesId}
          onToggle={onToggleAnimationExpanded}
        >
          <span aria-hidden="true" className="leading-none">
            ◇
          </span>
        </CategoryDisclosureButton>
      )}
      {showAudio && (
        <CategoryDisclosureButton
          category="audio"
          name={name}
          expanded={isAudioExpanded}
          controls={audioLanesId}
          onToggle={onToggleAudioExpanded}
        >
          <Waveform size={14} weight="bold" aria-hidden="true" />
        </CategoryDisclosureButton>
      )}
      {children}
    </div>
  );
}

function CategoryDisclosureButton({
  category,
  name,
  expanded,
  controls,
  onToggle,
  children,
}: {
  category: "animation" | "audio";
  name: string;
  expanded: boolean;
  controls: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const noun = category === "audio" ? "audio controls" : "keyframes";
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${name} ${noun}`}
      title={`${expanded ? "Hide" : "Show"} ${category} controls`}
      data-timeline-control-category={category}
      className={`timeline-disclosure-button relative flex h-6 w-7 shrink-0 items-center justify-center rounded border border-white/10 p-0 text-[13px] transition-colors duration-150 active:scale-90 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3CE6AC] ${
        expanded
          ? "bg-[#3CE6AC]/12 text-[#3CE6AC]"
          : "bg-transparent text-white/45 hover:bg-white/[0.05] hover:text-white"
      }`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {children}
      <CaretRight
        size={7}
        weight="bold"
        aria-hidden="true"
        className="timeline-disclosure-caret absolute bottom-0.5 right-0.5"
        style={{ transform: expanded ? "rotate(90deg)" : undefined }}
      />
    </button>
  );
}
