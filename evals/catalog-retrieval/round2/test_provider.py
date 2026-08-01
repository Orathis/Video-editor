#!/usr/bin/env python3
"""Offline tests for the three chat backends and the entitlement probe.

Round 4 step 5 reruns the grid on a second model family, so the model decides
the backend and the model is a cell variable. Everything here is stubbed at the
transport: no test in this file may reach a network or spend anything.
"""

import io
import json
import os
import unittest
import urllib.error
from unittest import mock

import provider
import run2


class StubResponse:
    def __init__(self, body):
        self.body = io.BytesIO(json.dumps(body).encode("utf-8"))

    def __enter__(self):
        return self.body

    def __exit__(self, exc_type, exc, traceback):
        return False


def anthropic_body(text='{"ok": true}', usage=None):
    return {
        "content": [{"type": "text", "text": text}],
        "usage": usage or {"input_tokens": 9, "output_tokens": 5},
    }


def openai_body(text='{"ok": true}', usage=None):
    return {
        "choices": [{"message": {"role": "assistant", "content": text}}],
        "usage": usage or {"prompt_tokens": 9, "completion_tokens": 5},
    }


class TransportGuardedTestCase(unittest.TestCase):
    def setUp(self):
        self.transport_guard = mock.patch.object(
            provider.urllib.request,
            "urlopen",
            side_effect=AssertionError("network transport must stay stubbed"),
        )
        self.transport_guard.start()

    def tearDown(self):
        self.transport_guard.stop()

    def _stub_transport(self, **kwargs):
        return mock.patch.object(provider.urllib.request, "urlopen", **kwargs)

    def _stub_vertex_auth(self):
        return mock.patch.object(
            provider, "_vertex_auth", return_value=("stub-project", "stub-token")
        )

    def _stub_anthropic_key(self, value="stub-anthropic-key"):
        return mock.patch.dict(
            os.environ, {provider.ANTHROPIC_KEY_ENV: value}, clear=False
        )

    def _stub_openai_key(self, value="stub-openai-key"):
        # The same credential the embed path reads. One account, one key, one
        # name; a second name for it would be a second thing to keep in sync.
        return mock.patch.dict(
            os.environ, {provider.EMBED_KEY_ENV: value}, clear=False
        )


class FamilyRoutingTests(TransportGuardedTestCase):
    def test_each_known_model_names_its_own_backend(self):
        self.assertEqual("vertex", provider.model_family(provider.CHAT_MODEL))
        self.assertEqual(
            "anthropic", provider.model_family(provider.ANTHROPIC_CHAT_MODEL)
        )
        self.assertEqual("vertex", provider.model_family("models/gemini-2.5-flash"))
        self.assertEqual(
            "openai", provider.model_family(provider.OPENAI_CHAT_MODEL)
        )
        self.assertEqual("openai", provider.model_family("models/gpt-5.6-sol"))

    def test_an_unknown_family_stops_rather_than_using_the_default_backend(self):
        # Silently falling back would send a model B cell to model A and report
        # the answer as a cross-model reproduction. Nothing downstream can catch
        # that, because the record would carry the id that was asked for.
        # gpt5.6-luna is in the list on purpose: it is one character away from a
        # real id in a family that IS served here, and a prefix match that is
        # loose enough to accept it is loose enough to accept anything.
        for model in ("grok-4", "", "gemini/flash", "gpt5.6-luna"):
            with self.subTest(model=model), self.assertRaises(SystemExit) as caught:
                provider.model_family(model)
            self.assertIn("no known family prefix", str(caught.exception))

    def test_the_model_alone_picks_the_backend(self):
        with self._stub_anthropic_key(), self._stub_transport(
            return_value=StubResponse(anthropic_body())
        ) as transport:
            parsed, _, _, _ = provider.chat("context", "claude-haiku-4-5")
        self.assertEqual({"ok": True}, parsed)
        self.assertEqual(
            provider.ANTHROPIC_URL, transport.call_args.args[0].full_url
        )

        with self._stub_openai_key(), self._stub_transport(
            return_value=StubResponse(openai_body())
        ) as transport:
            parsed, _, _, _ = provider.chat("context", "gpt-5.6-luna")
        self.assertEqual({"ok": True}, parsed)
        self.assertEqual(
            provider.OPENAI_CHAT_URL, transport.call_args.args[0].full_url
        )

        with self._stub_vertex_auth(), self._stub_transport(
            return_value=StubResponse({"candidates": []})
        ) as transport:
            provider.chat("context", provider.CHAT_MODEL)
        self.assertIn(
            provider.VERTEX_HOST, transport.call_args.args[0].full_url
        )


class AnthropicChatTests(TransportGuardedTestCase):
    def test_the_request_carries_the_documented_headers_and_body(self):
        with self._stub_anthropic_key(), self._stub_transport(
            return_value=StubResponse(anthropic_body())
        ) as transport:
            provider.chat("context", "claude-haiku-4-5", {"temperature": 0})
        request = transport.call_args.args[0]
        self.assertEqual("stub-anthropic-key", request.get_header("X-api-key"))
        self.assertEqual(
            provider.ANTHROPIC_VERSION, request.get_header("Anthropic-version")
        )
        payload = json.loads(request.data)
        self.assertEqual("claude-haiku-4-5", payload["model"])
        self.assertEqual(0, payload["temperature"])
        # max_tokens is required by this API and defaulted by the other one.
        self.assertEqual(provider.ANTHROPIC_MAX_TOKENS, payload["max_tokens"])
        self.assertEqual(
            [{"role": "user", "content": "context"}], payload["messages"]
        )

    def test_a_prose_wrapped_answer_still_parses(self):
        body = anthropic_body('Here you go:\n```json\n{"picks": []}\n```')
        with self._stub_anthropic_key(), self._stub_transport(
            return_value=StubResponse(body)
        ):
            parsed, raw, _, _ = provider.chat("context", "claude-haiku-4-5")
        self.assertEqual({"picks": []}, parsed)
        self.assertTrue(raw.startswith("Here you go:"))

    def test_cached_input_is_added_back_before_the_cost_table_subtracts_it(self):
        # input_tokens excludes cache reads on this API, and the cost breakdown
        # computes uncached as prompt minus cached. Passing input_tokens through
        # as prompt_tokens would bill a cached run as negative uncached input.
        usage = provider.normalize_anthropic_usage(
            {
                "input_tokens": 40,
                "cache_read_input_tokens": 60,
                "cache_creation_input_tokens": 0,
                "output_tokens": 7,
            }
        )
        self.assertEqual(
            {
                "prompt_tokens": 100,
                "completion_tokens": 7,
                "thought_tokens": 0,
                "cached_tokens": 60,
                "total_tokens": 107,
            },
            usage,
        )
        breakdown = run2.usage_cost_breakdown(usage, "claude-haiku-4-5")
        self.assertAlmostEqual(40 * 1.00 / 1_000_000, breakdown["uncached"])
        self.assertAlmostEqual(60 * 0.10 / 1_000_000, breakdown["cached"])

    def test_a_missing_usage_block_reports_zero_rather_than_raising(self):
        self.assertEqual(0, provider.normalize_anthropic_usage(None)["total_tokens"])

    def test_the_key_never_reaches_a_traceback(self):
        error = urllib.error.HTTPError(
            "https://example.invalid",
            401,
            "unauthorized",
            {},
            io.BytesIO(b'{"error":{"type":"authentication_error"}}'),
        )
        with self._stub_anthropic_key("secret-key-value"), self._stub_transport(
            side_effect=error
        ):
            with self.assertRaises(RuntimeError) as caught:
                provider.chat("context", "claude-haiku-4-5")
        self.assertIn("HTTP 401", str(caught.exception))
        self.assertNotIn("secret-key-value", str(caught.exception))


class OpenAiChatTests(TransportGuardedTestCase):
    def _payload(self, model="gpt-5.6-luna", config=None):
        with self._stub_openai_key(), self._stub_transport(
            return_value=StubResponse(openai_body())
        ) as transport:
            provider.chat("context", model, config)
        return transport.call_args.args[0], json.loads(
            transport.call_args.args[0].data
        )

    def test_the_output_cap_is_translated_and_never_sent_as_max_tokens(self):
        # max_tokens is HTTP 400 on this family. A caller that passes it is
        # asking for a cap, not for a wire field, so the cap is renamed rather
        # than passed through or dropped.
        request, payload = self._payload(config={"max_tokens": 64})
        self.assertEqual("Bearer stub-openai-key", request.get_header("Authorization"))
        self.assertEqual("gpt-5.6-luna", payload["model"])
        self.assertEqual(64, payload["max_completion_tokens"])
        self.assertNotIn("max_tokens", payload)
        self.assertEqual(
            [{"role": "user", "content": "context"}], payload["messages"]
        )

        _, defaulted = self._payload()
        self.assertEqual(
            provider.OPENAI_MAX_COMPLETION_TOKENS,
            defaulted["max_completion_tokens"],
        )
        self.assertNotIn("max_tokens", defaulted)

    def test_the_request_never_carries_a_temperature(self):
        # Sending temperature 0, which is what rounds 2 and 3 ran every paid
        # cell at, is HTTP 400 here: only the default of 1 is supported. The
        # request omits the field entirely rather than asserting a value.
        for config in (None, {}, {"max_tokens": 64}):
            with self.subTest(config=config):
                _, payload = self._payload(config=config)
                self.assertNotIn("temperature", payload)

    def test_a_temperature_this_family_cannot_honour_is_refused_not_dropped(self):
        # This is the round 4 confound made loud. Quietly discarding the 0 would
        # leave a model B cell differing from its model A twin in two variables
        # with nothing in the record saying so.
        with self.assertRaises(SystemExit) as caught:
            provider.chat("context", "gpt-5.6-luna", {"temperature": 0})
        message = str(caught.exception)
        self.assertIn("samples only at temperature", message)
        self.assertIn("model A twin", message)

        # The one value it can honour is not an error.
        _, payload = self._payload(
            config={"temperature": provider.OPENAI_ONLY_TEMPERATURE}
        )
        self.assertNotIn("temperature", payload)

    def test_json_is_requested_the_same_way_the_vertex_path_requests_it(self):
        # The Vertex path sets responseMimeType, so the two families are asked
        # for the same output shape rather than one of them being left to answer
        # in prose. That is one fewer difference between a cell and its twin.
        _, payload = self._payload()
        self.assertEqual({"type": "json_object"}, payload["response_format"])

    def test_cached_input_and_reasoning_output_are_never_counted_twice(self):
        # The exact usage shape this API returns. Unlike Anthropic, prompt_tokens
        # ALREADY contains the cached share and completion_tokens ALREADY
        # contains the reasoning share, so adding either detail back would bill
        # it twice and make the spend gate read high.
        usage = provider.normalize_openai_usage(
            {
                "prompt_tokens": 100,
                "completion_tokens": 90,
                "prompt_tokens_details": {
                    "cached_tokens": 60,
                    "cache_write_tokens": 0,
                },
                "completion_tokens_details": {"reasoning_tokens": 80},
            }
        )
        self.assertEqual(
            {
                "prompt_tokens": 100,
                "completion_tokens": 90,
                "thought_tokens": 80,
                "cached_tokens": 60,
                "total_tokens": 190,
            },
            usage,
        )
        breakdown = run2.usage_cost_breakdown(usage, "gpt-5.6-luna")
        self.assertAlmostEqual(40 * 0.20 / 1_000_000, breakdown["uncached"])
        self.assertAlmostEqual(60 * 0.02 / 1_000_000, breakdown["cached"])
        self.assertAlmostEqual(90 * 1.20 / 1_000_000, breakdown["output"])

    def test_a_missing_usage_block_reports_zero_rather_than_raising(self):
        self.assertEqual(0, provider.normalize_openai_usage(None)["total_tokens"])
        self.assertEqual(
            0,
            provider.normalize_openai_usage(
                {"prompt_tokens": 0, "prompt_tokens_details": None}
            )["cached_tokens"],
        )

    def test_a_prose_wrapped_answer_still_parses(self):
        body = openai_body('```json\n{"picks": []}\n```')
        with self._stub_openai_key(), self._stub_transport(
            return_value=StubResponse(body)
        ):
            parsed, raw, _, _ = provider.chat("context", "gpt-5.6-luna")
        self.assertEqual({"picks": []}, parsed)
        self.assertTrue(raw.startswith("```json"))


class ProbeTests(TransportGuardedTestCase):
    def test_an_unset_credential_refuses_to_start_on_every_backend(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            for model in (
                provider.CHAT_MODEL,
                "claude-haiku-4-5",
                "gpt-5.6-luna",
            ):
                with self.subTest(model=model):
                    with self.assertRaises(SystemExit) as caught:
                        provider.validate_model(model)
                    self.assertIn("is not set", str(caught.exception))

    def test_an_unparseable_credential_refuses_to_start_on_every_backend(self):
        cases = (
            (provider.CHAT_MODEL, provider.CHAT_KEY_ENV, "not-json"),
            ("claude-haiku-4-5", provider.ANTHROPIC_KEY_ENV, "two lines\nof key"),
            ("gpt-5.6-luna", provider.EMBED_KEY_ENV, "two lines\nof key"),
        )
        for model, env_name, bad_value in cases:
            with self.subTest(model=model):
                with mock.patch.dict(os.environ, {env_name: bad_value}, clear=True):
                    with self.assertRaises((SystemExit, ValueError)) as caught:
                        provider.validate_model(model)
                # The value is what is wrong, so the value is what must not be
                # echoed while saying so.
                self.assertNotIn(bad_value, str(caught.exception))

    def test_an_unentitled_model_refuses_to_start_on_every_backend(self):
        forbidden = urllib.error.HTTPError(
            "https://example.invalid",
            403,
            "forbidden",
            {},
            io.BytesIO(b'{"error":{"type":"permission_error"}}'),
        )
        with self._stub_vertex_auth(), self._stub_transport(side_effect=forbidden):
            with self.assertRaises(SystemExit) as caught:
                provider.validate_model(provider.CHAT_MODEL)
        self.assertIn("is unavailable on this project", str(caught.exception))

        with self._stub_anthropic_key(), self._stub_transport(
            side_effect=forbidden
        ):
            with self.assertRaises(SystemExit) as caught:
                provider.validate_model("claude-haiku-4-5")
        self.assertIn("is unavailable on this project", str(caught.exception))

        with self._stub_openai_key(), self._stub_transport(side_effect=forbidden):
            with self.assertRaises(SystemExit) as caught:
                provider.validate_model("gpt-5.6-luna")
        self.assertIn("is unavailable on this project", str(caught.exception))

    def test_the_probe_makes_exactly_one_call_and_returns_silently(self):
        with self._stub_anthropic_key(), self._stub_transport(
            return_value=StubResponse(anthropic_body())
        ) as transport:
            self.assertIsNone(provider.validate_model("claude-haiku-4-5"))
        self.assertEqual(1, transport.call_count)
        payload = json.loads(transport.call_args.args[0].data)
        # A probe that could run away is not a single-digit-token probe.
        self.assertEqual(64, payload["max_tokens"])
        self.assertEqual(provider.PROBE_PROMPT, payload["messages"][0]["content"])

    def test_the_probe_translates_its_config_for_the_family_it_probes(self):
        # One probe, one call, on a family whose API names the cap differently
        # and rejects the temperature the other two are probed at. Hardcoding
        # one family's config here would 400 the probe before it ever reached
        # the entitlement question it exists to answer.
        with self._stub_openai_key(), self._stub_transport(
            return_value=StubResponse(openai_body())
        ) as transport:
            self.assertIsNone(provider.validate_model("gpt-5.6-luna"))
        self.assertEqual(1, transport.call_count)
        payload = json.loads(transport.call_args.args[0].data)
        self.assertEqual(64, payload["max_completion_tokens"])
        self.assertNotIn("max_tokens", payload)
        self.assertNotIn("temperature", payload)
        self.assertEqual(provider.PROBE_PROMPT, payload["messages"][0]["content"])

    def test_every_routable_family_has_a_probe_config(self):
        # PROBE_CONFIG and FAMILY_PREFIXES are two lists of the same families.
        # A family added to one and not the other fails at the probe, but this
        # says so at test time rather than on the run host.
        self.assertEqual(
            {family for _, family in provider.FAMILY_PREFIXES},
            set(provider.PROBE_CONFIG),
        )

    def test_a_model_that_answers_nothing_usable_refuses_to_start(self):
        cases = (
            (anthropic_body("not json at all"), "unparseable JSON"),
            (
                anthropic_body(usage={"input_tokens": 0, "output_tokens": 0}),
                "reported no usage",
            ),
        )
        for body, expected in cases:
            with self.subTest(expected=expected):
                with self._stub_anthropic_key(), self._stub_transport(
                    return_value=StubResponse(body)
                ):
                    with self.assertRaises(SystemExit) as caught:
                        provider.validate_model("claude-haiku-4-5")
                self.assertIn(expected, str(caught.exception))


class CellIdentityTests(unittest.TestCase):
    """The model is a cell variable, so it has to be visible in the cell."""

    def test_no_two_models_ever_collapse_into_one_cell(self):
        models = ("claude-haiku-4-5", provider.CHAT_MODEL, "gpt-5.6-luna")
        keys = [run2._record_key(_record(model)) for model in models]
        labels = [run2._cell_name("h", 10, model) for model in models]
        self.assertEqual(len(models), len(set(keys)))
        self.assertEqual(len(models), len(set(labels)))
        for model, label in zip(models, labels):
            self.assertIn(model, label)
            # The column the dry run prints into has to hold the widest label,
            # or the model silently falls off the end of the line a reader
            # checks before approving spend.
            self.assertLessEqual(len(label), run2.CELL_WIDTH)

    def test_a_record_with_no_model_is_not_treated_as_a_completed_cell(self):
        # Resume reads this key. A row that cannot say which model produced it
        # would otherwise satisfy whichever model happens to be running.
        record = _record(provider.CHAT_MODEL)
        del record["model"]
        self.assertIsNone(run2._record_key(record))

    def test_each_model_is_priced_from_its_own_row(self):
        usage = {
            "prompt_tokens": 1_000_000,
            "cached_tokens": 0,
            "completion_tokens": 1_000_000,
        }
        self.assertAlmostEqual(9.00, run2.usage_cost(usage, provider.CHAT_MODEL))
        self.assertAlmostEqual(6.00, run2.usage_cost(usage, "claude-haiku-4-5"))
        self.assertAlmostEqual(18.00, run2.usage_cost(usage, "claude-sonnet-5"))
        self.assertAlmostEqual(1.40, run2.usage_cost(usage, "gpt-5.6-luna"))

    def test_a_model_with_no_price_row_stops_the_run(self):
        # Including ones from a family that IS served here: the family says who
        # serves a model, not what it costs, and an unpriced run has no working
        # spend gate. gpt-5.6-sol is on the same account as gpt-5.6-luna and is
        # deliberately not priced, so reaching for it stops rather than
        # borrowing the sibling's row.
        for model in ("claude-opus-5", "gpt-5.6-sol"):
            with self.subTest(model=model):
                with self.assertRaisesRegex(SystemExit, "no price table entry"):
                    run2.usage_cost({}, model)

    def test_the_dry_run_prices_each_family_from_its_own_row(self):
        # One grid, three models, three different projections. A reader
        # approving spend is approving one of them, never an average, and a
        # model with no row must stop the projection rather than be quoted at
        # some other model's rate.
        totals = {}
        for model in ("claude-haiku-4-5", provider.CHAT_MODEL, "gpt-5.6-luna"):
            _, total = run2.dry_run(
                {},
                {"01": "a beat"},
                cells=(("a", None),),
                model=model,
                emit=lambda _: None,
            )
            totals[model] = total["projected_usd"]
        self.assertEqual(len(totals), len(set(totals.values())))

        with self.assertRaisesRegex(SystemExit, "no price table entry"):
            run2.dry_run(
                {},
                {"01": "a beat"},
                cells=(("a", None),),
                model="gpt-5.6-sol",
                emit=lambda _: None,
            )

    def test_the_dry_run_names_the_temperature_confound_before_it_is_approved(self):
        # The rule says exactly one variable changes between a cell and its
        # twin. On this family two do, because it will not sample at 0, and the
        # banner is where that gets approved rather than discovered afterwards.
        lines = []
        run2.dry_run(
            {},
            {"01": "a beat"},
            cells=(("a", None),),
            model="gpt-5.6-luna",
            emit=lines.append,
        )
        confound = [line for line in lines if "CONFOUND" in line]
        self.assertEqual(1, len(confound), lines)
        self.assertIn("temperature", confound[0])
        self.assertIn("TWO variables", confound[0])
        # The carried-over output figure is described per family, because this
        # one does reason and the sentence written for the family that does not
        # would be a false claim on the line a reader checks before paying.
        self.assertEqual(
            [], [line for line in lines if "not asked to think" in line]
        )
        self.assertTrue(
            any("reasoning tokens of its own" in line for line in lines), lines
        )
        self.assertEqual(
            {family for _, family in provider.FAMILY_PREFIXES if family != "vertex"},
            set(run2.CARRIED_OUTPUT_NOTE),
        )

        quiet = []
        run2.dry_run(
            {},
            {"01": "a beat"},
            cells=(("a", None),),
            model=provider.CHAT_MODEL,
            emit=quiet.append,
        )
        self.assertEqual([], [line for line in quiet if "CONFOUND" in line])


def _record(model):
    return {
        "brief": "01",
        "condition": "h",
        "k": 10,
        "model": model,
        "attempts": [],
    }


if __name__ == "__main__":
    unittest.main(verbosity=2)
