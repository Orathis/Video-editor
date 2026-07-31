import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { generateStudioLoadFixture, writeStudioLoadFixture } from "./generateStudioLoadFixture.mjs";

const temporaryProjects: string[] = [];
const CLI_LINT_PATH = fileURLToPath(
  new URL("../../../cli/src/utils/lintProject.ts", import.meta.url),
);

function createTemporaryProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "studio-load-fixture-"));
  temporaryProjects.push(projectDir);
  return projectDir;
}

function clipTags(files: Record<string, string>): string[] {
  return Object.values(files).flatMap(
    (contents) => contents.match(/<[^>]+\bclass="[^"]*\bclip\b[^"]*"[^>]*>/g) ?? [],
  );
}

function expectProjectToPassLint(projectDir: string): void {
  const program = `
    import { lintProject } from ${JSON.stringify(pathToFileURL(CLI_LINT_PATH).href)};
    const result = await lintProject(${JSON.stringify(projectDir)});
    const errors = result.results.flatMap(({ file, result }) =>
      result.findings.filter(({ severity }) => severity === "error").map((finding) => ({ file, ...finding })),
    );
    console.log(JSON.stringify({ errors, totalErrors: result.totalErrors }));
    if (result.totalErrors > 0) process.exitCode = 1;
  `;
  const result = spawnSync("bun", ["-e", program], { encoding: "utf8" });

  expect(
    { error: result.error?.message, status: result.status },
    result.stderr || result.stdout,
  ).toEqual({ error: undefined, status: 0 });
}

afterEach(() => {
  for (const projectDir of temporaryProjects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true });
  }
});

describe("generateStudioLoadFixture", () => {
  it("generates exactly 1,000 clips across every requested track", () => {
    const files = generateStudioLoadFixture({ clipCount: 1_000, trackCount: 37 });
    const tags = clipTags(files);
    const tracks = new Set(
      tags.flatMap((tag) => {
        const match = tag.match(/\bdata-track-index="(\d+)"/);
        return match ? [Number(match[1])] : [];
      }),
    );

    expect(tags).toHaveLength(1_000);
    expect([...tracks].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 37 }, (_, index) => index),
    );
  });

  it("produces byte-identical files for the same inputs", () => {
    expect(generateStudioLoadFixture({ clipCount: 1_000, trackCount: 50 })).toStrictEqual(
      generateStudioLoadFixture({ clipCount: 1_000, trackCount: 50 }),
    );
  });

  it("keeps the authored DOM id ratio below 30 percent", () => {
    const tags = clipTags(generateStudioLoadFixture({ clipCount: 1_000, trackCount: 50 }));
    const authoredIdCount = tags.filter((tag) => /\sid="[^"]+"/.test(tag)).length;

    expect(authoredIdCount / tags.length).toBeLessThan(0.3);
  });

  it("passes the HyperFrames CLI structural lint", () => {
    const projectDir = createTemporaryProject();
    writeStudioLoadFixture(projectDir, { clipCount: 1_000, trackCount: 50 });

    expectProjectToPassLint(projectDir);
  }, 15_000);

  it("references an existing sub-composition from the root", () => {
    const projectDir = createTemporaryProject();
    const files = generateStudioLoadFixture({ clipCount: 1_000, trackCount: 50 });
    writeStudioLoadFixture(projectDir, { clipCount: 1_000, trackCount: 50 });
    const reference = files["index.html"].match(/data-composition-src="([^"]+)"/)?.[1];

    expect(reference).toBeDefined();
    expect(reference && existsSync(join(projectDir, reference))).toBe(true);
  });

  it("generates a structurally valid zero-clip project", () => {
    const files = generateStudioLoadFixture({ clipCount: 0, trackCount: 1 });
    const projectDir = createTemporaryProject();
    writeStudioLoadFixture(projectDir, { clipCount: 0, trackCount: 1 });

    expect(clipTags(files)).toHaveLength(0);
    expectProjectToPassLint(projectDir);
  });
});
