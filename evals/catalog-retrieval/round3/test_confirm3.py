#!/usr/bin/env python3
"""The confirmation reports the two things recall cannot see, and keeps them apart.

Refusing and picking a known-wrong move are opposite failures with opposite
fixes, and both are invisible to offline recall. A confirmation that folded
them into one number, or that let one stand in for the other, would leave the
paid stage measuring nothing the free stage had not already decided.
"""

import unittest

import confirm3

# A two entry shelf is enough: every assertion here is about which failure a run
# committed, not about how well the shelf covers a brief.
SHELF = {
    "fade": {"name": "fade", "blurb": "a fade"},
    "wipe": {"name": "wipe", "blurb": "a wipe"},
}
# Four briefs over two target moves, so a cluster genuinely holds more than one
# brief and the interval has something to be robust to.
GOLD = {
    "001": {"best": ["fade"], "bad": ["wipe"]},
    "002": {"best": ["fade"], "bad": ["wipe"]},
    "003": {"best": ["wipe"], "bad": ["fade"]},
    "004": {"best": ["wipe"], "bad": ["fade"]},
}


def record(brief, condition, moves, k=10):
    return {
        "brief": brief,
        "condition": condition,
        "k": k,
        "picks": [{"move": m, "why": "because"} for m in moves],
        "shown": ["fade", "wipe"],
    }


class ConfirmTests(unittest.TestCase):
    def test_a_refusal_and_a_known_wrong_pick_are_counted_separately(self):
        # Cell r refuses on every brief. Cell w answers on every brief and names
        # a known-wrong move on every one. Both score badly; they must not score
        # the same way, because "showed it the answer and it said nothing" and
        # "showed it the answer and it named the trap" call for opposite fixes.
        records = [record(b, "r", []) for b in GOLD]
        records += [record(b, "w", [GOLD[b]["best"][0], GOLD[b]["bad"][0]]) for b in GOLD]
        cells = confirm3.confirm(records, GOLD, SHELF)

        self.assertEqual(1.0, cells["r@10"]["refusal"]["mean"])
        self.assertEqual(0.0, cells["r@10"]["known_wrong_pick"]["mean"])
        self.assertEqual(0.0, cells["w@10"]["refusal"]["mean"])
        self.assertEqual(1.0, cells["w@10"]["known_wrong_pick"]["mean"])

    def test_a_clean_answer_scores_neither_failure(self):
        records = [record(b, "h", GOLD[b]["best"]) for b in GOLD]
        cells = confirm3.confirm(records, GOLD, SHELF)
        self.assertEqual(0.0, cells["h@10"]["refusal"]["mean"])
        self.assertEqual(0.0, cells["h@10"]["known_wrong_pick"]["mean"])
        self.assertEqual(1.0, cells["h@10"]["fit"]["mean"])

    def test_every_rate_carries_an_interval_clustered_by_target_move(self):
        # Two moves behind four briefs. Clustering on the brief would report two
        # clusters' worth of information as four, which is the mistake the whole
        # round is built to avoid.
        records = [record(b, "h", GOLD[b]["best"]) for b in GOLD]
        cells = confirm3.confirm(records, GOLD, SHELF)
        summary = cells["h@10"]
        self.assertEqual(4, summary["n"])
        self.assertEqual(2, summary["clusters"])
        for name, _ in confirm3.METRICS:
            self.assertIn("lo", summary[name])
            self.assertIn("hi", summary[name])
            self.assertEqual(2, summary[name]["clusters"])

    def test_cells_that_differ_only_in_k_are_never_merged(self):
        # The confirmation exists to change exactly one variable between cells.
        # Folding h@10 and h@80 together would change two.
        records = [record(b, "h", GOLD[b]["best"], k=10) for b in GOLD]
        records += [record(b, "h", [], k=80) for b in GOLD]
        cells = confirm3.confirm(records, GOLD, SHELF)
        self.assertEqual({"h@10", "h@80"}, set(cells))
        self.assertEqual(0.0, cells["h@10"]["refusal"]["mean"])
        self.assertEqual(1.0, cells["h@80"]["refusal"]["mean"])

    def test_a_run_whose_gold_was_pruned_away_is_not_scored(self):
        # Averaging over it would report a corpus that was never run.
        records = [record("999", "h", ["fade"])] + [record("001", "h", ["fade"])]
        cells = confirm3.confirm(records, GOLD, SHELF)
        self.assertEqual(1, cells["h@10"]["n"])


class PairedTests(unittest.TestCase):
    """The two cells are compared brief by brief, never as two column means."""

    def rows(self, records):
        import build_report2

        return build_report2.score_all(records, GOLD, SHELF)

    def test_the_difference_is_taken_on_the_briefs_both_cells_ran(self):
        # Cell h answers everything. Cell c answers everything except 004, and
        # gets 003 wrong. Two column means would divide by different denominators
        # and read the missing brief as a difference in quality.
        records = [record(b, "h", GOLD[b]["best"]) for b in GOLD]
        records += [record(b, "c", GOLD[b]["best"]) for b in ("001", "002")]
        records += [record("003", "c", [GOLD["003"]["bad"][0]])]
        difference = confirm3.paired(self.rows(records), "h@10", "c@10")

        # Three shared briefs, and h names a known-wrong move on none of them
        # while c names one on 003, so the difference is negative: the leader
        # commits that failure a third of a brief less often than the baseline.
        self.assertEqual(3, difference["n"])
        self.assertEqual(-0.3333, difference["known_wrong_pick"]["mean"])
        self.assertEqual(0.0, difference["refusal"]["mean"])

    def test_two_cells_that_did_the_same_thing_differ_by_exactly_zero(self):
        records = [record(b, "h", GOLD[b]["best"]) for b in GOLD]
        records += [record(b, "c", GOLD[b]["best"]) for b in GOLD]
        difference = confirm3.paired(self.rows(records), "h@10", "c@10")
        for name, _ in confirm3.METRICS:
            self.assertEqual(0.0, difference[name]["mean"], name)
            self.assertEqual(0.0, difference[name]["lo"], name)
            self.assertEqual(0.0, difference[name]["hi"], name)

    def test_a_cell_that_never_ran_pairs_against_nothing(self):
        # Silently returning a difference over zero briefs would report a
        # comparison that was never made as one that came out even.
        records = [record(b, "h", GOLD[b]["best"]) for b in GOLD]
        difference = confirm3.paired(self.rows(records), "h@10", "c@10")
        self.assertEqual(0, difference["n"])


if __name__ == "__main__":
    unittest.main()
