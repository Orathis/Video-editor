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

import confirm3  # noqa: E402
import recall  # noqa: E402
import stats  # noqa: E402
import sweep  # noqa: E402

import harness2  # noqa: E402  recall puts the round two directory on the path

TITLE = "Catalog retrieval, round three"
REPORT = os.path.join(HERE, "report3.html")
SUMMARY = os.path.join(HERE, "summary3.json")
CONFIRMATION = os.path.join(HERE, "confirm3.json")

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
    "k-dependent": (
        "the rule ships a different family depending on the list length it is "
        "read at, so the round ends on the question the rule pre-registered for "
        "this case, which is what k rather than which arm. Growing the corpus "
        "cannot change it, because every arm draws from the same shelf and so "
        "they must converge at sufficient k"
    ),
}


def stop_reason(outcome, waves_run, rule, ceiling_reached=False):
    """Which stopping condition fired, in the order the rule lists them.

    Separation is checked first because the rule evaluates it after each wave, so
    a round that separates on its final wave stopped on the separation and not on
    the wave count.
    """
    if outcome.get("branch") == "k-dependent":
        return "k-dependent"
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
    dict, and the cluster key is the sorted tuple of the acceptable set, never
    the brief. Two briefs answered by the same near twin family therefore share
    one cluster, and a single-target record clusters on its one move, which is
    round 3's key wearing a tuple.
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


# The report and the summary are artifacts other people read. An absolute path
# from the machine that built them says whose laptop ran the sweep and where the
# checkout sits, neither of which is a finding, and it makes the same reason read
# differently on every machine.
_REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))


def _portable(reason):
    """Rewrite any path inside a reason string to repo relative."""
    return reason.replace(_REPO + os.sep, "")


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
    # The same basis as the command line: the rule read at every comparable k,
    # every arm at the same k as every other, and never at a k that shows the
    # whole shelf. A report that ranked on some other basis would name a
    # different winner than the sweep that ran, which is the one thing a report
    # of a pre-registered decision cannot do.
    ks = sorted({k for arm in swept.values() for k in arm["curve"]})
    slope = tokens[0] if tokens else None
    across = sweep.decide_across_ks(swept, clusters, rule, ks, shelf_size)
    if not across and ks:
        # There were list lengths and every one of them was the whole shelf. An
        # unswept arm list is a different situation and still renders below, as
        # a report that says nothing is evaluable rather than one that crashes.
        raise SystemExit(
            "no swept k is shorter than the {0} entry shelf, so no two arms "
            "are comparable".format(shelf_size)
        )
    families = [
        swept[result["outcome"]["ship"]]["family"]
        for result in across
        if result["outcome"]["ship"] in swept
    ]
    unanimous = (
        bool(families) and len(set(families)) == 1 and len(families) == len(across)
    )
    point = (
        sweep.operating_point(swept, families[0], slope, price, shelf_size)
        if unanimous and slope and price
        else None
    )
    if not across:
        # No arm was swept at all, so there is no k to read the rule at. The
        # rule still has an answer for an empty ranking, and it is the answer
        # the report should carry: nothing was evaluable.
        headline = {
            "k": None,
            "rows": [],
            "exploratory": [],
            "outcome": sweep.decide([], rule, clusters),
        }
    elif point:
        headline = next((r for r in across if r["k"] == point["k"]), across[-1])
    else:
        # The swept ks ship different families. Carrying one of their outcomes
        # as the headline would report a choice of list length as a choice of
        # arm, so the verdict below names no arm.
        #
        # The ranking and the paired table still have to be read somewhere, and
        # the choice of where cannot be left to whichever k flatters an arm. It
        # is the smallest k at which the rule separates: among the list lengths
        # that satisfy step 2, the shortest is the only one defensible on cost,
        # since every longer list buys the same verdict for more tokens. Being
        # the minimum, it also cannot have been picked to widen a margin. Read
        # at the longest k instead, both tables come out degenerate: past the
        # point where every arm returns the whole shelf, recall is 1.0 for all
        # of them and every paired difference is exactly zero.
        runs = sweep.family_runs(across, swept)
        readable = next(
            (r for r in across if r["outcome"]["branch"] == "separated"), across[-1]
        )
        headline = {
            "k": readable["k"],
            "rows": readable["rows"],
            "exploratory": readable["exploratory"],
            "outcome": {
                "branch": "k-dependent",
                "ship": None,
                "reason": "the rule ships {0}".format(
                    ", then ".join(
                        "{0} over k={1} to k={2}".format(
                            run["family"] or "nothing", run["lo"], run["hi"]
                        )
                        for run in runs
                    )
                ),
                "followups": [],
            },
        }
    rows, exploratory = headline["rows"], headline["exploratory"]
    outcome = headline["outcome"]
    reason = stop_reason(outcome, waves_run, rule, ceiling_reached)
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
        "unavailable": {
            label: _portable(reason) for label, reason in unavailable.items()
        },
        "converged": sweep.converged(swept, ks) if ks else False,
        # What the rule said at each comparable k, so a reader can see whether
        # the verdict rested on the whole curve or on one lucky list length.
        "across_ks": [
            {
                "k": result["k"],
                "leader": result["rows"][0]["arm"] if result["rows"] else None,
                # The arm the margin was measured against, which the rule takes
                # from another family, not whichever arm placed second.
                "runner_up": (result["outcome"].get("runner_up") or {}).get("arm"),
                "branch": result["outcome"]["branch"],
                "ship": result["outcome"]["ship"],
                "margin": result["outcome"].get("difference"),
            }
            for result in across
        ],
        "unanimous_across_ks": unanimous,
        # The bands of list length over which the rule ships the same family.
        # One row here means the choice of k never mattered; more than one means
        # it was the whole question.
        "family_runs": sweep.family_runs(across, swept) if across else [],
        "operating_point": point,
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


def confirmation_sections(confirmation):
    """The paid stage, rendered beside the free one or declared missing.

    Recall is free and the two rates below are not, so a report that showed the
    ranking and quietly left these out would read as a finished round. When the
    confirmation has not run, that is stated rather than omitted.
    """
    if not confirmation:
        return [
            _paragraph(
                "The paid confirmation has not run. Refusal and known-wrong picks are "
                "the two quantities offline recall cannot see, so until it does, this "
                "page is the free half of the round and not the whole of it."
            )
        ]
    cells = confirmation["cells"]
    metrics = [name for name, _ in confirm3.METRICS]
    sections = [
        _table(
            "Paid confirmation, what recall cannot see",
            ["cell", "n", "clusters"]
            + [name.replace("_", " ") for name in metrics],
            [
                [cell, cells[cell]["n"], cells[cell]["clusters"]]
                + [
                    "{0:.4f} ({1})".format(
                        cells[cell][name]["mean"],
                        stats.format_interval(cells[cell][name]),
                    )
                    for name in metrics
                ]
                for cell in sorted(cells)
            ],
        ),
        _paragraph(
            "Refusing and naming a move the gold set marks as wrong are opposite "
            "failures with opposite fixes, so they are counted apart and never summed. "
            "Scoring is the same mechanical gate the earlier rounds used: no model "
            "judges a model here either."
        ),
    ]
    paired = confirmation.get("paired")
    # One pairing or a grid of them. Round 4 confirms at several list lengths and
    # on two models, so the paid stage emits a list. Round 3 published a single
    # object here and its report is a committed artifact, so a lone object is
    # read as a grid of one rather than the published file being rewritten.
    pairings = [paired] if isinstance(paired, dict) else list(paired or [])
    for pairing in pairings:
        caption = "Paid confirmation, paired brief by brief"
        if "changed" in pairing:
            caption += ", {0} against {1}".format(pairing["cell"], pairing["against"])
        sections.append(
            _table(
                caption,
                ["quantity", "difference", "difference 95% ci", "separated"],
                [
                    [
                        name.replace("_", " "),
                        "{0:+.4f}".format(pairing[name]["mean"]),
                        stats.format_interval(pairing[name]),
                        "no" if pairing[name]["lo"] <= 0 <= pairing[name]["hi"] else "yes",
                    ]
                    for name in metrics
                ],
            )
        )
        note = (
            "{0} against {1} on the {2} briefs both cells ran, differenced per brief "
            "so difficulty is held fixed. ".format(
                pairing["cell"], pairing["against"], pairing["n"]
            )
        )
        if "changed" not in pairing:
            # Round 3's pairing predates the grid and records no changed
            # variable. Its sentence is reproduced verbatim rather than derived,
            # because report3.html has to keep regenerating byte for byte.
            note += (
                "Exactly one thing differs between these cells, the retriever, "
                "which is what makes the difference readable at all."
            )
        else:
            prose = {name: reads for name, reads in confirm3.VARIABLES}
            note += (
                "Exactly one thing differs between these cells, {0}, which is "
                "what makes the difference readable at all.".format(
                    ", ".join(prose[name] for name in pairing["changed"])
                )
            )
        sections.append(_paragraph(note))
        # Its own paragraph, directly under the table it qualifies. Folded into
        # the sentence above it would read as a footnote on a clean result,
        # which for a cross-model row is the opposite of what it says.
        for confound in pairing.get("confounds") or []:
            sections.append(
                _paragraph(
                    "CONFOUND, this comparison is not a clean one variable "
                    "difference: {0}. It is reported as a difference with a "
                    "named confound and must not be read as a "
                    "reproduction.".format(confound)
                )
            )
    return sections


def render(summary, confirmation=None, leading_sections=(), title=TITLE):
    """The report. Every table ships an interval column, without exception.

    A later round renders the same page with its own heading and its own
    sections in front of these ones. Both arguments default to round three's, so
    round three's report is byte for byte what it was before they existed: this
    file is a published artifact and has to keep regenerating unchanged from its
    own corpus.
    """
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
    across_ks = [
        [
            row["k"],
            row["leader"] or "none",
            row["runner_up"] or "none",
            "{0:.4f}".format(row["margin"]["mean"]) if row["margin"] else "n/a",
            stats.format_interval(row["margin"]) if row["margin"] else "n/a",
            row["branch"],
            row["ship"] or "nothing",
        ]
        for row in summary["across_ks"]
    ]

    sections = [
        _table(
            "The rule read at every comparable k, one variable between arms",
            ["k", "leader", "runner-up", "difference", "difference 95% ci",
             "branch", "ships"],
            across_ks,
        ),
        _paragraph(
            "Reading the rule at one list length and reporting its answer would let a "
            "choice of k stand in for a choice of retriever. Reading it at all of them "
            "removes that freedom: either the swept ks agree, in which case the choice "
            "of k never mattered, or they disagree, and the disagreement is itself the "
            "finding. A k at or above the shelf size is not read at all, because a list "
            "that long is the whole shelf: it is the full-shelf control rather than a "
            "retrieval arm, and no retriever varies inside it. Rows where the difference "
            "is exactly zero are the arms already returning the same set, which happens "
            "well below that length."
            if across_ks
            else "No k shorter than the shelf was swept, so no two arms are comparable."
        ),
        _table(
            "Ranking, decision tier, every arm at the same k",
            ["place", "arm", "family", "k", "n", "recall", "recall 95% ci",
             "clusters", "icc", "n eff"],
            ranking,
        ),
        _paragraph(
            "Every arm sits at the same k, so the retriever is the only thing that "
            "varies down this ranking. Ranking each arm at a list length of its own "
            "would compare different list lengths at different token costs and call "
            "that a comparison of arms. When the swept ks disagree, this table is read "
            "at the shortest list length that separates them, because among the lengths "
            "that satisfy the rule the shortest is the only one defensible on cost, and "
            "being the minimum it cannot have been chosen to widen a margin. It is one "
            "row of the table above, not a verdict on its own."
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
            if margins
            # A header row with nothing under it reads as a pairing that failed.
            # There is a difference between "nothing separated" and "there was
            # never a second arm to pair against", and only one of them is a result.
            else "Nothing to pair: fewer than two arms in the decision tier were "
            "swept, so there is no runner-up to hold brief difficulty fixed "
            "against. This is a missing input, not a tie."
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
    sections.extend(confirmation_sections(confirmation))
    # In front, not appended: a round whose headline is the band test would bury
    # it under six tables of the round it inherited.
    sections = list(leading_sections) + sections

    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{title}</title>
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
<h1>{title}</h1>
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
        title=html.escape(title),
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
        json.dump(jsonable(summary), fh, indent=2, sort_keys=True, allow_nan=False)
    # Absent rather than empty when the paid stage has not run, which the report
    # says out loud instead of rendering a blank table.
    confirmation = None
    if args.confirmation and os.path.exists(args.confirmation):
        with open(args.confirmation, encoding="utf-8") as fh:
            confirmation = json.load(fh)
    with open(args.report, "w", encoding="utf-8") as fh:
        fh.write(render(summary, confirmation))

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
