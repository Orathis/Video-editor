import { describe, expect, it } from "vitest";
import { extractDrfx } from "./fusionDrfx";

function u16(value: number): number[] {
  return [value & 255, (value >>> 8) & 255];
}

function u32(value: number): number[] {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}

function storedZip(entries: Array<{ path: string; content: string | Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const local: number[] = [];
  const central: number[] = [];
  for (const entry of entries) {
    const name = [...encoder.encode(entry.path)];
    const body = [
      ...(typeof entry.content === "string" ? encoder.encode(entry.content) : entry.content),
    ];
    const offset = local.length;
    local.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0));
    local.push(...u32(0), ...u32(body.length), ...u32(body.length), ...u16(name.length), ...u16(0));
    local.push(...name, ...body);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0));
    central.push(...u16(0), ...u16(0), ...u32(0), ...u32(body.length), ...u32(body.length));
    central.push(...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0));
    central.push(...u32(offset), ...name);
  }
  const directoryOffset = local.length;
  const end = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(central.length),
    ...u32(directoryOffset),
    ...u16(0),
  ];
  return new Uint8Array([...local, ...central, ...end]);
}

describe("extractDrfx", () => {
  it("extracts Fusion templates and bundled media from a safe DRFX zip", async () => {
    const bytes = storedZip([
      { path: "Fusion/Templates/Edit/Titles/Luxury.setting", content: "{ Tools = ordered() {} }" },
      { path: "Fusion/Templates/Edit/Titles/preview.png", content: "png" },
      { path: "ignored.txt", content: "no" },
    ]);
    const file = new File([bytes], "luxury.drfx");
    const contents = await extractDrfx(file);
    expect(contents.templates.map((entry) => entry.path)).toEqual([
      "Fusion/Templates/Edit/Titles/Luxury.setting",
    ]);
    expect(contents.assets.map((entry) => entry.path)).toEqual([
      "Fusion/Templates/Edit/Titles/preview.png",
    ]);
  });

  it("rejects path traversal", async () => {
    const bytes = storedZip([{ path: "../bad.setting", content: "{}" }]);
    await expect(extractDrfx(new File([bytes], "bad.drfx"))).rejects.toThrow("Unsafe path");
  });

  it("opens an Envato zip with a nested DRFX package", async () => {
    const nested = storedZip([
      { path: "Fusion/Templates/Edit/Titles/Orathis.setting", content: "{ Tools = ordered() {} }" },
      { path: "Fusion/Templates/Edit/Titles/gold.png", content: "png" },
    ]);
    const outer = storedZip([
      { path: "Orathis Luxury/Orathis.drfx", content: nested },
      { path: "Orathis Luxury/readme.txt", content: "Install the title" },
    ]);
    const contents = await extractDrfx(new File([outer], "envato-download.zip"));
    expect(contents.templates[0]?.path).toContain("Orathis.setting");
    expect(contents.assets[0]?.path).toContain("gold.png");
  });

  it("explains why a Resolve project archive cannot be imported", async () => {
    const bytes = storedZip([{ path: "Project/Brand_Intro.drp", content: "project" }]);
    await expect(extractDrfx(new File([bytes], "project.zip"))).rejects.toThrow(
      "project archive (.drp/.dra)",
    );
  });
});
