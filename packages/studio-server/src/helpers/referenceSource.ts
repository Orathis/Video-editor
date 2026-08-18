import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { lookup } from "node:dns/promises";
import { closeSync, existsSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { isIP } from "node:net";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv"]);
const SOCIAL_HOSTS = ["instagram.com", "tiktok.com", "youtube.com", "youtu.be"];

type FetchReference = (url: string, init: RequestInit) => Promise<Response>;
type LookupAddresses = (hostname: string) => Promise<string[]>;
type SocialDownload = (input: {
  url: string;
  projectDir: string;
  maxBytes: number | null;
}) => Promise<string>;

export interface DownloadRemoteReferenceInput {
  url: string;
  projectDir: string;
  fetchReference?: FetchReference;
  lookupAddresses?: LookupAddresses;
  socialDownload?: SocialDownload;
}

export interface DownloadedReference {
  sourcePath: string;
  assetPath: string;
  title: string;
}

function titleCase(value: string): string {
  return value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[-_][a-z0-9_]{8,24}$/i, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function urlLabel(url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  const leaf = segments.at(-1) ?? "";
  const site = url.hostname.replace(/^www\./, "").split(".")[0] ?? "Reference";
  if (leaf && !["watch", "reel", "video", "videos"].includes(leaf.toLowerCase())) {
    return `${titleCase(site)} ${titleCase(decodeURIComponent(leaf))}`.trim();
  }
  return `${titleCase(site)} Reference`.trim();
}

export function inferReferenceTitle(source: string): string {
  try {
    const url = new URL(source);
    const leaf = basename(decodeURIComponent(url.pathname));
    if (VIDEO_EXTENSIONS.has(extname(leaf).toLowerCase())) return titleCase(leaf);
    return urlLabel(url);
  } catch {
    const leaf = basename(source.replace(/\\/g, "/"));
    return titleCase(leaf) || "Imported Reference";
  }
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const ipv4 = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
  const parts = ipv4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a = 0, b = 0] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function defaultLookupAddresses(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true });
  return records.map((record) => record.address);
}

async function validateRemoteUrl(url: URL, lookupAddresses: LookupAddresses): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Reference links must use HTTP or HTTPS.");
  }
  if (url.username || url.password) throw new Error("Reference links cannot contain credentials.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("Local and private network links are not supported.");
  }
  const addresses = isIP(hostname) ? [hostname] : await lookupAddresses(hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("Local and private network links are not supported.");
  }
}

function responseFilename(response: Response, url: URL): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded.replace(/["']/g, ""));
  const plain = disposition.match(/filename=["']?([^"';]+)["']?/i)?.[1];
  return plain?.trim() || basename(decodeURIComponent(url.pathname));
}

function videoExtension(filename: string, contentType: string): string {
  const extension = extname(filename).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) return extension;
  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("quicktime")) return ".mov";
  if (contentType.includes("matroska")) return ".mkv";
  return ".mp4";
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "reference"
  );
}

function configuredMaxBytes(): number | null {
  const value = Number(process.env.REFERENCE_IMPORT_MAX_BYTES ?? 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isSocialPost(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  return SOCIAL_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function findYtDlp(projectDir: string): string {
  const configured = process.env.HYPERFRAMES_YTDLP_PATH;
  if (configured && existsSync(configured)) return configured;
  const executable = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  for (const start of [process.cwd(), projectDir]) {
    let directory = resolve(start);
    for (let depth = 0; depth < 7; depth++) {
      const candidate = join(directory, ".hyperframes", "bin", executable);
      if (existsSync(candidate)) return candidate;
      const parent = dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  return executable;
}

const defaultSocialDownload: SocialDownload = ({ url, projectDir, maxBytes }) =>
  new Promise((resolveDownload, reject) => {
    const targetDirectory = join(projectDir, "assets", "references");
    mkdirSync(targetDirectory, { recursive: true });
    const outputTemplate = join(targetDirectory, "%(title).100B-%(id)s.%(ext)s");
    const args = [
      "--no-playlist",
      "--no-progress",
      "--restrict-filenames",
      "--format",
      "best[ext=mp4]/best",
      "--output",
      outputTemplate,
      "--print",
      "after_move:filepath",
    ];
    if (maxBytes) args.push("--max-filesize", String(maxBytes));
    args.push(url);
    execFile(
      findYtDlp(projectDir),
      args,
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || stdout || error.message).trim();
          reject(
            new Error(
              detail.includes("ENOENT")
                ? "Social-post imports require yt-dlp. Install it or set HYPERFRAMES_YTDLP_PATH."
                : `Could not resolve that social post: ${detail}`,
            ),
          );
          return;
        }
        const sourcePath = String(stdout).trim().split(/\r?\n/).filter(Boolean).at(-1);
        if (!sourcePath) {
          reject(new Error("The social post did not expose a downloadable video."));
          return;
        }
        resolveDownload(resolve(sourcePath));
      },
    );
  });

export async function downloadRemoteReference(
  input: DownloadRemoteReferenceInput,
): Promise<DownloadedReference> {
  const fetchReference = input.fetchReference ?? fetch;
  const lookupAddresses = input.lookupAddresses ?? defaultLookupAddresses;
  const socialDownload = input.socialDownload ?? defaultSocialDownload;
  const maxBytes = configuredMaxBytes();
  let currentUrl: URL;
  try {
    currentUrl = new URL(input.url.trim());
  } catch {
    throw new Error("Enter a valid video URL.");
  }

  await validateRemoteUrl(currentUrl, lookupAddresses);
  if (isSocialPost(currentUrl)) {
    const sourcePath = await socialDownload({
      url: currentUrl.href,
      projectDir: input.projectDir,
      maxBytes,
    });
    const assetDirectory = resolve(input.projectDir, "assets", "references");
    const relativePath = relative(input.projectDir, sourcePath);
    const relativeToAssets = relative(assetDirectory, sourcePath);
    if (
      !existsSync(sourcePath) ||
      isAbsolute(relativePath) ||
      relativeToAssets.startsWith("..") ||
      isAbsolute(relativeToAssets)
    ) {
      throw new Error("The social extractor returned an unsafe or missing media path.");
    }
    return {
      sourcePath,
      assetPath: relativePath.replaceAll("\\", "/"),
      title: inferReferenceTitle(sourcePath),
    };
  }

  let response: Response | null = null;
  for (let redirect = 0; redirect <= 5; redirect++) {
    await validateRemoteUrl(currentUrl, lookupAddresses);
    response = await fetchReference(currentUrl.href, {
      redirect: "manual",
      headers: { Accept: "video/*, application/octet-stream;q=0.9" },
    });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location || redirect === 5) throw new Error("The video link redirected too many times.");
    currentUrl = new URL(location, currentUrl);
  }
  if (!response?.ok) throw new Error(`The video link returned HTTP ${response?.status ?? 500}.`);
  if (!response.body) throw new Error("The video link returned an empty response.");

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const filename = responseFilename(response, currentUrl);
  const extension = extname(filename).toLowerCase();
  const looksLikeVideo =
    contentType.startsWith("video/") ||
    contentType.includes("application/octet-stream") ||
    VIDEO_EXTENSIONS.has(extension);
  if (!looksLikeVideo) {
    throw new Error(
      "That link is a web page, not a direct video file. Paste a direct MP4/MOV/WebM link or upload the owned video.",
    );
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (maxBytes && declaredLength > maxBytes) {
    throw new Error("The linked video exceeds REFERENCE_IMPORT_MAX_BYTES.");
  }

  const title = filename ? inferReferenceTitle(filename) : inferReferenceTitle(currentUrl.href);
  const assetPath = `assets/references/${slug(title)}-${randomUUID().slice(0, 8)}${videoExtension(filename, contentType)}`;
  const sourcePath = join(input.projectDir, ...assetPath.split("/"));
  mkdirSync(dirname(sourcePath), { recursive: true });
  const temporary = `${sourcePath}.${randomUUID()}.tmp`;
  const handle = openSync(temporary, "wx");
  let bytes = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (maxBytes && bytes > maxBytes) {
        await reader.cancel();
        throw new Error("The linked video exceeds REFERENCE_IMPORT_MAX_BYTES.");
      }
      writeSync(handle, chunk.value);
    }
    closeSync(handle);
    renameSync(temporary, sourcePath);
  } catch (error) {
    try {
      closeSync(handle);
    } catch {
      // The successful path already closed the descriptor.
    }
    rmSync(temporary, { force: true });
    throw error;
  }
  return { sourcePath, assetPath, title };
}
