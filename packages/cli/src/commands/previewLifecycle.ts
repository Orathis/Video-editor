import { spawn as nodeSpawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { scanActiveServers, type ActiveServer } from "../server/portUtils.js";
import type { BrowserGpuMode } from "../browser/gpuPolicy.js";
import { killProcessTree } from "../utils/orphanCleanup.js";

export interface PreviewSession {
  pid: number;
  port: number;
  projectDir: string;
  logPath: string;
}

type SpawnResult = { pid?: number; unref(): void };
type SpawnPreview = (
  command: string,
  args: string[],
  options: {
    detached: boolean;
    stdio: ["ignore", number, number];
    env: NodeJS.ProcessEnv;
  },
) => SpawnResult;

interface LifecycleDependencies {
  argv?: string[];
  execPath?: string;
  scan?: (startPort?: number) => Promise<ActiveServer[]>;
  spawn?: SpawnPreview;
  sleep?: (ms: number) => Promise<void>;
  kill?: (pid: number) => void;
  stateHome?: string;
  forceNew?: boolean;
  browserGpuMode?: BrowserGpuMode;
}

function defaultStateHome(): string {
  return process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
}

function normalized(path: string): string {
  const resolved = resolve(path).replace(/\\/g, "/");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function sessionDirectory(stateHome = defaultStateHome()): string {
  return join(stateHome, "hyperframes", "previews");
}

export function previewSessionPath(projectDir: string, stateHome = defaultStateHome()): string {
  const key = createHash("sha256").update(normalized(projectDir)).digest("hex").slice(0, 16);
  return join(sessionDirectory(stateHome), `${key}.json`);
}

function previewLogPath(projectDir: string, stateHome = defaultStateHome()): string {
  return previewSessionPath(projectDir, stateHome).replace(/\.json$/, ".log");
}

export function writePreviewSession(session: PreviewSession, stateHome = defaultStateHome()): void {
  const path = previewSessionPath(session.projectDir, stateHome);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
}

function readPreviewSession(
  projectDir: string,
  stateHome = defaultStateHome(),
): PreviewSession | null {
  const path = previewSessionPath(projectDir, stateHome);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as PreviewSession;
    if (
      !Number.isInteger(parsed.pid) ||
      parsed.pid <= 0 ||
      normalized(parsed.projectDir) !== normalized(projectDir)
    ) {
      throw new Error("invalid preview session");
    }
    return parsed;
  } catch {
    rmSync(path, { force: true });
    return null;
  }
}

function hasValidPreviewProcess(session: PreviewSession): boolean {
  return Number.isInteger(session.pid) && session.pid > 0;
}

function hasValidPreviewEndpoint(session: PreviewSession): boolean {
  return Number.isInteger(session.port) && session.port > 0 && session.port <= 65535;
}

function matchesPreviewSessionFile(
  session: PreviewSession,
  path: string,
  stateHome: string,
): boolean {
  return (
    typeof session.projectDir === "string" &&
    typeof session.logPath === "string" &&
    previewSessionPath(session.projectDir, stateHome) === path
  );
}

function readPreviewSessionFile(path: string, stateHome: string): PreviewSession | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as PreviewSession;
    if (
      !hasValidPreviewProcess(parsed) ||
      !hasValidPreviewEndpoint(parsed) ||
      !matchesPreviewSessionFile(parsed, path, stateHome)
    ) {
      throw new Error("invalid preview session");
    }
    return parsed;
  } catch {
    rmSync(path, { force: true });
    return null;
  }
}

function removePreviewSession(projectDir: string, stateHome = defaultStateHome()): void {
  rmSync(previewSessionPath(projectDir, stateHome), { force: true });
}

function matchingServer(
  servers: ActiveServer[],
  projectDir: string,
  browserGpuMode?: BrowserGpuMode,
): ActiveServer | null {
  return (
    servers.find(
      (server) =>
        normalized(server.projectDir) === normalized(projectDir) &&
        (browserGpuMode === undefined || server.browserGpuMode === browserGpuMode),
    ) ?? null
  );
}

function stopProcess(pid: number): void {
  killProcessTree(pid);
  if (process.platform === "win32") {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already exited.
    }
  }
}

const delay = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

function spawnDetachedPreview(
  projectDir: string,
  stateHome: string,
  dependencies: LifecycleDependencies,
): { pid: number; logPath: string } {
  const logPath = previewLogPath(projectDir, stateHome);
  mkdirSync(dirname(logPath), { recursive: true });
  const logFd = openSync(logPath, "a", 0o600);
  const spawn = dependencies.spawn ?? (nodeSpawn as unknown as SpawnPreview);
  let child: SpawnResult;
  try {
    child = spawn(
      dependencies.execPath ?? process.execPath,
      buildBackgroundPreviewArgs(dependencies.argv ?? process.argv.slice(1)),
      {
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: process.env,
      },
    );
  } finally {
    closeSync(logFd);
  }
  if (!child.pid) throw new Error("background preview child did not report a PID");
  child.unref();
  return { pid: child.pid, logPath };
}

function startedServer(
  servers: ActiveServer[],
  projectDir: string,
  existing: ActiveServer | null,
  forceNew: boolean,
  browserGpuMode?: BrowserGpuMode,
): ActiveServer | null {
  const candidates =
    forceNew && existing ? servers.filter((server) => server.port !== existing.port) : servers;
  return matchingServer(candidates, projectDir, browserGpuMode);
}

export function buildBackgroundPreviewArgs(argv: string[]): string[] {
  const filtered = argv.filter(
    (arg) =>
      arg !== "--background" &&
      !arg.startsWith("--background=") &&
      arg !== "--foreground" &&
      !arg.startsWith("--foreground=") &&
      arg !== "--open" &&
      arg !== "--no-open" &&
      arg !== "--json",
  );
  return [...filtered, "--foreground", "--no-open"];
}

export async function readBackgroundPreviewStatus(
  projectDir: string,
  startPort: number,
  dependencies: LifecycleDependencies = {},
): Promise<PreviewSession | null> {
  const scan = dependencies.scan ?? scanActiveServers;
  const stateHome = dependencies.stateHome ?? defaultStateHome();
  const saved = readPreviewSession(projectDir, stateHome);
  const server = matchingServer(await scan(saved?.port ?? startPort), projectDir);
  if (server) {
    const pid = Number(server.pid ?? saved?.pid);
    if (Number.isInteger(pid) && pid > 0) {
      return {
        pid,
        port: server.port,
        projectDir: resolve(projectDir),
        logPath: saved?.logPath ?? previewLogPath(projectDir, stateHome),
      };
    }
  }

  removePreviewSession(projectDir, stateHome);
  return null;
}

export async function listBackgroundPreviewStatuses(
  dependencies: LifecycleDependencies = {},
): Promise<PreviewSession[]> {
  const stateHome = dependencies.stateHome ?? defaultStateHome();
  const directory = sessionDirectory(stateHome);
  let files: string[];
  try {
    files = readdirSync(directory)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(directory, name));
  } catch {
    return [];
  }

  const saved = files
    .map((path) => readPreviewSessionFile(path, stateHome))
    .filter((session): session is PreviewSession => session !== null);
  const statuses = await Promise.all(
    saved.map((session) =>
      readBackgroundPreviewStatus(session.projectDir, session.port, {
        ...dependencies,
        stateHome,
      }),
    ),
  );
  return statuses.filter((status): status is PreviewSession => status !== null);
}

export async function startBackgroundPreview(
  projectDir: string,
  startPort: number,
  dependencies: LifecycleDependencies = {},
): Promise<
  | { type: "reused"; port: number; pid: number | null; logPath: string | null }
  | { type: "started"; port: number; pid: number; logPath: string }
> {
  const scan = dependencies.scan ?? scanActiveServers;
  const stateHome = dependencies.stateHome ?? defaultStateHome();
  const saved = readPreviewSession(projectDir, stateHome);
  const scanStart = dependencies.forceNew ? startPort : (saved?.port ?? startPort);
  const existing = matchingServer(await scan(scanStart), projectDir, dependencies.browserGpuMode);
  if (existing && !dependencies.forceNew) {
    return {
      type: "reused",
      port: existing.port,
      pid: existing.pid ? Number(existing.pid) : null,
      logPath: null,
    };
  }

  const { pid, logPath } = spawnDetachedPreview(projectDir, stateHome, dependencies);

  const sleep = dependencies.sleep ?? delay;
  for (let attempt = 0; attempt < 50; attempt++) {
    const server = startedServer(
      await scan(startPort),
      projectDir,
      existing,
      dependencies.forceNew === true,
      dependencies.browserGpuMode,
    );
    if (server) {
      const session = {
        pid,
        port: server.port,
        projectDir: resolve(projectDir),
        logPath,
      };
      writePreviewSession(session, stateHome);
      return { type: "started", ...session };
    }
    await sleep(200);
  }

  (dependencies.kill ?? stopProcess)(pid);
  throw new Error(`background preview did not become ready; see ${logPath}`);
}

export async function stopBackgroundPreview(
  projectDir: string,
  startPort: number,
  dependencies: LifecycleDependencies = {},
): Promise<boolean> {
  const scan = dependencies.scan ?? scanActiveServers;
  const stateHome = dependencies.stateHome ?? defaultStateHome();
  const saved = readPreviewSession(projectDir, stateHome);
  const scanStart = saved?.port ?? startPort;
  const server = matchingServer(await scan(scanStart), projectDir);
  if (!server) {
    removePreviewSession(projectDir, stateHome);
    return false;
  }
  // A saved PID can be reused after a crashed preview. The HTTP probe proves
  // the project, but only the live server's own metadata proves which process
  // owns it; never substitute the saved wrapper PID here.
  const pid = Number(server.pid);
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`preview ownership could not be proven for ${resolve(projectDir)}`);
  }

  const kill = dependencies.kill ?? stopProcess;
  kill(pid);

  const sleep = dependencies.sleep ?? delay;
  for (let attempt = 0; attempt < 25; attempt++) {
    if (!matchingServer(await scan(scanStart), projectDir)) {
      removePreviewSession(projectDir, stateHome);
      return true;
    }
    await sleep(100);
  }
  throw new Error(`background preview did not stop for ${resolve(projectDir)}`);
}
