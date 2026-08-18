// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectTabBar } from "./ProjectTabBar";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function renderTabs(overrides: Partial<React.ComponentProps<typeof ProjectTabBar>> = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const props: React.ComponentProps<typeof ProjectTabBar> = {
    projects: [
      { id: "main", title: "Main" },
      { id: "brand-cut", title: "Brand Cut" },
    ],
    archivedProjects: [],
    activeProjectId: "main",
    creating: false,
    archivingProjectId: null,
    error: null,
    onSelect: vi.fn(),
    onOpenView: vi.fn(),
    onCreate: vi.fn(),
    onArchive: vi.fn(),
    onUnarchive: vi.fn(),
    onRename: vi.fn(),
    ...overrides,
  };
  act(() => root.render(<ProjectTabBar {...props} />));
  return { host, root, props };
}

describe("ProjectTabBar", () => {
  it("switches whole projects and offers a new workspace", () => {
    const { host, root, props } = renderTabs();
    const brandTab = Array.from(host.querySelectorAll<HTMLButtonElement>("[role=tab]")).find(
      (tab) => tab.textContent === "Brand Cut",
    );
    const addButton = host.querySelector<HTMLButtonElement>('[aria-label="Project actions"]');
    if (!brandTab || !addButton) throw new Error("project controls not rendered");

    act(() => brandTab.click());
    act(() => addButton.click());
    const createButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Create new"),
    );
    if (!createButton) throw new Error("create action not rendered");
    act(() => createButton.click());

    expect(props.onSelect).toHaveBeenCalledWith("brand-cut");
    expect(props.onCreate).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it("archives a project without selecting it", () => {
    const { host, root, props } = renderTabs();
    const archiveButton = host.querySelector<HTMLButtonElement>(
      '[aria-label="Archive Brand Cut (brand-cut)"]',
    );
    if (!archiveButton) throw new Error("archive action not rendered");

    act(() => archiveButton.click());

    expect(props.onArchive).toHaveBeenCalledWith("brand-cut");
    expect(props.onSelect).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("restores an archived project from the plus menu", () => {
    const { host, root, props } = renderTabs({
      archivedProjects: [{ id: "old-cut", title: "Old Cut" }],
    });
    const addButton = host.querySelector<HTMLButtonElement>('[aria-label="Project actions"]');
    if (!addButton) throw new Error("project actions not rendered");
    act(() => addButton.click());
    const unarchiveButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Unarchive"),
    );
    if (!unarchiveButton) throw new Error("unarchive action not rendered");
    act(() => unarchiveButton.click());
    const restoreButton = host.querySelector<HTMLButtonElement>(
      '[aria-label="Restore Old Cut (old-cut)"]',
    );
    if (!restoreButton) throw new Error("archived project not rendered");
    act(() => restoreButton.click());

    expect(props.onUnarchive).toHaveBeenCalledWith("old-cut");
    act(() => root.unmount());
  });

  it("shows the connected storyboard and preview on hover", () => {
    const { host, root, props } = renderTabs();
    const mainTab = Array.from(host.querySelectorAll<HTMLButtonElement>("[role=tab]")).find(
      (tab) => tab.textContent === "Main",
    );
    if (!mainTab) throw new Error("main project tab not rendered");
    act(() => mainTab.focus());

    const storyboard = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Storyboard"),
    );
    const preview = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Preview"),
    );
    if (!storyboard || !preview) throw new Error("project view flyout not rendered");
    act(() => storyboard.click());
    act(() => preview.click());

    expect(props.onOpenView).toHaveBeenNthCalledWith(1, "main", "storyboard");
    expect(props.onOpenView).toHaveBeenNthCalledWith(2, "main", "timeline");
    act(() => root.unmount());
  });

  it("renames a project inline after a right-click", () => {
    const { host, root, props } = renderTabs();
    const tab = host.querySelector<HTMLElement>('[role="tab"]');
    if (!tab) throw new Error("project tab not rendered");
    act(() =>
      tab.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
    );
    const input = host.querySelector<HTMLInputElement>('[aria-label="Rename Main"]');
    if (!input) throw new Error("rename input not rendered");
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "Instagram Reference");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));

    expect(props.onRename).toHaveBeenCalledWith("main", "Instagram Reference");
    act(() => root.unmount());
  });
});
