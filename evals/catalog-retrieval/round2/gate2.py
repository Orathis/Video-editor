#!/usr/bin/env python3
"""Score one run's move selection against the hand-authored gold set.

Two numbers per run, deliberately kept apart:

  mountable  fraction of picks that name a real move on the shelf. Condition A
             has no shelf, so it scores near zero here, and that is the finding
             rather than a rigged result.
  fit        did the run choose the RIGHT move for the beat, judged against the
             gold set. Condition A's free-text picks are first mapped to their
             nearest shelf move by embedding, so A is scored on the same axis
             as everyone else instead of losing on vocabulary.

Collapsing these into one score is what makes a catalog benchmark dishonest:
the control would score zero by construction and the catalog would "win"
without ever demonstrating better judgment.
"""

import glob
import json
import os
import sys

import harness2

HERE = os.path.dirname(os.path.abspath(__file__))
GOLD_DIR = os.path.join(HERE, "gold")
# A run passes a brief when it named the gold answer and little else. With the
# f1 formula below, naming exactly the gold best scores 1.0, naming it plus one
# unrelated shelf move scores 0.67, and naming one of two gold answers scores
# 0.67, so 0.5 is the line between "found the answer" and "gestured near it".
# It is a chosen line, not a measured one; test_gate.py pins the behaviour at
# the boundary so a later change to the formula cannot move it silently.
PASS_LINE = 0.5
# Flat cost per known-wrong pick, deliberately not divided by the number of
# picks. One known-wrong pick alongside a correct one should hurt, and two
# should sink the run regardless of how much filler surrounds them.
BAD_PICK_COST = 0.5
# Below this cosine, a free-text pick is not a paraphrase of any shelf move, it
# is something the shelf does not carry. Recalibrated in test_gate2.py against
# fresh controls in a deterministic local 424-vector fixture: correct matches
# bottom out at 0.447257 and off-shelf controls top out at 0.353176. The
# separating band is 0.353176 to 0.447257, its margin is 0.094081, and the
# midpoint is the floor. A non-separating fixture blocks instead of guessing.
MATCH_FLOOR = 0.400217


def load_gold(gold_dir=GOLD_DIR):
    return {
        os.path.basename(p)[: -len(".json")]: json.load(open(p))
        for p in sorted(glob.glob(os.path.join(gold_dir, "*.json")))
    }


def acceptable(entry, brief_id="gold"):
    """Every shelf move that genuinely answers this beat.

    Gold is a set from round 4 on. A single-element set is exactly round 3's
    scalar and scores identically, which is what lets round 3's committed corpus
    keep reproducing its published numbers under the new reader.

    One definition, because six loops read this field: the two recall loops, the
    sweep, the report builder, the committee and the scorer. When they each did
    their own reading, a record could be acceptable to one of them and not to
    the next, and nothing in the eval would have said so.

    A move listed as both acceptable and known-wrong is refused here rather than
    scored twice, once as the answer and once as the trap. Which of the two
    readings won would otherwise depend on which loop reached the record first,
    and the known-wrong-pick rate is one of the two numbers the paid stage
    exists to measure.

    ValueError, not SystemExit: the sweep treats SystemExit from an arm as "this
    arm has no index and cannot run", so a schema error raised that way would be
    swallowed and reported as a missing arm.
    """
    best = entry.get("best") if isinstance(entry, dict) else None
    if not isinstance(best, list) or not best:
        raise ValueError(f"gold {brief_id} must contain a non-empty best list")
    if any(not isinstance(move, str) or not move for move in best):
        raise ValueError(f"gold {brief_id} contains an invalid best move")
    both = sorted(set(best) & set(entry.get("bad") or []))
    if both:
        raise ValueError(
            f"gold {brief_id} lists {', '.join(both)} as both acceptable and "
            "known-wrong; one record cannot score a move both ways"
        )
    return best


def cluster_key(entry, fallback):
    """The clustering key for one gold record: its sorted acceptable set.

    Round 3 clustered on `best[0]`, which a set leaves undefined. Two briefs
    whose right answers are the same near-twin pair are correlated in exactly
    the way clustering exists to absorb, so they share one key. A single-element
    set hands back that one move, so every round 3 cluster is unchanged.

    A record naming no move clusters with itself rather than merging every such
    record into one.
    """
    best = entry.get("best") if isinstance(entry, dict) else None
    return tuple(sorted(best)) if best else (fallback,)


def _cos(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    return dot / ((sum(x * x for x in a) ** 0.5) * (sum(x * x for x in b) ** 0.5))


def _nearest(vector, moves):
    ranked = sorted(((_cos(vector, candidate), name) for name, candidate in moves.items()), reverse=True)
    if not ranked:
        raise ValueError("cannot resolve against an empty vector shelf")
    best_score = ranked[0][0]
    tied = [name for score, name in ranked if abs(score - best_score) <= 1e-12]
    return best_score, tied[0] if len(tied) == 1 else None


def calibrate_match_floor(vectors, correct_samples, off_shelf_samples):
    """Return a measured separating band, or block if the controls overlap."""
    moves = vectors["moves"]
    controls = vectors["control_samples"]
    if not correct_samples or not off_shelf_samples:
        raise ValueError("BLOCKED calibration requires correct and off-shelf controls")

    correct_scores = []
    for sample, expected in correct_samples.items():
        score, resolved = _nearest(controls[sample], moves)
        if resolved != expected:
            raise ValueError(
                f"BLOCKED calibration control {sample!r} resolved to {resolved!r}, expected {expected!r}"
            )
        correct_scores.append(score)

    off_shelf_scores = [_nearest(controls[sample], moves)[0] for sample in off_shelf_samples]
    correct_min = min(correct_scores)
    off_shelf_max = max(off_shelf_scores)
    margin = correct_min - off_shelf_max
    if margin <= 0.0:
        raise ValueError(
            "BLOCKED non-separating calibration band: "
            f"off-shelf max {off_shelf_max:.6f}, correct min {correct_min:.6f}, margin {margin:.6f}"
        )
    return {
        "off_shelf_max": off_shelf_max,
        "correct_min": correct_min,
        "margin": margin,
        "floor": (off_shelf_max + correct_min) / 2,
    }


def _name_key(name):
    return "".join(character for character in name.casefold() if character.isalnum())


def resolve(pick, shelf, vectors=None, pick_vector=None):
    """-> (move name or None, how). Exact name first, embedding fallback."""
    name = pick.strip()
    # Case and surrounding whitespace are transcription noise, not judgment. A
    # run that says "Grade-Split-Reveal" picked the right move.
    folded = [candidate for candidate in shelf if candidate.casefold() == name.casefold()]
    if len(folded) == 1:
        return folded[0], "exact"
    if len(folded) > 1:
        return None, "ambiguous"

    # Punctuation drift is also transcription noise, but only when it identifies
    # one move. A normalized collision is ambiguous and must not pick a winner.
    key = _name_key(name)
    normalized = [candidate for candidate in shelf if key and _name_key(candidate) == key]
    if len(normalized) == 1:
        return normalized[0], "exact"
    if len(normalized) > 1:
        return None, "ambiguous"

    if pick_vector is not None and vectors is not None:
        score, nearest = _nearest(pick_vector, vectors["moves"])
        if score >= MATCH_FLOOR:
            if nearest is None:
                return None, "ambiguous"
            return nearest, f"nearest:{score:.2f}"
    return None, "unmatched"


def score(brief_id, picks, gold, shelf, vectors=None, pick_vectors=None):
    """picks: list of move names (or free-text descriptions for condition A)."""
    g = gold[brief_id]
    best, bad = set(acceptable(g, brief_id)), set(g["bad"])

    resolved, notes = [], []
    for i, p in enumerate(picks):
        pv = pick_vectors[i] if pick_vectors else None
        move, how = resolve(p, shelf, vectors, pv)
        resolved.append(move)
        notes.append({"pick": p, "resolved": move, "how": how})

    exact = sum(1 for n in notes if n["how"] == "exact")
    mountable = exact / len(picks) if picks else 0.0

    chosen = [m for m in resolved if m]
    if not chosen:
        # Nothing the run named corresponds to anything on the shelf. That is a
        # real zero on fit, not a parsing artifact, so say which it was.
        return {
            "brief": brief_id,
            "mountable": mountable,
            "fit": 0.0,
            "passed": False,
            "reason": "no pick resolved to a shelf move",
            "picks": notes,
        }

    got = set(chosen)
    right = best & got
    wrong = bad & got

    # Precision matters as much as recall, because the earlier recall-only
    # formula could be beaten by naming the entire shelf: recall went to 1.0
    # while a per-pick penalty divided by the list length shrank to nothing, so
    # "name all 25" scored 0.92 and passed on every brief. Padding now costs
    # precision, and each known-wrong pick costs a flat amount that list length
    # cannot dilute.
    precision = len(right) / len(chosen)
    recall = len(right) / len(best)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    penalty = BAD_PICK_COST * len(wrong)
    fit = max(0.0, min(1.0, f1 - penalty))

    reasons = []
    if right:
        reasons.append("found " + ",".join(sorted(right)))
    if wrong:
        reasons.append("picked known-wrong " + ",".join(sorted(wrong)))
    if len(chosen) > len(best) + 1:
        reasons.append(f"named {len(chosen)} moves for {len(best)} needed")
    if not reasons:
        reasons.append("picked shelf moves, none of them the gold answer")

    return {
        "brief": brief_id,
        "mountable": mountable,
        "fit": round(fit, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "passed": fit >= PASS_LINE,
        "reason": "; ".join(reasons),
        "picks": notes,
    }


def main():
    shelf = harness2.load_shelf()
    gold = load_gold()
    vectors = json.load(open(harness2.VECTORS)) if os.path.exists(harness2.VECTORS) else None

    runs = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else None
    if runs is None:
        print("usage: gate2.py runs.json")
        return 2
    for r in runs:
        out = score(r["brief"], [p["move"] for p in r["picks"]], gold, shelf, vectors, r.get("pick_vectors"))
        print(json.dumps({**out, "condition": r["condition"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
