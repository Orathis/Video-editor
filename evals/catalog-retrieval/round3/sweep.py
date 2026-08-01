#!/usr/bin/env python3
"""Full arm sweep, clustered ranking, and a mechanically applied decision rule.

Three things are deliberately not reinvented here. The rankings come from the
round two harness through recall.py, the intervals come from stats.py, and the
rule itself is read out of DECISION-RULE.md rather than transcribed into this
file. A transcribed rule is a rule that can quietly disagree with the
pre-registered one, and the whole point of pre-registering was that it cannot.

Standard library only, no network, no model calls.
"""

import argparse
import json
import os
import re
import sys

import recall
import stats

import harness2  # noqa: E402  recall puts the round two directory on the path

HERE = os.path.dirname(os.path.abspath(__file__))
RULE_FILE = os.path.join(HERE, "DECISION-RULE.md")
SUMMARY = os.path.join(recall.ROUND2, "summary.json")

KS = (5, 10, 20, 30, 40, 50, 60, 70, 80)
# Hybrid's fusion weight is the one arm parameter round two never varied: its
# hybrid_topk fuses the two rankings at equal weight. The sweep brackets that.
RRF_WEIGHTS = (0.3, 0.5, 0.7)
REQUIRED_RULE_KEYS = (
    "confidence",
    "decision_tier",
    "tie_break",
    "max_waves",
    "exploratory_tier_can_win",
)


def parse_rule(path=RULE_FILE):
    """The pre-registered parameters, read from the committed rule file.

    Read, never reimplemented: editing the block in DECISION-RULE.md has to be
    able to change what this script decides, otherwise the file is documentation
    and the real rule lives in code where nobody pre-registered it.
    """
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    for block in re.findall(r"```json\n(.*?)```", text, flags=re.S):
        rule = json.loads(block)
        missing = [key for key in REQUIRED_RULE_KEYS if key not in rule]
        if missing:
            raise SystemExit(
                "{0} parameter block is missing {1}".format(path, ", ".join(missing))
            )
        if rule["confidence"] != stats.CONFIDENCE:
            # stats.py's t table is a 95 percent table. Honouring another level
            # would need another table, so the mismatch is refused rather than
            # reported at the wrong width.
            raise SystemExit(
                "rule asks for confidence {0} but stats.py computes {1}".format(
                    rule["confidence"], stats.CONFIDENCE
                )
            )
        return rule
    raise SystemExit("{0} carries no json parameter block: the rule cannot be read".format(path))


def weighted_hybrid(semantic_weight):
    """Reciprocal rank fusion with an explicit split between the two rankings.

    At 0.5 every score is exactly half of what harness2.hybrid_topk computes, so
    the order, and therefore the arm, is identical. That equality is tested; it
    is what keeps this from being a second hybrid implementation.
    """

    def topk(brief_id, brief, entries, k):
        lexical = harness2.lexical_topk(brief, entries, len(entries))
        semantic = harness2.semantic_topk(brief_id, entries, len(entries))
        if not semantic:
            raise SystemExit(
                "empty semantic ranking for {0} from {1}: hybrid cannot fuse".format(
                    brief_id, harness2.VECTORS
                )
            )
        scores = {}
        for ranked, weight in (
            (lexical, 1.0 - semantic_weight),
            (semantic, semantic_weight),
        ):
            for rank, name in enumerate(ranked, start=1):
                scores[name] = scores.get(name, 0.0) + weight / (rank + harness2.RRF_C)
        fused = sorted(((score, name) for name, score in scores.items()), reverse=True)
        return [name for _, name in fused[:k]]

    return topk


def _base_arm(name):
    return lambda brief_id, brief, entries, k: recall.shown(name, brief_id, brief, entries, k)


def decision_arms(weights=RRF_WEIGHTS):
    """The three round two arms, hybrid expanded over its fusion weight."""
    arms = {
        "lexical": {"family": "lexical", "tier": "decision", "fn": _base_arm("lexical")},
        "semantic": {"family": "semantic", "tier": "decision", "fn": _base_arm("semantic")},
    }
    for weight in weights:
        label = "hybrid@w={0:g}".format(weight)
        arms[label] = {
            "family": "hybrid",
            "tier": "decision",
            "fn": weighted_hybrid(weight),
        }
    return arms


def arm_flags(fn, briefs, gold, entries, k):
    """Per brief, was a gold best move on this arm's shown list.

    Same rule as recall.shown_flags, which is asserted in the tests: briefs with
    no gold are skipped rather than scored as misses. The only difference is that
    the ranking arrives as a callable, so a parameterised arm can be swept.
    """
    flags = {}
    for brief_id, text in briefs.items():
        if brief_id not in gold:
            continue
        best = gold[brief_id]["best"]
        flags[brief_id] = bool(set(best) & set(fn(brief_id, text, entries, k)))
    return flags


def cluster_keys(gold):
    """Brief id to cluster key, the target move the brief was written for.

    Falling back to the brief id when gold names no best move keeps that brief in
    its own cluster instead of silently merging every such brief into one.
    """
    return {
        brief_id: (entry["best"][0] if entry["best"] else brief_id)
        for brief_id, entry in gold.items()
    }


def sweep(briefs, gold, entries, arms, ks=KS):
    """Every arm over every k, plus the arms that could not run and why.

    Arms are swept one at a time so an arm whose embedding index is absent is
    reported as unavailable instead of taking the whole sweep down with it. An
    unavailable arm never enters the ranking, because a missing arm that ranks
    last is indistinguishable from an arm that lost.
    """
    swept, unavailable = {}, {}
    for label, spec in arms.items():
        try:
            flags = {k: arm_flags(spec["fn"], briefs, gold, entries, k) for k in ks}
        except SystemExit as reason:
            unavailable[label] = str(reason)
            continue
        swept[label] = {
            "family": spec["family"],
            "tier": spec["tier"],
            "flags": flags,
            "curve": {
                k: round(sum(f.values()) / len(f), 4) if f else 0.0
                for k, f in flags.items()
            },
        }
    return swept, unavailable


def rankable_ks(curve, shelf_size):
    """The swept ks that describe a retrieval arm rather than the control.

    A list as long as the shelf is the shelf. Round 2 ran that as cell b and the
    rule fixes it at 0.0, so a k at or above the shelf size is the control
    wearing a retriever's label, and every arm scores 1.0 there. Those ks stay
    in the reported curve, because the curve is how the ceiling becomes visible,
    and they are kept out of the ranking, because a ranking that can select them
    decides nothing.
    """
    if shelf_size is None:
        return dict(curve)
    return {k: recall_at for k, recall_at in curve.items() if k < shelf_size}


def rank(
    swept,
    clusters,
    tier="decision",
    tokens_per_k=None,
    tokens_per_recall=None,
    shelf_size=None,
):
    """One row per arm, at the k where a longer list stops paying for itself.

    The k is the arm's knee, not the k with the highest recall. Recall rises
    with k by construction, so ranking an arm at its recall argmax selects
    whatever the longest swept k happened to be, and once the sweep reaches the
    shelf size every arm scores exactly 1.0 by putting all 424 entries in front
    of the model. That is the round 2 control, which this round's rule fixes at
    0.0 and forbids changing, so a ranking that can select it is not measuring
    retrieval at all. The knee is the point the rule already names, where token
    cost starts to outrun the recall gain, and it cannot run away to the end of
    the shelf.

    `knee_exhausted` records the arms that never stopped paying inside the
    swept range. Their k is the end of the sweep rather than a knee, which is a
    statement about the grid and has to be reported as one.
    """
    if tokens_per_k is None:
        tokens_per_k = token_model()[0]
    if tokens_per_recall is None:
        tokens_per_recall = recall_price()
    rows = []
    for label, arm in swept.items():
        if arm["tier"] != tier:
            continue
        curve = rankable_ks(arm["curve"], shelf_size)
        if not curve:
            raise SystemExit(
                "arm {0} was swept only at k values that show the whole shelf, "
                "so it has no retrieval configuration to rank".format(label)
            )
        best_k, exhausted = knee(curve, tokens_per_k, tokens_per_recall)
        flags = arm["flags"][best_k]
        ids = sorted(flags)
        rows.append(
            {
                "arm": label,
                "family": arm["family"],
                "tier": tier,
                "k": best_k,
                "knee_exhausted": exhausted,
                "flags": flags,
                "interval": stats.clustered_mean(
                    [flags[i] for i in ids], [clusters[i] for i in ids]
                ),
            }
        )
    rows.sort(key=lambda row: (-row["interval"]["mean"], row["k"], row["arm"]))
    return rows


def paired(row, baseline, clusters):
    """Clustered paired difference between two ranked rows, brief by brief."""
    ids = sorted(set(row["flags"]) & set(baseline["flags"]))
    return stats.clustered_difference(
        [row["flags"][i] for i in ids],
        [baseline["flags"][i] for i in ids],
        [clusters[i] for i in ids],
    )


def decide(rows, rule, clusters, exploratory=()):
    """Apply the pre-registered rule to a ranking. Every branch comes from the file.

    Step 2 separates or it does not; step 3 breaks a tie on operations. The
    exploratory tier is reported and never shipped, and with only one arm family
    available there is nothing to compare and the rule says so rather than
    shipping the only arm that happened to run.
    """
    if not rows:
        return {
            "branch": "not-evaluable",
            "ship": None,
            "reason": "no decision tier arm was available, so the rule has nothing to rank",
            "followups": [],
        }

    leader = rows[0]
    runner_up = next((row for row in rows[1:] if row["family"] != leader["family"]), None)
    if runner_up is None:
        outcome = {
            "branch": "not-evaluable",
            "ship": None,
            "leader": leader,
            "runner_up": None,
            "difference": None,
            "reason": (
                "only the {0} family was available, and step 2 compares a leader "
                "against a runner-up from another family".format(leader["family"])
            ),
        }
    else:
        difference = paired(leader, runner_up, clusters)
        if difference["lo"] > 0:
            outcome = {
                "branch": "separated",
                "ship": leader["arm"],
                "leader": leader,
                "runner_up": runner_up,
                "difference": difference,
                "reason": (
                    "step 2: {0} clears {1} by {2:.4f}, interval {3} excludes zero".format(
                        leader["arm"],
                        runner_up["arm"],
                        difference["mean"],
                        stats.format_interval(difference),
                    )
                ),
            }
        else:
            prefer = rule["tie_break"]["prefer"]
            tied = [row for row in rows if row["family"] == prefer]
            outcome = {
                "branch": "tie",
                "ship": tied[0]["arm"] if tied else None,
                "leader": leader,
                "runner_up": runner_up,
                "difference": difference,
                "reason": (
                    "step 3: {0} over {1} is {2:.4f}, interval {3} contains zero, so the "
                    "tie goes to {4} ({5})".format(
                        leader["arm"],
                        runner_up["arm"],
                        difference["mean"],
                        stats.format_interval(difference),
                        prefer,
                        rule["tie_break"].get("because", "operations, not the larger number"),
                    )
                ),
            }

    outcome["followups"] = _followups(outcome, rows, rule, clusters, exploratory)
    return outcome


def _followups(outcome, rows, rule, clusters, exploratory):
    """Exploratory arms that beat the shipped ranking, recorded with their margin."""
    if rule["exploratory_tier_can_win"]:
        raise SystemExit(
            "the rule file says the exploratory tier can win, which this round's "
            "prose does not support; resolve the file before running"
        )
    reference = next((row for row in rows if row["arm"] == outcome["ship"]), rows[0] if rows else None)
    followups = []
    for row in exploratory:
        if reference is None or row["interval"]["mean"] <= reference["interval"]["mean"]:
            continue
        followups.append(
            {
                "arm": row["arm"],
                "k": row["k"],
                "over": reference["arm"],
                "margin": paired(row, reference, clusters),
                "note": "exploratory tier, recorded as a follow-up initiative, not shipped",
            }
        )
    return followups


def token_model(summary_path=SUMMARY, prefix="c@"):
    """Input tokens per run as a straight line in k, fitted to round two's own cost rows.

    Round two paid for these numbers, so the price of a longer list is measured
    rather than guessed. Returns (slope, intercept), or None when the summary is
    absent.
    """
    if not os.path.exists(summary_path):
        return None
    with open(summary_path, encoding="utf-8") as fh:
        cost = json.load(fh)["cost"]
    points = [
        (int(name.split("@")[1]), row["input_per_run"])
        for name, row in cost.items()
        if name.startswith(prefix) and "@" in name
    ]
    if len(points) < 2:
        return None
    n = len(points)
    mean_k = sum(k for k, _ in points) / n
    mean_t = sum(t for _, t in points) / n
    spread = sum((k - mean_k) ** 2 for k, _ in points)
    slope = sum((k - mean_k) * (t - mean_t) for k, t in points) / spread
    return slope, mean_t - slope * mean_k


def recall_price(summary_path=SUMMARY, cell="b"):
    """Input tokens per unit of recall, taken from the full shelf cell.

    "Stops paying" needs a price for recall, and round 2 measured one: showing
    all 424 entries bought recall 1.0 for 23,725 input tokens per run. Any
    shortlist step that buys recall more dearly than that is worse than simply
    paying for the whole shelf, which is what makes this a threshold and not a
    taste call. Returns None when the summary is absent.
    """
    if not os.path.exists(summary_path):
        return None
    with open(summary_path, encoding="utf-8") as fh:
        summary = json.load(fh)
    rate = summary["cells"][cell]["recall"]
    return summary["cost"][cell]["input_per_run"] / rate if rate else None


def knee(curve, tokens_per_k, tokens_per_recall):
    """Where a longer list stops paying for the tokens it costs.

    Returns (k, exhausted). A step pays when the recall it adds is worth more, at
    the full shelf's own exchange rate, than the tokens it adds. The knee is the
    last k reached before the first step that does not pay. `exhausted` is True
    when no step failed, meaning the knee is past the end of the sweep rather
    than at its last k.

    The threshold is fixed rather than relative to the curve so far, so raising
    any part of the curve can only move the knee later. Flat recall fails at the
    first step and knees at the shortest k.
    """
    ks = sorted(curve)
    if len(ks) < 2:
        return (ks[0] if ks else None), False
    for i in range(len(ks) - 1):
        gain = curve[ks[i + 1]] - curve[ks[i]]
        cost = (ks[i + 1] - ks[i]) * tokens_per_k
        if gain * tokens_per_recall < cost:
            return ks[i], False
    return ks[-1], True


def converged(swept, ks, tolerance=0.01):
    """Do every available arm land within tolerance of each other at the longest k."""
    if len(swept) < 2:
        return False
    last = max(ks)
    rates = [arm["curve"][last] for arm in swept.values()]
    return max(rates) - min(rates) <= tolerance


def _print_curves(swept, unavailable, ks):
    print("\nrecall curve")
    print("arm".ljust(14) + "".join("k={0}".format(k).rjust(9) for k in ks))
    for label in sorted(swept):
        curve = swept[label]["curve"]
        print(label.ljust(14) + "".join("{0:.4f}".format(curve[k]).rjust(9) for k in ks))
    for label in sorted(unavailable):
        print("{0} not swept: {1}".format(label.ljust(14), unavailable[label]))


def _print_ranking(rows, title):
    print("\n" + title)
    if not rows:
        print("  none")
        return
    for place, row in enumerate(rows, start=1):
        interval = row["interval"]
        print(
            "{0}. {1} at k={2}  recall {3:.4f}  95% {4}  clusters {5}  icc {6}  n_eff {7}".format(
                place,
                row["arm"],
                row["k"],
                interval["mean"],
                stats.format_interval(interval),
                interval["clusters"],
                interval["icc"],
                interval["n_eff"],
            )
        )


def _print_knees(swept, ks, tokens, price):
    print("\nknee, where a longer list stops paying")
    if not tokens or not price:
        print("  not priced: round 2 cost rows are unavailable")
        return
    slope, intercept = tokens
    last = max(ks)
    for label in sorted(swept):
        curve = swept[label]["curve"]
        at, exhausted = knee(curve, slope, price)
        line = "{0}: {1}k={2}, recall {3:.4f}, {4:.0f} input tokens per run".format(
            label,
            "no knee within the sweep, the last step still paid, at " if exhausted else "knee at ",
            at,
            curve[at],
            slope * at + intercept,
        )
        if not exhausted:
            line += "; k={0} to k={1} adds {2:.0f} tokens for {3:+.4f} recall".format(
                at, last, slope * (last - at), curve[last] - curve[at]
            )
        print(line)
    print(
        "prices: {0:.1f} input tokens per unit k (fitted to round 2 cost rows), "
        "{1:.0f} tokens per unit recall (full shelf cell b)".format(slope, price)
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", default=recall.CORPUS)
    parser.add_argument("--gold", default=recall.GOLD)
    parser.add_argument("--vectors", default=recall.VECTORS)
    parser.add_argument("--rule", default=RULE_FILE)
    parser.add_argument("--ks", default=",".join(str(k) for k in KS))
    args = parser.parse_args(argv)

    harness2.VECTORS = args.vectors
    rule = parse_rule(args.rule)
    ks = tuple(int(k) for k in args.ks.split(","))

    briefs = recall.load_briefs(args.corpus)
    gold = recall.load_gold(args.gold)
    entries = harness2.load_shelf()
    clusters = cluster_keys(gold)

    arms = {
        label: spec
        for label, spec in decision_arms().items()
        if spec["family"] in rule["decision_tier"]
    }
    swept, unavailable = sweep(briefs, gold, entries, arms, ks)

    print("{0} briefs, {1} gold, {2} shelf entries, {3} clusters".format(
        len(briefs), len(gold), len(entries), len(set(clusters.values()))
    ))
    print("rule: {0}, confidence {1}, decision tier {2}, tie break {3}, max waves {4}, "
          "exploratory can win: {5}".format(
              os.path.basename(args.rule),
              rule["confidence"],
              "/".join(rule["decision_tier"]),
              rule["tie_break"]["prefer"],
              rule["max_waves"],
              rule["exploratory_tier_can_win"],
          ))

    _print_curves(swept, unavailable, ks)
    slope, price = token_model()[0], recall_price()
    shelf_size = len(entries)
    skipped = sorted(k for k in ks if k >= shelf_size)
    if skipped:
        print(
            "\nnot ranked: k {0}, at or past the {1} entry shelf. A list that long "
            "is the whole shelf, which is round 2's control cell and scores 0.0. "
            "It stays in the curve above and out of the ranking below.".format(
                ", ".join(str(k) for k in skipped), shelf_size
            )
        )
    rows = rank(swept, clusters, "decision", slope, price, shelf_size)
    _print_ranking(rows, "ranking, decision tier, clustered by target move")
    exploratory = rank(swept, clusters, "exploratory", slope, price, shelf_size)
    _print_ranking(exploratory, "ranking, exploratory tier, cannot win this decision")
    _print_knees(swept, ks, token_model(), recall_price())

    outcome = decide(rows, rule, clusters, exploratory)
    print("\nrule outcome")
    print("branch: {0}".format(outcome["branch"]))
    print("ship: {0}".format(outcome["ship"] or "nothing yet"))
    print("why: {0}".format(outcome["reason"]))
    for followup in outcome["followups"]:
        print("follow-up: {0} beats {1} by {2:.4f}, 95% {3}, {4}".format(
            followup["arm"], followup["over"], followup["margin"]["mean"],
            stats.format_interval(followup["margin"]), followup["note"],
        ))
    if converged(swept, ks):
        print(
            "arms converge at k={0}: the open question is what k, not which arm".format(max(ks))
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
