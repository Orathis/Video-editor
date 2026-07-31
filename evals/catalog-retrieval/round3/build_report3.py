#!/usr/bin/env python3
"""Render the round three report from the offline sweep.

Round 3's finding is that the arm choice reduces to recall, which the retriever
decides before a token is spent. So this report is built from data structures the
sweep already produced: no model call, no network, no spend.

Three things are deliberately not reinvented. The intervals come from stats.py,
the ranking, knee and rule outcome come from sweep.py, and the report shape comes
from round two's build_report2.py, which already learned not to stack one card per
run. This file only aggregates and renders.

Every table carries a clustered interval, because a recall number without one
cannot be read against the pre-registered rule. And the report names which of the
three stopping conditions fired, because "the arms separated", "the waves ran out"
and "the ceiling was reached" are three different verdicts.
"""

import argparse
import html
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import recall  # noqa: E402
import stats  # noqa: E402
import sweep  # noqa: E402

import harness2  # noqa: E402  recall puts the round two directory on the path

REPORT = os.path.join(HERE, "report3.html")
SUMMARY = os.path.join(HERE, "summary3.json")

# The three ways the round can end, taken from the stopping rule in
# DECISION-RULE.md, plus the honest fourth state for a round still in progress.
# They are kept apart because reporting them as one verdict is the failure this
# report exists to prevent: an arm that won is not an arm that merely outlasted
# the budget.
STOP_REASONS = {
    "separated": (
        "the leader cleared the runner-up under step 2, so the round stopped on a "
        "measured separation"
    ),
    "waves-exhausted": (
        "every wave the rule allows completed without a separation, so the round "
        "stopped because it ran out of corpus, not because an arm won"
    ),
    "ceiling-reached": (
        "the spend ceiling was reached before the arms separated, so the round "
        "stopped on budget and the ranking is whatever the data bought"
    ),
    "still-running": (
        "none of the three stopping conditions has fired yet, so this is an "
        "interim read and not a verdict"
    ),
}


def stop_reason(outcome, waves_run, rule, ceiling_reached=False):
    """Which stopping condition fired, in the order the rule lists them.

    Separation is checked first because the rule evaluates it after each wave, so
    a round that separates on its final wave stopped on the separation and not on
    the wave count.
    """
    if outcome.get("branch") == "separated":
        return "separated"
    if ceiling_reached:
        return "ceiling-reached"
    if waves_run >= rule["max_waves"]:
        return "waves-exhausted"
    return "still-running"


def interval(flags, clusters):
    """The clustered interval for one set of per brief hit flags.

    Sorting the ids keeps the interval reproducible when the flags arrive from a
    dict, and the cluster key is the target move, never the brief.
    """
    ids = sorted(flags)
    return stats.clustered_mean([flags[i] for i in ids], [clusters[i] for i in ids])


def curve_rows(swept, clusters):
    """One row per arm per k, each with its own interval.

    Round 2 printed the curve as a wide grid, which has no room for error bars and
    so quietly ships bare means. Long form costs more rows and is the only shape
    where every recall number can carry the interval that makes it readable.
    """
    rows = []
    for label in sorted(swept):
        for k in sorted(swept[label]["flags"]):
            rows.append(
                {
                    "arm": label,
                    "k": k,
                    "interval": interval(swept[label]["flags"][k], clusters),
                }
            )
    return rows


def margin_rows(rows, clusters):
    """Every ranked arm against the leader, paired brief by brief.

    Subtracting two column means would compare different brief sets. The rule is
    written against the paired quantity, so the report shows the paired quantity.
    """
    if not rows:
        return []
    leader = rows[0]
    return [
        {
            "arm": row["arm"],
            "against": leader["arm"],
            "difference": sweep.paired(row, leader, clusters),
        }
        for row in rows[1:]
    ]


def knee_rows(swept, clusters, tokens, price):
    """Where a longer list stops paying, per arm, with the recall it stops at.

    Unpriced when round two's cost rows are absent: guessing the exchange rate
    would turn a measured threshold into a taste call.
    """
    if not tokens or not price:
        return []
    slope, intercept = tokens
    rows = []
    for label in sorted(swept):
        arm = swept[label]
        at, exhausted = sweep.knee(arm["curve"], slope, price)
        if at is None:
            continue
        rows.append(
            {
                "arm": label,
                "k": at,
                "exhausted": exhausted,
                "tokens_per_run": round(slope * at + intercept),
                "interval": interval(arm["flags"][at], clusters),
            }
        )
    return rows


def _ranked(row):
    """A ranking row without its per brief flags, which are bulk, not evidence."""
    return {key: value for key, value in row.items() if key != "flags"}


def build_summary(
    swept,
    unavailable,
    clusters,
    rule,
    shelf_size,
    waves_run=0,
    ceiling_reached=False,
    tokens=None,
    price=None,
):
    """Everything the report renders, computed once."""
    rows = sweep.rank(swept, clusters, "decision")
    exploratory = sweep.rank(swept, clusters, "exploratory")
    outcome = sweep.decide(rows, rule, clusters, exploratory)
    reason = stop_reason(outcome, waves_run, rule, ceiling_reached)
    ks = sorted({k for arm in swept.values() for k in arm["curve"]})
    return {
        "shelf_size": shelf_size,
        "briefs": len(clusters),
        "clusters": len(set(clusters.values())),
        "ks": ks,
        "waves_run": waves_run,
        "max_waves": rule["max_waves"],
        "ceiling_reached": ceiling_reached,
        "stop_reason": reason,
        "stop_reason_says": STOP_REASONS[reason],
        "ranking": [_ranked(row) for row in rows],
        "exploratory": [_ranked(row) for row in exploratory],
        "curve": curve_rows(swept, clusters),
        "margins": margin_rows(rows, clusters),
        "knees": knee_rows(swept, clusters, tokens, price),
        "unavailable": dict(unavailable),
        "converged": sweep.converged(swept, ks) if ks else False,
        "outcome": {
            "branch": outcome["branch"],
            "ship": outcome["ship"],
            "reason": outcome["reason"],
            "difference": outcome.get("difference"),
            "followups": [
                {key: value for key, value in followup.items()}
                for followup in outcome["followups"]
            ],
        },
    }


def jsonable(value):
    """Non-finite bounds become null, because JSON has no infinity.

    A single cluster genuinely bounds nothing, and stats.py says so with an
    infinite half width. Writing that literally produces a file only Python can
    read back, which is not an auditable artifact. The clusters field on the same
    interval already carries why the bound is missing.
    """
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {key: jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    return value


def _table(caption, columns, body_rows):
    head = "".join("<th>{0}</th>".format(html.escape(c)) for c in columns)
    body = "".join(
        "<tr>" + "".join("<td>{0}</td>".format(html.escape(str(c))) for c in row) + "</tr>"
        for row in body_rows
    )
    return (
        '<table><caption>{0}</caption>'
        "<thead><tr>{1}</tr></thead><tbody>{2}</tbody></table>"
    ).format(html.escape(caption), head, body)


def _paragraph(text):
    return '<p class="sub">{0}</p>'.format(html.escape(text))


def render(summary):
    """The report. Every table ships an interval column, without exception."""
    ranking = [
        [
            place,
            row["arm"],
            row["family"],
            row["k"],
            row["interval"]["n"],
            row["interval"]["mean"],
            stats.format_interval(row["interval"]),
            row["interval"]["clusters"],
            row["interval"]["icc"],
            row["interval"]["n_eff"],
        ]
        for place, row in enumerate(summary["ranking"], start=1)
    ]
    curve = [
        [
            row["arm"],
            row["k"],
            row["interval"]["mean"],
            stats.format_interval(row["interval"]),
            row["interval"]["clusters"],
            row["interval"]["n_eff"],
        ]
        for row in summary["curve"]
    ]
    margins = [
        [
            row["arm"],
            row["against"],
            row["difference"]["n"],
            row["difference"]["mean"],
            stats.format_interval(row["difference"]),
            row["difference"]["clusters"],
            row["difference"]["n_eff"],
        ]
        for row in summary["margins"]
    ]
    knees = [
        [
            row["arm"],
            row["k"],
            "no knee within the sweep" if row["exhausted"] else "knee",
            row["tokens_per_run"],
            row["interval"]["mean"],
            stats.format_interval(row["interval"]),
            row["interval"]["n_eff"],
        ]
        for row in summary["knees"]
    ]
    exploratory = [
        [
            row["arm"],
            row["k"],
            row["interval"]["mean"],
            stats.format_interval(row["interval"]),
            row["interval"]["clusters"],
            row["interval"]["n_eff"],
        ]
        for row in summary["exploratory"]
    ]

    sections = [
        _table(
            "Ranking, decision tier, each arm at its own best k",
            ["place", "arm", "family", "k", "n", "recall", "recall 95% ci",
             "clusters", "icc", "n eff"],
            ranking,
        ),
        _paragraph(
            "Every interval is clustered by target move rather than by brief, because "
            "briefs written for the same move are correlated and counting them as "
            "independent reports a narrower interval than the corpus supports. N eff is "
            "the effective sample clustering leaves. An arm that ran on a single move "
            "reads unbounded rather than a misleadingly tight number."
        ),
        _table(
            "Paired against the leader, brief by brief",
            ["arm", "against", "n", "difference", "difference 95% ci",
             "clusters", "n eff"],
            margins,
        ),
        _paragraph(
            "The pairing holds brief difficulty fixed, which a difference of two column "
            "means does not. A difference whose interval contains zero has not "
            "separated, and step 3 of the rule then decides on operations rather than "
            "on the larger number."
        ),
        _table(
            "Recall curve, every arm at every k",
            ["arm", "k", "recall", "recall 95% ci", "clusters", "n eff"],
            curve,
        ),
    ]
    if knees:
        sections.append(
            _table(
                "Knee, where a longer list stops paying for its tokens",
                ["arm", "k", "kind", "input tokens per run", "recall",
                 "recall 95% ci", "n eff"],
                knees,
            )
        )
        sections.append(
            _paragraph(
                "The exchange rate is round two's own: tokens per slot fitted to its "
                "cost rows, and tokens per unit recall taken from the full shelf cell. "
                "A step pays when the recall it adds is worth more than the tokens it "
                "adds at that rate."
            )
        )
    else:
        sections.append(
            _paragraph(
                "The knee is not priced: round two's cost rows are unavailable, and "
                "guessing the exchange rate would turn a measured threshold into a "
                "taste call."
            )
        )
    if exploratory:
        sections.append(
            _table(
                "Exploratory tier, reported and never shipped by this round",
                ["arm", "k", "recall", "recall 95% ci", "clusters", "n eff"],
                exploratory,
            )
        )
    for label in sorted(summary["unavailable"]):
        sections.append(
            _paragraph(
                "Arm {0} was not swept: {1}. It is absent from the ranking rather than "
                "placed last, because a missing arm that ranks last is "
                "indistinguishable from an arm that lost.".format(
                    label, summary["unavailable"][label]
                )
            )
        )
    for followup in summary["outcome"]["followups"]:
        sections.append(
            _paragraph(
                "Follow-up: {0} at k={1} beats {2} by {3:.4f}, 95% {4}. {5}".format(
                    followup["arm"],
                    followup["k"],
                    followup["over"],
                    followup["margin"]["mean"],
                    stats.format_interval(followup["margin"]),
                    followup["note"],
                )
            )
        )
    if summary["converged"]:
        sections.append(
            _paragraph(
                "The arms land within a hundredth of each other at k={0}: the open "
                "question is what k, not which arm.".format(max(summary["ks"]))
            )
        )

    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Catalog retrieval, round three</title>
<style>
 body {{ background:#0a0b0d; color:#ece7de; font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;
        margin:0; padding:3rem clamp(1rem,5vw,4rem); }}
 h1 {{ font-size:1.6rem; font-weight:400; margin:0 0 0.4rem; }}
 p.sub {{ color:#8b8578; margin:0 0 2.5rem; max-width:70rem; }}
 p.stop {{ color:#d8ff3e; margin:0 0 2.5rem; max-width:70rem; }}
 table {{ border-collapse:collapse; width:100%; max-width:70rem; margin:0 0 2.5rem; }}
 caption {{ text-align:left; color:#d8ff3e; font-size:0.78rem; letter-spacing:0.14em;
            text-transform:uppercase; padding-bottom:0.6rem; }}
 th,td {{ text-align:left; padding:0.5rem 0.9rem 0.5rem 0; border-bottom:1px solid #23272f; }}
 th {{ color:#8b8578; font-weight:400; font-size:0.8rem; }}
</style></head><body>
<h1>Catalog retrieval, round three</h1>
<p class="sub">{briefs} briefs over {clusters} target moves, swept offline against a shelf of
{shelf} entries. No model call and no spend produced any number on this page: recall is decided
by the retriever before a token is bought.</p>
<p class="stop">Stop reason: {reason}. {says}. Waves run {waves} of {max_waves}, spend ceiling
reached: {ceiling}.</p>
<p class="stop">Rule outcome: branch {branch}, ship {ship}. {why}</p>
<p class="sub">Ceiling: the shelf holds {shelf} entries, so no corpus size ever buys more than
{shelf} independent things to be right about. If that resolution proves insufficient, the honest
recommendation is a larger catalog, not a larger corpus.</p>
{sections}
</body></html>
""".format(
        briefs=summary["briefs"],
        clusters=summary["clusters"],
        shelf=summary["shelf_size"],
        reason=summary["stop_reason"],
        says=html.escape(summary["stop_reason_says"]),
        waves=summary["waves_run"],
        max_waves=summary["max_waves"],
        ceiling="yes" if summary["ceiling_reached"] else "no",
        branch=html.escape(str(summary["outcome"]["branch"])),
        ship=html.escape(str(summary["outcome"]["ship"] or "nothing yet")),
        why=html.escape(summary["outcome"]["reason"]),
        sections="\n".join(sections),
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", default=recall.CORPUS)
    parser.add_argument("--gold", default=recall.GOLD)
    parser.add_argument("--vectors", default=recall.VECTORS)
    parser.add_argument("--rule", default=sweep.RULE_FILE)
    parser.add_argument("--ks", default=",".join(str(k) for k in sweep.KS))
    parser.add_argument(
        "--waves",
        type=int,
        default=0,
        help="waves of corpus growth completed so far, which the stop reason reads",
    )
    parser.add_argument(
        "--ceiling-reached",
        action="store_true",
        help="the spend ceiling fired, which is a different verdict from running out of waves",
    )
    parser.add_argument("--report", default=REPORT)
    parser.add_argument("--summary", default=SUMMARY)
    args = parser.parse_args(argv)

    harness2.VECTORS = args.vectors
    rule = sweep.parse_rule(args.rule)
    ks = tuple(int(k) for k in args.ks.split(","))

    briefs = recall.load_briefs(args.corpus)
    gold = recall.load_gold(args.gold)
    entries = harness2.load_shelf()
    clusters = sweep.cluster_keys(gold)
    arms = {
        label: spec
        for label, spec in sweep.decision_arms().items()
        if spec["family"] in rule["decision_tier"]
    }
    swept, unavailable = sweep.sweep(briefs, gold, entries, arms, ks)

    summary = build_summary(
        swept,
        unavailable,
        clusters,
        rule,
        shelf_size=len(entries),
        waves_run=args.waves,
        ceiling_reached=args.ceiling_reached,
        tokens=sweep.token_model(),
        price=sweep.recall_price(),
    )
    with open(args.summary, "w", encoding="utf-8") as fh:
        json.dump(jsonable(summary), fh, indent=2, sort_keys=True, allow_nan=False)
    with open(args.report, "w", encoding="utf-8") as fh:
        fh.write(render(summary))

    print("stop reason: {0}".format(summary["stop_reason"]))
    print("branch: {0}, ship: {1}".format(
        summary["outcome"]["branch"], summary["outcome"]["ship"] or "nothing yet"
    ))
    for row in summary["ranking"]:
        print("{0} at k={1}  recall {2:.4f}  95% {3}  n_eff {4}".format(
            row["arm"], row["k"], row["interval"]["mean"],
            stats.format_interval(row["interval"]), row["interval"]["n_eff"],
        ))
    print("wrote {0} and {1}".format(args.report, args.summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
