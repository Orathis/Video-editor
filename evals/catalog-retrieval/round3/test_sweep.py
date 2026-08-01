#!/usr/bin/env python3
"""Offline tests for the round-three sweep and the rule it applies.

The load-bearing tests are the ones that could catch the sweep cheating: that
the branch comes from the committed rule file rather than from this code, that
an arm whose index is missing is reported as missing rather than ranked, and
that the intervals are genuinely clustered rather than merely labelled so.
"""

import hashlib
import json
import math
import os
import random
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

import recall
import stats
import sweep

import harness2  # noqa: E402  recall puts the round two directory on the path
import provider  # noqa: E402


def _fixture_vector(seed, dimensions=32):
    digest = hashlib.sha256(seed.encode()).digest()
    rng = random.Random(int.from_bytes(digest[:8], "big"))
    values = [rng.gauss(0.0, 1.0) for _ in range(dimensions)]
    length = math.sqrt(sum(value * value for value in values))
    return [value / length for value in values]


def corpus(moves=8, per_move=3):
    """A small corpus with several briefs per target move, so clustering bites."""
    entries = {"move-{0}".format(i): "body {0}".format(i) for i in range(moves)}
    briefs, gold = {}, {}
    for i in range(moves):
        for j in range(per_move):
            brief_id = "{0}-{1}".format(i, j)
            briefs[brief_id] = "brief for move {0}".format(i)
            gold[brief_id] = {"best": ["move-{0}".format(i)]}
    return entries, briefs, gold


def arm(fn, family, tier="decision"):
    return {"family": family, "tier": tier, "fn": fn}


def hits(predicate):
    """An arm that shows the gold move exactly when the predicate says so."""

    def topk(brief_id, brief, entries, k):
        return ["move-{0}".format(brief_id.split("-")[0])] if predicate(brief_id) else []

    return topk


ALWAYS = hits(lambda brief_id: True)
NEVER = hits(lambda brief_id: False)


class RuleFileTests(unittest.TestCase):
    """The rule is read from the committed file, not transcribed into the code."""

    def test_the_committed_rule_file_carries_every_parameter_the_sweep_needs(self):
        rule = sweep.parse_rule()
        self.assertEqual(0.95, rule["confidence"])
        self.assertEqual(["lexical", "semantic", "hybrid"], rule["decision_tier"])
        self.assertEqual("lexical", rule["tie_break"]["prefer"])
        self.assertEqual(5, rule["max_waves"])
        self.assertFalse(rule["exploratory_tier_can_win"])

    def test_a_rule_file_with_no_parameter_block_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "DECISION-RULE.md"
            path.write_text("# a rule with only prose\n", encoding="utf-8")
            with self.assertRaises(SystemExit):
                sweep.parse_rule(str(path))

    def test_a_rule_file_missing_one_parameter_is_refused_rather_than_defaulted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "DECISION-RULE.md"
            path.write_text(
                "```json\n" + json.dumps({"confidence": 0.95}) + "\n```\n", encoding="utf-8"
            )
            with self.assertRaises(SystemExit):
                sweep.parse_rule(str(path))

    def test_a_confidence_the_stats_module_cannot_compute_is_refused(self):
        with self.assertRaises(SystemExit):
            sweep.parse_rule(self.edited('"confidence": 0.95', '"confidence": 0.9'))

    def edited(self, old, new):
        """A copy of the real rule file with one parameter changed."""
        with open(sweep.RULE_FILE, encoding="utf-8") as fh:
            text = fh.read()
        self.assertIn(old, text)
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "DECISION-RULE.md"
        path.write_text(text.replace(old, new), encoding="utf-8")
        return str(path)


class DecisionTests(unittest.TestCase):
    """The four branches, each fired by a sweep that should fire it."""

    def setUp(self):
        self.entries, self.briefs, self.gold = corpus()
        self.clusters = sweep.cluster_keys(self.gold)
        self.rule = sweep.parse_rule()

    def ranked(self, arms, tier="decision"):
        swept, unavailable = sweep.sweep(self.briefs, self.gold, self.entries, arms, (10,))
        self.assertEqual({}, unavailable)
        return sweep.rank(swept, self.clusters, tier, 10)

    def test_a_clear_leader_fires_the_separation_branch_and_ships_the_leader(self):
        rows = self.ranked(
            {"semantic": arm(ALWAYS, "semantic"), "lexical": arm(NEVER, "lexical")}
        )
        outcome = sweep.decide(rows, self.rule, self.clusters)
        self.assertEqual("separated", outcome["branch"])
        self.assertEqual("semantic", outcome["ship"])
        self.assertGreater(outcome["difference"]["lo"], 0)

    def test_arms_that_do_not_separate_fire_the_tie_branch_and_ship_the_stale_free_arm(self):
        # The semantic arm leads by a single brief out of 24, which no clustered
        # interval can call a difference.
        rows = self.ranked(
            {
                "semantic": arm(hits(lambda b: b != "0-0"), "semantic"),
                "lexical": arm(hits(lambda b: b not in ("0-0", "1-0")), "lexical"),
            }
        )
        self.assertEqual("semantic", rows[0]["arm"])
        outcome = sweep.decide(rows, self.rule, self.clusters)
        self.assertEqual("tie", outcome["branch"])
        self.assertLessEqual(outcome["difference"]["lo"], 0)
        # Not the larger number: the arm that needs no embedding index.
        self.assertEqual("lexical", outcome["ship"])

    def test_editing_the_parameter_block_changes_which_arm_the_tie_ships(self):
        rows = self.ranked(
            {
                "semantic": arm(hits(lambda b: b != "0-0"), "semantic"),
                "lexical": arm(hits(lambda b: b not in ("0-0", "1-0")), "lexical"),
            }
        )
        rule = sweep.parse_rule(
            RuleFileTests.edited(self, '"prefer": "lexical"', '"prefer": "semantic"')
        )
        outcome = sweep.decide(rows, rule, self.clusters)
        self.assertEqual("tie", outcome["branch"])
        # Same sweep, same code, different file: proof the rule is read.
        self.assertEqual("semantic", outcome["ship"])

    def test_a_rule_file_that_lets_the_exploratory_tier_win_is_refused_not_obeyed(self):
        rows = self.ranked({"lexical": arm(ALWAYS, "lexical")})
        rule = sweep.parse_rule(
            RuleFileTests.edited(
                self, '"exploratory_tier_can_win": false', '"exploratory_tier_can_win": true'
            )
        )
        with self.assertRaises(SystemExit):
            sweep.decide(rows, rule, self.clusters)

    def test_one_available_family_cannot_be_shipped_by_default(self):
        rows = self.ranked({"lexical": arm(ALWAYS, "lexical")})
        outcome = sweep.decide(rows, self.rule, self.clusters)
        self.assertEqual("not-evaluable", outcome["branch"])
        self.assertIsNone(outcome["ship"])

    def test_an_exploratory_winner_is_a_follow_up_and_never_the_shipped_arm(self):
        missed = ("0-0", "1-0", "2-0")
        arms = {
            "lexical": arm(hits(lambda b: b not in missed), "lexical"),
            "semantic": arm(NEVER, "semantic"),
            "reranker": arm(ALWAYS, "reranker", tier="exploratory"),
        }
        swept, _ = sweep.sweep(self.briefs, self.gold, self.entries, arms, (10,))
        rows = sweep.rank(swept, self.clusters, "decision", 10)
        exploratory = sweep.rank(swept, self.clusters, "exploratory", 10)
        self.assertGreater(exploratory[0]["interval"]["mean"], rows[0]["interval"]["mean"])

        outcome = sweep.decide(rows, self.rule, self.clusters, exploratory)
        self.assertEqual("lexical", outcome["ship"])
        self.assertEqual(["reranker"], [f["arm"] for f in outcome["followups"]])
        self.assertEqual("lexical", outcome["followups"][0]["over"])
        self.assertAlmostEqual(len(missed) / 24.0, outcome["followups"][0]["margin"]["mean"], 4)


class ClusteringTests(unittest.TestCase):
    """Intervals must widen for correlated briefs, or they are decoration."""

    def test_the_ranking_interval_is_wider_than_the_same_data_treated_as_independent(self):
        entries, briefs, gold = corpus(moves=10, per_move=3)
        clusters = sweep.cluster_keys(gold)
        # Every brief for an even numbered move hits, every brief for an odd one
        # misses, so all the variance sits between clusters.
        arms = {"lexical": arm(hits(lambda b: int(b.split("-")[0]) % 2 == 0), "lexical")}
        swept, _ = sweep.sweep(briefs, gold, entries, arms, (10,))
        row = sweep.rank(swept, clusters, "decision", 10)[0]

        ids = sorted(row["flags"])
        values = [row["flags"][i] for i in ids]
        clustered = row["interval"]
        independent = stats.clustered_mean(values, ids)

        self.assertEqual(clustered["mean"], independent["mean"])
        self.assertGreater(
            clustered["hi"] - clustered["lo"], independent["hi"] - independent["lo"]
        )
        self.assertEqual(10, clustered["clusters"])
        self.assertLess(clustered["n_eff"], clustered["n"])

    def test_the_cluster_key_is_the_target_move_not_the_brief(self):
        _, _, gold = corpus(moves=4, per_move=3)
        keys = sweep.cluster_keys(gold)
        self.assertEqual(4, len(set(keys.values())))
        self.assertEqual("move-0", keys["0-2"])

    def test_a_brief_whose_gold_names_no_move_gets_its_own_cluster(self):
        keys = sweep.cluster_keys({"lonely": {"best": []}, "0-0": {"best": ["move-0"]}})
        self.assertEqual("lonely", keys["lonely"])


class AvailabilityTests(unittest.TestCase):
    """A missing embedding index is a missing arm, not a losing one."""

    def setUp(self):
        self.entries, self.briefs, self.gold = corpus()
        self.clusters = sweep.cluster_keys(self.gold)
        self.vectors_patch = mock.patch.object(harness2, "VECTORS", "/nonexistent/vectors.json")
        self.vectors_patch.start()
        self.addCleanup(self.vectors_patch.stop)

    def test_an_arm_with_no_vectors_is_reported_unavailable_and_not_ranked(self):
        arms = {
            "lexical": sweep.decision_arms()["lexical"],
            "semantic": sweep.decision_arms()["semantic"],
            "hybrid@w=0.5": sweep.decision_arms()["hybrid@w=0.5"],
        }
        swept, unavailable = sweep.sweep(self.briefs, self.gold, self.entries, arms, (5,))
        self.assertEqual(["lexical"], sorted(swept))
        self.assertEqual(["hybrid@w=0.5", "semantic"], sorted(unavailable))
        for reason in unavailable.values():
            self.assertIn("vectors.json", reason)

        rows = sweep.rank(swept, self.clusters, "decision", 5)
        ranked = [row["arm"] for row in rows]
        # Not ranked last, which would read as a measured loss, and not carrying
        # lexical's numbers under another name.
        self.assertEqual(["lexical"], ranked)

    def test_the_available_arm_still_produces_a_real_curve(self):
        arms = {label: spec for label, spec in sweep.decision_arms().items()}
        swept, unavailable = sweep.sweep(
            self.briefs, self.gold, self.entries, arms, (2, 5)
        )
        self.assertIn("lexical", swept)
        self.assertEqual(4, len(unavailable))
        self.assertEqual([2, 5], sorted(swept["lexical"]["curve"]))


class ArmTests(unittest.TestCase):
    """The sweep's arms are the round two arms, not lookalikes."""

    def setUp(self):
        self.entries = {
            "move-alpha": "alpha orchard poised lucid",
            "move-beta": "beta harbor cobalt steady",
            "move-gamma": "gamma lantern quartz bright",
            "move-delta": "delta meadow saffron calm",
        }
        self.briefs = {
            "001": "alpha orchard arrives poised",
            "002": "beta harbor holds steady",
        }
        self.gold = {"001": {"best": ["move-alpha"]}, "002": {"best": ["move-beta"]}}
        moves = {name: _fixture_vector("move:" + name) for name in self.entries}
        vectors = {
            "model": "deterministic-local-fixture",
            "moves": moves,
            "briefs": {"001": moves["move-alpha"], "002": moves["move-delta"]},
        }
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        path = Path(self.temporary.name) / "vectors.json"
        path.write_text(json.dumps(vectors), encoding="utf-8")
        patcher = mock.patch.object(harness2, "VECTORS", str(path))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_equal_weight_fusion_is_exactly_the_round_two_hybrid_arm(self):
        equal = sweep.weighted_hybrid(0.5)
        for brief_id, text in self.briefs.items():
            for k in (1, 2, 3, 4):
                self.assertEqual(
                    harness2.hybrid_topk(brief_id, text, self.entries, k),
                    equal(brief_id, text, self.entries, k),
                    "hybrid@w=0.5 must be round two's hybrid at k={0}".format(k),
                )

    def test_fusion_weight_actually_moves_the_ranking(self):
        lexical_heavy = sweep.weighted_hybrid(0.05)("002", self.briefs["002"], self.entries, 1)
        semantic_heavy = sweep.weighted_hybrid(0.95)("002", self.briefs["002"], self.entries, 1)
        self.assertEqual(["move-beta"], lexical_heavy)
        self.assertEqual(["move-delta"], semantic_heavy)

    def test_the_flag_loop_agrees_with_the_recall_module_brief_for_brief(self):
        for arm_name in ("lexical", "semantic", "hybrid"):
            with self.subTest(arm=arm_name):
                self.assertEqual(
                    recall.shown_flags(arm_name, self.briefs, self.gold, self.entries, 2),
                    sweep.arm_flags(
                        sweep._base_arm(arm_name), self.briefs, self.gold, self.entries, 2
                    ),
                )


def swept_arm(family, hits_at_k, brief_ids, tier="decision"):
    """A swept arm built from which briefs it shows the gold move to at each k.

    Built directly rather than through a retriever so the curve can be given the
    exact shape under test, including the one every real retriever reaches: a
    list as long as the shelf shows every brief its own move.
    """
    flags = {
        k: {brief: (1.0 if brief in shown else 0.0) for brief in brief_ids}
        for k, shown in hits_at_k.items()
    }
    return {
        "family": family,
        "tier": tier,
        "flags": flags,
        "curve": {
            k: round(sum(f.values()) / len(f), 4) for k, f in flags.items()
        },
    }


class ShelfLengthListTests(unittest.TestCase):
    """Arms are compared at the same k, and never at a shelf-length list.

    Two ways of choosing k are wrong here and both were live at some point.
    Taking each arm's highest recall selects the longest swept k, because recall
    rises with k by construction, and at a k as long as the shelf every arm
    scores 1.0 by showing the whole thing, which is round 2's control cell and
    is fixed at 0.0. Taking each arm at its own knee reads as principled and
    quietly compares two different list lengths at two different prices. These
    tests fail against either.
    """

    TOKENS_PER_K = 63.0
    TOKENS_PER_RECALL = 23725.0

    def setUp(self):
        _, self.briefs, self.gold = corpus(moves=8, per_move=3)
        self.clusters = sweep.cluster_keys(self.gold)
        self.rule = sweep.parse_rule()
        self.ids = sorted(self.briefs)
        self.shelf_size = len(self.ids)
        strong, weak = self.ids[:16], self.ids[:12]
        # Both arms flatten early and both reach every brief once the list is
        # the whole shelf, which is the only k where they are equal.
        self.swept = {
            "lexical": swept_arm(
                "lexical",
                {5: strong, 10: strong, self.shelf_size: self.ids},
                self.ids,
            ),
            "semantic": swept_arm(
                "semantic",
                {5: weak, 10: weak, self.shelf_size: self.ids},
                self.ids,
            ),
        }

    def ranked(self, at_k, shelf_size=None):
        return sweep.rank(self.swept, self.clusters, "decision", at_k, shelf_size)

    def test_every_arm_in_a_ranking_sits_at_the_same_k(self):
        for at_k in (5, 10):
            ks = {row["k"] for row in self.ranked(at_k, self.shelf_size)}
            self.assertEqual({at_k}, ks)

    def test_a_shelf_length_k_is_refused_rather_than_ranked(self):
        with self.assertRaises(SystemExit):
            self.ranked(self.shelf_size, self.shelf_size)

    def test_a_ranking_with_no_k_is_refused_rather_than_choosing_one(self):
        # The old failure mode was rank picking k for itself. It must not have
        # a default to fall back to.
        with self.assertRaises(SystemExit):
            sweep.rank(self.swept, self.clusters, "decision", None, self.shelf_size)

    def test_the_arms_stay_distinguishable_instead_of_tying_at_perfect_recall(self):
        rows = self.ranked(5, self.shelf_size)
        self.assertEqual(["lexical", "semantic"], [row["arm"] for row in rows])
        self.assertGreater(rows[0]["interval"]["mean"], rows[1]["interval"]["mean"])
        # Ahead on what it retrieves, not tied at 1.0 by naming the whole shelf.
        self.assertAlmostEqual(16 / 24.0, rows[0]["interval"]["mean"], places=3)
        self.assertAlmostEqual(12 / 24.0, rows[1]["interval"]["mean"], places=3)

    def test_the_whole_shelf_k_stays_in_the_curve_it_is_only_out_of_the_ranking(self):
        # Dropping it from the curve too would hide the ceiling, which is the
        # one thing the long tail of the sweep is there to show.
        self.assertEqual(1.0, self.swept["lexical"]["curve"][self.shelf_size])
        kept = sweep.rankable_ks(self.swept["lexical"]["curve"], self.shelf_size)
        self.assertEqual([5, 10], sorted(kept))

    def test_the_rule_is_read_at_every_k_below_the_shelf_and_no_others(self):
        across = sweep.decide_across_ks(
            self.swept, self.clusters, self.rule, (5, 10, self.shelf_size), self.shelf_size
        )
        self.assertEqual([5, 10], [result["k"] for result in across])


class KneeIsNotAComparisonTests(unittest.TestCase):
    """The reversal this round actually hit, kept as a regression.

    One arm is better at every list length. The other reaches nearly the same
    recall only by running a longer, more expensive list. Compared at their own
    knees they tie, and the tie hands the decision to the weaker arm through the
    tiebreak. Compared at the same k, the stronger arm separates. The ranking
    must do the second, because the first calls two different budgets a draw.
    """

    TOKENS_PER_K = 63.0
    TOKENS_PER_RECALL = 23725.0

    def setUp(self):
        # One brief per move, which is the shape wave 1 actually produced, so
        # the clusters are the briefs and the interval is not doing anything
        # exotic while the point under test is made.
        _, self.briefs, self.gold = corpus(moves=100, per_move=1)
        self.clusters = sweep.cluster_keys(self.gold)
        self.rule = sweep.parse_rule()
        ids = sorted(self.briefs)
        self.shelf_size = 400
        # Shaped after the real curves. The hybrid arm is ahead at both list
        # lengths. The lexical arm only comes close by being given the longer,
        # more expensive one.
        self.swept = {
            "hybrid@w=0.3": swept_arm("hybrid", {80: ids[:90], 120: ids[:96]}, ids),
            "lexical": swept_arm("lexical", {80: ids[:72], 120: ids[:88]}, ids),
        }

    def test_each_arm_at_its_own_knee_makes_the_weaker_arm_look_equal(self):
        knees = {
            label: sweep.knee(arm["curve"], self.TOKENS_PER_K, self.TOKENS_PER_RECALL)[0]
            for label, arm in self.swept.items()
        }
        # The knees genuinely differ, which is the whole trap: the comparison
        # would be 80 slots against 120.
        self.assertEqual(80, knees["hybrid@w=0.3"])
        self.assertEqual(120, knees["lexical"])
        knee_to_knee = (
            self.swept["lexical"]["curve"][120]
            - self.swept["hybrid@w=0.3"]["curve"][80]
        )
        self.assertLess(abs(knee_to_knee), 0.05)

    def test_at_a_matched_k_the_stronger_arm_separates_and_ships(self):
        for at_k in (80, 120):
            rows = sweep.rank(self.swept, self.clusters, "decision", at_k, self.shelf_size)
            outcome = sweep.decide(rows, self.rule, self.clusters)
            self.assertEqual("hybrid@w=0.3", rows[0]["arm"], at_k)
            self.assertEqual("separated", outcome["branch"], at_k)
            self.assertEqual("hybrid@w=0.3", outcome["ship"], at_k)

    def test_every_comparable_k_agrees_so_the_choice_of_k_never_decided_it(self):
        across = sweep.decide_across_ks(
            self.swept, self.clusters, self.rule, (80, 120), self.shelf_size
        )
        shipped = {result["outcome"]["ship"] for result in across}
        self.assertEqual({"hybrid@w=0.3"}, shipped)

    def test_the_operating_point_is_the_knee_of_the_family_that_won(self):
        # The knee still answers the question it is good for, which is how long
        # to make the list once the arm is chosen.
        point = sweep.operating_point(
            self.swept, "hybrid", self.TOKENS_PER_K, self.TOKENS_PER_RECALL,
            self.shelf_size,
        )
        self.assertEqual("hybrid@w=0.3", point["arm"])
        self.assertEqual(80, point["k"])


class KneeTests(unittest.TestCase):
    """The knee is where added recall stops covering the tokens it costs."""

    TOKENS_PER_K = 63.0
    TOKENS_PER_RECALL = 23725.0

    def knee(self, curve):
        return sweep.knee(curve, self.TOKENS_PER_K, self.TOKENS_PER_RECALL)

    def test_flat_recall_knees_at_the_shortest_k_without_crashing(self):
        flat = {k: 0.5 for k in (5, 10, 20, 40)}
        self.assertEqual((5, False), self.knee(flat))

    def test_a_curve_that_keeps_paying_reports_no_knee_within_the_sweep(self):
        steep = {k: k / 100.0 for k in (5, 10, 20, 40)}
        at, exhausted = self.knee(steep)
        self.assertEqual(40, at)
        self.assertTrue(exhausted)

    def test_the_knee_lands_where_the_curve_flattens(self):
        curve = {5: 0.20, 10: 0.40, 20: 0.60, 40: 0.601, 80: 0.602}
        self.assertEqual((20, False), self.knee(curve))

    def test_raising_the_tail_never_moves_the_knee_earlier(self):
        base = {5: 0.20, 10: 0.40, 20: 0.60, 40: 0.601, 80: 0.602}
        raised = dict(base)
        raised[40] = 0.80
        raised[80] = 0.95
        self.assertGreaterEqual(self.knee(raised)[0], self.knee(base)[0])

    def test_a_single_point_curve_has_nowhere_to_knee(self):
        self.assertEqual((5, False), self.knee({5: 0.3}))
        self.assertEqual((None, False), self.knee({}))

    def test_the_prices_come_from_round_two_and_not_from_a_guess(self):
        slope, intercept = sweep.token_model()
        # 538 tokens at k=5 and 1481 at k=20 is about 63 tokens a slot.
        self.assertAlmostEqual(63.0, slope, delta=1.0)
        self.assertGreater(intercept, 0)
        self.assertAlmostEqual(23725.0, sweep.recall_price(), delta=1.0)


class ConvergenceTests(unittest.TestCase):
    def test_arms_landing_together_at_the_longest_k_read_as_converged(self):
        swept = {
            "lexical": {"curve": {5: 0.2, 80: 0.77}},
            "semantic": {"curve": {5: 0.3, 80: 0.775}},
        }
        self.assertTrue(sweep.converged(swept, (5, 80)))

    def test_a_persistent_gap_is_not_convergence(self):
        swept = {
            "lexical": {"curve": {5: 0.2, 80: 0.60}},
            "semantic": {"curve": {5: 0.3, 80: 0.90}},
        }
        self.assertFalse(sweep.converged(swept, (5, 80)))

    def test_one_arm_alone_cannot_converge_with_anything(self):
        self.assertFalse(sweep.converged({"lexical": {"curve": {80: 0.7}}}, (80,)))


class NoNetworkTests(unittest.TestCase):
    def test_the_whole_sweep_and_decision_make_no_network_call(self):
        entries, briefs, gold = corpus(moves=4, per_move=2)
        clusters = sweep.cluster_keys(gold)
        arms = {"lexical": arm(ALWAYS, "lexical"), "semantic": arm(NEVER, "semantic")}
        blocked = AssertionError("the sweep must never reach the network")
        with mock.patch.object(urllib.request, "urlopen", side_effect=blocked), \
                mock.patch.object(provider.urllib.request, "urlopen", side_effect=blocked), \
                mock.patch.object(provider, "chat", side_effect=blocked), \
                mock.patch.object(provider, "embed", side_effect=blocked):
            swept, _ = sweep.sweep(briefs, gold, entries, arms, (5,))
            rows = sweep.rank(swept, clusters, "decision", 5)
            outcome = sweep.decide(rows, sweep.parse_rule(), clusters)
        self.assertEqual("separated", outcome["branch"])

    def test_the_module_imports_no_network_client(self):
        with open(os.path.join(sweep.HERE, "sweep.py"), encoding="utf-8") as fh:
            source = fh.read()
        for forbidden in ("urllib", "http.client", "socket", "requests", "provider"):
            self.assertNotIn(forbidden, source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
