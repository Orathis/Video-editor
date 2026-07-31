#!/usr/bin/env python3
"""Offline checks for the clustered statistics used by round 3.

Run with: cd evals/catalog-retrieval/round3 && python3 -m unittest test_stats -v

No network, no third party packages, and the one test that touches real data
reads round 2's committed recall log from disk.
"""

import glob
import json
import math
import os
import random
import statistics
import unittest

import stats

HERE = os.path.dirname(os.path.abspath(__file__))
ROUND2 = os.path.join(HERE, "..", "round2")


def round2_recall(cell):
    """Round 2's per brief recall for one cell, keyed by its gold target move.

    The cluster key is the gold best move rather than the brief id, which is the
    whole point: two briefs written for the same move are one observation and a
    bit, not two.
    """
    gold = {}
    for path in sorted(glob.glob(os.path.join(ROUND2, "gold", "*.json"))):
        brief = os.path.basename(path).split(".")[0]
        with open(path, encoding="utf-8") as fh:
            gold[brief] = json.load(fh)
    with open(os.path.join(ROUND2, "recall-log.json"), encoding="utf-8") as fh:
        log = json.load(fh)[cell]
    briefs = sorted(log)
    values = [1.0 if log[brief] else 0.0 for brief in briefs]
    moves = [
        gold[brief]["best"][0] if gold[brief]["best"] else brief for brief in briefs
    ]
    return values, moves


def unclustered_interval(values):
    """The interval round 2 would have reported if it had reported one at all."""
    n = len(values)
    mean = statistics.fmean(values)
    half = stats.t_critical(n - 1) * statistics.stdev(values) / math.sqrt(n)
    return round(mean - half, 4), round(mean + half, 4)


class ClusteredMean(unittest.TestCase):
    def test_one_brief_per_cluster_matches_the_unclustered_interval(self):
        # Design effect 1, so switching every mean to the clustered estimator
        # cannot widen an interval that was already honest.
        values = [0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0]
        keys = [f"move-{i}" for i in range(len(values))]
        result = stats.clustered_mean(values, keys)
        self.assertEqual(1.0, result["design_effect"])
        self.assertEqual(len(values), result["n_eff"])
        self.assertEqual(unclustered_interval(values), (result["lo"], result["hi"]))

    def test_every_brief_on_one_move_leaves_one_effective_observation(self):
        # The failure mode this module exists to prevent. Twenty briefs written
        # for the same move do not measure that move twenty times, and an
        # interval near zero here would let the round conclude something the
        # corpus never measured.
        values = [1.0] * 15 + [0.0] * 5
        result = stats.clustered_mean(values, ["single-move"] * 20)
        self.assertEqual(1, result["clusters"])
        self.assertEqual(1.0, result["n_eff"])
        self.assertEqual(math.inf, result["se"])
        self.assertFalse(math.isfinite(result["hi"] - result["lo"]))
        self.assertEqual("unbounded", stats.format_interval(result))

    def test_clustering_widens_a_real_correlated_interval(self):
        # Round 2's hybrid cell, once against its gold moves and once pretending
        # every brief is its own move. The second is what round 2 published.
        values, moves = round2_recall("h@10")
        clustered = stats.clustered_mean(values, moves)
        naive = stats.clustered_mean(values, list(range(len(values))))
        self.assertEqual(clustered["mean"], naive["mean"])
        self.assertGreater(clustered["hi"] - clustered["lo"], naive["hi"] - naive["lo"])
        self.assertLess(clustered["n_eff"], naive["n_eff"])

    def test_unequal_cluster_sizes_are_handled(self):
        # A wave that stops partway through leaves some moves with three briefs
        # and some with one, so the unequal size correction is the normal case
        # rather than an edge.
        values = [1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0]
        keys = ["a", "a", "a", "b", "b", "c", "d"]
        result = stats.clustered_mean(values, keys)
        self.assertEqual(4, result["clusters"])
        self.assertEqual(7, result["n"])
        self.assertLess(result["n_eff"], 7)
        self.assertTrue(math.isfinite(result["se"]))

    def test_a_constant_column_has_no_sampling_error(self):
        # Round 2's full shelf cell shows gold to every brief, so its recall is
        # 1.0 with nothing to be uncertain about. Reporting a spread here would
        # be an invented one.
        values, moves = round2_recall("b")
        result = stats.clustered_mean(values, moves)
        self.assertEqual(1.0, result["mean"])
        self.assertEqual(0.0, result["se"])
        self.assertEqual((1.0, 1.0), (result["lo"], result["hi"]))

    def test_empty_and_single_observation_do_not_crash(self):
        empty = stats.clustered_mean([], [])
        self.assertEqual(0, empty["n"])
        self.assertEqual(0.0, empty["n_eff"])
        lone = stats.clustered_mean([0.5], ["only-move"])
        self.assertEqual(0.5, lone["mean"])
        self.assertEqual(1.0, lone["n_eff"])
        self.assertEqual(math.inf, lone["se"])

    def test_a_cluster_key_with_no_briefs_contributes_nothing(self):
        # Callers iterate the observed briefs, not the move list, so a move that
        # no wave has reached yet cannot appear as an empty group.
        by_move = {"a": [1.0, 0.0], "b": [], "c": [1.0]}
        values = [v for move in by_move for v in by_move[move]]
        keys = [move for move in by_move for _ in by_move[move]]
        result = stats.clustered_mean(values, keys)
        self.assertEqual(2, result["clusters"])
        self.assertEqual(3, result["n"])


class IntraClusterCorrelation(unittest.TestCase):
    def test_a_known_correlation_is_recovered(self):
        # Built to a target of 0.30: cluster effects carry 30 percent of
        # the total variance and within-cluster noise the other 70.
        rng = random.Random(11)
        values, keys = [], []
        for cluster in range(400):
            effect = rng.gauss(0.0, math.sqrt(0.30))
            for _ in range(5):
                values.append(effect + rng.gauss(0.0, math.sqrt(0.70)))
                keys.append(f"move-{cluster}")
        icc, design_effect, n_eff = stats.intra_cluster_correlation(values, keys)
        self.assertAlmostEqual(0.30, icc, delta=0.05)
        # Five briefs per move at this correlation is the round 3 shape, and the
        # plan's stated design effect for it is about 2.3.
        self.assertAlmostEqual(2.2, design_effect, delta=0.25)
        self.assertLess(n_eff, len(values))

    def test_identical_values_inside_every_cluster_saturate(self):
        values = [1.0, 1.0, 0.0, 0.0, 1.0, 1.0]
        keys = ["a", "a", "b", "b", "c", "c"]
        icc, _, n_eff = stats.intra_cluster_correlation(values, keys)
        self.assertEqual(1.0, icc)
        self.assertAlmostEqual(3.0, n_eff, delta=0.01)

    def test_a_negative_estimate_is_clamped_rather_than_inflating_the_corpus(self):
        # Clusters deliberately built so the within spread exceeds the between
        # spread. The raw estimator goes negative, and a negative design effect
        # would report more independent briefs than the corpus holds.
        values = [1.0, 0.0, 1.0, 0.0, 1.0, 0.0]
        keys = ["a", "a", "b", "b", "c", "c"]
        icc, design_effect, n_eff = stats.intra_cluster_correlation(values, keys)
        self.assertEqual(0.0, icc)
        self.assertEqual(1.0, design_effect)
        self.assertEqual(len(values), n_eff)

    def test_round2_hybrid_k10_effective_sample_is_not_227(self):
        # The verification number for this unit. Reference values in the plan
        # doc (icc 0.326, effective n about 199) were measured by hand from the
        # paid run log's per brief fit column, which is not in this repo. What is
        # in the repo is recall-log.json, so these are the same statistic
        # computed on recall over the same 227 briefs and the same 158 gold
        # moves. The load-bearing claim is unchanged either way: the effective
        # sample is near 190 to 200, not 227, so round 2's published means were
        # over-precise.
        values, moves = round2_recall("h@10")
        icc, design_effect, n_eff = stats.intra_cluster_correlation(values, moves)
        self.assertEqual(227, len(values))
        self.assertEqual(158, len(set(moves)))
        self.assertAlmostEqual(0.4328, icc, delta=0.005)
        self.assertAlmostEqual(1.1890, design_effect, delta=0.005)
        self.assertAlmostEqual(190.9, n_eff, delta=1.0)
        self.assertLess(n_eff, 205.0)

    def test_round2_semantic_k20_effective_sample_is_not_227(self):
        # The other cell the plan names. On recall this one lands at 199.7,
        # which is the "about 199, not 227" figure the plan reports.
        values, moves = round2_recall("d@20")
        icc, _, n_eff = stats.intra_cluster_correlation(values, moves)
        self.assertAlmostEqual(0.3127, icc, delta=0.005)
        self.assertAlmostEqual(199.7, n_eff, delta=1.0)


class ClusteredDifference(unittest.TestCase):
    def test_identical_arms_give_a_zero_difference_without_dividing_by_zero(self):
        values = [0.4, 0.9, 0.1, 0.6, 0.6]
        keys = ["a", "a", "b", "c", "c"]
        result = stats.clustered_difference(values, list(values), keys)
        self.assertEqual(0.0, result["mean"])
        self.assertEqual(0.0, result["se"])
        self.assertEqual((0.0, 0.0), (result["lo"], result["hi"]))

    def test_a_paired_difference_is_narrower_than_the_two_columns_apart(self):
        # Pairing is what holds brief difficulty fixed. A constant per brief
        # margin has to read as a real separation however noisy the briefs are.
        rng = random.Random(3)
        keys, arm, baseline = [], [], []
        for cluster in range(60):
            level = rng.gauss(0.5, 0.3)
            for _ in range(3):
                brief = level + rng.gauss(0.0, 0.2)
                baseline.append(brief)
                arm.append(brief + 0.05)
                keys.append(f"move-{cluster}")
        result = stats.clustered_difference(arm, baseline, keys)
        self.assertAlmostEqual(0.05, result["mean"], places=4)
        self.assertGreater(result["lo"], 0.0)

    def test_a_mismatched_pairing_raises_instead_of_truncating(self):
        with self.assertRaises(ValueError):
            stats.clustered_difference([1.0, 0.0], [1.0], ["a", "b"])


class Multipliers(unittest.TestCase):
    def test_small_samples_get_a_wider_multiplier_than_the_normal_limit(self):
        self.assertEqual(math.inf, stats.t_critical(0))
        self.assertGreater(stats.t_critical(1), 12.0)
        self.assertGreater(stats.t_critical(5), stats.t_critical(50))
        self.assertAlmostEqual(1.96, stats.t_critical(100000), delta=0.005)

    def test_the_multiplier_falls_monotonically(self):
        previous = math.inf
        for df in list(range(1, 200)) + [500, 2000]:
            current = stats.t_critical(df)
            self.assertLessEqual(current, previous, df)
            previous = current


if __name__ == "__main__":
    unittest.main(verbosity=2)
