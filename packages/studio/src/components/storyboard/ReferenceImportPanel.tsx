import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowCounterClockwise, Check, FileVideo, X } from "@phosphor-icons/react";
import type {
  ReferenceAnalysisManifest,
  ReferenceCutKind,
  StoryboardTargetProfile,
} from "@hyperframes/core/storyboard";
import { buildProjectApiPath } from "../../utils/projectRouting";
import { resolveMediaPreviewUrl } from "../../player/components/thumbnailUtils";
import { useFileManagerContext } from "../../contexts/FileManagerContext";
import { Button, IconButton } from "../ui/Button";
import type { StoryboardRecordEdit } from "./storyboardHistory";

type Step = "setup" | "uploading" | "analyzing" | "review" | "committing" | "complete";

interface CommitResponse {
  templateBoard: string;
  changes: Array<{ path: string; before: string; after: string }>;
}

interface ProgressEvent {
  status: "analyzing" | "review" | "failed" | "cancelled";
  progress: number;
  stage: string;
  error?: string;
}

interface StartResponse {
  analysisId?: string;
  assetPath?: string;
  title?: string;
  error?: string;
}

function rebuildScenes(manifest: ReferenceAnalysisManifest): ReferenceAnalysisManifest {
  const cuts = [...manifest.cuts].sort((a, b) => a.timeSeconds - b.timeSeconds);
  const boundaries = [...cuts.map((cut) => cut.timeSeconds), manifest.source.durationSeconds];
  return {
    ...manifest,
    cuts,
    scenes: boundaries.slice(0, -1).map((startSeconds, index) => {
      const endSeconds = boundaries[index + 1] ?? manifest.source.durationSeconds;
      const startCut = cuts[index];
      const startFrame = startCut?.frameIndex ?? 0;
      const nextCut = cuts[index + 1];
      return {
        id: `scene-${index + 1}`,
        title: manifest.scenes[index]?.title ?? `Scene ${index + 1}`,
        startFrame,
        endFrame: Math.max(startFrame, (nextCut?.frameIndex ?? manifest.frames.length) - 1),
        startSeconds,
        endSeconds,
        transitionIn: index === 0 ? "start" : (startCut?.kind ?? "hard-cut"),
        confidence: index === 0 ? "high" : (startCut?.confidence ?? "medium"),
      };
    }),
  };
}

export function ReferenceImportPanel({
  projectId,
  onClose,
  onCommitted,
  recordEdit,
}: {
  projectId: string;
  onClose: () => void;
  onCommitted: (storyboardPath: string) => void;
  recordEdit: StoryboardRecordEdit;
}) {
  const { uploadProjectFiles, refreshFileTree } = useFileManagerContext();
  const [step, setStep] = useState<Step>("setup");
  const [title, setTitle] = useState("Imported reference");
  const [sourceUrl, setSourceUrl] = useState("");
  const [profile, setProfile] = useState<StoryboardTargetProfile>("9:16");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ReferenceAnalysisManifest | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Choose an owned reference video.");
  const [error, setError] = useState<string | null>(null);
  const [sourceAsset, setSourceAsset] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => () => eventSourceRef.current?.close(), []);

  const sourcePreview = useMemo(
    () =>
      sourceAsset ? resolveMediaPreviewUrl(sourceAsset, projectId, window.location.origin) : null,
    [projectId, sourceAsset],
  );

  const watchJob = (id: string) => {
    eventSourceRef.current?.close();
    const url = `${buildProjectApiPath(projectId, `/reference-analysis/${id}/progress`)}`;
    const events = new EventSource(url);
    eventSourceRef.current = events;
    events.addEventListener("progress", (event) => {
      const next = JSON.parse((event as MessageEvent<string>).data) as ProgressEvent;
      setProgress(next.progress);
      setStage(next.stage);
      if (next.status === "review") {
        events.close();
        void fetch(buildProjectApiPath(projectId, `/reference-analysis/${id}`))
          .then((response) => {
            if (!response.ok) throw new Error("Could not load the analysis draft.");
            return response.json() as Promise<ReferenceAnalysisManifest>;
          })
          .then((draft) => {
            setManifest(draft);
            setProfile(draft.source.width > draft.source.height ? "16:9" : "9:16");
            setStep("review");
          })
          .catch((nextError: unknown) => setError(String(nextError)));
      } else if (next.status === "failed" || next.status === "cancelled") {
        events.close();
        setError(next.error || next.stage);
        setStep("setup");
      }
    });
    events.onerror = () => {
      events.close();
      setError("The analysis connection closed. You can retry without re-uploading.");
    };
  };

  const start = async (file: File) => {
    setError(null);
    setStep("uploading");
    setStage("Uploading owned source");
    const [assetPath] = await uploadProjectFiles([file], "assets/references");
    if (!assetPath) {
      setError("The reference upload did not complete.");
      setStep("setup");
      return;
    }
    setSourceAsset(assetPath);
    const response = await fetch(buildProjectApiPath(projectId, "/reference-analysis"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputPath: assetPath,
        sourceUrl: sourceUrl.trim() || undefined,
      }),
    });
    const payload = (await response.json().catch(() => ({
      error: `Import failed with HTTP ${response.status}.`,
    }))) as StartResponse;
    if (!response.ok || !payload.analysisId) {
      setError(payload.error || "Could not start analysis.");
      setStep("setup");
      return;
    }
    setTitle(payload.title || "Imported reference");
    setAnalysisId(payload.analysisId);
    setStep("analyzing");
    watchJob(payload.analysisId);
  };

  const startFromUrl = async () => {
    const url = sourceUrl.trim();
    if (!url) return;
    setError(null);
    setStep("uploading");
    setStage("Importing linked video");
    const response = await fetch(buildProjectApiPath(projectId, "/reference-analysis"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl: url }),
    });
    const payload = (await response.json().catch(() => ({
      error: `Import failed with HTTP ${response.status}.`,
    }))) as StartResponse;
    if (!response.ok || !payload.analysisId || !payload.assetPath) {
      setError(payload.error || "Could not import the linked video.");
      setStep("setup");
      return;
    }
    setTitle(payload.title || "Imported reference");
    setSourceAsset(payload.assetPath);
    setAnalysisId(payload.analysisId);
    setStep("analyzing");
    watchJob(payload.analysisId);
  };

  const cancel = async () => {
    if (analysisId) {
      await fetch(buildProjectApiPath(projectId, `/reference-analysis/${analysisId}/cancel`), {
        method: "POST",
      }).catch(() => undefined);
    }
    eventSourceRef.current?.close();
    onClose();
  };

  const retry = async () => {
    if (!analysisId) return;
    setError(null);
    const response = await fetch(
      buildProjectApiPath(projectId, `/reference-analysis/${analysisId}/retry`),
      { method: "POST" },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Could not retry the analysis.");
      return;
    }
    setStep("analyzing");
    watchJob(analysisId);
  };

  const nudgeCut = (cutIndex: number, delta: number) => {
    if (!manifest || cutIndex === 0) return;
    const cut = manifest.cuts[cutIndex];
    if (!cut) return;
    const frameIndex = Math.max(1, Math.min(manifest.frames.length - 1, cut.frameIndex + delta));
    const frame = manifest.frames[frameIndex];
    if (!frame) return;
    const cuts = manifest.cuts.map((item, index) =>
      index === cutIndex
        ? {
            ...item,
            frameIndex,
            pts: frame.pts,
            timeSeconds: frame.timeSeconds,
            provenance: "user" as const,
          }
        : item,
    );
    setManifest(rebuildScenes({ ...manifest, cuts }));
  };

  const setTransition = (cutIndex: number, kind: ReferenceCutKind) => {
    if (!manifest) return;
    const cuts = manifest.cuts.map((cut, index) =>
      index === cutIndex ? { ...cut, kind, provenance: "user" as const } : cut,
    );
    setManifest(rebuildScenes({ ...manifest, cuts }));
  };

  const splitAtPlayhead = () => {
    if (!manifest || !videoRef.current) return;
    const timeSeconds = videoRef.current.currentTime;
    const frame = manifest.frames.reduce((nearest, candidate) =>
      Math.abs(candidate.timeSeconds - timeSeconds) < Math.abs(nearest.timeSeconds - timeSeconds)
        ? candidate
        : nearest,
    );
    if (manifest.cuts.some((cut) => cut.frameIndex === frame.frameIndex)) return;
    setManifest(
      rebuildScenes({
        ...manifest,
        cuts: [
          ...manifest.cuts,
          {
            id: `cut-user-${Date.now()}`,
            kind: "hard-cut",
            frameIndex: frame.frameIndex,
            pts: frame.pts,
            timeSeconds: frame.timeSeconds,
            score: 1,
            confidence: "high",
            provenance: "user",
          },
        ],
      }),
    );
  };

  const mergeScene = (cutIndex: number) => {
    if (!manifest || cutIndex === 0) return;
    setManifest(
      rebuildScenes({ ...manifest, cuts: manifest.cuts.filter((_, index) => index !== cutIndex) }),
    );
  };

  const commit = async () => {
    if (!manifest || !analysisId) return;
    setStep("committing");
    setError(null);
    const save = await fetch(buildProjectApiPath(projectId, `/reference-analysis/${analysisId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manifest),
    });
    if (!save.ok) {
      setError("Could not save the reviewed analysis.");
      setStep("review");
      return;
    }
    const response = await fetch(
      buildProjectApiPath(projectId, `/reference-analysis/${analysisId}/commit`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, targetProfile: profile }),
      },
    );
    const payload = (await response.json()) as CommitResponse & { error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not create the template group.");
      setStep("review");
      return;
    }
    await recordEdit({
      label: `Import ${title} as a timeline template`,
      kind: "timeline",
      files: Object.fromEntries(payload.changes.map((change) => [change.path, change])),
    });
    await refreshFileTree();
    setStep("complete");
    onCommitted(payload.templateBoard);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Import reference video"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Reference → timeline template</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Exact source frames and audio samples stay canonical.
            </p>
          </div>
          <IconButton
            aria-label="Close importer"
            icon={<X size={16} />}
            onClick={() => void cancel()}
          />
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {step === "setup" || step === "uploading" ? (
            <div className="mx-auto grid max-w-2xl gap-5 py-8">
              <label className="grid gap-1.5 text-xs text-neutral-400">
                Video link
                <span className="text-neutral-600">
                  Instagram, TikTok, YouTube, or a direct downloadable video URL
                </span>
                <input
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="Paste a social post or direct video link"
                  className="h-10 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none focus:border-sky-500"
                />
              </label>
              <Button
                variant="primary"
                disabled={step === "uploading" || !sourceUrl.trim()}
                onClick={() => void startFromUrl()}
              >
                {step === "uploading" ? "Importing…" : "Import video link"}
              </Button>
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-neutral-600">
                <span className="h-px flex-1 bg-neutral-800" />
                or upload a file
                <span className="h-px flex-1 bg-neutral-800" />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void start(file);
                }}
              />
              <button
                type="button"
                disabled={step === "uploading"}
                onClick={() => fileRef.current?.click()}
                className="group flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 text-neutral-300 transition-all hover:-translate-y-0.5 hover:border-sky-500 hover:bg-sky-950/20 disabled:opacity-50"
              >
                <FileVideo
                  size={30}
                  className="mb-3 text-sky-400 transition-transform group-hover:scale-110"
                />
                <span className="text-sm font-semibold">
                  {step === "uploading" ? "Uploading…" : "Upload the owned source video"}
                </span>
                <span className="mt-1 text-xs text-neutral-500">
                  The template name is generated automatically from the source.
                </span>
              </button>
              {analysisId && sourceAsset ? (
                <Button size="sm" onClick={() => void retry()}>
                  Retry existing upload
                </Button>
              ) : null}
            </div>
          ) : null}

          {step === "analyzing" ? (
            <div className="mx-auto max-w-xl py-20 text-center">
              <div className="mb-4 text-sm font-medium text-white">{stage}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full bg-sky-400 transition-[width] duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <div className="mt-2 font-mono text-xs text-neutral-500">
                {Math.round(progress * 100)}%
              </div>
              <Button className="mt-6" size="sm" onClick={() => void cancel()}>
                Cancel analysis
              </Button>
            </div>
          ) : null}

          {(step === "review" || step === "committing") && manifest ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.8fr)]">
              <div className="min-w-0">
                {sourcePreview ? (
                  <video
                    ref={videoRef}
                    src={sourcePreview}
                    controls
                    className="aspect-video w-full rounded-lg bg-black object-contain"
                  />
                ) : null}
                <div className="relative mt-3 h-14 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900">
                  {manifest.audioEvents.map((event) => (
                    <span
                      key={event.id}
                      title={`${event.kind} · ${event.timeSeconds.toFixed(3)}s`}
                      className={`absolute bottom-0 top-0 w-px ${event.kind === "onset" ? "bg-amber-400/80" : "bg-neutral-600"}`}
                      style={{
                        left: `${(event.timeSeconds / manifest.source.durationSeconds) * 100}%`,
                      }}
                    />
                  ))}
                  {manifest.cuts.map((cut) => (
                    <span
                      key={cut.id}
                      title={`Cut · ${cut.timeSeconds.toFixed(6)}s`}
                      className="absolute bottom-0 top-0 w-0.5 bg-sky-400"
                      style={{
                        left: `${(cut.timeSeconds / manifest.source.durationSeconds) * 100}%`,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" icon={<FileVideo size={13} />} onClick={splitAtPlayhead}>
                    Split at playhead
                  </Button>
                  <span className="self-center text-[11px] text-neutral-500">
                    Blue: cuts · gold: audio onsets
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="mb-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
                    <div className="text-neutral-500">Source timing</div>
                    <div className="mt-1 font-mono text-white">
                      {manifest.source.frameRate.num}/{manifest.source.frameRate.den} fps
                      {manifest.source.variableFrameRate ? " · VFR" : ""}
                    </div>
                  </div>
                  <label className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-neutral-500">
                    Output profile
                    <select
                      value={profile}
                      onChange={(event) =>
                        setProfile(event.target.value as StoryboardTargetProfile)
                      }
                      className="mt-1 block w-full bg-transparent text-white outline-none"
                    >
                      <option value="9:16">9:16 vertical</option>
                      <option value="16:9">16:9 landscape</option>
                      <option value="4:5">4:5 feed</option>
                      <option value="1:1">1:1 square</option>
                    </select>
                  </label>
                </div>
                <div className="max-h-[48vh] space-y-1 overflow-auto pr-1">
                  {manifest.cuts.map((cut, index) => (
                    <div
                      key={cut.id}
                      className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/80 px-2.5 py-2 text-xs"
                    >
                      <span className="w-7 font-mono text-neutral-500">{index + 1}</span>
                      <span className="w-24 font-mono text-neutral-300">
                        {cut.timeSeconds.toFixed(6)}s
                      </span>
                      {index > 0 ? (
                        <>
                          <button
                            type="button"
                            aria-label="Nudge cut back one source frame"
                            onClick={() => nudgeCut(index, -1)}
                            className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                          >
                            −1f
                          </button>
                          <button
                            type="button"
                            aria-label="Nudge cut forward one source frame"
                            onClick={() => nudgeCut(index, 1)}
                            className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                          >
                            +1f
                          </button>
                          <select
                            value={cut.kind}
                            onChange={(event) =>
                              setTransition(index, event.target.value as ReferenceCutKind)
                            }
                            className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-neutral-300"
                          >
                            <option value="hard-cut">Hard cut</option>
                            <option value="fade">Fade</option>
                            <option value="dissolve">Dissolve</option>
                            <option value="unknown">Unknown</option>
                          </select>
                          <button
                            type="button"
                            title="Merge scenes across this cut"
                            onClick={() => mergeScene(index)}
                            className="rounded p-1.5 text-neutral-500 hover:bg-red-950 hover:text-red-300"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <span className="text-neutral-600">start</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-neutral-500">
                  {manifest.scenes.length} scenes · {manifest.audioEvents.length} audio markers ·{" "}
                  {manifest.textDetections.length} editable text detections
                </div>
              </div>
            </div>
          ) : null}

          {step === "complete" ? (
            <div className="flex flex-col items-center py-20 text-center">
              <Check size={36} className="text-emerald-400" />
              <h3 className="mt-3 text-lg font-semibold text-white">Template group created</h3>
              <p className="mt-1 text-sm text-neutral-500">
                Reference, reusable Template, storyboard, and authored timeline are linked.
              </p>
            </div>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs text-red-300"
            >
              {error}
            </p>
          ) : null}
        </div>

        {step === "review" || step === "committing" || step === "complete" ? (
          <footer className="flex items-center justify-between border-t border-neutral-800 px-5 py-3">
            <Button
              size="sm"
              icon={<ArrowCounterClockwise size={13} />}
              onClick={() => setStep("setup")}
              disabled={step === "committing"}
            >
              Start over
            </Button>
            <div className="flex gap-2">
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
              {step !== "complete" ? (
                <Button
                  size="sm"
                  variant="primary"
                  loading={step === "committing"}
                  onClick={() => void commit()}
                >
                  Create Template Group
                </Button>
              ) : null}
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
