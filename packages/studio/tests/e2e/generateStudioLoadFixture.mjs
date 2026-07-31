import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DURATION = 180;
const CLIP_DURATION = 2;
const SUB_COMPOSITION_DURATION = 120;
const SUB_COMPOSITION_PATH = "compositions/load-details.html";
const CLIP_KINDS = ["load-card", "load-caption", "load-accent"];
const PROJECT_CONFIG = `${JSON.stringify(
  {
    $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    paths: {
      blocks: "compositions",
      components: "compositions/components",
      assets: "assets",
    },
  },
  null,
  2,
)}\n`;

function validateOptions({ clipCount, trackCount }) {
  if (!Number.isInteger(clipCount) || clipCount < 0) {
    throw new RangeError("clipCount must be a non-negative integer");
  }
  if (!Number.isInteger(trackCount) || trackCount < 1) {
    throw new RangeError("trackCount must be a positive integer");
  }
}

function renderClip(index, start, track, indent) {
  const authoredId = index % 5 === 0 ? `${indent}  id="load-clip-${index}"\n` : "";
  const kind = CLIP_KINDS[index % CLIP_KINDS.length];
  const left = (index * 37) % 1820;
  const top = (index * 17) % 980;

  return `${indent}<div
${authoredId}${indent}  class="clip ${kind}"
${indent}  data-start="${start}"
${indent}  data-duration="${CLIP_DURATION}"
${indent}  data-track-index="${track}"
${indent}  style="left: ${left}px; top: ${top}px"
${indent}>
${indent}  ${index + 1}
${indent}</div>`;
}

function renderRootHtml({ clipCount, trackCount }, rootClipCount) {
  const rootClips = Array.from({ length: rootClipCount }, (_, index) =>
    renderClip(
      index,
      (index * 37) % (ROOT_DURATION - CLIP_DURATION),
      index % Math.max(1, trackCount - 1),
      "      ",
    ),
  ).join("\n");
  const hostIndex = rootClipCount;
  const hostMarkup =
    clipCount === 0
      ? `      <div
        data-composition-id="studio-load-details"
        data-composition-src="${SUB_COMPOSITION_PATH}"
      ></div>`
      : `      <div
        class="clip load-card"
        data-composition-id="studio-load-details"
        data-composition-src="${SUB_COMPOSITION_PATH}"
        data-start="${(hostIndex * 37) % (ROOT_DURATION - SUB_COMPOSITION_DURATION)}"
        data-duration="${SUB_COMPOSITION_DURATION}"
        data-track-index="${trackCount - 1}"
      ></div>`;
  const clipMarkup = rootClips ? `${rootClips}\n${hostMarkup}` : hostMarkup;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Studio load fixture (${clipCount} clips, ${trackCount} tracks)</title>
    <style>
      html,
      body {
        width: 1920px;
        height: 1080px;
        margin: 0;
        overflow: hidden;
        background: #0b1020;
        color: #f8fafc;
        font-family: Arial, sans-serif;
      }
      #studio-load-root {
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
      }
      .clip {
        position: absolute;
        width: 100px;
        height: 100px;
        visibility: hidden;
      }
      .load-card {
        background: #2563eb;
      }
      .load-caption {
        background: #7c3aed;
      }
      .load-accent {
        background: #0f766e;
      }
    </style>
  </head>
  <body>
    <main
      id="studio-load-root"
      data-composition-id="studio-load"
      data-width="1920"
      data-height="1080"
      data-start="0"
      data-duration="${ROOT_DURATION}"
      data-fps="30"
    >
${clipMarkup}
    </main>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["studio-load"] = {
        pause() {},
        seek() {},
      };
    </script>
  </body>
</html>
`;
}

function renderSubCompositionHtml({ trackCount }, rootClipCount, nestedClipCount) {
  const firstNestedIndex = rootClipCount + 1;
  const clips = Array.from({ length: nestedClipCount }, (_, offset) => {
    const index = firstNestedIndex + offset;
    return renderClip(
      index,
      (index * 17) % (SUB_COMPOSITION_DURATION - CLIP_DURATION),
      index % trackCount,
      "    ",
    );
  }).join("\n");
  const clipMarkup = clips ? `\n${clips}` : "";

  return `<template id="studio-load-details-template">
  <section
    id="studio-load-details-root"
    data-composition-id="studio-load-details"
    data-width="1920"
    data-height="1080"
    data-start="0"
    data-duration="${SUB_COMPOSITION_DURATION}"
  >
    <style>
      [data-composition-id="studio-load-details"] .clip {
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
    </style>${clipMarkup}
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["studio-load-details"] = {
        pause() {},
        seek() {},
      };
    </script>
  </section>
</template>
`;
}

/** Build every source file for a deterministic, on-disk Studio load project. */
export function generateStudioLoadFixture(options) {
  validateOptions(options);
  const nestedClipCount = options.clipCount > 1 ? Math.min(100, options.clipCount - 1) : 0;
  const rootClipCount = options.clipCount - nestedClipCount - (options.clipCount > 0 ? 1 : 0);

  return Object.freeze({
    "hyperframes.json": PROJECT_CONFIG,
    "index.html": renderRootHtml(options, rootClipCount),
    [SUB_COMPOSITION_PATH]: renderSubCompositionHtml(options, rootClipCount, nestedClipCount),
  });
}

/** Write one generated project to disk. */
export function writeStudioLoadFixture(outputDir, options) {
  for (const [relativePath, contents] of Object.entries(generateStudioLoadFixture(options))) {
    const outputPath = join(outputDir, relativePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, contents);
  }
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  const outputDir = fileURLToPath(new URL("fixtures/studio-load/", import.meta.url));
  writeStudioLoadFixture(outputDir, {
    clipCount: Number(process.argv[2] ?? 1_000),
    trackCount: Number(process.argv[3] ?? 50),
  });
}
