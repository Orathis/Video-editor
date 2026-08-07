import { describe, expect, it } from "vitest";

import { normalizeCaptionOverride, type LegacyCaptionOverride } from "./captionOverrideSchema";

const FRAME = { width: 1920, height: 1080 };

describe("normalizeCaptionOverride", () => {
  it("keeps the word anchor as-is", () => {
    const out = normalizeCaptionOverride({ wordId: "w7", wordIndex: 3, dimColor: "#111" }, FRAME);
    expect(out.wordId).toBe("w7");
    expect(out.wordIndex).toBe(3);
  });

  it("expands the two-colour shorthand across the four state paths", () => {
    // The whole reason the canonical model is the four-path one: `dim` is what the word wears
    // before AND after it is spoken, and `active` is a tween with two ends. The shorthand cannot
    // express ends that differ, so it lifts into both.
    const out = normalizeCaptionOverride({ dimColor: "#111", activeColor: "#eee" }, FRAME);
    expect(out.states.upcoming?.color).toBe("#111");
    expect(out.states.spoken?.color).toBe("#111");
    expect(out.states.active?.from?.color).toBe("#eee");
    expect(out.states.active?.to?.color).toBe("#eee");
  });

  it("converts px offsets to fractions of the HALF-dimension", () => {
    // Legacy px is fixed-resolution. The canonical unit is a fraction of the half-dimension from
    // centre, so one stored value places identically at any resolution — the convention the ASS
    // path already applies to the same field.
    const out = normalizeCaptionOverride({ x: 480, y: -270 }, FRAME);
    expect(out.states.upcoming?.translateX).toBeCloseTo(0.5);
    expect(out.states.upcoming?.translateY).toBeCloseTo(-0.5);
  });

  it("writes constant channels to every state path", () => {
    // Legacy applies scale/rotation once, statically. The canonical model has no "constant" slot,
    // so a constant is every state carrying the same value — the same reason hiding a word writes
    // opacity 0 to all four paths rather than omitting `spoken`.
    const out = normalizeCaptionOverride({ scale: 1.5, rotation: 12, opacity: 0.4 }, FRAME);
    for (const channels of [
      out.states.upcoming,
      out.states.active?.from,
      out.states.active?.to,
      out.states.spoken,
    ]) {
      expect(channels?.scale).toBe(1.5);
      expect(channels?.rotationDeg).toBe(12);
      expect(channels?.opacity).toBe(0.4);
    }
  });

  it("carries typography through unchanged", () => {
    const out = normalizeCaptionOverride(
      { fontSize: 48, fontWeight: 700, fontFamily: "Inter" },
      FRAME,
    );
    expect(out.states.spoken?.fontSize).toBe(48);
    expect(out.states.spoken?.fontWeight).toBe(700);
    expect(out.states.spoken?.fontFamily).toBe("Inter");
  });

  it("omits a state entirely when nothing targets it", () => {
    // Omit, never empty: an absent state means "the composition's own styling", and an empty object
    // would claim an override that sets nothing.
    const out = normalizeCaptionOverride({ wordId: "w1" }, FRAME);
    expect(out.states).toEqual({});
  });

  it("passes a canonical override through untouched", () => {
    // Already-canonical input must be idempotent, so a producer can emit canonical directly and a
    // consumer can normalize defensively without double-converting.
    const canonical: LegacyCaptionOverride = {
      wordId: "w2",
      states: { active: { from: { scale: 1 }, to: { scale: 1.4 } } },
    };
    expect(normalizeCaptionOverride(canonical, FRAME).states).toEqual(canonical.states);
  });

  it("lets canonical states win over the shorthand when both are present", () => {
    const out = normalizeCaptionOverride(
      { dimColor: "#111", states: { upcoming: { color: "#abc" } } },
      FRAME,
    );
    expect(out.states.upcoming?.color).toBe("#abc");
  });
});
