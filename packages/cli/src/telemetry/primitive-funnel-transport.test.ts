import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const posture = { enabled: true };
const fetchMock = vi.fn(
  async (_input: string | URL | Request, _init?: RequestInit) =>
    new Response(null, { status: 200 }),
);

vi.mock("./config.js", () => ({
  readConfig: () => ({
    anonymousId: "anonymous-transport",
    telemetryEnabled: posture.enabled,
  }),
  writeConfig: vi.fn(),
}));
vi.mock("./policy.js", () => ({ telemetryRuntimeOverride: () => null }));
vi.mock("./system.js", () => ({
  getSystemMeta: () => ({
    os_release: "test",
    cpu_count: 1,
    memory_total_mb: 1,
    is_docker: false,
    is_ci: true,
    is_wsl: false,
    is_tty: false,
  }),
}));
vi.mock("./canary.js", () => ({ canaryEventProperties: () => ({}) }));

vi.stubGlobal("fetch", fetchMock);

const { PrimitiveFunnel } = await import("./primitive-funnel.js");
const { writePrimitiveFunnelContext } = await import("./primitive-funnel-state.js");
const { trackPrimitivePreviewSucceeded, trackPrimitiveRenderSucceeded } =
  await import("./primitive-funnel-command.js");
const { flush, resetTelemetryPostureCache } = await import("./client.js");

describe("primitive funnel queued transport boundary", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "hf-funnel-transport-"));
    posture.enabled = true;
    resetTelemetryPostureCache();
    fetchMock.mockClear();
  });

  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it("delivers one ordered privacy-safe journey with a stable identity", async () => {
    const context = {
      funnelId: "funnel-transport",
      installId: "install-transport",
      primitiveId: "thread-message-stack",
      artifactId: "artifact-transport",
      versionId: "version-transport",
      catalogVersion: "catalog-transport",
      queryFingerprint: "sha256:non-content",
    };
    const funnel = new PrimitiveFunnel(context);
    funnel.catalogSearched(2);
    funnel.catalogResultSelected(1);
    funnel.authStarted();
    funnel.authCompleted("verified@example.com", "oauth", 5);
    funnel.installStarted();
    writePrimitiveFunnelContext(projectDir, context);
    funnel.installCompleted("install-transport:install-completed", 7);
    trackPrimitivePreviewSucceeded(projectDir, 11);
    trackPrimitivePreviewSucceeded(projectDir, 99);
    trackPrimitiveRenderSucceeded(projectDir, 13);

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const events = body.batch as Array<{
      event: string;
      distinct_id: string;
      properties: Record<string, unknown>;
    }>;
    expect(events.map(({ event }) => event)).toEqual([
      "primitive_catalog_searched",
      "primitive_catalog_result_selected",
      "primitive_auth_started",
      "$identify",
      "primitive_auth_completed",
      "primitive_install_started",
      "primitive_install_completed",
      "primitive_preview_succeeded",
      "primitive_render_succeeded",
    ]);
    expect(events.filter(({ event }) => event === "$identify")).toHaveLength(1);
    expect(events.filter(({ event }) => event === "primitive_preview_succeeded")).toHaveLength(1);
    expect(events.every(({ properties }) => properties.funnel_id === "funnel-transport")).toBe(
      true,
    );
    expect(events.at(-2)?.properties.duration_ms).toBe(11);
    expect(events.at(-1)?.properties.duration_ms).toBe(13);
    expect(JSON.stringify(body)).not.toMatch(
      /raw_query|query_text|messages|html_source|css_source|javascript|credential|access_token|raw_error|rendered_media/,
    );
    expect(events.every(({ properties }) => properties.$ip === null)).toBe(true);
  });

  it("does not queue or fetch after opt-out", async () => {
    posture.enabled = false;
    resetTelemetryPostureCache();
    const funnel = new PrimitiveFunnel({
      funnelId: "funnel-opt-out",
      installId: "install-opt-out",
      primitiveId: "thread-message-stack",
      artifactId: "artifact-opt-out",
      versionId: "version-opt-out",
      catalogVersion: "catalog-opt-out",
      queryFingerprint: "sha256:non-content",
    });
    funnel.catalogSearched(1);
    funnel.authCompleted("private@example.com", "existing_session", 0);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
