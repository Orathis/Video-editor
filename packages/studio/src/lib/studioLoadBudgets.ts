export interface StudioLoadBudgets {
  shellReadyP95Ms: number;
  constrainedShellReadyP95Ms: number;
  projectOpen1kClipsP95Ms: number;
  constrainedProjectOpen1kClipsP95Ms: number;
  projectOpen3kClipsP95Ms: number;
  constrainedProjectOpen3kClipsP95Ms: number;
  devShellReadyP95Ms: number;
  constrainedDevShellReadyP95Ms: number;
  devProjectOpen3kClipsP95Ms: number;
  constrainedDevProjectOpen3kClipsP95Ms: number;
  eagerEntryChunkGzipBytes: number;
  eagerEntryChunkGzipRatchetBytes: number;
}

// Shell and dev-open budgets were revised once against the 2026-07-31 baseline
// per KTD1; see tests/e2e/studio-load.baseline.json. The originals (1000ms shell,
// 8000ms dev open) sat so far above measured reality that they gated nothing.
// The embedded project-open budgets are deliberately NOT revised: they are red
// today and stay red until U4 removes the quadratic.
export const STUDIO_LOAD_BUDGETS: Readonly<StudioLoadBudgets> = Object.freeze({
  shellReadyP95Ms: 250,
  constrainedShellReadyP95Ms: 600,
  projectOpen1kClipsP95Ms: 1_500,
  constrainedProjectOpen1kClipsP95Ms: 3_000,
  projectOpen3kClipsP95Ms: 2_500,
  constrainedProjectOpen3kClipsP95Ms: 5_000,
  devShellReadyP95Ms: 400,
  constrainedDevShellReadyP95Ms: 1_000,
  devProjectOpen3kClipsP95Ms: 5_500,
  constrainedDevProjectOpen3kClipsP95Ms: 9_000,
  // The target. Reaching it needs the Node-only AST/DOM stack (@babel/parser,
  // esprima, acorn, recast, ast-types, source-map, linkedom, cssom) out of the
  // browser bundle — roughly 1.85MB of module graph pulled in through the SDK's
  // openComposition. That is its own unit; this number is not revised down to
  // meet what we happen to ship today.
  eagerEntryChunkGzipBytes: 600 * 1024,
  // What CI enforces: a ratchet just above the measured 860,966B, so the 23.6%
  // already won cannot be given back. It may only ever move down.
  eagerEntryChunkGzipRatchetBytes: 870_000,
});

function assertValidBudget(name: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`Studio load budget ${name} must be a finite non-negative number`);
  }
}

export function resolveStudioLoadBudgets(
  overrides: Partial<StudioLoadBudgets> = {},
): Readonly<StudioLoadBudgets> {
  const entries: Array<[string, unknown]> = Object.entries(overrides);
  for (const [name, value] of entries) {
    assertValidBudget(name, value);
  }
  return Object.freeze({ ...STUDIO_LOAD_BUDGETS, ...overrides });
}
