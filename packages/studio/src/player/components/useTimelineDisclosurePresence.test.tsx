// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TIMELINE_DISCLOSURE_DURATION_MS,
  useTimelineDisclosurePresence,
} from "./useTimelineDisclosurePresence";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

function Probe({ expanded }: { expanded: boolean }) {
  const disclosure = useTimelineDisclosurePresence(expanded);
  return (
    <span data-present={String(disclosure.present)} data-phase={disclosure.phase}>
      disclosure
    </span>
  );
}

describe("useTimelineDisclosurePresence", () => {
  it("keeps children present while closing, then releases them after the motion", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    act(() => root?.render(<Probe expanded />));
    expect(host.querySelector("span")?.dataset).toMatchObject({
      present: "true",
      phase: "opening",
    });
    act(() => vi.advanceTimersByTime(16));
    expect(host.querySelector("span")?.dataset).toMatchObject({
      present: "true",
      phase: "open",
    });

    act(() => root?.render(<Probe expanded={false} />));
    expect(host.querySelector("span")?.dataset).toMatchObject({
      present: "true",
      phase: "closing",
    });

    act(() => vi.advanceTimersByTime(TIMELINE_DISCLOSURE_DURATION_MS));
    expect(host.querySelector("span")?.dataset).toMatchObject({
      present: "false",
      phase: "closed",
    });
  });
});
