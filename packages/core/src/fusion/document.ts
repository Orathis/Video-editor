import { fusionEntry, fusionPositional, isFusionTable } from "./parser";
import type {
  FusionDocument,
  FusionInput,
  FusionKeyframe,
  FusionSupportLevel,
  FusionTableValue,
  FusionTool,
  FusionValue,
} from "./types";

const SUPPORTED_TOOLS = new Set([
  "Background",
  "BezierSpline",
  "EllipseMask",
  "Loader",
  "MediaIn",
  "MediaOut",
  "Merge",
  "Path",
  "PolyPath",
  "RectangleMask",
  "TextPlus",
  "Transform",
]);

const PARTIAL_TOOLS = new Set([
  "Blur",
  "BrightnessContrast",
  "ChannelBooleans",
  "ColorCorrector",
  "ColorCurves",
  "Crop",
  "CustomTool",
  "Dissolve",
  "DVE",
  "FastNoise",
  "Glow",
  "MatteControl",
  "Resize",
  "Shadow",
  "SoftGlow",
  "TimeSpeed",
]);

export function fusionSupportForType(type: string): FusionSupportLevel {
  if (SUPPORTED_TOOLS.has(type)) return "supported";
  if (PARTIAL_TOOLS.has(type)) return "partial";
  return "unsupported";
}

function toNumber(value: FusionValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function point(value: FusionValue | undefined): [number, number] | undefined {
  if (!isFusionTable(value)) return undefined;
  const values = fusionPositional(value);
  const x = toNumber(values[0]);
  const y = toNumber(values[1]);
  return x === undefined || y === undefined ? undefined : [x, y];
}

function keyframeFromEntry(
  frame: string | number | null,
  value: FusionValue,
): FusionKeyframe | null {
  const frameNumber = typeof frame === "number" ? frame : Number(frame);
  if (!Number.isFinite(frameNumber) || !isFusionTable(value)) return null;
  const positional = fusionPositional(value);
  const keyframeValue = positional[0];
  if (keyframeValue === undefined) return null;
  const flags = fusionEntry(value, "Flags");
  return {
    frame: frameNumber,
    value: keyframeValue,
    leftHandle: point(fusionEntry(value, "LH")),
    rightHandle: point(fusionEntry(value, "RH")),
    linear: isFusionTable(flags) && fusionEntry(flags, "Linear") === true,
    stepIn: isFusionTable(flags) && fusionEntry(flags, "StepIn") === true,
  };
}

function keyframesForTool(table: FusionTableValue): FusionKeyframe[] {
  const keyframes = fusionEntry(table, "KeyFrames");
  if (!isFusionTable(keyframes)) return [];
  return keyframes.entries
    .map((entry) => keyframeFromEntry(entry.key, entry.value))
    .filter((value): value is FusionKeyframe => value !== null)
    .sort((a, b) => a.frame - b.frame);
}

function inputFromEntry(name: string, value: FusionValue): FusionInput | null {
  if (!isFusionTable(value)) return null;
  const sourceOp = fusionEntry(value, "SourceOp");
  const source = fusionEntry(value, "Source");
  return {
    name,
    value: fusionEntry(value, "Value"),
    sourceOp: typeof sourceOp === "string" ? sourceOp : undefined,
    source: typeof source === "string" ? source : undefined,
    raw: value,
  };
}

function inputsForTool(table: FusionTableValue): Record<string, FusionInput> {
  const inputs = fusionEntry(table, "Inputs");
  if (!isFusionTable(inputs)) return {};
  const result: Record<string, FusionInput> = {};
  for (const entry of inputs.entries) {
    if (entry.key === null) continue;
    const input = inputFromEntry(String(entry.key), entry.value);
    if (input) result[input.name] = input;
  }
  return result;
}

function toolsFromRoot(root: FusionTableValue): FusionTool[] {
  const tools = fusionEntry(root, "Tools");
  const container = isFusionTable(tools) ? tools : root.tag === "ordered" ? root : null;
  if (!container) return [];
  const result: FusionTool[] = [];
  for (const entry of container.entries) {
    if (entry.key === null || !isFusionTable(entry.value) || !entry.value.tag) continue;
    const type = entry.value.tag;
    result.push({
      id: String(entry.key),
      type,
      inputs: inputsForTool(entry.value),
      keyframes: keyframesForTool(entry.value),
      support: fusionSupportForType(type),
      raw: entry.value,
    });
  }
  return result;
}

function rangeFromRoot(root: FusionTableValue, key: string): [number, number] | undefined {
  return point(fusionEntry(root, key));
}

function numericInput(tools: FusionTool[], names: string[]): number | undefined {
  for (const tool of tools) {
    for (const name of names) {
      const value = toNumber(tool.inputs[name]?.value);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function largestKeyframe(tools: FusionTool[]): number | undefined {
  const frames = tools.flatMap((tool) => tool.keyframes.map((keyframe) => keyframe.frame));
  return frames.length > 0 ? Math.max(...frames) : undefined;
}

export function buildFusionDocument(root: FusionTableValue): FusionDocument {
  const tools = toolsFromRoot(root);
  const globalRange = rangeFromRoot(root, "GlobalRange") ?? rangeFromRoot(root, "RenderRange");
  const startFrame = globalRange?.[0] ?? 0;
  const maxOut = numericInput(tools, ["GlobalOut", "ClipTimeEnd"]);
  const endFrame = Math.max(
    startFrame + 1,
    globalRange?.[1] ?? maxOut ?? largestKeyframe(tools) ?? startFrame + 149,
  );
  const width = Math.max(16, Math.round(numericInput(tools, ["Width", "FrameWidth"]) ?? 1920));
  const height = Math.max(16, Math.round(numericInput(tools, ["Height", "FrameHeight"]) ?? 1080));
  const fps = Math.max(1, numericInput(tools, ["FrameRate", "FPS", "Rate"]) ?? 30);
  return { root, tools, width, height, fps, startFrame, endFrame };
}

export function fusionNumber(input: FusionInput | undefined, fallback: number): number {
  return toNumber(input?.value) ?? fallback;
}

export function fusionString(input: FusionInput | undefined, fallback = ""): string {
  return typeof input?.value === "string" ? input.value : fallback;
}

export function fusionPoint(
  input: FusionInput | undefined,
  fallback: [number, number],
): [number, number] {
  return point(input?.value) ?? fallback;
}

export function fusionColor(
  inputs: Record<string, FusionInput>,
  prefix: string,
  fallback: [number, number, number, number],
): [number, number, number, number] {
  const aliases: [string, string, string, string] = prefix
    ? [`${prefix}Red`, `${prefix}Green`, `${prefix}Blue`, `${prefix}Alpha`]
    : ["Red1", "Green1", "Blue1", "Alpha1"];
  return [
    fusionNumber(inputs[aliases[0]], fallback[0]),
    fusionNumber(inputs[aliases[1]], fallback[1]),
    fusionNumber(inputs[aliases[2]], fallback[2]),
    fusionNumber(inputs[aliases[3]], fallback[3]),
  ];
}
