// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createTimelineDomIndex, findTimelineDomNodeForClip } from "./timelineElementHelpers";
import type { ClipManifestClip } from "./playbackTypes";

function makeDoc(html: string): Document {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = html;
  return doc;
}

function clip(overrides: Partial<ClipManifestClip> = {}): ClipManifestClip {
  return {
    id: null,
    label: "Clip",
    start: 0,
    duration: 4,
    track: 0,
    kind: "element",
    tagName: "div",
    compositionId: null,
    parentCompositionId: null,
    compositionSrc: null,
    assetUrl: null,
    ...overrides,
  };
}

describe("timeline DOM identity index", () => {
  it("resolves a manifest id that exists only as data-hf-id", () => {
    const doc = makeDoc(`
      <main data-composition-id="root">
        <div data-hf-id="hf-only" data-start="0" data-duration="4"></div>
      </main>
    `);
    const expected = doc.querySelector("[data-hf-id='hf-only']");

    expect(
      findTimelineDomNodeForClip(
        doc,
        clip({ id: "hf-only" }),
        0,
        new Set(),
        createTimelineDomIndex(doc),
      ),
    ).toBe(expected);
  });

  it("keeps DOM id resolution unchanged", () => {
    const doc = makeDoc(`
      <main data-composition-id="root">
        <div id="dom-only" data-start="0" data-duration="4"></div>
      </main>
    `);

    expect(
      findTimelineDomNodeForClip(
        doc,
        clip({ id: "dom-only" }),
        0,
        new Set(),
        createTimelineDomIndex(doc),
      ),
    ).toBe(doc.getElementById("dom-only"));
  });

  it("never returns an already-claimed node for duplicate manifest ids", () => {
    const doc = makeDoc(`
      <main data-composition-id="root">
        <div data-hf-id="duplicate" data-start="0" data-duration="4" data-track-index="0"></div>
        <div data-hf-id="duplicate" data-start="4" data-duration="4" data-track-index="1"></div>
      </main>
    `);
    const index = createTimelineDomIndex(doc);
    const used = new Set<Element>();
    const first = findTimelineDomNodeForClip(
      doc,
      clip({ id: "duplicate", start: 0, track: 0 }),
      0,
      used,
      index,
    );
    if (!first) throw new Error("missing first match");
    used.add(first);
    const second = findTimelineDomNodeForClip(
      doc,
      clip({ id: "duplicate", start: 4, track: 1 }),
      1,
      used,
      index,
    );

    expect(second).toBe(doc.querySelectorAll("[data-hf-id='duplicate']")[1]);
    expect(second).not.toBe(first);
  });

  it("preserves composition, class, and attribute fallback resolution", () => {
    const doc = makeDoc(`
      <main data-composition-id="root">
        <div data-composition-id="nested" data-start="0" data-duration="4"></div>
        <div class="class-identity" data-start="4" data-duration="4"></div>
        <article data-start="8" data-duration="4" data-track-index="2"></article>
      </main>
    `);
    const index = createTimelineDomIndex(doc);

    expect(findTimelineDomNodeForClip(doc, clip({ id: "nested" }), 0, new Set(), index)).toBe(
      doc.querySelector("[data-composition-id='nested']"),
    );
    expect(
      findTimelineDomNodeForClip(
        doc,
        clip({ id: "class-identity", start: 4 }),
        1,
        new Set(),
        index,
      ),
    ).toBe(doc.querySelector(".class-identity"));
    expect(
      findTimelineDomNodeForClip(
        doc,
        clip({ id: "missing", tagName: "article", start: 8, track: 2 }),
        2,
        new Set(),
        index,
      ),
    ).toBe(doc.querySelector("article"));
  });

  it("rebuilds against DOM mutations between sync passes", () => {
    const doc = makeDoc(`
      <main data-composition-id="root">
        <div data-hf-id="mutable" data-version="before" data-start="0" data-duration="4"></div>
      </main>
    `);
    const before = findTimelineDomNodeForClip(
      doc,
      clip({ id: "mutable" }),
      0,
      new Set(),
      createTimelineDomIndex(doc),
    );
    before?.remove();
    doc
      .querySelector("main")
      ?.insertAdjacentHTML(
        "beforeend",
        `<div data-hf-id="mutable" data-version="after" data-start="0" data-duration="4"></div>`,
      );
    const after = findTimelineDomNodeForClip(
      doc,
      clip({ id: "mutable" }),
      0,
      new Set(),
      createTimelineDomIndex(doc),
    );

    expect(before?.getAttribute("data-version")).toBe("before");
    expect(after?.getAttribute("data-version")).toBe("after");
    expect(after).not.toBe(before);
  });
});
