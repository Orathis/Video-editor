// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoryboardDirection } from "./StoryboardDirection";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function renderDirection() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onSelectStoryboard = vi.fn();
  const onCreateStoryboard = vi.fn(async () => true);
  const onRenameStoryboard = vi.fn(async () => true);
  const onArchiveStoryboard = vi.fn(async () => true);
  const onUnarchiveStoryboard = vi.fn(async () => true);
  const onToggleComparisonSelection = vi.fn();
  act(() => {
    root.render(
      <StoryboardDirection
        frameCount={4}
        storyboards={[
          { path: "STORYBOARD.md", label: "Main" },
          { path: "storyboards/reference.md", label: "Instagram reference" },
        ]}
        archivedStoryboards={[{ path: "storyboards/old.md", label: "Old cut" }]}
        activePath="STORYBOARD.md"
        onSelectStoryboard={onSelectStoryboard}
        onCreateStoryboard={onCreateStoryboard}
        onRenameStoryboard={onRenameStoryboard}
        onArchiveStoryboard={onArchiveStoryboard}
        onUnarchiveStoryboard={onUnarchiveStoryboard}
        creatingStoryboard={false}
        mutatingStoryboardPath={null}
        error={null}
        onToggleComparisonSelection={onToggleComparisonSelection}
      />,
    );
  });
  return {
    host,
    root,
    onSelectStoryboard,
    onCreateStoryboard,
    onRenameStoryboard,
    onArchiveStoryboard,
    onUnarchiveStoryboard,
    onToggleComparisonSelection,
  };
}

describe("StoryboardDirection", () => {
  it("switches between storyboards in the same project", () => {
    const { host, root, onSelectStoryboard } = renderDirection();
    const trigger = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Storyboard"),
    );
    if (!trigger) throw new Error("storyboard switcher not rendered");
    act(() => trigger.click());
    const reference = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Instagram reference",
    );
    if (!reference) throw new Error("saved storyboard not rendered");

    act(() => reference.click());

    expect(onSelectStoryboard).toHaveBeenCalledWith("storyboards/reference.md");
    act(() => root.unmount());
  });

  it("creates a named storyboard from the switcher", async () => {
    const { host, root, onCreateStoryboard } = renderDirection();
    const trigger = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Storyboard"),
    );
    if (!trigger) throw new Error("storyboard switcher not rendered");
    act(() => trigger.click());
    const newButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("New storyboard"),
    );
    if (!newButton) throw new Error("new storyboard action not rendered");
    act(() => newButton.click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="New storyboard name"]');
    if (!input) throw new Error("storyboard name input not rendered");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Template version A");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const createButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Create storyboard",
    );
    if (!createButton) throw new Error("create storyboard button not rendered");
    await act(async () => createButton.click());

    expect(onCreateStoryboard).toHaveBeenCalledWith("Template version A");
    act(() => root.unmount());
  });

  it("renames a storyboard from its right-click menu", async () => {
    const { host, root, onRenameStoryboard } = renderDirection();
    const trigger = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Storyboard"),
    );
    if (!trigger) throw new Error("storyboard switcher not rendered");
    act(() => trigger.click());
    const reference = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Instagram reference",
    );
    if (!reference) throw new Error("saved storyboard not rendered");
    act(() => reference.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true })));
    const rename = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Rename",
    );
    if (!rename) throw new Error("rename action not rendered");
    act(() => rename.click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Rename Instagram reference"]');
    if (!input) throw new Error("rename input not rendered");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Reference template");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );

    expect(onRenameStoryboard).toHaveBeenCalledWith(
      "storyboards/reference.md",
      "Reference template",
    );
    act(() => root.unmount());
  });

  it("archives active boards and restores archived boards", async () => {
    const { host, root, onArchiveStoryboard, onUnarchiveStoryboard } = renderDirection();
    const trigger = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Storyboard"),
    );
    if (!trigger) throw new Error("storyboard switcher not rendered");
    act(() => trigger.click());
    const reference = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Instagram reference",
    );
    if (!reference) throw new Error("saved storyboard not rendered");
    act(() => reference.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true })));
    const archive = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Archive",
    );
    if (!archive) throw new Error("archive action not rendered");
    await act(async () => archive.click());
    expect(onArchiveStoryboard).toHaveBeenCalledWith("storyboards/reference.md");

    const oldCut = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Old cut"),
    );
    if (!oldCut) throw new Error("archived storyboard not rendered");
    await act(async () => oldCut.click());
    expect(onUnarchiveStoryboard).toHaveBeenCalledWith("storyboards/old.md");
    act(() => root.unmount());
  });

  it("reserves shift-clicks in the storyboard switcher for comparison", () => {
    const { host, root, onSelectStoryboard, onToggleComparisonSelection } = renderDirection();
    const trigger = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Storyboard"),
    );
    if (!trigger) throw new Error("storyboard switcher not rendered");
    act(() => trigger.click());
    const reference = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Instagram reference",
    );
    if (!reference) throw new Error("saved storyboard not rendered");
    act(() => reference.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));

    expect(onToggleComparisonSelection).toHaveBeenCalledWith("storyboards/reference.md");
    expect(onSelectStoryboard).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
