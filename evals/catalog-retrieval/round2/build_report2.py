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

import gate2  # noqa: E402
import harness2  # noqa: E402

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


def aggregate(rows, key="cell"):
    """Collapse rows into per group means. Mountable and fit stay separate."""
    groups = collections.defaultdict(list)
    for row in rows:
        groups[row[key]].append(row)
    out = {}
    for name, group in sorted(groups.items()):
        findable = [r for r in group if r["gold_shown"]]
        out[name] = {
            "n": len(group),
            "mountable": _mean([r["mountable"] for r in group]),
            "fit": _mean([r["fit"] for r in group]),
            "pass_rate": _mean([1.0 if r["passed"] else 0.0 for r in group]),
            "empty_rate": _mean([1.0 if r["empty"] else 0.0 for r in group]),
            "recall": _mean([1.0 if r["gold_shown"] else 0.0 for r in group]),
            # Fit on the runs where the answer was actually on offer. The gap
            # between this and fit is the share of the loss retrieval owns.
            "fit_when_shown": _mean([r["fit"] for r in findable]),
        }
    return out


def paired_against_full_shelf(rows, baseline="b"):
    """Compare each cell with the full shelf on the same briefs.

    fit_when_shown is conditioned on retrieval having succeeded, and the briefs
    where a short list finds the answer are the easy ones. Reading that column
    across cells therefore compares different brief sets and can invent an
    effect that is only difficulty. This restricts the full shelf to exactly the
    briefs each cell could see the answer in, which is the only comparison that
    holds difficulty fixed.
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
        ]
        for name, s in summary["cells"].items()
    ]
    strata_rows = [
        [name, s["n"], s["mountable"], s["fit"], s["pass_rate"]]
        for name, s in summary["strata"].items()
    ]
    failure_rows = [[r["brief"], r["cell"], r["fit"], r["reason"]] for r in failures]
    paired_rows = [
        [name, p["n"], p["cell_fit"], p["full_shelf_fit"],
         round(p["cell_fit"] - p["full_shelf_fit"], 4)]
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
     "gold shown", "fit when shown"],
    cells,
)}
<p class="sub">Gold shown is how often the right move was in the list the run could see, so
the gap between fit and fit when shown is the share of the loss retrieval owns rather than
the model. It reads 0 for the no catalog cell, which shows nothing.</p>
{_table(
    "Same briefs, short list against full shelf",
    ["cell", "n", "cell fit", "full shelf fit", "difference"],
    paired_rows,
)}
<p class="sub">Fit when shown compares different brief sets, because the briefs a short list
finds are the easy ones. This table holds the briefs fixed and is the only fair read of
whether a short list beats the whole shelf.</p>
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
    for name, stats in summary["cells"].items():
        print(
            f"{name:<6} n={stats['n']:<5} mountable={stats['mountable']:<8} "
            f"fit={stats['fit']:<8} pass={stats['pass_rate']}"
        )
    print(f"wrote {REPORT} and {SUMMARY}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
