import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  previewLaunchMode,
  previewLaunchModeError,
  previewViteArgs,
  studioLandingSearch,
  waitForStudioChildClose,
} from "./preview.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function projectWith(storyboard: string | null, frameFiles: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), "hf-preview-landing-"));
  tempDirs.push(dir);
  if (storyboard !== null) writeFileSync(join(dir, "STORYBOARD.md"), storyboard);
  for (const file of frameFiles) {
    mkdirSync(join(dir, file, ".."), { recursive: true });
    writeFileSync(join(dir, file), "<div></div>");
  }
  return dir;
}

const FRAME = (n: number, status: string) =>
  `## Frame ${n} — F${n}\n- status: ${status}\n- src: compositions/frames/0${n}.html\n\nBeat.\n`;

describe("studioLandingSearch", () => {
  it("returns no search without a storyboard", () => {
    expect(studioLandingSearch(projectWith(null))).toBe("");
  });

  it("lands on the board while sketches are under review (any built frame)", () => {
    const dir = projectWith(`${FRAME(1, "built")}${FRAME(2, "outline")}`, [
      "compositions/frames/01.html",
    ]);
    expect(studioLandingSearch(dir)).toBe("?view=storyboard");
  });

  it("lands on the board during pure planning (srcs declared, none exist)", () => {
    const dir = projectWith(`${FRAME(1, "outline")}${FRAME(2, "outline")}`);
    expect(studioLandingSearch(dir)).toBe("?view=storyboard");
  });

  it("lands on the timeline once frames exist without a built status", () => {
    const dir = projectWith(`${FRAME(1, "outline")}`, ["compositions/frames/01.html"]);
    expect(studioLandingSearch(dir)).toBe("");
  });

  it("lands on the timeline for fully animated boards", () => {
    const dir = projectWith(`${FRAME(1, "animated")}`, ["compositions/frames/01.html"]);
    expect(studioLandingSearch(dir)).toBe("");
  });
});

describe("previewLaunchMode", () => {
  it.each([
    [
      {
        background: false,
        foreground: false,
        interactive: false,
        devMode: false,
        localStudio: false,
      },
      "background",
    ],
    [
      {
        background: false,
        foreground: false,
        interactive: true,
        devMode: false,
        localStudio: false,
      },
      "embedded",
    ],
    [
      {
        background: false,
        foreground: true,
        interactive: false,
        devMode: true,
        localStudio: false,
      },
      "dev",
    ],
    [
      {
        background: false,
        foreground: true,
        interactive: false,
        devMode: false,
        localStudio: true,
      },
      "local",
    ],
    [
      {
        background: true,
        foreground: false,
        interactive: true,
        devMode: true,
        localStudio: true,
      },
      "background",
    ],
  ] as const)("resolves %o to %s", (options, expected) => {
    expect(previewLaunchMode(options)).toBe(expected);
  });

  it("rejects conflicting lifecycle overrides", () => {
    expect(previewLaunchModeError({ background: true, foreground: true })).toBe(
      "--background and --foreground cannot be used together",
    );
    expect(previewLaunchModeError({ background: true, foreground: false })).toBeNull();
    expect(previewLaunchModeError({ background: false, foreground: true })).toBeNull();
  });

  it("pins detached Vite to the port the lifecycle scanner waits on", () => {
    expect(previewViteArgs(3032)).toEqual(["--host", "127.0.0.1", "--port", "3032"]);
  });
});

describe("waitForStudioChildClose", () => {
  it("resolves when the child closed before the listener was attached", async () => {
    const signalTarget = { once: vi.fn(), off: vi.fn() };
    const child = {
      exitCode: 1,
      signalCode: null,
      once: vi.fn(),
    } as unknown as Parameters<typeof waitForStudioChildClose>[0];

    await expect(waitForStudioChildClose(child, signalTarget)).resolves.toBeUndefined();
    expect(child.once).not.toHaveBeenCalled();
    expect(signalTarget.once).toHaveBeenCalledTimes(2);
    expect(signalTarget.off).toHaveBeenCalledTimes(2);
  });

  it("reaps on process exit even when stdio never emits close", async () => {
    let exit: (() => void) | undefined;
    const signalTarget = { once: vi.fn(), off: vi.fn() };
    const child = {
      exitCode: null,
      signalCode: null,
      once: vi.fn((event: string, listener: () => void) => {
        if (event === "exit") exit = listener;
      }),
    } as unknown as Parameters<typeof waitForStudioChildClose>[0];

    let resolved = false;
    const waiting = waitForStudioChildClose(child, signalTarget).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(child.once).toHaveBeenCalledWith("exit", expect.any(Function));

    exit?.();
    await waiting;
    expect(resolved).toBe(true);
    expect(signalTarget.off).toHaveBeenCalledTimes(2);
  });
});
