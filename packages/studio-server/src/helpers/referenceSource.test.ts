import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadRemoteReference, inferReferenceTitle } from "./referenceSource.js";

const directories: string[] = [];

afterEach(() => {
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("reference source imports", () => {
  it("generates useful titles from uploaded files and social URLs", () => {
    expect(inferReferenceTitle("assets/references/summer_launch-cut_v2.mp4")).toBe(
      "Summer Launch Cut V2",
    );
    expect(inferReferenceTitle("https://www.instagram.com/reel/ABC123/")).toBe("Instagram ABC123");
  });

  it("downloads a public direct video link into the project", async () => {
    const projectDir = mkdtempSync(join(tmpdir(), "reference-link-"));
    directories.push(projectDir);
    const fetchReference = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            "content-type": "video/mp4",
            "content-disposition": 'attachment; filename="Launch Cut.mp4"',
          },
        }),
    );
    const result = await downloadRemoteReference({
      url: "https://cdn.example.com/source",
      projectDir,
      fetchReference,
      lookupAddresses: async () => ["203.0.113.12"],
    });

    expect(result.title).toBe("Launch Cut");
    expect(result.assetPath).toMatch(/^assets\/references\/launch-cut-[a-f0-9]{8}\.mp4$/);
    expect(existsSync(result.sourcePath)).toBe(true);
    expect([...readFileSync(result.sourcePath)]).toEqual([1, 2, 3]);
  });

  it("blocks private network targets before fetching", async () => {
    const fetchReference = vi.fn();
    await expect(
      downloadRemoteReference({
        url: "http://internal.example/video.mp4",
        projectDir: tmpdir(),
        fetchReference,
        lookupAddresses: async () => ["192.168.1.50"],
      }),
    ).rejects.toThrow("private network");
    expect(fetchReference).not.toHaveBeenCalled();
  });

  it("resolves Instagram post pages through the social extractor", async () => {
    const projectDir = mkdtempSync(join(tmpdir(), "reference-social-"));
    directories.push(projectDir);
    const sourcePath = join(projectDir, "assets", "references", "creator-launch-DVV.mp4");
    const socialDownload = vi.fn(async () => {
      mkdirSync(join(projectDir, "assets", "references"), { recursive: true });
      writeFileSync(sourcePath, "video");
      return sourcePath;
    });
    const fetchReference = vi.fn();
    const result = await downloadRemoteReference({
      url: "https://www.instagram.com/p/DVV_FRMDLV4/",
      projectDir,
      fetchReference,
      socialDownload,
      lookupAddresses: async () => ["157.240.241.174"],
    });

    expect(result.assetPath).toBe("assets/references/creator-launch-DVV.mp4");
    expect(result.title).toBe("Creator Launch DVV");
    expect(socialDownload).toHaveBeenCalledWith({
      url: "https://www.instagram.com/p/DVV_FRMDLV4/",
      projectDir,
      maxBytes: null,
    });
    expect(fetchReference).not.toHaveBeenCalled();
  });
});
