// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TimelineClipRenderContext } from "./TimelineTypes";
import { TimelineEmbeddedAudioRows } from "./TimelineEmbeddedAudioRows";
import { getTimelineLaneTop } from "./timelineLayout";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => document.body.replaceChildren());

describe("TimelineEmbeddedAudioRows", () => {
  it("draws an audio-only child directly beneath an A/V video, not a standalone track", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const renderClipContent = vi.fn(
      (_element: unknown, _style: unknown, context: TimelineClipRenderContext) => (
        <span data-render-mode={context.audioOnly ? "audio" : "visual"} />
      ),
    );
    act(() => {
      root.render(
        <TimelineEmbeddedAudioRows
          elements={[
            {
              id: "interview",
              tag: "video",
              start: 2,
              duration: 4,
              track: 0,
              hasAudio: true,
            },
          ]}
          pixelsPerSecond={100}
          laneCount={2}
          labelColor="#fff"
          renderClipContent={renderClipContent}
        />,
      );
    });

    const row = host.querySelector<HTMLElement>('[data-timeline-embedded-audio="interview"]');
    expect(row?.style.left).toBe("200px");
    expect(row?.style.width).toBe("400px");
    expect(row?.style.top).toBe(`${getTimelineLaneTop(2)}px`);
    expect(row?.querySelector('[data-render-mode="audio"]')).not.toBeNull();
    expect(renderClipContent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "interview" }),
      expect.any(Object),
      expect.objectContaining({ audioOnly: true }),
    );
    act(() => root.unmount());
  });
});
