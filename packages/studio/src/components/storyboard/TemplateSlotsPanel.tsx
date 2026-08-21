import { useEffect, useState } from "react";
import { FileArrowUp, Lock, Warning } from "@phosphor-icons/react";
import type { TemplateManifest, TemplateSlot } from "@hyperframes/core/storyboard";
import { buildProjectApiPath } from "../../utils/projectRouting";
import { useFileManagerContext } from "../../contexts/FileManagerContext";
import { Button } from "../ui/Button";
import type { StoryboardRecordEdit } from "./storyboardHistory";

export function TemplateSlotsPanel({
  projectId,
  compositionPath,
  recordEdit,
}: {
  projectId: string;
  compositionPath: string;
  recordEdit: StoryboardRecordEdit;
}) {
  const { uploadProjectFiles, refreshFileTree } = useFileManagerContext();
  const [manifest, setManifest] = useState<TemplateManifest | null>(null);
  const [open, setOpen] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ composition: compositionPath });
    void fetch(`${buildProjectApiPath(projectId, "/templates/manifest")}?${query.toString()}`)
      .then((response) => (response.ok ? (response.json() as Promise<TemplateManifest>) : null))
      .then((value) => {
        if (!cancelled) setManifest(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [compositionPath, projectId]);

  const update = async (slot: TemplateSlot, patch: Record<string, unknown>) => {
    if (!manifest || busySlot) return;
    setBusySlot(slot.id);
    setError(null);
    try {
      const response = await fetch(
        buildProjectApiPath(projectId, `/templates/${manifest.id}/slots/${slot.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const payload = (await response.json()) as {
        manifest?: TemplateManifest;
        changes?: Array<{ path: string; before: string; after: string }>;
        error?: string;
      };
      if (!response.ok || !payload.manifest || !payload.changes) {
        throw new Error(payload.error || "Could not update this slot.");
      }
      await recordEdit({
        label: `Update template slot ${slot.label}`,
        kind: "timeline",
        files: Object.fromEntries(payload.changes.map((change) => [change.path, change])),
      });
      setManifest(payload.manifest);
      await refreshFileTree();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusySlot(null);
    }
  };

  const replaceMedia = async (slot: TemplateSlot, file: File) => {
    const [assetPath] = await uploadProjectFiles([file], "assets/template-slots");
    if (assetPath) await update(slot, { assetPath });
  };

  if (!manifest) return null;
  const remainingReference = manifest.slots.filter((slot) => slot.referenceAsset).length;
  return (
    <section className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900/35">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-300 hover:text-white"
      >
        <Lock size={13} className={manifest.pacingLocked ? "text-amber-400" : "text-neutral-600"} />
        <span className="font-semibold">
          {manifest.kind === "version" ? "Version inputs" : "Template slots"}
        </span>
        <span className="text-neutral-600">
          {manifest.slots.length} slots · pacing {manifest.pacingLocked ? "locked" : "flexible"}
        </span>
        {remainingReference > 0 ? (
          <span className="ml-auto flex items-center gap-1 rounded bg-amber-950/50 px-2 py-0.5 text-[10px] text-amber-300">
            <Warning size={11} /> {remainingReference} reference
          </span>
        ) : (
          <span className="ml-auto text-[10px] text-emerald-400">Ready</span>
        )}
      </button>
      {open ? (
        <div className="grid gap-2 border-t border-neutral-800 p-3 md:grid-cols-2 xl:grid-cols-3">
          {manifest.slots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-md border border-neutral-800 bg-neutral-950/80 p-2.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{slot.label}</span>
                <span className="ml-auto rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] uppercase text-neutral-500">
                  {slot.kind}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-neutral-600">
                {slot.startSeconds.toFixed(3)}s · {slot.durationSeconds.toFixed(3)}s · track{" "}
                {slot.track}
              </div>
              {slot.kind === "text" || slot.kind === "cta" ? (
                <div className="mt-2 flex gap-1.5">
                  <input
                    defaultValue={slot.value}
                    aria-label={`${slot.label} value`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter")
                        void update(slot, { value: event.currentTarget.value });
                    }}
                    className="h-8 min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-white outline-none focus:border-sky-500"
                  />
                  <Button
                    size="sm"
                    disabled={busySlot === slot.id}
                    onClick={(event) => {
                      const input = event.currentTarget.parentElement?.querySelector("input");
                      if (input) void update(slot, { value: input.value });
                    }}
                  >
                    Apply
                  </Button>
                </div>
              ) : (
                <label className="mt-2 flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded border border-dashed border-neutral-700 text-[11px] text-neutral-400 transition-colors hover:border-sky-600 hover:text-sky-200">
                  <FileArrowUp size={12} /> Replace {slot.kind}
                  <input
                    type="file"
                    accept={slot.kind === "audio" ? "audio/*" : "image/*,video/*"}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void replaceMedia(slot, file);
                    }}
                  />
                </label>
              )}
              <div className="mt-2 flex gap-1.5">
                <select
                  value={slot.timingRule}
                  onChange={(event) => void update(slot, { timingRule: event.target.value })}
                  className="h-7 min-w-0 flex-1 rounded border border-neutral-800 bg-neutral-900 px-1.5 text-[10px] text-neutral-400"
                >
                  <option value="fixed">Fixed timing</option>
                  <option value="flexible">Flexible</option>
                  <option value="repeatable">Repeatable</option>
                  <option value="optional">Optional</option>
                </select>
                <select
                  value={slot.replacement.shortMediaPolicy}
                  onChange={(event) => void update(slot, { shortMediaPolicy: event.target.value })}
                  className="h-7 min-w-0 flex-1 rounded border border-neutral-800 bg-neutral-900 px-1.5 text-[10px] text-neutral-400"
                >
                  <option value="ask">Short: ask</option>
                  <option value="loop">Loop</option>
                  <option value="freeze">Freeze</option>
                  <option value="speed">Speed</option>
                  <option value="unlock">Unlock</option>
                </select>
              </div>
            </div>
          ))}
          {error ? (
            <p role="alert" className="col-span-full text-xs text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
