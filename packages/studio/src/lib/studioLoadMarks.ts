const STUDIO_LOAD_MARKS = Object.freeze({
  boot: "hf.studio.boot",
  shellReady: "hf.studio.shell-ready",
  projectOpenStart: "hf.studio.project-open-start",
  previewLoaded: "hf.studio.preview-loaded",
  clipsPainted: "hf.studio.clips-painted",
  manifestDeriveStart: "hf.studio.manifest-derive-start",
  manifestDeriveEnd: "hf.studio.manifest-derive-end",
});

export const STUDIO_LOAD_MEASURES = Object.freeze({
  shell: "hf.studio.shell",
  projectOpen: "hf.studio.project-open",
  preview: "hf.studio.preview",
  manifestDerive: "hf.studio.manifest-derive",
});

function getPerformance(): Performance | null {
  const currentPerformance = globalThis.performance;
  if (
    typeof currentPerformance?.mark !== "function" ||
    typeof currentPerformance?.measure !== "function"
  ) {
    return null;
  }
  return currentPerformance;
}

function mark(name: string): void {
  try {
    const currentPerformance = getPerformance();
    if (!currentPerformance) return;
    if (typeof currentPerformance.clearMarks === "function") {
      currentPerformance.clearMarks(name);
    }
    currentPerformance.mark(name);
  } catch {}
}

function measure(name: string, startMark: string, endMark: string): void {
  try {
    const currentPerformance = getPerformance();
    if (!currentPerformance || typeof currentPerformance.getEntriesByName !== "function") return;
    if (
      currentPerformance.getEntriesByName(startMark, "mark").length === 0 ||
      currentPerformance.getEntriesByName(endMark, "mark").length === 0
    ) {
      return;
    }
    if (typeof currentPerformance.clearMeasures === "function") {
      currentPerformance.clearMeasures(name);
    }
    currentPerformance.measure(name, startMark, endMark);
  } catch {}
}

export function markBoot(): void {
  mark(STUDIO_LOAD_MARKS.boot);
}

export function markShellReady(): void {
  mark(STUDIO_LOAD_MARKS.shellReady);
  measure(STUDIO_LOAD_MEASURES.shell, STUDIO_LOAD_MARKS.boot, STUDIO_LOAD_MARKS.shellReady);
}

export function markProjectOpenStart(): void {
  mark(STUDIO_LOAD_MARKS.projectOpenStart);
}

export function markPreviewLoaded(): void {
  mark(STUDIO_LOAD_MARKS.previewLoaded);
  measure(
    STUDIO_LOAD_MEASURES.preview,
    STUDIO_LOAD_MARKS.projectOpenStart,
    STUDIO_LOAD_MARKS.previewLoaded,
  );
}

export function markManifestDeriveStart(): void {
  mark(STUDIO_LOAD_MARKS.manifestDeriveStart);
}

export function markManifestDeriveEnd(): void {
  mark(STUDIO_LOAD_MARKS.manifestDeriveEnd);
  measure(
    STUDIO_LOAD_MEASURES.manifestDerive,
    STUDIO_LOAD_MARKS.manifestDeriveStart,
    STUDIO_LOAD_MARKS.manifestDeriveEnd,
  );
}

export function markClipsPainted(): void {
  mark(STUDIO_LOAD_MARKS.clipsPainted);
  measure(
    STUDIO_LOAD_MEASURES.projectOpen,
    STUDIO_LOAD_MARKS.projectOpenStart,
    STUDIO_LOAD_MARKS.clipsPainted,
  );
}
