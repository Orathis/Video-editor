#!/usr/bin/env node
/**
 * Wall-clock gate for Studio's cold load and project-open time.
 *
 * Distinct from tests/e2e/timeline-virtualization.mjs, which injects a synthetic
 * element set straight into the store and measures scroll. This one navigates
 * cold to a real on-disk project and reads the marks Studio emits, so it covers
 * the pipeline a user actually waits on.
 *
 *   STUDIO_URL=http://127.0.0.1:5191/#project/studio-load \
 *     STUDIO_LOAD_ARM=dev bun packages/studio/tests/e2e/studio-load.mjs
 *
 * Run under bun, not node: the budgets are imported from their TypeScript home
 * so this gate and the app read one owner rather than two copies of the numbers.
 *
 * STUDIO_LOAD_ARM selects which serve mode is under test. "embedded" is the
 * pre-built SPA the CLI ships and the only arm carrying a product promise.
 * "dev" is the Vite dev server contributors run; its budgets are a regression
 * signal, not a claim about what users experience. The gate asserts the arm it
 * observes rather than trusting the caller, because a dev number reported as an
 * embedded number is worse than no number.
 *
 * Every measurement comes from performance.measure entries. There is no DOM
 * polling fallback: an absent measure fails the run. The probe this replaces
 * polled a mounted-clip count every 400ms until it held for four polls, which
 * baked ~1.6s of its own debounce into every figure it produced.
 */
import puppeteer from "puppeteer-core";
import { percentile, resolveChromeExecutable } from "./puppeteerEnv.mjs";
import { STUDIO_LOAD_BUDGETS } from "../../src/lib/studioLoadBudgets.ts";

const STUDIO_URL = process.env.STUDIO_URL;
const ARM = process.env.STUDIO_LOAD_ARM || "dev";
const CLIP_COUNT = Number(process.env.STUDIO_LOAD_CLIPS || 1_000);
const TIER = process.env.STUDIO_LOAD_TIER || "primary";
const ROW_VIRTUALIZATION = process.env.STUDIO_LOAD_ROW_VIRTUALIZATION || "off";
const WARMUP_RUNS = Number(process.env.STUDIO_LOAD_WARMUP ?? 1);
const MEASURED_RUNS = Number(process.env.STUDIO_LOAD_RUNS ?? 5);
const OPEN_TIMEOUT_MS = Number(process.env.STUDIO_LOAD_TIMEOUT_MS ?? 180_000);

const MEASURES = [
  "hf.studio.shell",
  "hf.studio.project-open",
  "hf.studio.preview",
  "hf.studio.manifest-derive",
];

if (!STUDIO_URL) {
  console.error(
    "STUDIO_URL is required and must point at a Studio serving the studio-load fixture",
  );
  process.exit(2);
}
if (
  !["embedded", "dev"].includes(ARM) ||
  ![1_000, 3_000].includes(CLIP_COUNT) ||
  !["primary", "ci"].includes(TIER) ||
  !["off", "on"].includes(ROW_VIRTUALIZATION)
) {
  console.error(
    "STUDIO_LOAD_ARM must be embedded or dev; " +
      "STUDIO_LOAD_CLIPS must be 1000 or 3000; " +
      "STUDIO_LOAD_TIER must be primary or ci; " +
      "STUDIO_LOAD_ROW_VIRTUALIZATION must be off or on",
  );
  process.exit(2);
}

function median(values) {
  return percentile(values, 0.5);
}

/**
 * The dev server serves the unbundled entry module; the pre-built SPA serves a
 * hashed asset. That difference is what distinguishes the arms from inside the
 * page, and it holds in both directions — unlike window.__studioTest, which the
 * production build strips entirely.
 */
async function observeArm(page) {
  return page.evaluate(() => {
    const sources = Array.from(document.querySelectorAll("script[src]")).map(
      (node) => node.getAttribute("src") || "",
    );
    if (sources.some((src) => src.includes("/src/main.tsx") || src.includes("/@vite/client")))
      return "dev";
    if (sources.some((src) => /\/assets\/index-[^/]+\.js/.test(src))) return "embedded";
    return "unknown";
  });
}

async function runOnce(executablePath, label) {
  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1600,1000"],
    defaultViewport: { width: 1600, height: 1000 },
  });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    const startedAt = Date.now();
    await page.goto(STUDIO_URL, { waitUntil: "domcontentloaded", timeout: OPEN_TIMEOUT_MS });

    const observedArm = await observeArm(page);
    if (observedArm !== ARM) {
      console.error(
        `FAIL: requested arm "${ARM}" but the server under test is "${observedArm}" (${STUDIO_URL})`,
      );
      await browser.close();
      process.exit(2);
    }

    try {
      await page.waitForFunction(
        () => performance.getEntriesByName("hf.studio.project-open", "measure").length > 0,
        { timeout: OPEN_TIMEOUT_MS, polling: 100 },
      );
    } catch {
      throw new Error(
        `${label}: hf.studio.project-open never appeared within ${OPEN_TIMEOUT_MS}ms. ` +
          `Page errors: ${pageErrors.length ? pageErrors.join(" | ") : "none"}`,
      );
    }

    const measures = await page.evaluate((names) => {
      const read = (name) => {
        const entries = performance.getEntriesByName(name, "measure");
        return entries.length === 0
          ? null
          : Number(entries[entries.length - 1].duration.toFixed(1));
      };
      return Object.fromEntries(names.map((name) => [name, read(name)]));
    }, MEASURES);

    const clipCount = await page.evaluate(
      () => document.querySelectorAll('[data-clip="true"]').length,
    );
    return {
      ...measures,
      wallClockMs: Date.now() - startedAt,
      mountedClips: clipCount,
      pageErrors: pageErrors.length,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

const executablePath = resolveChromeExecutable();
if (!executablePath) {
  console.error("No Chrome executable found. Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH.");
  process.exit(2);
}

console.log(
  `studio-load gate | arm=${ARM} clips=${CLIP_COUNT} tier=${TIER} rowVirtualization=${ROW_VIRTUALIZATION} ` +
    `warmup=${WARMUP_RUNS} measured=${MEASURED_RUNS}`,
);
if (ARM === "dev") {
  console.log(
    "NOTE: dev arm — a Vite dev server, not the build users run. Regression signal only, not a product number.",
  );
}

for (let i = 0; i < WARMUP_RUNS; i += 1) {
  const result = await runOnce(executablePath, `warmup ${i + 1}`);
  console.log(`  warmup ${i + 1}: project-open ${result["hf.studio.project-open"]}ms (discarded)`);
}

const runs = [];
for (let i = 0; i < MEASURED_RUNS; i += 1) {
  const result = await runOnce(executablePath, `run ${i + 1}`);
  runs.push(result);
  console.log(
    `  run ${i + 1}: shell ${result["hf.studio.shell"]}ms | open ${result["hf.studio.project-open"]}ms ` +
      `(preview ${result["hf.studio.preview"]}ms, derive ${result["hf.studio.manifest-derive"]}ms) | ` +
      `mounted ${result.mountedClips} clips`,
  );
}

const summary = Object.fromEntries(
  MEASURES.map((name) => {
    const values = runs.map((run) => run[name]).filter((value) => typeof value === "number");
    return [
      name,
      { median: median(values), p95: percentile(values, 0.95), samples: values.length },
    ];
  }),
);

console.log("\n=== summary ===");
for (const name of MEASURES) {
  const stat = summary[name];
  console.log(
    `  ${name.padEnd(28)} median ${String(stat.median).padStart(8)}ms   p95 ${String(stat.p95).padStart(8)}ms   n=${stat.samples}`,
  );
}

const budgets = STUDIO_LOAD_BUDGETS;
const constrained = TIER === "ci";
const pick = (primary, ci) => (constrained ? ci : primary);
const shellBudget =
  ARM === "embedded"
    ? pick(budgets.shellReadyP95Ms, budgets.constrainedShellReadyP95Ms)
    : pick(budgets.devShellReadyP95Ms, budgets.constrainedDevShellReadyP95Ms);
// The plan's table defines a dev open budget at 3k clips only. Rather than
// invent one for 1k, the gate reports the number and says it is ungated.
const openBudget =
  ARM === "embedded"
    ? CLIP_COUNT === 3_000
      ? pick(budgets.projectOpen3kClipsP95Ms, budgets.constrainedProjectOpen3kClipsP95Ms)
      : pick(budgets.projectOpen1kClipsP95Ms, budgets.constrainedProjectOpen1kClipsP95Ms)
    : CLIP_COUNT === 3_000
      ? pick(budgets.devProjectOpen3kClipsP95Ms, budgets.constrainedDevProjectOpen3kClipsP95Ms)
      : null;

const failures = [];
if (summary["hf.studio.shell"].p95 > shellBudget) {
  failures.push(`shell p95 ${summary["hf.studio.shell"].p95}ms exceeds ${shellBudget}ms`);
}
if (openBudget !== null && summary["hf.studio.project-open"].p95 > openBudget) {
  failures.push(
    `project-open p95 ${summary["hf.studio.project-open"].p95}ms exceeds ${openBudget}ms`,
  );
}

console.log(
  `\nbudgets (arm=${ARM}, tier=${TIER}): shell p95 <= ${shellBudget}ms, ` +
    `project-open p95 ${openBudget === null ? "UNGATED (no budget defined for this arm at this clip count)" : `<= ${openBudget}ms`}`,
);
console.log(
  JSON.stringify(
    {
      arm: ARM,
      clips: CLIP_COUNT,
      tier: TIER,
      rowVirtualization: ROW_VIRTUALIZATION,
      summary,
      runs,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("\nPASS");
