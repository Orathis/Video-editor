#!/usr/bin/env python3
"""Score the checkpoint log and write the round-two report.

Round one printed one card per run. At 2043 runs that is unreadable, so this
aggregates first and shows individual runs only where they carry information:
the failures, and a fixed sample of them rather than all of them.

Reads only the checkpoint log, never the network, so it can run while the grid
is still going and again when it finishes.
"""

import collections
import html
import json
import os
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
# Round 3 owns the clustered statistics, and round 2 is re-reported through the
# same module rather than through a second copy that could drift away from it.
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "round3"))

import gate2  # noqa: E402
import harness2  # noqa: E402
import run2  # noqa: E402
import stats  # noqa: E402

CHECKPOINT = os.path.join(HERE, "checkpoints", "results.jsonl")
INDEX = os.path.join(HERE, "catalog-index.json")
REPORT = os.path.join(HERE, "report.html")
SUMMARY = os.path.join(HERE, "summary.json")
FAILURE_SAMPLE = 12


def cell_key(record):
    """The label a cell is reported under. c@5 and c@10 are different cells."""
    k = record.get("k")
    return record["condition"] + (f"@{k}" if k else "")


def load_results(path=CHECKPOINT):
    records = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def strata(index_path=INDEX):
    """Map each move to primitive, block or component."""
    with open(index_path, encoding="utf-8") as fh:
        index = json.load(fh)
    kinds = {}
    for name, entry in index.items():
        sources = str(entry.get("sources") or entry.get("source") or "")
        for kind in ("primitive", "block", "component"):
            if kind in sources:
                kinds.setdefault(name, []).append(kind)
    return {name: "+".join(sorted(set(kinds[name]))) for name in kinds}


def score_all(records, gold, shelf, vectors=None, kinds=None):
    """Score every run. Returns rows carrying the cell and the stratum."""
    kinds = kinds or {}
    rows = []
    for record in records:
        brief = record["brief"]
        if brief not in gold:
            # A result whose gold was pruned away cannot be scored, and
            # silently averaging over it would report a corpus we never ran.
            continue
        picks = [p["move"] for p in record.get("picks") or []]
        result = gate2.score(
            brief,
            picks,
            gold,
            shelf,
            vectors=vectors,
            pick_vectors=record.get("pick_vectors"),
        )
        best = gold[brief]["best"]
        shown = record.get("shown") or []
        result["cell"] = cell_key(record)
        result["stratum"] = kinds.get(best[0], "unknown") if best else "unknown"
        # The cluster key for every interval. It comes from gold rather than
        # from the brief id because briefs written for the same target move are
        # correlated, and a brief with no gold move clusters only with itself.
        result["move"] = best[0] if best else brief
        result["empty"] = not picks
        # Whether the right move was even in the list the run could see. Without
        # this a low fit reads as "the model chose badly" when the real story is
        # "retrieval never showed it the answer", and those two call for
        # opposite fixes. Cell a shows nothing and cell b shows everything, so
        # for them the answer is structural rather than measured.
        result["gold_shown"] = bool(set(best) & set(shown)) if shown else False
        rows.append(result)
    return rows


def _mean(values):
    return round(statistics.fmean(values), 4) if values else 0.0


# Every reported mean and how to read it off a scored row. Keeping the list in
# one place is what stops a metric from picking up an interval while its
# neighbour keeps shipping a bare number.
METRICS = (
    ("mountable", lambda r: r["mountable"]),
    ("fit", lambda r: r["fit"]),
    ("pass_rate", lambda r: 1.0 if r["passed"] else 0.0),
    ("empty_rate", lambda r: 1.0 if r["empty"] else 0.0),
    ("recall", lambda r: 1.0 if r["gold_shown"] else 0.0),
)


def aggregate(rows, key="cell"):
    """Collapse rows into per group means. Mountable and fit stay separate.

    Each mean keeps its own top level key and gains a clustered 95 percent
    interval under "ci", rather than being replaced by an interval object, so
    nothing that already reads these numbers changes meaning underneath it.
    """
    groups = collections.defaultdict(list)
    for row in rows:
        groups[row[key]].append(row)
    out = {}
    for name, group in sorted(groups.items()):
        # Fit on the runs where the answer was actually on offer. The gap
        # between this and fit is the share of the loss retrieval owns.
        findable = [r for r in group if r["gold_shown"]]
        moves = [r["move"] for r in group]
        summary = {"n": len(group)}
        intervals = {}
        for metric, read in METRICS:
            values = [read(r) for r in group]
            summary[metric] = _mean(values)
            intervals[metric] = stats.clustered_mean(values, moves)
        summary["fit_when_shown"] = _mean([r["fit"] for r in findable])
        intervals["fit_when_shown"] = stats.clustered_mean(
            [r["fit"] for r in findable], [r["move"] for r in findable]
        )
        summary["ci"] = intervals
        out[name] = summary
    return out


def paired_against_full_shelf(rows, baseline="b"):
    """Compare each cell with the full shelf on the same briefs.

    fit_when_shown is conditioned on retrieval having succeeded, and the briefs
    where a short list finds the answer are the easy ones. Reading that column
    across cells therefore compares different brief sets and can invent an
    effect that is only difficulty. This restricts the full shelf to exactly the
    briefs each cell could see the answer in, which is the only comparison that
    holds difficulty fixed.

    The difference carries a clustered interval, because a paired margin without
    one cannot be read against the pre-registered decision rule.
    """
    by_cell = collections.defaultdict(dict)
    for row in rows:
        by_cell[row["cell"]][row["brief"]] = row
    base = by_cell.get(baseline, {})
    out = {}
    for cell, briefs in sorted(by_cell.items()):
        if cell == baseline:
            continue
        shared = [b for b, r in briefs.items() if r["gold_shown"] and b in base]
        if not shared:
            continue
        out[cell] = {
            "n": len(shared),
            "cell_fit": _mean([briefs[b]["fit"] for b in shared]),
            "full_shelf_fit": _mean([base[b]["fit"] for b in shared]),
            "difference": stats.clustered_difference(
                [briefs[b]["fit"] for b in shared],
                [base[b]["fit"] for b in shared],
                [briefs[b]["move"] for b in shared],
            ),
        }
    return out


def cost_per_cell(records, cells, model=None):
    """Tokens and dollars per run, per cell, with fit per dollar.

    A cell that wins on fit while shipping forty times the context is not
    obviously the right choice, so quality and cost belong in the same table
    rather than in two sections a reader has to hold in their head.
    """
    model = model or run2.MODEL
    totals = collections.defaultdict(
        lambda: {"prompt": 0, "cached": 0, "completion": 0, "usd": 0.0, "runs": 0}
    )
    for record in records:
        bucket = totals[cell_key(record)]
        bucket["runs"] += 1
        for attempt in record.get("attempts") or []:
            usage = attempt.get("usage") or {}
            bucket["prompt"] += usage.get("prompt_tokens", 0)
            bucket["cached"] += usage.get("cached_tokens", 0)
            bucket["completion"] += usage.get("completion_tokens", 0)
            bucket["usd"] += run2.usage_cost(usage, model)

    out = {}
    for name, t in sorted(totals.items()):
        runs = t["runs"] or 1
        usd_per_run = t["usd"] / runs
        fit = cells.get(name, {}).get("fit", 0.0)
        out[name] = {
            "runs": t["runs"],
            "input_per_run": round(t["prompt"] / runs),
            "cached_per_run": round(t["cached"] / runs),
            "output_per_run": round(t["completion"] / runs),
            "usd_per_run": round(usd_per_run, 6),
            "usd_per_1000_runs": round(usd_per_run * 1000, 2),
            # The efficiency number: quality bought per dollar of context.
            "fit_per_dollar": round(fit / usd_per_run, 1) if usd_per_run else 0.0,
        }
    return out


def spend(records):
    """Recompute cost from the recorded usage rather than trusting a total."""
    prompt = cached = completion = 0
    for record in records:
        for attempt in record.get("attempts") or []:
            usage = attempt.get("usage") or {}
            prompt += usage.get("prompt_tokens", 0)
            cached += usage.get("cached_tokens", 0)
            completion += usage.get("completion_tokens", 0)
    return {
        "prompt_tokens": prompt,
        "cached_tokens": cached,
        "completion_tokens": completion,
        "cached_fraction": round(cached / prompt, 4) if prompt else 0.0,
    }


def build_summary(records, rows):
    by_cell = aggregate(rows, "cell")
    return {
        "cost": cost_per_cell(records, by_cell),
        "runs_scored": len(rows),
        "runs_recorded": len(records),
        "briefs": len({r["brief"] for r in rows}),
        "cells": by_cell,
        "strata": aggregate(rows, "stratum"),
        "paired": paired_against_full_shelf(rows),
        "usage": spend(records),
        "best_fit_cell": max(by_cell, key=lambda c: by_cell[c]["fit"]) if by_cell else None,
    }


def _table(caption, columns, body_rows):
    head = "".join(f"<th>{html.escape(c)}</th>" for c in columns)
    body = "".join(
        "<tr>" + "".join(f"<td>{html.escape(str(c))}</td>" for c in row) + "</tr>"
        for row in body_rows
    )
    return (
        f"<table><caption>{html.escape(caption)}</caption>"
        f"<thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"
    )


def render(summary, rows):
    failures = [r for r in rows if not r["passed"]][:FAILURE_SAMPLE]
    cells = [
        [
            name,
            s["n"],
            s["mountable"],
            s["fit"],
            s["pass_rate"],
            s["empty_rate"],
            s["recall"],
            s["fit_when_shown"],
            stats.format_interval(s["ci"]["fit"]),
            s["ci"]["recall"]["n_eff"],
        ]
        for name, s in summary["cells"].items()
    ]
    strata_rows = [
        [name, s["n"], s["mountable"], s["fit"], s["pass_rate"]]
        for name, s in summary["strata"].items()
    ]
    failure_rows = [[r["brief"], r["cell"], r["fit"], r["reason"]] for r in failures]
    cost_rows = [
        [
            name,
            c["input_per_run"],
            c["cached_per_run"],
            c["output_per_run"],
            summary["cells"].get(name, {}).get("fit", 0.0),
            c["usd_per_1000_runs"],
            c["fit_per_dollar"],
        ]
        for name, c in summary["cost"].items()
    ]
    paired_rows = [
        [name, p["n"], p["cell_fit"], p["full_shelf_fit"],
         p["difference"]["mean"], stats.format_interval(p["difference"]),
         p["difference"]["n_eff"]]
        for name, p in summary["paired"].items()
    ]
    usage = summary["usage"]
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Catalog retrieval, round two</title>
<style>
 body {{ background:#0a0b0d; color:#ece7de; font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;
        margin:0; padding:3rem clamp(1rem,5vw,4rem); }}
 h1 {{ font-size:1.6rem; font-weight:400; margin:0 0 0.4rem; }}
 p.sub {{ color:#8b8578; margin:0 0 2.5rem; }}
 table {{ border-collapse:collapse; width:100%; max-width:70rem; margin:0 0 2.5rem; }}
 caption {{ text-align:left; color:#d8ff3e; font-size:0.78rem; letter-spacing:0.14em;
            text-transform:uppercase; padding-bottom:0.6rem; }}
 th,td {{ text-align:left; padding:0.5rem 0.9rem 0.5rem 0; border-bottom:1px solid #23272f; }}
 th {{ color:#8b8578; font-weight:400; font-size:0.8rem; }}
</style></head><body>
<h1>Catalog retrieval, round two</h1>
<p class="sub">{summary["runs_scored"]} runs scored over {summary["briefs"]} briefs.
Cached input {usage["cached_fraction"]:.1%} of {usage["prompt_tokens"]} prompt tokens.
Mountable and fit are separate numbers and are never combined.</p>
{_table(
    "Per cell",
    ["cell", "n", "mountable", "fit", "pass rate", "empty rate",
     "gold shown", "fit when shown", "fit 95% ci", "n eff"],
    cells,
)}
<p class="sub">Gold shown is how often the right move was in the list the run could see, so
the gap between fit and fit when shown is the share of the loss retrieval owns rather than
the model. It reads 0 for the no catalog cell, which shows nothing.</p>
<p class="sub">Every interval is clustered by target move, not by brief, because briefs written
for the same move are correlated and counting them as independent reports a narrower interval
than the corpus supports. N eff is the effective sample that clustering leaves on the gold shown
column, and it is below n wherever that correlation is real. A cell that ran on a single move
reads unbounded rather than a misleadingly tight number.</p>
{_table(
    "What each cell costs",
    ["cell", "input tokens", "of which cached", "output tokens", "fit",
     "USD per 1000 runs", "fit per dollar"],
    cost_rows,
)}
<p class="sub">Input tokens are per run and include every retry. Fit per dollar is the
efficiency read: the cell with the best fit and the cell with the best fit per dollar are
not the same cell, and which one you want depends on how often you call it.</p>
{_table(
    "Same briefs, short list against full shelf",
    ["cell", "n", "cell fit", "full shelf fit", "difference",
     "difference 95% ci", "n eff"],
    paired_rows,
)}
<p class="sub">Fit when shown compares different brief sets, because the briefs a short list
finds are the easy ones. This table holds the briefs fixed and is the only fair read of
whether a short list beats the whole shelf. The difference is paired per brief and its interval
is clustered by target move, so a difference whose interval spans zero has not separated.</p>
{_table("Per stratum", ["stratum", "n", "mountable", "fit", "pass rate"], strata_rows)}
{_table(f"Failures, first {FAILURE_SAMPLE}", ["brief", "cell", "fit", "why"], failure_rows)}
</body></html>
"""


def main():
    records = load_results()
    gold = gate2.load_gold()
    shelf = harness2.load_shelf()
    vectors = (
        json.load(open(harness2.VECTORS, encoding="utf-8"))
        if os.path.exists(harness2.VECTORS)
        else None
    )
    rows = score_all(records, gold, shelf, vectors=vectors, kinds=strata())
    summary = build_summary(records, rows)
    with open(SUMMARY, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2, sort_keys=True)
    with open(REPORT, "w", encoding="utf-8") as fh:
        fh.write(render(summary, rows))
    print(f"scored {len(rows)} of {len(records)} recorded runs")
    for name, cell in summary["cells"].items():
        # n_eff on the same line as n so the gap between them is unavoidable.
        print(
            f"{name:<6} n={cell['n']:<5} n_eff={cell['ci']['recall']['n_eff']:<7} "
            f"mountable={cell['mountable']:<8} fit={cell['fit']:<8} "
            f"fit_ci={stats.format_interval(cell['ci']['fit'])} "
            f"pass={cell['pass_rate']}"
        )
    print(f"wrote {REPORT} and {SUMMARY}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
