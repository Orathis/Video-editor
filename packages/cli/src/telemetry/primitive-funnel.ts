import { shouldTrack, trackEvent } from "./client.js";
import { readConfig } from "./config.js";

export type PrimitiveFunnelErrorCode =
  | "invalid_payload"
  | "auth_failed"
  | "auth_cancelled"
  | "install_failed"
  | "preview_failed"
  | "compile_failed"
  | "capture_failed"
  | "render_failed";

export interface PrimitiveFunnelContext {
  funnelId: string;
  installId: string;
  primitiveId: string;
  artifactId: string;
  versionId: string;
  catalogVersion: string;
  queryFingerprint: string;
}

type PrimitiveFunnelBaseProperties = {
  funnel_id: string;
  install_id: string;
  primitive_id: string;
  artifact_id: string;
  version_id: string;
  catalog_version: string;
  query_fingerprint: string;
};

type PrimitiveFunnelAuthState =
  | "anonymous"
  | "oauth_required"
  | "existing_session"
  | "oauth"
  | "authenticated";

/** Single source of truth for canonical lifecycle side effects and stable event-id suffixes. */
const PRIMITIVE_FUNNEL_SIDE_EFFECTS = {
  catalogSearched: { event: "primitive_catalog_searched", suffix: "catalog-searched" },
  catalogResultSelected: {
    event: "primitive_catalog_result_selected",
    suffix: "catalog-result-selected",
  },
  authStarted: { event: "primitive_auth_started", suffix: "auth-started" },
  authCompleted: { event: "primitive_auth_completed", suffix: "auth-completed" },
  authFailed: { event: "primitive_auth_failed", suffix: "auth-failed" },
  installStarted: { event: "primitive_install_started", suffix: "install-started" },
  installCompleted: { event: "primitive_install_completed", suffix: "install-completed" },
  installFailed: { event: "primitive_install_failed", suffix: "install-failed" },
  previewSucceeded: { event: "primitive_preview_succeeded", suffix: "preview" },
  previewFailed: { event: "primitive_preview_failed", suffix: "preview" },
  renderSucceeded: { event: "primitive_render_succeeded", suffix: "render" },
  renderFailed: { event: "primitive_render_failed", suffix: "render" },
} as const;

const MAX_RESULT_COUNT = 1_000;
const MAX_DURATION_MS = 86_400_000;

function boundedInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return value < 0 ? minimum : maximum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

/** Privacy-safe telemetry for one catalog-selection lifecycle. */
export class PrimitiveFunnel {
  readonly #base: PrimitiveFunnelBaseProperties;
  readonly #terminalEventIds = new Set<string>();
  #identified = false;

  constructor(context: PrimitiveFunnelContext) {
    this.#base = {
      funnel_id: context.funnelId,
      install_id: context.installId,
      primitive_id: context.primitiveId,
      artifact_id: context.artifactId,
      version_id: context.versionId,
      catalog_version: context.catalogVersion,
      query_fingerprint: context.queryFingerprint,
    };
  }

  catalogSearched(resultCount: number): void {
    this.#track(PRIMITIVE_FUNNEL_SIDE_EFFECTS.catalogSearched, {
      result_count: boundedInteger(resultCount, 0, MAX_RESULT_COUNT),
      auth_state: "anonymous",
    });
  }

  catalogResultSelected(resultRank: number): void {
    this.#track(PRIMITIVE_FUNNEL_SIDE_EFFECTS.catalogResultSelected, {
      result_rank: boundedInteger(resultRank, 1, MAX_RESULT_COUNT),
      auth_state: "anonymous",
    });
  }

  authStarted(): void {
    this.#track(PRIMITIVE_FUNNEL_SIDE_EFFECTS.authStarted, {
      auth_state: "oauth_required",
    });
  }

  authCompleted(
    accountId: string | undefined,
    authState: "existing_session" | "oauth",
    durationMs: number,
  ): void {
    if (!shouldTrack() || this.#identified) return;
    this.#identified = true;
    const properties = {
      ...this.#base,
      event_id: `${this.#base.funnel_id}:${PRIMITIVE_FUNNEL_SIDE_EFFECTS.authCompleted.suffix}`,
      auth_state: authState,
      duration_ms: boundedInteger(durationMs, 0, MAX_DURATION_MS),
    };
    if (accountId) {
      trackEvent(
        "$identify",
        { ...properties, $anon_distinct_id: readConfig().anonymousId },
        accountId,
      );
    }
    trackEvent(PRIMITIVE_FUNNEL_SIDE_EFFECTS.authCompleted.event, properties);
  }

  authFailed(eventId: string, errorCode: PrimitiveFunnelErrorCode, durationMs: number): void {
    this.#trackTerminal(
      PRIMITIVE_FUNNEL_SIDE_EFFECTS.authFailed.event,
      eventId,
      "oauth_required",
      durationMs,
      errorCode,
    );
  }

  installStarted(): void {
    this.#track(PRIMITIVE_FUNNEL_SIDE_EFFECTS.installStarted, {
      auth_state: "authenticated",
    });
  }

  installCompleted(eventId: string, durationMs: number): void {
    this.#trackTerminal(
      PRIMITIVE_FUNNEL_SIDE_EFFECTS.installCompleted.event,
      eventId,
      "authenticated",
      durationMs,
    );
  }

  installFailed(eventId: string, errorCode: PrimitiveFunnelErrorCode, durationMs: number): void {
    this.#trackTerminal(
      PRIMITIVE_FUNNEL_SIDE_EFFECTS.installFailed.event,
      eventId,
      "authenticated",
      durationMs,
      errorCode,
    );
  }

  previewSucceeded(eventId: string, durationMs: number): void {
    this.#trackTerminal(
      PRIMITIVE_FUNNEL_SIDE_EFFECTS.previewSucceeded.event,
      eventId,
      "authenticated",
      durationMs,
    );
  }

  previewFailed(eventId: string, errorCode: PrimitiveFunnelErrorCode, durationMs: number): void {
    this.#trackTerminal(
      PRIMITIVE_FUNNEL_SIDE_EFFECTS.previewFailed.event,
      eventId,
      "authenticated",
      durationMs,
      errorCode,
    );
  }

  renderSucceeded(eventId: string, durationMs: number): void {
    this.#trackTerminal(
      PRIMITIVE_FUNNEL_SIDE_EFFECTS.renderSucceeded.event,
      eventId,
      "authenticated",
      durationMs,
    );
  }

  renderFailed(eventId: string, errorCode: PrimitiveFunnelErrorCode, durationMs: number): void {
    this.#trackTerminal(
      PRIMITIVE_FUNNEL_SIDE_EFFECTS.renderFailed.event,
      eventId,
      "authenticated",
      durationMs,
      errorCode,
    );
  }

  #track(
    sideEffect: { event: string; suffix: string },
    properties: Record<string, string | number>,
  ): void {
    if (!shouldTrack()) return;
    trackEvent(sideEffect.event, {
      ...this.#base,
      event_id: `${this.#base.funnel_id}:${sideEffect.suffix}`,
      ...properties,
    });
  }

  #trackTerminal(
    name: string,
    eventId: string,
    authState: PrimitiveFunnelAuthState,
    durationMs: number,
    errorCode?: PrimitiveFunnelErrorCode,
  ): void {
    if (!shouldTrack() || this.#terminalEventIds.has(eventId)) return;
    this.#terminalEventIds.add(eventId);
    trackEvent(name, {
      ...this.#base,
      event_id: eventId,
      auth_state: authState,
      duration_ms: boundedInteger(durationMs, 0, MAX_DURATION_MS),
      ...(errorCode ? { error_code: errorCode } : {}),
    });
  }
}
