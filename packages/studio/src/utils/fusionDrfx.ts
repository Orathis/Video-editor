const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 768 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const MAX_NESTED_DEPTH = 2;

interface ZipDirectoryEntry {
  path: string;
  flags: number;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

export interface DrfxEntry {
  path: string;
  bytes: Uint8Array;
}

export interface DrfxContents {
  templates: DrfxEntry[];
  assets: DrfxEntry[];
}

interface ExtractionBudget {
  entries: number;
  expandedBytes: number;
}

function safeArchivePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return false;
  return !normalized.split("/").some((part) => part === ".." || part.includes("\0"));
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset--) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("Invalid .drfx archive: ZIP directory was not found.");
}

function parseDirectory(bytes: Uint8Array, budget: ExtractionBudget): ZipDirectoryEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(bytes);
  const entryCount = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  budget.entries += entryCount;
  if (budget.entries > MAX_ENTRIES)
    throw new Error(`The .drfx archive contains more than ${MAX_ENTRIES} files.`);
  if (directoryOffset + directorySize > bytes.length)
    throw new Error("Invalid .drfx archive directory bounds.");
  const entries: ZipDirectoryEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new Error("Invalid .drfx archive directory entry.");
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) throw new Error("Invalid .drfx archive filename bounds.");
    const path = new TextDecoder("utf-8", { fatal: false }).decode(
      bytes.subarray(nameStart, nameEnd),
    );
    if (!safeArchivePath(path)) throw new Error(`Unsafe path in .drfx archive: ${path}`);
    if ((flags & 1) !== 0) throw new Error(`Encrypted .drfx entries are not supported: ${path}`);
    if (method !== 0 && method !== 8)
      throw new Error(`Unsupported compression method ${method} in ${path}`);
    budget.expandedBytes += uncompressedSize;
    if (budget.expandedBytes > MAX_EXPANDED_BYTES)
      throw new Error("The expanded .drfx archive is too large.");
    entries.push({ path, flags, method, compressedSize, uncompressedSize, localOffset });
    offset = nameEnd + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy.buffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractEntry(archive: Uint8Array, entry: ZipDirectoryEntry): Promise<Uint8Array> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  if (
    entry.localOffset + 30 > archive.length ||
    view.getUint32(entry.localOffset, true) !== LOCAL_SIGNATURE
  ) {
    throw new Error(`Invalid local ZIP entry for ${entry.path}`);
  }
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > archive.length) throw new Error(`Invalid compressed data bounds for ${entry.path}`);
  const compressed = archive.subarray(start, end);
  const bytes = entry.method === 0 ? compressed.slice() : await inflateRaw(compressed);
  if (bytes.length !== entry.uncompressedSize)
    throw new Error(`Expanded size mismatch for ${entry.path}`);
  return bytes;
}

function isTemplate(path: string): boolean {
  return /\.(?:comp|setting)$/i.test(path);
}

function isImportableAsset(path: string): boolean {
  return /\.(?:png|jpe?g|webp|gif|svg|mp4|mov|m4v|webm|mp3|wav|ogg|m4a|aac|flac|ttf|otf|woff2?|cube)$/i.test(
    path,
  );
}

function isNestedDrfx(path: string): boolean {
  return /\.drfx$/i.test(path);
}

async function extractFusionArchive(
  archive: Uint8Array,
  budget: ExtractionBudget,
  prefix: string,
  depth: number,
): Promise<DrfxContents & { containsProjectArchive: boolean }> {
  const directory = parseDirectory(archive, budget).filter((entry) => !entry.path.endsWith("/"));
  const templates: DrfxEntry[] = [];
  const assets: DrfxEntry[] = [];
  let containsProjectArchive = directory.some((entry) => /\.(?:drp|dra)$/i.test(entry.path));
  for (const entry of directory) {
    if (!isTemplate(entry.path) && !isImportableAsset(entry.path) && !isNestedDrfx(entry.path)) {
      continue;
    }
    const bytes = await extractEntry(archive, entry);
    const path = `${prefix}${entry.path}`;
    if (isTemplate(entry.path)) {
      templates.push({ path, bytes });
    } else if (isImportableAsset(entry.path)) {
      assets.push({ path, bytes });
    } else if (depth < MAX_NESTED_DEPTH) {
      const nested = await extractFusionArchive(
        bytes,
        budget,
        `${path.replace(/\.drfx$/i, "")}/`,
        depth + 1,
      );
      templates.push(...nested.templates);
      assets.push(...nested.assets);
      containsProjectArchive ||= nested.containsProjectArchive;
    }
  }
  return { templates, assets, containsProjectArchive };
}

export async function extractDrfx(file: File): Promise<DrfxContents> {
  if (file.size > MAX_ARCHIVE_BYTES)
    throw new Error("The .drfx archive exceeds the 256 MB import limit.");
  const archive = new Uint8Array(await file.arrayBuffer());
  const extracted = await extractFusionArchive(archive, { entries: 0, expandedBytes: 0 }, "", 0);
  if (extracted.templates.length === 0 && extracted.containsProjectArchive) {
    throw new Error(
      "This package contains a DaVinci project archive (.drp/.dra), not an editable Fusion template. Choose an Envato package that includes .setting, .comp, or .drfx files.",
    );
  }
  if (extracted.templates.length === 0)
    throw new Error("This .drfx bundle does not contain a .comp or .setting template.");
  return { templates: extracted.templates, assets: extracted.assets };
}
