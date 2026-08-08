import { describe, expect, it, vi } from "vitest";
import { audioFxWorkletsReady, ensureAudioFxWorklets } from "./audioFxWorklets.js";

/** Just enough of a BaseAudioContext for the registration cache to key on. */
const contextWith = (addModule: (url: string) => Promise<void>): BaseAudioContext =>
  ({ audioWorklet: { addModule } }) as unknown as BaseAudioContext;

describe("ensureAudioFxWorklets", () => {
  it("registers once per context and reuses the result", async () => {
    const addModule = vi.fn(async () => undefined);
    const ctx = contextWith(addModule);

    await ensureAudioFxWorklets(ctx);
    await ensureAudioFxWorklets(ctx);

    expect(addModule).toHaveBeenCalledTimes(1);
    expect(audioFxWorkletsReady(ctx)).toBe(true);
  });

  it("retries after a failure instead of replaying it forever", async () => {
    // The rejected promise used to stay in the cache, so every later attempt
    // got the same rejection back — the limiter, compressor, gate and bitcrush
    // were silent for the life of the context after one transient failure.
    const addModule = vi
      .fn<(url: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("module load failed"))
      .mockResolvedValue(undefined);
    const ctx = contextWith(addModule);

    await expect(ensureAudioFxWorklets(ctx)).rejects.toThrow("module load failed");
    expect(audioFxWorkletsReady(ctx)).toBe(false);

    await expect(ensureAudioFxWorklets(ctx)).resolves.toBeUndefined();
    expect(addModule).toHaveBeenCalledTimes(2);
    expect(audioFxWorkletsReady(ctx)).toBe(true);
  });

  it("refuses a context with no AudioWorklet rather than hanging", async () => {
    const ctx = {} as BaseAudioContext;
    await expect(ensureAudioFxWorklets(ctx)).rejects.toThrow(/secure context/);
  });
});
