import type { Fps } from "../core.types.js";
import type { StoryboardKind, StoryboardTargetProfile } from "./types.js";

export const REFERENCE_ANALYSIS_VERSION = 1 as const;
export const TEMPLATE_MANIFEST_VERSION = 1 as const;

export type AnalysisConfidence = "high" | "medium" | "low";
export type AnalysisProvenance = "ffprobe" | "ffmpeg" | "local-ocr" | "vision" | "user";

/** Exact rational stream timebase. A PTS multiplied by den/num yields seconds. */
export interface ReferenceTimebase {
  num: number;
  den: number;
}

export interface ReferenceFramePoint {
  /** Zero-based decoded-frame order. */
  frameIndex: number;
  /** Integer presentation timestamp when the container exposes one. */
  pts: number | null;
  /** Canonical decoded presentation time. */
  timeSeconds: number;
  durationSeconds: number | null;
  keyframe: boolean;
}

export type ReferenceCutKind = "start" | "hard-cut" | "fade" | "dissolve" | "unknown";

export interface ReferenceCut {
  id: string;
  kind: ReferenceCutKind;
  frameIndex: number;
  pts: number | null;
  timeSeconds: number;
  score: number;
  confidence: AnalysisConfidence;
  provenance: AnalysisProvenance;
}

export interface ReferenceTransition {
  id: string;
  kind: Exclude<ReferenceCutKind, "start" | "hard-cut"> | "crossfade";
  startFrame: number;
  endFrame: number;
  startSeconds: number;
  endSeconds: number;
  confidence: AnalysisConfidence;
  provenance: AnalysisProvenance;
}

export type ReferenceAudioEventKind =
  | "beat"
  | "impact"
  | "onset"
  | "silence-start"
  | "silence-end"
  | "speech-onset";

export interface ReferenceAudioEvent {
  id: string;
  kind: ReferenceAudioEventKind;
  /** Sample index in the original audio stream. */
  sampleIndex: number;
  timeSeconds: number;
  strength: number;
  confidence: AnalysisConfidence;
  provenance: AnalysisProvenance;
}

export interface ReferenceTextDetection {
  id: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
  /** Normalized 0..1 source-frame rectangle. */
  box: { x: number; y: number; width: number; height: number };
  style: {
    color?: string;
    backgroundColor?: string;
    fontFamily?: string;
    fontWeight?: number;
    textAlign?: "left" | "center" | "right";
  };
  motion: "static" | "fade" | "slide" | "unknown";
  confidence: AnalysisConfidence;
  provenance: AnalysisProvenance;
  /** Project-relative fallback crop for low-confidence editable reconstruction. */
  fallbackAsset?: string;
}

export interface ReferenceScene {
  id: string;
  title: string;
  startFrame: number;
  endFrame: number;
  startSeconds: number;
  endSeconds: number;
  transitionIn: ReferenceCutKind | "crossfade";
  confidence: AnalysisConfidence;
}

export interface ReferenceAnalysisWarning {
  code: string;
  message: string;
  timeSeconds?: number;
}

/** Precision-heavy companion to a human-authored storyboard markdown file. */
export interface ReferenceAnalysisManifest {
  version: typeof REFERENCE_ANALYSIS_VERSION;
  id: string;
  groupId: string;
  createdAt: string;
  analyzerVersion: string;
  source: {
    assetPath: string;
    sourceUrl?: string;
    sha256: string;
    durationSeconds: number;
    width: number;
    height: number;
    frameRate: Fps;
    timebase: ReferenceTimebase;
    variableFrameRate: boolean;
    videoStartSeconds: number;
    audioStartSeconds: number;
    audioSampleRate: number | null;
    audioChannels: number | null;
  };
  frames: ReferenceFramePoint[];
  cuts: ReferenceCut[];
  transitions: ReferenceTransition[];
  audioEvents: ReferenceAudioEvent[];
  textDetections: ReferenceTextDetection[];
  scenes: ReferenceScene[];
  warnings: ReferenceAnalysisWarning[];
}

export type TemplateSlotKind = "media" | "text" | "audio" | "color" | "cta";
export type TemplateTimingRule = "fixed" | "flexible" | "repeatable" | "optional";

export interface TemplateSlot {
  id: string;
  kind: TemplateSlotKind;
  label: string;
  track: number;
  startSeconds: number;
  durationSeconds: number;
  timingRule: TemplateTimingRule;
  required: boolean;
  sourceElementId: string;
  referenceAsset?: string;
  value?: string;
  replacement: {
    fit: "fill" | "fit";
    focalPoint: { x: number; y: number };
    shortMediaPolicy: "ask" | "loop" | "freeze" | "speed" | "unlock";
  };
  confidence: AnalysisConfidence;
}

export interface TemplateSafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TemplateManifest {
  version: typeof TEMPLATE_MANIFEST_VERSION;
  id: string;
  groupId: string;
  kind: Extract<StoryboardKind, "template" | "version">;
  revision: number;
  baseTemplateRevision?: number;
  /** Snapshot used for three-way Template → Version update review. */
  baseSlots?: TemplateSlot[];
  targetProfile: StoryboardTargetProfile;
  compositionPath: string;
  durationSeconds: number;
  pacingLocked: boolean;
  slots: TemplateSlot[];
  safeArea: TemplateSafeArea;
  referenceAnalysisId: string;
}

export interface StoryboardRelationship {
  kind: StoryboardKind;
  groupId?: string;
  templateId?: string;
  templateRevision?: number;
  compositionPath?: string;
  analysisId?: string;
  referenceAsset?: string;
  sourceUrl?: string;
  targetProfile?: StoryboardTargetProfile;
}

export const TARGET_PROFILE_DIMENSIONS: Record<
  StoryboardTargetProfile,
  { width: number; height: number; safeArea: TemplateSafeArea }
> = {
  "9:16": {
    width: 1080,
    height: 1920,
    safeArea: { top: 0.08, right: 0.12, bottom: 0.18, left: 0.06 },
  },
  "16:9": {
    width: 1920,
    height: 1080,
    safeArea: { top: 0.05, right: 0.05, bottom: 0.08, left: 0.05 },
  },
  "4:5": {
    width: 1080,
    height: 1350,
    safeArea: { top: 0.06, right: 0.06, bottom: 0.12, left: 0.06 },
  },
  "1:1": {
    width: 1080,
    height: 1080,
    safeArea: { top: 0.06, right: 0.06, bottom: 0.1, left: 0.06 },
  },
};

export function sampleIndexAtTime(timeSeconds: number, sampleRate: number): number {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0)
    throw new Error("time must be non-negative");
  if (!Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new Error("sample rate must be positive");
  return Math.round(timeSeconds * sampleRate);
}

export function timeAtSample(sampleIndex: number, sampleRate: number): number {
  if (!Number.isInteger(sampleIndex) || sampleIndex < 0) {
    throw new Error("sample index must be a non-negative integer");
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new Error("sample rate must be positive");
  return sampleIndex / sampleRate;
}
