// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoryboardFrameView } from "../../hooks/useStoryboard";
import { StoryboardReviewGuide } from "./StoryboardReviewGuide";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("StoryboardReviewGuide", () => {
  it("keeps review controls without rendering instructional prose", () => {
    const frames: StoryboardFrameView[] = [
      {
        index: 1,
        number: 1,
        title: "Thesis",
        status: "outline",
        narrative: "",
        extra: {},
        srcExists: false,
      },
    ];
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <StoryboardReviewGuide
          frames={frames}
          draftCount={0}
          pendingCount={0}
          onFeedbackMessageCopied={vi.fn()}
        />,
      );
    });

    expect(host.textContent).toContain("Ready for review");
    expect(host.textContent).toContain("1 Outline");
    expect(host.textContent).toContain("Copy approval message");
    expect(host.textContent).not.toContain("Review the story plan");
    expect(host.textContent).not.toContain("Check the sequence, scene direction");
    expect(host.textContent).not.toContain("Add comments where you want changes");

    act(() => root.unmount());
  });
});
