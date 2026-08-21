import { fusionColor, fusionNumber, fusionPoint, fusionString } from "./document";
import { buildFusionLayers, effectiveTransform, mediaSource, type FusionLayer } from "./graph";
import { fusionPositional, isFusionTable } from "./parser";
import type {
  FusionCompatibilityItem,
  FusionCompatibilityReport,
  FusionDocument,
  FusionInput,
  FusionKeyframe,
  FusionTool,
  FusionValue,
} from "./types";

const GSAP_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js";
const CUSTOM_EASE_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/CustomEase.min.js";

interface AnimationTrack {
  selector: string;
  property: string;
  keyframes: FusionKeyframe[];
  mapValue: (value: FusionValue) => number | [number, number] | undefined;
}

function html(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cssString(value: string): string {
  return JSON.stringify(value).slice(1, -1).replaceAll("</", "<\\/");
}

function slug(value: string): string {
  const result = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return result || "fusion-layer";
}

function clean(value: number): string {
  return String(Math.round(value * 1_000_000) / 1_000_000);
}

function rgba(color: [number, number, number, number]): string {
  const [red, green, blue, alpha] = color;
  return `rgba(${Math.round(Math.max(0, Math.min(1, red)) * 255)}, ${Math.round(Math.max(0, Math.min(1, green)) * 255)}, ${Math.round(Math.max(0, Math.min(1, blue)) * 255)}, ${clean(Math.max(0, Math.min(1, alpha)))})`;
}

function pointValue(value: FusionValue): [number, number] | undefined {
  if (!isFusionTable(value)) return undefined;
  const positional = fusionPositional(value);
  const x = positional[0];
  const y = positional[1];
  return typeof x === "number" && typeof y === "number" ? [x, y] : undefined;
}

function maskStyle(layer: FusionLayer): string {
  const masks = layer.modifiers.filter((modifier) => modifier.kind === "mask");
  if (masks.length === 0) return "";
  const mask = masks.at(-1)?.tool;
  if (!mask) return "";
  const center = fusionPoint(mask.inputs.Center, [0.5, 0.5]);
  const width = Math.max(0, Math.min(1, fusionNumber(mask.inputs.Width, 1)));
  const height = Math.max(0, Math.min(1, fusionNumber(mask.inputs.Height, 1)));
  if (mask.type === "EllipseMask") {
    return `clip-path:ellipse(${clean(width * 50)}% ${clean(height * 50)}% at ${clean(center[0] * 100)}% ${clean(center[1] * 100)}%);`;
  }
  const top = Math.max(0, (1 - height) * 50 - (center[1] - 0.5) * 100);
  const right = Math.max(0, (1 - width) * 50 - (center[0] - 0.5) * -100);
  const bottom = Math.max(0, (1 - height) * 50 - (center[1] - 0.5) * -100);
  const left = Math.max(0, (1 - width) * 50 - (center[0] - 0.5) * 100);
  const radius = Math.max(0, fusionNumber(mask.inputs.CornerRadius, 0) * 100);
  return `clip-path:inset(${clean(top)}% ${clean(right)}% ${clean(bottom)}% ${clean(left)}% round ${clean(radius)}%);`;
}

function effectStyle(layer: FusionLayer): string {
  const filters: string[] = [];
  for (const modifier of layer.modifiers) {
    if (modifier.kind !== "effect") continue;
    const { tool } = modifier;
    if (tool.type === "Blur") {
      filters.push(
        `blur(${clean(Math.max(0, fusionNumber(tool.inputs.XBlurSize ?? tool.inputs.Size, 0)))}px)`,
      );
    } else if (tool.type === "BrightnessContrast" || tool.type === "ColorCorrector") {
      const gain = fusionNumber(tool.inputs.Gain, 1);
      const contrast = fusionNumber(tool.inputs.Contrast, 1);
      const saturation = fusionNumber(tool.inputs.Saturation, 1);
      filters.push(
        `brightness(${clean(gain)}) contrast(${clean(contrast)}) saturate(${clean(saturation)})`,
      );
    } else if (tool.type === "Glow" || tool.type === "SoftGlow") {
      filters.push(
        `drop-shadow(0 0 ${clean(fusionNumber(tool.inputs.GlowSize, 12))}px rgba(255,255,255,.45))`,
      );
    } else if (tool.type === "Shadow") {
      filters.push(
        `drop-shadow(0 8px ${clean(fusionNumber(tool.inputs.Softness, 16))}px rgba(0,0,0,.55))`,
      );
    }
  }
  return filters.length > 0 ? `filter:${filters.join(" ")};` : "";
}

function baseLayerStyle(layer: FusionLayer, document: FusionDocument): string {
  const { center, scale, angle } = effectiveTransform(layer);
  const x = (center[0] - 0.5) * document.width;
  const y = (center[1] - 0.5) * document.height;
  return [
    "position:absolute",
    "inset:0",
    "width:100%",
    "height:100%",
    `opacity:${clean(layer.opacity * fusionNumber(layer.source.inputs.Blend, 1))}`,
    `transform:translate(${clean(x)}px, ${clean(y)}px) scale(${clean(scale)}) rotate(${clean(angle)}deg)`,
    "transform-origin:center center",
    maskStyle(layer),
    effectStyle(layer),
  ]
    .filter(Boolean)
    .join(";");
}

function textLayer(
  layer: FusionLayer,
  id: string,
  document: FusionDocument,
  duration: number,
): string {
  const { inputs } = layer.source;
  const text = fusionString(inputs.StyledText, "Text");
  const font = fusionString(inputs.Font, fusionString(inputs.FontFamily, "Arial"));
  const fontSize = Math.max(1, fusionNumber(inputs.Size, 0.075) * document.height);
  const color = rgba(fusionColor(inputs, "", [1, 1, 1, 1]));
  const horizontal = Math.round(fusionNumber(inputs.HorizontalJustification, 1));
  const vertical = Math.round(fusionNumber(inputs.VerticalJustification, 1));
  const align = horizontal === 0 ? "left" : horizontal === 2 ? "right" : "center";
  const justify = vertical === 0 ? "flex-start" : vertical === 2 ? "flex-end" : "center";
  return `<div id="${html(id)}" class="clip fusion-layer fusion-text" data-hf-id="${html(id)}" data-label="${html(layer.source.id)}" data-fusion-tool="${html(layer.source.id)}" data-fusion-tool-type="TextPlus" data-start="0" data-duration="${clean(duration)}" data-track-index="${layer.track}" style="${html(baseLayerStyle(layer, document))};display:flex;align-items:${justify};justify-content:${align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center"};padding:4%;font-family:${html(JSON.stringify(font))};font-size:${clean(fontSize)}px;color:${html(color)};text-align:${align};white-space:pre-wrap">${html(text)}</div>`;
}

function backgroundLayer(
  layer: FusionLayer,
  id: string,
  document: FusionDocument,
  duration: number,
): string {
  const color = rgba(fusionColor(layer.source.inputs, "TopLeft", [0, 0, 0, 1]));
  return `<div id="${html(id)}" class="clip fusion-layer fusion-background" data-hf-id="${html(id)}" data-label="${html(layer.source.id)}" data-fusion-tool="${html(layer.source.id)}" data-fusion-tool-type="Background" data-start="0" data-duration="${clean(duration)}" data-track-index="${layer.track}" style="${html(baseLayerStyle(layer, document))};background:${html(color)}"></div>`;
}

function normalizedMediaPath(raw: string, mediaBasePath: string): string {
  const normalized = raw.replaceAll("\\", "/");
  if (!normalized) return "";
  if (/^(?:https?:|data:|assets\/)/i.test(normalized)) return normalized;
  const base = normalized.split("/").pop() ?? normalized;
  return `${mediaBasePath.replace(/\/$/, "")}/${base}`;
}

function mediaLayer(
  layer: FusionLayer,
  id: string,
  document: FusionDocument,
  duration: number,
  mediaBasePath: string,
): string {
  const raw = mediaSource(layer.source);
  const source = normalizedMediaPath(raw, mediaBasePath);
  const isVideo = /\.(?:mp4|mov|m4v|webm|avi|mxf)$/i.test(raw);
  const common = `id="${html(id)}" class="clip fusion-layer fusion-media" data-hf-id="${html(id)}" data-label="${html(layer.source.id)}" data-fusion-tool="${html(layer.source.id)}" data-fusion-tool-type="${html(layer.source.type)}" data-fusion-media-slot="${html(layer.source.id)}" data-fusion-source="${html(raw)}" data-start="0" data-duration="${clean(duration)}" data-track-index="${layer.track}" style="${html(baseLayerStyle(layer, document))};object-fit:contain;background:repeating-conic-gradient(#20242b 0 25%,#171a20 0 50%) 50%/32px 32px"`;
  if (isVideo)
    return `<video ${common} src="${html(source)}" muted playsinline preload="auto"></video>`;
  return `<img ${common} src="${html(source)}" alt="${html(layer.source.id)}" />`;
}

function renderLayer(
  layer: FusionLayer,
  id: string,
  document: FusionDocument,
  duration: number,
  mediaBasePath: string,
): string {
  if (layer.source.type === "TextPlus") return textLayer(layer, id, document, duration);
  if (layer.source.type === "Background") return backgroundLayer(layer, id, document, duration);
  return mediaLayer(layer, id, document, duration, mediaBasePath);
}

function inputAnimationProperty(
  tool: FusionTool,
  input: FusionInput,
  document: FusionDocument,
): Omit<AnimationTrack, "selector" | "keyframes"> | null {
  if (input.name === "Center") {
    return {
      property: "position",
      mapValue: (value) => {
        const center = pointValue(value);
        return center
          ? [(center[0] - 0.5) * document.width, (center[1] - 0.5) * document.height]
          : undefined;
      },
    };
  }
  if (input.name === "Size" && tool.type === "TextPlus") {
    return {
      property: "fontSize",
      mapValue: (value) => (typeof value === "number" ? value * document.height : undefined),
    };
  }
  if (input.name === "Size")
    return {
      property: "scale",
      mapValue: (value) => (typeof value === "number" ? value : undefined),
    };
  if (input.name === "Angle")
    return {
      property: "rotation",
      mapValue: (value) => (typeof value === "number" ? value : undefined),
    };
  if (input.name === "Blend" || input.name === "Opacity")
    return {
      property: "opacity",
      mapValue: (value) => (typeof value === "number" ? value : undefined),
    };
  return null;
}

function animationTracks(
  document: FusionDocument,
  layers: FusionLayer[],
  layerIds: string[],
): { tracks: AnimationTrack[]; unsupported: string[] } {
  const curves = new Map(
    document.tools
      .filter((tool) => tool.keyframes.length > 0)
      .map((tool) => [tool.id, tool.keyframes]),
  );
  const tracks: AnimationTrack[] = [];
  const unsupported: string[] = [];
  layers.forEach((layer, index) => {
    const toolChain = [layer.source, ...layer.modifiers.map((modifier) => modifier.tool)];
    for (const tool of toolChain) {
      for (const input of Object.values(tool.inputs)) {
        if (!input.sourceOp) continue;
        const keyframes = curves.get(input.sourceOp);
        if (!keyframes) continue;
        const mapping = inputAnimationProperty(tool, input, document);
        if (!mapping) {
          unsupported.push(`${tool.id}.${input.name}`);
          continue;
        }
        tracks.push({ selector: `#${layerIds[index]}`, keyframes, ...mapping });
      }
    }
  });
  return { tracks, unsupported };
}

function easeForSegment(
  current: FusionKeyframe,
  next: FusionKeyframe,
  index: number,
): { ease: string; setup?: string } {
  if (next.stepIn) return { ease: "steps(1)" };
  if (current.linear || (!current.rightHandle && !next.leftHandle)) return { ease: "none" };
  const frameDelta = next.frame - current.frame;
  if (frameDelta <= 0 || typeof current.value !== "number" || typeof next.value !== "number")
    return { ease: "power1.inOut" };
  const valueDelta = next.value - current.value;
  if (Math.abs(valueDelta) < 1e-9 || !current.rightHandle || !next.leftHandle)
    return { ease: "power1.inOut" };
  const x1 = Math.max(0, Math.min(1, (current.rightHandle[0] - current.frame) / frameDelta));
  const x2 = Math.max(0, Math.min(1, (next.leftHandle[0] - current.frame) / frameDelta));
  const y1 = (current.rightHandle[1] - current.value) / valueDelta;
  const y2 = (next.leftHandle[1] - current.value) / valueDelta;
  const name = `fusionEase${index}`;
  return {
    ease: name,
    setup: `CustomEase.create(${JSON.stringify(name)}, "M0,0 C${clean(x1)},${clean(y1)} ${clean(x2)},${clean(y2)} 1,1");`,
  };
}

function animationScript(
  document: FusionDocument,
  tracks: AnimationTrack[],
  duration: number,
): string {
  const setup: string[] = [];
  const lines = ["const tl = gsap.timeline({ paused: true });"];
  let easeIndex = 0;
  for (const track of tracks) {
    const first = track.mapValue(track.keyframes[0]?.value ?? null);
    if (first === undefined) continue;
    const firstVars = Array.isArray(first)
      ? `{ x:${clean(first[0])}, y:${clean(first[1])} }`
      : `{ ${track.property}:${clean(first)} }`;
    lines.push(`tl.set(${JSON.stringify(track.selector)}, ${firstVars}, 0);`);
    for (let index = 1; index < track.keyframes.length; index++) {
      const previous = track.keyframes[index - 1];
      const current = track.keyframes[index];
      if (!previous || !current) continue;
      const mapped = track.mapValue(current.value);
      if (mapped === undefined) continue;
      const start = Math.max(0, (previous.frame - document.startFrame) / document.fps);
      const segmentDuration = Math.max(0, (current.frame - previous.frame) / document.fps);
      const ease = easeForSegment(previous, current, easeIndex++);
      if (ease.setup) setup.push(ease.setup);
      const vars = Array.isArray(mapped)
        ? `x:${clean(mapped[0])}, y:${clean(mapped[1])}`
        : `${track.property}:${clean(mapped)}`;
      lines.push(
        `tl.to(${JSON.stringify(track.selector)}, { ${vars}, duration:${clean(segmentDuration)}, ease:${JSON.stringify(ease.ease)} }, ${clean(start)});`,
      );
    }
  }
  lines.push(`tl.to({}, { duration:${clean(duration)} }, 0);`);
  lines.push("window.__timelines = window.__timelines || {};");
  return `${setup.join("\n")}\n${lines.join("\n")}`;
}

function supportDetail(tool: FusionTool): string {
  if (tool.support === "supported")
    return tool.keyframes.length > 0 ? "Native node with editable keyframes" : "Native node";
  if (tool.support === "partial")
    return "Imported with a CSS approximation; original node metadata is preserved";
  return "Preserved in the compatibility report; visual input is passed through when possible";
}

export function buildCompatibilityReport(
  document: FusionDocument,
  layers: FusionLayer[],
  unsupportedAnimations: string[],
): FusionCompatibilityReport {
  const animatedTools = new Set(
    document.tools.filter((tool) => tool.keyframes.length > 0).map((tool) => tool.id),
  );
  const items: FusionCompatibilityItem[] = document.tools.map((tool) => ({
    toolId: tool.id,
    toolType: tool.type,
    level: tool.support,
    detail: supportDetail(tool),
  }));
  const warnings = unsupportedAnimations.map(
    (input) => `Animation ${input} is preserved in the report but not yet editable.`,
  );
  for (const layer of layers) {
    const source = mediaSource(layer.source);
    if ((layer.source.type === "MediaIn" || layer.source.type === "Loader") && source) {
      warnings.push(`Relink media for ${layer.source.id}: ${source}`);
    }
  }
  if (layers.length === 0)
    warnings.push(
      "No renderable MediaOut, Merge, TextPlus, Background, Loader, or MediaIn graph was found.",
    );
  return {
    supported: items.filter((item) => item.level === "supported").length,
    partial: items.filter((item) => item.level === "partial").length,
    unsupported: items.filter((item) => item.level === "unsupported").length,
    animatedInputs: document.tools.reduce(
      (count, tool) =>
        count +
        Object.values(tool.inputs).filter(
          (input) => input.sourceOp && animatedTools.has(input.sourceOp),
        ).length,
      0,
    ),
    mediaSlots: layers.filter(
      (layer) => layer.source.type === "MediaIn" || layer.source.type === "Loader",
    ).length,
    items,
    warnings,
  };
}

export function emitFusionHtml(
  document: FusionDocument,
  compositionId: string,
  options: { mediaBasePath?: string } = {},
): { html: string; report: FusionCompatibilityReport; duration: number } {
  const duration = Math.max(
    1 / document.fps,
    (document.endFrame - document.startFrame + 1) / document.fps,
  );
  const layers = buildFusionLayers(document);
  const layerIds = layers.map((layer, index) => `${slug(layer.source.id)}-${index + 1}`);
  const animations = animationTracks(document, layers, layerIds);
  const report = buildCompatibilityReport(document, layers, animations.unsupported);
  const layerHtml = layers
    .map((layer, index) =>
      renderLayer(
        layer,
        layerIds[index] ?? `fusion-layer-${index + 1}`,
        document,
        duration,
        options.mediaBasePath ?? "assets/fusion",
      ),
    )
    .join("\n    ");
  const reportJson = JSON.stringify(report).replaceAll("<", "\\u003c");
  const script = animationScript(document, animations.tracks, duration);
  const sourceTools = cssString(document.tools.map((tool) => `${tool.id}:${tool.type}`).join(", "));
  return {
    duration,
    report,
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${html(compositionId)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #000; }
    #${html(compositionId)} { position: relative; width: ${document.width}px; height: ${document.height}px; overflow: hidden; background: #000; }
    .fusion-layer { will-change: transform, opacity, filter; }
  </style>
  <script src="${GSAP_CDN}"></script>
  <script src="${CUSTOM_EASE_CDN}"></script>
</head>
<body>
  <main id="${html(compositionId)}" data-composition-id="${html(compositionId)}" data-width="${document.width}" data-height="${document.height}" data-start="0" data-duration="${clean(duration)}" data-fps="${clean(document.fps)}" data-fusion-tools="${html(sourceTools)}">
    ${layerHtml}
  </main>
  <script type="application/json" id="fusion-import-report">${reportJson}</script>
  <script>
    ${script}
    window.__timelines[${JSON.stringify(compositionId)}] = tl;
  </script>
</body>
</html>
`,
  };
}
