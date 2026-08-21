import { fusionNumber, fusionPoint, fusionString } from "./document";
import type { FusionDocument, FusionInput, FusionTool } from "./types";

export interface FusionLayerModifier {
  tool: FusionTool;
  kind: "transform" | "effect" | "mask";
}

export interface FusionLayer {
  source: FusionTool;
  modifiers: FusionLayerModifier[];
  opacity: number;
  track: number;
}

function sourceOf(tool: FusionTool, names: string[]): string | undefined {
  for (const name of names) {
    const source = tool.inputs[name]?.sourceOp;
    if (source) return source;
  }
  return undefined;
}

function isVisualSource(type: string): boolean {
  return type === "Background" || type === "TextPlus" || type === "MediaIn" || type === "Loader";
}

function isMask(type: string): boolean {
  return type === "RectangleMask" || type === "EllipseMask";
}

function findGraphRoots(document: FusionDocument, referenced: Set<string>): string[] {
  const mediaOut = document.tools.filter((tool) => tool.type === "MediaOut").map((tool) => tool.id);
  if (mediaOut.length > 0) return mediaOut;
  const candidates = document.tools
    .filter(
      (tool) => !referenced.has(tool.id) && tool.type !== "BezierSpline" && tool.type !== "Path",
    )
    .map((tool) => tool.id);
  return candidates.length > 0
    ? candidates
    : document.tools.filter((tool) => isVisualSource(tool.type)).map((tool) => tool.id);
}

function referencedTools(document: FusionDocument): Set<string> {
  const result = new Set<string>();
  for (const tool of document.tools) {
    for (const input of Object.values(tool.inputs)) if (input.sourceOp) result.add(input.sourceOp);
  }
  return result;
}

function collectFromTool(
  id: string,
  toolMap: Map<string, FusionTool>,
  modifiers: FusionLayerModifier[],
  opacity: number,
  stack: Set<string>,
  layers: FusionLayer[],
): void {
  if (stack.has(id)) return;
  const tool = toolMap.get(id);
  if (!tool) return;
  const nextStack = new Set(stack).add(id);
  if (tool.type === "MediaOut") {
    const input = sourceOf(tool, ["Input"]);
    if (input) collectFromTool(input, toolMap, modifiers, opacity, nextStack, layers);
    return;
  }
  if (tool.type === "Merge") {
    const background = sourceOf(tool, ["Background"]);
    const foreground = sourceOf(tool, ["Foreground"]);
    if (background) collectFromTool(background, toolMap, modifiers, opacity, nextStack, layers);
    if (foreground) {
      collectFromTool(
        foreground,
        toolMap,
        modifiers,
        opacity * fusionNumber(tool.inputs.Blend, 1),
        nextStack,
        layers,
      );
    }
    return;
  }
  if (isVisualSource(tool.type)) {
    const effectMask = sourceOf(tool, ["EffectMask", "Mask"]);
    const nextModifiers = [...modifiers];
    if (effectMask) {
      const mask = toolMap.get(effectMask);
      if (mask && isMask(mask.type)) nextModifiers.push({ tool: mask, kind: "mask" });
    }
    layers.push({ source: tool, modifiers: nextModifiers, opacity, track: layers.length });
    return;
  }
  if (isMask(tool.type)) return;
  const input = sourceOf(tool, ["Input", "Background", "Foreground"]);
  if (!input) return;
  const kind = tool.type === "Transform" || tool.type === "DVE" ? "transform" : "effect";
  collectFromTool(input, toolMap, [...modifiers, { tool, kind }], opacity, nextStack, layers);
}

export function buildFusionLayers(document: FusionDocument): FusionLayer[] {
  const map = new Map(document.tools.map((tool) => [tool.id, tool]));
  const layers: FusionLayer[] = [];
  for (const root of findGraphRoots(document, referencedTools(document))) {
    collectFromTool(root, map, [], 1, new Set(), layers);
  }
  return layers.map((layer, track) => ({ ...layer, track }));
}

export function effectiveTransform(layer: FusionLayer): {
  center: [number, number];
  scale: number;
  angle: number;
} {
  let center = fusionPoint(layer.source.inputs.Center, [0.5, 0.5]);
  let scale = fusionNumber(layer.source.inputs.Size, 1);
  let angle = fusionNumber(layer.source.inputs.Angle, 0);
  for (const modifier of [...layer.modifiers].reverse()) {
    if (modifier.kind !== "transform") continue;
    center = fusionPoint(modifier.tool.inputs.Center, center);
    scale *= fusionNumber(modifier.tool.inputs.Size, 1);
    angle += fusionNumber(modifier.tool.inputs.Angle, 0);
  }
  return { center, scale, angle };
}

export function mediaSource(tool: FusionTool): string {
  const candidates: Array<FusionInput | undefined> = [
    tool.inputs.Clip,
    tool.inputs.Filename,
    tool.inputs.File,
  ];
  for (const input of candidates) {
    const value = fusionString(input);
    if (value) return value;
  }
  return "";
}
