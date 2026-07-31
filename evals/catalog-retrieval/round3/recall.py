#!/usr/bin/env python3
"""Offline recall for every retrieval arm, at any k, with no model calls.

Round two bought recall as a side effect of a paid grid. Recall is not a model
question: the retriever decides whether the gold move is on the shown list
before a single token is spent. This recomputes the same number locally.

The ranking functions are imported from the round two harness, never
reimplemented. A second copy would drift, and the equivalence proof against the
paid grid's own log would stop meaning anything.
"""

import argparse
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROUND2 = os.path.join(os.path.dirname(HERE), "round2")
sys.path.insert(0, ROUND2)

import harness2  # noqa: E402

CORPUS = os.path.join(ROUND2, "briefs")
GOLD = os.path.join(ROUND2, "gold")
VECTORS = os.path.join(ROUND2, "vectors.json")
ARMS = ("lexical", "semantic", "hybrid")
# Round two stopped at k=20 with semantic recall still climbing, 0.282 at k=10
# to 0.485 at k=20. Nobody has looked past that, so the default sweep does.
KS = (5, 10, 20, 30, 40, 50, 60, 70, 80)


def load_briefs(corpus_dir=CORPUS):
    """Map brief id to brief text, the same ids the gold set is keyed by."""
    briefs = {}
    for path in sorted(glob.glob(os.path.join(corpus_dir, "*.md"))):
        with open(path, encoding="utf-8") as fh:
            briefs[os.path.basename(path)[: -len(".md")]] = fh.read()
    return briefs


def load_gold(gold_dir=GOLD):
    gold = {}
    for path in sorted(glob.glob(os.path.join(gold_dir, "*.json"))):
        with open(path, encoding="utf-8") as fh:
            gold[os.path.basename(path)[: -len(".json")]] = json.load(fh)
    return gold


def shown(arm, brief_id, text, entries, k):
    """The names one arm would put in front of the model for this brief."""
    if arm == "lexical":
        return harness2.lexical_topk(text, entries, k)
    if arm == "semantic":
        return harness2.semantic_topk(brief_id, entries, k)
    if arm == "hybrid":
        return harness2.hybrid_topk(brief_id, text, entries, k)
    raise ValueError("unknown arm {0!r}".format(arm))


def shown_flags(arm, briefs, gold, entries, k):
    """Per brief, was a gold best move on the shown list.

    Keyed only by briefs that still have gold. A brief whose gold was pruned
    away cannot be scored, and counting it as a miss would report recall over a
    corpus that was never run.
    """
    flags = {}
    for brief_id, text in briefs.items():
        if brief_id not in gold:
            continue
        best = gold[brief_id]["best"]
        flags[brief_id] = bool(set(best) & set(shown(arm, brief_id, text, entries, k)))
    return flags


def recall(arm, briefs, gold, entries, k):
    flags = shown_flags(arm, briefs, gold, entries, k)
    # An empty corpus, or one whose gold was entirely pruned, is a legitimate
    # state at a wave boundary. It reports zero rather than raising.
    return sum(flags.values()) / len(flags) if flags else 0.0


def sweep(briefs, gold, entries, arms=ARMS, ks=KS):
    """Recall per arm per k. Nested arm -> k -> rate."""
    return {
        arm: {k: round(recall(arm, briefs, gold, entries, k), 4) for k in ks}
        for arm in arms
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", default=CORPUS)
    parser.add_argument("--gold", default=GOLD)
    parser.add_argument("--vectors", default=VECTORS)
    parser.add_argument("--arms", default=",".join(ARMS))
    parser.add_argument("--ks", default=",".join(str(k) for k in KS))
    args = parser.parse_args(argv)

    # The imported harness reads its vector file from a module global and keys
    # its cache by that path, so pointing it at another file is the supported
    # way to sweep a different embedding set.
    harness2.VECTORS = args.vectors

    briefs = load_briefs(args.corpus)
    gold = load_gold(args.gold)
    entries = harness2.load_shelf()
    ks = [int(k) for k in args.ks.split(",")]
    arms = args.arms.split(",")

    print("{0} briefs, {1} gold, {2} shelf entries".format(len(briefs), len(gold), len(entries)))
    header = "arm".ljust(10) + "".join("k={0}".format(k).rjust(9) for k in ks)
    print(header)
    # Arms are swept one at a time so a missing embedding file, which the
    # harness reports by exiting, only silences the arms that need vectors.
    # Lexical needs none and must still print.
    unavailable = []
    for arm in arms:
        try:
            curve = sweep(briefs, gold, entries, [arm], ks)[arm]
        except SystemExit as exit_reason:
            unavailable.append((arm, str(exit_reason)))
            continue
        print(arm.ljust(10) + "".join("{0:.4f}".format(curve[k]).rjust(9) for k in ks))
    for arm, reason in unavailable:
        print("{0} not swept: {1}".format(arm.ljust(10), reason))
    return 0


if __name__ == "__main__":
    sys.exit(main())
