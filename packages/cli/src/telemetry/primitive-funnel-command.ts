import { PrimitiveFunnel, type PrimitiveFunnelErrorCode } from "./primitive-funnel.js";
import { claimPrimitiveFunnelEvent, readPrimitiveFunnelContext } from "./primitive-funnel-state.js";

function emitProjectTerminal(
  projectDir: string,
  suffix: "preview" | "render",
  emit: (funnel: PrimitiveFunnel, eventId: string) => void,
): void {
  const context = readPrimitiveFunnelContext(projectDir);
  if (!context) return;
  const eventId = `${context.installId}:${suffix}`;
  if (!claimPrimitiveFunnelEvent(projectDir, eventId)) return;
  emit(new PrimitiveFunnel(context), eventId);
}

export function trackPrimitivePreviewSucceeded(projectDir: string, durationMs: number): void {
  emitProjectTerminal(projectDir, "preview", (funnel, eventId) =>
    funnel.previewSucceeded(eventId, durationMs),
  );
}

export function trackPrimitivePreviewFailed(
  projectDir: string,
  errorCode: PrimitiveFunnelErrorCode,
  durationMs: number,
): void {
  emitProjectTerminal(projectDir, "preview", (funnel, eventId) =>
    funnel.previewFailed(eventId, errorCode, durationMs),
  );
}

export function trackPrimitiveRenderSucceeded(projectDir: string, durationMs: number): void {
  emitProjectTerminal(projectDir, "render", (funnel, eventId) =>
    funnel.renderSucceeded(eventId, durationMs),
  );
}

export function trackPrimitiveRenderFailed(
  projectDir: string,
  errorCode: PrimitiveFunnelErrorCode,
  durationMs: number,
): void {
  emitProjectTerminal(projectDir, "render", (funnel, eventId) =>
    funnel.renderFailed(eventId, errorCode, durationMs),
  );
}
