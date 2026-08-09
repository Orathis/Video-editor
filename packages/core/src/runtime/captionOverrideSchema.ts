/**
 * Caption Overrides — the canonical schema.
 *
 * One contract for per-word caption styling, shared by every producer and runtime that has one:
 * Studio's Caption Designer, the HyperFrames runtime applier in `captionOverrides.ts`, and the
 * data-driven caption templates that render pacific's motion captions.
 *
 * ## Why four state paths rather than two colours
 *
 * The shipped `CaptionOverride` is two-state — `dimColor` before and after, `activeColor` while
 * spoken. That embeds losslessly into the four-path model below, and the reverse does not: nothing
 * two-state can express a tween whose ends differ, which the caption templates already render. So
 * the canonical model is the four-path one and the two-colour form stays as authoring shorthand.
 *
 * `active` is a TWEEN with two ends, which is why it nests `from`/`to` instead of being one bag of
 * channels. A constant is expressed as every state carrying the same value; there is deliberately
 * no "constant" slot, because one would have to be resolved against each state anyway.
 *
 * ## Units
 *
 * `translateX`/`translateY` are fractions of the HALF-frame from centre, NOT pixels: one draft
 * renders at several resolutions, and a stored pixel offset would mean a different distance in each.
 * This is the convention the ASS caption path already applies to the same field. `scale` is a
 * multiplier, `rotationDeg` is degrees, `opacity` is 0–1.
 *
 * ## Literals only
 *
 * Values here are literal and renderable. Brand roles, gradients, glows and any other producer-side
 * concept must be resolved before reaching this schema — a runtime has no brand kit to resolve
 * against, and a role name on the wire is a channel that silently does nothing.
 */

/**
 * Channels a TWEEN END may carry — things that can be interpolated frame by frame.
 *
 * Every channel optional; an absent channel means "leave it alone".
 */
export interface CaptionAnimatableChannels {
  color?: string;
  backgroundColor?: string;
  /** 0–1. */
  opacity?: number;
  /** Multiplier; 1 is unscaled. */
  scale?: number;
  rotationDeg?: number;
  /** Fraction of the half-frame WIDTH from centre. Positive is right. */
  translateX?: number;
  /** Fraction of the half-frame HEIGHT from centre. Positive is DOWN. */
  translateY?: number;
  /** px. Typography is not resolution-scaled here; a renderer fits its own type. */
  fontSize?: number;
  /**
   * Multiplier on the rendered brightness; 1 is unchanged.
   *
   * Present because pacific's motion captions already carry it on both static states and tween
   * ends. Omitting it from the canonical set would not make it go away — it would strand every
   * draft that authored it, silently, which is the failure this schema exists to prevent.
   */
  brightness?: number;
}

/**
 * Channels that only make sense held CONSTANT for a whole state.
 *
 * Split out structurally rather than policed at runtime: a font family or style has no meaningful
 * midpoint, so a tween end that could carry one is a shape that invites nonsense and then needs a
 * check to reject it. pacific reached the same conclusion independently and enforces it the same
 * way — its `WordAnimatable` simply lacks these keys.
 *
 * `fontSize` is deliberately NOT here — it interpolates numerically and a runtime that owns its own
 * layout can animate it. But no caption template actually does: verified across all five
 * hand-authored identities and the generator master, `fontSize` never appears in a tween. The master
 * runs a fit-to-width pass per group, so an animated `fontSize` would fight the fitter with
 * evaluation-order-dependent results.
 *
 * That is the difference between SCHEMA-legal and IDENTITY-supported, and they are not the same
 * axis. A capability manifest needs to express "this channel is legal here and unsupported by this
 * identity" as a first-class state — otherwise the only way to say it is to omit the channel, which
 * reads as "does not exist" and strands anything that authored it.
 */
export interface CaptionStaticChannels {
  fontWeight?: number | string;
  fontFamily?: string;
  fontStyle?: "normal" | "italic";
}

/** One state's worth of styling: a static state may carry either kind. */
export interface CaptionChannels extends CaptionAnimatableChannels, CaptionStaticChannels {}

/**
 * `active` is a tween, so it carries both ends — and only animatable channels, by construction.
 *
 * Absent states are left to the composition.
 */
export interface CaptionWordStates {
  upcoming?: CaptionChannels;
  active?: { from?: CaptionAnimatableChannels; to?: CaptionAnimatableChannels };
  spoken?: CaptionChannels;
}

export interface CanonicalCaptionOverride {
  /** Element id of the word. Preferred anchor. */
  wordId?: string;
  /** Position in render order. Fallback when no id is available. */
  wordIndex?: number;
  states: CaptionWordStates;
}

/**
 * What a producer may hand in: the canonical form, the shipped two-colour shorthand, or both.
 *
 * Accepting the shorthand is not a migration step. Studio's Caption Designer is user-facing and
 * authors it today, so it stays a supported input.
 */
export interface LegacyCaptionOverride {
  wordId?: string;
  wordIndex?: number;
  /** px offset, converted to a fraction of the half-frame. */
  x?: number;
  /** px offset, converted to a fraction of the half-frame. */
  y?: number;
  scale?: number;
  /** degrees */
  rotation?: number;
  /** Colour while the word is being spoken. */
  activeColor?: string;
  /** Colour before and after the word is spoken. */
  dimColor?: string;
  opacity?: number;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  /** Canonical states, which win over any shorthand alongside them. */
  states?: CaptionWordStates;
}

export interface CaptionFrame {
  width: number;
  height: number;
}

const STATE_PATHS = ["upcoming", "active.from", "active.to", "spoken"] as const;

function writeChannel(
  states: CaptionWordStates,
  path: (typeof STATE_PATHS)[number],
  channels: CaptionChannels | CaptionAnimatableChannels,
): void {
  if (Object.keys(channels).length === 0) return;
  if (path === "upcoming" || path === "spoken") {
    states[path] = { ...states[path], ...channels };
    return;
  }
  const end = path === "active.from" ? "from" : "to";
  states.active = { ...states.active, [end]: { ...states.active?.[end], ...channels } };
}

function mergeStates(base: CaptionWordStates, over: CaptionWordStates): CaptionWordStates {
  const out: CaptionWordStates = { ...base };
  if (over.upcoming) out.upcoming = { ...base.upcoming, ...over.upcoming };
  if (over.spoken) out.spoken = { ...base.spoken, ...over.spoken };
  if (over.active) {
    out.active = {
      ...base.active,
      ...(over.active.from ? { from: { ...base.active?.from, ...over.active.from } } : {}),
      ...(over.active.to ? { to: { ...base.active?.to, ...over.active.to } } : {}),
    };
  }
  return out;
}

/** Shorthand channels that map straight across, with no unit change. */
const PASSTHROUGH_ANIMATABLE: ReadonlyArray<
  readonly [keyof LegacyCaptionOverride, keyof CaptionAnimatableChannels]
> = [
  ["scale", "scale"],
  ["rotation", "rotationDeg"],
  ["opacity", "opacity"],
  ["fontSize", "fontSize"],
] as const;

/** Shorthand channels that reach the static states only — see CaptionStaticChannels. */
const PASSTHROUGH_STATIC: ReadonlyArray<
  readonly [keyof LegacyCaptionOverride, keyof CaptionStaticChannels]
> = [
  ["fontWeight", "fontWeight"],
  ["fontFamily", "fontFamily"],
] as const;

/**
 * The channels the shorthand applies ONCE, statically.
 *
 * Every state then carries them, because the canonical model has no "constant" slot. Omitting
 * `spoken` instead would let the word revert the moment it is read -- the same trap that makes
 * hiding a word write opacity 0 to all four paths.
 */
function constantAnimatable(
  input: LegacyCaptionOverride,
  frame: CaptionFrame,
): CaptionAnimatableChannels {
  const out: Record<string, unknown> = {};
  for (const [from, to] of PASSTHROUGH_ANIMATABLE) {
    const value = input[from];
    if (value !== undefined) out[to] = value;
  }
  if (input.x !== undefined && frame.width > 0) out.translateX = input.x / (frame.width / 2);
  if (input.y !== undefined && frame.height > 0) out.translateY = input.y / (frame.height / 2);
  return out as CaptionAnimatableChannels;
}

/**
 * Static constants reach `upcoming` and `spoken` only.
 *
 * Writing a font family onto a tween end was always meaningless — the applier sets typography once,
 * statically — but the flat shape let it look intentional. Now it cannot be expressed.
 */
function constantStatic(input: LegacyCaptionOverride): CaptionStaticChannels {
  const out: Record<string, unknown> = {};
  for (const [from, to] of PASSTHROUGH_STATIC) {
    const value = input[from];
    if (value !== undefined) out[to] = value;
  }
  return out as CaptionStaticChannels;
}

/** Expand the two-colour shorthand: dim is worn before AND after, active is a tween's two ends. */
function writeShorthandColors(states: CaptionWordStates, input: LegacyCaptionOverride): void {
  if (input.dimColor) {
    writeChannel(states, "upcoming", { color: input.dimColor });
    writeChannel(states, "spoken", { color: input.dimColor });
  }
  if (input.activeColor) {
    writeChannel(states, "active.from", { color: input.activeColor });
    writeChannel(states, "active.to", { color: input.activeColor });
  }
}

/**
 * Lift any accepted override shape into the canonical one.
 *
 * Idempotent on canonical input, so a producer can emit canonical directly and a consumer can
 * normalize defensively without converting twice.
 */
export function normalizeCaptionOverride(
  input: LegacyCaptionOverride,
  frame: CaptionFrame,
): CanonicalCaptionOverride {
  const states: CaptionWordStates = {};
  const animatable = constantAnimatable(input, frame);
  for (const path of STATE_PATHS) writeChannel(states, path, animatable);
  const staticChannels = constantStatic(input);
  writeChannel(states, "upcoming", staticChannels);
  writeChannel(states, "spoken", staticChannels);
  writeShorthandColors(states, input);

  return {
    ...(input.wordId !== undefined ? { wordId: input.wordId } : {}),
    ...(input.wordIndex !== undefined ? { wordIndex: input.wordIndex } : {}),
    states: input.states ? mergeStates(states, input.states) : states,
  };
}
