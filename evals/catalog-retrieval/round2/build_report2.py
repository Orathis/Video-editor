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
        result["cell"] = cell_key(record)
        result["stratum"] = kinds.get(best[0], "unknown") if best else "unknown"
        result["empty"] = not picks
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
        out[name] = {
            "n": len(group),
            "mountable": _mean([r["mountable"] for r in group]),
            "fit": _mean([r["fit"] for r in group]),
            "pass_rate": _mean([1.0 if r["passed"] else 0.0 for r in group]),
            "empty_rate": _mean([1.0 if r["empty"] else 0.0 for r in group]),
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
        [name, s["n"], s["mountable"], s["fit"], s["pass_rate"], s["empty_rate"]]
        for name, s in summary["cells"].items()
    ]
    strata_rows = [
        [name, s["n"], s["mountable"], s["fit"], s["pass_rate"]]
        for name, s in summary["strata"].items()
    ]
    failure_rows = [[r["brief"], r["cell"], r["fit"], r["reason"]] for r in failures]
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
{_table("Per cell", ["cell", "n", "mountable", "fit", "pass rate", "empty rate"], cells)}
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
