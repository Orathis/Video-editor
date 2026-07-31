#!/usr/bin/env python3
"""Prove the gate separates a good selection from a bad one before trusting it.

The load-bearing ported check is the condition-A output that names no shelf move
at all but must still produce a meaningful score. A gate that structurally cannot
score the control has rigged the benchmark in favor of the catalog.
"""

import hashlib
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import gate2 as gate
import harness

shelf = harness.load_shelf()
gold = gate.load_gold(os.path.join(os.path.dirname(HERE), "gold"))
vectors = json.load(open(harness.VECTORS)) if os.path.exists(harness.VECTORS) else None
round2_shelf = tuple(
    line.removeprefix("### ").strip()
    for line in open(os.path.join(HERE, "shelf.md"))
    if line.startswith("### ")
)

FRESH_CORRECT_SAMPLES = {
    "animated-bar-chart": "grow a compact set of bars deterministically and label each value inside a data card",
    "decline-chart": "draw a metric line downward while its number falls and the background gets darker",
    "flowchart-vertical": "animate a portrait decision tree with connected sticky notes and a cursor fixing typed text",
    "focus-blur-resolve": "pull heavy blur into crisp readable text before softly blurring it out again",
    "code-shader-dissolve": "use a fragment shader and seeded chromatic noise to compile source code into a crisp view",
    "screen-flow-carousel": "move several application screens along a horizontal rail with the centered screen prominent",
    "cursor-glyph-trail": "leave little dithered glyph stamps behind a moving cursor and decay them in place",
    "parallax-device-dive": "raise a phone, push the camera through its screen, and expand the layered interface to fill frame",
    "shared-axis-y": "swap words with a vertical shared-axis transition",
}
FRESH_OFF_SHELF_SAMPLES = {
    "clay": "a stop motion clay character kneads bread dough on a miniature kitchen counter",
    "water": "an underwater wildlife shot follows a coral reef shark through natural ocean currents",
    "ceramic": "a ceramic vase spins on a pottery wheel while hands shape wet clay",
    "weather": "a live weather radar tracks an approaching thunderstorm with geographic precipitation bands",
    "cooking": "an overhead cooking demonstration dices onions and sautés them in a cast iron pan",
}


def _fixture_vector(seed, dimensions=64):
    digest = hashlib.sha256(seed.encode()).digest()
    rng = random.Random(int.from_bytes(digest[:8], "big"))
    values = [rng.gauss(0.0, 1.0) for _ in range(dimensions)]
    length = math.sqrt(sum(value * value for value in values))
    return [value / length for value in values]


def _unit(values):
    length = math.sqrt(sum(value * value for value in values))
    return [value / length for value in values]


def calibration_fixture():
    """A deterministic 424-vector space with noisy, independently worded controls."""
    moves = {name: _fixture_vector("move:" + name) for name in round2_shelf}
    controls = {}
    for target, text in FRESH_CORRECT_SAMPLES.items():
        target_vector = moves[target]
        noise = _fixture_vector("sample:" + text)
        controls[target] = _unit(
            [0.4 * known + 0.6 * unknown for known, unknown in zip(target_vector, noise)]
        )
    controls.update(
        {
            key: _fixture_vector("sample:" + text)
            for key, text in FRESH_OFF_SHELF_SAMPLES.items()
        }
    )
    return {"model": "deterministic-local-fixture", "moves": moves, "control_samples": controls}


def check_gold_best_passes():
    for b, g in gold.items():
        r = gate.score(b, g["best"], gold, shelf)
        assert r["passed"], f"brief {b}: gold best scored {r['fit']}, below the pass line"
        assert r["mountable"] == 1.0, f"brief {b}: gold best should be fully mountable"


def check_gold_bad_fails():
    for b, g in gold.items():
        r = gate.score(b, g["bad"], gold, shelf)
        assert not r["passed"], f"brief {b}: gold bad scored {r['fit']}, at or above the pass line"


def check_hallucinated_name_is_unmountable():
    r = gate.score("01", ["totally-invented-move"], gold, shelf)
    assert r["mountable"] == 0.0, r
    assert r["fit"] == 0.0, r
    assert "no pick resolved" in r["reason"], r


def check_mixed_selection_is_penalized():
    """One right answer plus one known-wrong scores below one right answer alone."""
    g = gold["04"]
    clean = gate.score("04", g["best"], gold, shelf)
    dirty = gate.score("04", g["best"] + g["bad"][:1], gold, shelf)
    assert dirty["fit"] < clean["fit"], (clean, dirty)
    assert "known-wrong" in dirty["reason"], dirty


def check_shelf_move_that_is_neither_scores_zero_but_mounts():
    """Picking a real move that is neither gold-best nor gold-bad: mountable, unfit."""
    g = gold["02"]
    neutral = [n for n in shelf if n not in g["best"] and n not in g["bad"]][0]
    r = gate.score("02", [neutral], gold, shelf)
    assert r["mountable"] == 1.0, r
    assert r["fit"] == 0.0 and not r["passed"], r
    assert "none of them the gold answer" in r["reason"], r


def check_control_output_is_scorable():
    """The one that matters: free text naming no shelf move must still score.

    Condition A cannot name shelf moves because it never saw the shelf. If the
    gate can only score exact names, A is zero by construction and the whole
    comparison is worthless. With vectors present, A's descriptions resolve to
    their nearest shelf move and get judged on the same fit axis.
    """
    if vectors is None:
        print("SKIP control-output check: vectors.json not present")
        return
    samples = json.load(open(os.path.join(harness.HERE, "control_samples.json")))
    # Real embeddings of director-voice descriptions, not the shelf's own words.
    # Feeding a shelf move's own vector back in would make this tautological.
    for key, brief_id in (("01_good", "01"), ("04_good", "04"), ("05_good", "05")):
        r = gate.score(brief_id, [samples[key]], gold, shelf, vectors, [vectors["control_samples"][key]])
        assert r["mountable"] == 0.0, f"{key}: free text should not count as mountable: {r}"
        assert r["fit"] > 0.0, f"{key}: description of the gold move earned no fit: {r}"
        assert r["picks"][0]["how"].startswith("nearest"), r


def check_off_shelf_description_stays_unmatched():
    """The floor must reject things the shelf genuinely does not carry."""
    if vectors is None:
        print("SKIP off-shelf check: vectors.json not present")
        return
    samples = json.load(open(os.path.join(harness.HERE, "control_samples.json")))
    for key in ("offshelf", "offshelf2"):
        r = gate.score("01", [samples[key]], gold, shelf, vectors, [vectors["control_samples"][key]])
        assert r["fit"] == 0.0, f"{key} resolved to a shelf move it should not: {r}"
        assert r["picks"][0]["how"] == "unmatched", r


def check_naming_whole_shelf_fails():
    """The exploit that broke the first formula: recall 1.0 by brute force.

    Naming every move on the shelf guarantees the gold answer is in the list.
    If that passes, conditions that can see move names beat the control without
    demonstrating any judgment, which is exactly the rigging this gate exists to
    prevent.
    """
    for b in gold:
        r = gate.score(b, list(shelf), gold, shelf)
        assert not r["passed"], f"brief {b}: naming all 25 moves passed with fit {r['fit']}"


def check_padding_costs_precision():
    """Adding filler around a correct pick must lower the score, not preserve it."""
    g = gold["02"]
    filler = [n for n in shelf if n not in g["best"] and n not in g["bad"]][:3]
    clean = gate.score("02", g["best"], gold, shelf)
    padded = gate.score("02", g["best"] + filler, gold, shelf)
    assert padded["fit"] < clean["fit"], (clean["fit"], padded["fit"])


def check_case_and_whitespace_are_not_judgment():
    r = gate.score("02", ["  Grade-Split-Reveal  "], gold, shelf)
    assert r["mountable"] == 1.0 and r["passed"], r


def check_pass_line_boundary_is_pinned():
    """Pin the two boundary shapes so a formula change cannot move them silently."""
    # One of two gold answers, nothing else: partial credit, still a pass.
    assert gate.score("05", ["focus-rack"], gold, shelf)["fit"] == 0.6667
    # The gold answer plus one known-wrong: below the line.
    g = gold["04"]
    assert not gate.score("04", g["best"] + g["bad"][:1], gold, shelf)["passed"]


PORTED_CHECKS = (
    ("1. gold best passes", check_gold_best_passes),
    ("2. gold bad fails", check_gold_bad_fails),
    ("3. hallucinated name is unmountable and unfit", check_hallucinated_name_is_unmountable),
    ("4. mixed selection is penalized", check_mixed_selection_is_penalized),
    ("5. neutral shelf move mounts but does not fit", check_shelf_move_that_is_neither_scores_zero_but_mounts),
    ("6. control output with no shelf names is still scorable", check_control_output_is_scorable),
    ("7. off-shelf description stays unmatched", check_off_shelf_description_stays_unmatched),
    ("8. naming the whole shelf fails every brief", check_naming_whole_shelf_fails),
    ("9. padding costs precision", check_padding_costs_precision),
    ("10. case and whitespace are not judgment", check_case_and_whitespace_are_not_judgment),
    ("11. pass line boundary is pinned", check_pass_line_boundary_is_pinned),
)


def check_whole_424_entry_shelf_scores_zero():
    assert len(round2_shelf) == 424
    for brief_id in gold:
        result = gate.score(brief_id, list(round2_shelf), gold, round2_shelf)
        assert result["fit"] == 0.0, (brief_id, result)
        assert not result["passed"], (brief_id, result)


def check_near_duplicate_and_ambiguous_names():
    for name in ("parallax-zoom", "parallax-unzoom"):
        returned = name.replace("-", " ").title() + "!"
        resolved, how = gate.resolve(returned, round2_shelf)
        assert (resolved, how) == (name, "exact")

    ambiguous_shelf = ("alpha-beta", "alpha_beta")
    assert gate.resolve("alpha-beta", ambiguous_shelf) == ("alpha-beta", "exact")
    assert gate.resolve("alpha beta", ambiguous_shelf) == (None, "ambiguous")

    tied_vectors = {"moves": {"left": [1.0, 0.0], "right": [0.0, 1.0]}}
    assert gate.resolve("unknown", ("left", "right"), tied_vectors, [1.0, 1.0]) == (
        None,
        "ambiguous",
    )


def check_family_tag_or_group_is_unmountable():
    for family in ("motion trails", "backgrounds", "typography"):
        result = gate.score("01", [family], gold, round2_shelf)
        assert result["mountable"] == 0.0, result


def check_424_vector_calibration_separates():
    fixture = calibration_fixture()
    assert len(fixture["moves"]) == 424
    expected = {name: name for name in FRESH_CORRECT_SAMPLES}
    band = gate.calibrate_match_floor(fixture, expected, FRESH_OFF_SHELF_SAMPLES)
    assert band["margin"] > 0.0, band
    assert abs(gate.MATCH_FLOOR - band["floor"]) < 0.000001, band
    print(
        "CALIBRATION "
        f"vectors={len(fixture['moves'])} "
        f"off_shelf_max={band['off_shelf_max']:.6f} "
        f"correct_min={band['correct_min']:.6f} "
        f"band=({band['off_shelf_max']:.6f}, {band['correct_min']:.6f}) "
        f"margin={band['margin']:.6f} "
        f"MATCH_FLOOR={band['floor']:.6f}"
    )


def check_nonseparating_calibration_blocks():
    fixture = {
        "moves": {"left": [1.0, 0.0], "right": [0.0, 1.0]},
        "control_samples": {"correct": [1.0, 0.0], "off": [1.0, 0.0]},
    }
    try:
        gate.calibrate_match_floor(fixture, {"correct": "left"}, ("off",))
    except ValueError as error:
        assert "BLOCKED" in str(error), error
        assert "non-separating" in str(error), error
    else:
        raise AssertionError("non-separating calibration passed")


def check_mountable_and_fit_are_independent():
    fixture = calibration_fixture()
    target = next(iter(FRESH_CORRECT_SAMPLES))
    result = gate.score(
        "fresh",
        [FRESH_CORRECT_SAMPLES[target]],
        {"fresh": {"best": [target], "bad": []}},
        round2_shelf,
        fixture,
        [fixture["control_samples"][target]],
    )
    assert result["mountable"] == 0.0, result
    assert result["fit"] > 0.0, result


def check_flat_wrong_pick_cost_survives_padding():
    brief_gold = {"flat": {"best": ["focus-rack"], "bad": ["depth-rack-focus"]}}
    clean = gate.score("flat", ["focus-rack"], brief_gold, round2_shelf)
    padded = gate.score(
        "flat",
        ["focus-rack", "depth-rack-focus", "echo-trail", "marker-highlight"],
        brief_gold,
        round2_shelf,
    )
    assert gate.BAD_PICK_COST == 0.5
    assert padded["fit"] < clean["fit"], (clean, padded)


def check_empty_picks_are_zero_not_wrong():
    result = gate.score("01", [], gold, round2_shelf)
    assert result["fit"] == 0.0, result
    assert result["mountable"] == 0.0, result
    assert result["picks"] == [], result
    assert "known-wrong" not in result["reason"], result


ROUND2_CHECKS = (
    ("12. naming the whole 424-entry shelf scores zero", check_whole_424_entry_shelf_scores_zero),
    ("13. near-duplicate names disambiguate and ambiguous names do not", check_near_duplicate_and_ambiguous_names),
    ("14. family, tag, or group picks are unmountable", check_family_tag_or_group_is_unmountable),
    ("15. 424-vector calibration has a positive separating band", check_424_vector_calibration_separates),
    ("16. non-separating calibration blocks", check_nonseparating_calibration_blocks),
    ("17. mountable and fit remain independent", check_mountable_and_fit_are_independent),
    ("18. flat wrong-pick cost survives padding", check_flat_wrong_pick_cost_survives_padding),
    ("19. empty picks score zero without a wrong-pick penalty", check_empty_picks_are_zero_not_wrong),
)


if __name__ == "__main__":
    failures = 0
    for name, fn in PORTED_CHECKS + ROUND2_CHECKS:
        try:
            fn()
        except AssertionError as e:
            failures += 1
            print(f"FAIL {name}: {e}")
        else:
            print(f"PASS {name}")
    raise SystemExit(1 if failures else 0)
