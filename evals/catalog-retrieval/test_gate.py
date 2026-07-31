#!/usr/bin/env python3
"""Prove the gate separates a good selection from a bad one before trusting it.

The load-bearing check is the last one: a condition-A style output that names no
shelf move at all must still produce a meaningful score. A gate that structurally
cannot score the control has rigged the benchmark in favor of the catalog.
"""

import json
import os

import gate
import harness

shelf = harness.load_shelf()
gold = gate.load_gold()
vectors = json.load(open(harness.VECTORS)) if os.path.exists(harness.VECTORS) else None


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


CHECKS = (
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

if __name__ == "__main__":
    failures = 0
    for name, fn in CHECKS:
        try:
            fn()
        except AssertionError as e:
            failures += 1
            print(f"FAIL {name}: {e}")
        else:
            print(f"PASS {name}")
    raise SystemExit(1 if failures else 0)
