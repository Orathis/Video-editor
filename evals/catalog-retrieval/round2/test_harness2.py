#!/usr/bin/env python3
"""Offline regression tests for the round-two context builders."""

import contextlib
import importlib.util
import io
import json
import math
import os
import tempfile
import unittest
import warnings
from unittest import mock

import embed2
import harness2

HERE = os.path.dirname(os.path.abspath(__file__))
ROUND1_HARNESS = os.path.join(HERE, "..", "harness.py")


def load_round1_harness():
    spec = importlib.util.spec_from_file_location("round1_harness", ROUND1_HARNESS)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class StubResponse:
    def __init__(self, body):
        self.body = io.BytesIO(json.dumps(body).encode())

    def __enter__(self):
        return self.body

    def __exit__(self, exc_type, exc, traceback):
        return False


class Harness2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries = harness2.load_shelf()
        # Round two's own briefs, which are the fixtures these tests were
        # written against. Taking the default would follow EVAL_CORPUS_ROOT to
        # whichever corpus the shell is pointed at, so round two's regressions
        # would be run against briefs they say nothing about, and against an
        # empty corpus they do not fail, they crash in setUpClass.
        cls.briefs = harness2.load_briefs(os.path.join(harness2.HERE, "briefs"))
        cls.brief_id = sorted(cls.briefs)[0]
        cls.brief = cls.briefs[cls.brief_id]
        cls.temporary = tempfile.TemporaryDirectory()
        cls.vector_path = os.path.join(cls.temporary.name, "vectors.json")

        names = sorted(cls.entries)
        moves = {
            name: [1.0, (index + 1) / 1000]
            for index, name in enumerate(names)
        }
        with open(cls.vector_path, "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "model": "fixture",
                    "moves": moves,
                    "briefs": {
                        brief_id: [1.0, 0.0]
                        for brief_id in cls.briefs
                    },
                },
                fh,
            )

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def setUp(self):
        self.transport_guard = mock.patch.object(
            embed2.urllib.request,
            "urlopen",
            side_effect=AssertionError("network transport must stay stubbed"),
        )
        self.transport_guard.start()

    def tearDown(self):
        self.transport_guard.stop()

    def contexts(self):
        cells = (
            ("a", 10),
            ("b", 10),
            ("c", 5),
            ("c", 10),
            ("c", 20),
            ("d", 5),
            ("d", 10),
            ("d", 20),
            ("h", 10),
        )
        with mock.patch.object(harness2, "VECTORS", self.vector_path):
            return [
                harness2.build_context(
                    condition,
                    self.brief_id,
                    self.brief,
                    self.entries,
                    k,
                )
                for condition, k in cells
            ]

    def test_nine_contexts_share_exact_prefix_and_suffix(self):
        contexts = self.contexts()
        prefix = (harness2.FRAMING + "\n").encode()
        suffix = f"\n\nThe beat:\n\n{self.brief.strip()}\n".encode()
        catalogs = []

        for context, _ in contexts:
            encoded = context.encode()
            self.assertEqual(prefix, encoded[: len(prefix)])
            self.assertEqual(suffix, encoded[-len(suffix) :])
            catalog = encoded[len(prefix) : -len(suffix)]
            self.assertEqual(encoded, prefix + catalog + suffix)
            catalogs.append(catalog)
        self.assertEqual(9, len(set(catalogs)))

    def test_control_line_occupies_the_catalog_slot(self):
        control = self.contexts()[0][0].encode()
        full = self.contexts()[1][0].encode()
        prefix = (harness2.FRAMING + "\n").encode()
        suffix = f"\n\nThe beat:\n\n{self.brief.strip()}\n".encode()

        self.assertEqual(harness2.NO_CATALOG.encode(), control[len(prefix) : -len(suffix)])
        self.assertTrue(full[len(prefix) : -len(suffix)].startswith(b"Available moves"))

    def test_round_one_rankings_are_unchanged(self):
        round1 = load_round1_harness()
        self.assertEqual(round1.FRAMING, harness2.FRAMING)
        self.assertEqual(round1.STOP, harness2.STOP)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", ResourceWarning)
            entries = round1.load_shelf()
            briefs = round1.load_briefs()

            # Round one's vectors.json is gitignored and lives only where round
            # one actually ran, so a fresh checkout has the lexical half of this
            # parity check and not the semantic half. Erroring out would report a
            # missing untracked input as a broken retriever, and skipping the
            # whole test would throw away the half that needs no vectors.
            semantic = os.path.exists(round1.VECTORS)
            with mock.patch.object(harness2, "VECTORS", round1.VECTORS):
                for brief_id, brief in briefs.items():
                    self.assertEqual(round1.tokens(brief), harness2.tokens(brief))
                    for k in (5, 10, 20):
                        self.assertEqual(
                            round1.lexical_topk(brief, entries, k),
                            harness2.lexical_topk(brief, entries, k),
                        )
                        if semantic:
                            self.assertEqual(
                                round1.semantic_topk(brief_id, entries, k),
                                harness2.semantic_topk(brief_id, entries, k),
                            )
        if not semantic:
            self.skipTest(f"lexical parity checked; {round1.VECTORS} absent")

    def test_retriever_k_counts_and_prefix_stability(self):
        lexical = {
            k: harness2.lexical_topk(self.brief, self.entries, k)
            for k in (5, 10, 20)
        }
        with mock.patch.object(harness2, "VECTORS", self.vector_path):
            semantic = {
                k: harness2.semantic_topk(self.brief_id, self.entries, k)
                for k in (5, 10, 20)
            }

        for ranked in (lexical, semantic):
            for k in (5, 10, 20):
                self.assertEqual(k, len(ranked[k]))
            self.assertEqual(ranked[5], ranked[10][:5])
            self.assertEqual(ranked[10], ranked[20][:10])

    def test_hybrid_fuses_ranked_lists(self):
        with mock.patch.object(harness2, "VECTORS", self.vector_path):
            lexical = harness2.lexical_topk(self.brief, self.entries, len(self.entries))
            semantic = harness2.semantic_topk(
                self.brief_id,
                self.entries,
                len(self.entries),
            )
            hybrid = harness2.hybrid_topk(
                self.brief_id,
                self.brief,
                self.entries,
                10,
            )

        self.assertEqual(10, len(hybrid))
        self.assertTrue(set(hybrid) <= (set(lexical) | set(semantic)))

    def test_hybrid_exits_loudly_rather_than_answering_as_lexical(self):
        # This test used to assert the opposite. Hybrid fell back to the
        # lexical list whenever the vectors were missing or empty, which never
        # fired during the round two grid because the vectors were present, but
        # made an offline sweep report a hybrid curve identical to lexical with
        # nothing to signal that its real input was gone.
        lexical = harness2.lexical_topk(self.brief, self.entries, 10)

        with mock.patch.object(
            harness2, "VECTORS", self.vector_path
        ), mock.patch.object(harness2, "semantic_topk", return_value=[]):
            with self.assertRaises(SystemExit) as empty:
                harness2.hybrid_topk(self.brief_id, self.brief, self.entries, 10)
        self.assertIn("cannot fuse", str(empty.exception))

        missing = os.path.join(self.temporary.name, "missing.json")
        with mock.patch.object(harness2, "VECTORS", missing):
            with self.assertRaises(SystemExit) as absent:
                harness2.hybrid_topk(self.brief_id, self.brief, self.entries, 10)
        self.assertIn(missing, str(absent.exception))

        # The fused list still differs from the bare lexical list when the
        # vectors are present, so the loud exit did not just disable the arm.
        with mock.patch.object(harness2, "VECTORS", self.vector_path):
            fused = harness2.hybrid_topk(self.brief_id, self.brief, self.entries, 10)
        self.assertNotEqual(lexical, fused)

    def test_full_context_contains_all_424_names(self):
        context, shown = harness2.build_context(
            "b",
            self.brief_id,
            self.brief,
            self.entries,
            10,
        )
        self.assertEqual(424, len(self.entries))
        self.assertEqual(424, len(shown))
        for name in self.entries:
            self.assertIn(f"### {name}\n", context)

    def test_lexical_ties_are_name_deterministic(self):
        brief = "qzxv qzxv"
        first = harness2.lexical_topk(brief, self.entries, 20)
        second = harness2.lexical_topk(brief, dict(reversed(self.entries.items())), 20)
        expected = sorted(self.entries, reverse=True)[:20]
        self.assertEqual(expected, first)
        self.assertEqual(first, second)

    def test_no_import_or_context_build_uses_transport(self):
        contexts = self.contexts()
        self.assertEqual(9, len(contexts))

    def test_every_stage_reads_the_same_brief_corpus(self):
        # The generator, the gold committee and the runner each resolve the
        # brief directory themselves. When the runner resolved one directory up
        # it found round one's five briefs, loaded them without error, and would
        # have scored the whole paid grid against the wrong corpus.
        import gen_briefs
        import validate_gold

        runner = os.path.realpath(harness2.BRIEFS)
        self.assertEqual(runner, os.path.realpath(gen_briefs.BRIEFS_DIR))
        self.assertEqual(runner, os.path.realpath(validate_gold.BRIEFS_DIR))


class Embed2Tests(unittest.TestCase):
    def setUp(self):
        self.transport_guard = mock.patch.object(
            embed2.urllib.request,
            "urlopen",
            side_effect=AssertionError("network transport must stay stubbed"),
        )
        self.transport_guard.start()

    def tearDown(self):
        self.transport_guard.stop()

    def test_request_construction_and_index_order(self):
        captured = {}

        def stub_urlopen(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return StubResponse(
                {
                    "data": [
                        {"index": 1, "embedding": [0.0, 1.0]},
                        {"index": 0, "embedding": [1.0, 0.0]},
                    ]
                }
            )

        with mock.patch.dict(
            os.environ, {"OPENAI_API_KEY": "stub-key"}, clear=False
        ), mock.patch.object(
            embed2.urllib.request, "urlopen", side_effect=stub_urlopen
        ):
            vectors = embed2.embed(["first", "second"])

        request = captured["request"]
        body = json.loads(request.data)
        self.assertEqual("https://api.openai.com/v1/embeddings", request.full_url)
        self.assertEqual(
            {"model": embed2.MODEL, "input": ["first", "second"]},
            body,
        )
        self.assertEqual("Bearer stub-key", request.get_header("Authorization"))
        self.assertEqual("application/json", request.get_header("Content-type"))
        self.assertEqual(120, captured["timeout"])
        self.assertEqual([[1.0, 0.0], [0.0, 1.0]], vectors)

    def test_missing_key_refuses_before_transport(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(SystemExit, "not set"):
                embed2.main()

    def test_resume_batches_and_flushes_incrementally(self):
        with tempfile.TemporaryDirectory() as directory:
            out = os.path.join(directory, "vectors.json")
            with open(out, "w", encoding="utf-8") as fh:
                json.dump(
                    {
                        "model": embed2.MODEL,
                        "moves": {"move-a": [1.0]},
                        "briefs": {"brief-a": [2.0]},
                        # A vector is only reusable if the text behind its name
                        # is still the text it was made from, so the resume is
                        # keyed on the digest and the fixture has to carry one.
                        "digests": {
                            "moves": {"move-a": embed2._digest("old")},
                            "briefs": {"brief-a": embed2._digest("old")},
                        },
                    },
                    fh,
                )

            calls = []

            def stub_embed(texts):
                calls.append(texts)
                return [[float(len(text))] for text in texts]

            with mock.patch.dict(
                os.environ, {"OPENAI_API_KEY": "stub-key"}, clear=False
            ), mock.patch.object(embed2, "OUT", out), mock.patch.object(
                embed2, "BATCH_SIZE", 1
            ), mock.patch.object(
                embed2, "embed", side_effect=stub_embed
            ), mock.patch.object(
                harness2,
                "load_shelf",
                return_value={"move-a": "old", "move-b": "new"},
            ), mock.patch.object(
                harness2,
                "load_briefs",
                return_value={"brief-a": "old", "brief-b": "new brief"},
            ), contextlib.redirect_stdout(io.StringIO()):
                embed2.main()

            with open(out, encoding="utf-8") as fh:
                progress = json.load(fh)
            self.assertEqual([["new"], ["new brief"]], calls)
            self.assertEqual({"move-a", "move-b"}, set(progress["moves"]))
            self.assertEqual({"brief-a", "brief-b"}, set(progress["briefs"]))

    def test_the_corpus_root_redirects_every_module_that_writes_a_corpus(self):
        # A corpus is only coherent if the generator, the committee, the pruner,
        # the embedder and the harness all mean the same directory by it. Four
        # of these used to hold their own copy of the path, so redirecting one
        # would have left the others writing into round 2's fixtures, which are
        # what round 3's statistics are checked against.
        import importlib

        import embed2
        import gen_briefs
        import prune_corpus
        import validate_gold

        modules = (harness2, gen_briefs, validate_gold, prune_corpus, embed2)
        # What the root was before this test redirected it. Asserting it comes
        # back to HERE instead would only hold in a shell with no
        # EVAL_CORPUS_ROOT set, and every shell that actually runs the eval has
        # one. Pinned to HERE this test fails wherever the corpus is real, which
        # reads as a broken redirect rather than a test that assumed its own
        # environment.
        before = harness2.CORPUS_ROOT
        with tempfile.TemporaryDirectory() as root:
            try:
                with mock.patch.dict(
                    os.environ, {"EVAL_CORPUS_ROOT": root}, clear=False
                ):
                    for module in modules:
                        importlib.reload(module)
                    self.assertEqual(os.path.join(root, "briefs"), harness2.BRIEFS)
                    self.assertEqual(os.path.join(root, "gold"), harness2.GOLD)
                    for module, attribute in (
                        (gen_briefs, "BRIEFS_DIR"),
                        (gen_briefs, "GOLD_DIR"),
                        (gen_briefs, "ATTEMPTS_LOG"),
                        (validate_gold, "BRIEFS_DIR"),
                        (validate_gold, "GOLD_DIR"),
                        (validate_gold, "AUDIT_PATH"),
                        # The one that actually escaped: the committee wrote its
                        # checkpoint next to the code instead of next to the
                        # corpus, so every round shared one resume file.
                        (validate_gold, "DEFAULT_COMMITTEE_CHECKPOINT"),
                        (prune_corpus, "BRIEFS_DIR"),
                        (prune_corpus, "GOLD_DIR"),
                        (prune_corpus, "EXCLUDED_DIR"),
                        (prune_corpus, "AUDIT_PATH"),
                        (embed2, "OUT"),
                    ):
                        value = str(getattr(module, attribute))
                        self.assertTrue(
                            value.startswith(root),
                            f"{module.__name__}.{attribute} is {value}, outside the root",
                        )
            finally:
                for module in modules:
                    importlib.reload(module)
        self.assertEqual(before, harness2.CORPUS_ROOT)

    def test_a_reused_name_holding_new_text_is_embedded_again(self):
        # Brief ids are positions in a corpus, not identities. A regenerated
        # corpus starts at 001 again, so every id already appears in the vector
        # file against a different brief. Resuming on the name alone would hand
        # the new corpus the old corpus's vectors, silently, and the semantic
        # and hybrid arms would rank against a query nobody wrote.
        progress = {
            "model": embed2.MODEL,
            "moves": {},
            "briefs": {"001": [9.0]},
            "digests": {"moves": {}, "briefs": {"001": embed2._digest("round two brief")}},
        }
        with tempfile.TemporaryDirectory() as directory:
            with mock.patch.object(
                embed2, "OUT", os.path.join(directory, "vectors.json")
            ), mock.patch.object(embed2, "embed", return_value=[[7.0]]):
                embed2._fill_missing(progress, "briefs", {"001": "round three brief"})
        self.assertEqual([7.0], progress["briefs"]["001"])
        self.assertEqual(
            embed2._digest("round three brief"), progress["digests"]["briefs"]["001"]
        )

    def test_a_vector_file_with_no_digests_is_not_trusted(self):
        # Round 2's file predates the digests, so nothing in it can be shown to
        # match the text on disk now. Re-embedding all of it costs a tenth of a
        # cent; trusting it costs a wrong answer that looks like a right one.
        progress = {"model": embed2.MODEL, "moves": {}, "briefs": {"001": [9.0]}}
        with tempfile.TemporaryDirectory() as directory:
            with mock.patch.object(
                embed2, "OUT", os.path.join(directory, "vectors.json")
            ), mock.patch.object(embed2, "embed", return_value=[[7.0]]) as embedded:
                embed2._fill_missing(progress, "briefs", {"001": "unchanged"})
        embedded.assert_called_once_with(["unchanged"])
        self.assertEqual([7.0], progress["briefs"]["001"])

    def test_completed_batch_survives_a_later_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            out = os.path.join(directory, "vectors.json")
            progress = {"model": embed2.MODEL, "moves": {}, "briefs": {}}
            with mock.patch.object(embed2, "OUT", out), mock.patch.object(
                embed2, "BATCH_SIZE", 1
            ), mock.patch.object(
                embed2,
                "embed",
                side_effect=([[1.0]], RuntimeError("stubbed failure")),
            ):
                with self.assertRaisesRegex(RuntimeError, "stubbed failure"):
                    embed2._fill_missing(
                        progress,
                        "moves",
                        {"move-a": "first", "move-b": "second"},
                    )

            with open(out, encoding="utf-8") as fh:
                saved = json.load(fh)
            self.assertEqual({"move-a": [1.0]}, saved["moves"])

    def test_batch_size_is_reasonable_for_424_entries(self):
        self.assertGreater(embed2.BATCH_SIZE, 1)
        self.assertLess(embed2.BATCH_SIZE, 424)
        self.assertEqual(5, math.ceil(424 / embed2.BATCH_SIZE))


if __name__ == "__main__":
    unittest.main(verbosity=2)
