#!/usr/bin/env python3
"""Offline tests for the round-two provider and resumable runner."""

import contextlib
import io
import json
import os
import tempfile
import unittest
import urllib.error
from unittest import mock

import harness2
import provider
import run2


class StubResponse:
    def __init__(self, body):
        self.body = io.BytesIO(json.dumps(body).encode("utf-8"))

    def __enter__(self):
        return self.body

    def __exit__(self, exc_type, exc, traceback):
        return False


def canned_chat(usage=None):
    usage = usage or {
        "prompt_tokens": 10,
        "completion_tokens": 2,
        "cached_tokens": 0,
        "total_tokens": 12,
    }
    return {"picks": [], "confidence": "low"}, '{"picks":[]}', usage, 0.01


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.transport_guard = mock.patch.object(
            provider.urllib.request,
            "urlopen",
            side_effect=AssertionError("network transport must stay stubbed"),
        )
        self.transport_guard.start()
        self.temporary = tempfile.TemporaryDirectory()
        self.checkpoint = os.path.join(self.temporary.name, "results.jsonl")
        self.kill_file = os.path.join(self.temporary.name, "STOP")
        self.entries = {
            "move-a": "group: type\nwhat: alpha motion",
            "move-b": "group: type\nwhat: beta motion",
        }

    def tearDown(self):
        self.temporary.cleanup()
        self.transport_guard.stop()

    def _run(self, briefs, cells, **kwargs):
        return run2.run_grid(
            self.entries,
            briefs,
            cells=cells,
            checkpoint_path=self.checkpoint,
            kill_path=self.kill_file,
            emit=lambda _: None,
            **kwargs,
        )

    def test_resume_only_calls_the_missing_four_of_ten(self):
        briefs = {"01": "alpha", "02": "beta"}
        cells = (("a", None), ("b", None), ("c", 1), ("c", 2), ("c", 3))
        first_calls = 0

        def stop_after_six(context, model, config=None):
            nonlocal first_calls
            first_calls += 1
            if first_calls == 6:
                open(self.kill_file, "w", encoding="utf-8").close()
            return canned_chat()

        with mock.patch.object(provider, "chat", side_effect=stop_after_six):
            first = self._run(briefs, cells)
        self.assertEqual(6, first_calls)
        self.assertEqual(6, first["new_runs"])
        self.assertEqual("kill file", first["stop_reason"])

        os.unlink(self.kill_file)
        second_calls = 0

        def count_remaining(context, model, config=None):
            nonlocal second_calls
            second_calls += 1
            return canned_chat()

        with mock.patch.object(provider, "chat", side_effect=count_remaining):
            second = self._run(briefs, cells)
        self.assertEqual(4, second_calls)
        self.assertEqual(10, second["completed"])
        records = run2.load_checkpoint(self.checkpoint)
        keys = [run2._record_key(record) for record in records]
        self.assertEqual(10, len(records))
        self.assertEqual(10, len(set(keys)))

    def test_corrupt_final_line_is_dropped_and_only_missing_item_reruns(self):
        valid = {
            "brief": "01",
            "condition": "b",
            "k": None,
            "model": run2.MODEL,
            "attempts": [],
        }
        with open(self.checkpoint, "wb") as fh:
            fh.write((json.dumps(valid) + "\n").encode("utf-8"))
            fh.write(b'{"brief":"02"')

        calls = 0

        def count_call(context, model, config=None):
            nonlocal calls
            calls += 1
            return canned_chat()

        with mock.patch.object(provider, "chat", side_effect=count_call):
            result = self._run(
                {"01": "alpha", "02": "beta"},
                (("b", None),),
            )
        self.assertEqual(1, calls)
        self.assertEqual(2, result["completed"])
        records = run2.load_checkpoint(self.checkpoint)
        model = provider.model_id(run2.MODEL)
        self.assertEqual(
            {("01", "b", None, model), ("02", "b", None, model)},
            {run2._record_key(record) for record in records},
        )

    def test_ceiling_stops_at_crossing_and_resume_finishes(self):
        usage = {
            "prompt_tokens": 100_000,
            "completion_tokens": 50_000,
            "cached_tokens": 20_000,
            "total_tokens": 150_000,
        }
        # Cost per run comes from the live table so a price change moves the
        # ceiling with it. What is asserted is the stopping BEHAVIOR: trip after
        # the second run, checkpoint stays valid, resume finishes the rest.
        prices = run2.PRICE_TABLE[run2.MODEL]
        per_run = (
            80_000 * prices["input"] + 20_000 * prices["cached"] + 50_000 * prices["output"]
        ) / 1_000_000
        self.assertAlmostEqual(per_run, run2.usage_cost(usage, run2.MODEL))
        cells = (("b", None), ("c", 1), ("c", 2), ("c", 3))

        with mock.patch.object(provider, "chat", return_value=canned_chat(usage)) as chat:
            first = self._run({"01": "alpha"}, cells, max_usd=per_run * 1.95)
        self.assertEqual(2, chat.call_count)
        self.assertEqual("ceiling", first["stop_reason"])
        self.assertAlmostEqual(per_run * 2, first["total_usd"])
        self.assertEqual(2, len(run2.load_checkpoint(self.checkpoint)))

        with mock.patch.object(provider, "chat", return_value=canned_chat(usage)) as chat:
            second = self._run({"01": "alpha"}, cells, max_usd=per_run * 10)
        self.assertEqual(2, chat.call_count)
        self.assertIsNone(second["stop_reason"])
        self.assertEqual(4, second["completed"])
        self.assertEqual(4, len(run2.load_checkpoint(self.checkpoint)))

    def test_kill_file_created_in_call_stops_after_checkpoint(self):
        calls = 0

        def create_kill_file(context, model, config=None):
            nonlocal calls
            calls += 1
            open(self.kill_file, "w", encoding="utf-8").close()
            return canned_chat()

        with mock.patch.object(provider, "chat", side_effect=create_kill_file):
            result = self._run(
                {"01": "alpha"},
                (("b", None), ("c", 1)),
            )
        self.assertEqual(1, calls)
        self.assertEqual("kill file", result["stop_reason"])
        self.assertEqual(1, len(run2.load_checkpoint(self.checkpoint)))

    def test_dry_run_is_offline_and_projection_matches_manual_math(self):
        brief = "fixed brief"
        expected_context = (
            f"{harness2.FRAMING}\n{harness2.NO_CATALOG}"
            f"\n\nThe beat:\n\n{brief}\n"
        )
        expected_chars = len(expected_context)
        expected_input = expected_chars / 4.0
        # Derived from the live table, never hardcoded: a price update must move
        # the projection without silently breaking or silently passing this test.
        prices = run2.PRICE_TABLE[run2.MODEL]
        expected_cost = (
            expected_input * prices["input"]
            + run2.ASSUMED_OUTPUT_TOKENS * prices["output"]
        ) / 1_000_000
        with mock.patch.object(
            provider,
            "chat",
            side_effect=AssertionError("chat must not run"),
        ), mock.patch.object(
            provider,
            "embed",
            side_effect=AssertionError("embed must not run"),
        ), mock.patch.object(
            provider,
            "validate_model",
            side_effect=AssertionError("validation must not run"),
        ):
            rows, total = run2.dry_run(
                self.entries,
                {"fixed": brief},
                cells=(("a", None),),
                emit=lambda _: None,
            )
            # main() runs the whole default grid, and the d and h cells rank
            # against vectors.json rather than against the stubbed shelf. Left
            # unstubbed, this passed only on a machine where that file is
            # absent and those cells were skipped, and raised KeyError on the
            # one machine that has it, which is the machine the eval runs on.
            vectors = os.path.join(self.temporary.name, "vectors.json")
            with open(vectors, "w") as handle:
                json.dump(
                    {
                        "model": "stub",
                        "briefs": {"fixed": [1.0, 0.0]},
                        "moves": {"move-a": [1.0, 0.0], "move-b": [0.0, 1.0]},
                    },
                    handle,
                )
            with mock.patch.dict(
                os.environ, {"EVAL_DRY_RUN": "1"}, clear=False
            ), mock.patch.object(
                harness2, "VECTORS", vectors
            ), mock.patch.object(
                harness2, "load_shelf", return_value=self.entries
            ), mock.patch.object(
                harness2,
                "load_briefs",
                return_value={"fixed": brief},
            ), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(0, run2.main())
        self.assertEqual(expected_chars, rows[0]["chars"])
        self.assertEqual(expected_input, rows[0]["estimated_input_tokens"])
        self.assertEqual(0, rows[0]["cached_tokens"])
        self.assertEqual(run2.ASSUMED_OUTPUT_TOKENS, rows[0]["assumed_output_tokens"])
        self.assertAlmostEqual(
            expected_input * prices["input"] / 1_000_000, rows[0]["input_usd"]
        )
        self.assertEqual(0, rows[0]["cached_usd"])
        self.assertAlmostEqual(
            run2.ASSUMED_OUTPUT_TOKENS * prices["output"] / 1_000_000,
            rows[0]["output_usd"],
        )
        self.assertAlmostEqual(expected_cost, rows[0]["projected_usd"])
        self.assertAlmostEqual(expected_cost, total["projected_usd"])

    def test_the_dry_run_banner_states_the_number_it_actually_bills(self):
        # The banner is the one line a reader checks before approving spend. It
        # once said 50 while the arithmetic below it used 800, so the printed
        # assumption has to come from the constant, not from prose.
        lines = []
        run2.dry_run(
            self.entries,
            {"fixed": "a beat"},
            cells=(("a", None),),
            emit=lines.append,
        )
        banner = [line for line in lines if "Assumed output tokens" in line]
        self.assertEqual(1, len(banner), lines)
        self.assertIn(str(run2.ASSUMED_OUTPUT_TOKENS), banner[0])

    def test_the_dry_run_prices_the_whole_two_model_grid(self):
        # Round 4's verification gate: the full grid is priced before anything
        # paid runs. Cells times models, with each model's block priced from its
        # own row, and a grand total that is the sum rather than a restatement
        # of the last block.
        models = (provider.CHAT_MODEL, "gpt-5.6-luna")
        cells = (("a", None), ("c", 5))
        lines = []
        rows, total = run2.dry_run(
            self.entries,
            {"01": "a beat", "02": "another beat"},
            cells=cells,
            models=models,
            emit=lines.append,
        )
        self.assertEqual(len(cells) * len(models), len(rows))
        # Every row is a distinct cell: nothing collapsed two models into one.
        self.assertEqual(len(rows), len({row["cell"] for row in rows}))
        for model in models:
            self.assertEqual(
                len(cells),
                len([row for row in rows if row["cell"].endswith("/" + model)]),
            )
        self.assertAlmostEqual(
            sum(row["projected_usd"] for row in rows), total["projected_usd"]
        )
        # The two families are priced apart, so the grid is not one model's
        # projection doubled.
        per_model = {
            model: sum(
                row["projected_usd"]
                for row in rows
                if row["cell"].endswith("/" + model)
            )
            for model in models
        }
        self.assertNotAlmostEqual(*per_model.values())
        grand = [line for line in lines if line.startswith("GRAND TOTAL ")]
        self.assertEqual(1, len(grand), lines)
        self.assertIn("{0:.6f}".format(total["projected_usd"]), grand[0])

    def test_a_single_model_projection_prints_no_grand_total(self):
        # One model is not a grid, and a GRAND TOTAL over one block would read
        # as though a second had been priced and come to nothing.
        lines = []
        run2.dry_run(
            self.entries,
            {"01": "a beat"},
            cells=(("a", None),),
            emit=lines.append,
        )
        self.assertEqual([], [line for line in lines if "GRAND TOTAL" in line])

    def test_a_model_selection_is_read_apart_and_a_typo_stops_it(self):
        self.assertEqual((run2.MODEL,), run2.parse_models(""))
        self.assertEqual(
            ("gemini-3.6-flash", "gpt-5.6-luna"),
            run2.parse_models(" gemini-3.6-flash , gpt-5.6-luna "),
        )
        with self.assertRaisesRegex(SystemExit, "no known family prefix"):
            run2.parse_models("gemini-3.6-flash,gpt5.6-luna")
        # Deduplicating would price half of what the reader is approving.
        with self.assertRaisesRegex(SystemExit, "more than once"):
            run2.parse_models("gpt-5.6-luna,gpt-5.6-luna")

    def test_a_multi_model_selection_never_falls_through_to_a_paid_single_run(self):
        # The projection covers the grid and the paid run covers one model. Left
        # to fall through, this would spend on EVAL_MODEL alone and report the
        # grid as done.
        with mock.patch.dict(
            os.environ,
            {"EVAL_MODELS": "gemini-3.6-flash,gpt-5.6-luna"},
            clear=False,
        ), mock.patch.object(
            harness2, "load_shelf", return_value=self.entries
        ), mock.patch.object(
            harness2, "load_briefs", return_value={"01": "a beat"}
        ), mock.patch.object(
            provider, "validate_model", side_effect=AssertionError("must not probe")
        ), mock.patch.object(
            provider, "chat", side_effect=AssertionError("must not spend")
        ):
            os.environ.pop("EVAL_DRY_RUN", None)
            with self.assertRaisesRegex(SystemExit, "run once per model"):
                run2.main()

    def test_malformed_output_retries_once_and_records_both_attempts(self):
        responses = [
            (
                None,
                "not json",
                {
                    "prompt_tokens": 7,
                    "completion_tokens": 3,
                    "cached_tokens": 0,
                    "total_tokens": 10,
                },
                0.1,
            ),
            canned_chat(),
        ]
        with mock.patch.object(provider, "chat", side_effect=responses) as chat:
            self._run({"01": "alpha"}, (("b", None),))
        self.assertEqual(2, chat.call_count)
        record = run2.load_checkpoint(self.checkpoint)[0]
        self.assertEqual([False, True], [item["ok"] for item in record["attempts"]])
        self.assertEqual(2, len(record["attempts"]))

    def test_unknown_model_has_no_zero_cost_fallback(self):
        with self.assertRaisesRegex(SystemExit, "no price table entry"):
            run2.usage_cost({}, "missing-model")


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.transport_guard = mock.patch.object(
            provider.urllib.request,
            "urlopen",
            side_effect=AssertionError("network transport must stay stubbed"),
        )
        self.transport_guard.start()

    def tearDown(self):
        self.transport_guard.stop()

    def _stub_auth(self):
        """Stand in for the service-account exchange.

        Every transport-level assertion below is about the request the chat path
        builds, not about minting a token, and google-auth is not importable in
        every environment this suite runs in.
        """
        return mock.patch.object(
            provider, "_vertex_auth", return_value=("stub-project", "stub-token")
        )

    def test_usage_normalization_includes_cached_tokens(self):
        self.assertEqual(
            {
                "prompt_tokens": 101,
                "completion_tokens": 23,
                "thought_tokens": 0,
                "cached_tokens": 71,
                "total_tokens": 124,
            },
            provider.normalize_usage(
                {
                    "promptTokenCount": 101,
                    "candidatesTokenCount": 23,
                    "cachedContentTokenCount": 71,
                    "totalTokenCount": 124,
                }
            ),
        )

    def test_thinking_tokens_are_billed_as_completion(self):
        # Observed live: a seven-token prompt answered with one visible token
        # spent 89 thinking tokens. Those are charged at the output rate, so a
        # normalizer that ignored them would under-report this run by 89x.
        usage = provider.normalize_usage(
            {
                "promptTokenCount": 7,
                "candidatesTokenCount": 1,
                "thoughtsTokenCount": 89,
                "totalTokenCount": 97,
            }
        )
        self.assertEqual(90, usage["completion_tokens"])
        self.assertEqual(89, usage["thought_tokens"])

    def test_model_validation_fails_loudly_without_fallback(self):
        with mock.patch.object(
            provider,
            "chat",
            side_effect=RuntimeError("HTTP 404: was not found or no access"),
        ):
            with self.assertRaises(SystemExit) as caught:
                provider.validate_model("gemini-configured")
        message = str(caught.exception)
        self.assertIn("gemini-configured", message)
        self.assertIn("404", message)

    def test_model_validation_rejects_unparseable_probe_output(self):
        with mock.patch.object(
            provider,
            "chat",
            return_value=(None, "not json at all", {"total_tokens": 12}, 0.1),
        ):
            with self.assertRaises(SystemExit) as caught:
                provider.validate_model("gemini-configured")
        self.assertIn("unparseable", str(caught.exception))

    def test_bad_chat_credential_is_rejected_before_request_without_echo(self):
        # The chat credential is service-account JSON, so "malformed" means it
        # does not parse. The secret must never reach the message either way.
        bad_key = "not-json-sk-abc123"
        with mock.patch.dict(
            os.environ, {provider.CHAT_KEY_ENV: bad_key}, clear=False
        ):
            with mock.patch.object(provider, "_credentials", None):
                with self.assertRaises(SystemExit) as caught:
                    provider._vertex_auth()
        self.assertNotIn(bad_key, str(caught.exception))
        self.assertIn(provider.CHAT_KEY_ENV, str(caught.exception))

    def test_bad_embed_key_is_rejected_before_request_without_echo(self):
        for bad_key in ("bad\nkey", "bad key", "bad-\u00e9"):
            with self.subTest(repr=repr(bad_key)):
                with mock.patch.dict(
                    os.environ,
                    {provider.EMBED_KEY_ENV: bad_key},
                    clear=False,
                ):
                    with self.assertRaises(ValueError) as caught:
                        provider.embed(["text"])
                self.assertNotIn(bad_key, str(caught.exception))
                self.assertIn(provider.EMBED_KEY_ENV, str(caught.exception))

    def test_chat_parses_prose_wrapped_json_and_normalizes_usage(self):
        body = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": (
                                    'Result: {"picks": [], "confidence": "low"} done.'
                                )
                            }
                        ]
                    }
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 9,
                "candidatesTokenCount": 4,
                "cachedContentTokenCount": 3,
                "totalTokenCount": 13,
            },
        }
        # Nested rather than a parenthesized with block: devbox runs Python
        # 3.8 and cannot compile that syntax, which made this whole file
        # unrunnable on the one machine the eval actually runs on.
        with self._stub_auth(), mock.patch.object(
            provider.urllib.request,
            "urlopen",
            return_value=StubResponse(body),
        ) as transport:
            parsed, raw, usage, seconds = provider.chat(
                "context",
                provider.CHAT_MODEL,
                {"temperature": 1},
            )
        self.assertEqual([], parsed["picks"])
        self.assertTrue(raw.startswith("Result:"))
        self.assertEqual(3, usage["cached_tokens"])
        self.assertGreaterEqual(seconds, 0)
        request = transport.call_args.args[0]
        payload = json.loads(request.data)
        self.assertEqual(1, payload["generationConfig"]["temperature"])
        self.assertEqual("application/json", payload["generationConfig"]["responseMimeType"])
        # Pinned because the model is only served from the global endpoint on
        # this project: a regional host silently 404s the whole grid.
        self.assertEqual(
            "https://aiplatform.googleapis.com/v1/projects/stub-project"
            "/locations/global/publishers/google/models/"
            f"{provider.CHAT_MODEL}:generateContent",
            request.full_url,
        )
        self.assertEqual("Bearer stub-token", request.get_header("Authorization"))

    def test_empty_candidates_are_unparseable_not_an_error(self):
        with self._stub_auth(), mock.patch.object(
            provider.urllib.request,
            "urlopen",
            return_value=StubResponse({"candidates": []}),
        ):
            parsed, raw, usage, _ = provider.chat("context", provider.CHAT_MODEL)
        self.assertIsNone(parsed)
        self.assertEqual("", raw)
        self.assertEqual(0, usage["total_tokens"])

    def test_embed_request_uses_bearer_key_and_preserves_index_order(self):
        response = {
            "data": [
                {"index": 1, "embedding": [0.0, 1.0]},
                {"index": 0, "embedding": [1.0, 0.0]},
            ]
        }
        with mock.patch.dict(
            os.environ,
            {provider.EMBED_KEY_ENV: "stub-key"},
            clear=False,
        ), mock.patch.object(
            provider.urllib.request,
            "urlopen",
            return_value=StubResponse(response),
        ) as transport:
            vectors = provider.embed(["first", "second"])
        request = transport.call_args.args[0]
        self.assertEqual("Bearer stub-key", request.get_header("Authorization"))
        self.assertEqual(
            {"model": provider.EMBED_MODEL, "input": ["first", "second"]},
            json.loads(request.data),
        )
        self.assertEqual([[1.0, 0.0], [0.0, 1.0]], vectors)

    def test_http_error_exposes_only_status_and_body(self):
        error = urllib.error.HTTPError(
            "https://example.invalid",
            429,
            "rate limited",
            {},
            io.BytesIO(b"slow down"),
        )
        with self._stub_auth(), mock.patch.object(
            provider.urllib.request,
            "urlopen",
            side_effect=error,
        ):
            with self.assertRaises(RuntimeError) as caught:
                provider.chat("context", provider.CHAT_MODEL)
        self.assertEqual("HTTP 429: slow down", str(caught.exception))
        self.assertNotIn("stub-token", str(caught.exception))


class CellSelectionTests(unittest.TestCase):
    def test_an_empty_selection_is_the_whole_grid(self):
        # The default has to stay the full grid: every earlier round was run
        # that way, and a selection that silently narrowed it would make two
        # rounds' numbers incomparable without anything saying so.
        self.assertEqual(run2.CELLS, run2.parse_cells(""))
        self.assertEqual(run2.CELLS, run2.parse_cells(None))

    def test_the_confirmation_can_ask_for_two_arms_and_gets_only_those(self):
        self.assertEqual((("h", 10), ("d", 20)), run2.parse_cells("h@10,d@20"))
        self.assertEqual((("a", None), ("b", None)), run2.parse_cells("a, b"))

    def test_an_unknown_condition_stops_the_run_rather_than_being_dropped(self):
        # Silently dropping it would run fewer cells than asked for and report
        # the result as if it were the selection.
        for spec in ("z@99", "h@10,nope"):
            with self.subTest(spec=spec), self.assertRaises(SystemExit) as caught:
                run2.parse_cells(spec)
            self.assertIn("unknown condition", str(caught.exception))

    def test_the_confirmation_can_be_asked_for_the_k_the_sweep_chose(self):
        # Round 2 sampled k = 5, 10, 20 and the round 3 sweep looks past 20, so
        # a whitelist of the three sampled values would let stage 1 select a list
        # length that stage 2 could never confirm. k is checked for arity here,
        # not for membership in what an earlier round happened to run.
        self.assertEqual((("h", 70), ("d", 70)), run2.parse_cells("h@70,d@70"))
        self.assertEqual((("c", 424),), run2.parse_cells("c@424"))

    def test_a_malformed_k_is_named_rather_than_coerced(self):
        for spec in ("c@many", "c@0", "c@-3"):
            with self.subTest(spec=spec), self.assertRaises(SystemExit) as caught:
                run2.parse_cells(spec)
            self.assertIn("k must be a positive integer", str(caught.exception))

    def test_k_arity_is_enforced_in_both_directions(self):
        # a shows no catalog and b shows the whole shelf, so neither has a list
        # to truncate. "b@10" is someone believing they narrowed the full shelf
        # cell, and it would have quietly run the most expensive cell in the grid.
        with self.assertRaises(SystemExit) as caught:
            run2.parse_cells("b@10")
        self.assertIn("takes no k", str(caught.exception))
        # And the reverse: "h" alone would build a short list with no length.
        with self.assertRaises(SystemExit) as caught:
            run2.parse_cells("h")
        self.assertIn("needs a k", str(caught.exception))

    def test_a_selection_of_only_separators_is_an_error_not_the_whole_grid(self):
        # ",," is a typo, and answering it with all nine cells would spend the
        # full grid's budget on what was meant to be a two arm confirmation.
        with self.assertRaises(SystemExit) as caught:
            run2.parse_cells(",,")
        self.assertIn("selected no cells", str(caught.exception))


class DeploymentPythonTests(unittest.TestCase):
    """The eval runs on devbox, which is Python 3.8, not on the machine that writes it."""

    # Each entry is a fragment to look for and what to write instead. All of
    # them are 3.9 or later, and all of them are invisible on a laptop running
    # a newer interpreter: the file imports fine locally and blows up on the
    # one machine that spends money. provider.py already carried a comment
    # saying the run host is 3.8, and two other files used removeprefix anyway,
    # which is why this is a test and not a note.
    # Names are assembled rather than written out, so this table does not
    # report itself as the offender it is looking for.
    TOO_NEW = (
        ("with (", "a parenthesized with block", "write `with a(), b():`"),
        (".remove" + "prefix(", "str.removeprefix", "slice with [len(prefix) :]"),
        (".remove" + "suffix(", "str.removesuffix", "slice with [: -len(suffix)]"),
    )

    def test_no_eval_file_uses_python_the_devbox_interpreter_does_not_have(self):
        rounds = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        offenders = []
        for name in sorted(os.listdir(rounds)):
            directory = os.path.join(rounds, name)
            if not os.path.isdir(directory):
                continue
            for filename in sorted(os.listdir(directory)):
                if not filename.endswith(".py") or filename.startswith("._"):
                    continue
                with open(os.path.join(directory, filename)) as handle:
                    for number, line in enumerate(handle, 1):
                        code = line.split("#")[0]
                        for fragment, what, instead in self.TOO_NEW:
                            hit = (
                                code.rstrip().endswith(fragment)
                                if fragment == "with ("
                                else fragment in code
                            )
                            if hit:
                                offenders.append(
                                    f"{name}/{filename}:{number} uses {what}, {instead}"
                                )
        self.assertEqual([], offenders, "\n".join(offenders))


if __name__ == "__main__":
    unittest.main(verbosity=2)
