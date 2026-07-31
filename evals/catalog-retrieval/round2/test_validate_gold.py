#!/usr/bin/env python3
"""Fixture-only checks for the blind gold committee."""

import inspect
import io
import json
import os
import sys
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import validate_gold


SHELF = {
    "move-alpha": "group: type\nwhat: alpha shelf entry",
    "move-beta": "group: layout\nwhat: beta shelf entry",
    "move-gamma": "group: type\nwhat: gamma shelf entry",
    "move-delta": "group: layout\nwhat: delta shelf entry",
    "move-epsilon": "group: type\nwhat: epsilon shelf entry",
}


def canned(move, reason):
    parsed = {"move": move, "why": reason}
    return parsed, json.dumps(parsed), {"total_tokens": 1}, 0.01


def gold(*best):
    return {
        "best": list(best),
        "acceptable": [],
        "bad": [],
        "why_best": "fixture rationale",
        "why_bad": "fixture rationale",
        "trap": "fixture trap",
    }


class ValidateGoldTests(unittest.TestCase):
    def setUp(self):
        # Guarded at urlopen, not at a named provider helper: the chat path
        # reaches the network through its own function, so pinning any single
        # helper leaves a live route open the day the provider is rewired.
        self.transport = patch.object(
            validate_gold.provider.urllib.request,
            "urlopen",
            side_effect=AssertionError("network access is disabled in this test suite"),
        )
        self.transport_mock = self.transport.start()
        self.addCleanup(self.transport.stop)

    def test_context_accepts_only_brief_and_full_shelf(self):
        brief = "Fixture brief sentinel: focus the alpha entry."

        context = validate_gold.build_committee_context(brief, SHELF)

        self.assertEqual(
            list(inspect.signature(validate_gold.build_committee_context).parameters),
            ["brief", "shelf"],
        )
        self.assertIn(brief, context)
        for name, body in SHELF.items():
            self.assertIn(name, context)
            self.assertIn(body, context)
        for forbidden in (
            "run-record-sentinel",
            "score-sentinel",
            "checkpoint-sentinel",
            "eval-grid-sentinel",
        ):
            self.assertNotIn(forbidden, context)

    def test_unanimous_gold_agreement_has_no_disagreement_entry(self):
        replies = [canned("move-alpha", f"alpha reason {index}") for index in range(3)]
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            result, report = validate_gold.validate_corpus(
                {"01": "fixture brief alpha"},
                {"01": gold("move-alpha")},
                SHELF,
                fixture_data=True,
            )

        self.assertTrue(result["records"][0]["unanimous_agreement"])
        self.assertEqual(result["unanimous_count"], 1)
        self.assertIn("## Disagreements\n\nNone.", report)
        self.assertNotIn("### Disagreement 01", report)

    def test_every_disagreement_names_all_candidates_and_reasons(self):
        replies = [
            canned("move-alpha", "alpha reason one"),
            canned("move-alpha", "alpha reason two"),
            canned("move-beta", "beta reason"),
        ]
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            result = validate_gold.evaluate_corpus(
                {"02": "fixture disagreement"},
                {"02": gold("move-delta")},
                SHELF,
            )
        report = validate_gold.render_audit(result, fixture_data=True)

        self.assertEqual(result["disagreement_count"], 1)
        self.assertIn("### Disagreement 02", report)
        self.assertIn("Constructed gold candidates: move-delta", report)
        self.assertIn("Committee candidates: move-alpha, move-beta", report)
        self.assertIn("alpha reason one", report)
        self.assertIn("alpha reason two", report)
        self.assertIn("beta reason", report)

    def test_accuracy_prints_above_floor_and_blocks_below_floor(self):
        above_replies = [canned("move-alpha", "correct") for _ in range(3)]
        above_stdout = io.StringIO()
        with patch.object(validate_gold.provider, "chat", side_effect=above_replies):
            with redirect_stdout(above_stdout):
                result, report = validate_gold.validate_corpus(
                    {"01": "fixture above floor"},
                    {"01": gold("move-alpha")},
                    SHELF,
                    fixture_data=True,
                )

        self.assertEqual(result["accuracy"], 1.0)
        self.assertIn("Corpus accuracy: 100.00% (1/1)", above_stdout.getvalue())
        self.assertIn("Status: PASS", report)

        below_replies = [canned("move-beta", "incorrect") for _ in range(3)]
        below_stdout = io.StringIO()
        with patch.object(validate_gold.provider, "chat", side_effect=below_replies):
            with redirect_stdout(below_stdout):
                with self.assertRaisesRegex(SystemExit, "below the 95.00% floor"):
                    validate_gold.validate_corpus(
                        {"01": "fixture below floor"},
                        {"01": gold("move-alpha")},
                        SHELF,
                        fixture_data=True,
                    )

        self.assertIn("Corpus accuracy: 0.00% (0/1)", below_stdout.getvalue())

    def test_hand_decision_overrides_gold_and_committee(self):
        replies = [canned("move-beta", f"beta reason {index}") for index in range(3)]
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            result, report = validate_gold.validate_corpus(
                {"03": "fixture hand decision"},
                {"03": gold("move-alpha")},
                SHELF,
                hand_decisions={"03": "move-gamma"},
                fixture_data=True,
            )

        record = result["records"][0]
        self.assertEqual(record["constructed_gold"], ["move-alpha"])
        self.assertEqual(record["committee_majority"], "move-beta")
        self.assertEqual(record["final_move"], "move-gamma")
        self.assertTrue(record["correct"])
        self.assertEqual(result["accuracy"], 1.0)
        self.assertIn("Hand decision: move-gamma (authoritative)", report)
        self.assertIn("Final move: move-gamma", report)

    def test_missing_corpus_fails_loudly(self):
        missing = os.path.join(validate_gold.HERE, "definitely-missing-fixture-directory")
        with self.assertRaisesRegex(SystemExit, "briefs directory is missing"):
            validate_gold.load_corpus(missing, missing)

        with patch.object(validate_gold.os.path, "isdir", return_value=True):
            with patch.object(validate_gold.glob, "glob", return_value=[]):
                with self.assertRaisesRegex(SystemExit, "zero briefs"):
                    validate_gold.load_corpus("fixture-briefs", "fixture-gold")

        def only_briefs_exist(path):
            return path == "fixture-briefs"

        with patch.object(validate_gold.os.path, "isdir", side_effect=only_briefs_exist):
            with self.assertRaisesRegex(SystemExit, "gold directory is missing"):
                validate_gold.load_corpus("fixture-briefs", "fixture-gold")

        with self.assertRaisesRegex(SystemExit, "zero briefs"):
            validate_gold.evaluate_corpus({}, {}, SHELF)

    def test_entire_corpus_is_validated_before_first_committee_pass(self):
        briefs = {"01": "valid fixture", "02": "invalid fixture"}
        gold_by_id = {
            "01": gold("move-alpha"),
            "02": gold("not-on-the-shelf"),
        }
        with patch.object(validate_gold.provider, "chat") as chat_mock:
            with self.assertRaisesRegex(SystemExit, "outside the shelf"):
                validate_gold.evaluate_corpus(briefs, gold_by_id, SHELF)

        self.assertFalse(chat_mock.called)

    def test_three_passes_are_independent_and_identical(self):
        replies = [
            canned("move-alpha", "private response one"),
            canned("move-beta", "private response two"),
            canned("move-gamma", "private response three"),
        ]
        with patch.object(validate_gold.provider, "chat", side_effect=replies) as chat_mock:
            validate_gold.evaluate_corpus(
                {"04": "fixture independent passes"},
                {"04": gold("move-alpha")},
                SHELF,
            )

        self.assertEqual(chat_mock.call_count, 3)
        contexts = [call.args[0] for call in chat_mock.call_args_list]
        self.assertEqual(contexts, [contexts[0]] * 3)
        for context in contexts:
            self.assertNotIn("private response one", context)
            self.assertNotIn("private response two", context)
            self.assertNotIn("private response three", context)
        for call in chat_mock.call_args_list:
            self.assertEqual(call.args[1], validate_gold.provider.CHAT_MODEL)
        self.assertFalse(self.transport_mock.called)

    def test_transport_trap_stays_unused_with_committee_double(self):
        replies = [canned("move-alpha", "fixture") for _ in range(3)]
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            validate_gold.evaluate_corpus(
                {"05": "fixture transport trap"},
                {"05": gold("move-alpha")},
                SHELF,
            )

        self.assertFalse(self.transport_mock.called)

    def test_samples_are_stratified_with_equal_sized_control(self):
        briefs = {
            "01": "fixture agreement type",
            "02": "fixture agreement layout",
            "03": "fixture disagreement type",
            "04": "fixture disagreement layout",
        }
        gold_by_id = {
            "01": gold("move-alpha"),
            "02": gold("move-beta"),
            "03": gold("move-gamma"),
            "04": gold("move-delta"),
        }
        replies = []
        replies.extend(canned("move-alpha", "agreement") for _ in range(3))
        replies.extend(canned("move-beta", "agreement") for _ in range(3))
        replies.extend(canned("move-beta", "disagreement") for _ in range(3))
        replies.extend(canned("move-alpha", "disagreement") for _ in range(3))
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            result = validate_gold.evaluate_corpus(briefs, gold_by_id, SHELF)

        disagreement_sample, control_sample = validate_gold.sample_for_hand_decision(result)

        self.assertEqual(len(disagreement_sample), len(control_sample))
        self.assertEqual({row["stratum"] for row in disagreement_sample}, {"layout", "type"})
        self.assertEqual({row["stratum"] for row in control_sample}, {"layout", "type"})


def write_fixture_audit():
    briefs = {
        "01": "fixture alpha agreement",
        "02": "fixture hand override",
        "03": "fixture split committee",
    }
    gold_by_id = {
        "01": gold("move-alpha"),
        "02": gold("move-delta"),
        "03": gold("move-alpha"),
    }
    replies = []
    replies.extend(canned("move-alpha", f"fixture alpha reason {index}") for index in range(3))
    replies.extend(canned("move-beta", f"fixture beta reason {index}") for index in range(3))
    replies.extend(
        [
            canned("move-alpha", "fixture majority reason one"),
            canned("move-beta", "fixture minority reason"),
            canned("move-alpha", "fixture majority reason two"),
        ]
    )
    with patch.object(
        validate_gold.provider.urllib.request,
        "urlopen",
        side_effect=AssertionError("network access is disabled for fixture audit creation"),
    ) as transport_mock:
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            validate_gold.validate_corpus(
                briefs,
                gold_by_id,
                SHELF,
                hand_decisions={"02": "move-epsilon"},
                audit_path=validate_gold.AUDIT_PATH,
                fixture_data=True,
            )
        if transport_mock.called:
            raise AssertionError("network transport was reached")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ValidateGoldTests)
    outcome = unittest.TextTestRunner(verbosity=2).run(suite)
    if not outcome.wasSuccessful():
        raise SystemExit(1)
    write_fixture_audit()
