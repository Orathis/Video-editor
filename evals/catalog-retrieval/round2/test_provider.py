#!/usr/bin/env python3
"""Offline tests for the two chat backends and the entitlement probe.

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


class FamilyRoutingTests(TransportGuardedTestCase):
    def test_each_known_model_names_its_own_backend(self):
        self.assertEqual("vertex", provider.model_family(provider.CHAT_MODEL))
        self.assertEqual(
            "anthropic", provider.model_family(provider.ANTHROPIC_CHAT_MODEL)
        )
        self.assertEqual("vertex", provider.model_family("models/gemini-2.5-flash"))

    def test_an_unknown_family_stops_rather_than_using_the_default_backend(self):
        # Silently falling back would send a model B cell to model A and report
        # the answer as a cross-model reproduction. Nothing downstream can catch
        # that, because the record would carry the id that was asked for.
        for model in ("gpt-9", "", "gemini/flash"):
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


class ProbeTests(TransportGuardedTestCase):
    def test_an_unset_credential_refuses_to_start_on_both_backends(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            for model in (provider.CHAT_MODEL, "claude-haiku-4-5"):
                with self.subTest(model=model):
                    with self.assertRaises(SystemExit) as caught:
                        provider.validate_model(model)
                    self.assertIn("is not set", str(caught.exception))

    def test_an_unparseable_credential_refuses_to_start_on_both_backends(self):
        cases = (
            (provider.CHAT_MODEL, provider.CHAT_KEY_ENV, "not-json"),
            ("claude-haiku-4-5", provider.ANTHROPIC_KEY_ENV, "two lines\nof key"),
        )
        for model, env_name, bad_value in cases:
            with self.subTest(model=model):
                with mock.patch.dict(os.environ, {env_name: bad_value}, clear=True):
                    with self.assertRaises((SystemExit, ValueError)) as caught:
                        provider.validate_model(model)
                # The value is what is wrong, so the value is what must not be
                # echoed while saying so.
                self.assertNotIn(bad_value, str(caught.exception))

    def test_an_unentitled_model_refuses_to_start_on_both_backends(self):
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

    def test_two_models_never_collapse_into_one_cell(self):
        first = _record("claude-haiku-4-5")
        second = _record(provider.CHAT_MODEL)
        self.assertNotEqual(run2._record_key(first), run2._record_key(second))
        self.assertNotEqual(
            run2._cell_name("h", 10, first["model"]),
            run2._cell_name("h", 10, second["model"]),
        )
        self.assertIn("claude-haiku-4-5", run2._cell_name("h", 10, first["model"]))

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

    def test_a_model_with_no_price_row_stops_the_run(self):
        # Including one from the right family: the family says who serves it,
        # not what it costs, and an unpriced run has no working spend gate.
        with self.assertRaisesRegex(SystemExit, "no price table entry"):
            run2.usage_cost({}, "claude-opus-5")


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
