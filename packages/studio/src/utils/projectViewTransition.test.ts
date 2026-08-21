import { describe, expect, it } from "vitest";
import { resolveProjectTransferDirection } from "./projectViewTransition";

const projects = [{ id: "reference" }, { id: "cut-a" }, { id: "cut-b" }];

describe("resolveProjectTransferDirection", () => {
  it("moves forward for a tab to the right", () => {
    expect(resolveProjectTransferDirection(projects, "reference", "cut-b")).toBe("forward");
  });

  it("moves back for a tab to the left", () => {
    expect(resolveProjectTransferDirection(projects, "cut-b", "reference")).toBe("back");
  });

  it("defaults forward when a project is not in the visible tab list", () => {
    expect(resolveProjectTransferDirection(projects, "reference", "new-project")).toBe("forward");
  });
});
