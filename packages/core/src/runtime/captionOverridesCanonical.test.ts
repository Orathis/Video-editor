// @vitest-environment jsdom
//
// The canonical four-path behaviour of the applier. Kept separate from captionOverrides.test.ts so
// that file stays byte-unmodified: those 9 tests cover the shipped two-colour shorthand that
// Studio's Caption Designer authors, and their passing untouched is the back-compat evidence.
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyCaptionOverrides } from "./captionOverrides";

interface Env {
  /** Tween vars objects, mutated in place by the applier — assert against these directly. */
  tweens: Array<Record<string, unknown>>;
  setCalls: Array<{ target: Element; vars: Record<string, unknown> }>;
}

/**
 * One setup call: DOM, fetch stub and gsap mock together.
 *
 * Deliberately a single entry point rather than the three separate installers the sibling test file
 * uses — this one has to hand back both the tween vars and the set calls, and splitting it produced
 * a near-identical copy of that file's mock.
 */
function install(opts: {
  overrides: unknown[];
  tweens?: Array<Record<string, unknown>>;
  frame?: { width: number; height: number };
}): Env {
  const tweens = opts.tweens ?? [];
  const setCalls: Env["setCalls"] = [];

  const word = `<div class="caption-group"><span id="w0">Hello</span></div>`;
  document.body.innerHTML = opts.frame
    ? `<div data-composition-id="c" data-width="${opts.frame.width}" data-height="${opts.frame.height}">${word}</div>`
    : word;

  vi.stubGlobal("fetch", async () => ({
    ok: true,
    async json() {
      return opts.overrides;
    },
  }));
  Object.defineProperty(window, "gsap", {
    configurable: true,
    value: {
      set: (target: Element, vars: Record<string, unknown>) => void setCalls.push({ target, vars }),
      killTweensOf: () => {},
      getTweensOf: () => tweens.map((vars, i) => ({ vars, startTime: () => i })),
    },
  });

  return { tweens, setCalls };
}

async function flush() {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  Reflect.deleteProperty(window, "gsap");
});

describe("applyCaptionOverrides — canonical four-path states", () => {
  it("writes active.to into the tween's vars and active.from into vars.startAt", async () => {
    // The whole reason the canonical model exists: a channel whose two ends DIFFER. The two-colour
    // shorthand cannot express this at all, so this is the assertion that fails against an applier
    // that only understands dimColor/activeColor.
    const active = { color: "#000", data: { captionState: "active" } };
    install({
      tweens: [active],
      overrides: [
        {
          wordId: "w0",
          states: {
            active: { from: { color: "#111", scale: 1 }, to: { color: "#eee", scale: 1.4 } },
          },
        },
      ],
    });

    applyCaptionOverrides();
    await flush();

    expect(active.color).toBe("#eee");
    expect((active as Record<string, unknown>).scale).toBe(1.4);
    const startAt = (active as Record<string, unknown>).startAt as Record<string, unknown>;
    expect(startAt.color).toBe("#111");
    expect(startAt.scale).toBe(1);
  });

  it("keeps upcoming and spoken distinct when the composition declares both", async () => {
    // Undeclared compositions collapse these two (see restingChannels); a DECLARING one must not.
    const upcoming = { color: "#000", data: { captionState: "upcoming" } };
    const spoken = { color: "#000", data: { captionState: "spoken" } };
    install({
      tweens: [upcoming, spoken],
      overrides: [
        { wordId: "w0", states: { upcoming: { color: "#aaa" }, spoken: { color: "#333" } } },
      ],
    });

    applyCaptionOverrides();
    await flush();

    expect(upcoming.color).toBe("#aaa");
    expect(spoken.color).toBe("#333");
  });

  it("treats a declared `dim` tween as both static states", async () => {
    // "dim" is the original two-state spelling and stays supported.
    const dim = { color: "#000", data: { captionState: "dim" } };
    install({
      tweens: [dim],
      overrides: [{ wordId: "w0", states: { upcoming: { color: "#abc" } } }],
    });

    applyCaptionOverrides();
    await flush();

    expect(dim.color).toBe("#abc");
  });

  it("leaves declared tweens out of the colour-equality guess", async () => {
    // The guess is for undeclared compositions only. A declared tween that happens to share the dim
    // colour must not be reclassified by equality after it was written exactly.
    const declaredActive = { color: "#000", data: { captionState: "active" } };
    const undeclared = { color: "#000" };
    install({
      tweens: [declaredActive, undeclared],
      overrides: [
        {
          wordId: "w0",
          states: { upcoming: { color: "#dim" }, active: { to: { color: "#act" } } },
        },
      ],
    });

    applyCaptionOverrides();
    await flush();

    expect(declaredActive.color).toBe("#act");
    // The undeclared one matched the dim baseline (itself), so it takes the dim colour.
    expect(undeclared.color).toBe("#dim");
  });

  it("resolves canonical translate fractions against the composition's DECLARED frame", async () => {
    // Fractions of the half-frame: 0.25 of a 1000px half-width is 250px. A measured rect of a scaled
    // preview would give a different number, which is the failure the convention exists to prevent.
    const { setCalls } = install({
      overrides: [{ wordId: "w0", states: { upcoming: { translateX: 0.25, translateY: -0.5 } } }],
      frame: { width: 2000, height: 1000 },
    });

    applyCaptionOverrides();
    await flush();

    const wrapperSet = setCalls.find((c) => "x" in c.vars);
    expect(wrapperSet?.vars.x).toBeCloseTo(250);
    expect(wrapperSet?.vars.y).toBeCloseTo(-250);
  });

  it("paints the resting colour exactly once, not once per application path", async () => {
    // The shipped applier sets the dim colour immediately so an override is visible before any tween
    // runs; that behaviour is deliberate and preserved. What must NOT happen is the generic static
    // path painting it a second time — colour is owned by the colour path, and a duplicate write
    // here is how a future channel starts fighting the composition's own animation.
    const { setCalls } = install({
      overrides: [{ wordId: "w0", states: { upcoming: { color: "#abc", scale: 2 } } }],
    });

    applyCaptionOverrides();
    await flush();

    const colourWrites = setCalls.filter((c) => c.vars.color !== undefined);
    expect(colourWrites).toHaveLength(1);
    expect(colourWrites[0]?.vars.color).toBe("#abc");
    expect(setCalls.some((c) => c.vars.scale === 2)).toBe(true);
  });
});
