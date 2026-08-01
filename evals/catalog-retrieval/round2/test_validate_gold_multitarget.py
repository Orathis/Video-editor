#!/usr/bin/env python3
"""The committee emits a set, and reports its rate over the corpus it scored.

Round 3's audit reported 100.00 percent agreement, which was 100 percent by
construction: the briefs the committee could not reconstruct had already been
removed before the audit ran. The number therefore described the survivors and
nothing else, while the removed briefs, the near twins, were exactly the cases
where retrieval is hardest.

These tests pin the fix from both directions. A brief whose beat has two right
answers has to come out of the committee carrying both of them, and the reported
rate has to sit over every brief that was read, so a brief no set can be built
for lowers the number rather than disappearing from it.
"""

import io
import os
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import prune_corpus
import validate_gold

SHELF = {
    "fade": "group: transition\nwhat: a fade",
    "dissolve": "group: transition\nwhat: a dissolve, near twin of the fade",
    "cut": "group: transition\nwhat: a hard cut",
    "wipe": "group: transition\nwhat: a wipe",
}


def canned(move):
    parsed = {"move": move, "why": f"{move} answers the beat"}
    return parsed, "{}", {"total_tokens": 1}, 0.01


def gold(best, bad=()):
    return {
        "best": list(best),
        "acceptable": [],
        "bad": list(bad),
        "why_best": "fixture rationale",
        "why_bad": "fixture rationale",
        "trap": "fixture trap",
    }


class MultiTargetCommitteeTests(unittest.TestCase):
    def setUp(self):
        self.transport = patch.object(
            validate_gold.provider.urllib.request,
            "urlopen",
            side_effect=AssertionError("network access is disabled in this test suite"),
        )
        self.transport.start()
        self.addCleanup(self.transport.stop)

        self.workdir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.workdir, ignore_errors=True)
        env = patch.dict(
            validate_gold.os.environ,
            {
                "EVAL_COMMITTEE_CHECKPOINT": os.path.join(self.workdir, "committee.jsonl"),
                "EVAL_KILL_FILE": os.path.join(self.workdir, "STOP"),
            },
        )
        env.start()
        self.addCleanup(env.stop)

    def evaluate(self, briefs, gold_by_id, replies, **kwargs):
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            return validate_gold.evaluate_corpus(
                briefs, gold_by_id, SHELF, emit=lambda _line: None, **kwargs
            )

    def record(self, result, brief_id):
        return next(r for r in result["records"] if r["brief_id"] == brief_id)

    def test_a_near_twin_majority_joins_the_acceptable_set_instead_of_ending_the_brief(self):
        # Two of three independent readers, holding the whole shelf, placed this
        # beat on the twin. Round 3 read that as a corpus defect and removed the
        # brief; it is evidence that the beat has two right answers.
        result = self.evaluate(
            {"001": "a soft handoff between two shots"},
            {"001": gold(["fade"], bad=["cut"])},
            [canned("dissolve"), canned("dissolve"), canned("fade")],
        )
        record = self.record(result, "001")
        self.assertEqual(["fade", "dissolve"], record["acceptable_gold"])
        self.assertTrue(record["near_twin_merge"])
        self.assertFalse(record["unplaceable"])
        self.assertFalse(record["contested"])
        # The constructed target stays first, which is what the per-stratum rows
        # are read from.
        self.assertEqual("fade", record["acceptable_gold"][0])
        # And the strict rate still says the committee did not reconstruct it,
        # so the merge is visible rather than laundered.
        self.assertFalse(record["correct"])

    def test_a_reconstructed_brief_keeps_exactly_the_gold_it_was_written_from(self):
        result = self.evaluate(
            {"001": "a soft handoff between two shots"},
            {"001": gold(["fade"], bad=["cut"])},
            [canned("fade")] * 3,
        )
        record = self.record(result, "001")
        self.assertEqual(["fade"], record["acceptable_gold"])
        self.assertFalse(record["near_twin_merge"])
        self.assertTrue(record["correct"])
        self.assertEqual(1.0, result["accuracy"])
        self.assertEqual(1.0, result["scored_agreement"])

    def test_a_brief_no_two_readers_can_place_yields_no_set_and_is_counted(self):
        result = self.evaluate(
            {"001": "something the shelf does not carry"},
            {"001": gold(["fade"])},
            [canned("cut"), canned("wipe"), canned("dissolve")],
        )
        record = self.record(result, "001")
        self.assertIsNone(record["acceptable_gold"])
        self.assertTrue(record["unplaceable"])
        self.assertEqual(1, result["unplaceable_count"])
        self.assertEqual(0, result["scored_count"])
        self.assertEqual(0.0, result["scored_agreement"])

    def test_a_majority_the_constructor_ruled_out_is_contested_not_merged(self):
        # Merging would write a record listing one move as both the answer and
        # the trap, which gate2.acceptable refuses to read. Two reads are not
        # enough to overturn a hand-written gold record, so it goes to a human.
        result = self.evaluate(
            {"001": "a soft handoff between two shots"},
            {"001": gold(["fade"], bad=["cut"])},
            [canned("cut"), canned("cut"), canned("fade")],
        )
        record = self.record(result, "001")
        self.assertIsNone(record["acceptable_gold"])
        self.assertTrue(record["contested"])
        self.assertFalse(record["unplaceable"])
        self.assertEqual(1, result["contested_count"])

    def test_a_hand_decision_still_produces_a_single_move_set(self):
        result = self.evaluate(
            {"001": "a soft handoff between two shots"},
            {"001": gold(["fade"])},
            [canned("dissolve")] * 3,
            hand_decisions={"001": "wipe"},
        )
        record = self.record(result, "001")
        self.assertEqual(["wipe"], record["acceptable_gold"])
        self.assertFalse(record["near_twin_merge"])

    def test_the_reported_rate_covers_every_brief_read_not_the_survivors(self):
        # One brief merges, one cannot be placed at all. The survivor set is one
        # brief and would report 100 percent; the corpus that was read is two
        # briefs and reports half. Strict reconstruction is zero on both, which
        # is what makes the difference between the two numbers legible.
        result = self.evaluate(
            {"001": "a soft handoff", "002": "nothing the shelf carries"},
            {"001": gold(["fade"]), "002": gold(["fade"])},
            [
                canned("dissolve"), canned("dissolve"), canned("fade"),
                canned("cut"), canned("wipe"), canned("dissolve"),
            ],
        )
        self.assertEqual(2, result["total"])
        self.assertEqual(1, result["scored_count"])
        self.assertEqual(0.5, result["scored_agreement"])
        self.assertEqual(0.0, result["accuracy"])
        self.assertEqual(1, result["merged_count"])
        self.assertEqual(1, result["unplaceable_count"])

    def test_a_gold_record_that_scores_a_move_both_ways_stops_the_committee(self):
        with self.assertRaisesRegex(SystemExit, "both acceptable and known-wrong"):
            self.evaluate(
                {"001": "a soft handoff"},
                {"001": gold(["fade"], bad=["fade"])},
                [canned("fade")] * 3,
            )


class AgreementFloorTests(unittest.TestCase):
    """The floor is applied to the scored rate, not to the strict rate.

    Round 3 gated on strict reconstruction and failed at 75.21 percent, because
    a beat that two near twins answer equally well counted as a failure. Those
    briefs are scored now, so the gate moved onto the rate over the corpus that
    is actually scored. The strict rate stays reported and stops deciding.
    """

    def setUp(self):
        self.transport = patch.object(
            validate_gold.provider.urllib.request,
            "urlopen",
            side_effect=AssertionError("network access is disabled in this test suite"),
        )
        self.transport.start()
        self.addCleanup(self.transport.stop)

        self.workdir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.workdir, ignore_errors=True)
        env = patch.dict(
            validate_gold.os.environ,
            {
                "EVAL_COMMITTEE_CHECKPOINT": os.path.join(self.workdir, "committee.jsonl"),
                "EVAL_KILL_FILE": os.path.join(self.workdir, "STOP"),
            },
        )
        env.start()
        self.addCleanup(env.stop)

    def validate(self, briefs, gold_by_id, replies):
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            with redirect_stdout(io.StringIO()) as captured:
                result, report = validate_gold.validate_corpus(
                    briefs,
                    gold_by_id,
                    SHELF,
                    audit_path=None,
                    emit=lambda _line: None,
                )
        return result, report, captured.getvalue()

    def test_a_corpus_whose_only_failures_are_merged_near_twins_passes(self):
        # Strict reconstruction is 0 of 2 here, which round 3 would have blocked
        # on and then pruned the corpus down to nothing. Both briefs carry an
        # acceptable set, so both are scorable and the grid is not blocked.
        result, report, printed = self.validate(
            {"001": "a soft handoff", "002": "another soft handoff"},
            {"001": gold(["fade"]), "002": gold(["fade"])},
            [
                canned("dissolve"), canned("dissolve"), canned("fade"),
                canned("dissolve"), canned("dissolve"), canned("fade"),
            ],
        )
        self.assertEqual(0.0, result["accuracy"])
        self.assertEqual(1.0, result["scored_agreement"])
        self.assertEqual(2, result["merged_count"])
        self.assertIn("Status: PASS, gated on scored corpus agreement", report)
        # The strict rate is kept and printed, it just does not decide.
        self.assertIn("Corpus accuracy: 0.00% (0/2)", printed)
        self.assertIn("Scored corpus agreement: 100.00% (2/2)", printed)

    def test_genuinely_unplaceable_briefs_still_block_the_grid(self):
        with self.assertRaisesRegex(
            SystemExit, "scored corpus agreement 0.00% is below the 95.00% floor"
        ):
            self.validate(
                {"001": "nothing the shelf carries"},
                {"001": gold(["fade"])},
                [canned("cut"), canned("wipe"), canned("dissolve")],
            )

    def test_a_contested_brief_counts_against_the_floor_like_any_other_failure(self):
        # The majority is a move the constructor marked known-wrong, so no set
        # can be written and the brief is not scorable. Strict accuracy would
        # read the same corpus at 50 percent and also block, but for the wrong
        # reason: the point is that a brief with no acceptable set never counts
        # as agreement.
        with self.assertRaisesRegex(
            SystemExit, "scored corpus agreement 50.00% is below the 95.00% floor"
        ):
            self.validate(
                {"001": "a soft handoff", "002": "a hard join"},
                {"001": gold(["fade"], bad=["cut"]), "002": gold(["wipe"])},
                [
                    canned("cut"), canned("cut"), canned("fade"),
                    canned("wipe"), canned("wipe"), canned("wipe"),
                ],
            )

    def test_the_gate_reads_one_rate_and_names_it(self):
        self.assertEqual(
            0.75, validate_gold.gate_rate({"scored_agreement": 0.75, "accuracy": 0.5})
        )
        self.assertIsNone(validate_gold.gate_rate({"accuracy": 1.0}))


class AuditReportTests(unittest.TestCase):
    """The audit says which corpus each rate is over, and stays machine readable."""

    def result(self, **overrides):
        base = {
            "records": [],
            "total": 4,
            "correct_count": 2,
            "accuracy": 0.5,
            "scored_count": 3,
            "scored_agreement": 0.75,
            "merged_count": 1,
            "contested_count": 0,
            "unplaceable_count": 1,
            "unanimous_count": 2,
            "disagreement_count": 2,
            "floor": validate_gold.ACCURACY_FLOOR,
        }
        base.update(overrides)
        return base

    def test_both_rates_are_reported_with_the_corpus_each_one_covers(self):
        report = validate_gold.render_audit(self.result())
        self.assertIn("- Corpus accuracy: 50.00% (2/4)", report)
        self.assertIn("- Scored corpus agreement: 75.00% (3/4)", report)
        self.assertIn("- Near twin merges: 1", report)
        self.assertIn("- Unplaceable, no committee majority: 1", report)
        self.assertIn("100 percent by construction", report)

    def test_a_run_that_produced_no_scored_rate_says_so_rather_than_printing_zero(self):
        report = validate_gold.render_audit(self.result(scored_agreement=None))
        self.assertIn("- Scored corpus agreement: not measured", report)

    def test_the_scored_block_does_not_break_the_prune_parser(self):
        # prune_corpus reads this report to decide what merges and what leaves
        # the corpus, by anchoring on the accuracy line and the disagreements
        # section. A new heading between them must not be read as a disagreement.
        report = validate_gold.render_audit(
            self.result(total=1, correct_count=1, accuracy=1.0)
        )
        unrecoverable, correct, total = prune_corpus.parse_audit(report)
        self.assertEqual([], unrecoverable)
        self.assertEqual((1, 1), (correct, total))


if __name__ == "__main__":
    unittest.main(verbosity=2)
