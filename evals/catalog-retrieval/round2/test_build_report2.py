#!/usr/bin/env python3
"""Checks for the report builder. Run with: python3 test_build_report2.py"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import build_report2  # noqa: E402

SHELF = {"alpha": "what: a\n", "beta": "what: b\n", "gamma": "what: c\n"}
GOLD = {
    "001": {"best": ["alpha"], "bad": ["gamma"]},
    "002": {"best": ["beta"], "bad": []},
}


def record(brief, condition, k, moves, shown=None):
    return {
        "brief": brief,
        "condition": condition,
        "k": k,
        "shown": shown if shown is not None else list(SHELF),
        "picks": [{"move": m, "why": "x"} for m in moves],
        "attempts": [
            {"usage": {"prompt_tokens": 100, "cached_tokens": 40, "completion_tokens": 20}}
        ],
    }


def test_k_makes_a_separate_cell():
    # c@5 and c@10 differ only by k. Collapsing them onto "c" would average the
    # sweep away, which is the one thing round two exists to measure.
    assert build_report2.cell_key(record("001", "c", 5, [])) == "c@5"
    assert build_report2.cell_key(record("001", "c", 10, [])) == "c@10"
    assert build_report2.cell_key(record("001", "a", None, [])) == "a"


def test_a_result_whose_gold_was_pruned_is_not_scored():
    # The 45 dropped briefs have no gold. Scoring them as zero would report a
    # corpus that was never run.
    records = [record("001", "b", None, ["alpha"]), record("999", "b", None, ["alpha"])]
    rows = build_report2.score_all(records, GOLD, SHELF)
    assert [r["brief"] for r in rows] == ["001"], rows


def test_mountable_and_fit_stay_separate():
    # One right pick and one known-wrong pick: both moves exist, so mountable
    # is a full 1.0 while fit is penalized. A single blended number would hide
    # exactly this case.
    rows = build_report2.score_all(
        [record("001", "b", None, ["alpha", "gamma"])], GOLD, SHELF
    )
    assert rows[0]["mountable"] == 1.0, rows[0]
    assert rows[0]["fit"] < 1.0, rows[0]


def test_empty_picks_are_counted_not_dropped():
    rows = build_report2.score_all([record("001", "c", 5, [])], GOLD, SHELF)
    assert rows[0]["empty"] is True
    assert build_report2.aggregate(rows)["c@5"]["empty_rate"] == 1.0


def test_a_short_list_that_misses_the_answer_is_recall_not_selection():
    # Two runs pick nothing right, but one was never shown the answer. Reading
    # both as the model choosing badly would send the fix to the wrong layer.
    blind = record("001", "c", 5, ["gamma"], shown=["beta", "gamma"])
    sighted = record("002", "c", 5, ["gamma"], shown=["beta", "gamma"])
    stats = build_report2.aggregate(
        build_report2.score_all([blind, sighted], GOLD, SHELF)
    )["c@5"]
    assert stats["recall"] == 0.5, stats
    # Only the run that could see its answer counts toward fit when shown.
    assert stats["fit_when_shown"] >= stats["fit"], stats


def test_the_full_shelf_cell_always_has_the_answer_on_offer():
    rows = build_report2.score_all([record("001", "b", None, ["alpha"])], GOLD, SHELF)
    assert rows[0]["gold_shown"] is True


def test_the_no_catalog_cell_reports_no_recall_rather_than_a_false_one():
    # Cell a shows nothing, so "was the answer visible" is structurally false.
    # Defaulting it to true would flatter the control.
    rows = build_report2.score_all(
        [record("001", "a", None, ["alpha"], shown=[])], GOLD, SHELF
    )
    assert rows[0]["gold_shown"] is False


def test_aggregate_groups_by_cell():
    records = [
        record("001", "b", None, ["alpha"]),
        record("002", "b", None, ["beta"]),
        record("001", "c", 5, ["gamma"]),
    ]
    stats = build_report2.aggregate(build_report2.score_all(records, GOLD, SHELF))
    assert stats["b"]["n"] == 2 and stats["c@5"]["n"] == 1, stats
    assert stats["b"]["fit"] > stats["c@5"]["fit"], stats


def test_spend_reads_every_attempt_not_just_the_last():
    # A retried run bills twice. Counting only the final attempt under reports
    # the spend the ceiling is supposed to guard.
    retried = record("001", "b", None, ["alpha"])
    retried["attempts"] = retried["attempts"] * 2
    usage = build_report2.spend([retried])
    assert usage["prompt_tokens"] == 200, usage
    assert usage["cached_fraction"] == 0.4, usage


def test_render_produces_html_with_every_cell():
    records = [record("001", "b", None, ["alpha"]), record("001", "c", 5, ["gamma"])]
    rows = build_report2.score_all(records, GOLD, SHELF)
    page = build_report2.render(build_report2.build_summary(records, rows), rows)
    assert "<table" in page and "c@5" in page and "mountable" in page
    # The report is a rendered artifact, so the house rule applies to it too.
    assert "—" not in page


def main():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"test_build_report2.py: {len(tests)} scenarios passed")


if __name__ == "__main__":
    main()
