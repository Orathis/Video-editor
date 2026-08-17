/**
 * How many clips the track holds, shown next to the track's identity so a
 * multi-clip track reads as one at a glance. A single-clip track shows nothing:
 * the clip bar already says "one", and the header stays low-density.
 */
export function TrackClipCount({
  clipCount,
  revealOnHover = false,
}: {
  clipCount: number;
  revealOnHover?: boolean;
}) {
  if (clipCount < 2) return null;
  return (
    <span
      aria-label={`${clipCount} clips`}
      title={`${clipCount} clips`}
      className={`shrink-0 overflow-hidden rounded-full bg-white/10 px-1 text-[9px] leading-[14px] tabular-nums text-white/55 transition-[max-width,opacity] duration-150 ease-out ${
        revealOnHover
          ? "max-w-0 opacity-0 group-hover/layer:max-w-8 group-hover/layer:opacity-100 group-focus-within/layer:max-w-8 group-focus-within/layer:opacity-100"
          : "max-w-8 opacity-100"
      }`}
    >
      {clipCount}
    </span>
  );
}
