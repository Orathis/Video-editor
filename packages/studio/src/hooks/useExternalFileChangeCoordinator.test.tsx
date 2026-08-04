// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioFileConflictError } from "../utils/studioSaveDiagnostics";
import { markStudioWriteToken, resetStudioWriteTokens } from "../utils/studioFileVersion";
import {
  useExternalFileChangeCoordinator,
  type ExternalFileChangeCoordinatorHandle,
} from "./useExternalFileChangeCoordinator";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HotHandler = (payload?: unknown) => void;

describe("external file change coordinator", () => {
  let handler: HotHandler | null;

  beforeEach(() => {
    handler = null;
    resetStudioWriteTokens();
    vi.stubGlobal("__HF_STUDIO_HOT_TEST_ADAPTER__", {
      on: (_event: string, next: HotHandler) => {
        handler = next;
      },
      off: () => {
        handler = null;
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("drains pending source work before reloading Preview and SDK exactly once", async () => {
    const order: string[] = [];
    const captured: { handle: ExternalFileChangeCoordinatorHandle | null } = { handle: null };
    const root = createRoot(document.createElement("div"));

    function Probe() {
      captured.handle = useExternalFileChangeCoordinator({
        projectId: "project-a",
        activeCompPath: "index.html",
        pendingTimelineEditPathRef: { current: new Set() },
        drainPendingChanges: async () => {
          order.push("drain");
          return { status: "clean" };
        },
        reloadPreview: () => order.push("preview"),
        reloadSdkSession: () => order.push("sdk"),
        persistConflictSnapshot: vi.fn(async () => undefined),
        discardPendingChanges: vi.fn(),
        overwriteConflict: vi.fn(async () => undefined),
        readProjectFile: vi.fn(async () => "external"),
      });
      return null;
    }

    await act(async () => root.render(<Probe />));
    await act(async () => handler?.({ path: "index.html", content: "external", version: "v2" }));
    expect(order).toEqual(["drain", "preview", "sdk"]);
    expect(captured.handle?.blocked).toBeNull();

    await act(async () => root.unmount());
  });

  it("suppresses an exact Studio write receipt without draining or reloading", async () => {
    const drainPendingChanges = vi.fn(async () => ({ status: "clean" as const }));
    const reloadPreview = vi.fn();
    const reloadSdkSession = vi.fn();
    const root = createRoot(document.createElement("div"));

    function Probe() {
      useExternalFileChangeCoordinator({
        projectId: "project-a",
        activeCompPath: "index.html",
        pendingTimelineEditPathRef: { current: new Set() },
        drainPendingChanges,
        reloadPreview,
        reloadSdkSession,
        persistConflictSnapshot: vi.fn(async () => undefined),
        discardPendingChanges: vi.fn(),
        overwriteConflict: vi.fn(async () => undefined),
        readProjectFile: vi.fn(async () => "external"),
      });
      return null;
    }

    await act(async () => root.render(<Probe />));
    markStudioWriteToken("studio-write-1");
    await act(async () =>
      handler?.({ path: "index.html", content: "studio", writeToken: "studio-write-1" }),
    );

    expect(drainPendingChanges).not.toHaveBeenCalled();
    expect(reloadPreview).not.toHaveBeenCalled();
    expect(reloadSdkSession).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("does not mistake a racing external write for a pending timeline echo by path alone", async () => {
    const pendingTimelineEditPathRef = { current: new Set(["index.html"]) };
    const drainPendingChanges = vi.fn(async () => ({ status: "clean" as const }));
    const reloadPreview = vi.fn();
    const reloadSdkSession = vi.fn();
    const root = createRoot(document.createElement("div"));

    function Probe() {
      useExternalFileChangeCoordinator({
        projectId: "project-a",
        activeCompPath: "index.html",
        pendingTimelineEditPathRef,
        drainPendingChanges,
        reloadPreview,
        reloadSdkSession,
        persistConflictSnapshot: vi.fn(async () => undefined),
        discardPendingChanges: vi.fn(),
        overwriteConflict: vi.fn(async () => undefined),
        readProjectFile: vi.fn(async () => "external"),
      });
      return null;
    }

    await act(async () => root.render(<Probe />));
    await act(async () => handler?.({ path: "index.html", content: "agent edit", version: "v2" }));

    expect(pendingTimelineEditPathRef.current).not.toContain("index.html");
    expect(drainPendingChanges).toHaveBeenCalledOnce();
    expect(reloadPreview).toHaveBeenCalledOnce();
    expect(reloadSdkSession).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("blocks both reloads and retains the complete conflict", async () => {
    const conflict = new StudioFileConflictError({
      filePath: "index.html",
      currentVersion: "v2",
      currentContent: "external",
      attemptedContent: "studio",
    });
    const reloadPreview = vi.fn();
    const reloadSdkSession = vi.fn();
    const persistConflictSnapshot = vi.fn(async () => undefined);
    const captured: { handle: ExternalFileChangeCoordinatorHandle | null } = { handle: null };
    const root = createRoot(document.createElement("div"));

    function Probe() {
      captured.handle = useExternalFileChangeCoordinator({
        projectId: "project-a",
        activeCompPath: "index.html",
        pendingTimelineEditPathRef: { current: new Set() },
        drainPendingChanges: async () => ({ status: "conflict", error: conflict }),
        reloadPreview,
        reloadSdkSession,
        persistConflictSnapshot,
        discardPendingChanges: vi.fn(),
        overwriteConflict: vi.fn(async () => undefined),
        readProjectFile: vi.fn(async () => "external"),
      });
      return null;
    }

    await act(async () => root.render(<Probe />));
    await act(async () => handler?.({ path: "index.html", content: "external", version: "v2" }));

    expect(persistConflictSnapshot).toHaveBeenCalledWith("project-a", conflict);
    expect(captured.handle?.blocked).toMatchObject({ status: "conflict", error: conflict });
    expect(reloadPreview).not.toHaveBeenCalled();
    expect(reloadSdkSession).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it("ignores stale drain completion after a newer external generation", async () => {
    const drains: Array<(result: { status: "clean" }) => void> = [];
    const reloadPreview = vi.fn();
    const reloadSdkSession = vi.fn();
    const root = createRoot(document.createElement("div"));

    function Probe() {
      useExternalFileChangeCoordinator({
        projectId: "project-a",
        activeCompPath: "index.html",
        pendingTimelineEditPathRef: { current: new Set() },
        drainPendingChanges: () =>
          new Promise((resolve) => {
            drains.push(resolve);
          }),
        reloadPreview,
        reloadSdkSession,
        persistConflictSnapshot: vi.fn(async () => undefined),
        discardPendingChanges: vi.fn(),
        overwriteConflict: vi.fn(async () => undefined),
        readProjectFile: vi.fn(async () => "external"),
      });
      return null;
    }

    await act(async () => root.render(<Probe />));
    act(() => {
      handler?.({ path: "index.html", content: "first", version: "v2" });
      handler?.({ path: "index.html", content: "second", version: "v3" });
    });
    expect(drains).toHaveLength(2);

    await act(async () => drains[0]({ status: "clean" }));
    expect(reloadPreview).not.toHaveBeenCalled();
    await act(async () => drains[1]({ status: "clean" }));
    expect(reloadPreview).toHaveBeenCalledOnce();
    expect(reloadSdkSession).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });

  it("restores a durable unresolved conflict after Studio remounts", async () => {
    const captured: { handle: ExternalFileChangeCoordinatorHandle | null } = { handle: null };
    const root = createRoot(document.createElement("div"));
    const overwriteConflict = vi.fn(async () => undefined);
    const loadConflictSnapshot = vi.fn(async () => ({
      kind: "conflict" as const,
      projectId: "project-a",
      filePath: "index.html",
      externalVersion: "v2",
      externalContent: "external",
      studioContent: "studio",
      createdAt: 100,
    }));
    function Probe() {
      captured.handle = useExternalFileChangeCoordinator({
        projectId: "project-a",
        activeCompPath: "index.html",
        recoveryFilePath: "index.html",
        pendingTimelineEditPathRef: { current: new Set() },
        drainPendingChanges: vi.fn(async () => ({ status: "clean" as const })),
        reloadPreview: vi.fn(),
        reloadSdkSession: vi.fn(),
        persistConflictSnapshot: vi.fn(async () => undefined),
        loadConflictSnapshot,
        discardPendingChanges: vi.fn(),
        overwriteConflict,
        readProjectFile: vi.fn(async () => "external"),
      });
      return null;
    }

    await act(async () => root.render(<Probe />));
    await vi.waitFor(() => expect(captured.handle?.blocked?.status).toBe("conflict"));
    expect(captured.handle?.blocked).toMatchObject({
      error: {
        filePath: "index.html",
        currentContent: "external",
        attemptedContent: "studio",
      },
    });
    await act(async () => root.unmount());
  });

  it("retains the final local candidate when a non-conflict drain fails", async () => {
    const failure = new Error("network unavailable");
    const captured: { handle: ExternalFileChangeCoordinatorHandle | null } = { handle: null };
    const root = createRoot(document.createElement("div"));
    const persistFailureSnapshot = vi.fn(async () => undefined);
    const deleteConflictSnapshot = vi.fn(async () => undefined);
    const drainPendingChanges = vi
      .fn()
      .mockResolvedValueOnce({ status: "failed" as const, error: failure })
      .mockResolvedValueOnce({ status: "clean" as const });
    function Probe() {
      captured.handle = useExternalFileChangeCoordinator({
        projectId: "project-a",
        activeCompPath: "index.html",
        pendingTimelineEditPathRef: { current: new Set() },
        drainPendingChanges,
        getPendingCandidate: () => ({ path: "index.html", content: "final local candidate" }),
        reloadPreview: vi.fn(),
        reloadSdkSession: vi.fn(),
        persistConflictSnapshot: vi.fn(async () => undefined),
        persistFailureSnapshot,
        deleteConflictSnapshot,
        discardPendingChanges: vi.fn(),
        overwriteConflict: vi.fn(async () => undefined),
        readProjectFile: vi.fn(async () => "external"),
      });
      return null;
    }
    await act(async () => root.render(<Probe />));
    await act(async () => handler?.({ path: "index.html" }));

    expect(captured.handle?.blocked).toMatchObject({
      status: "failed",
      error: failure,
      studioContent: "final local candidate",
    });
    expect(persistFailureSnapshot).toHaveBeenCalledWith(
      "project-a",
      "index.html",
      "final local candidate",
      null,
      null,
      failure,
    );
    await act(async () => captured.handle?.retry());
    expect(deleteConflictSnapshot).toHaveBeenCalledWith("project-a", "index.html");
    await act(async () => root.unmount());
  });

  it("restores a durable failed draft without treating it as a clean reload", async () => {
    const captured: { handle: ExternalFileChangeCoordinatorHandle | null } = { handle: null };
    const root = createRoot(document.createElement("div"));
    const overwriteConflict = vi.fn(async () => undefined);
    const loadConflictSnapshot = vi.fn(async () => ({
      kind: "failed" as const,
      projectId: "project-a",
      filePath: "index.html",
      externalVersion: "v2",
      externalContent: "external",
      studioContent: "recover me",
      failureMessage: "network unavailable",
      createdAt: 100,
    }));
    function Probe() {
      captured.handle = useExternalFileChangeCoordinator({
        projectId: "project-a",
        activeCompPath: "index.html",
        recoveryFilePath: "index.html",
        pendingTimelineEditPathRef: { current: new Set() },
        drainPendingChanges: vi.fn(async () => ({ status: "clean" as const })),
        reloadPreview: vi.fn(),
        reloadSdkSession: vi.fn(),
        persistConflictSnapshot: vi.fn(async () => undefined),
        loadConflictSnapshot,
        discardPendingChanges: vi.fn(),
        overwriteConflict,
        readProjectFile: vi.fn(async () => "external"),
      });
      return null;
    }

    await act(async () => root.render(<Probe />));
    await vi.waitFor(() => expect(captured.handle?.blocked?.status).toBe("failed"));
    expect(captured.handle?.blocked).toMatchObject({
      status: "failed",
      path: "index.html",
      studioContent: "recover me",
      recovered: true,
      error: { message: "network unavailable" },
    });
    await act(async () => captured.handle?.keepStudioFile());
    expect(overwriteConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: "index.html",
        currentVersion: "v2",
        currentContent: "external",
        attemptedContent: "recover me",
      }),
    );
    await act(async () => root.unmount());
  });
});
