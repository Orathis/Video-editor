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

Round 4 confirms at several list lengths and on two models, so what this takes
is a grid of cells rather than a pair. A cell is (arm, k, model) and every
comparison in the grid is still paired brief by brief. The property the round
rests on is that exactly one of those three moves between any two compared
cells, and a pairing that would move two is refused here rather than computed
and explained away in the write-up.
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
import provider  # noqa: E402
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


# The three things a cell is, in the order its label spells them, and how each
# one reads in a sentence. Named rather than inlined because the entire round 4
# comparison rests on exactly one of them moving at a time.
VARIABLES = (
    ("arm", "the retriever"),
    ("k", "the list length"),
    ("model", "the model"),
)


def parse_cell(label):
    """Split a cell label back into the three variables it encodes.

    The inverse of build_report2.cell_key, which is what every scored row
    carries, so the two must be read together. Anything the label does not carry
    reads None: round 2's cells record no model, and the full shelf and no
    catalog arms take no k.
    """
    arm, _, model = label.partition("/")
    condition, marker, k = arm.partition("@")
    return {
        "arm": condition,
        # Kept as text when it is not a number rather than being coerced or
        # dropped. A malformed k that silently became None would make two
        # different list lengths compare as the same cell.
        "k": (int(k) if k.isdigit() else k) if marker else None,
        "model": model or None,
    }


def changed_variables(cell, baseline):
    """Which of arm, k and model differ between two cell labels."""
    left = parse_cell(cell)
    right = parse_cell(baseline)
    return tuple(name for name, _ in VARIABLES if left[name] != right[name])


def confounds(cell, baseline):
    """What else moved when the model moved, named rather than assumed absent.

    Changing the model is one variable only if everything else about how the two
    cells were sampled is the same, and across these two families it is not.
    gpt-5.6-luna rejects temperature 0, which every round 2 and round 3 cell
    used, and samples only at its default of 1. So a model B cell differs from
    its model A twin in the model AND in the sampling temperature, and the round
    4 rule's one-variable property does not hold across the two families.

    That is a fact about the provider and no code here can remove it. What the
    code can do is refuse to let it go unsaid: this rides along in the pairing,
    in the printed comparison and in the rendered table, so a cross-model
    difference is read as "differs, and here is the confound" rather than as a
    clean reproduction.

    The temperature comes from provider rather than from a second copy of the
    table here, so a family whose knobs change moves this answer with it.
    """
    left = parse_cell(cell)["model"]
    right = parse_cell(baseline)["model"]
    if left == right:
        return []
    if left is None or right is None:
        # Silence here would read as "nothing else changed", which is a claim
        # about a cell whose sampling settings were never recorded.
        return [
            "one of these cells records no model, so what else differed in how "
            "the two were sampled cannot be established from the checkpoint and "
            "is not being claimed to be nothing"
        ]
    hot = provider.sampling_temperature(left)
    cold = provider.sampling_temperature(right)
    if hot == cold:
        return []
    return [
        # The cell that cannot sample at 0 is named from the temperatures rather
        # than assumed to be the leader. A pairing can be written either way
        # round, and a sentence that always blamed the first cell would be false
        # for half of them.
        "sampling temperature: {0} runs at {1} and {2} at {3}. Rounds 2 and 3 "
        "ran every paid cell at temperature 0 and the family serving {4} will "
        "not sample there, so these two cells differ in two variables, the "
        "model and the temperature. This is a difference with a named confound "
        "and not a clean reproduction".format(
            cell, hot, baseline, cold, cell if hot != 0 else baseline
        )
    ]


def paired(rows, cell, baseline):
    """Each rate as a paired difference between two cells on the same briefs.

    Two column means over two cells is not the comparison the rule is written
    against, and here it would be actively misleading: the briefs a short list
    answers at all are the easy ones, so an unpaired gap between cells carries
    brief difficulty inside it. Differencing brief by brief holds difficulty
    fixed, and the briefs only one cell ran are dropped rather than averaged
    over, because a difference over a subset of the corpus is not a difference.

    Exactly one of arm, k and model may move. Two cells that differ in two of
    them produce a number no one can read: an arm effect and a list length
    effect land on the same difference and nothing in the output says which was
    which. That is refused rather than computed with a caveat, because a caveat
    is the form this failure takes when it ships.

    A brief only one cell ran is dropped from this pairing and from no other,
    which is why the shared set is recomputed per pairing rather than once for
    the grid.
    """
    changed = changed_variables(cell, baseline)
    if len(changed) != 1:
        prose = {name: reads for name, reads in VARIABLES}
        raise SystemExit(
            "refusing to pair {0} against {1}: {2} differ ({3}), and the rule "
            "this round is built on is that exactly one of arm, k and model "
            "moves between two compared cells. A difference over two variables "
            "cannot be attributed to either of them.".format(
                cell,
                baseline,
                "no variables" if not changed else "{0} variables".format(len(changed)),
                ", ".join(prose[name] for name in changed) or "the cells are the same cell",
            )
        )
    by_brief = {}
    for row in rows:
        by_brief.setdefault(row["brief"], {})[row["cell"]] = row
    shared = sorted(
        brief for brief, cells in by_brief.items() if cell in cells and baseline in cells
    )
    clusters = [by_brief[brief][cell]["move"] for brief in shared]
    out = {
        "cell": cell,
        "against": baseline,
        "n": len(shared),
        "changed": list(changed),
        "confounds": confounds(cell, baseline),
    }
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
        action="append",
        default=[],
        help=(
            "two cells as LEADER:BASELINE, differenced brief by brief. Repeat "
            "for a grid: round 4 confirms at several list lengths and on two "
            "models, so one flag would only ever have confirmed one of them. "
            "Exactly one of arm, k and model may differ within a pairing."
        ),
    )
    args = parser.parse_args(argv)

    records = run2.load_checkpoint(args.checkpoint)
    gold = gate2.load_gold(args.gold)
    shelf = harness2.load_shelf()
    cells = confirm(records, gold, shelf)
    differences = []
    if args.paired:
        rows = build_report2.score_all(records, gold, shelf)
        for spec in args.paired:
            cell, baseline = spec.split(":", 1)
            differences.append(paired(rows, cell, baseline))

    for cell, summary in cells.items():
        print("cell {0}: n={1} over {2} moves".format(
            cell, summary["n"], summary["clusters"]
        ))
        for name, _ in METRICS:
            interval = summary[name]
            print("  {0:<17} {1:.4f}  95% {2}".format(
                name, interval["mean"], stats.format_interval(interval)
            ))
    prose = {name: reads for name, reads in VARIABLES}
    for difference in differences:
        print("paired {0} against {1}, n={2}, {3} differs".format(
            difference["cell"], difference["against"], difference["n"],
            ", ".join(prose[name] for name in difference["changed"]),
        ))
        for name, _ in METRICS:
            interval = difference[name]
            print("  {0:<17} {1:+.4f}  95% {2}".format(
                name, interval["mean"], stats.format_interval(interval)
            ))
        # After the numbers, not before them, so it is read against the
        # difference it qualifies rather than skipped as a preamble.
        for confound in difference["confounds"]:
            print("  CONFOUND: {0}".format(confound))
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(
            # A list, because a grid of pairings is what round 4 confirms with.
            # Round 3 published a single object under this key and its report
            # still regenerates byte for byte, because the report reads one
            # object as a grid of one rather than the file being rewritten.
            {"cells": cells, "paired": differences},
            fh, indent=2, sort_keys=True, allow_nan=False,
        )
    print("wrote {0}".format(args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
