#!/usr/bin/env python3
"""Checks for the round four report builder.

Unittest style, matching rounds two and three, so one command runs the round:

    cd evals/catalog-retrieval/round4
    python3 -m unittest discover -v

Round 4 adds one question to round 3's report, the band test, so these checks
are about the band and about the four things the round is required to name:
the stop reason, the outcome, the band and the convergence point. Everything
round 3 already tested is round 3's to test, and it is not restated here.

The fixture helpers come from round three's own report tests rather than being
copied, because a second copy of "what a swept arm looks like" is a second thing
to keep true.
"""

import html
import json
import os
import re
import unittest

import build_report4  # noqa: E402  puts the round three directory on the path

import build_report3  # noqa: E402
import sweep  # noqa: E402
from test_build_report3 import (  # noqa: E402
    ALWAYS,
    PRICE,
    SHELF,
    TOKENS,
    arm,
    column,
    corpus,
    tables_in,
)

RULE4 = sweep.parse_rule(build_report4.RULE_FILE)
RULE3 = sweep.parse_rule(sweep.RULE_FILE)
KS = (5, 10, 20, 30, 40, 50, 60)
MOVES = 8
PER_MOVE = 3


def shown_at(hits_by_k):
    """An arm that shows the gold move to the first n briefs at each k.

    Round 3's fixtures hold the shown set fixed across k, which cannot produce a
    band: a band is a shape in k, so the arm under test has to change with k.
    """

    def topk(brief_id, brief, entries, k):
        return (
            ["move-{0}".format(brief_id.split("-")[0])]
            if brief_id in hits_by_k[k]
            else []
        )

    return topk


def summarise(hits, ks=KS, rule=RULE4, **kwargs):
    """A summary whose separated band is whatever `hits` shapes it to be.

    `hits` maps each k to how many of the briefs the lexical arm shows the gold
    move to. The semantic arm shows every brief its own move at every k, so the
    two arms separate exactly where the lexical count is low and tie where it
    is not.
    """
    entries, briefs, gold = corpus((PER_MOVE,) * MOVES)
    ids = sorted(briefs)
    arms = {
        "semantic": arm(ALWAYS, "semantic"),
        "lexical": arm(
            shown_at({k: set(ids[:count]) for k, count in hits.items()}), "lexical"
        ),
    }
    clusters = sweep.cluster_keys(gold)
    swept, unavailable = sweep.sweep(briefs, gold, entries, arms, ks)
    return build_report4.build_summary(
        swept,
        unavailable,
        clusters,
        rule,
        shelf_size=SHELF,
        tokens=TOKENS,
        price=PRICE,
        **kwargs
    )


ALL = MOVES * PER_MOVE
FEW = 6
# Separates over k=10 to k=50, five list lengths, then the arms meet at k=60.
ONE_BAND = {5: ALL - 1, 10: FEW, 20: FEW, 30: FEW, 40: FEW, 50: FEW, 60: ALL}
# The same sweep with k=30 tied, which cuts the band in two.
TWO_BANDS = dict(ONE_BAND)
TWO_BANDS[30] = ALL - 1
NEVER_SEPARATES = {k: ALL - 1 for k in KS}


def band_table(page):
    return next(t for t in tables_in(page) if t["caption"].startswith("Band stability"))


def text_of(page):
    """The rendered page with its tags stripped, for reading prose claims."""
    return html.unescape(re.sub(r"<[^>]+>", " ", page))


class BandFieldTests(unittest.TestCase):
    """The band arrives as three fields, and each of them says its own thing."""

    def test_the_run_its_width_and_the_verdict_are_separate_fields(self):
        band = summarise(ONE_BAND)["band"]
        self.assertEqual((10, 50), (band["band"]["lo"], band["band"]["hi"]))
        self.assertEqual(5, band["width"])
        self.assertTrue(band["clears"])
        self.assertEqual(5, band["required"])

    def test_the_band_is_drawn_over_the_readings_the_report_itself_prints(self):
        # A band drawn over a second, private computation of the rule could
        # disagree with the per k table on the same page, and the reader would
        # have no way to tell which one the verdict came from.
        summary = summarise(ONE_BAND)
        separated = [row["k"] for row in summary["across_ks"] if row["branch"] == "separated"]
        self.assertEqual([10, 20, 30, 40, 50], separated)
        self.assertEqual(
            len(separated), summary["band"]["width"]
        )

    def test_a_sweep_that_never_separates_has_no_band_and_does_not_clear(self):
        band = summarise(NEVER_SEPARATES)["band"]
        self.assertEqual([], band["bands"])
        self.assertIsNone(band["band"])
        self.assertFalse(band["clears"])

    def test_disjoint_runs_are_both_carried_and_neither_alone_clears(self):
        band = summarise(TWO_BANDS)["band"]
        self.assertEqual([2, 2], [run["width"] for run in band["bands"]])
        self.assertEqual(2, band["width"])
        self.assertFalse(band["clears"])

    def test_the_convergence_point_is_where_the_arms_meet_and_stay(self):
        self.assertEqual(60, summarise(ONE_BAND)["convergence_point"])

    def test_arms_that_never_meet_report_no_convergence_point(self):
        summary = summarise({k: FEW for k in KS})
        self.assertIsNone(summary["convergence_point"])

    def test_the_summary_still_serialises_to_json(self):
        summary = build_report3.jsonable(summarise(ONE_BAND))
        written = json.loads(json.dumps(summary, allow_nan=False))
        self.assertEqual(5, written["band"]["width"])
        self.assertEqual(60, written["convergence_point"])


class ReportNamesTheFourThingsTests(unittest.TestCase):
    """The round's own definition of done, read off the rendered page."""

    def setUp(self):
        self.summary = summarise(ONE_BAND, waves_run=1)
        self.page = build_report4.render(self.summary)

    def test_the_page_names_the_stop_reason(self):
        self.assertIn(self.summary["stop_reason"], self.page)
        self.assertIn(build_report3.STOP_REASONS[self.summary["stop_reason"]], text_of(self.page))

    def test_the_page_names_the_rule_outcome(self):
        self.assertIn(self.summary["outcome"]["branch"], self.page)
        self.assertIn(self.summary["outcome"]["reason"], text_of(self.page))

    def test_the_page_names_the_band_as_a_run_a_width_and_a_verdict(self):
        table = band_table(self.page)
        self.assertEqual(["10"], column(table, "k from"))
        self.assertEqual(["50"], column(table, "k to"))
        self.assertEqual(["5"], column(table, "list lengths"))
        self.assertEqual(["yes"], column(table, "clears alone"))
        self.assertIn("the widest single band holds 5", text_of(self.page))

    def test_the_page_names_the_convergence_point(self):
        self.assertIn("Convergence point: the arms land", text_of(self.page))
        self.assertIn("from k=60", text_of(self.page))

    def test_the_band_leads_the_page_rather_than_trailing_the_round_it_inherited(self):
        captions = [t["caption"] for t in tables_in(self.page)]
        self.assertTrue(captions[0].startswith("Band stability"), captions)

    def test_the_page_is_titled_as_round_four(self):
        self.assertIn("<title>Catalog retrieval, round four</title>", self.page)
        self.assertNotIn("round three</title>", self.page)


class ReportBandProseTests(unittest.TestCase):
    def test_two_disjoint_runs_render_as_two_rows_and_are_not_summed(self):
        page = build_report4.render(summarise(TWO_BANDS))
        table = band_table(page)
        self.assertEqual(["10", "40"], column(table, "k from"))
        self.assertEqual(["2", "2"], column(table, "list lengths"))
        self.assertEqual(["no", "no"], column(table, "clears alone"))
        self.assertIn("the runs are not added together", text_of(page))

    def test_a_sweep_with_no_band_says_so_instead_of_rendering_an_empty_pass(self):
        page = build_report4.render(summarise(NEVER_SEPARATES))
        self.assertEqual([], band_table(page)["rows"])
        self.assertIn("No comparable list length separated", text_of(page))
        self.assertIn("the band requirement is not met", text_of(page))

    def test_a_rule_with_no_band_width_reports_a_missing_requirement_not_a_pass(self):
        # Round 3's rule file pre-registered no band. Its numbers must not come
        # back through this report wearing a verdict it never committed to.
        summary = summarise(ONE_BAND, rule=RULE3)
        self.assertIsNone(summary["band"])
        page = build_report4.render(summary)
        self.assertIn("pre-registers no band width", text_of(page))
        self.assertNotIn("Band stability", page)


def step(arm, lo_k, hi_k, model, separates, metric="pass_rate"):
    """One adjacent-list-length pairing, shaped like confirm3.paired's output."""
    flat = {"mean": 0.0, "lo": -0.02, "hi": 0.02, "se": 0.01, "clusters": 9, "n": 9}
    up = {"mean": 0.05, "lo": 0.01, "hi": 0.09, "se": 0.02, "clusters": 9, "n": 9}
    out = {
        "cell": "{0}@{1}/{2}".format(arm, hi_k, model),
        "against": "{0}@{1}/{2}".format(arm, lo_k, model),
        "changed": ["k"],
        "n": 9,
    }
    for name, _ in build_report4.confirm3.METRICS:
        out[name] = dict(up if (separates and name == metric) else flat)
    return out


def arm_gap(arm, k, model, separates, against="c"):
    """One arm-versus-arm pairing at a single list length."""
    flat = {"mean": 0.02, "lo": -0.02, "hi": 0.06, "se": 0.02, "clusters": 9, "n": 9}
    up = {"mean": 0.17, "lo": 0.12, "hi": 0.22, "se": 0.02, "clusters": 9, "n": 9}
    out = {
        "cell": "{0}@{1}/{2}".format(arm, k, model),
        "against": "{0}@{1}/{2}".format(against, k, model),
        "changed": ["arm"],
        "n": 9,
    }
    for name, _ in build_report4.confirm3.METRICS:
        out[name] = dict(up if separates else flat)
    return out


class OperatingPointTests(unittest.TestCase):
    """The page has to name what ships, and say who decided the list length.

    The band decides the family and the rule stops there: its own outcome on
    this corpus is k-dependent, so the k comes off the confirmation instead and
    has to be labelled as chosen after the numbers existed.
    """

    def summary(self):
        return summarise(ONE_BAND)

    def confirmation(self, paired):
        return {"cells": {}, "paired": paired}

    def test_the_shipped_k_is_the_last_step_that_bought_anything(self):
        point = build_report4.operating_point(
            self.summary(),
            self.confirmation(
                [
                    step("d", 10, 20, "model-a", True),
                    step("d", 20, 30, "model-a", True),
                    step("d", 30, 40, "model-a", False),
                ]
            ),
        )
        self.assertEqual(("semantic", 30, 20), (point["family"], point["k"], point["from_k"]))
        self.assertEqual([(30, 40)], point["stalled"])

    def test_a_step_that_separates_on_one_model_of_two_still_counts(self):
        # The claim being made is that a longer list still buys something, and
        # one model measuring that is enough to make the claim. Requiring both
        # would silently ship the shorter list whenever the models disagree.
        point = build_report4.operating_point(
            self.summary(),
            self.confirmation(
                [
                    step("d", 10, 20, "model-a", True),
                    step("d", 20, 30, "model-a", False),
                    step("d", 20, 30, "model-b", True),
                ]
            ),
        )
        self.assertEqual(30, point["k"])
        self.assertEqual(2, point["models"])
        # And the page must not read that split decision back as a unanimous one.
        self.assertEqual(1, point["separating"])

    def test_the_page_says_how_many_models_the_shipping_step_separated_on(self):
        page = build_report4.render(
            self.summary(),
            self.confirmation(
                [
                    step("d", 10, 20, "model-a", True),
                    step("d", 10, 20, "model-b", False),
                ]
            ),
        )
        self.assertIn("separated on pass rate on 1 of the 2 models", text_of(page))

    def test_the_arm_gap_at_the_shipped_list_length_is_reported_even_when_it_is_zero(
        self,
    ):
        # The band chose the family over a range. If the arms have converged by
        # the list length that ships, the page has to say so: a reader about to
        # take on an embedding index deserves to know it bought nothing
        # measurable at the point they are shipping.
        page = build_report4.render(
            self.summary(),
            self.confirmation(
                [
                    step("d", 10, 20, "model-a", True),
                    arm_gap("d", 20, "model-a", False),
                    arm_gap("d", 20, "model-b", False),
                    arm_gap("d", 10, "model-a", True),
                ]
            ),
        )
        text = text_of(page)
        self.assertIn("+0.0200 and +0.0200 on the 2 models", text)
        self.assertIn("separates from zero on 0 of them", text)

    def test_only_the_shipped_arm_and_list_length_count_toward_that_gap(self):
        point = build_report4.operating_point(
            self.summary(),
            self.confirmation(
                [
                    step("d", 10, 20, "model-a", True),
                    arm_gap("d", 20, "model-a", True),
                    arm_gap("c", 20, "model-a", True),
                    arm_gap("d", 10, "model-a", True),
                ]
            ),
        )
        self.assertEqual((1, 1), (point["arm_separates_at_k"], point["arm_measured_at_k"]))

    def test_another_family_cannot_choose_the_list_length(self):
        # The band already decided the family. A lexical step still climbing at
        # k=40 says nothing about how long the shipped arm's list should be.
        point = build_report4.operating_point(
            self.summary(),
            self.confirmation(
                [
                    step("d", 10, 20, "model-a", True),
                    step("c", 20, 40, "model-a", True),
                ]
            ),
        )
        self.assertEqual(20, point["k"])

    def test_no_confirmation_ships_no_list_length(self):
        self.assertIsNone(build_report4.operating_point(self.summary(), None))
        self.assertIsNone(build_report4.operating_point(self.summary(), {"paired": []}))
        page = build_report4.render(self.summary())
        self.assertIn("Operating point: none yet", text_of(page))

    def test_a_band_that_does_not_clear_ships_nothing_whatever_the_pairings_say(self):
        summary = summarise(NEVER_SEPARATES)
        self.assertIsNone(
            build_report4.operating_point(
                summary, self.confirmation([step("d", 10, 20, "model-a", True)])
            )
        )

    def test_the_page_names_the_point_and_says_who_chose_the_list_length(self):
        page = build_report4.render(
            self.summary(),
            self.confirmation(
                [
                    step("d", 10, 20, "model-a", True),
                    step("d", 20, 30, "model-a", False),
                ]
            ),
        )
        text = text_of(page)
        self.assertIn("Operating point: semantic at k=20", text)
        self.assertIn("chosen after the numbers existed", text)
        # And it sits in front of the band table it summarises, not after it.
        self.assertLess(text.index("Operating point"), text.index("Band stability"))


class NoEmDashTests(unittest.TestCase):
    """The count has to be zero, and spelling the character out would fail this file."""

    EM_DASH = chr(8212)

    def test_the_module_and_its_rendered_page_carry_no_em_dash(self):
        for path in (build_report4.__file__, os.path.abspath(__file__)):
            with open(path, encoding="utf-8") as fh:
                self.assertEqual(0, fh.read().count(self.EM_DASH), path)
        page = build_report4.render(summarise(ONE_BAND))
        self.assertEqual(0, page.count(self.EM_DASH), "rendered round four report")


if __name__ == "__main__":
    unittest.main(verbosity=2)
