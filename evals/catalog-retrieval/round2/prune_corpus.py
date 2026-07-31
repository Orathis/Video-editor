#!/usr/bin/env python3
"""Move briefs the blind committee could not reconstruct out of the corpus.

The gold sets are correct by construction: every brief was written from one
known move. The committee tests something narrower, whether an independent
reader holding the whole shelf lands on that same move from the brief alone.
At 424 entries some moves are near twins, so 45 of 272 briefs describe a beat
that two moves answer equally well. Those briefs do not have one right answer
and cannot score a retrieval arm fairly.

This moves them, with their gold, into excluded/. Nothing is deleted and
nothing is rewritten, so the drop stays auditable and reversible. The kept
corpus is easier than the generated one, which the verdict has to say out
loud: the hardest near-twin cases, where retrieval would matter most, are
exactly the ones removed.

Reads GOLD-AUDIT.md, the committed record of the committee run, rather than
calling the committee again. The parse is checked against the accuracy line in
that same file, so a format drift fails loudly instead of pruning the wrong
briefs.
"""

import os
import re
import shutil
import sys

import harness2

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT_PATH = os.path.join(harness2.CORPUS_ROOT, "GOLD-AUDIT.md")
BRIEFS_DIR = harness2.BRIEFS
GOLD_DIR = harness2.GOLD
EXCLUDED_DIR = os.path.join(harness2.CORPUS_ROOT, "excluded")

ACCURACY_RE = re.compile(r"^- Corpus accuracy: [\d.]+% \((\d+)/(\d+)\)$", re.M)
# Anchored to the "## Disagreements" section. A later section lists the briefs
# drawn for hand decision under a "### Disagreement sample" heading, which a
# loose scan reads as one more disagreement with no gold line under it.
SECTION_RE = re.compile(r"^## Disagreements$(.*?)(?=^## |\Z)", re.M | re.S)
BLOCK_RE = re.compile(r"^### Disagreement (\S+)$", re.M)
CONSTRUCTED_RE = re.compile(r"^Constructed gold candidates: (.+)$", re.M)
MAJORITY_RE = re.compile(r"^Committee majority: (.+)$", re.M)


def parse_audit(text):
    """Return (unrecoverable ids, correct count, total) from an audit report."""
    accuracy = ACCURACY_RE.search(text)
    if accuracy is None:
        raise SystemExit("audit has no corpus accuracy line; refusing to guess")
    correct, total = int(accuracy.group(1)), int(accuracy.group(2))

    section = SECTION_RE.search(text)
    if section is None:
        raise SystemExit("audit has no disagreements section; refusing to guess")
    text = section.group(1)

    blocks = list(BLOCK_RE.finditer(text))
    unrecoverable = []
    for index, block in enumerate(blocks):
        end = blocks[index + 1].start() if index + 1 < len(blocks) else len(text)
        body = text[block.end() : end]
        constructed = CONSTRUCTED_RE.search(body)
        majority = MAJORITY_RE.search(body)
        if constructed is None or majority is None:
            raise SystemExit(
                f"disagreement {block.group(1)} is missing its gold or majority line"
            )
        candidates = {move.strip() for move in constructed.group(1).split(",")}
        if majority.group(1).strip() not in candidates:
            unrecoverable.append(block.group(1))

    # The audit states its own arithmetic. If the parse disagrees with it the
    # report format moved and every id below is suspect, so stop here rather
    # than move files on a bad read.
    if len(unrecoverable) != total - correct:
        raise SystemExit(
            f"parsed {len(unrecoverable)} unrecoverable briefs but the audit "
            f"reports {total - correct}; the report format changed"
        )
    return unrecoverable, correct, total


def prune(brief_ids, briefs_dir=BRIEFS_DIR, gold_dir=GOLD_DIR, excluded_dir=EXCLUDED_DIR):
    """Move each brief and its gold under excluded/. Returns the moved pairs."""
    excluded_briefs = os.path.join(excluded_dir, "briefs")
    excluded_gold = os.path.join(excluded_dir, "gold")
    os.makedirs(excluded_briefs, exist_ok=True)
    os.makedirs(excluded_gold, exist_ok=True)

    moved = []
    for brief_id in brief_ids:
        brief = os.path.join(briefs_dir, f"{brief_id}.md")
        gold = os.path.join(gold_dir, f"{brief_id}.json")
        # A half moved pair would leave load_corpus comparing mismatched id
        # sets, so both files have to be present before either one moves.
        if not os.path.exists(brief) or not os.path.exists(gold):
            if os.path.exists(os.path.join(excluded_briefs, f"{brief_id}.md")):
                continue
            raise SystemExit(f"brief {brief_id} has no brief/gold pair to move")
        shutil.move(brief, os.path.join(excluded_briefs, f"{brief_id}.md"))
        shutil.move(gold, os.path.join(excluded_gold, f"{brief_id}.json"))
        moved.append(brief_id)
    return moved


def main():
    with open(AUDIT_PATH, encoding="utf-8") as fh:
        text = fh.read()
    unrecoverable, correct, total = parse_audit(text)
    moved = prune(unrecoverable)
    kept = len([name for name in os.listdir(BRIEFS_DIR) if name.endswith(".md")])
    print(f"audit: {correct}/{total} reconstructed")
    print(f"moved {len(moved)} briefs to excluded/, {kept} remain")
    if kept != correct:
        print(f"WARNING: {kept} briefs remain but the audit reconstructed {correct}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
