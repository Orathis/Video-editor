// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  createTimelineElementFromManifestClip,
  parseTimelineFromDOM,
  createImplicitTimelineLayersFromDOM,
  mergeTimelineElementsPreservingDowngrades,
  createTimelineDomIndex,
  findTimelineDomNodeForClip,
  type TimelineDomIndex,
} from "./timelineDOM";
import type { TimelineElement } from "../store/playerStore";
import type { ClipManifestClip } from "./playbackTypes";
import { generateStudioLoadFixture } from "../../../tests/e2e/generateStudioLoadFixture.mjs";

function el(id: string, extra: Partial<TimelineElement> = {}): TimelineElement {
  return { id, tag: "img", start: 0, duration: 5, track: 0, ...extra };
}

function makeDoc(html: string): Document {
  const d = document.implementation.createHTMLDocument();
  d.body.innerHTML = html;
  return d;
}

function manifestClip(element: Element, index: number): ClipManifestClip {
  const compositionId = element.getAttribute("data-composition-id");
  return {
    id: element.id || element.getAttribute("data-hf-id"),
    label: `Clip ${index}`,
    start: Number(element.getAttribute("data-start")),
    duration: Number(element.getAttribute("data-duration")),
    track: Number(element.getAttribute("data-track-index")),
    kind: compositionId ? "composition" : "element",
    tagName: element.tagName.toLowerCase(),
    compositionId,
    parentCompositionId: null,
    compositionSrc: null,
    assetUrl: null,
  };
}

/**
 * The whole per-clip derivation, exactly as processTimelineMessage runs it.
 * Async only so the un-indexed arm — which is quadratic by construction, ~80s
 * at 3,000 clips under jsdom — yields often enough to keep vitest's worker RPC
 * heartbeat alive; a fully synchronous run makes the suite exit non-zero.
 */
async function deriveManifestElements(
  doc: Document,
  clips: readonly ClipManifestClip[],
  index?: TimelineDomIndex,
): Promise<TimelineElement[]> {
  const used = new Set<Element>();
  const elements: TimelineElement[] = [];
  for (const [fallbackIndex, clip] of clips.entries()) {
    const hostEl = findTimelineDomNodeForClip(doc, clip, fallbackIndex, used, index);
    if (hostEl) used.add(hostEl);
    elements.push(
      createTimelineElementFromManifestClip({ clip, fallbackIndex, doc, hostEl, index }),
    );
    if (fallbackIndex % 100 === 99) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return elements;
}

describe("parseTimelineFromDOM — hfId from data-hf-id", () => {
  it("harvests hfId from a data-start element that has data-hf-id", () => {
    const doc = makeDoc(`
      <div data-composition-id="root">
        <div id="hero" class="clip" data-start="0" data-duration="5" data-hf-id="hf-abc123"></div>
      </div>
    `);

    const elements = parseTimelineFromDOM(doc, 10);
    const hero = elements.find((el) => el.domId === "hero");

    expect(hero).toBeDefined();
    expect(hero?.hfId).toBe("hf-abc123");
  });

  it("leaves hfId undefined when element has no data-hf-id", () => {
    const doc = makeDoc(`
      <div data-composition-id="root">
        <div id="plain" class="clip" data-start="0" data-duration="5"></div>
      </div>
    `);

    const elements = parseTimelineFromDOM(doc, 10);
    const plain = elements.find((el) => el.domId === "plain");

    expect(plain).toBeDefined();
    expect(plain?.hfId).toBeUndefined();
  });

  it("ignores runtime-owned color grading canvases with timing attributes", () => {
    const doc = makeDoc(`
      <div data-composition-id="root">
        <img id="photo" class="clip" data-start="0" data-duration="5" />
        <canvas
          class="__hf_color_grading_canvas__"
          data-hf-color-grading-canvas="true"
          data-hyperframes-ignore
          data-start="0"
          data-duration="5"
        ></canvas>
      </div>
    `);

    const elements = parseTimelineFromDOM(doc, 10);

    expect(elements.map((el) => el.tag)).toEqual(["img"]);
  });

  it("marks parsed timeline elements hidden when data-hidden is present", () => {
    const doc = makeDoc(`
      <div data-composition-id="root">
        <div id="hero" class="clip" data-start="0" data-duration="5" data-hidden></div>
      </div>
    `);

    const elements = parseTimelineFromDOM(doc, 10);
    const hero = elements.find((el) => el.domId === "hero");

    expect(hero?.hidden).toBe(true);
  });

  it("marks manifest timeline elements hidden when the host has data-hidden", () => {
    const doc = makeDoc(`
      <div data-composition-id="root">
        <div id="hero" class="clip" data-start="0" data-duration="5" data-hidden></div>
      </div>
    `);
    const hostEl = doc.getElementById("hero");

    const element = createTimelineElementFromManifestClip({
      clip: {
        id: "hero",
        label: "Hero",
        kind: "element",
        tagName: "div",
        start: 0,
        duration: 5,
        track: 0,
        compositionId: null,
        parentCompositionId: null,
        compositionSrc: null,
        assetUrl: null,
      },
      fallbackIndex: 0,
      doc,
      hostEl,
    });

    expect(element.hidden).toBe(true);
  });
});

describe("parseTimelineFromDOM — canonical playback rate", () => {
  it.each([
    ["10", 5],
    ["0.01", 0.1],
  ])("clamps authored rate %s to %s for trim and split math", (authored, expected) => {
    const doc = makeDoc(`
      <div data-composition-id="root">
        <div id="nested" class="clip" data-composition-src="scene.html"
          data-start="0" data-duration="5" data-playback-rate="${authored}"></div>
      </div>
    `);

    const nested = parseTimelineFromDOM(doc, 10).find((entry) => entry.domId === "nested");

    expect(nested?.playbackRate).toBe(expected);
  });
});

describe("createTimelineElementFromManifestClip — source-scoped selector identity", () => {
  it("preserves composition kind and source timing on first translation", () => {
    const doc = makeDoc(`
      <div data-composition-id="root" data-composition-file="index.html">
        <div id="host" data-composition-id="scene" data-composition-src="scene.html"
          data-playback-start="1.5" data-playback-rate="2"></div>
      </div>
    `);
    const host = doc.getElementById("host");

    const element = createTimelineElementFromManifestClip({
      clip: {
        id: "host",
        label: "Scene",
        kind: "composition",
        tagName: "div",
        start: 2,
        duration: 4,
        track: 0,
        compositionId: "scene",
        parentCompositionId: "root",
        compositionSrc: "scene.html",
        playbackStart: 1.5,
        playbackRate: 2,
        assetUrl: null,
      },
      fallbackIndex: 0,
      doc,
      hostEl: host,
    });

    expect(element).toMatchObject({
      kind: "composition",
      compositionSrc: "scene.html",
      playbackStart: 1.5,
      playbackStartAttr: "playback-start",
      playbackRate: 2,
      domId: "host",
    });
  });

  it("ignores an index.html duplicate when indexing a scene.html selector", () => {
    const doc = makeDoc(`
      <div data-composition-id="root" data-composition-file="index.html">
        <div class="sub"></div>
        <div data-composition-id="scene" data-composition-file="scene.html">
          <div class="sub"></div>
          <div class="sub" data-target></div>
        </div>
      </div>
    `);
    const target = doc.querySelector("[data-target]");
    if (!target) throw new Error("missing target");

    const element = createTimelineElementFromManifestClip({
      clip: {
        id: null,
        label: "Sub",
        kind: "element",
        tagName: "div",
        start: 0,
        duration: 5,
        track: 0,
        compositionId: null,
        parentCompositionId: null,
        compositionSrc: null,
        assetUrl: null,
      },
      fallbackIndex: 0,
      doc,
      hostEl: target,
    });

    expect(element.sourceFile).toBe("scene.html");
    expect(element.selectorIndex).toBe(1);
    expect(element.key).toBe("scene.html:.sub:1");
  });
});

describe("createTimelineElementFromManifestClip — indexed identity parity", () => {
  it("keeps every id and key byte-identical across the generated 3,000-clip fixture", async () => {
    const files = generateStudioLoadFixture({ clipCount: 3_000, trackCount: 150 });
    const doc = makeDoc(files["index.html"]);
    const subComposition = makeDoc(files["compositions/load-details.html"]);
    const template = subComposition.querySelector("template");
    const host = doc.querySelector('[data-composition-id="studio-load-details"]');
    if (!(template instanceof HTMLTemplateElement) || !host) {
      throw new Error("invalid generated fixture");
    }
    host.append(template.content.cloneNode(true));

    const nodes = Array.from(doc.querySelectorAll(".clip"));
    nodes.forEach((node, index) => {
      if (!node.id && index % 29 !== 0) node.setAttribute("data-hf-id", `hf-${index}`);
    });
    const clips = nodes.map(manifestClip);
    const nullIdCount = clips.filter((clip) => clip.id == null).length;
    // Both arms run the FULL derivation, node resolution included — handing the
    // legacy arm a pre-resolved hostEl would compare only the identity builder
    // and could not see the indexed path resolving a clip to a different node.
    const legacy = await deriveManifestElements(doc, clips);
    const indexed = await deriveManifestElements(doc, clips, createTimelineDomIndex(doc));

    expect(nodes).toHaveLength(3_000);
    expect(nullIdCount).toBeGreaterThan(0);
    expect(indexed.map(({ id, key }) => ({ id, key }))).toEqual(
      legacy.map(({ id, key }) => ({ id, key })),
    );
  }, 300_000);

  it("keeps a null-id clip's selector occurrence identity unchanged", async () => {
    const doc = makeDoc(`
      <main data-composition-id="root" data-composition-file="index.html">
        <div class="clip card" data-start="0" data-duration="4" data-track-index="0"></div>
        <div class="clip card" data-start="4" data-duration="4" data-track-index="1"></div>
      </main>
    `);
    const clip: ClipManifestClip = {
      id: null,
      label: "Card",
      start: 4,
      duration: 4,
      track: 1,
      kind: "element",
      tagName: "div",
      compositionId: null,
      parentCompositionId: null,
      compositionSrc: null,
      assetUrl: null,
    };
    const legacy = await deriveManifestElements(doc, [clip]);
    const indexed = await deriveManifestElements(doc, [clip], createTimelineDomIndex(doc));

    expect(indexed[0]).toMatchObject({
      id: legacy[0]?.id,
      key: legacy[0]?.key,
      selector: ".card",
      selectorIndex: 1,
    });
  });

  it("resolves an inlined composition without extra document queries", async () => {
    const doc = makeDoc(`
      <main data-composition-id="root" data-composition-file="index.html">
        <section data-hf-id="host-hf" data-composition-id="nested"
          data-composition-file="nested.html" data-start="0" data-duration="4"></section>
      </main>
    `);
    const clip: ClipManifestClip = {
      id: "host-hf",
      label: "Nested",
      start: 0,
      duration: 4,
      track: 0,
      kind: "composition",
      tagName: "section",
      compositionId: "nested",
      parentCompositionId: null,
      compositionSrc: null,
      assetUrl: null,
    };
    const legacy = (await deriveManifestElements(doc, [clip]))[0];
    const index = createTimelineDomIndex(doc);
    const querySpy = vi.spyOn(doc, "querySelector");
    const indexed = (await deriveManifestElements(doc, [clip], index))[0];

    expect(indexed).toMatchObject({
      compositionSrc: legacy?.compositionSrc,
      domId: legacy?.domId,
      hfId: legacy?.hfId,
      id: legacy?.id,
      key: legacy?.key,
    });
    expect(querySpy).not.toHaveBeenCalled();
  });

  it("bounds document-wide queries for a 500-clip manifest including an inlined composition", async () => {
    const clipsMarkup = Array.from(
      { length: 499 },
      (_, index) =>
        `<div class="clip card" data-hf-id="hf-${index}" data-start="${index}" data-duration="1" data-track-index="${index}"></div>`,
    ).join("");
    const doc = makeDoc(`
      <main data-composition-id="root" data-composition-file="index.html">
        ${clipsMarkup}
        <section class="clip card" data-hf-id="composition-host" data-composition-id="nested"
          data-composition-file="nested.html" data-start="499" data-duration="1" data-track-index="499"></section>
      </main>
    `);
    const clips = Array.from(doc.querySelectorAll(".clip"), manifestClip);
    const queryAllSpy = vi.spyOn(doc, "querySelectorAll");
    const querySpy = vi.spyOn(doc, "querySelector");
    const index = createTimelineDomIndex(doc);
    const elements = await deriveManifestElements(doc, clips, index);

    expect(elements).toHaveLength(500);
    expect(elements.at(-1)?.compositionSrc).toBe("nested.html");
    expect(queryAllSpy).toHaveBeenCalledTimes(1);
    expect(querySpy).not.toHaveBeenCalled();
  });
});

describe("createImplicitTimelineLayersFromDOM — hfId from data-hf-id", () => {
  it("uses the runtime root paint scope for implicit siblings of manifest clips", () => {
    const doc = makeDoc(`
      <div data-composition-id="root">
        <div id="timed" data-start="0" data-duration="5"></div>
        <div id="implicit"></div>
      </div>
    `);
    const timedHost = doc.getElementById("timed");
    const timed = createTimelineElementFromManifestClip({
      clip: {
        id: "timed",
        label: "Timed",
        start: 0,
        duration: 5,
        track: 0,
        stackingContextId: "css:root",
        kind: "element",
        tagName: "div",
        compositionId: null,
        parentCompositionId: null,
        compositionSrc: null,
        assetUrl: null,
      },
      fallbackIndex: 0,
      doc,
      hostEl: timedHost,
    });
    const implicit = createImplicitTimelineLayersFromDOM(doc, 5, [timed])[0];

    expect(implicit?.stackingContextId).toBe("css:root");
    expect(implicit?.stackingContextId).toBe(timed.stackingContextId);
  });

  it("harvests hfId from an implicit layer child that has data-hf-id", () => {
    const doc = makeDoc(`
      <div data-composition-id="root">
        <div id="layer" class="clip" data-hf-id="hf-xyz789"></div>
      </div>
    `);

    const layers = createImplicitTimelineLayersFromDOM(doc, 10);
    const layer = layers.find((el) => el.domId === "layer");

    expect(layer).toBeDefined();
    expect(layer?.hfId).toBe("hf-xyz789");
  });

  it("ignores runtime-owned color grading canvases as implicit layers", () => {
    const doc = makeDoc(`
      <div data-composition-id="root" data-duration="5">
        <img id="photo" class="clip" data-start="0" data-duration="5" />
        <canvas
          class="__hf_color_grading_canvas__"
          data-hf-color-grading-canvas="true"
          data-hyperframes-ignore
        ></canvas>
      </div>
    `);

    const layers = createImplicitTimelineLayersFromDOM(doc, 5);

    expect(layers).toEqual([]);
  });
});

describe("mergeTimelineElementsPreservingDowngrades — genuine removal vs transient downgrade", () => {
  it("drops a removed TOP-LEVEL element (undo of a split) instead of ghosting it", () => {
    const current = [el("a"), el("a-split")]; // post-split store: original + clone
    const next = [el("a")]; // fresh scan of the reverted file: clone gone
    const merged = mergeTimelineElementsPreservingDowngrades(current, next, 30, 30);
    expect(merged.map((e) => e.id)).toEqual(["a"]);
  });

  it("still preserves an enriched sub-composition child a bare re-scan drops", () => {
    const current = [el("a"), el("sub-child", { compositionSrc: "sub.html" })];
    const next = [el("a")]; // bare DOM scan misses the enriched sub-comp child
    const merged = mergeTimelineElementsPreservingDowngrades(current, next, 30, 30);
    expect(merged.map((e) => e.id).sort()).toEqual(["a", "sub-child"]);
  });

  it("trusts the fresh scan fully when it is not shorter", () => {
    const current = [el("a"), el("b", { compositionSrc: "sub.html" })];
    const next = [el("a"), el("c")];
    expect(
      mergeTimelineElementsPreservingDowngrades(current, next, 30, 30).map((e) => e.id),
    ).toEqual(["a", "c"]);
  });
});
