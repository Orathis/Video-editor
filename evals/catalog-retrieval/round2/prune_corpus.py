#!/usr/bin/env python3
"""Resolve the briefs the blind committee did not reconstruct.

The gold sets are correct by construction: every brief was written from one
known move. The committee tests something narrower, whether an independent
reader holding the whole shelf lands on that same move from the brief alone.
At 424 entries some moves are near twins, so a brief can describe a beat that
two moves answer equally well.

Round 3 removed every one of those briefs. That is what made its corpus biased:
the dropped briefs were exactly the hard retrieval cases, so every recall number
it published is an upper bound on the corpus it generated. Round 4 merges them
instead. An independent reader landing on a different move, from the brief
alone, holding the whole shelf, is the honest evidence that the beat has more
than one right answer, so that move joins the acceptable set and the brief is
scored rather than excluded.

Two kinds of brief still leave the corpus, and both are counted and named rather
than dropped in silence: one no two readers could place at all, and one whose
majority is a move the constructor marked known-wrong, which is a conflict for a
human rather than for this script. They move, with their gold, into excluded/.
Nothing is deleted, so the drop stays auditable and reversible.

Reads GOLD-AUDIT.md, the committed record of the committee run, rather than
calling the committee again. The parse is checked against the accuracy line in
that same file, so a format drift fails loudly instead of pruning the wrong
briefs.
"""

import json
import os
import re
import shutil
import sys

import gate2
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
# What render_audit prints when all three readers differed. It is never a shelf
# move, so it can never be merged into an acceptable set.
NO_MAJORITY = "no majority"


def _disagreements(text):
    """(brief id, constructed candidates, committee majority) per audit block."""
    section = SECTION_RE.search(text)
    if section is None:
        raise SystemExit("audit has no disagreements section; refusing to guess")
    body_text = section.group(1)

    blocks = list(BLOCK_RE.finditer(body_text))
    parsed = []
    for index, block in enumerate(blocks):
        end = blocks[index + 1].start() if index + 1 < len(blocks) else len(body_text)
        body = body_text[block.end() : end]
        constructed = CONSTRUCTED_RE.search(body)
        majority = MAJORITY_RE.search(body)
        if constructed is None or majority is None:
            raise SystemExit(
                f"disagreement {block.group(1)} is missing its gold or majority line"
            )
        candidates = {move.strip() for move in constructed.group(1).split(",")}
        parsed.append((block.group(1), candidates, majority.group(1).strip()))
    return parsed


def parse_audit(text):
    """Return (unreconstructed ids, correct count, total) from an audit report."""
    accuracy = ACCURACY_RE.search(text)
    if accuracy is None:
        raise SystemExit("audit has no corpus accuracy line; refusing to guess")
    correct, total = int(accuracy.group(1)), int(accuracy.group(2))

    unrecoverable = [
        brief_id
        for brief_id, candidates, majority in _disagreements(text)
        if majority not in candidates
    ]

    # The audit states its own arithmetic. If the parse disagrees with it the
    # report format moved and every id below is suspect, so stop here rather
    # than move files on a bad read.
    if len(unrecoverable) != total - correct:
        raise SystemExit(
            f"parsed {len(unrecoverable)} unrecoverable briefs but the audit "
            f"reports {total - correct}; the report format changed"
        )
    return unrecoverable, correct, total


def _gold_path(gold_dir, brief_id):
    return os.path.join(gold_dir, f"{brief_id}.json")


def merge_plan(text, gold_dir=GOLD_DIR):
    """Split the unreconstructed briefs into near twins and briefs to exclude.

    Returns ({brief id: the move to merge in}, [brief id to exclude, ...]).
    Deciding this from the audit alone would be wrong for the contested case:
    whether the majority is a move the constructor already ruled out is written
    in the gold record, not in the report, so the record is read here.
    """
    plan, excluded = {}, []
    for brief_id, candidates, majority in _disagreements(text):
        if majority in candidates:
            continue
        if majority == NO_MAJORITY:
            excluded.append(brief_id)
            continue
        path = _gold_path(gold_dir, brief_id)
        if not os.path.exists(path):
            raise SystemExit(f"brief {brief_id} has no gold record at {path}")
        with open(path, encoding="utf-8") as fh:
            entry = json.load(fh)
        if majority in set(entry.get("bad") or []):
            # The constructor called this move wrong for this beat and two
            # readers called it the answer. Merging would write a record that
            # lists one move both ways, which gate2.acceptable refuses, and
            # picking a side here would be this script overruling hand-written
            # gold on the strength of two reads.
            excluded.append(brief_id)
            continue
        plan[brief_id] = majority
    return plan, excluded


def merge(plan, gold_dir=GOLD_DIR):
    """Add each near twin to its brief's acceptable set, in place. Idempotent."""
    merged = []
    for brief_id, move in sorted(plan.items()):
        path = _gold_path(gold_dir, brief_id)
        with open(path, encoding="utf-8") as fh:
            entry = json.load(fh)
        if move in (entry.get("best") or []):
            continue
        # Appended rather than sorted, so the constructed target stays first and
        # the per-stratum rows keep reading it.
        entry["best"] = list(entry["best"]) + [move]
        # Refuse to write a record the scorer would refuse to read.
        gate2.acceptable(entry, brief_id)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(entry, fh, indent=2)
            fh.write("\n")
        merged.append(brief_id)
    return merged


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
    plan, excluded = merge_plan(text)
    merged = merge(plan)
    moved = prune(excluded)
    kept = len([name for name in os.listdir(BRIEFS_DIR) if name.endswith(".md")])
    print(f"audit: {correct}/{total} reconstructed, {len(unrecoverable)} not")
    print(f"merged {len(merged)} near twins into multi-target gold")
    print(f"moved {len(moved)} briefs to excluded/, {kept} remain")
    # The scored corpus is the reconstructed briefs plus the merged near twins.
    # Round 3 expected kept == correct because it dropped every disagreement;
    # dropping that expectation without stating the new one would let a silent
    # over-merge look like a clean run.
    scorable = correct + len(plan)
    if kept != scorable:
        print(
            f"WARNING: {kept} briefs remain but {correct} were reconstructed "
            f"and {len(plan)} merge, which is {scorable}"
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
