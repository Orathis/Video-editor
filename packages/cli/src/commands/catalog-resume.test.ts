import { describe, expect, it, vi } from "vitest";
import {
  createPrimitiveInstallIntent,
  filterPrimitiveCatalogItems,
  resumePrimitiveInstallExactlyOnce,
  type PendingPrimitiveInstall,
  type PrimitiveInstallStateStore,
} from "./catalog-resume.js";

function memoryStore(): PrimitiveInstallStateStore {
  let state: PendingPrimitiveInstall | null = null;
  return {
    load: async () => state,
    save: async (next) => {
      state = next;
    },
  };
}

// Anonymous discovery and resume invariants share one coordinator fixture.
// fallow-ignore-next-line unit-size
describe("catalog OAuth resume", () => {
  it("supports anonymous content-free discovery before selection", () => {
    const items = [
      { name: "thread-message-stack", title: "Thread Message Stack", description: "Conversation" },
      { name: "shader-wipe", title: "Shader Wipe", description: "Transition" },
    ];
    expect(filterPrimitiveCatalogItems(items, " conversation ").map((item) => item.name)).toEqual([
      "thread-message-stack",
    ]);
    expect(filterPrimitiveCatalogItems(items, "")).toEqual(items);
  });

  it("preserves a non-content search fingerprint and resumes the same selection exactly once", async () => {
    const store = memoryStore();
    const authenticate = vi.fn(async () => true);
    const install = vi.fn(async () => undefined);
    let authenticated = false;
    authenticate.mockImplementation(async () => {
      authenticated = true;
      return true;
    });
    const intent = createPrimitiveInstallIntent({
      itemName: "thread-message-stack",
      query: "private authored search text",
      artifactId: "21c28523-7487-43e1-927d-43a7fe855859",
      versionId: "1aa00c22-b508-4b81-a3a1-4702453d48c2",
      funnelId: "funnel-1",
      installId: "install-1",
    });

    expect(JSON.stringify(intent)).not.toContain("private authored search text");
    const deps = {
      store,
      isAuthenticated: async () => authenticated,
      authenticate,
      install,
    };
    await expect(resumePrimitiveInstallExactlyOnce(intent, deps)).resolves.toBe("installed");
    await expect(resumePrimitiveInstallExactlyOnce(intent, deps)).resolves.toBe(
      "already-installed",
    );
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledWith(expect.objectContaining({ itemName: intent.itemName }));
  });

  it.each(["cancelled", "failed"] as const)(
    "installs nothing when OAuth is %s",
    async (outcome) => {
      const install = vi.fn(async () => undefined);
      const intent = createPrimitiveInstallIntent({
        itemName: "thread-message-stack",
        query: "thread",
        artifactId: "21c28523-7487-43e1-927d-43a7fe855859",
        versionId: "1aa00c22-b508-4b81-a3a1-4702453d48c2",
        funnelId: `funnel-${outcome}`,
        installId: `install-${outcome}`,
      });

      await expect(
        resumePrimitiveInstallExactlyOnce(intent, {
          store: memoryStore(),
          isAuthenticated: async () => false,
          authenticate: async () => outcome,
          install,
        }),
      ).resolves.toBe(outcome);
      expect(install).not.toHaveBeenCalled();
    },
  );
});
