import { describe, expect, it } from "vitest";
import { STUDIO_LOAD_BUDGETS, resolveStudioLoadBudgets } from "./studioLoadBudgets";

const EXPECTED_STUDIO_LOAD_BUDGETS = {
  shellReadyP95Ms: 1_000,
  constrainedShellReadyP95Ms: 2_000,
  projectOpen1kClipsP95Ms: 1_500,
  constrainedProjectOpen1kClipsP95Ms: 3_000,
  projectOpen3kClipsP95Ms: 2_500,
  constrainedProjectOpen3kClipsP95Ms: 5_000,
  devShellReadyP95Ms: 3_000,
  constrainedDevShellReadyP95Ms: 5_000,
  devProjectOpen3kClipsP95Ms: 8_000,
  constrainedDevProjectOpen3kClipsP95Ms: 12_000,
  eagerEntryChunkGzipBytes: 600 * 1024,
};

describe("studio load budgets", () => {
  it("owns the provisional studio load ceilings", () => {
    expect(STUDIO_LOAD_BUDGETS).toMatchObject(EXPECTED_STUDIO_LOAD_BUDGETS);
    expect(Object.isFrozen(STUDIO_LOAD_BUDGETS)).toBe(true);
  });

  it("creates an immutable result without changing production defaults", () => {
    const resolved = resolveStudioLoadBudgets({});

    expect(resolved).toMatchObject(EXPECTED_STUDIO_LOAD_BUDGETS);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(STUDIO_LOAD_BUDGETS).toMatchObject(EXPECTED_STUDIO_LOAD_BUDGETS);
  });

  it("overrides one budget while preserving every other default", () => {
    const resolved = resolveStudioLoadBudgets({ shellReadyP95Ms: 500 });

    expect(resolved).toMatchObject({ ...EXPECTED_STUDIO_LOAD_BUDGETS, shellReadyP95Ms: 500 });
  });

  it.each([
    [{ eagerEntryChunkGzipBytes: -1 }, "eagerEntryChunkGzipBytes"],
    [{ projectOpen3kClipsP95Ms: Number.NaN }, "projectOpen3kClipsP95Ms"],
  ])("rejects an invalid override %#", (overrides, field) => {
    expect(() => resolveStudioLoadBudgets(overrides)).toThrow(RangeError);
    expect(() => resolveStudioLoadBudgets(overrides)).toThrow(
      `Studio load budget ${field} must be a finite non-negative number`,
    );
  });
});
