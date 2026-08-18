// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoryboardFrameView } from "../../hooks/useStoryboard";
import { StoryboardFrameTile } from "./StoryboardFrameTile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const FRAME: StoryboardFrameView = {
  index: 1,
  number: 1,
  title: "Hook",
  status: "outline",
  narrative: "Opening frame",
  extra: {},
  srcExists: false,
};

function renderTile(deleteDisabled = false) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onDelete = vi.fn();
  act(() => {
    root.render(
      <StoryboardFrameTile
        projectId="demo"
        frame={FRAME}
        onOpen={vi.fn()}
        commentDraft=""
        onCommentDraftChange={vi.fn()}
        pendingComment={null}
        onDurationChange={vi.fn()}
        onTransitionChange={vi.fn()}
        onImageDrop={vi.fn()}
        onDelete={onDelete}
        deleting={false}
        deleteDisabled={deleteDisabled}
      />,
    );
  });
  return { host, root, onDelete };
}

describe("StoryboardFrameTile deletion", () => {
  it("deletes the frame from the top-right action", () => {
    const { host, root, onDelete } = renderTile();
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Delete Hook"]');
    if (!button) throw new Error("delete action not rendered");

    act(() => button.click());

    expect(onDelete).toHaveBeenCalledWith(1);
    act(() => root.unmount());
  });

  it("protects the last remaining frame", () => {
    const { host, root, onDelete } = renderTile(true);
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Delete Hook"]');
    if (!button) throw new Error("delete action not rendered");

    expect(button.disabled).toBe(true);
    act(() => button.click());
    expect(onDelete).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
