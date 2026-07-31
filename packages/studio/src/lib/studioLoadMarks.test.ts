import { beforeEach, describe, expect, it } from "vitest";
import {
  STUDIO_LOAD_MEASURES,
  markBoot,
  markClipsPainted,
  markManifestDeriveEnd,
  markManifestDeriveStart,
  markPreviewLoaded,
  markProjectOpenStart,
  markShellReady,
} from "./studioLoadMarks";

function markCompleteStudioLoad(): void {
  markBoot();
  markShellReady();
  markProjectOpenStart();
  markPreviewLoaded();
  markManifestDeriveStart();
  markManifestDeriveEnd();
  markClipsPainted();
}

describe("studio load marks", () => {
  beforeEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });

  it("constructs all named studio load measures", () => {
    markCompleteStudioLoad();

    for (const name of Object.values(STUDIO_LOAD_MEASURES)) {
      const entries = performance.getEntriesByName(name, "measure");
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe(name);
      expect(entries[0]?.duration).toBeGreaterThanOrEqual(0);
    }
  });

  it("contains preview and manifest derivation within the project-open interval", () => {
    markCompleteStudioLoad();

    const projectOpen = performance.getEntriesByName(
      STUDIO_LOAD_MEASURES.projectOpen,
      "measure",
    )[0];
    const subMeasures = [
      performance.getEntriesByName(STUDIO_LOAD_MEASURES.preview, "measure")[0],
      performance.getEntriesByName(STUDIO_LOAD_MEASURES.manifestDerive, "measure")[0],
    ];

    expect(projectOpen).toBeDefined();
    for (const subMeasure of subMeasures) {
      expect(subMeasure).toBeDefined();
      if (!projectOpen || !subMeasure) continue;
      expect(subMeasure.startTime).toBeGreaterThanOrEqual(projectOpen.startTime);
      expect(subMeasure.startTime + subMeasure.duration).toBeLessThanOrEqual(
        projectOpen.startTime + projectOpen.duration,
      );
    }
  });

  it("does not close project open at its start mark", () => {
    markProjectOpenStart();

    expect(performance.getEntriesByName(STUDIO_LOAD_MEASURES.projectOpen, "measure")).toHaveLength(
      0,
    );
  });

  it("overwrites the project-open measure on a later project open", () => {
    markProjectOpenStart();
    markClipsPainted();
    markProjectOpenStart();
    markClipsPainted();

    expect(
      performance
        .getEntriesByType("measure")
        .filter((entry) => entry.name === STUDIO_LOAD_MEASURES.projectOpen),
    ).toHaveLength(1);
  });

  it("does not fabricate project open without its start mark", () => {
    expect(markClipsPainted).not.toThrow();
    expect(performance.getEntriesByName(STUDIO_LOAD_MEASURES.projectOpen, "measure")).toHaveLength(
      0,
    );
  });

  it("does not fabricate manifest derivation without its start mark", () => {
    expect(markManifestDeriveEnd).not.toThrow();
    expect(
      performance.getEntriesByName(STUDIO_LOAD_MEASURES.manifestDerive, "measure"),
    ).toHaveLength(0);
  });

  it("degrades to no-ops when the Performance API is unavailable", () => {
    const realPerformance = globalThis.performance;
    try {
      Object.defineProperty(globalThis, "performance", {
        configurable: true,
        value: { now: () => 0 },
      });

      expect(markBoot).not.toThrow();
      expect(markShellReady).not.toThrow();
      expect(markProjectOpenStart).not.toThrow();
      expect(markPreviewLoaded).not.toThrow();
      expect(markManifestDeriveStart).not.toThrow();
      expect(markManifestDeriveEnd).not.toThrow();
      expect(markClipsPainted).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "performance", {
        configurable: true,
        value: realPerformance,
      });
    }
  });
});
