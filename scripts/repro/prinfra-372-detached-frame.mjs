#!/usr/bin/env node
/**
 * Repro harness for PRINFRA-372 — `Attempted to use detached Frame` /
 * `Target closed` during parallel capture.
 *
 * WHY THIS EXISTS
 *
 * The crash did not reproduce on a 14-core / 48 GB darwin/arm64 workstation
 * across two attempts. The reporter's machine was 10-core / 16 GB. Fleet
 * telemetry (30d) says the signature is:
 *
 *   - enriched 2.6x on darwin/arm64 (66.5% / 62.0% vs 25.8% / 24.7% baseline)
 *   - concentrated on os_release 25.5.0 (369 of ~700 darwin cases)
 *   - spread across CLI 0.7.10 -> 0.7.94, so not a release regression
 *   - *depleted* on multi-worker (23.0% vs 42.8% baseline) — i.e. worker count
 *     looks like a correlate of memory pressure, not the cause
 *
 * So the missing variable is almost certainly memory headroom, which a
 * developer workstation cannot exercise. This harness makes the constrained
 * condition reproducible and the result falsifiable either way.
 *
 * USAGE
 *
 *   node scripts/repro/prinfra-372-detached-frame.mjs                 # defaults
 *   node scripts/repro/prinfra-372-detached-frame.mjs --runs 5
 *   node scripts/repro/prinfra-372-detached-frame.mjs --seconds 176 --workers 4
 *   node scripts/repro/prinfra-372-detached-frame.mjs --docker --memory 16g
 *
 * Exit code 1 means the crash REPRODUCED — that is the success condition for
 * this script, so wire it into CI accordingly if you want a regression gate.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cpus, totalmem } from "node:os";

const SIGNATURES = [
  { name: "detached Frame", re: /detached\s+frame/i },
  { name: "Target closed", re: /target\s+closed/i },
  { name: "Session closed", re: /session\s+closed/i },
  { name: "Protocol error", re: /protocol\s+error/i },
];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next === undefined || next.startsWith("--") ? true : next;
}

const runs = Number(arg("runs", 3));
const seconds = Number(arg("seconds", 176)); // reporter's composition length
const fps = Number(arg("fps", 30));
const tweens = Number(arg("tweens", 457)); // reporter's caption tween count
const segments = Number(arg("segments", 14)); // reporter's media segment count
const workers = arg("workers", "auto");
const useDocker = arg("docker", false) === true;
const memory = arg("memory", "16g");
const clip = arg("clip", undefined);

/**
 * Reporter's composition shape: long, 1080p, heavy word-pop caption load, and
 * a media segment track with two videos. Videos are only included when a clip
 * is supplied — an unresolvable src would fail the render for the wrong reason
 * and look like a repro.
 */
function composition() {
  const segs = [];
  for (let i = 0; i < segments; i++) {
    const t = (i * seconds) / segments;
    const dur = seconds / segments;
    const isVideo = clip && (i === 3 || i === 9);
    segs.push(
      isVideo
        ? `<video id="v${i}" class="clip seg" data-start="${t.toFixed(2)}" data-duration="${dur.toFixed(2)}" src="clip.mp4" muted></video>`
        : `<div id="s${i}" class="clip seg" data-start="${t.toFixed(2)}" data-duration="${dur.toFixed(2)}">segment ${i}</div>`,
    );
  }
  const words = [];
  const tl = [];
  const step = seconds / tweens;
  for (let i = 0; i < tweens; i++) {
    words.push(`<span class="w" id="w${i}">w${i}</span>`);
    tl.push(
      `tl.fromTo("#w${i}",{opacity:0,y:18,scale:.85},{opacity:1,y:0,scale:1,duration:.28,ease:"back.out(2)"},${(i * step).toFixed(3)});`,
    );
  }
  return `<!doctype html>
<html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  body{margin:0;background:#0b0d12;color:#eaeef6;font-family:system-ui,sans-serif}
  #root{width:1920px;height:1080px;position:relative;overflow:hidden}
  .seg{position:absolute;inset:0;object-fit:cover;font-size:120px;display:grid;place-items:center}
  .w{display:inline-block;margin:0 6px;font-size:44px;font-weight:700;opacity:0}
  #caps{position:absolute;left:80px;right:80px;bottom:120px;line-height:1.5;z-index:5}
</style></head>
<body>
<div id="root" data-composition-id="prinfra372" data-duration="${seconds}"
     data-width="1920" data-height="1080" data-fps="${fps}">
  ${segs.join("\n  ")}
  <div id="caps" class="clip" data-start="0" data-duration="${seconds}">${words.join("")}</div>
</div>
<script>
  const tl = gsap.timeline({paused:true});
  ${tl.join("\n  ")}
  window.__timelines = [tl];
</script>
</body></html>`;
}

const dir = mkdtempSync(join(tmpdir(), "prinfra372-"));
writeFileSync(join(dir, "index.html"), composition());
if (clip) {
  if (!existsSync(clip)) {
    console.error(`clip not found: ${clip}`);
    process.exit(2);
  }
  copyFileSync(clip, join(dir, "clip.mp4"));
}

console.log(`PRINFRA-372 repro harness`);
console.log(`  host      ${process.platform}/${process.arch}, ${cpus().length} cores, ${Math.round(totalmem() / 2 ** 30)} GB`);
console.log(`  comp      ${seconds}s @${fps}fps = ${seconds * fps} frames, ${tweens} tweens, ${segments} segments${clip ? " (2 video)" : " (no video — pass --clip)"}`);
console.log(`  workers   ${workers}`);
console.log(`  mode      ${useDocker ? `docker, --memory ${memory}` : "host"}`);
console.log(`  runs      ${runs}`);
if (!useDocker && totalmem() / 2 ** 30 > 20) {
  console.log(
    `\n  ! This host has ample RAM. The signature is believed to need memory\n` +
      `    pressure (reporter: 16 GB). Re-run with --docker --memory 16g, or on\n` +
      `    a constrained machine, before concluding "cannot reproduce".`,
  );
}
console.log(`  project   ${dir}\n`);

let reproduced = 0;
for (let run = 1; run <= runs; run++) {
  const args = useDocker
    ? ["run", "--rm", `--memory=${memory}`, `--memory-swap=${memory}`, "-v", `${dir}:/work`,
       "-w", "/work", "node:22", "npx", "-y", "hyperframes", "render", ".", "out.mp4",
       "--quality", "high", ...(workers === "auto" ? [] : ["--workers", String(workers)])]
    : ["render", ".", "out.mp4", "--quality", "high",
       ...(workers === "auto" ? [] : ["--workers", String(workers)])];
  const bin = useDocker ? "docker" : "hyperframes";

  const t0 = Date.now();
  const r = spawnSync(bin, args, {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, HF_DE_PARALLEL_ROUTER: "true" },
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const hits = SIGNATURES.filter((s) => s.re.test(out)).map((s) => s.name);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  if (hits.length > 0) {
    reproduced++;
    console.log(`  run ${run}/${runs}  REPRODUCED in ${secs}s — ${hits.join(", ")}`);
    for (const line of out.split("\n").filter((l) => SIGNATURES.some((s) => s.re.test(l))).slice(0, 4)) {
      console.log(`      ${line.trim().slice(0, 160)}`);
    }
  } else {
    console.log(`  run ${run}/${runs}  clean in ${secs}s (exit ${r.status})`);
  }
}

console.log(`\n  ${reproduced}/${runs} run(s) reproduced the signature.`);
if (reproduced === 0) {
  console.log(
    `  Not reproduced. That is only meaningful on a memory-constrained host —\n` +
      `  see the note above and the telemetry summary in the ticket.`,
  );
}
process.exit(reproduced > 0 ? 1 : 0);
