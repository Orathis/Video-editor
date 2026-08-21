import { describe, expect, it } from "vitest";
import { importFusionComposition } from "./importer";

const SAMPLE = `
{
  GlobalRange = { 0, 59 },
  Tools = ordered() {
    Background1 = Background {
      Inputs = {
        Width = Input { Value = 1080 },
        Height = Input { Value = 1920 },
        TopLeftRed = Input { Value = 0.05 },
        TopLeftGreen = Input { Value = 0.06 },
        TopLeftBlue = Input { Value = 0.08 },
        TopLeftAlpha = Input { Value = 1 },
      },
    },
    TextSize = BezierSpline {
      KeyFrames = {
        [0] = { 0.04, RH = { 10, 0.04 } },
        [30] = { 0.09, LH = { 20, 0.09 } },
      },
    },
    Text1 = TextPlus {
      Inputs = {
        StyledText = Input { Value = "AI recommends the answer." },
        Font = Input { Value = "Inter" },
        Size = Input { SourceOp = "TextSize", Source = "Value" },
        Red1 = Input { Value = 0.84 },
        Green1 = Input { Value = 0.78 },
        Blue1 = Input { Value = 0.58 },
        Alpha1 = Input { Value = 1 },
      },
    },
    Blur1 = Blur {
      Inputs = {
        Input = Input { SourceOp = "Text1", Source = "Output" },
        XBlurSize = Input { Value = 4 },
      },
    },
    Merge1 = Merge {
      Inputs = {
        Background = Input { SourceOp = "Background1", Source = "Output" },
        Foreground = Input { SourceOp = "Blur1", Source = "Output" },
      },
    },
    MediaOut1 = MediaOut {
      Inputs = { Input = Input { SourceOp = "Merge1", Source = "Output" } },
    },
  },
}
`;

describe("importFusionComposition", () => {
  it("emits an editable HyperFrames composition with a compatibility report", () => {
    const result = importFusionComposition(SAMPLE, { sourceName: "Luxury Intro.comp" });

    expect(result.compositionId).toBe("luxury-intro");
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.duration).toBe(2);
    expect(result.html).toContain('data-composition-id="luxury-intro"');
    expect(result.html).toContain('data-fusion-tool="Text1"');
    expect(result.html).toContain("AI recommends the answer.");
    expect(result.html).toContain("fontSize");
    expect(result.html).toContain("CustomEase.create");
    expect(result.html).toContain('id="fusion-import-report"');
    expect(result.report.partial).toBe(1);
    expect(result.report.unsupported).toBe(0);
    expect(result.report.animatedInputs).toBe(1);
  });

  it("reports unsupported tools while preserving a renderable upstream visual", () => {
    const source = SAMPLE.replace("Blur1 = Blur", "Mystery1 = VendorMagic").replaceAll(
      'SourceOp = "Blur1"',
      'SourceOp = "Mystery1"',
    );
    const result = importFusionComposition(source);
    expect(result.report.unsupported).toBe(1);
    expect(result.report.items).toContainEqual(
      expect.objectContaining({ toolId: "Mystery1", level: "unsupported" }),
    );
    expect(result.html).toContain("AI recommends the answer.");
  });

  it("rejects files without a Fusion tool graph", () => {
    expect(() => importFusionComposition("{ Name = 'not a comp' }")).toThrow(
      "does not contain a Fusion Tools table",
    );
  });
});
