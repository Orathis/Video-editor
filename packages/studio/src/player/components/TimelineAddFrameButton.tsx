import { Plus } from "@phosphor-icons/react";

export function TimelineAddFrameButton({ onAddFrameTrack }: { onAddFrameTrack?: () => void }) {
  if (!onAddFrameTrack) return null;
  return (
    <button
      type="button"
      aria-label="Add frame track at playhead"
      title="Add frame track at playhead"
      data-timeline-add-frame="true"
      className="absolute left-2 top-1 z-30 flex h-6 items-center justify-center gap-1 rounded border border-white/10 bg-[#111318]/95 px-2 text-[10px] font-medium text-white/55 shadow-sm transition-[color,background-color,transform] duration-150 hover:bg-[#3CE6AC]/12 hover:text-[#3CE6AC] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3CE6AC] active:scale-95"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onAddFrameTrack();
      }}
    >
      <Plus size={14} weight="bold" aria-hidden="true" />
      <span>Frame</span>
    </button>
  );
}
