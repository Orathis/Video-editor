#!/usr/bin/env python3
"""The paid confirmation: the two things offline recall cannot see.

The sweep ranks arms on recall for nothing, because the retriever decides
whether the answer is on the list before a token is bought. Two quantities
survive that argument, and both need the model to actually run:

  refusal rate            the share of runs that named nothing the shelf
                          carries, which recall scores as a miss it did not
                          cause. A list that contains the answer and is still
                          refused is a different failure from a list that never
                          held it.
  known-wrong-pick rate   the share of runs that named a move the gold set
                          marks as wrong for that brief. This is what drives
                          the flat 0.5 fit penalty in gate2, and it is invisible
                          to recall: a run can have the answer on its list, pick
                          it, and still pick a known-wrong move beside it.

Scoring is gate2's, unchanged, so no model judges a model here either. Both
quantities are read against the whole acceptable set: fit through gate2's own
f1 over that set, and the known-wrong-pick rate through gate2's `bad`, which
cannot overlap the acceptable set because gate2.acceptable refuses a record
where it does. That refusal is what keeps this metric from ever counting an
acceptable move as wrong.

Every rate carries an interval clustered by the acceptable set, for the same
reason the sweep does: briefs answered by the same move, or by the same pair of
near twins, are correlated.
"""

import argparse
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import recall  # noqa: E402
import stats  # noqa: E402

import build_report2  # noqa: E402  recall puts the round two directory on the path
import gate2  # noqa: E402
import harness2  # noqa: E402
import run2  # noqa: E402

CHECKPOINT = os.path.join(harness2.CORPUS_ROOT, "checkpoints", "results.jsonl")

# What the confirmation reports, and how to read each one off a scored row.
# Kept beside each other because these two are the whole point of the stage:
# reporting one without the other would let an arm that refuses less look
# better than an arm that is wrong less, or the reverse.
METRICS = (
    # gate2 returns fit 0.0 with this reason when nothing the run named
    # corresponds to a shelf move, which covers both an empty answer and an
    # answer made of moves the shelf does not carry.
    ("refusal", lambda r: 1.0 if r.get("reason") == "no pick resolved to a shelf move" else 0.0),
    ("known_wrong_pick", lambda r: 1.0 if "picked known-wrong" in r.get("reason", "") else 0.0),
    # Carried so the confirmation can be read against the round 2 board rather
    # than as two rates floating free. They are never collapsed into one score.
    ("mountable", lambda r: r["mountable"]),
    ("fit", lambda r: r["fit"]),
    ("pass_rate", lambda r: 1.0 if r["passed"] else 0.0),
)


def confirm(records, gold, shelf, vectors=None):
    """Per cell rates, each clustered by the brief's acceptable set.

    The key is `row["move"]`, which build_report2 takes from gate2.cluster_key,
    so two briefs answered by the same near-twin pair count as one cluster here
    and in the sweep alike.
    """
    rows = build_report2.score_all(records, gold, shelf, vectors=vectors)
    groups = collections.defaultdict(list)
    for row in rows:
        groups[row["cell"]].append(row)
    out = {}
    for cell, group in sorted(groups.items()):
        moves = [row["move"] for row in group]
        summary = {"n": len(group), "clusters": len(set(moves))}
        for name, read in METRICS:
            summary[name] = stats.clustered_mean([read(row) for row in group], moves)
        out[cell] = summary
    return out


def paired(rows, cell, baseline):
    """Each rate as a paired difference between two cells on the same briefs.

    Two column means over two cells is not the comparison the rule is written
    against, and here it would be actively misleading: the briefs a short list
    answers at all are the easy ones, so an unpaired gap between cells carries
    brief difficulty inside it. Differencing brief by brief holds difficulty
    fixed, and the briefs only one cell ran are dropped rather than averaged
    over, because a difference over a subset of the corpus is not a difference.
    """
    by_brief = {}
    for row in rows:
        by_brief.setdefault(row["brief"], {})[row["cell"]] = row
    shared = sorted(
        brief for brief, cells in by_brief.items() if cell in cells and baseline in cells
    )
    clusters = [by_brief[brief][cell]["move"] for brief in shared]
    out = {"cell": cell, "against": baseline, "n": len(shared)}
    for name, read in METRICS:
        out[name] = stats.clustered_difference(
            [read(by_brief[brief][cell]) for brief in shared],
            [read(by_brief[brief][baseline]) for brief in shared],
            clusters,
        )
    return out


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", default=CHECKPOINT)
    parser.add_argument("--gold", default=recall.GOLD)
    parser.add_argument("--out", default=os.path.join(HERE, "confirm3.json"))
    parser.add_argument(
        "--paired",
        help="two cells as LEADER:BASELINE, differenced brief by brief",
    )
    args = parser.parse_args(argv)

    records = run2.load_checkpoint(args.checkpoint)
    gold = gate2.load_gold(args.gold)
    shelf = harness2.load_shelf()
    cells = confirm(records, gold, shelf)
    difference = None
    if args.paired:
        cell, baseline = args.paired.split(":", 1)
        difference = paired(
            build_report2.score_all(records, gold, shelf), cell, baseline
        )

    for cell, summary in cells.items():
        print("cell {0}: n={1} over {2} moves".format(
            cell, summary["n"], summary["clusters"]
        ))
        for name, _ in METRICS:
            interval = summary[name]
            print("  {0:<17} {1:.4f}  95% {2}".format(
                name, interval["mean"], stats.format_interval(interval)
            ))
    if difference:
        print("paired {0} against {1}, n={2}".format(
            difference["cell"], difference["against"], difference["n"]
        ))
        for name, _ in METRICS:
            interval = difference[name]
            print("  {0:<17} {1:+.4f}  95% {2}".format(
                name, interval["mean"], stats.format_interval(interval)
            ))
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(
            {"cells": cells, "paired": difference},
            fh, indent=2, sort_keys=True, allow_nan=False,
        )
    print("wrote {0}".format(args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
