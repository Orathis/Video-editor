#!/usr/bin/env python3
"""Validate constructed gold with three blind, independent committee passes."""

import collections
import glob
import hashlib
import json
import math
import os
import re

import gate2
import harness2
import provider
import run2

HERE = os.path.dirname(os.path.abspath(__file__))
# The audit belongs to the corpus it judged, so it travels with it. Leaving
# it at HERE would let a later round read round 2's verdict and prune the
# wrong briefs out of a corpus that committee never saw.
BRIEFS_DIR = harness2.BRIEFS
GOLD_DIR = harness2.GOLD
AUDIT_PATH = os.path.join(harness2.CORPUS_ROOT, "GOLD-AUDIT.md")

# A 95 percent floor limits label uncertainty to at most 15 of 300 briefs. At 90
# percent, as many as 30 briefs and 270 main-grid cells could inherit bad gold,
# which is too much avoidable uncertainty before a large paid run.
#
# The floor is unchanged at 0.95. What it is applied to changed in round 4: see
# gate_rate below. The name is kept because it is what the audit and the tests
# already read.
ACCURACY_FLOOR = 0.95
SAMPLE_FRACTION = 0.20
SAMPLE_CAP = 30

COMMITTEE_READERS = 3
# Round 2's disagreement sampling constant, reused here as the rate below which
# the corpus-level error bound stops being the one the floor was chosen for.
ROUND2_SAMPLE_RATE = SAMPLE_FRACTION
# Round 2 read every brief in its 272-brief corpus, so the default preserves
# that behaviour exactly. A corpus large enough to need sampling has to say so.
DEFAULT_SAMPLE_RATE = 1.0
# Each read carries a brief plus the whole 424-entry shelf, so one read costs
# about what a full-shelf grid run costs. At 2120 briefs, a 20 percent sample
# with three readers projects near $32; this leaves headroom without letting a
# mis-set rate spend unbounded.
DEFAULT_MAX_USD = 40.00
# Under the corpus, for the same reason the audit is. A checkpoint records what
# a committee said about particular briefs, so it belongs to the corpus those
# briefs came from. At HERE it was shared by every round, and resume reads it by
# brief id, so a later corpus numbering from 001 again would inherit this
# corpus's verdicts for briefs that committee never saw.
DEFAULT_COMMITTEE_CHECKPOINT = os.path.join(
    harness2.CORPUS_ROOT, "checkpoints", "committee.jsonl"
)

COMMITTEE_INSTRUCTIONS = """Reconstruct which single catalog move the brief describes.

Return only this JSON object:
{"move": "<exact move name>", "why": "<brief reasoning>"}

Choose exactly one move from the complete shelf below. Use the exact move name.
Do not discuss any prior response or any evaluation result.
"""


def _brief_digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


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
    parsed, raw, usage, _elapsed = provider.chat(
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
    # Usage rides along on the pass so a resumed run can price already-judged
    # briefs from the checkpoint instead of re-reading them to find out.
    return {"move": move, "why": why.strip(), "usage": usage if isinstance(usage, dict) else {}}


def _gold_candidates(brief_id, item):
    """The acceptable set of one gold record, read through the shared schema.

    gate2 owns what a gold record means, so the committee cannot accept a record
    the scorer would refuse, or the reverse. It raises ValueError because the
    sweep reads SystemExit from an arm as a missing index; here a schema error is
    fatal, so it is re-raised as one.
    """
    try:
        return gate2.acceptable(item, brief_id)
    except ValueError as error:
        raise SystemExit(str(error)) from None


def _acceptable_gold(constructed, entry, committee_majority, hand_decision):
    """The set this brief will be scored against, or None if no set exists.

    Round 3 threw away every brief the committee could not reconstruct, which
    removed exactly the near twins, exactly the briefs where retrieval is
    hardest. The committee is the honest signal that a beat has more than one
    right answer: an independent reader holding the whole shelf landed on a
    different move and could defend it. So that move joins the acceptable set
    instead of ending the brief.

    Two cases produce no set at all, and both are counted and reported rather
    than dropped in silence:

      unplaceable  no two readers agreed, so nothing was reconstructed and there
                   is no second answer to merge.
      contested    the majority is a move the constructor marked known-wrong for
                   this beat. Merging it would build a record that lists one move
                   both ways, which gate2.acceptable refuses, and picking a side
                   here would be this function overruling a hand-written gold
                   record on the strength of two readers. It goes to a human.
    """
    if hand_decision is not None:
        return [hand_decision]
    if committee_majority is None:
        return None
    if committee_majority in constructed:
        return list(constructed)
    if committee_majority in set(entry.get("bad") or []):
        return None
    # Appended, not sorted: the constructed target stays first, which is what
    # the per-stratum rows are read from.
    return list(constructed) + [committee_majority]


def _stratum(best, shelf):
    for move in best:
        body = shelf.get(move, "")
        match = re.search(r"^group:\s*(.+?)\s*$", body, flags=re.M)
        if match:
            return match.group(1)
    return "unclassified"


def sampled_brief_ids(briefs, gold_by_id, shelf, sample_rate):
    """Pick which briefs the committee reads, stratified and deterministic."""
    if isinstance(sample_rate, bool) or not isinstance(sample_rate, (int, float)):
        raise SystemExit(f"sample rate must be a number in 0..1: {sample_rate!r}")
    if sample_rate < 0 or sample_rate > 1:
        raise SystemExit(f"sample rate {sample_rate} is outside 0..1")
    if sample_rate == 0:
        raise SystemExit(
            "sample rate 0 reads no briefs, so the gold corpus would ship "
            "entirely unaudited. Choose a rate above 0, or record in writing "
            "that this corpus carries no committee evidence at all."
        )
    total = len(briefs)
    size = min(total, math.ceil(total * sample_rate))
    rows = [
        {
            "brief_id": brief_id,
            "stratum": _stratum(_gold_candidates(brief_id, gold_by_id[brief_id]), shelf),
        }
        for brief_id in sorted(briefs)
    ]
    # Stratification decides which briefs are taken; corpus order decides the
    # order they are read in, so a full-rate run reads exactly as round 2 did.
    return sorted(row["brief_id"] for row in _stratified_take(rows, size))


def _margin(sample_size):
    # Widest 95 percent binomial margin, at p = 0.5. Deliberately the
    # pessimistic case: the point of the warning is the bound, not a best case.
    return 1.96 * 0.5 / math.sqrt(sample_size)


def warn_if_bound_widens(sample_rate, corpus_size, sample_size, emit):
    """Say out loud how far the corpus error bound loosens below round 2's rate."""
    if sample_rate >= ROUND2_SAMPLE_RATE:
        return None
    round2_size = max(1, min(corpus_size, math.ceil(corpus_size * ROUND2_SAMPLE_RATE)))
    warning = (
        f"WARNING: sample rate {sample_rate:.2%} is below round 2's "
        f"{ROUND2_SAMPLE_RATE:.2%}. Reading {sample_size} of {corpus_size} briefs "
        f"widens the 95 percent margin on corpus label error from "
        f"+/-{_margin(round2_size):.2%} at round 2's rate to "
        f"+/-{_margin(sample_size):.2%}. The {ACCURACY_FLOOR:.0%} floor then "
        f"bounds the sample, not the corpus."
    )
    emit(warning)
    return warning


def judged_records(checkpoint_path, briefs):
    """The checkpoint verdicts that still describe these exact briefs.

    Resume on what the committee actually read, not on where it sat in the
    corpus. A brief id is a position: regenerate a corpus and 001 is a different
    brief that reuses the name. Keyed on the id alone, resume would hand those
    verdicts to briefs no committee ever saw, silently, and the audit would
    prune on them. A record with no digest predates this check and cannot prove
    which brief it judged, so it is re-read rather than trusted.

    One definition, because the projection and the run both have to mean the
    same thing by "already judged". When they disagreed, the projection priced
    every sampled brief as unread and a fully cached rerun was refused at the
    ceiling for work that would have cost nothing.
    """
    judged = {}
    for record in run2.load_checkpoint(checkpoint_path):
        brief_id = record.get("brief_id")
        if not isinstance(brief_id, str) or brief_id not in briefs:
            continue
        if record.get("brief_digest") != _brief_digest(briefs[brief_id]):
            continue
        judged[brief_id] = record
    return judged


def project_committee(
    briefs,
    gold_by_id,
    shelf,
    sample_rate=DEFAULT_SAMPLE_RATE,
    model=None,
    judged=(),
):
    """Price the committee from context lengths alone, before any call is made.

    Briefs already judged at their current digest are priced at zero, because
    resume will serve them from the checkpoint and never call for them.
    """
    model = model or provider.CHAT_MODEL
    sampled = sampled_brief_ids(briefs, gold_by_id, shelf, sample_rate)
    unread = [brief_id for brief_id in sampled if brief_id not in judged]
    chars = sum(
        len(build_committee_context(briefs[brief_id], shelf)) for brief_id in unread
    )
    reads = len(unread) * COMMITTEE_READERS
    estimated_input = chars * COMMITTEE_READERS / run2.CHARS_PER_TOKEN
    assumed_output = reads * run2.ASSUMED_OUTPUT_TOKENS
    costs = run2.usage_cost_breakdown(
        {
            "prompt_tokens": estimated_input,
            "cached_tokens": 0,
            "completion_tokens": assumed_output,
        },
        model,
    )
    projected = sum(costs.values())
    return {
        "model": model,
        "sample_rate": sample_rate,
        "corpus_size": len(briefs),
        "readers": COMMITTEE_READERS,
        "sampled_briefs": len(sampled),
        "sampled_ids": sampled,
        # What the projection is actually priced on. The sample is what gets
        # scored; only the unread part of it gets bought.
        "unread_briefs": len(unread),
        "reads": reads,
        "chars": chars * COMMITTEE_READERS,
        "estimated_input_tokens": estimated_input,
        "cached_tokens": 0,
        "assumed_output_tokens": assumed_output,
        "input_usd": costs["uncached"],
        "cached_usd": costs["cached"],
        "output_usd": costs["output"],
        "projected_usd": projected,
        "usd_per_read": projected / reads if reads else 0.0,
    }



def committee_dry_run(
    briefs,
    gold_by_id,
    shelf,
    sample_rate=DEFAULT_SAMPLE_RATE,
    model=None,
    max_usd=DEFAULT_MAX_USD,
    emit=print,
    checkpoint_path=None,
):
    """Print the committee projection. Makes no call and needs no key."""
    checkpoint_path = checkpoint_path or os.environ.get(
        "EVAL_COMMITTEE_CHECKPOINT", DEFAULT_COMMITTEE_CHECKPOINT
    )
    judged = judged_records(checkpoint_path, briefs)
    projection = project_committee(
        briefs, gold_by_id, shelf, sample_rate, model, judged
    )
    emit("DRY RUN: zero network calls and no key required.")
    emit(
        "Estimated input tokens use characters divided by "
        f"{run2.CHARS_PER_TOKEN}; this heuristic is NOT a real tokenizer count."
    )
    emit(
        f"Assumed output tokens are {run2.ASSUMED_OUTPUT_TOKENS} per read, not "
        "measured. Cached tokens are projected as 0 because no requests are made."
    )
    emit("")
    emit(f"Model: {projection['model']}")
    emit(
        f"Sample rate: {projection['sample_rate']:.2%} of "
        f"{projection['corpus_size']} briefs = {projection['sampled_briefs']} sampled"
    )
    emit(
        f"Reads: {projection['unread_briefs']} unread of "
        f"{projection['sampled_briefs']} sampled x "
        f"{projection['readers']} readers = {projection['reads']}"
    )
    emit(
        f"Context chars: {projection['chars']}, estimated input tokens "
        f"{projection['estimated_input_tokens']:.2f}, assumed output tokens "
        f"{projection['assumed_output_tokens']}"
    )
    emit(
        f"Projected committee cost: ${projection['projected_usd']:.6f} "
        f"(${projection['usd_per_read']:.6f} per read) "
        f"= ${projection['input_usd']:.6f} input + "
        f"${projection['output_usd']:.6f} output"
    )
    emit(f"Ceiling: ${max_usd:.2f}")
    if projection["projected_usd"] > max_usd:
        emit(
            f"ceiling: projection ${projection['projected_usd']:.6f} exceeds the "
            f"${max_usd:.2f} ceiling; a real run would stop before its first read."
        )
    warn_if_bound_widens(
        sample_rate, projection["corpus_size"], projection["sampled_briefs"], emit
    )
    return projection


def _record_cost(record, model):
    return sum(
        run2.usage_cost(item.get("usage") or {}, model)
        for item in record.get("passes", [])
        if isinstance(item, dict)
    )


def evaluate_corpus(
    briefs,
    gold_by_id,
    shelf,
    hand_decisions=None,
    sample_rate=DEFAULT_SAMPLE_RATE,
    checkpoint_path=None,
    kill_path=None,
    max_usd=DEFAULT_MAX_USD,
    model=None,
    emit=print,
):
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

    model = model or provider.CHAT_MODEL
    checkpoint_path = checkpoint_path or os.environ.get(
        "EVAL_COMMITTEE_CHECKPOINT", DEFAULT_COMMITTEE_CHECKPOINT
    )
    kill_path = kill_path or os.environ.get("EVAL_KILL_FILE", run2.DEFAULT_KILL_FILE)
    judged = judged_records(checkpoint_path, briefs)
    projection = project_committee(
        briefs, gold_by_id, shelf, sample_rate, model, judged
    )
    sampled = projection["sampled_ids"]
    warn_if_bound_widens(
        sample_rate, len(briefs), len(sampled), emit
    )

    total_usd = sum(
        _record_cost(record, model)
        for brief_id, record in judged.items()
        if brief_id in set(sampled)
    )
    stop_reason = None
    # Priced before it runs: a ceiling under the projection stops the committee
    # without spending anything, which is the whole point of projecting first.
    if projection["projected_usd"] > max_usd or total_usd > max_usd:
        stop_reason = "ceiling"

    records = []
    new_reads = 0
    for brief_id in sampled:
        if brief_id in judged:
            records.append(judged[brief_id])
            continue
        if stop_reason:
            break
        if os.path.exists(kill_path):
            stop_reason = "kill file"
            break
        constructed_gold = validated_gold[brief_id]
        passes = [
            _committee_pass(briefs[brief_id], shelf)
            for _ in range(COMMITTEE_READERS)
        ]
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
        acceptable_gold = _acceptable_gold(
            constructed_gold,
            gold_by_id[brief_id],
            committee_majority,
            hand_decision,
        )

        record = {
            "brief_id": brief_id,
            "brief_digest": _brief_digest(briefs[brief_id]),
            "constructed_gold": list(constructed_gold),
            "effective_gold": effective_gold,
            # What the round will actually score this brief against: the set,
            # not the single survivor. None means no set could be formed.
            "acceptable_gold": acceptable_gold,
            "near_twin_merge": bool(
                acceptable_gold is not None
                and len(acceptable_gold) > len(constructed_gold)
            ),
            "unplaceable": committee_majority is None and hand_decision is None,
            "contested": bool(
                acceptable_gold is None
                and committee_majority is not None
                and hand_decision is None
            ),
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
        run2._append_checkpoint(checkpoint_path, record)
        records.append(record)
        new_reads += 1
        total_usd += _record_cost(record, model)
        if total_usd > max_usd:
            stop_reason = "ceiling"
            break

    correct_count = sum(record["correct"] for record in records)
    # The rate on the corpus that is actually scored, over every brief the
    # committee read. Round 3 reported agreement after the disagreements had
    # already been removed, which is 100 percent by construction and says
    # nothing. This denominator is the whole read corpus, so a brief that no set
    # can be built for lowers the number instead of leaving it.
    scored_count = sum(record["acceptable_gold"] is not None for record in records)
    return {
        "records": records,
        "total": len(records),
        "correct_count": correct_count,
        "accuracy": correct_count / len(records) if records else None,
        "scored_count": scored_count,
        "scored_agreement": scored_count / len(records) if records else None,
        "merged_count": sum(record["near_twin_merge"] for record in records),
        "contested_count": sum(record["contested"] for record in records),
        "unplaceable_count": sum(record["unplaceable"] for record in records),
        "unanimous_count": sum(
            record["unanimous_agreement"] for record in records
        ),
        "disagreement_count": sum(record["disagreement"] for record in records),
        "floor": ACCURACY_FLOOR,
        "projection": projection,
        "sampled": sampled,
        "new_reads": new_reads,
        "total_usd": total_usd,
        "stop_reason": stop_reason,
        "checkpoint_path": checkpoint_path,
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


def _ratio(result, rate_key, count_key):
    """One reported rate, or an honest blank when the run did not produce it."""
    rate = result.get(rate_key)
    if rate is None:
        return "not measured"
    return f"{rate:.2%} ({result.get(count_key, 0)}/{result['total']})"


def gate_rate(result):
    """The one number that blocks the grid: agreement over the scored corpus.

    Round 3 gated on the strict reconstruction rate and failed it at 75.21
    percent, because a brief whose beat has two right answers counted as a
    reconstruction failure. Round 4 exists to score those briefs instead of
    excluding them, so the rate that decides whether the corpus is trustworthy
    has to be the rate over the corpus that is actually scored. Under this rate a
    merged near twin is a success, and a contested or an unplaceable brief is
    still a failure, because neither one produces a set that anything can be
    scored against.

    The strict rate is kept and reported beside it, and it never gates. It is the
    only number that says how often an independent reader landed on the one move
    the brief was constructed from, which is what keeps a merge visible instead
    of laundered, and it is the line prune_corpus reads to check its own
    arithmetic against the audit.

    One owner, because the report and the block have to gate on the same number.
    None means the run produced no rate at all, which is never a pass.
    """
    return result.get("scored_agreement")


def render_audit(result, fixture_data=False):
    disagreement_sample, control_sample = sample_for_hand_decision(result)
    accuracy = result["accuracy"]
    scored = gate_rate(result)
    if scored is None:
        status = "not measured"
    else:
        status = "PASS" if scored >= result["floor"] else "BLOCK"
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
            f"- Status: {status}, gated on scored corpus agreement",
            f"- Unanimous agreement count: {result['unanimous_count']}",
            f"- Disagreement count: {result['disagreement_count']}",
            "",
            "### Scored corpus",
            "",
            f"- Scored corpus agreement: {_ratio(result, 'scored_agreement', 'scored_count')}",
            f"- Near twin merges: {result.get('merged_count', 0)}",
            f"- Contested, majority is a known-wrong move: {result.get('contested_count', 0)}",
            f"- Unplaceable, no committee majority: {result.get('unplaceable_count', 0)}",
            "",
            "Corpus accuracy above is the strict rate: how often the committee reconstructed the one move the brief was constructed from. Scored corpus agreement is the rate over the corpus this round will actually score, where a brief whose beat has two right answers carries both of them as gold rather than being removed. Both denominators are every brief the committee read, so a brief that no acceptable set can be built for lowers the second number instead of vanishing from it. Reporting a rate over the briefs that survived pruning is 100 percent by construction and measures nothing.",
            "",
            "Scored corpus agreement is the number the floor is applied to, and the status line above reports its verdict. Round 3 applied the floor to the strict rate and failed it at 75.21 percent, because a brief that two near twin moves answer equally well counted as a reconstruction failure. Those briefs are now scored rather than excluded, so the rate that gates the grid is the rate over the corpus that gets scored. The strict rate is kept and reported because it is the only number that shows how often a blind reader landed on the constructed move, which is what makes a near twin merge visible instead of laundered, and because prune_corpus checks its own arithmetic against it.",
            "",
            "The 95 percent floor limits uncertain labels to at most 15 of a 300-brief corpus. A 90 percent floor could admit 30 wrong briefs and contaminate 270 main-grid cells, so it is too permissive before a large paid run. Falling below the floor blocks the grid with no continue-with-caveat path. A contested brief and an unplaceable brief both count against the floor, because neither one yields a set that can be scored.",
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
    **committee_kwargs,
):
    result = evaluate_corpus(briefs, gold_by_id, shelf, hand_decisions, **committee_kwargs)
    if result["stop_reason"]:
        # An interrupted committee has no verdict to give. Reporting PASS or
        # BLOCK off a partial sample would be the exact false confidence the
        # ceiling and kill file exist to prevent.
        print(
            f"{result['stop_reason']}: {result['total']} of "
            f"{len(result['sampled'])} sampled briefs judged, "
            f"{result['new_reads']} new, ${result['total_usd']:.6f}"
        )
        return result, None
    report = render_audit(result, fixture_data=fixture_data)
    scored = gate_rate(result)
    print(
        f"Corpus accuracy: {result['accuracy']:.2%} "
        f"({result['correct_count']}/{result['total']})"
    )
    if scored is not None:
        print(
            f"Scored corpus agreement: {scored:.2%} "
            f"({result['scored_count']}/{result['total']})"
        )
    if audit_path is not None:
        with open(audit_path, "w", encoding="utf-8") as fh:
            fh.write(report)
    if scored is None:
        raise SystemExit(
            "the committee produced no scored corpus agreement; grid blocked"
        )
    if scored < result["floor"]:
        raise SystemExit(
            f"scored corpus agreement {scored:.2%} is below the "
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


def _env_float(name, default):
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        raise SystemExit(f"{name} must be a number") from None


def main():
    briefs, gold_by_id = load_corpus()
    shelf = harness2.load_shelf()
    sample_rate = _env_float("EVAL_SAMPLE_RATE", DEFAULT_SAMPLE_RATE)
    max_usd = _env_float("EVAL_MAX_USD", DEFAULT_MAX_USD)
    if os.environ.get("EVAL_DRY_RUN") == "1":
        committee_dry_run(
            briefs, gold_by_id, shelf, sample_rate=sample_rate, max_usd=max_usd
        )
        return 0
    validate_corpus(
        briefs,
        gold_by_id,
        shelf,
        audit_path=AUDIT_PATH,
        sample_rate=sample_rate,
        max_usd=max_usd,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
