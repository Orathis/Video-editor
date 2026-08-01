#!/usr/bin/env python3
"""Fixture-only checks for the blind gold committee."""

import inspect
import io
import json
import math
import os
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import Mock, patch

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


def corpus(size, best="move-alpha"):
    """Build a uniform fixture corpus so replies map to sampled briefs by order."""
    briefs = {f"{index:05d}": f"fixture brief {index}" for index in range(size)}
    return briefs, {brief_id: gold(best) for brief_id in briefs}


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

        # The committee checkpoint and kill file default into the repo, so
        # without isolation one test's resume state would silently answer the
        # next test's run and the suite would stop testing what it claims to.
        self.workdir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.workdir, ignore_errors=True)
        self.checkpoint = os.path.join(self.workdir, "committee.jsonl")
        self.kill_file = os.path.join(self.workdir, "STOP")
        env = patch.dict(
            validate_gold.os.environ,
            {
                "EVAL_COMMITTEE_CHECKPOINT": self.checkpoint,
                "EVAL_KILL_FILE": self.kill_file,
            },
        )
        env.start()
        self.addCleanup(env.stop)

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

    def test_the_scored_rate_prints_above_floor_and_blocks_below_floor(self):
        # The below-floor corpus is unplaceable rather than merely wrong: three
        # readers naming three different moves leave no majority and so no
        # acceptable set, which is the failure the floor still has to catch. A
        # single wrong majority is a near twin and now passes, which is the whole
        # point of round 4 and is pinned in test_validate_gold_multitarget.
        above_replies = [canned("move-alpha", "correct") for _ in range(3)]
        above_stdout = io.StringIO()
        with patch.object(validate_gold.provider, "chat", side_effect=above_replies):
            with redirect_stdout(above_stdout):
                result, report = validate_gold.validate_corpus(
                    {"01": "fixture above floor"},
                    {"01": gold("move-alpha")},
                    SHELF,
                    fixture_data=True,
                    checkpoint_path=os.path.join(self.workdir, "above.jsonl"),
                )

        self.assertEqual(result["accuracy"], 1.0)
        self.assertIn("Corpus accuracy: 100.00% (1/1)", above_stdout.getvalue())
        self.assertIn("Scored corpus agreement: 100.00% (1/1)", above_stdout.getvalue())
        self.assertIn("Status: PASS, gated on scored corpus agreement", report)

        below_replies = [
            canned("move-beta", "one reader"),
            canned("move-gamma", "another reader"),
            canned("move-delta", "a third reader"),
        ]
        below_stdout = io.StringIO()
        with patch.object(validate_gold.provider, "chat", side_effect=below_replies):
            with redirect_stdout(below_stdout):
                with self.assertRaisesRegex(
                    SystemExit, "scored corpus agreement 0.00% is below the 95.00% floor"
                ):
                    validate_gold.validate_corpus(
                        {"01": "fixture below floor"},
                        {"01": gold("move-alpha")},
                        SHELF,
                        fixture_data=True,
                        checkpoint_path=os.path.join(self.workdir, "below.jsonl"),
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

    def test_dry_run_prices_the_committee_and_makes_no_call(self):
        briefs, gold_by_id = corpus(40)
        lines = []
        with patch.object(validate_gold.provider, "chat", Mock()) as chat_mock:
            projection = validate_gold.committee_dry_run(
                briefs,
                gold_by_id,
                SHELF,
                sample_rate=validate_gold.ROUND2_SAMPLE_RATE,
                emit=lines.append,
            )

        # Structural, not a promise: the chat entry point and the socket
        # underneath it both have to be untouched for this to be a dry run.
        self.assertFalse(chat_mock.called)
        self.assertFalse(self.transport_mock.called)
        output = "\n".join(lines)
        self.assertIn("DRY RUN: zero network calls and no key required.", output)
        self.assertIn("Projected committee cost: $", output)
        self.assertIn("Sample rate: 20.00% of 40 briefs = 8 sampled", output)
        self.assertIn("Reads: 8 unread of 8 sampled x 3 readers = 24", output)
        self.assertGreater(projection["projected_usd"], 0)
        self.assertEqual(
            f"${projection['projected_usd']:.6f}" in output,
            True,
        )

    def test_the_gate_quotes_no_tier_the_committee_cannot_actually_submit_to(self):
        # PRICE_TABLE carries a :batch row at half price, but every caller reaches
        # the model through provider.chat, which posts to the synchronous
        # endpoint. Quoting that row at the gate understated a real approval by
        # half. A price nothing can pay does not belong in a spend projection.
        briefs, gold_by_id = corpus(40)
        lines = []
        projection = validate_gold.committee_dry_run(
            briefs,
            gold_by_id,
            SHELF,
            sample_rate=validate_gold.ROUND2_SAMPLE_RATE,
            emit=lines.append,
        )

        self.assertNotIn("batch", "\n".join(lines).lower())
        self.assertNotIn("batch_usd", projection)
        self.assertEqual(
            projection["projected_usd"],
            projection["input_usd"] + projection["cached_usd"] + projection["output_usd"],
        )

    def test_projected_reads_are_rate_times_corpus_times_readers(self):
        for size, rate in ((40, 0.20), (10, 0.30), (1360, 0.20), (7, 1.0)):
            with self.subTest(size=size, rate=rate):
                briefs, gold_by_id = corpus(size)
                with patch.object(validate_gold.provider, "chat", Mock()) as chat_mock:
                    projection = validate_gold.project_committee(
                        briefs, gold_by_id, SHELF, sample_rate=rate
                    )
                expected_briefs = math.ceil(size * rate)
                self.assertFalse(chat_mock.called)
                self.assertEqual(projection["sampled_briefs"], expected_briefs)
                self.assertEqual(projection["readers"], 3)
                self.assertEqual(projection["reads"], expected_briefs * 3)

    def test_rate_below_round_two_names_the_widened_bound(self):
        briefs, gold_by_id = corpus(400)
        lines = []
        validate_gold.committee_dry_run(
            briefs, gold_by_id, SHELF, sample_rate=0.05, emit=lines.append
        )
        warning = next(line for line in lines if line.startswith("WARNING:"))

        self.assertIn("below round 2's 20.00%", warning)
        self.assertIn("Reading 20 of 400 briefs", warning)
        # Both bounds are named so the reader sees what was traded away, not
        # just that something got worse.
        self.assertIn(f"+/-{validate_gold._margin(80):.2%}", warning)
        self.assertIn(f"+/-{validate_gold._margin(20):.2%}", warning)
        self.assertGreater(validate_gold._margin(20), validate_gold._margin(80))

        quiet = []
        validate_gold.committee_dry_run(
            briefs,
            gold_by_id,
            SHELF,
            sample_rate=validate_gold.ROUND2_SAMPLE_RATE,
            emit=quiet.append,
        )
        self.assertEqual([line for line in quiet if line.startswith("WARNING:")], [])

    def test_round_two_audit_number_reproduces_unchanged(self):
        # GOLD-AUDIT.md records 83.46% (227/272), 217 unanimous, 55 disagreements
        # over a corpus round 2 read in full. Reproduced at rate 1.0 (what round
        # 2 did) and again as a 20 percent sample of a 1360-brief corpus, so the
        # sampling parameter cannot quietly move the floor arithmetic.
        for size, rate in ((272, 1.0), (1360, validate_gold.ROUND2_SAMPLE_RATE)):
            with self.subTest(size=size, rate=rate):
                briefs, gold_by_id = corpus(size)
                replies = []
                for _ in range(217):
                    replies.extend(canned("move-alpha", "unanimous") for _ in range(3))
                for _ in range(10):
                    replies.extend(
                        [
                            canned("move-alpha", "majority one"),
                            canned("move-alpha", "majority two"),
                            canned("move-beta", "minority"),
                        ]
                    )
                for _ in range(45):
                    replies.extend(canned("move-beta", "shared blind spot") for _ in range(3))

                with patch.object(validate_gold.provider, "chat", side_effect=replies):
                    result = validate_gold.evaluate_corpus(
                        briefs,
                        gold_by_id,
                        SHELF,
                        sample_rate=rate,
                        checkpoint_path=os.path.join(self.workdir, f"r2-{size}.jsonl"),
                    )

                self.assertIsNone(result["stop_reason"])
                self.assertEqual(result["total"], 272)
                self.assertEqual(result["correct_count"], 227)
                self.assertEqual(f"{result['accuracy']:.2%}", "83.46%")
                self.assertEqual(result["unanimous_count"], 217)
                self.assertEqual(result["disagreement_count"], 55)
                self.assertEqual(result["floor"], 0.95)

    def test_interrupted_committee_resumes_without_rereading(self):
        briefs, gold_by_id = corpus(3)
        first = [canned("move-alpha", "judged before the interruption")] * 3
        with patch.object(validate_gold.provider, "chat", side_effect=first):
            with self.assertRaises(StopIteration):
                validate_gold.evaluate_corpus(briefs, gold_by_id, SHELF)

        with open(self.checkpoint, encoding="utf-8") as fh:
            checkpointed = [json.loads(line) for line in fh if line.strip()]
        self.assertEqual(len(checkpointed), 1)

        rest = [canned("move-alpha", "judged on resume") for _ in range(6)]
        with patch.object(validate_gold.provider, "chat", side_effect=rest) as chat_mock:
            result = validate_gold.evaluate_corpus(briefs, gold_by_id, SHELF)

        self.assertEqual(chat_mock.call_count, 6)
        self.assertEqual(result["new_reads"], 2)
        self.assertEqual(result["total"], 3)
        self.assertEqual(
            [record["passes"][0]["why"] for record in result["records"]],
            [
                "judged before the interruption",
                "judged on resume",
                "judged on resume",
            ],
        )

    def test_a_checkpoint_from_another_corpus_is_reread_not_inherited(self):
        """Same ids, different briefs: the verdicts must not carry across.

        Brief ids are positions in a corpus, so a regenerated corpus numbers
        from the start again and every id collides with an older brief that
        says something else. Keyed on the id alone, resume answered the new
        corpus with the old corpus's verdicts and never spent a call to notice,
        and the audit then pruned the new corpus on them.
        """
        first_briefs, gold_by_id = corpus(3)
        replies = [canned("move-alpha", "judged for the first corpus")] * 9
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            validate_gold.evaluate_corpus(first_briefs, gold_by_id, SHELF)

        with open(self.checkpoint, encoding="utf-8") as fh:
            self.assertEqual(len([line for line in fh if line.strip()]), 3)

        # Same ids, text a committee has never seen.
        second_briefs = {
            brief_id: f"a different corpus reused id {brief_id}"
            for brief_id in first_briefs
        }
        rest = [canned("move-alpha", "judged for the second corpus")] * 9
        with patch.object(
            validate_gold.provider, "chat", side_effect=rest
        ) as chat_mock:
            result = validate_gold.evaluate_corpus(second_briefs, gold_by_id, SHELF)

        self.assertEqual(result["new_reads"], 3)
        self.assertEqual(chat_mock.call_count, 9)
        self.assertEqual(
            {record["passes"][0]["why"] for record in result["records"]},
            {"judged for the second corpus"},
        )

    def test_ceiling_below_projection_stops_before_any_read(self):
        briefs, gold_by_id = corpus(4)
        projection = validate_gold.project_committee(briefs, gold_by_id, SHELF)
        stdout = io.StringIO()
        with patch.object(validate_gold.provider, "chat", Mock()) as chat_mock:
            with redirect_stdout(stdout):
                result, report = validate_gold.validate_corpus(
                    briefs,
                    gold_by_id,
                    SHELF,
                    max_usd=projection["projected_usd"] / 2,
                )

        self.assertFalse(chat_mock.called)
        self.assertFalse(self.transport_mock.called)
        self.assertEqual(result["stop_reason"], "ceiling")
        self.assertEqual(result["records"], [])
        self.assertIsNone(result["accuracy"])
        self.assertIsNone(report)
        self.assertIn("ceiling: 0 of 4 sampled briefs judged", stdout.getvalue())

    def test_an_already_judged_corpus_is_projected_at_zero_not_at_full_price(self):
        """A rerun that will buy nothing must not be priced as if it bought everything.

        The projection used to price every sampled brief as unread, so a corpus
        the committee had already judged in full was refused at the ceiling for
        work that would have cost nothing. The audit could then only be
        regenerated by authorising a spend that was never going to happen.
        """
        briefs, gold_by_id = corpus(4)
        before = validate_gold.project_committee(briefs, gold_by_id, SHELF)
        self.assertEqual(4, before["unread_briefs"])
        self.assertGreater(before["projected_usd"], 0)

        replies = [canned("move-alpha", "judged once") for _ in range(12)]
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            validate_gold.evaluate_corpus(briefs, gold_by_id, SHELF)

        judged = validate_gold.judged_records(self.checkpoint, briefs)
        after = validate_gold.project_committee(
            briefs, gold_by_id, SHELF, judged=judged
        )
        self.assertEqual(4, after["sampled_briefs"])
        self.assertEqual(0, after["unread_briefs"])
        self.assertEqual(0, after["reads"])
        self.assertEqual(0.0, after["projected_usd"])

        # And the run agrees with the projection: no call, no ceiling stop.
        with patch.object(validate_gold.provider, "chat", Mock()) as chat_mock:
            result = validate_gold.evaluate_corpus(
                briefs, gold_by_id, SHELF, max_usd=99.0
            )
        self.assertFalse(chat_mock.called)
        self.assertIsNone(result["stop_reason"])
        self.assertEqual(0, result["new_reads"])

    def test_a_stale_digest_is_priced_as_unread_rather_than_as_cached(self):
        # The projection reads "already judged" from the same place resume does,
        # so a brief whose text changed is priced for the call resume will make.
        briefs, gold_by_id = corpus(4)
        replies = [canned("move-alpha", "judged once") for _ in range(12)]
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            validate_gold.evaluate_corpus(briefs, gold_by_id, SHELF)

        edited = dict(briefs)
        changed = sorted(edited)[0]
        edited[changed] = edited[changed] + "\n\nan edit the committee never read"
        judged = validate_gold.judged_records(self.checkpoint, edited)
        projection = validate_gold.project_committee(
            edited, gold_by_id, SHELF, judged=judged
        )
        self.assertEqual(1, projection["unread_briefs"])
        self.assertGreater(projection["projected_usd"], 0)

    def test_kill_file_stops_the_committee(self):
        briefs, gold_by_id = corpus(4)
        with open(self.kill_file, "w", encoding="utf-8") as fh:
            fh.write("stop\n")

        stdout = io.StringIO()
        with patch.object(validate_gold.provider, "chat", Mock()) as chat_mock:
            with redirect_stdout(stdout):
                result, report = validate_gold.validate_corpus(briefs, gold_by_id, SHELF)

        self.assertFalse(chat_mock.called)
        self.assertEqual(result["stop_reason"], "kill file")
        self.assertIsNone(report)
        self.assertIn("kill file: 0 of 4 sampled briefs judged", stdout.getvalue())

    def test_rate_zero_is_loud_and_rate_one_reads_everything(self):
        briefs, gold_by_id = corpus(4)
        with patch.object(validate_gold.provider, "chat", Mock()) as chat_mock:
            with self.assertRaisesRegex(SystemExit, "entirely unaudited"):
                validate_gold.evaluate_corpus(
                    briefs, gold_by_id, SHELF, sample_rate=0
                )
            with self.assertRaisesRegex(SystemExit, "outside 0..1"):
                validate_gold.project_committee(
                    briefs, gold_by_id, SHELF, sample_rate=1.5
                )
        self.assertFalse(chat_mock.called)

        replies = [canned("move-alpha", "read at full rate") for _ in range(12)]
        with patch.object(validate_gold.provider, "chat", side_effect=replies):
            result = validate_gold.evaluate_corpus(
                briefs, gold_by_id, SHELF, sample_rate=1.0
            )

        self.assertEqual(result["total"], 4)
        self.assertEqual(sorted(result["sampled"]), sorted(briefs))


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
            with tempfile.TemporaryDirectory() as workdir:
                validate_gold.validate_corpus(
                    briefs,
                    gold_by_id,
                    SHELF,
                    hand_decisions={"02": "move-epsilon"},
                    audit_path=validate_gold.AUDIT_PATH,
                    fixture_data=True,
                    checkpoint_path=os.path.join(workdir, "committee.jsonl"),
                    kill_path=os.path.join(workdir, "STOP"),
                )
        if transport_mock.called:
            raise AssertionError("network transport was reached")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ValidateGoldTests)
    outcome = unittest.TextTestRunner(verbosity=2).run(suite)
    if not outcome.wasSuccessful():
        raise SystemExit(1)
    write_fixture_audit()
