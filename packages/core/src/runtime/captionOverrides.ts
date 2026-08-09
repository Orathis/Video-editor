/**
 * Caption Overrides — applies per-word style overrides from a JSON data file.
 *
 * Input is lifted to the canonical schema (`captionOverrideSchema.ts`) first, so the shipped
 * two-colour shorthand and the four-path canonical form take exactly the same path here. Studio's
 * Caption Designer authors the shorthand and is user-facing, so it stays a supported input forever.
 *
 * ## THIS APPLIER IS ATTACH-TIME ONLY
 *
 * It mutates `tween.vars` in place and does NOT re-initialise the timeline. That is correct only
 * because it runs once, at attach, before anything has rendered. **Mutating `vars` after a tween has
 * rendered is silently ignored** — GSAP resolves its property list at init, so a late edit renders
 * the stale value with no error. Recovering needs `invalidate()` → `seek(0)` → `seek(t)`; and the
 * incomplete version of that (invalidate with no reseek) works under a running ticker while failing
 * on a paused, seek-driven timeline — i.e. it passes exactly the manual check a developer runs.
 *
 * So: if live editing ever calls this after first render, this contract has to change with it.
 * Do not add an edit path without the reseek. Measured; see the vault page
 * `gsap-keyframe-tween-mutation-protocol`.
 *
 * ## Two application strategies, and why the weaker one survives
 *
 * Where the composition DECLARES which caption state a tween belongs to, overrides are written into
 * that tween — exact, and the only way to express a channel that differs between `active.from` and
 * `active.to`. Where nothing is declared, the override is applied once, statically, via an
 * inline-block wrapper (transforms) and `gsap.set` (everything else). Every shipped composition is
 * currently undeclared, so the static path is not a fallback in name only.
 *
 * Matching (in priority order):
 * 1. `wordId` — matches by element ID (document.getElementById)
 * 2. `wordIndex` — fallback, DOM traversal order across .caption-group > span
 */

import {
  normalizeCaptionOverride,
  type CaptionAnimatableChannels,
  type CaptionChannels,
  type CaptionFrame,
  type CaptionWordStates,
  type LegacyCaptionOverride,
} from "./captionOverrideSchema";

interface GsapTween {
  vars: Record<string, unknown>;
  startTime(): number;
}

interface GsapStatic {
  set: (target: Element, vars: Record<string, unknown>) => void;
  killTweensOf: (target: Element, props: string) => void;
  getTweensOf: (target: Element) => GsapTween[];
}

/**
 * The caption state a composition DECLARES for a tween, if any.
 *
 * Authored as `data: { captionState: … }` in the tween's vars. GSAP passes unknown vars through
 * untouched, so this costs a declaring composition nothing at runtime.
 *
 * `"dim"` is the original two-state spelling and stays supported: it means the tween carries the
 * look worn BOTH before and after the word is spoken. `"upcoming"` and `"spoken"` are its two halves
 * for a composition that distinguishes them.
 *
 * It exists because the fallback below has to GUESS. Classifying by colour equality breaks outright
 * when a composition's two states share a colour: every tween matches the dim baseline, and the
 * active override is silently dropped.
 */
type DeclaredState = "dim" | "upcoming" | "active" | "spoken";

const DECLARED_STATES: readonly DeclaredState[] = ["dim", "upcoming", "active", "spoken"];

function declaredCaptionState(tween: GsapTween): DeclaredState | undefined {
  const data = tween.vars.data as { captionState?: unknown } | undefined;
  const state = data?.captionState;
  return DECLARED_STATES.includes(state as DeclaredState) ? (state as DeclaredState) : undefined;
}

/**
 * The composition's DECLARED stage size, never a measured rect.
 *
 * Canonical `translateX`/`translateY` are fractions of the half-frame, so the frame has to be the
 * size the composition was authored against — a `getBoundingClientRect` of a scaled preview would
 * silently place words at the wrong distance, which is the exact failure the fractional convention
 * exists to prevent. Same attributes and same 1920x1080 fallback as `timeline.ts`.
 *
 * The fallback cannot corrupt legacy input: px offsets are divided by this frame on the way in and
 * multiplied by the SAME frame on the way out, so they round-trip exactly whatever it says. It only
 * has to be truthful for canonical fractions, which are authored against a real composition.
 */
function readCaptionFrame(): CaptionFrame {
  const root = document.querySelector("[data-composition-id]");
  const width = Number(root?.getAttribute("data-width"));
  const height = Number(root?.getAttribute("data-height"));
  return {
    width: Number.isFinite(width) && width > 0 ? width : 1920,
    height: Number.isFinite(height) && height > 0 ? height : 1080,
  };
}

function resolveCaptionWordElement(el: Element | null): HTMLElement | null {
  if (!(el instanceof HTMLElement)) return null;
  if (el.dataset.captionWrapper !== "true") return el;

  const inner = el.querySelector<HTMLElement>(":scope > span");
  return inner ?? null;
}

function getCaptionWordElements(): HTMLElement[] {
  const wordEls: HTMLElement[] = [];
  const groups = document.querySelectorAll(".caption-group");

  for (const group of groups) {
    for (const child of group.children) {
      if (!(child instanceof HTMLElement)) continue;

      const wordEl =
        child.dataset.captionWrapper === "true"
          ? child.querySelector<HTMLElement>(":scope > span")
          : child.tagName === "SPAN"
            ? child
            : null;

      if (wordEl) wordEls.push(wordEl);
    }
  }

  return wordEls;
}

function getOrCreateCaptionWrapper(el: HTMLElement): HTMLElement {
  const parent = el.parentElement;
  if (parent?.dataset.captionWrapper === "true") return parent;

  const wrapper = document.createElement("span");
  wrapper.style.display = "inline-block";
  wrapper.dataset.captionWrapper = "true";
  el.parentNode?.insertBefore(wrapper, el);
  wrapper.appendChild(el);
  return wrapper;
}

/**
 * The state whose values the STATIC path applies.
 *
 * A word rests in `upcoming` before anything animates, so that is what a one-shot apply should
 * paint. For the shorthand every state carries the same constant, which makes this a no-op choice
 * and keeps the shipped behaviour byte-identical.
 *
 * For canonical input richer than the static path can express — `upcoming` and `spoken` differing,
 * on a composition that declares nothing — this COLLAPSES to `upcoming` and the difference is lost.
 * That is a deliberate, documented flattening rather than a new inference: the alternative is
 * guessing a word's active window from tween start times, and this file's history is what guessing
 * costs.
 */
function restingChannels(states: CaptionWordStates): CaptionChannels {
  return states.upcoming ?? states.spoken ?? states.active?.to ?? {};
}

/** Canonical channel names → the GSAP vars the runtime actually writes. */
const TRANSFORM_KEYS: ReadonlyArray<readonly [keyof CaptionAnimatableChannels, string]> = [
  ["scale", "scale"],
  ["rotationDeg", "rotation"],
] as const;

/**
 * Style channels that copy across by name. `brightness` is absent deliberately: it is in the
 * canonical schema because pacific's templates render it, but expressing it in CSS means composing
 * a `filter` string, and this applier would be overwriting whatever filter the composition already
 * set. Templates own it.
 */
const STYLE_KEYS: ReadonlyArray<readonly [keyof CaptionChannels, string]> = [
  ["opacity", "opacity"],
  ["fontWeight", "fontWeight"],
  ["fontFamily", "fontFamily"],
  ["fontStyle", "fontStyle"],
  ["color", "color"],
  ["backgroundColor", "backgroundColor"],
] as const;

function copyKeys(
  channels: CaptionChannels,
  keys: ReadonlyArray<readonly [keyof CaptionChannels, string]>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [from, to] of keys) {
    const value = channels[from];
    if (value !== undefined) out[to] = value;
  }
  return out;
}

/** Fractions of the half-frame become px here, and nowhere else. */
function toTransformVars(channels: CaptionChannels, frame: CaptionFrame): Record<string, unknown> {
  const out = copyKeys(channels, TRANSFORM_KEYS);
  if (channels.translateX !== undefined) out.x = channels.translateX * (frame.width / 2);
  if (channels.translateY !== undefined) out.y = channels.translateY * (frame.height / 2);
  return out;
}

function toStyleVars(channels: CaptionChannels): Record<string, unknown> {
  const out = copyKeys(channels, STYLE_KEYS);
  if (channels.fontSize !== undefined) out.fontSize = `${channels.fontSize}px`;
  return out;
}

function toGsapVars(
  channels: CaptionChannels,
  frame: CaptionFrame,
): { transform: Record<string, unknown>; style: Record<string, unknown> } {
  return { transform: toTransformVars(channels, frame), style: toStyleVars(channels) };
}

/** Which canonical channels a tween declaring `state` should receive. */
function channelsForDeclaredState(
  states: CaptionWordStates,
  state: DeclaredState,
): { vars?: CaptionAnimatableChannels; startAt?: CaptionAnimatableChannels } {
  if (state === "active") {
    return { vars: states.active?.to, startAt: states.active?.from };
  }
  if (state === "upcoming") return { vars: states.upcoming };
  if (state === "spoken") return { vars: states.spoken };
  // "dim" is one tween standing for both static states; see restingChannels for the collapse rule.
  return { vars: states.upcoming ?? states.spoken };
}

/**
 * Write a state's channels into a declared tween.
 *
 * `active.to` is the tween's own vars; `active.from` is `vars.startAt`, which is where GSAP keeps a
 * `fromTo`'s starting values — verified against GSAP 3.14 rather than assumed.
 */
function writeIntoTween(tween: GsapTween, states: CaptionWordStates, frame: CaptionFrame): void {
  const state = declaredCaptionState(tween);
  if (!state) return;

  const { vars, startAt } = channelsForDeclaredState(states, state);
  if (vars) {
    const { transform, style } = toGsapVars(vars, frame);
    Object.assign(tween.vars, transform, style);
  }
  if (startAt) {
    const { transform, style } = toGsapVars(startAt, frame);
    const existing = (tween.vars.startAt as Record<string, unknown> | undefined) ?? {};
    tween.vars.startAt = { ...existing, ...transform, ...style };
  }
}

/**
 * Colour on an UNDECLARED composition, classified by colour equality.
 *
 * A guess, and the reason the declaration above exists: two states sharing a colour make every tween
 * look dim. The reference is drawn only from tweens the guess still applies to (a declared "dim" one
 * if present, else the first undeclared one) — deriving it from a tween declared "active" would
 * compare undeclared siblings against a colour that has explicitly said it is not the dim reference.
 */
/**
 * The colour every undeclared tween is compared against.
 *
 * Drawn only from tweens the guess still applies to — a declared "dim" one if present, else the
 * first undeclared one. Deriving it from a tween declared "active" would compare undeclared siblings
 * against a colour that has explicitly said it is not the dim reference.
 */
function resolveDimBaseline(colorTweens: GsapTween[]): string {
  const reference =
    colorTweens.find((tw) => declaredCaptionState(tw) === "dim") ??
    colorTweens.find((tw) => declaredCaptionState(tw) === undefined);
  return reference ? String(reference.vars.color) : "";
}

/**
 * The two colours the equality guess can work with, flattened out of the four-path model.
 *
 * This IS the lossy step: `upcoming` and `spoken` collapse to one, and the tween's two ends collapse
 * to one. Undeclared compositions cannot express more than that, which is the argument for
 * declaring.
 */
function stateColors(states: CaptionWordStates): { dim?: string; active?: string } {
  return {
    dim: (states.upcoming ?? states.spoken)?.color,
    active: (states.active?.to ?? states.active?.from)?.color,
  };
}

/** A declared tween was written exactly already, so the equality guess must leave it alone. */
function recolorUndeclaredTween(
  tween: GsapTween,
  dimBaseline: string,
  dimColor: string | undefined,
  activeColor: string | undefined,
): void {
  if (declaredCaptionState(tween)) return;
  const replacement = String(tween.vars.color) === dimBaseline ? dimColor : activeColor;
  if (replacement !== undefined) tween.vars.color = replacement;
}

function applyColorByEquality(gsap: GsapStatic, el: HTMLElement, states: CaptionWordStates): void {
  const { dim: dimColor, active: activeColor } = stateColors(states);
  if (!dimColor && !activeColor) return;

  const colorTweens = gsap
    .getTweensOf(el)
    .filter((tw) => tw.vars.color !== undefined)
    .sort((a, b) => a.startTime() - b.startTime());
  const dimBaseline = resolveDimBaseline(colorTweens);

  for (const tw of colorTweens) recolorUndeclaredTween(tw, dimBaseline, dimColor, activeColor);

  if (dimColor) gsap.set(el, { color: dimColor });
}

function applyOverride(
  gsap: GsapStatic,
  el: HTMLElement,
  states: CaptionWordStates,
  frame: CaptionFrame,
): void {
  const tweens = gsap.getTweensOf(el);
  for (const tw of tweens) writeIntoTween(tw, states, frame);

  applyColorByEquality(gsap, el, states);

  // Static path. Colour is excluded: it is owned by the tween paths above, and writing it here too
  // would paint over the composition's own animation on every undeclared word.
  const { transform, style } = toGsapVars(restingChannels(states), frame);
  delete style.color;

  if (Object.keys(style).length > 0) gsap.set(el, style);
  if (Object.keys(transform).length > 0) gsap.set(getOrCreateCaptionWrapper(el), transform);
}

/** `wordId` first, DOM order as the fallback — see the header. */
function resolveOverrideTarget(
  override: { wordId?: string; wordIndex?: number },
  wordEls: HTMLElement[],
): HTMLElement | null {
  if (override.wordId) {
    const byId = resolveCaptionWordElement(document.getElementById(override.wordId));
    if (byId) return byId;
  }
  if (override.wordIndex !== undefined) return wordEls[override.wordIndex] ?? null;
  return null;
}

export function applyCaptionOverrides(): void {
  const gsap = (window as unknown as { gsap?: GsapStatic }).gsap;
  if (!gsap) return;

  // Only fetch overrides if the composition has caption groups
  if (document.querySelectorAll(".caption-group").length === 0) return;

  fetch("caption-overrides.json")
    .then((r) => {
      if (!r.ok) return null;
      return r.json();
    })
    .then((data: LegacyCaptionOverride[] | null) => {
      if (!data || !Array.isArray(data) || data.length === 0) return;

      const frame = readCaptionFrame();
      // Build word element index for wordIndex fallback
      const wordEls = getCaptionWordElements();

      for (const input of data) {
        const override = normalizeCaptionOverride(input, frame);
        const el = resolveOverrideTarget(override, wordEls);
        if (el) applyOverride(gsap, el, override.states, frame);
      }
    })
    .catch(() => {});
}
