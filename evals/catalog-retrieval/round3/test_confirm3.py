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


class MultiTargetTests(unittest.TestCase):
    """A beat with two right answers is scored, not excluded."""

    # Three briefs over two near twins, plus one over a single move. 001 and 002
    # are answered by either twin, so they are one cluster.
    SHELF = {name: {"name": name, "blurb": name} for name in ("fade", "dissolve", "cut")}
    GOLD = {
        "001": {"best": ["fade", "dissolve"], "bad": ["cut"]},
        "002": {"best": ["dissolve", "fade"], "bad": ["cut"]},
        "003": {"best": ["cut"], "bad": ["fade"]},
    }

    def cells(self, records):
        return confirm3.confirm(records, self.GOLD, self.SHELF)

    def test_naming_either_acceptable_move_is_not_a_known_wrong_pick(self):
        # The metric this whole stage exists to measure. Under round 3's gold
        # the twin was simply absent from the corpus; under a set it is present
        # and must never be read as the trap.
        records = [
            record("001", "h", ["fade"]),
            record("002", "h", ["dissolve"]),
            record("003", "h", ["cut"]),
        ]
        cells = self.cells(records)
        self.assertEqual(0.0, cells["h@10"]["known_wrong_pick"]["mean"])
        self.assertEqual(0.0, cells["h@10"]["refusal"]["mean"])

    def test_fit_is_read_against_the_whole_set_not_against_one_of_them(self):
        # Both briefs name one acceptable move each, and they name different
        # ones. A scorer reading only the first listed move would score 002 at
        # zero fit, so the two rows separating here is the evidence the set is
        # what is being compared against.
        rows = confirm3.build_report2.score_all(
            [record("001", "h", ["fade"]), record("002", "h", ["fade"])],
            self.GOLD,
            self.SHELF,
        )
        self.assertEqual([0.6667, 0.6667], [row["fit"] for row in rows])
        self.assertTrue(all(row["passed"] for row in rows))

    def test_the_known_wrong_move_still_costs_the_run(self):
        # The other half of the same claim: widening gold to a set must not
        # quietly widen it to everything.
        cells = self.cells([record("001", "h", ["cut"])])
        self.assertEqual(1.0, cells["h@10"]["known_wrong_pick"]["mean"])
        self.assertEqual(0.0, cells["h@10"]["fit"]["mean"])

    def test_briefs_over_the_same_pair_count_as_one_cluster(self):
        records = [record(b, "h", self.GOLD[b]["best"][:1]) for b in self.GOLD]
        summary = self.cells(records)["h@10"]
        self.assertEqual(3, summary["n"])
        # Two clusters, not three: 001 and 002 are answered by the same pair.
        self.assertEqual(2, summary["clusters"])

    def test_a_record_that_scores_a_move_both_ways_is_refused(self):
        gold = {"001": {"best": ["fade", "cut"], "bad": ["cut"]}}
        with self.assertRaisesRegex(ValueError, "both acceptable and known-wrong"):
            confirm3.confirm([record("001", "h", ["fade"])], gold, self.SHELF)


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

    def test_two_cells_that_did_the_same_thing_differ_by_zero_but_not_by_certainty(self):
        # The point estimate is zero and the interval around it is not, because
        # two cells agreeing on this corpus is not the same as two cells that
        # cannot disagree. With nothing varying, the interval falls back to the
        # rule of three over the clusters.
        records = [record(b, "h", GOLD[b]["best"]) for b in GOLD]
        records += [record(b, "c", GOLD[b]["best"]) for b in GOLD]
        difference = confirm3.paired(self.rows(records), "h@10", "c@10")
        # Two target moves behind the four briefs, so the rule of three hands
        # back 1.5, wider than a difference of two rates can possibly be. It is
        # clipped to that range rather than printed as an impossible bound.
        bound = 1.0
        for name, _ in confirm3.METRICS:
            self.assertEqual(0.0, difference[name]["mean"], name)
            self.assertEqual(0.0, difference[name]["se"], name)
            self.assertEqual(-bound, difference[name]["lo"], name)
            self.assertEqual(bound, difference[name]["hi"], name)

    def test_a_cell_that_never_ran_is_refused_rather_than_scored_as_even(self):
        # Returning a difference over zero briefs reports a comparison that was
        # never made as one that came out even. Round 4 hit this for real: the
        # cells were asked for as "H@20/..." while the rows carry "h@20/...",
        # and all sixteen pairings came back +0.0000 over n=0, a table of clean
        # zeros that reads like two models agreeing.
        records = [record(b, "h", GOLD[b]["best"]) for b in GOLD]
        with self.assertRaisesRegex(SystemExit, "c@10 is not a cell"):
            confirm3.paired(self.rows(records), "h@10", "c@10")

    def test_the_refusal_names_the_cells_that_do_exist(self):
        # The failure is almost always a name that is close to a real one, so
        # the message has to carry the real ones or the reader is left diffing
        # a command line against a checkpoint by hand.
        records = [record(b, "h", GOLD[b]["best"]) for b in GOLD]
        with self.assertRaisesRegex(SystemExit, "Known cells: h@10"):
            confirm3.paired(self.rows(records), "H@10", "h@10")

    def test_two_cells_that_share_no_brief_are_refused_too(self):
        # Both names exist, so the name check passes, and the pairing is still
        # a difference over nothing.
        records = [record(b, "h", GOLD[b]["best"]) for b in ("001", "002")]
        records += [record(b, "c", GOLD[b]["best"]) for b in ("003", "004")]
        with self.assertRaisesRegex(SystemExit, "no brief ran in both"):
            confirm3.paired(self.rows(records), "h@10", "c@10")

    def test_a_brief_missing_from_one_cell_leaves_every_other_pairing_whole(self):
        # The shared set is per pairing. Computed once for the grid, a brief
        # only one cell skipped would shrink every comparison in the round
        # rather than the one it actually belongs to.
        records = [record(b, "h", GOLD[b]["best"]) for b in GOLD]
        records += [record(b, "c", GOLD[b]["best"]) for b in GOLD]
        records += [record(b, "d", GOLD[b]["best"]) for b in GOLD if b != "004"]
        rows = self.rows(records)
        self.assertEqual(3, confirm3.paired(rows, "d@10", "h@10")["n"])
        self.assertEqual(3, confirm3.paired(rows, "d@10", "c@10")["n"])
        # The cells that both ran everything are untouched by d's gap.
        self.assertEqual(4, confirm3.paired(rows, "h@10", "c@10")["n"])


class OneVariableTests(unittest.TestCase):
    """Exactly one of arm, k and model moves between two compared cells.

    This is the property the whole round rests on. A difference measured across
    two moving variables cannot be attributed to either of them, and the failure
    mode is not a wrong number but a right number with no meaning, which is why
    it is refused here rather than computed and qualified in the write-up.
    """

    A = "gemini-3.6-flash"
    B = "gpt-5.6-luna"

    def rows(self, cells):
        """One scored row per brief per named cell, all answering correctly."""
        out = []
        for cell in cells:
            parsed = confirm3.parse_cell(cell)
            for brief in GOLD:
                row = dict(
                    record(brief, parsed["arm"], GOLD[brief]["best"], k=parsed["k"])
                )
                if parsed["model"]:
                    row["model"] = parsed["model"]
                out.append(row)
        return confirm3.build_report2.score_all(out, GOLD, SHELF)

    def test_a_label_round_trips_through_the_key_it_came_from(self):
        # parse_cell is the inverse of cell_key and the two are read together,
        # so they are tested together. Drift between them is how a model cell
        # would be parsed as a k cell and compared against the wrong twin.
        for condition, k, model in (
            ("c", 80, None),
            ("h", 10, self.A),
            ("a", None, None),
            ("b", None, self.B),
        ):
            source = {"brief": "001", "condition": condition, "k": k}
            if model:
                source["model"] = model
            parsed = confirm3.parse_cell(confirm3.build_report2.cell_key(source))
            self.assertEqual(
                {"arm": condition, "k": k, "model": model}, parsed
            )

    def test_one_variable_at_a_time_is_compared(self):
        cells = ("h@10", "c@10", "h@80", "h@10/" + self.A, "h@10/" + self.B)
        rows = self.rows(cells)
        for cell, baseline, expected in (
            ("h@10", "c@10", "arm"),
            ("h@80", "h@10", "k"),
            ("h@10/" + self.B, "h@10/" + self.A, "model"),
        ):
            with self.subTest(cell=cell, baseline=baseline):
                self.assertEqual(
                    [expected], confirm3.paired(rows, cell, baseline)["changed"]
                )

    def test_two_variables_are_refused_rather_than_compared(self):
        rows = self.rows(("h@10", "c@80", "h@80/" + self.B, "h@10/" + self.A))
        for cell, baseline in (
            # Arm and k.
            ("h@10", "c@80"),
            # Arm and model, and k and model.
            ("h@80/" + self.B, "h@10/" + self.A),
        ):
            with self.subTest(cell=cell, baseline=baseline):
                with self.assertRaisesRegex(SystemExit, "exactly one of arm, k and model"):
                    confirm3.paired(rows, cell, baseline)

    def test_a_cell_paired_against_itself_is_refused_too(self):
        # Zero variables changed is the same defect as two: the output would be
        # a row of guaranteed zeroes presented as a measured tie.
        rows = self.rows(("h@10",))
        with self.assertRaisesRegex(SystemExit, "exactly one of arm, k and model"):
            confirm3.paired(rows, "h@10", "h@10")


class ConfoundTests(unittest.TestCase):
    """A cross-model difference is reported with its confound, never as clean."""

    VERTEX = "gemini-3.6-flash"
    OPENAI = "gpt-5.6-luna"
    ANTHROPIC = "claude-haiku-4-5"

    def rows(self, cells):
        return OneVariableTests.rows(self, cells)

    def test_the_temperature_confound_rides_along_with_the_model(self):
        # The openai family rejects temperature 0, which every round 2 and
        # round 3 cell used. So this pairing moves the model AND the sampling
        # temperature, and the output has to say so where the difference is
        # read rather than only in the provider that knows it.
        rows = self.rows(("h@10/" + self.VERTEX, "h@10/" + self.OPENAI))
        difference = confirm3.paired(
            rows, "h@10/" + self.OPENAI, "h@10/" + self.VERTEX
        )
        self.assertEqual(["model"], difference["changed"])
        self.assertEqual(1, len(difference["confounds"]))
        confound = difference["confounds"][0]
        self.assertIn("temperature", confound)
        self.assertIn("not a clean reproduction", confound)
        self.assertIn(self.OPENAI, confound)

    def test_the_confound_names_the_family_that_will_not_sample_at_zero(self):
        # Written the other way round, the openai cell is the baseline. A
        # sentence that always blamed the leader would then say the vertex model
        # rejects temperature 0, which is false, and false in the one paragraph
        # a reader consults to find out whether the comparison is clean.
        rows = self.rows(("h@10/" + self.VERTEX, "h@10/" + self.OPENAI))
        for cell, baseline in (
            ("h@10/" + self.OPENAI, "h@10/" + self.VERTEX),
            ("h@10/" + self.VERTEX, "h@10/" + self.OPENAI),
        ):
            with self.subTest(cell=cell):
                confound = confirm3.paired(rows, cell, baseline)["confounds"][0]
                blamed = confound.split("the family serving ")[1].split(" will not")[0]
                self.assertEqual("h@10/" + self.OPENAI, blamed)

    def test_two_models_sampled_the_same_way_carry_no_confound(self):
        # The other half of the claim. A confound that fired on every model
        # change would be noise rather than a finding, and would say nothing
        # about the one pairing where it is true.
        rows = self.rows(("h@10/" + self.VERTEX, "h@10/" + self.ANTHROPIC))
        difference = confirm3.paired(
            rows, "h@10/" + self.ANTHROPIC, "h@10/" + self.VERTEX
        )
        self.assertEqual(["model"], difference["changed"])
        self.assertEqual([], difference["confounds"])

    def test_an_arm_comparison_carries_no_model_confound(self):
        rows = self.rows(("h@10/" + self.OPENAI, "c@10/" + self.OPENAI))
        difference = confirm3.paired(
            rows, "h@10/" + self.OPENAI, "c@10/" + self.OPENAI
        )
        self.assertEqual([], difference["confounds"])

    def test_a_cell_that_records_no_model_does_not_claim_a_clean_comparison(self):
        # Round 2's checkpoint records no model. Pairing one of its cells
        # against a round 4 cell cannot establish what else differed, and
        # silence there would read as "nothing did".
        rows = self.rows(("h@10", "h@10/" + self.OPENAI))
        difference = confirm3.paired(rows, "h@10/" + self.OPENAI, "h@10")
        self.assertEqual(["model"], difference["changed"])
        self.assertIn("cannot be established", difference["confounds"][0])


if __name__ == "__main__":
    unittest.main()
