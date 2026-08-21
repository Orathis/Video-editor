import { importFusionComposition, type FusionImportResult } from "@hyperframes/core/fusion";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFileManagerContext } from "../../contexts/FileManagerContext";
import { useStudioPlaybackContext, useStudioShellContext } from "../../contexts/StudioContext";
import { extractDrfx, type DrfxEntry } from "../../utils/fusionDrfx";

interface FusionCandidate {
  name: string;
  source: string;
}

interface PendingFusionImport {
  file: File;
  candidates: FusionCandidate[];
  selectedIndex: number;
  bundledAssets: DrfxEntry[];
  preview: FusionImportResult;
}

export interface FusionImportPaths {
  compositionId: string;
  compositionPath: string;
  sourcePath: string;
  reportPath: string;
}

function slug(value: string): string {
  const clean = value
    .replace(/\.(?:comp|setting)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return clean || "fusion-import";
}

export function nextFusionImportPaths(
  fileName: string,
  existingFiles: string[],
): FusionImportPaths {
  const base = slug(fileName);
  const existing = new Set(existingFiles.map((path) => path.toLowerCase()));
  let compositionId = base;
  let index = 2;
  while (existing.has(`compositions/imports/${compositionId}.html`.toLowerCase())) {
    compositionId = `${base}-${index++}`;
  }
  const extension = fileName.toLowerCase().endsWith(".setting") ? "setting" : "comp";
  return {
    compositionId,
    compositionPath: `compositions/imports/${compositionId}.html`,
    sourcePath: `assets/fusion/sources/${compositionId}.${extension}`,
    reportPath: `assets/fusion/reports/${compositionId}.json`,
  };
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "bad"
          ? "text-red-300"
          : "text-neutral-200";
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[10px] text-neutral-500">{label}</div>
    </div>
  );
}

function CompatibilityDetails({ result }: { result: FusionImportResult }) {
  const notable = result.report.items.filter((item) => item.level !== "supported");
  if (notable.length === 0 && result.report.warnings.length === 0) return null;
  return (
    <details className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
      <summary className="cursor-pointer text-[11px] font-medium text-neutral-300">
        Compatibility details
      </summary>
      <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1 text-[10px]">
        {notable.map((item) => (
          <div key={item.toolId} className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate text-neutral-300">
              {item.toolId} · {item.toolType}
            </span>
            <span className={item.level === "partial" ? "text-amber-300" : "text-red-300"}>
              {item.level}
            </span>
          </div>
        ))}
        {result.report.warnings.map((warning) => (
          <div key={warning} className="text-neutral-500">
            {warning}
          </div>
        ))}
      </div>
    </details>
  );
}

export function FusionImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFusionImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { fileTree, writeProjectFile, uploadProjectFiles, refreshFileTree, setEditingFile } =
    useFileManagerContext();
  const { setActiveCompPath, showToast } = useStudioShellContext();
  const { setRefreshKey } = useStudioPlaybackContext();
  const paths = useMemo(
    () =>
      pending
        ? nextFusionImportPaths(
            pending.candidates[pending.selectedIndex]?.name ?? pending.file.name,
            fileTree,
          )
        : null,
    [fileTree, pending],
  );

  const analyzeFile = useCallback(async (file: File) => {
    setError(null);
    if (!/\.(?:comp|setting|drfx|zip)$/i.test(file.name)) {
      setError("Choose a DaVinci Fusion .comp, .setting, .drfx, or Envato .zip file.");
      return;
    }
    try {
      let candidates: FusionCandidate[];
      let bundledAssets: DrfxEntry[] = [];
      if (/\.(?:drfx|zip)$/i.test(file.name)) {
        const contents = await extractDrfx(file);
        candidates = contents.templates.map((entry) => ({
          name: entry.path,
          source: new TextDecoder().decode(entry.bytes),
        }));
        bundledAssets = contents.assets;
      } else {
        candidates = [{ name: file.name, source: await file.text() }];
      }
      const first = candidates[0];
      if (!first) throw new Error("No Fusion template was found.");
      const preview = importFusionComposition(first.source, { sourceName: first.name });
      setPending({ file, candidates, selectedIndex: 0, bundledAssets, preview });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Fusion template analysis failed.");
    }
  }, []);

  const selectCandidate = useCallback((index: number) => {
    setError(null);
    setPending((current) => {
      const candidate = current?.candidates[index];
      if (!current || !candidate) return current;
      try {
        return {
          ...current,
          selectedIndex: index,
          preview: importFusionComposition(candidate.source, { sourceName: candidate.name }),
        };
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Fusion template analysis failed.");
        return current;
      }
    });
  }, []);

  const commit = useCallback(async () => {
    if (!pending || !paths || saving) return;
    setSaving(true);
    try {
      const candidate = pending.candidates[pending.selectedIndex];
      if (!candidate) throw new Error("Select a Fusion template to import.");
      const imported = importFusionComposition(candidate.source, {
        compositionId: paths.compositionId,
        mediaBasePath: `assets/fusion/${paths.compositionId}`,
      });
      const uniqueAssets = pending.bundledAssets.filter(
        (entry, index, all) =>
          all.findIndex(
            (candidateEntry) =>
              candidateEntry.path.split("/").pop()?.toLowerCase() ===
              entry.path.split("/").pop()?.toLowerCase(),
          ) === index,
      );
      const assetFiles = uniqueAssets.map((entry) => {
        const name = entry.path.split("/").pop() ?? "fusion-asset";
        const bytes = entry.bytes.slice().buffer;
        return new File([bytes], name);
      });
      const uploadedAssets = await uploadProjectFiles(
        assetFiles,
        `assets/fusion/${paths.compositionId}`,
      );
      const report = {
        version: 1,
        importedAt: new Date().toISOString(),
        sourceArchive: pending.file.name,
        sourceFile: candidate.name,
        compositionPath: paths.compositionPath,
        bundledAssets: uploadedAssets,
        width: imported.width,
        height: imported.height,
        fps: imported.fps,
        duration: imported.duration,
        compatibility: imported.report,
      };
      await writeProjectFile(paths.sourcePath, candidate.source);
      await writeProjectFile(paths.reportPath, `${JSON.stringify(report, null, 2)}\n`);
      await writeProjectFile(paths.compositionPath, imported.html);
      await refreshFileTree();
      setEditingFile({ path: paths.compositionPath, content: imported.html });
      setActiveCompPath(paths.compositionPath);
      setRefreshKey((value) => value + 1);
      setPending(null);
      showToast(`Imported editable Fusion composition: ${paths.compositionId}`, "info");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Fusion import failed.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }, [
    paths,
    pending,
    refreshFileTree,
    saving,
    setActiveCompPath,
    setEditingFile,
    setRefreshKey,
    showToast,
    uploadProjectFiles,
    writeProjectFile,
  ]);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-[7px] text-[11px] font-medium text-emerald-200 transition-colors hover:border-emerald-300/35 hover:bg-emerald-400/[0.1]"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M4 5h16v14H4z" />
          <path d="m8 15 3-6 2 4 2-2 2 4" />
        </svg>
        Import Fusion template
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".comp,.setting,.drfx,.zip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void analyzeFile(file);
        }}
      />
      {error && !pending && (
        <div className="mb-2.5 rounded-md border border-red-400/15 bg-red-400/[0.06] px-2.5 py-2 text-[10px] text-red-300">
          {error}
        </div>
      )}
      {pending && paths && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Import Fusion template"
        >
          <div className="w-full max-w-[620px] rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">Fusion import analysis</div>
                <div className="mt-1 text-[11px] text-neutral-500">{pending.file.name}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setError(null);
                }}
                className="rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-white"
                aria-label="Close Fusion import"
              >
                ×
              </button>
            </div>
            {pending.candidates.length > 1 && (
              <label className="mt-4 block text-[10px] text-neutral-500">
                Template in bundle
                <select
                  value={pending.selectedIndex}
                  onChange={(event) => selectCandidate(Number(event.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-[11px] text-neutral-200 outline-none focus:border-emerald-400/40"
                >
                  {pending.candidates.map((candidate, index) => (
                    <option key={candidate.name} value={index}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-4 grid grid-cols-5 gap-2">
              <Metric label="Native" value={pending.preview.report.supported} tone="good" />
              <Metric label="Approx." value={pending.preview.report.partial} tone="warn" />
              <Metric label="Unsupported" value={pending.preview.report.unsupported} tone="bad" />
              <Metric label="Animated" value={pending.preview.report.animatedInputs} />
              <Metric label="Media slots" value={pending.preview.report.mediaSlots} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-neutral-400">
              <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                {pending.preview.width} × {pending.preview.height}
              </div>
              <div className="rounded-lg bg-white/[0.03] px-3 py-2">{pending.preview.fps} fps</div>
              <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                {pending.preview.duration.toFixed(2)} seconds
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <div className="text-[10px] text-neutral-500">Creates</div>
              <div className="mt-1 truncate font-mono text-[10px] text-neutral-300">
                {paths.compositionPath}
              </div>
              <div className="truncate font-mono text-[9px] text-neutral-600">
                Source and compatibility report are preserved under assets/fusion/
              </div>
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-[10px] text-red-300">
                {error}
              </div>
            )}
            <div className="mt-3">
              <CompatibilityDetails result={pending.preview} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setError(null);
                }}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-[11px] text-neutral-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void commit()}
                disabled={saving}
                className="rounded-lg bg-emerald-400 px-3.5 py-2 text-[11px] font-semibold text-black hover:bg-emerald-300 disabled:opacity-40"
              >
                {saving ? "Creating…" : "Create editable composition"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
