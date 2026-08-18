import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { findFfBinary } from "@hyperframes/parsers/ff-binaries";
import {
  REFERENCE_ANALYSIS_VERSION,
  sampleIndexAtTime,
  type ReferenceAnalysisManifest,
  type ReferenceAudioEvent,
  type ReferenceCut,
  type ReferenceFramePoint,
  type ReferenceScene,
  type ReferenceTransition,
} from "@hyperframes/core/storyboard";

const ANALYZER_VERSION = "reference-importer/1";
const PCM_SAMPLE_RATE = 16_000;

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  time_base?: string;
  start_time?: string;
  duration?: string;
  sample_rate?: string;
  channels?: number;
}

interface ProbeFrame {
  best_effort_timestamp?: number | string;
  best_effort_timestamp_time?: string;
  pkt_duration_time?: string;
  key_frame?: number;
}

interface ProbePayload {
  streams?: ProbeStream[];
  frames?: ProbeFrame[];
  format?: { duration?: string };
}

export interface ReferenceAnalysisProgress {
  progress: number;
  stage: string;
}

export interface ReferenceAnalysisInput {
  sourcePath: string;
  assetPath: string;
  sourceUrl?: string;
  groupId?: string;
  analysisId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ReferenceAnalysisProgress) => void;
  /** Absolute project-scoped cache directory. Cache writes use atomic replacement. */
  cacheDirectory?: string;
}

export interface AnalysisCommandResult {
  stdout: Buffer;
  stderr: Buffer;
}

export type AnalysisCommandRunner = (
  command: string,
  args: string[],
  options: { signal?: AbortSignal; maxBuffer: number },
) => Promise<AnalysisCommandResult>;

const runCommand: AnalysisCommandRunner = (command, args, options) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { encoding: "buffer", maxBuffer: options.maxBuffer, signal: options.signal },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || "").trim();
          reject(new Error(detail || error.message, { cause: error }));
          return;
        }
        resolve({ stdout: stdout ?? Buffer.alloc(0), stderr: stderr ?? Buffer.alloc(0) });
      },
    );
  });

function parseRational(value: string | undefined, fallback = { num: 30, den: 1 }) {
  const [numText, denText] = (value ?? "").split("/");
  const num = Number(numText);
  const den = Number(denText);
  return Number.isFinite(num) && Number.isFinite(den) && num > 0 && den > 0
    ? { num, den }
    : fallback;
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Resolve binaries already present in this workspace's deterministic Bun install. */
function findWorkspaceStaticBinary(name: "ffmpeg" | "ffprobe"): string | null {
  let directory = process.cwd();
  for (let depth = 0; depth < 7; depth++) {
    const bunModules = join(directory, "node_modules", ".bun");
    if (existsSync(bunModules)) {
      const packagePrefix = `${name}-static@`;
      const packageDirectory = readdirSync(bunModules).find((entry) =>
        entry.startsWith(packagePrefix),
      );
      if (packageDirectory) {
        const packageRoot = join(bunModules, packageDirectory, "node_modules", `${name}-static`);
        const candidate =
          name === "ffmpeg"
            ? join(packageRoot, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg")
            : join(
                packageRoot,
                "bin",
                process.platform,
                process.arch === "x64" ? "x64" : process.arch,
                process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
              );
        if (existsSync(candidate)) return candidate;
      }
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const input = createReadStream(path);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", reject);
    input.on("end", resolve);
  });
  return hash.digest("hex");
}

export function decodedFrames(payload: ProbePayload): ReferenceFramePoint[] {
  return (payload.frames ?? []).map((frame, frameIndex) => ({
    frameIndex,
    pts:
      frame.best_effort_timestamp == null ? null : Math.round(number(frame.best_effort_timestamp)),
    timeSeconds: number(frame.best_effort_timestamp_time),
    durationSeconds: frame.pkt_duration_time == null ? null : number(frame.pkt_duration_time),
    keyframe: frame.key_frame === 1,
  }));
}

export function isVariableFrameRate(
  frames: ReferenceFramePoint[],
  avgRate: string,
  rawRate: string,
) {
  if (avgRate && rawRate && avgRate !== rawRate) return true;
  if (frames.length < 4) return false;
  const intervals = frames
    .slice(1)
    .map((frame, index) => frame.timeSeconds - frames[index]!.timeSeconds)
    .filter((value) => value > 0);
  if (intervals.length < 3) return false;
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  return intervals.some((value) => Math.abs(value - mean) > Math.max(0.0005, mean * 0.02));
}

interface SceneScore {
  timeSeconds: number;
  score: number;
}

export function parseSceneScores(text: string): SceneScore[] {
  const scores: SceneScore[] = [];
  let time: number | null = null;
  for (const line of text.split(/\r?\n/)) {
    const timeMatch = line.match(/(?:pts_time|lavfi\.scd\.time)[=:]\s*([\d.]+)/i);
    if (timeMatch) time = number(timeMatch[1], time ?? 0);
    const scoreMatch = line.match(/(?:lavfi\.scd\.score|scene_score)[=:]\s*([\d.]+)/i);
    if (scoreMatch && time != null) {
      scores.push({ timeSeconds: time, score: number(scoreMatch[1]) });
      time = null;
    }
  }
  return scores;
}

function nearestFrame(frames: ReferenceFramePoint[], timeSeconds: number): ReferenceFramePoint {
  const first = frames[0];
  if (!first) throw new Error("Cannot locate a timestamp in an empty decoded-frame map.");
  let nearest = first;
  for (const frame of frames) {
    if (Math.abs(frame.timeSeconds - timeSeconds) < Math.abs(nearest.timeSeconds - timeSeconds)) {
      nearest = frame;
    }
  }
  return nearest;
}

export function refineCuts(
  scores: SceneScore[],
  frames: ReferenceFramePoint[],
  durationSeconds: number,
): ReferenceCut[] {
  if (frames.length === 0) return [];
  const first = frames[0]!;
  const cuts: ReferenceCut[] = [
    {
      id: "cut-0",
      kind: "start",
      frameIndex: 0,
      pts: first.pts,
      timeSeconds: first.timeSeconds,
      score: 1,
      confidence: "high",
      provenance: "ffprobe",
    },
  ];
  const candidates = scores.filter((score) => score.score >= 10);
  for (const candidate of candidates) {
    const frame = nearestFrame(frames, candidate.timeSeconds);
    if (frame.timeSeconds <= 0 || frame.timeSeconds >= durationSeconds) continue;
    if (cuts.some((cut) => Math.abs(cut.timeSeconds - frame.timeSeconds) < 0.02)) continue;
    cuts.push({
      id: `cut-${cuts.length}`,
      kind: "hard-cut",
      frameIndex: frame.frameIndex,
      pts: frame.pts,
      timeSeconds: frame.timeSeconds,
      score: candidate.score,
      confidence: candidate.score >= 20 ? "high" : "medium",
      provenance: "ffmpeg",
    });
  }
  return cuts.sort((a, b) => a.timeSeconds - b.timeSeconds);
}

export function detectDissolves(
  scores: SceneScore[],
  frames: ReferenceFramePoint[],
): ReferenceTransition[] {
  const soft = scores.filter((score) => score.score >= 1.5 && score.score < 10);
  const groups: SceneScore[][] = [];
  for (const score of soft) {
    const current = groups.at(-1);
    if (!current || score.timeSeconds - current.at(-1)!.timeSeconds > 0.12) groups.push([score]);
    else current.push(score);
  }
  return groups
    .filter((group) => group.length >= 3)
    .map((group, index) => {
      const first = nearestFrame(frames, group[0]!.timeSeconds);
      const last = nearestFrame(frames, group.at(-1)!.timeSeconds);
      return {
        id: `transition-dissolve-${index + 1}`,
        kind: "dissolve" as const,
        startFrame: first.frameIndex,
        endFrame: last.frameIndex,
        startSeconds: first.timeSeconds,
        endSeconds: last.timeSeconds,
        confidence: "medium" as const,
        provenance: "ffmpeg" as const,
      };
    });
}

export function parseBlackIntervals(
  text: string,
  frames: ReferenceFramePoint[],
): ReferenceTransition[] {
  return [...text.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map((match, index) => {
    const start = nearestFrame(frames, number(match[1]));
    const end = nearestFrame(frames, number(match[2]));
    return {
      id: `transition-fade-${index + 1}`,
      kind: "fade" as const,
      startFrame: start.frameIndex,
      endFrame: end.frameIndex,
      startSeconds: start.timeSeconds,
      endSeconds: end.timeSeconds,
      confidence: "high" as const,
      provenance: "ffmpeg" as const,
    };
  });
}

function audioEventsFromPcm(
  buffer: Buffer,
  sourceRate: number,
  audioStart: number,
): ReferenceAudioEvent[] {
  if (buffer.byteLength < 4) return [];
  const samples = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    Math.floor(buffer.byteLength / 4),
  );
  const windowSize = 320;
  const levels: number[] = [];
  for (let offset = 0; offset + windowSize <= samples.length; offset += windowSize) {
    let energy = 0;
    for (let i = 0; i < windowSize; i++) energy += samples[offset + i]! ** 2;
    levels.push(Math.sqrt(energy / windowSize));
  }
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const events: ReferenceAudioEvent[] = [];
  let silent = levels[0]! < Math.max(0.004, median * 0.22);
  let lastOnset = -1;
  levels.forEach((level, index) => {
    const previous = levels[Math.max(0, index - 1)] ?? 0;
    const nowSilent = level < Math.max(0.004, median * 0.22);
    const timeSeconds = audioStart + (index * windowSize) / PCM_SAMPLE_RATE;
    if (nowSilent !== silent) {
      events.push({
        id: `audio-${events.length}`,
        kind: nowSilent ? "silence-start" : "silence-end",
        sampleIndex: sampleIndexAtTime(Math.max(0, timeSeconds), sourceRate),
        timeSeconds,
        strength: Math.min(1, Math.abs(level - previous) / Math.max(median, 0.001)),
        confidence: "medium",
        provenance: "ffmpeg",
      });
      silent = nowSilent;
    }
    const onsetStrength = (level - previous) / Math.max(median, 0.002);
    if (onsetStrength > 1.8 && index - lastOnset > 5) {
      events.push({
        id: `audio-${events.length}`,
        kind: "onset",
        sampleIndex: sampleIndexAtTime(Math.max(0, timeSeconds), sourceRate),
        timeSeconds,
        strength: Math.min(1, onsetStrength / 5),
        confidence: onsetStrength > 3 ? "high" : "medium",
        provenance: "ffmpeg",
      });
      if (onsetStrength > 4) {
        events.push({
          id: `audio-${events.length}`,
          kind: "impact",
          sampleIndex: sampleIndexAtTime(Math.max(0, timeSeconds), sourceRate),
          timeSeconds,
          strength: Math.min(1, onsetStrength / 7),
          confidence: "high",
          provenance: "ffmpeg",
        });
      }
      lastOnset = index;
    }
  });
  const onsets = events.filter((event) => event.kind === "onset" && event.strength >= 0.45);
  const intervals = onsets
    .slice(1)
    .map((event, index) => event.timeSeconds - onsets[index]!.timeSeconds)
    .filter((interval) => interval >= 0.25 && interval <= 1.5)
    .sort((a, b) => a - b);
  const beatInterval = intervals[Math.floor(intervals.length / 2)];
  if (beatInterval) {
    for (let index = 1; index < onsets.length; index++) {
      const onset = onsets[index]!;
      const interval = onset.timeSeconds - onsets[index - 1]!.timeSeconds;
      if (Math.abs(interval - beatInterval) > beatInterval * 0.16) continue;
      events.push({
        ...onset,
        id: `audio-${events.length}`,
        kind: "beat",
        confidence: "medium",
      });
    }
  }
  return events.sort((a, b) => a.timeSeconds - b.timeSeconds);
}

function scenesFromCuts(
  cuts: ReferenceCut[],
  frames: ReferenceFramePoint[],
  durationSeconds: number,
): ReferenceScene[] {
  const boundaries = [...cuts.map((cut) => cut.timeSeconds), durationSeconds];
  return boundaries.slice(0, -1).map((startSeconds, index) => {
    const endSeconds = boundaries[index + 1]!;
    const start = nearestFrame(frames, startSeconds);
    const end = nearestFrame(frames, Math.max(startSeconds, endSeconds - 0.000001));
    return {
      id: `scene-${index + 1}`,
      title: `Scene ${index + 1}`,
      startFrame: start.frameIndex,
      endFrame: end.frameIndex,
      startSeconds,
      endSeconds,
      transitionIn: index === 0 ? "start" : (cuts[index]?.kind ?? "hard-cut"),
      confidence: index === 0 ? "high" : (cuts[index]?.confidence ?? "medium"),
    };
  });
}

export async function analyzeReferenceVideo(
  input: ReferenceAnalysisInput,
  runner: AnalysisCommandRunner = runCommand,
): Promise<ReferenceAnalysisManifest> {
  const ffprobe =
    findFfBinary("ffprobe", { configuredMustExist: true }) ??
    findWorkspaceStaticBinary("ffprobe") ??
    (runner === runCommand ? null : "ffprobe");
  const ffmpeg =
    findFfBinary("ffmpeg", { configuredMustExist: true }) ??
    findWorkspaceStaticBinary("ffmpeg") ??
    (runner === runCommand ? null : "ffmpeg");
  if (!ffprobe || !ffmpeg) {
    throw new Error(
      "Reference analysis requires FFmpeg and FFprobe. Configure their paths, then retry.",
    );
  }
  const progress = (value: number, stage: string) => input.onProgress?.({ progress: value, stage });
  progress(0.03, "Hashing source");
  const sourceHash = await sha256(input.sourcePath);
  const cacheFile = input.cacheDirectory
    ? join(
        input.cacheDirectory,
        `${sourceHash}-${ANALYZER_VERSION.replace(/[^a-z0-9]+/gi, "-")}.json`,
      )
    : null;
  if (cacheFile && existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf8")) as ReferenceAnalysisManifest;
      if (cached.analyzerVersion === ANALYZER_VERSION && cached.source.sha256 === sourceHash) {
        progress(1, "Loaded cached precision analysis");
        return {
          ...cached,
          id: input.analysisId ?? cached.id,
          groupId: input.groupId ?? cached.groupId,
          createdAt: new Date().toISOString(),
          source: {
            ...cached.source,
            assetPath: input.assetPath,
            sourceUrl: input.sourceUrl,
          },
        };
      }
    } catch {
      // A corrupt cache entry is ignored and replaced after a successful analysis.
    }
  }
  progress(0.1, "Reading exact frame timestamps");
  const probe = await runner(
    ffprobe,
    [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-select_streams",
      "v:0",
      "-show_frames",
      "-show_entries",
      "stream=codec_type,width,height,avg_frame_rate,r_frame_rate,time_base,start_time,duration,sample_rate,channels:format=duration:frame=best_effort_timestamp,best_effort_timestamp_time,pkt_duration_time,key_frame",
      "-of",
      "json",
      "--",
      input.sourcePath,
    ],
    { signal: input.signal, maxBuffer: 256 * 1024 * 1024 },
  );
  const payload = JSON.parse(probe.stdout.toString("utf8")) as ProbePayload;
  const video = payload.streams?.find((stream) => stream.codec_type === "video");
  if (!video) throw new Error("The uploaded file does not contain a video stream.");
  const frames = decodedFrames(payload);
  if (frames.length === 0) throw new Error("FFprobe returned no decoded video frame timestamps.");
  const durationSeconds = number(payload.format?.duration, frames.at(-1)?.timeSeconds ?? 0);
  const frameRate = parseRational(video.avg_frame_rate ?? video.r_frame_rate);
  const timebase = parseRational(video.time_base, { num: 1, den: frameRate.num });

  progress(0.4, "Refining cuts and transitions");
  const scenePass = await runner(
    ffmpeg,
    [
      "-hide_banner",
      "-i",
      input.sourcePath,
      "-vf",
      "scdet=t=10,metadata=print",
      "-an",
      "-f",
      "null",
      "-",
    ],
    { signal: input.signal, maxBuffer: 64 * 1024 * 1024 },
  );
  const cuts = refineCuts(
    parseSceneScores(scenePass.stderr.toString("utf8")),
    frames,
    durationSeconds,
  );
  const sceneScores = parseSceneScores(scenePass.stderr.toString("utf8"));
  const blackPass = await runner(
    ffmpeg,
    [
      "-hide_banner",
      "-i",
      input.sourcePath,
      "-vf",
      "blackdetect=d=0.08:pix_th=0.10",
      "-an",
      "-f",
      "null",
      "-",
    ],
    { signal: input.signal, maxBuffer: 16 * 1024 * 1024 },
  );
  const transitions = [
    ...detectDissolves(sceneScores, frames),
    ...parseBlackIntervals(blackPass.stderr.toString("utf8"), frames),
  ].sort((a, b) => a.startSeconds - b.startSeconds);
  for (const transition of transitions) {
    const nearby = cuts.find(
      (cut) =>
        cut.kind !== "start" &&
        cut.timeSeconds >= transition.startSeconds - 0.08 &&
        cut.timeSeconds <= transition.endSeconds + 0.08,
    );
    if (nearby) nearby.kind = transition.kind === "dissolve" ? "dissolve" : "fade";
  }

  progress(0.62, "Analyzing sample-aligned audio");
  let audioSampleRate: number | null = null;
  let audioChannels: number | null = null;
  let audioStartSeconds = 0;
  let audioEvents: ReferenceAudioEvent[] = [];
  const audioProbe = await runner(
    ffprobe,
    [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=sample_rate,channels,start_time",
      "-of",
      "json",
      "--",
      input.sourcePath,
    ],
    { signal: input.signal, maxBuffer: 1024 * 1024 },
  );
  const audioPayload = JSON.parse(audioProbe.stdout.toString("utf8")) as ProbePayload;
  const audio = audioPayload.streams?.[0];
  if (audio) {
    audioSampleRate = number(audio.sample_rate, 48_000);
    audioChannels = number(audio.channels, 1);
    audioStartSeconds = number(audio.start_time);
    const pcm = await runner(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input.sourcePath,
        "-map",
        "0:a:0",
        "-ac",
        "1",
        "-ar",
        String(PCM_SAMPLE_RATE),
        "-f",
        "f32le",
        "-",
      ],
      { signal: input.signal, maxBuffer: 512 * 1024 * 1024 },
    );
    audioEvents = audioEventsFromPcm(pcm.stdout, audioSampleRate, audioStartSeconds);
  }

  progress(0.9, "Building editable reconstruction draft");
  const id = input.analysisId ?? randomUUID();
  const groupId = input.groupId ?? `template-${id.slice(0, 8)}`;
  const manifest: ReferenceAnalysisManifest = {
    version: REFERENCE_ANALYSIS_VERSION,
    id,
    groupId,
    createdAt: new Date().toISOString(),
    analyzerVersion: ANALYZER_VERSION,
    source: {
      assetPath: input.assetPath,
      sourceUrl: input.sourceUrl,
      sha256: sourceHash,
      durationSeconds,
      width: number(video.width),
      height: number(video.height),
      frameRate,
      timebase,
      variableFrameRate: isVariableFrameRate(
        frames,
        video.avg_frame_rate ?? "",
        video.r_frame_rate ?? "",
      ),
      videoStartSeconds: number(video.start_time),
      audioStartSeconds,
      audioSampleRate,
      audioChannels,
    },
    frames,
    cuts,
    transitions,
    audioEvents,
    textDetections: [],
    scenes: scenesFromCuts(cuts, frames, durationSeconds),
    warnings: [
      {
        code: "ocr-pending",
        message:
          "Editable text detection is ready for an opt-in local OCR or vision enhancement pass.",
      },
    ],
  };
  if (cacheFile && input.cacheDirectory) {
    mkdirSync(input.cacheDirectory, { recursive: true });
    const temporary = `${cacheFile}.${randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(manifest)}\n`, "utf8");
    renameSync(temporary, cacheFile);
  }
  progress(1, "Ready for review");
  return manifest;
}
