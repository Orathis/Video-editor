// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  createSourceScopedSelectorIndex,
  getSourceScopedSelectorIndex,
} from "./sourceScopedSelectorIndex";

function makeDoc(html: string): Document {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = html;
  return doc;
}

function sourceFile(element: Element): string | undefined {
  const owner = element.parentElement?.closest("[data-composition-id]");
  return (
    owner?.getAttribute("data-composition-file") ??
    owner?.getAttribute("data-composition-src") ??
    undefined
  );
}

describe("source-scoped selector index", () => {
  it("matches fallback occurrence numbers for a class shared across source files", () => {
    const doc = makeDoc(`
      <main data-composition-id="root" data-composition-file="index.html">
        <div class="shared"></div>
        <section data-composition-id="scene" data-composition-file="scene.html">
          <div id="also-counted" class="shared"></div>
          <div class="shared target"></div>
        </section>
      </main>
    `);
    const target = doc.querySelector(".target");
    if (!target) throw new Error("missing target");
    const index = createSourceScopedSelectorIndex(
      Array.from(doc.querySelectorAll("*")),
      sourceFile,
    );
    const fallback = getSourceScopedSelectorIndex(doc, target, ".shared", "scene.html", sourceFile);
    const querySpy = vi.spyOn(doc, "querySelectorAll");

    expect(
      getSourceScopedSelectorIndex(doc, target, ".shared", "scene.html", sourceFile, index),
    ).toBe(fallback);
    expect(fallback).toBe(1);
    expect(querySpy).not.toHaveBeenCalled();
  });

  it("leaves a clip with no resolvable selector unindexed", () => {
    const doc = makeDoc(`<main data-composition-id="root"><div data-target></div></main>`);
    const target = doc.querySelector("[data-target]");
    if (!target) throw new Error("missing target");
    const index = createSourceScopedSelectorIndex(
      Array.from(doc.querySelectorAll("*")),
      sourceFile,
    );

    expect(
      getSourceScopedSelectorIndex(doc, target, undefined, undefined, sourceFile, index),
    ).toBeUndefined();
  });
});
