import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const trackEvent = vi.fn();
vi.mock("./client.js", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  shouldTrack: () => true,
}));

const { writePrimitiveFunnelContext } = await import("./primitive-funnel-state.js");
const {
  trackPrimitivePreviewSucceeded,
  trackPrimitiveRenderFailed,
  trackPrimitiveRenderSucceeded,
} = await import("./primitive-funnel-command.js");

describe("persisted primitive funnel command continuity", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "hf-funnel-command-"));
    trackEvent.mockReset();
    writePrimitiveFunnelContext(projectDir, {
      funnelId: "funnel-command",
      installId: "install-command",
      primitiveId: "thread-message-stack",
      artifactId: "artifact-command",
      versionId: "version-command",
      catalogVersion: "catalog-command",
      queryFingerprint: "sha256:query",
    });
  });

  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it("propagates bounded command duration and deduplicates preview/render terminals", () => {
    trackPrimitivePreviewSucceeded(projectDir, 12.4);
    trackPrimitivePreviewSucceeded(projectDir, 98);
    trackPrimitiveRenderFailed(projectDir, "render_failed", 23.6);
    trackPrimitiveRenderSucceeded(projectDir, 99);

    expect(trackEvent.mock.calls.map(([name]) => name)).toEqual([
      "primitive_preview_succeeded",
      "primitive_render_failed",
    ]);
    expect(trackEvent.mock.calls[0]?.[1]).toMatchObject({
      funnel_id: "funnel-command",
      primitive_id: "thread-message-stack",
      duration_ms: 12,
      event_id: "install-command:preview",
    });
    expect(trackEvent.mock.calls[1]?.[1]).toMatchObject({
      funnel_id: "funnel-command",
      duration_ms: 24,
      error_code: "render_failed",
      event_id: "install-command:render",
    });
  });
});
