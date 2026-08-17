import { AUTOMATION_LANE_H } from "./automationLaneHeight";
import type { TimelineDisclosurePhase } from "./useTimelineDisclosurePresence";

/** One Premiere-style audio envelope label in the sticky timeline gutter. */
export function AutomationLaneHeaderRow({
  target,
  label,
  name,
  param,
  top,
  isLastLane,
  gutterBackground,
  columnWidth,
  onRemove,
  disclosurePhase,
}: {
  target: string | null;
  label: string;
  name: string;
  param: string;
  top: number;
  isLastLane: boolean;
  gutterBackground: string;
  columnWidth: number;
  onRemove?: (target: string) => void;
  disclosurePhase: TimelineDisclosurePhase;
}) {
  return (
    <div
      data-automation-lane-label={label}
      data-timeline-lane-top={top}
      data-disclosure-phase={disclosurePhase}
      className="timeline-disclosure-item absolute left-0 flex items-center gap-1 overflow-hidden px-1.5 text-[10px] text-white/65"
      style={{
        top,
        width: columnWidth,
        height: AUTOMATION_LANE_H,
        background: gutterBackground,
        transitionDelay: disclosurePhase === "open" ? "54ms" : "0ms",
      }}
    >
      <span className="relative h-full w-3 shrink-0" aria-hidden="true">
        <span
          className="absolute left-1.5 top-0 w-px bg-white/15"
          style={{ height: isLastLane ? "50%" : "100%" }}
        />
        <span className="absolute left-1.5 top-1/2 h-px w-1.5 bg-white/15" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center leading-tight" title={label}>
        <span data-automation-lane-name="" className="truncate font-mono text-[9px] text-white/70">
          {name}
        </span>
        {param ? (
          <span
            data-automation-lane-param=""
            className="truncate font-mono text-[9px] text-white/40"
          >
            {param}
          </span>
        ) : null}
      </span>
      {onRemove && target !== null && (
        <button
          type="button"
          aria-label={`Remove ${label} automation`}
          title={`Remove ${label} automation`}
          className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-[11px] text-white/35 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3CE6AC]"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(target);
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
