import { buildFusionDocument } from "./document";
import { emitFusionHtml } from "./emitter";
import { parseFusionValue } from "./parser";
import type { FusionImportResult } from "./types";

export interface ImportFusionOptions {
  compositionId?: string;
  sourceName?: string;
  mediaBasePath?: string;
}

function compositionSlug(value: string): string {
  const withoutExtension = value.replace(/\.(?:comp|setting)$/i, "");
  const slug = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "fusion-import";
}

export function importFusionComposition(
  source: string,
  options: ImportFusionOptions = {},
): FusionImportResult {
  const root = parseFusionValue(source);
  const document = buildFusionDocument(root);
  if (document.tools.length === 0) {
    throw new Error("This file does not contain a Fusion Tools table.");
  }
  const compositionId = compositionSlug(
    options.compositionId ?? options.sourceName ?? "fusion-import",
  );
  const emitted = emitFusionHtml(document, compositionId, {
    mediaBasePath: options.mediaBasePath,
  });
  return {
    html: emitted.html,
    report: emitted.report,
    compositionId,
    duration: emitted.duration,
    width: document.width,
    height: document.height,
    fps: document.fps,
  };
}
