#!/usr/bin/env python3
"""Offline tests for the round-three recall harness.

The load-bearing test is the equivalence proof: recomputing recall locally must
reproduce, brief for brief, what the paid round-two grid logged. Without it the
offline sweep is a plausible-looking second opinion rather than the same
measurement, and the whole recall-first plan rests on it.
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
# recall puts the round two directory on the path, so it has to be imported
# before anything that lives there.
import harness2  # noqa: E402
import provider  # noqa: E402


RECALL_LOG = os.path.join(recall.ROUND2, "recall-log.json")
# Cell labels in the paid grid's log. c is lexical, d is semantic, h is hybrid,
# and the suffix is the list length that cell ran at.
LOGGED_CELLS = {
    "lexical": {5: "c@5", 10: "c@10", 20: "c@20"},
    "semantic": {5: "d@5", 10: "d@10", 20: "d@20"},
    "hybrid": {10: "h@10"},
}
NO_ROUND2_VECTORS = (
    "round two vectors are absent at {0}, so the semantic and hybrid arms "
    "cannot be recomputed. This test runs unchanged once that file exists."
).format(recall.VECTORS)


def _fixture_vector(seed, dimensions=32):
    digest = hashlib.sha256(seed.encode()).digest()
    rng = random.Random(int.from_bytes(digest[:8], "big"))
    values = [rng.gauss(0.0, 1.0) for _ in range(dimensions)]
    length = math.sqrt(sum(value * value for value in values))
    return [value / length for value in values]


class EquivalenceTests(unittest.TestCase):
    """Recomputed recall against the recall the paid grid actually logged."""

    @classmethod
    def setUpClass(cls):
        cls.entries = harness2.load_shelf()
        cls.briefs = recall.load_briefs()
        cls.gold = recall.load_gold()
        with open(RECALL_LOG, encoding="utf-8") as fh:
            cls.log = json.load(fh)

    def assert_matches_log(self, arm):
        for k, cell in sorted(LOGGED_CELLS[arm].items()):
            logged = self.log[cell]
            flags = recall.shown_flags(arm, self.briefs, self.gold, self.entries, k)
            self.assertEqual(len(logged), len(flags))
            disagreements = [b for b, want in logged.items() if flags[b] != want]
            self.assertEqual([], disagreements, "{0}: {1}".format(cell, disagreements))

    def test_lexical_recall_reproduces_the_paid_grid_brief_for_brief(self):
        self.assertEqual(227, len(self.briefs))
        self.assert_matches_log("lexical")

    def test_semantic_recall_reproduces_the_paid_grid_brief_for_brief(self):
        if not os.path.exists(recall.VECTORS):
            self.skipTest(NO_ROUND2_VECTORS)
        self.assert_matches_log("semantic")

    def test_hybrid_recall_reproduces_the_paid_grid_brief_for_brief(self):
        if not os.path.exists(recall.VECTORS):
            self.skipTest(NO_ROUND2_VECTORS)
        self.assert_matches_log("hybrid")

    def test_a_brief_whose_gold_was_pruned_is_skipped_not_scored_as_a_miss(self):
        first = sorted(self.briefs)[0]
        briefs = {first: self.briefs[first], "pruned": "orchid saffron lantern"}
        gold = {first: self.gold[first]}
        flags = recall.shown_flags("lexical", briefs, gold, self.entries, 424)
        self.assertEqual([first], sorted(flags))
        # Scored as a miss the rate would be 0.5. Skipped, the one scorable
        # brief carries the whole number.
        self.assertEqual(1.0, recall.recall("lexical", briefs, gold, self.entries, 424))

    def test_k_beyond_the_shelf_returns_full_recall_rather_than_raising(self):
        oversized = len(self.entries) * 3
        self.assertEqual(
            1.0,
            recall.recall("lexical", self.briefs, self.gold, self.entries, oversized),
        )

    def test_empty_corpus_and_empty_gold_do_not_divide_by_zero(self):
        self.assertEqual(0.0, recall.recall("lexical", {}, {}, self.entries, 10))
        self.assertEqual(0.0, recall.recall("lexical", self.briefs, {}, self.entries, 10))
        self.assertEqual({}, recall.shown_flags("lexical", {}, self.gold, self.entries, 10))


class SweepTests(unittest.TestCase):
    """Properties that hold for every arm, exercised on a local fixture.

    The fixture carries its own vectors so the semantic and hybrid arms are
    genuinely exercised here even while round two's vector file is missing.
    """

    def setUp(self):
        self.entries = {
            "move-alpha": "alpha orchard poised lucid",
            "move-beta": "beta harbor cobalt steady",
            "move-gamma": "gamma lantern quartz bright",
            "move-delta": "delta meadow saffron calm",
            "move-epsilon": "epsilon ridge basalt firm",
            "move-zeta": "zeta thicket amber slow",
        }
        self.briefs = {
            "001": "alpha orchard arrives poised",
            "002": "beta harbor holds steady",
            "003": "gamma lantern burns bright",
        }
        self.gold = {
            "001": {"best": ["move-alpha"]},
            "002": {"best": ["move-beta"]},
            "003": {"best": ["move-gamma"]},
        }
        moves = {name: _fixture_vector("move:" + name) for name in self.entries}
        vectors = {
            "model": "deterministic-local-fixture",
            "moves": moves,
            "briefs": {
                "001": moves["move-alpha"],
                "002": moves["move-beta"],
                "003": moves["move-zeta"],
            },
        }
        self.temporary = tempfile.TemporaryDirectory()
        path = Path(self.temporary.name) / "vectors.json"
        path.write_text(json.dumps(vectors), encoding="utf-8")
        self.vectors_patch = mock.patch.object(harness2, "VECTORS", str(path))
        self.vectors_patch.start()

    def tearDown(self):
        self.vectors_patch.stop()
        self.temporary.cleanup()

    def test_recall_is_monotone_non_decreasing_in_k_for_every_arm(self):
        ks = (1, 2, 3, 4, 5, 6, 12)
        curves = recall.sweep(self.briefs, self.gold, self.entries, recall.ARMS, ks)
        for arm, curve in curves.items():
            with self.subTest(arm=arm):
                rates = [curve[k] for k in ks]
                # A top-k that is not a prefix of top-(k+1) shows up here as a
                # recall that falls when the list gets longer, which is the
                # signature of an off-by-one in the slice.
                self.assertEqual(sorted(rates), rates)
                self.assertEqual(1.0, curve[12])

    def test_the_sweep_makes_no_network_call(self):
        blocked = AssertionError("the recall sweep must never reach the network")
        with mock.patch.object(urllib.request, "urlopen", side_effect=blocked), \
                mock.patch.object(provider.urllib.request, "urlopen", side_effect=blocked), \
                mock.patch.object(provider, "chat", side_effect=blocked), \
                mock.patch.object(provider, "embed", side_effect=blocked):
            curves = recall.sweep(self.briefs, self.gold, self.entries, recall.ARMS, (3,))
        self.assertEqual(set(recall.ARMS), set(curves))


if __name__ == "__main__":
    unittest.main(verbosity=2)
