import { FRAME_HEADING_RE, parseStoryboard, VOICEOVER_ALIASES } from "./parseStoryboard.js";
import type { FrameStatus, StoryboardGlobals } from "./types.js";

// Re-exported for back-compat: the canonical list now lives in parseStoryboard.ts.
export { VOICEOVER_ALIASES };

/**
 * Surgical writers for `STORYBOARD.md`.
 *
 * These update a single frame's metadata in place — preserving all other
 * content, formatting, comments, and non-frame sections — rather than
 * re-serializing the parsed manifest (which would be lossy). Used by the
 * storyboard frame-focus editor to persist `voiceover` / `status` edits.
 *
 * Frame detection and the voiceover aliases are imported from `parseStoryboard.ts`
 * so the read and write sides share one definition and can't drift.
 */

const HEADING_LEVEL_RE = /^(#{1,6})[ \t]+/;
/**
 * `- key:` prefix — captures the bullet, key, and `:`-separator (incl. surrounding
 * spaces) so the line can be rewritten as `<prefix><new value>`. Deliberately stops
 * at the separator and captures no value/EOL: the old value is overwritten wholesale,
 * so there's nothing to capture, and dropping the trailing `[ \t]*…(.*)$` removes the
 * overlapping-quantifier polynomial backtracking CodeQL flags (js/polynomial-redos).
 */
const META_LINE_RE = /^([ \t]*[-*][ \t]+)([A-Za-z_][\w-]*)([ \t]*:[ \t]*)/;
const GLOBAL_LINE_RE = /^([ \t]*)([A-Za-z_][\w-]*)([ \t]*:[ \t]*)/;

interface FrameBounds {
  /** 0-based line index of the frame heading. */
  start: number;
  /** 0-based line index just past the frame's content (exclusive). */
  end: number;
  /** Heading depth (`#` count) that opened the frame. */
  level: number;
}

/** Locate every frame's line range, using the same boundary rules as the parser. */
// fallow-ignore-next-line complexity
function frameBounds(lines: string[]): FrameBounds[] {
  const bounds: FrameBounds[] = [];
  let current: FrameBounds | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const frameMatch = FRAME_HEADING_RE.exec(line);
    if (frameMatch) {
      if (current) current.end = i;
      current = { start: i, end: lines.length, level: (frameMatch[1] ?? "##").length };
      bounds.push(current);
      continue;
    }
    const heading = HEADING_LEVEL_RE.exec(line);
    if (current && heading && (heading[1] ?? "").length <= current.level) {
      current.end = i;
      current = null;
    }
  }
  return bounds;
}

function formatValue(value: string, quote: boolean): string {
  // Metadata is a single line: collapse every whitespace run (incl. newlines from a
  // multi-line textarea) to one space so the value can't split the `- key:` line and
  // corrupt the file. A single linear `\s+` avoids the `\s*\r?\n\s*` polynomial
  // backtracking CodeQL flags (js/polynomial-redos) on long all-space input.
  const clean = value.replace(/\s+/g, " ").trim();
  // Always wrap when quoting. The parser's stripQuotes removes exactly one outer
  // pair, so wrapping round-trips losslessly even for empty values or values that
  // themselves contain quotes (`"foo"` → `""foo""` → parses back to `"foo"`).
  return quote ? `"${clean}"` : clean;
}

/**
 * Set (or insert) a metadata field on the frame at `frameIndex` (1-based).
 * Replaces an existing `- key: …` line (matching any alias) in place; otherwise
 * inserts a new line right after the frame heading.
 *
 * Throws when the frame doesn't exist, so a stale/raced index (e.g. the frame
 * was deleted on disk after render) surfaces as an error instead of a silent
 * no-op the UI would report as a successful save.
 */
export function setFrameField(
  source: string,
  frameIndex: number,
  key: string,
  value: string,
  opts: { aliases?: readonly string[]; quote?: boolean } = {},
): string {
  const lines = source.split(/\r?\n/);
  const target = frameBounds(lines)[frameIndex - 1];
  if (!target) throw new Error(`storyboard frame ${frameIndex} not found`);

  const aliases = new Set([key, ...(opts.aliases ?? [])].map((k) => k.toLowerCase()));
  const formatted = formatValue(value, opts.quote ?? false);

  for (let i = target.start + 1; i < target.end; i++) {
    const match = META_LINE_RE.exec(lines[i] ?? "");
    if (match && aliases.has((match[2] ?? "").toLowerCase())) {
      lines[i] = `${match[1]}${match[2]}${match[3]}${formatted}`;
      return lines.join("\n");
    }
  }

  lines.splice(target.start + 1, 0, `- ${key}: ${formatted}`);
  return lines.join("\n");
}

/** Set the voiceover (guide) line for a frame, matching any voiceover alias. */
export function setFrameVoiceover(source: string, frameIndex: number, value: string): string {
  return setFrameField(source, frameIndex, "voiceover", value, {
    aliases: VOICEOVER_ALIASES,
    quote: true,
  });
}

/** Set the lifecycle status for a frame. */
export function setFrameStatus(source: string, frameIndex: number, status: FrameStatus): string {
  return setFrameField(source, frameIndex, "status", status);
}

/** Set a frame duration in seconds, normalized for storyboard markdown. */
export function setFrameDuration(source: string, frameIndex: number, seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("frame duration must be greater than zero");
  }
  const normalized = Number(seconds.toFixed(6));
  return setFrameField(source, frameIndex, "duration", `${normalized}s`);
}

/** Set the authored transition into a frame. */
export function setFrameTransition(source: string, frameIndex: number, transition: string): string {
  const normalized = transition.trim();
  if (!normalized) throw new Error("frame transition cannot be empty");
  return setFrameField(source, frameIndex, "transition_in", normalized);
}

/** Attach a project-relative reference image to a storyboard frame. */
export function setFrameImage(source: string, frameIndex: number, imagePath: string): string {
  const normalized = imagePath.trim();
  if (!normalized) throw new Error("frame image path cannot be empty");
  return setFrameField(source, frameIndex, "image", normalized);
}

export function setStoryboardGlobalField(source: string, key: string, value: string): string {
  const lines = source.split(/\r?\n/);
  let opening = 0;
  while (opening < lines.length && (lines[opening] ?? "").trim() === "") opening += 1;

  if ((lines[opening] ?? "").trim() !== "---") {
    const frontmatter = ["---", `${key}: ${value}`, "---"].join("\n");
    return source.length > 0 ? `${frontmatter}\n\n${source}` : `${frontmatter}\n`;
  }

  let closing = -1;
  for (let i = opening + 1; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() === "---") {
      closing = i;
      break;
    }
  }
  if (closing < 0) throw new Error("storyboard frontmatter is not closed");

  for (let i = opening + 1; i < closing; i++) {
    const match = GLOBAL_LINE_RE.exec(lines[i] ?? "");
    if (match && (match[2] ?? "").toLowerCase() === key.toLowerCase()) {
      lines[i] = `${match[1]}${match[2]}${match[3]}${value}`;
      return lines.join("\n");
    }
  }

  lines.splice(closing, 0, `${key}: ${value}`);
  return lines.join("\n");
}

/** Apply structured relationship metadata without re-serializing frame content. */
export function setStoryboardRelationship(
  source: string,
  metadata: Pick<
    StoryboardGlobals,
    | "kind"
    | "groupId"
    | "templateId"
    | "templateRevision"
    | "compositionPath"
    | "analysisId"
    | "referenceAsset"
    | "sourceUrl"
    | "targetProfile"
  >,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["kind", metadata.kind],
    ["group_id", metadata.groupId],
    ["template_id", metadata.templateId],
    ["template_revision", metadata.templateRevision],
    ["composition_path", metadata.compositionPath],
    ["analysis_id", metadata.analysisId],
    ["reference_asset", metadata.referenceAsset],
    ["source_url", metadata.sourceUrl],
    ["target_profile", metadata.targetProfile],
  ];
  let next = source;
  for (const [key, value] of entries) {
    if (value === undefined || value === "") continue;
    next = setStoryboardGlobalField(next, key, formatValue(String(value), true));
  }
  return next;
}

/** Set the short Studio tab label in storyboard frontmatter. */
export function setStoryboardTitle(source: string, title: string): string {
  const normalized = formatValue(title, true);
  if (normalized === '""') throw new Error("storyboard title cannot be empty");
  return setStoryboardGlobalField(source, "title", normalized);
}

/** Mark a storyboard as archived or active without moving or deleting its source file. */
export function setStoryboardArchived(source: string, archived: boolean): string {
  return setStoryboardGlobalField(source, "archived", String(archived));
}

/** Append a new source-backed outline frame and return the updated markdown. */
export function appendStoryboardFrame(source: string): string {
  const frames = parseStoryboard(source).frames;
  let nextNumber = 1;
  for (const frame of frames) {
    nextNumber = Math.max(nextNumber, (frame.number ?? frame.index) + 1);
  }

  const fileNumber = String(nextNumber).padStart(2, "0");
  const block = [
    `## Frame ${nextNumber} — New frame`,
    "- duration: 4s",
    "- transition_in: crossfade",
    "- status: outline",
    `- src: compositions/frames/${fileNumber}-new-frame.html`,
  ].join("\n");
  const prefix = source.replace(/(?:\r?\n)+$/, "");
  return prefix.length > 0 ? `${prefix}\n\n${block}\n` : `${block}\n`;
}

/** Remove a source-backed frame and renumber the remaining frame headings. */
export function removeStoryboardFrame(source: string, frameIndex: number): string {
  const lines = source.split(/\r?\n/);
  const bounds = frameBounds(lines);
  if (bounds.length <= 1) throw new Error("a storyboard must keep at least one frame");
  const target = bounds[frameIndex - 1];
  if (!target) throw new Error(`storyboard frame ${frameIndex} not found`);

  lines.splice(target.start, target.end - target.start);
  const remaining = frameBounds(lines);
  for (const [index, frame] of remaining.entries()) {
    const heading = lines[frame.start] ?? "";
    const match = /^((?:#{2,3})[ \t]+(?:frame|beat|scene)\b)(.*)$/i.exec(heading);
    if (!match) continue;
    const title = (match[2] ?? "")
      .replace(/^[\s.:—-]*\d+(?:\.\d+)?/, "")
      .replace(/^[\s.:—-]+/, "")
      .trim();
    lines[frame.start] = `${match[1]} ${index + 1}${title ? ` — ${title}` : ""}`;
  }
  return lines.join("\n");
}
