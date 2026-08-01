#!/usr/bin/env python3
"""Render the round four report: round three's page plus the band test.

Round 4 pre-registered something round 3 did not, a minimum band width, so its
report has to answer one more question than round 3's: not only where the leader
separates but whether it separates over a contiguous run of list lengths wide
enough to satisfy the number written down before any of these numbers existed.

Nothing else is rebuilt. The summary, every table and the whole page shape come
from build_report3, which is imported rather than copied, so the two rounds
cannot drift into two ideas of what a ranking is. This file adds three fields and
two sections and is deliberately almost empty otherwise.

It is a separate file rather than an edit to build_report3 because round 3's
report is a published artifact that has to keep regenerating unchanged from
round 3's own corpus.

No model call, no network, no spend.
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROUND3 = os.path.join(os.path.dirname(HERE), "round3")
sys.path.insert(0, ROUND3)

import build_report3  # noqa: E402
import confirm3  # noqa: E402
import recall  # noqa: E402
import stats  # noqa: E402
import sweep  # noqa: E402

import harness2  # noqa: E402  recall puts the round two directory on the path

TITLE = "Catalog retrieval, round four"
RULE_FILE = os.path.join(HERE, "DECISION-RULE.md")
REPORT = os.path.join(HERE, "report4.html")
SUMMARY = os.path.join(HERE, "summary4.json")
CONFIRMATION = os.path.join(HERE, "confirm4.json")


def across_from(summary):
    """The per k rule readings the summary already carries, in band shape.

    Read back rather than recomputed. Running decide_across_ks a second time
    would give the band a second source of truth for what the rule said at each
    k, and a band drawn over readings the report did not print is a band nobody
    can check.
    """
    return [
        {"k": row["k"], "outcome": {"branch": row["branch"], "ship": row["ship"]}}
        for row in summary["across_ks"]
    ]


def build_summary(swept, unavailable, clusters, rule, shelf_size, **kwargs):
    """Round three's summary, plus the band test and the convergence point."""
    summary = build_report3.build_summary(
        swept, unavailable, clusters, rule, shelf_size, **kwargs
    )
    summary["band"] = sweep.band_test(across_from(summary), swept, rule)
    summary["convergence_point"] = sweep.convergence_point(swept, summary["ks"])
    return summary


def band_sections(summary):
    """The band test, as a table of runs and the verdict against the rule."""
    band = summary.get("band")
    if band is None:
        return [
            build_report3._paragraph(
                "The rule file this report was built against pre-registers no band "
                "width, so there is no band verdict to report. That is a missing "
                "requirement rather than a failed test, and inventing a width here "
                "would be a rule written after the numbers."
            )
        ]
    rows = [
        [
            run["family"],
            run["lo"],
            run["hi"],
            run["width"],
            "yes" if run["width"] >= band["required"] else "no",
            ", ".join(run["arms"]),
        ]
        for run in band["bands"]
    ]
    sections = [
        build_report3._table(
            "Band stability, contiguous list lengths where the leader separates",
            ["family", "k from", "k to", "list lengths", "clears alone", "leader"],
            rows,
        ),
        build_report3._paragraph(
            "The rule asks for {0} contiguous list lengths and the widest single "
            "band holds {1}, so the band requirement {2}. These are counts of "
            "swept list lengths, not estimates, which is why this is the one "
            "table on the page without an interval: the separation at each k "
            "inside a band carries its own interval in the table below, and a "
            "band is how many of those there were in a row.".format(
                band["required"],
                band["width"],
                "is met" if band["clears"] else "is not met",
            )
        ),
    ]
    if len(band["bands"]) > 1:
        sections.append(
            build_report3._paragraph(
                "The leader separates over more than one run, and the runs are not "
                "added together. The list lengths between them did not separate, so "
                "two short runs are two short runs and not one wide band. The round "
                "passes only when a single run clears the requirement on its own."
            )
        )
    if not band["bands"]:
        sections.append(
            build_report3._paragraph(
                "No comparable list length separated the leader from its runner-up, "
                "so there is no band to measure and the requirement cannot be met. "
                "Step 3 of the rule then decides on operations rather than on the "
                "larger number."
            )
        )
    point = summary.get("convergence_point")
    sections.append(
        build_report3._paragraph(
            "Convergence point: the arms land within a hundredth of each other "
            "from k={0} and stay there. Every arm draws from the same {1} entry "
            "shelf, so at sufficient k they must converge, and where that happens "
            "is a property of the catalog rather than of any retriever.".format(
                point, summary["shelf_size"]
            )
            if point is not None
            else "Convergence point: none. The arms are still more than a hundredth "
            "apart at the longest swept list length, so this sweep never reached the "
            "length at which the shelf makes them the same."
        )
    )
    return sections


def _separates(interval):
    return interval["lo"] > 0 or interval["hi"] < 0


def operating_point(summary, confirmation):
    """The shipped (arm, k), read off the band and the adjacent-k pairings.

    The rule pre-registered how to pick the arm and it did not pick a k: its
    outcome here is `k-dependent`, which says in as many words that the open
    question is what k rather than which arm. So the k is chosen after the
    numbers existed, by the only mechanical reading that answers "is a longer
    list still buying anything": the largest bought list length whose step up
    from the one below it separates on pass rate on at least one model.

    Computed rather than written down so it cannot drift from the confirmation
    it claims to summarise, and labelled post hoc wherever it is rendered,
    because a number the rule did not pre-register must not be presented as one
    the rule decided.
    """
    band = summary.get("band")
    if not confirmation or not band or not band.get("clears"):
        return None
    family = band["band"]["family"]
    steps = {}
    for pair in confirmation.get("paired", []):
        if tuple(pair.get("changed") or ()) != ("k",):
            continue
        cell = confirm3.parse_cell(pair["cell"])
        against = confirm3.parse_cell(pair["against"])
        if harness2.FAMILY_BY_CONDITION.get(cell["arm"]) != family:
            continue
        steps.setdefault((against["k"], cell["k"]), []).append(
            _separates(pair["pass_rate"])
        )
    if not steps:
        return None
    climbing = sorted(step for step, votes in steps.items() if any(votes))
    if not climbing:
        return None
    return {
        "family": family,
        "k": climbing[-1][1],
        "from_k": climbing[-1][0],
        "models": len(steps[climbing[-1]]),
        "stalled": sorted(step for step, votes in steps.items() if not any(votes)),
    }


def operating_point_sections(summary, confirmation):
    """The one thing a reader opens this page for, before the six tables."""
    point = operating_point(summary, confirmation)
    if point is None:
        return [
            build_report3._paragraph(
                "Operating point: none yet. Either the band did not clear, or no "
                "confirmation has been bought at two list lengths of the leading "
                "family, so nothing on this page answers what k to ship."
            )
        ]
    stalled = ", ".join(
        "{0} to {1}".format(lo, hi) for lo, hi in point["stalled"] if lo >= point["k"]
    )
    return [
        build_report3._paragraph(
            "Operating point: {0} at k={1}. The family is what the band decided, "
            "over {2} contiguous list lengths against a required {3}. The list "
            "length is the last one that bought anything: going from k={4} to "
            "k={1} separated on pass rate on {5} of the models confirmed there, "
            "and {6}.".format(
                point["family"],
                point["k"],
                summary["band"]["width"],
                summary["band"]["required"],
                point["from_k"],
                point["models"],
                "every longer step measured here separated on none of them ({0})".format(
                    stalled
                )
                if stalled
                else "no longer list length was bought, so this is the longest "
                "measured rather than a measured ceiling",
            )
        ),
        build_report3._paragraph(
            "The list length above was chosen after the numbers existed. The rule "
            "fixed how to pick the arm and required confirmation at several list "
            "lengths; it did not fix how to pick k inside the band, and its own "
            "outcome on this corpus is k-dependent. Read it as the reading of the "
            "confirmation that this page can defend, not as something the "
            "pre-registered rule decided."
        ),
    ]


def render(summary, confirmation=None):
    return build_report3.render(
        summary,
        confirmation,
        leading_sections=(
            operating_point_sections(summary, confirmation) + band_sections(summary)
        ),
        title=TITLE,
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", default=recall.CORPUS)
    parser.add_argument("--gold", default=recall.GOLD)
    parser.add_argument("--vectors", default=recall.VECTORS)
    parser.add_argument("--rule", default=RULE_FILE)
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
    parser.add_argument(
        "--confirmation",
        default=CONFIRMATION,
        help="the paid stage's output, rendered beside the free sweep when it exists",
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
        json.dump(
            build_report3.jsonable(summary), fh, indent=2, sort_keys=True, allow_nan=False
        )
    confirmation = None
    if args.confirmation and os.path.exists(args.confirmation):
        with open(args.confirmation, encoding="utf-8") as fh:
            confirmation = json.load(fh)
    with open(args.report, "w", encoding="utf-8") as fh:
        fh.write(render(summary, confirmation))

    # The four things the round is required to name, printed in one place so a
    # reader does not have to trust the page to find out whether it separated.
    print("stop reason: {0}".format(summary["stop_reason"]))
    print("branch: {0}, ship: {1}".format(
        summary["outcome"]["branch"], summary["outcome"]["ship"] or "nothing yet"
    ))
    band = summary["band"]
    if band is None:
        print("band: the rule file pre-registers no band width, so none was measured")
    else:
        for run in band["bands"]:
            print("band: {0} over k={1} to k={2}, {3} list lengths, leader {4}".format(
                run["family"], run["lo"], run["hi"], run["width"], "/".join(run["arms"])
            ))
        if not band["bands"]:
            print("band: none, no comparable k separated the leader")
        print("band verdict: widest single band {0} of {1} required, {2}".format(
            band["width"], band["required"],
            "clears" if band["clears"] else "does not clear",
        ))
    print("convergence point: {0}".format(
        "k={0}".format(summary["convergence_point"])
        if summary["convergence_point"] is not None
        else "none within the sweep"
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
