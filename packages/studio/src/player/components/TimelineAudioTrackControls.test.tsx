// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "../store/playerStore";
import { TimelineAudioTrackControls } from "./TimelineAudioTrackControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  usePlayerStore.setState({
    mutedTimelineTracks: new Set(),
    soloTimelineTracks: new Set(),
  });
  document.body.replaceChildren();
});

describe("TimelineAudioTrackControls", () => {
  it("toggles preview-only mute and solo and identifies linked embedded audio", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(<TimelineAudioTrackControls track={4} hasEmbeddedVideoAudio />));

    const mute = host.querySelector<HTMLButtonElement>('button[aria-label="Mute audio track"]');
    const solo = host.querySelector<HTMLButtonElement>('button[aria-label="Solo audio track"]');
    expect(host.querySelector('[aria-label="Video and embedded audio are linked"]')).not.toBeNull();
    act(() => mute?.click());
    act(() => solo?.click());
    expect(usePlayerStore.getState().mutedTimelineTracks.has(4)).toBe(true);
    expect(usePlayerStore.getState().soloTimelineTracks.has(4)).toBe(true);
    expect(mute?.getAttribute("aria-pressed")).toBe("true");
    expect(solo?.getAttribute("aria-pressed")).toBe("true");
    act(() => root.unmount());
  });
});
