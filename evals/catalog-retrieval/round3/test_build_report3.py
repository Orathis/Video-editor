#!/usr/bin/env python3
"""Checks for the round three report builder.

Unittest style, matching the rest of round three, so one command runs the round:

    cd evals/catalog-retrieval/round3
    python3 -m unittest test_build_report3 -v

The load-bearing checks are the ones that could catch the report flattering the
round: a table that quietly ships a bare mean, a single cluster rendered as a
tight interval, and a stop reason the reader cannot find. Every assertion about
the rendered page parses the HTML rather than grepping for a string, because a
grep passes on a caption that merely mentions an interval.
"""

import json
import math
import os
import unittest
from html.parser import HTMLParser
from unittest import mock

import build_report3
import stats
import sweep

import harness2  # noqa: E402  recall puts the round two directory on the path

RULE = sweep.parse_rule()
SHELF = 424
# Round two's own fitted exchange rate, so the knee table renders in tests at the
# same prices the report uses in production.
TOKENS = (63.0, 220.0)
PRICE = 23725.0
KS = (5, 10, 20)


class Tables(HTMLParser):
    """Every table in a rendered report, as caption, headers and body rows."""

    def __init__(self):
        super().__init__()
        self.tables = []
        self._cell = None
        self._row = None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.tables.append({"caption": "", "headers": [], "rows": []})
        elif tag in ("th", "td", "caption"):
            self._cell = []
        elif tag == "tr":
            self._row = []

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        if self._cell is not None and tag in ("th", "td", "caption"):
            text = "".join(self._cell).strip()
            self._cell = None
            if tag == "caption":
                self.tables[-1]["caption"] = text
            elif tag == "th":
                self.tables[-1]["headers"].append(text)
            elif self._row is not None:
                self._row.append(text)
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.tables[-1]["rows"].append(self._row)
            self._row = None


def tables_in(page):
    parser = Tables()
    parser.feed(page)
    return parser.tables


def column(table, header):
    """One column of a parsed table, by header name. Raises if the column is absent."""
    index = table["headers"].index(header)
    return [row[index] for row in table["rows"]]


def corpus(sizes):
    """A corpus with sizes[i] briefs written for move i.

    Unequal sizes are the normal case once a wave is interrupted part way, so the
    fixture takes them per move rather than assuming a rectangle.
    """
    entries = {"move-{0}".format(i): "body {0}".format(i) for i in range(len(sizes))}
    briefs, gold = {}, {}
    for i, count in enumerate(sizes):
        for j in range(count):
            brief_id = "{0}-{1}".format(i, j)
            briefs[brief_id] = "brief for move {0}".format(i)
            gold[brief_id] = {"best": ["move-{0}".format(i)]}
    return entries, briefs, gold


def hits(predicate):
    """An arm that shows the gold move exactly when the predicate says so."""

    def topk(brief_id, brief, entries, k):
        return ["move-{0}".format(brief_id.split("-")[0])] if predicate(brief_id) else []

    return topk


def arm(fn, family, tier="decision"):
    return {"family": family, "tier": tier, "fn": fn}


ALWAYS = hits(lambda brief_id: True)
NEVER = hits(lambda brief_id: False)
# A near tie: the semantic arm leads by one brief, which no clustered interval
# can call a separation.
NEARLY_ALL = hits(lambda brief_id: brief_id != "0-0")
ONE_FEWER = hits(lambda brief_id: brief_id not in ("0-0", "1-0"))


def summarise(sizes, arms, ks=KS, priced=True, **kwargs):
    entries, briefs, gold = corpus(sizes)
    clusters = sweep.cluster_keys(gold)
    swept, unavailable = sweep.sweep(briefs, gold, entries, arms, ks)
    return build_report3.build_summary(
        swept,
        unavailable,
        clusters,
        RULE,
        shelf_size=SHELF,
        tokens=TOKENS if priced else None,
        price=PRICE if priced else None,
        **kwargs
    )


def tied_summary(**kwargs):
    return summarise(
        (3,) * 8,
        {"semantic": arm(NEARLY_ALL, "semantic"), "lexical": arm(ONE_FEWER, "lexical")},
        **kwargs
    )


class IntervalColumnTests(unittest.TestCase):
    """Scenario 1: no table ships a bare mean."""

    def test_every_rendered_table_carries_an_interval_column(self):
        summary = tied_summary()
        tables = tables_in(build_report3.render(summary))
        self.assertGreaterEqual(len(tables), 4, [t["caption"] for t in tables])
        for table in tables:
            with self.subTest(caption=table["caption"]):
                intervals = [h for h in table["headers"] if "95% ci" in h]
                self.assertEqual(1, len(intervals), table["headers"])

    def test_the_interval_cells_hold_intervals_and_not_placeholders(self):
        # A column named "95% ci" that renders blanks would pass a header check
        # while shipping nothing, so the cells are read too.
        summary = tied_summary()
        for table in tables_in(build_report3.render(summary)):
            header = next(h for h in table["headers"] if "95% ci" in h)
            for cell in column(table, header):
                with self.subTest(caption=table["caption"], cell=cell):
                    self.assertTrue(
                        cell == "unbounded" or " to " in cell, cell
                    )

    def test_the_ranking_interval_matches_the_estimator_rather_than_being_restated(self):
        # The rendered number has to be the one stats.py computed, not a rounding
        # of the mean dressed up as an interval.
        summary = tied_summary()
        table = next(
            t for t in tables_in(build_report3.render(summary)) if "Ranking" in t["caption"]
        )
        rendered = column(table, "recall 95% ci")
        expected = [stats.format_interval(r["interval"]) for r in summary["ranking"]]
        self.assertEqual(expected, rendered)


class EmDashTests(unittest.TestCase):
    """Scenario 2: the house rule applies to the source and to what it renders."""

    FILES = ("build_report3.py", "test_build_report3.py", "VERDICT.md")
    # Written as a code point rather than as the character, so this file can
    # assert the rule without breaking it on itself.
    EM_DASH = chr(0x2014)

    def test_no_file_this_unit_ships_carries_an_em_dash(self):
        for name in self.FILES:
            path = os.path.join(build_report3.HERE, name)
            with self.subTest(file=name):
                self.assertTrue(os.path.exists(path), path)
                with open(path, encoding="utf-8") as fh:
                    self.assertEqual(0, fh.read().count(self.EM_DASH), name)

    def test_the_rendered_report_carries_no_em_dash(self):
        page = build_report3.render(tied_summary())
        self.assertEqual(0, page.count(self.EM_DASH), "rendered report")


class SingleClusterTests(unittest.TestCase):
    """Scenario 3: one cluster bounds nothing, and the report must say so."""

    def setUp(self):
        # Three briefs, all written for the same target move. Treating them as
        # three independent observations is the exact over-precision the
        # clustering exists to stop.
        self.summary = summarise(
            (3,), {"semantic": arm(ALWAYS, "semantic"), "lexical": arm(NEVER, "lexical")}
        )

    def test_the_single_cluster_interval_is_unbounded_not_tight(self):
        for row in self.summary["ranking"]:
            self.assertEqual(1, row["interval"]["clusters"], row)
            self.assertFalse(math.isfinite(row["interval"]["hi"]), row["interval"])
            self.assertEqual(1.0, row["interval"]["n_eff"], row["interval"])

    def test_the_rendered_cell_reads_unbounded(self):
        table = next(
            t
            for t in tables_in(build_report3.render(self.summary))
            if "Ranking" in t["caption"]
        )
        self.assertEqual(
            ["unbounded"] * len(self.summary["ranking"]), column(table, "recall 95% ci")
        )

    def test_a_single_cluster_never_fires_the_separation_branch(self):
        # One arm hits every brief and the other misses every brief, which is the
        # largest gap a corpus can show. On one cluster it still cannot separate,
        # and a report that shipped an arm here would be shipping noise.
        self.assertNotEqual("separated", self.summary["outcome"]["branch"])
        self.assertNotEqual("separated", self.summary["stop_reason"])

    def test_the_summary_file_stays_strict_json_when_a_bound_is_infinite(self):
        # JSON has no infinity. Writing one produces a file only Python can read
        # back, which is not an auditable artifact.
        text = json.dumps(
            build_report3.jsonable(self.summary), sort_keys=True, allow_nan=False
        )
        reloaded = json.loads(text)
        interval = reloaded["ranking"][0]["interval"]
        self.assertIsNone(interval["hi"])
        self.assertEqual(1, interval["clusters"])


class StopReasonTests(unittest.TestCase):
    """Scenario 4: three different verdicts, never reported as one."""

    def separated_summary(self, **kwargs):
        return summarise(
            (3,) * 8,
            {"semantic": arm(ALWAYS, "semantic"), "lexical": arm(NEVER, "lexical")},
            **kwargs
        )

    def assert_reason_is_readable(self, summary, expected):
        self.assertEqual(expected, summary["stop_reason"])
        page = build_report3.render(summary)
        self.assertIn(expected, page)
        self.assertIn(build_report3.STOP_REASONS[expected].split(",")[0], page)

    def test_a_separation_stops_the_round_on_the_separation(self):
        summary = self.separated_summary(waves_run=2)
        self.assertEqual("separated", summary["outcome"]["branch"])
        self.assert_reason_is_readable(summary, "separated")

    def test_running_out_of_waves_is_not_reported_as_a_win(self):
        summary = tied_summary(waves_run=RULE["max_waves"])
        self.assertEqual("tie", summary["outcome"]["branch"])
        self.assert_reason_is_readable(summary, "waves-exhausted")

    def test_the_spend_ceiling_is_its_own_verdict(self):
        summary = tied_summary(waves_run=2, ceiling_reached=True)
        self.assert_reason_is_readable(summary, "ceiling-reached")

    def test_a_round_that_has_not_stopped_says_so_rather_than_implying_a_verdict(self):
        self.assert_reason_is_readable(tied_summary(waves_run=1), "still-running")

    def test_a_separation_on_the_final_wave_reads_as_a_separation(self):
        # The rule evaluates step 2 after each wave, so a round that separates on
        # its last wave stopped on the separation and not on the wave count.
        summary = self.separated_summary(waves_run=RULE["max_waves"], ceiling_reached=True)
        self.assert_reason_is_readable(summary, "separated")

    def test_the_shelf_ceiling_is_stated_in_the_report_itself(self):
        page = build_report3.render(tied_summary())
        self.assertIn("{0} independent things to be right about".format(SHELF), page)
        self.assertIn("larger catalog, not a larger corpus", page)


class InterruptedWaveTests(unittest.TestCase):
    """Scenario 5: unequal cluster sizes, which an interrupted wave always leaves."""

    SIZES = (3, 2, 1, 3, 2, 1, 3, 2, 1, 2)

    def setUp(self):
        # The leader hits every brief for an even numbered move and misses every
        # brief for an odd one, so all the variance sits between clusters. That is
        # the case where ragged cluster sizes have to cost the interval
        # information, and where an unclustered mean would over-report.
        self.summary = summarise(
            self.SIZES,
            {
                "semantic": arm(hits(lambda b: int(b.split("-")[0]) % 2 == 0), "semantic"),
                "lexical": arm(hits(lambda b: b.startswith("0-")), "lexical"),
            },
        )

    def test_the_report_renders_over_unequal_clusters(self):
        tables = tables_in(build_report3.render(self.summary))
        captions = [t["caption"] for t in tables]
        self.assertTrue(any("Ranking" in c for c in captions), captions)
        self.assertTrue(any("Recall curve" in c for c in captions), captions)
        self.assertTrue(any("Paired" in c for c in captions), captions)
        self.assertTrue(any("Knee" in c for c in captions), captions)
        for table in tables:
            self.assertTrue(table["rows"], table["caption"])

    def test_the_interval_still_costs_information_when_the_sizes_are_ragged(self):
        row = self.summary["ranking"][0]
        self.assertEqual(sum(self.SIZES), row["interval"]["n"])
        self.assertEqual(len(self.SIZES), row["interval"]["clusters"])
        self.assertLess(row["interval"]["n_eff"], row["interval"]["n"])
        self.assertTrue(math.isfinite(row["interval"]["hi"]))

    def test_the_curve_carries_one_row_per_arm_per_k(self):
        rows = self.summary["curve"]
        self.assertEqual(2 * len(KS), len(rows))
        self.assertEqual(set(KS), {row["k"] for row in rows})

    def test_the_paired_margin_is_measured_on_the_shared_briefs(self):
        margin = self.summary["margins"][0]
        self.assertEqual(sum(self.SIZES), margin["difference"]["n"])
        self.assertEqual(self.summary["ranking"][0]["arm"], margin["against"])


class DegradedInputTests(unittest.TestCase):
    """Error paths the five scenarios do not reach."""

    def test_no_available_arm_renders_a_not_evaluable_report_rather_than_crashing(self):
        summary = summarise((3, 2, 1), {})
        self.assertEqual("not-evaluable", summary["outcome"]["branch"])
        self.assertIsNone(summary["outcome"]["ship"])
        page = build_report3.render(summary)
        self.assertIn("not-evaluable", page)
        self.assertIn("nothing yet", page)
        # Still a report: the tables are present and empty rather than absent.
        for table in tables_in(page):
            self.assertTrue([h for h in table["headers"] if "95% ci" in h], table)

    def test_a_missing_embedding_index_is_reported_as_missing_not_as_a_loss(self):
        entries, briefs, gold = corpus((3, 3, 3))
        clusters = sweep.cluster_keys(gold)
        with mock.patch.object(harness2, "VECTORS", "/nonexistent/vectors.json"):
            arms = {
                "lexical": arm(ALWAYS, "lexical"),
                "semantic": sweep.decision_arms()["semantic"],
            }
            swept, unavailable = sweep.sweep(briefs, gold, entries, arms, KS)
        summary = build_report3.build_summary(
            swept, unavailable, clusters, RULE, shelf_size=SHELF
        )
        self.assertEqual(["semantic"], sorted(summary["unavailable"]))
        self.assertEqual(["lexical"], [row["arm"] for row in summary["ranking"]])
        page = build_report3.render(summary)
        self.assertIn("Arm semantic was not swept", page)
        self.assertIn("indistinguishable from an arm that lost", page)
        # The reason carries the path of the index it could not find. Rendering the
        # builder's own absolute path would date the report to one checkout on one
        # machine and say nothing about the sweep.
        self.assertNotIn(build_report3._REPO, page)
        self.assertNotIn(build_report3._REPO, json.dumps(summary))

    def test_one_arm_alone_says_there_was_no_runner_up_rather_than_showing_a_tie(self):
        summary = summarise((3, 2, 1), {"lexical": arm(ALWAYS, "lexical")})
        self.assertEqual([], summary["margins"])
        page = build_report3.render(summary)
        self.assertIn("This is a missing input, not a tie.", page)
        self.assertNotIn("has not separated", page)

    def test_an_unpriced_knee_says_so_instead_of_guessing_the_exchange_rate(self):
        summary = tied_summary(priced=False)
        self.assertEqual([], summary["knees"])
        page = build_report3.render(summary)
        self.assertIn("The knee is not priced", page)
        self.assertFalse(any("Knee" in t["caption"] for t in tables_in(page)))

    def test_an_exploratory_winner_is_a_follow_up_and_not_the_shipped_arm(self):
        summary = summarise(
            (3,) * 8,
            {
                "lexical": arm(ONE_FEWER, "lexical"),
                "semantic": arm(NEVER, "semantic"),
                "reranker": arm(ALWAYS, "reranker", tier="exploratory"),
            },
        )
        self.assertEqual(["reranker"], [f["arm"] for f in summary["outcome"]["followups"]])
        self.assertNotEqual("reranker", summary["outcome"]["ship"])
        page = build_report3.render(summary)
        self.assertIn("Follow-up: reranker", page)
        self.assertIn("not shipped", page)

    def test_converged_arms_say_the_question_was_what_k(self):
        summary = summarise((3,) * 8, {
            "lexical": arm(ALWAYS, "lexical"),
            "semantic": arm(ALWAYS, "semantic"),
        })
        self.assertTrue(summary["converged"])
        self.assertIn("the open question is what k, not which arm", build_report3.render(summary))


if __name__ == "__main__":
    unittest.main(verbosity=2)
