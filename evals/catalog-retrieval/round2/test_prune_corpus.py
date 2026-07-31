#!/usr/bin/env python3
"""Checks for the corpus prune. Run with: python3 test_prune_corpus.py"""

import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import prune_corpus  # noqa: E402

AUDIT = """# Gold Audit

## Corpus result

- Corpus accuracy: 66.67% (2/3)
- Accuracy floor: 95.00%

## Disagreements

### Disagreement 001

Constructed gold candidates: alpha

Committee candidates: alpha, beta

Committee majority: beta

- Pass 1: beta, because.

### Disagreement 002

Constructed gold candidates: gamma, delta

Committee candidates: gamma

Committee majority: gamma

- Pass 1: gamma, because.
"""


def test_only_wrong_majorities_are_unrecoverable():
    unrecoverable, correct, total = prune_corpus.parse_audit(AUDIT)
    assert unrecoverable == ["001"], unrecoverable
    assert (correct, total) == (2, 3), (correct, total)


def test_the_hand_decision_sample_is_not_read_as_a_disagreement():
    # The real report ends with "## Sampled for hand decision", whose first
    # heading is "### Disagreement sample". An unscoped scan read that as a
    # disagreement with no gold line and refused to prune anything.
    text = AUDIT + """
## Sampled for hand decision

### Disagreement sample

- 001 [Text effects.], hand decision: pending
"""
    unrecoverable, _, _ = prune_corpus.parse_audit(text)
    assert unrecoverable == ["001"], unrecoverable


def test_a_split_majority_still_counts_as_unrecoverable():
    # "no majority" is what the audit prints when all three passes differ. It
    # is never a gold candidate, so it has to fall out as unrecoverable, not
    # slip through as agreement.
    text = AUDIT.replace("Committee majority: beta", "Committee majority: no majority")
    unrecoverable, _, _ = prune_corpus.parse_audit(text)
    assert unrecoverable == ["001"], unrecoverable


def test_a_parse_that_disagrees_with_the_stated_accuracy_stops():
    # The guard that makes markdown parsing safe: if the report format drifts
    # the count stops matching and nothing is moved.
    text = AUDIT.replace("(2/3)", "(3/3)")
    try:
        prune_corpus.parse_audit(text)
    except SystemExit as error:
        assert "report format changed" in str(error), error
    else:
        raise AssertionError("a miscounted parse was accepted")


def test_missing_accuracy_line_stops():
    text = AUDIT.replace("- Corpus accuracy: 66.67% (2/3)\n", "")
    try:
        prune_corpus.parse_audit(text)
    except SystemExit as error:
        assert "no corpus accuracy line" in str(error), error
    else:
        raise AssertionError("an audit with no accuracy line was accepted")


def test_prune_moves_both_halves_of_the_pair():
    root = tempfile.mkdtemp()
    try:
        briefs = os.path.join(root, "briefs")
        gold = os.path.join(root, "gold")
        excluded = os.path.join(root, "excluded")
        os.makedirs(briefs)
        os.makedirs(gold)
        for brief_id in ("001", "002"):
            with open(os.path.join(briefs, f"{brief_id}.md"), "w") as fh:
                fh.write("beat")
            with open(os.path.join(gold, f"{brief_id}.json"), "w") as fh:
                fh.write("{}")

        moved = prune_corpus.prune(["001"], briefs, gold, excluded)

        assert moved == ["001"], moved
        assert sorted(os.listdir(briefs)) == ["002.md"]
        assert sorted(os.listdir(gold)) == ["002.json"]
        assert sorted(os.listdir(os.path.join(excluded, "briefs"))) == ["001.md"]
        assert sorted(os.listdir(os.path.join(excluded, "gold"))) == ["001.json"]
    finally:
        shutil.rmtree(root)


def test_prune_is_idempotent():
    # Re-running after a completed prune must be a no-op rather than an error,
    # so a resumed session can call it without checking state first.
    root = tempfile.mkdtemp()
    try:
        briefs = os.path.join(root, "briefs")
        gold = os.path.join(root, "gold")
        excluded = os.path.join(root, "excluded")
        os.makedirs(briefs)
        os.makedirs(gold)
        with open(os.path.join(briefs, "001.md"), "w") as fh:
            fh.write("beat")
        with open(os.path.join(gold, "001.json"), "w") as fh:
            fh.write("{}")

        prune_corpus.prune(["001"], briefs, gold, excluded)
        assert prune_corpus.prune(["001"], briefs, gold, excluded) == []
    finally:
        shutil.rmtree(root)


def test_a_half_moved_pair_stops():
    root = tempfile.mkdtemp()
    try:
        briefs = os.path.join(root, "briefs")
        gold = os.path.join(root, "gold")
        os.makedirs(briefs)
        os.makedirs(gold)
        with open(os.path.join(briefs, "001.md"), "w") as fh:
            fh.write("beat")
        try:
            prune_corpus.prune(["001"], briefs, gold, os.path.join(root, "excluded"))
        except SystemExit as error:
            assert "no brief/gold pair" in str(error), error
        else:
            raise AssertionError("a brief with no gold was moved anyway")
    finally:
        shutil.rmtree(root)


def main():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"test_prune_corpus.py: {len(tests)} scenarios passed")


if __name__ == "__main__":
    main()
