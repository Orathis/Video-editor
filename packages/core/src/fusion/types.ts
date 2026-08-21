export type FusionScalar = string | number | boolean | null;

export interface FusionIdentifierValue {
  kind: "identifier";
  name: string;
}

export interface FusionTableEntry {
  key: string | number | null;
  value: FusionValue;
}

export interface FusionTableValue {
  kind: "table";
  tag: string | null;
  entries: FusionTableEntry[];
}

export type FusionValue = FusionScalar | FusionIdentifierValue | FusionTableValue;

export interface FusionKeyframe {
  frame: number;
  value: FusionValue;
  leftHandle?: [number, number];
  rightHandle?: [number, number];
  linear: boolean;
  stepIn: boolean;
}

export interface FusionInput {
  name: string;
  value?: FusionValue;
  sourceOp?: string;
  source?: string;
  raw: FusionTableValue;
}

export type FusionSupportLevel = "supported" | "partial" | "unsupported";

export interface FusionTool {
  id: string;
  type: string;
  inputs: Record<string, FusionInput>;
  keyframes: FusionKeyframe[];
  support: FusionSupportLevel;
  raw: FusionTableValue;
}

export interface FusionDocument {
  root: FusionTableValue;
  tools: FusionTool[];
  width: number;
  height: number;
  fps: number;
  startFrame: number;
  endFrame: number;
}

export interface FusionCompatibilityItem {
  toolId: string;
  toolType: string;
  level: FusionSupportLevel;
  detail: string;
}

export interface FusionCompatibilityReport {
  supported: number;
  partial: number;
  unsupported: number;
  animatedInputs: number;
  mediaSlots: number;
  items: FusionCompatibilityItem[];
  warnings: string[];
}

export interface FusionImportResult {
  html: string;
  report: FusionCompatibilityReport;
  compositionId: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export class FusionParseError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(`${message} at ${line}:${column}`);
    this.name = "FusionParseError";
    this.line = line;
    this.column = column;
  }
}
