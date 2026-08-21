import type { ReferenceAnalysisManifest, TemplateManifest, TemplateSlot } from "./templateTypes.js";
import { TARGET_PROFILE_DIMENSIONS, TEMPLATE_MANIFEST_VERSION } from "./templateTypes.js";
import type { StoryboardKind, StoryboardTargetProfile } from "./types.js";

function cleanNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function html(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function targetProfileForSource(width: number, height: number): StoryboardTargetProfile {
  const ratio = width / Math.max(height, 1);
  if (ratio <= 0.65) return "9:16";
  if (ratio < 0.95) return "4:5";
  if (ratio <= 1.1) return "1:1";
  return "16:9";
}

export interface ReconstructedStoryboardOptions {
  title: string;
  kind: StoryboardKind;
  compositionPath: string;
  templateId?: string;
  templateRevision?: number;
  targetProfile?: StoryboardTargetProfile;
}

/** Human-readable storyboard derived from a precision analysis companion. */
export function buildReconstructedStoryboard(
  analysis: ReferenceAnalysisManifest,
  options: ReconstructedStoryboardOptions,
): string {
  const profile =
    options.targetProfile ?? targetProfileForSource(analysis.source.width, analysis.source.height);
  const frontmatter = [
    "---",
    `title: ${quote(options.title)}`,
    `kind: ${options.kind}`,
    `group_id: ${quote(analysis.groupId)}`,
    `analysis_id: ${quote(analysis.id)}`,
    `reference_asset: ${quote(analysis.source.assetPath)}`,
    `composition_path: ${quote(options.compositionPath)}`,
    `target_profile: ${quote(profile)}`,
    options.templateId ? `template_id: ${quote(options.templateId)}` : null,
    options.templateRevision != null ? `template_revision: ${options.templateRevision}` : null,
    analysis.source.sourceUrl ? `source_url: ${quote(analysis.source.sourceUrl)}` : null,
    `format: ${analysis.source.width}x${analysis.source.height}`,
    "---",
  ].filter((line): line is string => line !== null);

  const frames = analysis.scenes.map((scene, index) => {
    const poster = scene.startSeconds + (scene.endSeconds - scene.startSeconds) * 0.55;
    return [
      `## Frame ${index + 1} — ${scene.title}`,
      `- duration: ${cleanNumber(scene.endSeconds - scene.startSeconds)}s`,
      `- transition_in: ${scene.transitionIn}`,
      "- status: built",
      `- src: ${options.compositionPath}`,
      `- poster: ${cleanNumber(poster)}`,
      `- source_start: ${cleanNumber(scene.startSeconds)}`,
      `- source_end: ${cleanNumber(scene.endSeconds)}`,
      `- source_start_frame: ${scene.startFrame}`,
      `- source_end_frame: ${scene.endFrame}`,
      `- slot_id: scene-${index + 1}`,
      `- confidence: ${scene.confidence}`,
      "",
      `Reference scene ${index + 1}. Replace its media slot while preserving the authored cut timing.`,
    ].join("\n");
  });
  return `${frontmatter.join("\n")}\n\n${frames.join("\n\n")}\n`;
}

export interface ReconstructedCompositionOptions {
  compositionPath: string;
  compositionId: string;
  role: "reference" | "template" | "version";
  targetProfile?: StoryboardTargetProfile;
}

/**
 * Compile a flattened reference into real authored timeline elements. Every
 * visual slice reads the same source with its own data-media-start; the Studio
 * therefore exposes actual editable clips rather than mock board state.
 */
export function buildReconstructedComposition(
  analysis: ReferenceAnalysisManifest,
  options: ReconstructedCompositionOptions,
): string {
  const profile =
    options.targetProfile ?? targetProfileForSource(analysis.source.width, analysis.source.height);
  const dimensions =
    options.role === "reference"
      ? { width: analysis.source.width, height: analysis.source.height }
      : TARGET_PROFILE_DIMENSIONS[profile];
  const assetSrc = analysis.source.assetPath.replace(/\\/g, "/");
  const audioStart = Math.max(0, analysis.source.audioStartSeconds);
  const audioDuration = Math.max(0, analysis.source.durationSeconds - audioStart);
  const playbackClip = `    <video id="reference-playback" class="clip reference-playback" data-reference-playback data-hyperframes-ignore data-start="0" data-duration="${cleanNumber(analysis.source.durationSeconds)}" data-media-start="0" data-track-index="31" src="${html(assetSrc)}" muted playsinline preload="auto"></video>`;
  const clips = analysis.scenes
    .map((scene, index) => {
      const duration = scene.endSeconds - scene.startSeconds;
      return `    <video id="scene-${index + 1}" class="clip reference-scene" data-hf-id="scene-${index + 1}" data-slot-id="scene-${index + 1}" data-start="${cleanNumber(scene.startSeconds)}" data-duration="${cleanNumber(duration)}" data-media-start="${cleanNumber(scene.startSeconds)}" data-track-index="0" data-timeline-role="${options.role}-scene" data-timeline-label="Scene ${index + 1}" data-timeline-group="${html(analysis.groupId)}" src="${html(assetSrc)}" muted playsinline></video>`;
    })
    .join("\n");
  const textLayers = analysis.textDetections
    .map((item, index) => {
      const x = item.box.x * 100;
      const y = item.box.y * 100;
      const width = item.box.width * 100;
      const height = item.box.height * 100;
      return `    <div id="text-${index + 1}" class="clip detected-text" data-hf-id="text-${index + 1}" data-slot-id="text-${index + 1}" data-start="${cleanNumber(item.startSeconds)}" data-duration="${cleanNumber(item.endSeconds - item.startSeconds)}" data-track-index="${10 + index}" data-timeline-role="template-text" data-confidence="${item.confidence}" style="left:${cleanNumber(x)}%;top:${cleanNumber(y)}%;width:${cleanNumber(width)}%;height:${cleanNumber(height)}%;color:${html(item.style.color ?? "#ffffff")};font-weight:${item.style.fontWeight ?? 700};text-align:${item.style.textAlign ?? "center"}">${html(item.text)}</div>`;
    })
    .join("\n");
  const textTweens = analysis.textDetections
    .map((item, index) => {
      const start = item.startSeconds + Math.min(0.15, (item.endSeconds - item.startSeconds) * 0.1);
      const vars =
        item.motion === "static"
          ? "{ opacity: 0, duration: 0.12 }"
          : '{ opacity: 0, y: 18, duration: 0.24, ease: "power2.out" }';
      return `      tl.from("#text-${index + 1}", ${vars}, ${cleanNumber(start)});`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #050505; }
    #root { position: relative; width: ${dimensions.width}px; height: ${dimensions.height}px; overflow: hidden; background: #050505; color: #f5f5f4; font-family: sans-serif; }
    .reference-playback { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; object-fit: cover; }
    .reference-scene { display: none !important; position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .detected-text { position: absolute; z-index: 20; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 2%; font-size: clamp(28px, 5vw, 96px); line-height: 1.05; letter-spacing: -0.03em; text-shadow: 0 2px 14px rgba(0,0,0,.72); }
  </style>
</head>
<body>
  <div id="root" data-composition-id="${html(options.compositionId)}" data-width="${dimensions.width}" data-height="${dimensions.height}" data-start="0" data-duration="${cleanNumber(analysis.source.durationSeconds)}">
${playbackClip}
${clips}
${textLayers}
    <audio id="reference-guide" class="clip" data-hf-id="reference-guide" data-slot-id="reference-audio" data-start="${cleanNumber(audioStart)}" data-duration="${cleanNumber(audioDuration)}" data-media-start="${cleanNumber(audioStart)}" data-track-index="30" data-timeline-role="reference-guide" data-timeline-label="Reference guide audio" data-timeline-locked="true" src="${html(assetSrc)}"></audio>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
${textTweens}
    window.__timelines["${html(options.compositionId)}"] = tl;
  </script>
</body>
</html>
`;
}

export function buildTemplateManifest(
  analysis: ReferenceAnalysisManifest,
  options: {
    id: string;
    compositionPath: string;
    targetProfile?: StoryboardTargetProfile;
  },
): TemplateManifest {
  const targetProfile =
    options.targetProfile ?? targetProfileForSource(analysis.source.width, analysis.source.height);
  const mediaSlots: TemplateSlot[] = analysis.scenes.map((scene, index) => ({
    id: `scene-${index + 1}`,
    kind: "media",
    label: scene.title,
    track: 0,
    startSeconds: scene.startSeconds,
    durationSeconds: scene.endSeconds - scene.startSeconds,
    timingRule: "fixed",
    required: true,
    sourceElementId: `scene-${index + 1}`,
    referenceAsset: analysis.source.assetPath,
    replacement: {
      fit: "fill",
      focalPoint: { x: 0.5, y: 0.5 },
      shortMediaPolicy: "ask",
    },
    confidence: scene.confidence,
  }));
  const textSlots: TemplateSlot[] = analysis.textDetections.map((item, index) => ({
    id: `text-${index + 1}`,
    kind: "text",
    label: item.text || `Text ${index + 1}`,
    track: 10 + index,
    startSeconds: item.startSeconds,
    durationSeconds: item.endSeconds - item.startSeconds,
    timingRule: "fixed",
    required: true,
    sourceElementId: `text-${index + 1}`,
    value: item.text,
    replacement: {
      fit: "fit",
      focalPoint: {
        x: item.box.x + item.box.width / 2,
        y: item.box.y + item.box.height / 2,
      },
      shortMediaPolicy: "ask",
    },
    confidence: item.confidence,
  }));
  const audioSlot: TemplateSlot = {
    id: "reference-audio",
    kind: "audio",
    label: "Reference guide audio",
    track: 30,
    startSeconds: Math.max(0, analysis.source.audioStartSeconds),
    durationSeconds: Math.max(
      0,
      analysis.source.durationSeconds - Math.max(0, analysis.source.audioStartSeconds),
    ),
    timingRule: "fixed",
    required: false,
    sourceElementId: "reference-guide",
    referenceAsset: analysis.source.assetPath,
    replacement: {
      fit: "fit",
      focalPoint: { x: 0.5, y: 0.5 },
      shortMediaPolicy: "ask",
    },
    confidence: "high",
  };
  return {
    version: TEMPLATE_MANIFEST_VERSION,
    id: options.id,
    groupId: analysis.groupId,
    kind: "template",
    revision: 1,
    targetProfile,
    compositionPath: options.compositionPath,
    durationSeconds: analysis.source.durationSeconds,
    pacingLocked: true,
    slots: [...mediaSlots, ...textSlots, audioSlot],
    safeArea: TARGET_PROFILE_DIMENSIONS[targetProfile].safeArea,
    referenceAnalysisId: analysis.id,
  };
}
