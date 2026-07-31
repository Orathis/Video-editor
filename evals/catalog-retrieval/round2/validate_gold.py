#!/usr/bin/env python3
"""Validate constructed gold with three blind, independent committee passes."""

import collections
import glob
import json
import math
import os
import re

import harness2
import provider

HERE = os.path.dirname(os.path.abspath(__file__))
BRIEFS_DIR = os.path.join(HERE, "briefs")
GOLD_DIR = os.path.join(HERE, "gold")
AUDIT_PATH = os.path.join(HERE, "GOLD-AUDIT.md")

# A 95 percent floor limits label uncertainty to at most 15 of 300 briefs. At 90
# percent, as many as 30 briefs and 270 main-grid cells could inherit bad gold,
# which is too much avoidable uncertainty before a large paid run.
ACCURACY_FLOOR = 0.95
SAMPLE_FRACTION = 0.20
SAMPLE_CAP = 30

COMMITTEE_INSTRUCTIONS = """Reconstruct which single catalog move the brief describes.

Return only this JSON object:
{"move": "<exact move name>", "why": "<brief reasoning>"}

Choose exactly one move from the complete shelf below. Use the exact move name.
Do not discuss any prior response or any evaluation result.
"""


def build_committee_context(brief, shelf):
    """Build the complete pass context from one brief and the full shelf only."""
    rendered_shelf = "\n\n".join(
        f"### {name}\n{body}" for name, body in shelf.items()
    )
    return (
        f"{COMMITTEE_INSTRUCTIONS}\n"
        f"Complete shelf:\n\n{rendered_shelf}\n\n"
        f"Brief:\n\n{brief.strip()}\n"
    )


def _committee_pass(brief, shelf):
    context = build_committee_context(brief, shelf)
    parsed, raw, _usage, _elapsed = provider.chat(
        context,
        provider.CHAT_MODEL,
        {"temperature": 0},
    )
    if not isinstance(parsed, dict):
        raise SystemExit(f"committee returned invalid JSON: {raw[:200]!r}")
    move = parsed.get("move")
    why = parsed.get("why")
    if not isinstance(move, str) or not move.strip():
        raise SystemExit("committee response is missing a non-empty move")
    if move not in shelf:
        raise SystemExit(f"committee named a move outside the shelf: {move!r}")
    if not isinstance(why, str) or not why.strip():
        raise SystemExit("committee response is missing non-empty reasoning")
    return {"move": move, "why": why.strip()}


def _gold_candidates(brief_id, item):
    best = item.get("best") if isinstance(item, dict) else None
    if not isinstance(best, list) or not best:
        raise SystemExit(f"gold {brief_id} must contain a non-empty best list")
    if any(not isinstance(move, str) or not move for move in best):
        raise SystemExit(f"gold {brief_id} contains an invalid best move")
    return best


def _stratum(best, shelf):
    for move in best:
        body = shelf.get(move, "")
        match = re.search(r"^group:\s*(.+?)\s*$", body, flags=re.M)
        if match:
            return match.group(1)
    return "unclassified"


def evaluate_corpus(briefs, gold_by_id, shelf, hand_decisions=None):
    """Run the blind committee and return records with hand overrides applied."""
    if not briefs:
        raise SystemExit("refusing to validate zero briefs; corpus accuracy would be vacuous")
    if not shelf:
        raise SystemExit("refusing to validate against an empty shelf")

    brief_ids = set(briefs)
    gold_ids = set(gold_by_id)
    if brief_ids != gold_ids:
        missing_gold = sorted(brief_ids - gold_ids)
        missing_briefs = sorted(gold_ids - brief_ids)
        raise SystemExit(
            "brief/gold ids do not match: "
            f"missing gold={missing_gold}, missing briefs={missing_briefs}"
        )

    hand_decisions = {} if hand_decisions is None else dict(hand_decisions)
    unknown_decisions = sorted(set(hand_decisions) - brief_ids)
    if unknown_decisions:
        raise SystemExit(f"hand decisions name unknown briefs: {unknown_decisions}")

    validated_gold = {}
    for brief_id in sorted(briefs):
        if not isinstance(briefs[brief_id], str) or not briefs[brief_id].strip():
            raise SystemExit(f"brief {brief_id} is empty or invalid")
        candidates = _gold_candidates(brief_id, gold_by_id[brief_id])
        outside_shelf = [move for move in candidates if move not in shelf]
        if outside_shelf:
            raise SystemExit(
                f"gold {brief_id} names moves outside the shelf: {outside_shelf}"
            )
        validated_gold[brief_id] = candidates
    for brief_id, hand_decision in hand_decisions.items():
        if not isinstance(hand_decision, str) or hand_decision not in shelf:
            raise SystemExit(
                f"hand decision for {brief_id} is not an exact shelf move: "
                f"{hand_decision!r}"
            )

    records = []
    for brief_id in sorted(briefs):
        constructed_gold = validated_gold[brief_id]
        passes = [_committee_pass(briefs[brief_id], shelf) for _ in range(3)]
        counts = collections.Counter(item["move"] for item in passes)
        ranked = counts.most_common()
        committee_majority = ranked[0][0] if ranked[0][1] >= 2 else None
        unanimous = len(counts) == 1
        unanimous_agreement = unanimous and committee_majority in constructed_gold
        hand_decision = hand_decisions.get(brief_id)
        if hand_decision is not None:
            effective_gold = [hand_decision]
            final_move = hand_decision
            correct = True
        else:
            effective_gold = list(constructed_gold)
            final_move = committee_majority
            correct = committee_majority in constructed_gold

        records.append(
            {
                "brief_id": brief_id,
                "constructed_gold": list(constructed_gold),
                "effective_gold": effective_gold,
                "passes": passes,
                "committee_candidates": sorted(counts),
                "committee_majority": committee_majority,
                "unanimous_agreement": unanimous_agreement,
                "disagreement": not unanimous_agreement,
                "hand_decision": hand_decision,
                "final_move": final_move,
                "correct": correct,
                "stratum": _stratum(constructed_gold, shelf),
            }
        )

    correct_count = sum(record["correct"] for record in records)
    return {
        "records": records,
        "total": len(records),
        "correct_count": correct_count,
        "accuracy": correct_count / len(records),
        "unanimous_count": sum(
            record["unanimous_agreement"] for record in records
        ),
        "disagreement_count": sum(record["disagreement"] for record in records),
        "floor": ACCURACY_FLOOR,
    }


def _stratified_take(records, size):
    if size <= 0:
        return []
    groups = collections.defaultdict(list)
    for record in sorted(records, key=lambda item: item["brief_id"]):
        groups[record["stratum"]].append(record)

    allocation = {name: 0 for name in groups}
    if size >= len(groups):
        for name in groups:
            allocation[name] = 1

    while sum(allocation.values()) < size:
        available = [
            name for name, rows in groups.items() if allocation[name] < len(rows)
        ]
        name = min(
            available,
            key=lambda key: (
                (allocation[key] + 1) / len(groups[key]),
                key,
            ),
        )
        allocation[name] += 1

    return [
        row
        for name in sorted(groups)
        for row in groups[name][: allocation[name]]
    ]


def _matched_control(agreements, disagreement_sample):
    groups = collections.defaultdict(list)
    for record in sorted(agreements, key=lambda item: item["brief_id"]):
        groups[record["stratum"]].append(record)
    wanted = collections.Counter(record["stratum"] for record in disagreement_sample)
    selected = []
    selected_ids = set()
    for name in sorted(wanted):
        for record in groups[name][: wanted[name]]:
            selected.append(record)
            selected_ids.add(record["brief_id"])

    remaining = len(disagreement_sample) - len(selected)
    if remaining:
        pool = [
            record
            for record in agreements
            if record["brief_id"] not in selected_ids
        ]
        selected.extend(_stratified_take(pool, remaining))
    return selected


def sample_for_hand_decision(result):
    """Return deterministic disagreement and group-matched control samples."""
    disagreements = [
        record for record in result["records"] if record["disagreement"]
    ]
    agreements = [
        record for record in result["records"] if record["unanimous_agreement"]
    ]
    if not disagreements or not agreements:
        return [], []

    strata_count = len({record["stratum"] for record in disagreements})
    desired = max(strata_count, math.ceil(len(disagreements) * SAMPLE_FRACTION))
    size = min(desired, SAMPLE_CAP, len(disagreements), len(agreements))
    disagreement_sample = _stratified_take(disagreements, size)
    control_sample = _matched_control(agreements, disagreement_sample)
    return disagreement_sample, control_sample


def _reasoning_lines(record):
    return [
        f"- Pass {index}: {item['move']}, {item['why']}"
        for index, item in enumerate(record["passes"], start=1)
    ]


def render_audit(result, fixture_data=False):
    disagreement_sample, control_sample = sample_for_hand_decision(result)
    accuracy = result["accuracy"]
    status = "PASS" if accuracy >= result["floor"] else "BLOCK"
    lines = ["# Gold Audit", ""]
    if fixture_data:
        lines.extend(
            [
                "> Fixture data only. This report is a test and demonstration artifact.",
                "> The real briefs and gold corpus do not exist yet, and no external call was made.",
                "",
            ]
        )
    lines.extend(
        [
            "## Boundary",
            "",
            "The committee is not a judge of runs. It never sees any run output, run record, checkpoint, score, or anything derived from the eval grid. Each pass sees exactly one brief and the full shelf, and answers which move the brief describes. This is a reconstruction task against the corpus gold-construction process.",
            "",
            "The three passes are independent. Every pass receives an identical context built only from the brief and full shelf, with no prior pass response or accumulated state.",
            "",
            "## Corpus result",
            "",
            f"- Corpus accuracy: {accuracy:.2%} ({result['correct_count']}/{result['total']})",
            f"- Accuracy floor: {result['floor']:.2%}",
            f"- Status: {status}",
            f"- Unanimous agreement count: {result['unanimous_count']}",
            f"- Disagreement count: {result['disagreement_count']}",
            "",
            "The 95 percent floor limits uncertain labels to at most 15 of a 300-brief corpus. A 90 percent floor could admit 30 wrong briefs and contaminate 270 main-grid cells, so it is too permissive before a large paid run. Falling below the floor blocks the grid with no continue-with-caveat path.",
            "",
            "Hand decisions are authoritative. When present, a hand decision replaces both the constructed gold candidate and the committee resolution for the final corpus result.",
            "",
            "## Disagreements",
            "",
        ]
    )

    disagreements = [
        record for record in result["records"] if record["disagreement"]
    ]
    if not disagreements:
        lines.extend(["None.", ""])
    for record in disagreements:
        majority = record["committee_majority"] or "no majority"
        lines.extend(
            [
                f"### Disagreement {record['brief_id']}",
                "",
                "Constructed gold candidates: "
                + ", ".join(record["constructed_gold"]),
                "",
                "Committee candidates: "
                + ", ".join(record["committee_candidates"]),
                "",
                f"Committee majority: {majority}",
                "",
                *_reasoning_lines(record),
                "",
            ]
        )
        if record["hand_decision"] is not None:
            lines.extend(
                [
                    f"Hand decision: {record['hand_decision']} (authoritative)",
                    "",
                    f"Final move: {record['final_move']}",
                    "",
                ]
            )

    lines.extend(
        [
            "## Sampled for hand decision",
            "",
            "Disagreements are sampled deterministically by shelf group at 20 percent, with at least one per represented group when the sample size permits, capped at 30 and further bounded by the number of unanimous agreements. The control sample therefore has the same size and matches those groups where unanimous agreements are available.",
            "",
            "The control exists because checking only disagreements cannot reveal errors where the constructor and committee share the same blind spot. Such an error appears as unanimous agreement and would otherwise never be audited.",
            "",
            "### Disagreement sample",
            "",
        ]
    )
    if not disagreement_sample:
        lines.extend(["None available under the equal-size control rule.", ""])
    for record in disagreement_sample:
        decision = record["hand_decision"] or "pending"
        lines.append(
            f"- {record['brief_id']} [{record['stratum']}], hand decision: {decision}"
        )
    if disagreement_sample:
        lines.append("")

    lines.extend(["### Unanimous control sample", ""])
    if not control_sample:
        lines.extend(["None available under the equal-size control rule.", ""])
    for record in control_sample:
        decision = record["hand_decision"] or "pending"
        lines.append(
            f"- {record['brief_id']} [{record['stratum']}], hand decision: {decision}"
        )
    lines.append("")
    return "\n".join(lines)


def validate_corpus(
    briefs,
    gold_by_id,
    shelf,
    hand_decisions=None,
    audit_path=None,
    fixture_data=False,
):
    result = evaluate_corpus(briefs, gold_by_id, shelf, hand_decisions)
    report = render_audit(result, fixture_data=fixture_data)
    print(
        f"Corpus accuracy: {result['accuracy']:.2%} "
        f"({result['correct_count']}/{result['total']})"
    )
    if audit_path is not None:
        with open(audit_path, "w", encoding="utf-8") as fh:
            fh.write(report)
    if result["accuracy"] < result["floor"]:
        raise SystemExit(
            f"corpus accuracy {result['accuracy']:.2%} is below the "
            f"{result['floor']:.2%} floor; grid blocked"
        )
    return result, report


def load_corpus(briefs_dir=BRIEFS_DIR, gold_dir=GOLD_DIR):
    if not os.path.isdir(briefs_dir):
        raise SystemExit(f"briefs directory is missing: {briefs_dir}")
    if not os.path.isdir(gold_dir):
        raise SystemExit(f"gold directory is missing: {gold_dir}")

    brief_paths = sorted(glob.glob(os.path.join(briefs_dir, "*.md")))
    gold_paths = sorted(glob.glob(os.path.join(gold_dir, "*.json")))
    if not brief_paths:
        raise SystemExit(
            f"briefs directory contains zero briefs: {briefs_dir}; refusing vacuous accuracy"
        )
    if not gold_paths:
        raise SystemExit(f"gold directory contains zero gold files: {gold_dir}")

    briefs = {}
    for path in brief_paths:
        brief_id = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as fh:
            briefs[brief_id] = fh.read()

    gold_by_id = {}
    for path in gold_paths:
        brief_id = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as fh:
            try:
                gold_by_id[brief_id] = json.load(fh)
            except json.JSONDecodeError as error:
                raise SystemExit(f"invalid JSON in {path}: {error}") from None
    return briefs, gold_by_id


def main():
    briefs, gold_by_id = load_corpus()
    shelf = harness2.load_shelf()
    validate_corpus(briefs, gold_by_id, shelf, audit_path=AUDIT_PATH)


if __name__ == "__main__":
    main()
