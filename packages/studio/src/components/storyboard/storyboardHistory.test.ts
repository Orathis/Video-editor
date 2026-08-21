import { describe, expect, it, vi } from "vitest";
import { commitStoryboardEdit } from "./storyboardHistory";

describe("commitStoryboardEdit", () => {
  it("writes storyboard source and records it in the shared source history", async () => {
    const writeFile = vi.fn(async () => {});
    const recordEdit = vi.fn(async () => {});

    const changed = await commitStoryboardEdit({
      projectId: "project-1",
      path: "STORYBOARD.md",
      before: "before",
      after: "after",
      label: "Delete storyboard frame",
      writeFile,
      recordEdit,
    });

    expect(changed).toBe(true);
    expect(writeFile).toHaveBeenCalledWith("STORYBOARD.md", "after", "before");
    expect(recordEdit).toHaveBeenCalledWith({
      label: "Delete storyboard frame",
      kind: "source",
      coalesceKey: undefined,
      coalesceMs: undefined,
      files: { "STORYBOARD.md": { before: "before", after: "after" } },
    });
  });

  it("does not create history for an unchanged edit", async () => {
    const writeFile = vi.fn(async () => {});
    const recordEdit = vi.fn(async () => {});

    const changed = await commitStoryboardEdit({
      projectId: "project-1",
      path: "STORYBOARD.md",
      before: "same",
      after: "same",
      label: "Edit storyboard",
      writeFile,
      recordEdit,
    });

    expect(changed).toBe(false);
    expect(writeFile).not.toHaveBeenCalled();
    expect(recordEdit).not.toHaveBeenCalled();
  });
});
