import { describe, expect, it } from "vitest";
import { nextFusionImportPaths } from "./FusionImportButton";

describe("nextFusionImportPaths", () => {
  it("creates stable source, report, and composition paths", () => {
    expect(nextFusionImportPaths("Minimal Luxury.setting", [])).toEqual({
      compositionId: "minimal-luxury",
      compositionPath: "compositions/imports/minimal-luxury.html",
      sourcePath: "assets/fusion/sources/minimal-luxury.setting",
      reportPath: "assets/fusion/reports/minimal-luxury.json",
    });
  });

  it("does not overwrite an existing imported composition", () => {
    expect(
      nextFusionImportPaths("Minimal Luxury.comp", [
        "compositions/imports/minimal-luxury.html",
        "COMPOSITIONS/IMPORTS/minimal-luxury-2.html",
      ]).compositionId,
    ).toBe("minimal-luxury-3");
  });
});
