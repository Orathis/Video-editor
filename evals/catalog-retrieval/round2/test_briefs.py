#!/usr/bin/env python3
"""Offline tests for the round-two brief generator and its gates."""

import hashlib
import json
import math
import random
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest import mock

import gen_briefs as briefs
import harness2
import provider


PASSING_BRIEF = (
    "Group the subject into a singular beat. Shape a lucid cadence, then land "
    "decisively. Keep the moment purposeful, poised, and uncluttered."
)


def canned_response(brief_text, why_text="A clear purpose makes this fit."):
    parsed = {
        "brief": brief_text,
        "why_best": why_text,
        "why_bad": why_text,
        "trap": why_text,
    }
    return parsed, json.dumps(parsed), {}, 0.01


def _fixture_vector(seed, dimensions=64):
    digest = hashlib.sha256(seed.encode()).digest()
    rng = random.Random(int.from_bytes(digest[:8], "big"))
    values = [rng.gauss(0.0, 1.0) for _ in range(dimensions)]
    length = math.sqrt(sum(value * value for value in values))
    return [value / length for value in values]


class BriefGeneratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(briefs.CATALOG.read_text(encoding="utf-8"))
        cls.entries = harness2.load_shelf()

    def setUp(self):
        self.transport_guard = mock.patch.object(
            provider.urllib.request,
            "urlopen",
            side_effect=AssertionError("network transport must stay stubbed"),
        )
        self.transport_guard.start()

    def tearDown(self):
        self.transport_guard.stop()

    def test_source_loader_uses_primitive_header_and_raw_registry_fields(self):
        primitive = briefs.load_source_text(
            "depth-rack-focus",
            self.catalog["depth-rack-focus"],
        )
        self.assertIn("Concept: a rack focus", primitive)
        self.assertIn("Mount contract:", primitive)
        self.assertNotIn("<!doctype", primitive)

        component = briefs.load_source_text("accordion", self.catalog["accordion"])
        self.assertIn("name: accordion", component)
        self.assertIn("type: hyperframes:component", component)
        self.assertIn("tags: ui-primitive", component)
        self.assertNotIn("existence_proof", component)

    def test_verbatim_shelf_blurb_is_rejected_by_vocabulary_gate(self):
        name = "caliper-caption-rail"
        reason = briefs.validate_candidate(name, self.entries[name], self.entries)
        self.assertIsNotNone(reason)
        self.assertTrue(reason.startswith("vocabulary:"), reason)

    def test_isolated_brief_is_rejected_in_synthetic_and_real_shelves(self):
        synthetic = {
            "target": "orchid saffron",
            "other-a": "harbor cobalt",
            "other-b": "lantern quartz",
        }
        count, isolated = briefs.distractor_gate(
            "Orchid arrives with a poised and lucid finish.",
            "target",
            synthetic,
        )
        self.assertEqual(0, count)
        self.assertTrue(isolated)

        # Its real-shelf self-query has target score 6.324555 and zero entries
        # at or above the 0.5 target-score band.
        name = "caliper-caption-rail"
        count, isolated = briefs.distractor_gate(
            self.entries[name],
            name,
            self.entries,
        )
        self.assertEqual(0, count)
        self.assertTrue(isolated)

    def test_name_forms_are_caught_and_never_survive_an_accepted_corpus(self):
        name = "caption-camera-follow"
        for leaked in (
            name,
            name.replace("-", " ").upper(),
            name.replace("-", "_"),
        ):
            with self.subTest(leaked=leaked):
                self.assertTrue(briefs.contains_move_name(f"Use {leaked} now.", name))

        responses = [
            canned_response(f"Use {name.replace('-', ' ')} for this beat."),
            canned_response(PASSING_BRIEF),
        ]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with mock.patch.object(provider, "chat", side_effect=responses):
                result = briefs.generate_corpus(
                    self.entries,
                    self.catalog,
                    [(name, "primitive")],
                    chat=provider.chat,
                    briefs_dir=root / "briefs",
                    gold_dir=root / "gold",
                    emit=lambda _: None,
                )
        self.assertEqual(1, len(result["accepted"]))
        for item in result["accepted"]:
            self.assertFalse(briefs.contains_move_name(item["brief_text"], item["name"]))

    def test_target_choice_is_deterministic_and_exactly_equal_thirds(self):
        first = briefs.choose_targets(self.catalog)
        second = briefs.choose_targets(self.catalog)
        self.assertEqual(first, second)
        self.assertEqual(300, len(first))
        self.assertEqual(
            briefs.PER_SOURCE,
            dict(Counter(source for _, source in first)),
        )

    def test_all_accept_corpus_preserves_exact_small_stratification(self):
        requested = {"primitive": 8, "block": 8, "component": 8}
        pool = briefs.choose_targets(
            self.catalog,
            {"primitive": 40, "block": 20, "component": 80},
        )
        targets = []
        selected = Counter()
        for target in pool:
            name, source = target
            if selected[source] == requested[source]:
                continue
            try:
                briefs.load_source_text(name, self.catalog[name])
            except FileNotFoundError:
                continue
            targets.append(target)
            selected[source] += 1

        def accept_first(context, model, config=None):
            return canned_response(PASSING_BRIEF)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = briefs.generate_corpus(
                self.entries,
                self.catalog,
                targets,
                chat=accept_first,
                briefs_dir=root / "briefs",
                gold_dir=root / "gold",
                emit=lambda _: None,
            )
            written_briefs = sorted((root / "briefs").glob("*.md"))
            written_gold = sorted((root / "gold").glob("*.json"))
            first_gold = json.loads(written_gold[0].read_text(encoding="utf-8"))

        accepted_counts = Counter(item["source"] for item in result["accepted"])
        self.assertEqual(24, len(result["accepted"]))
        self.assertEqual(0, len(result["dropped"]))
        self.assertEqual(requested, dict(accepted_counts))
        for source, wanted in requested.items():
            self.assertGreaterEqual(
                accepted_counts[source],
                wanted - briefs.STRATIFICATION_TOLERANCE,
            )
        self.assertEqual(24, len(written_briefs))
        self.assertEqual(24, len(written_gold))
        self.assertEqual(
            {"best", "acceptable", "bad", "why_best", "why_bad", "trap"},
            set(first_gold),
        )
        self.assertNotIn("brief", first_gold)
        self.assertEqual("9:16", result["accepted"][0]["aspect"])

    def test_lexical_and_fixture_cosine_reports_both_execute(self):
        entries = {
            "move-alpha": "alpha orchard",
            "move-beta": "beta harbor",
            "move-gamma": "gamma lantern",
            "move-delta": "delta meadow",
        }
        accepted = [
            {"id": "001", "name": "move-alpha", "brief_text": "alpha orchard"},
            {"id": "002", "name": "move-beta", "brief_text": "beta harbor"},
            {"id": "003", "name": "move-gamma", "brief_text": "gamma lantern"},
            {"id": "004", "name": "move-delta", "brief_text": "alpha orchard"},
        ]
        moves = {name: _fixture_vector("move:" + name) for name in entries}
        vectors = {
            "model": "deterministic-local-fixture",
            "moves": moves,
            "briefs": {
                "001": moves["move-alpha"],
                "002": moves["move-beta"],
                "003": moves["move-delta"],
                "004": moves["move-delta"],
            },
        }

        with tempfile.TemporaryDirectory() as temporary:
            vector_path = Path(temporary) / "vectors.json"
            vector_path.write_text(json.dumps(vectors), encoding="utf-8")
            with mock.patch.object(harness2, "VECTORS", str(vector_path)):
                report = briefs.overlap_and_similarity_report(accepted, entries)
                recall = briefs.retriever_recall_at_k(accepted, entries, k=1)

        self.assertEqual(4, report["n"])
        self.assertEqual(4, len(report["lexical_overlap"]["values"]))
        self.assertEqual(4, len(report["cosine_similarity"]["values"]))
        self.assertEqual(0.75, recall["lexical_recall"])
        self.assertEqual(0.75, recall["semantic_recall"])
        self.assertGreater(recall["lexical_recall"], 0.0)
        self.assertGreater(recall["semantic_recall"], 0.0)

    def test_missing_vectors_reports_semantic_values_as_none(self):
        accepted = [
            {"id": "001", "name": "move", "brief_text": "alpha"},
        ]
        with mock.patch.object(harness2, "VECTORS", "/missing/vectors.json"):
            report = briefs.overlap_and_similarity_report(
                accepted,
                {"move": "alpha"},
            )
            recall = briefs.retriever_recall_at_k(
                accepted,
                {"move": "alpha"},
            )
        self.assertIsNone(report["cosine_similarity"])
        self.assertIsNone(recall["semantic_recall"])

    def test_dropped_move_records_every_rejection_reason(self):
        name = "caption-camera-follow"

        def always_leak(context, model, config=None):
            return canned_response(f"Use {name} for this beat.")

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = briefs.generate_corpus(
                self.entries,
                self.catalog,
                [(name, "primitive")],
                chat=always_leak,
                briefs_dir=root / "briefs",
                gold_dir=root / "gold",
                emit=lambda _: None,
            )
            self.assertEqual([], list((root / "briefs").glob("*.md")))
            self.assertEqual([], list((root / "gold").glob("*.json")))

        self.assertEqual(1, len(result["dropped"]))
        dropped = result["dropped"][0]
        self.assertEqual(name, dropped["name"])
        self.assertEqual(briefs.GEN_MAX_ATTEMPTS, len(dropped["reasons"]))
        self.assertEqual(
            ["name_leak"] * briefs.GEN_MAX_ATTEMPTS,
            dropped["reasons"],
        )

    def test_written_brief_and_gold_contain_no_em_dash(self):
        name = "caption-camera-follow"
        mark = chr(0x2014)
        marked_brief = PASSING_BRIEF.replace("cadence, then", f"cadence{mark}then")

        def marked(context, model, config=None):
            return canned_response(marked_brief, f"Clear{mark}purposeful.")

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = briefs.generate_corpus(
                self.entries,
                self.catalog,
                [(name, "primitive")],
                chat=marked,
                briefs_dir=root / "briefs",
                gold_dir=root / "gold",
                emit=lambda _: None,
            )
            written_brief = (root / "briefs" / "001.md").read_text(encoding="utf-8")
            written_gold = json.loads(
                (root / "gold" / "001.json").read_text(encoding="utf-8")
            )

        self.assertEqual(1, len(result["accepted"]))
        self.assertNotIn(mark, written_brief)
        for field in ("why_best", "why_bad", "trap"):
            self.assertNotIn(mark, written_gold[field])

    def test_generate_move_retries_parse_and_blank_brief(self):
        responses = [
            (None, "not json", {}, 0.01),
            ({}, "{}", {}, 0.01),
            canned_response(PASSING_BRIEF),
        ]
        calls = []

        def scripted(context, model, config=None):
            calls.append((model, config))
            return responses[len(calls) - 1]

        result, reasons = briefs.generate_move(
            "caption-camera-follow",
            "source",
            self.entries,
            "fixture-model",
            scripted,
            briefs.GEN_MAX_ATTEMPTS,
        )
        self.assertIsNotNone(result)
        self.assertEqual(["parse", "brief_missing"], reasons)
        self.assertEqual(3, len(calls))
        self.assertEqual(
            {"temperature": briefs.BRIEF_TEMPERATURE},
            calls[0][1],
        )

    def test_missing_source_preflight_makes_no_call_and_writes_nothing(self):
        catalog = {
            "missing-move": {
                "sources": "primitive",
                "install_path": "evals/catalog-retrieval/round2/no-such-source.html",
            }
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaises(FileNotFoundError):
                briefs.generate_corpus(
                    {"missing-move": "orchid"},
                    catalog,
                    [("missing-move", "primitive")],
                    chat=lambda *args, **kwargs: self.fail("chat must not run"),
                    briefs_dir=root / "briefs",
                    gold_dir=root / "gold",
                    emit=lambda _: None,
                )
            self.assertFalse((root / "briefs").exists())
            self.assertFalse((root / "gold").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
