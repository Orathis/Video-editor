// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore, type TimelineElement } from "../player";
import { toggleTimelineTrackLocked } from "./timelineTrackLocking";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  usePlayerStore.getState().reset();
});

function element(overrides: Partial<TimelineElement>): TimelineElement {
  return { id: "clip", tag: "div", start: 0, duration: 2, track: 0, ...overrides };
}

function stubProjectFiles(files: Map<string, string>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = decodeURIComponent(String(input).slice(String(input).lastIndexOf("/") + 1));
      const content = files.get(path);
      return new Response(JSON.stringify({ content }), {
        status: content === undefined ? 404 : 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

describe("toggleTimelineTrackLocked", () => {
  it("locks every clip on the track in one source-backed history entry", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    iframe.contentDocument!.body.innerHTML = '<div id="hero"></div><div id="title"></div>';
    stubProjectFiles(
      new Map([
        [
          "index.html",
          '<div id="hero" data-start="0" data-duration="2"></div>\n<div id="title" data-start="2" data-duration="2"></div>',
        ],
      ]),
    );
    const hero = element({ id: "hero", key: "hero", domId: "hero" });
    const title = element({ id: "title", key: "title", domId: "title" });
    usePlayerStore.getState().setElements([hero, title]);
    const writes = new Map<string, string>();
    const recordEdit = vi.fn();

    await toggleTimelineTrackLocked({
      projectId: "project-1",
      activeCompPath: "index.html",
      timelineElements: [hero, title],
      track: 0,
      locked: true,
      previewIframe: iframe,
      writeProjectFile: async (path, content) => void writes.set(path, content),
      recordEdit,
      domEditSaveTimestampRef: { current: 0 },
      pendingTimelineEditPathRef: { current: new Set() },
    });

    expect(writes.get("index.html")?.match(/data-timeline-locked=""/g)).toHaveLength(2);
    expect(
      iframe.contentDocument?.getElementById("hero")?.hasAttribute("data-timeline-locked"),
    ).toBe(true);
    expect(usePlayerStore.getState().elements.every((item) => item.timelineLocked)).toBe(true);
    expect(recordEdit).toHaveBeenCalledTimes(1);
    expect(recordEdit.mock.calls[0]?.[0]?.label).toBe("Lock track 1");
  });

  it("removes the source lock from every clip on the track", async () => {
    stubProjectFiles(
      new Map([
        [
          "index.html",
          '<div id="hero" data-start="0" data-duration="2" data-timeline-locked=""></div>',
        ],
      ]),
    );
    const writes = new Map<string, string>();

    await toggleTimelineTrackLocked({
      projectId: "project-1",
      activeCompPath: "index.html",
      timelineElements: [element({ id: "hero", domId: "hero", timelineLocked: true })],
      track: 0,
      locked: false,
      previewIframe: null,
      writeProjectFile: async (path, content) => void writes.set(path, content),
      recordEdit: vi.fn(),
      domEditSaveTimestampRef: { current: 0 },
      pendingTimelineEditPathRef: { current: new Set() },
    });

    expect(writes.get("index.html")).not.toContain("data-timeline-locked");
  });
});
