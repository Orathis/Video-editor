#!/usr/bin/env python3
"""Checks for the report builder. Run with: python3 test_build_report2.py"""

import glob
import json
import math
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


def test_cost_counts_every_attempt_and_divides_by_runs():
    # A retried run bills twice but is still one run, so per-run input has to be
    # the sum over attempts, not the last attempt's number.
    retried = record("001", "b", None, ["alpha"])
    retried["attempts"] = retried["attempts"] * 2
    cost = build_report2.cost_per_cell([retried], {})["b"]
    assert cost["runs"] == 1 and cost["input_per_run"] == 200, cost
    assert cost["cached_per_run"] == 80 and cost["output_per_run"] == 40, cost


def test_fit_per_dollar_prefers_the_cheaper_cell_at_equal_fit():
    # The whole point of the cost table: a short list that matches the full
    # shelf on quality should win on efficiency, and the number has to say so.
    full = record("001", "b", None, ["alpha"])
    short = record("001", "c", 5, ["alpha"])
    short["attempts"] = [
        {"usage": {"prompt_tokens": 10, "cached_tokens": 0, "completion_tokens": 20}}
    ]
    cost = build_report2.cost_per_cell(
        [full, short], {"b": {"fit": 1.0}, "c@5": {"fit": 1.0}}
    )
    assert cost["c@5"]["fit_per_dollar"] > cost["b"]["fit_per_dollar"], cost


def test_the_paired_table_holds_the_briefs_fixed():
    # 001 is easy enough that the short list finds it, 002 is not. Comparing
    # the short list's average against the full shelf's average over all briefs
    # would credit the short list for only being graded on the easy one.
    records = [
        record("001", "c", 5, ["alpha"], shown=["alpha", "beta"]),
        record("002", "c", 5, ["gamma"], shown=["alpha", "gamma"]),
        record("001", "b", None, ["alpha"]),
        record("002", "b", None, ["beta"]),
    ]
    rows = build_report2.score_all(records, GOLD, SHELF)
    paired = build_report2.paired_against_full_shelf(rows)["c@5"]
    # Only 001 had its answer shown, so both sides are measured on 001 alone.
    assert paired["n"] == 1, paired
    assert paired["cell_fit"] == paired["full_shelf_fit"], paired


def test_paired_skips_a_cell_with_no_shared_briefs():
    rows = build_report2.score_all(
        [record("001", "c", 5, ["gamma"], shown=["beta"])], GOLD, SHELF
    )
    assert build_report2.paired_against_full_shelf(rows) == {}


def real_recall_records(cell):
    """Round 2's own recall log replayed as scoreable records.

    Only the gold-shown bit is real: whether the correct move was on the list
    that run could see. That is enough to recompute the recall column and its
    clustered interval from the committed log without inventing fit numbers the
    repo does not carry.
    """
    gold = {}
    for path in sorted(glob.glob(os.path.join(HERE, "gold", "*.json"))):
        brief = os.path.basename(path).split(".")[0]
        with open(path, encoding="utf-8") as fh:
            gold[brief] = json.load(fh)
    with open(os.path.join(HERE, "recall-log.json"), encoding="utf-8") as fh:
        log = json.load(fh)[cell]
    shelf = {move: "what: x\n" for entry in gold.values() for move in entry["best"]}
    shelf["decoy"] = "what: x\n"
    records = []
    for brief in sorted(log):
        best = gold[brief]["best"][0]
        records.append(
            record(brief, "h", 10, [best], shown=[best] if log[brief] else ["decoy"])
        )
    return records, gold, shelf


def test_round2_reports_an_effective_sample_below_its_brief_count():
    # The verification for the clustered statistics: round 2 published means
    # over 227 briefs as though those were 227 independent observations. They
    # cover 158 distinct target moves, and the correlation inside a move costs
    # roughly 36 briefs' worth of information.
    records, gold, shelf = real_recall_records("h@10")
    cell = build_report2.aggregate(
        build_report2.score_all(records, gold, shelf)
    )["h@10"]
    assert cell["n"] == 227, cell["n"]
    recall = cell["ci"]["recall"]
    assert recall["clusters"] == 158, recall
    assert recall["mean"] == 0.4317, recall
    assert 185.0 < recall["n_eff"] < 205.0, recall
    assert recall["n_eff"] < cell["n"], recall


def test_every_reported_mean_carries_an_interval_around_it():
    # The interval sits beside each mean rather than replacing it, so a reader
    # or a downstream script that already knew what "fit" meant still does.
    records = [record("001", "b", None, ["alpha"]), record("002", "b", None, ["beta"])]
    cell = build_report2.aggregate(
        build_report2.score_all(records, GOLD, SHELF)
    )["b"]
    for metric, _ in build_report2.METRICS:
        assert isinstance(cell[metric], float), metric
        assert cell["ci"][metric]["mean"] == cell[metric], metric
        assert cell["ci"][metric]["lo"] <= cell[metric] <= cell["ci"][metric]["hi"], metric
    assert cell["ci"]["fit_when_shown"]["mean"] == cell["fit_when_shown"]


def test_briefs_on_one_move_do_not_buy_a_tight_interval():
    # Both briefs target alpha, so the cell rests on a single cluster and the
    # interval has to say it bounds nothing. A tight interval here is exactly
    # the over-precision the clustering exists to stop.
    gold = {"001": {"best": ["alpha"], "bad": []}, "002": {"best": ["alpha"], "bad": []}}
    records = [record("001", "b", None, ["alpha"]), record("002", "b", None, ["gamma"])]
    cell = build_report2.aggregate(build_report2.score_all(records, gold, SHELF))["b"]
    assert cell["ci"]["fit"]["clusters"] == 1, cell["ci"]["fit"]
    assert cell["ci"]["fit"]["n_eff"] == 1.0, cell["ci"]["fit"]
    assert not math.isfinite(cell["ci"]["fit"]["hi"]), cell["ci"]["fit"]


def test_the_paired_difference_carries_a_clustered_interval():
    # Identical fit on both sides of the pairing, so the difference is exactly
    # zero. Its interval is not, because two cells agreeing on this corpus is
    # not the same as two cells that cannot disagree. With nothing varying the
    # sandwich reports a standard error of zero, and stats.py falls back to the
    # rule of three over the clusters: 3/2 is 1.5, wider than a difference of
    # two rates can possibly be, so it is clipped to the range one can occupy.
    records = [
        record("001", "c", 5, ["alpha"], shown=["alpha", "beta"]),
        record("002", "c", 5, ["beta"], shown=["beta", "gamma"]),
        record("001", "b", None, ["alpha"]),
        record("002", "b", None, ["beta"]),
    ]
    rows = build_report2.score_all(records, GOLD, SHELF)
    difference = build_report2.paired_against_full_shelf(rows)["c@5"]["difference"]
    assert difference["mean"] == 0.0, difference
    assert difference["se"] == 0.0, difference
    assert (difference["lo"], difference["hi"]) == (-1.0, 1.0), difference


def test_render_produces_html_with_every_cell():
    records = [record("001", "b", None, ["alpha"]), record("001", "c", 5, ["gamma"])]
    rows = build_report2.score_all(records, GOLD, SHELF)
    page = build_report2.render(build_report2.build_summary(records, rows), rows)
    assert "<table" in page and "c@5" in page and "mountable" in page
    # Every headline table ships its error bars, or the report is back to the
    # bare means round 2 published.
    assert "fit 95% ci" in page and "n eff" in page, page
    assert "difference 95% ci" in page, page
    # The report is a rendered artifact, so the house rule applies to it too.
    assert "—" not in page


def main():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"test_build_report2.py: {len(tests)} scenarios passed")


if __name__ == "__main__":
    main()
