import { describe, expect, it } from "vitest";
import { fusionEntry, fusionPositional, isFusionTable, parseFusionValue } from "./parser";
import { FusionParseError } from "./types";

describe("parseFusionValue", () => {
  it("parses Fusion wrappers, ordered tables, comments, indices, and long strings", () => {
    const root = parseFusionValue(`
      -- DaVinci Resolve Fusion composition
      {
        Tools = ordered() {
          Text1 = TextPlus {
            Inputs = {
              StyledText = Input { Value = [[Hello\nFusion]] },
              Center = Input { Value = { 0.5, 0.25 } },
            },
          },
          Curve1 = BezierSpline {
            KeyFrames = { [0] = { 0 }, [24] = { 1, Flags = { Linear = true } } },
          },
        },
      }
    `);

    const tools = fusionEntry(root, "Tools");
    expect(isFusionTable(tools)).toBe(true);
    if (!isFusionTable(tools)) return;
    expect(tools.tag).toBe("ordered");
    const text = fusionEntry(tools, "Text1");
    expect(isFusionTable(text) && text.tag).toBe("TextPlus");
    if (!isFusionTable(text)) return;
    const inputs = fusionEntry(text, "Inputs");
    expect(isFusionTable(inputs)).toBe(true);
    if (!isFusionTable(inputs)) return;
    const center = fusionEntry(inputs, "Center");
    expect(isFusionTable(center)).toBe(true);
    if (!isFusionTable(center)) return;
    const value = fusionEntry(center, "Value");
    expect(isFusionTable(value) ? fusionPositional(value) : []).toEqual([0.5, 0.25]);
  });

  it("rejects malformed input without executing it", () => {
    expect(() => parseFusionValue(`{ Tools = ordered() { Bad = os.execute("no") } }`)).toThrow(
      FusionParseError,
    );
    expect(() => parseFusionValue("{ Tools = {")).toThrow(/Unterminated/);
  });
});
