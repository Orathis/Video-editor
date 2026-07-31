#!/usr/bin/env python3
"""Context builders for the nine round-two catalog cells."""

import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SHELF = os.path.join(HERE, "shelf.md")
# Round two's own briefs, the ones the generator writes here. Pointing one
# directory up reaches round one's five briefs instead, which loads and runs
# without complaint and would quietly measure the whole grid on the wrong
# corpus.
BRIEFS = os.path.join(HERE, "briefs")
VECTORS = os.path.join(HERE, "vectors.json")
RRF_C = 60

# Dropped from the brief and the entries before lexical scoring. Without this,
# every entry matches on "the" and the ranking is noise.
STOP = set(
    "the a an and or of to in on at is are be it its for with that this as by from into "
    "one two must not no all over under across while when where which who whom whose they "
    "them their we our you your he she his her but if then than so such can may might will "
    "would should each other another same both few more most some any every".split()
)

FRAMING = """You are picking motion for one storyboard beat.

Return ONLY a JSON object, no prose, no code fence:

{"picks": [{"move": "<name>", "why": "<one sentence>"}], "confidence": "high|medium|low"}

Rules:
- Name between one and three moves, best first.
- "move" must be the exact name of a move, not a description.
- If nothing fits, return an empty picks list rather than inventing a name.
"""

NO_CATALOG = "You have no catalog of existing moves. Name the moves you would use."


def tokens(text):
    return [w for w in re.findall(r"[a-z]+", text.lower()) if w not in STOP and len(w) > 2]


def load_shelf():
    """Return the browsable fields keyed by entry name."""
    entries = {}
    with open(SHELF, encoding="utf-8") as fh:
        text = fh.read()
    for block in re.split(r"^### ", text, flags=re.M)[1:]:
        lines = block.splitlines()
        body = [
            line
            for line in lines[1:]
            if line.split(":")[0] in ("group", "what", "use_when", "avoid_when")
        ]
        entries[lines[0].strip()] = "\n".join(body)
    return entries


def load_briefs():
    briefs = {}
    for path in sorted(glob.glob(os.path.join(BRIEFS, "*.md"))):
        with open(path, encoding="utf-8") as fh:
            briefs[os.path.basename(path)[: -len(".md")]] = fh.read()
    return briefs


def _render(entries, names):
    return "\n\n".join(f"### {name}\n{entries[name]}" for name in names)


def lexical_topk(brief, entries, k):
    """Rank by shared vocabulary, length-normalized so long entries do not win by size."""
    want = set(tokens(brief))
    scored = []
    for name, body in entries.items():
        have = set(tokens(body))
        # sqrt normalization: a longer entry has more chances to overlap, and
        # without this the wordiest blurb ranks first for every brief.
        scored.append((len(want & have) / (len(have) ** 0.5 or 1), name))
    scored.sort(reverse=True)
    return [name for _, name in scored[:k]]


def semantic_topk(brief_id, entries, k):
    """Return cosine-ranked names from the precomputed vectors."""
    if not os.path.exists(VECTORS):
        raise SystemExit(f"missing {VECTORS}: run embed2.py first")
    with open(VECTORS, encoding="utf-8") as fh:
        vectors = json.load(fh)
    query = vectors["briefs"][brief_id]
    moves = vectors["moves"]

    def cos(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(x * x for x in b) ** 0.5
        return dot / (na * nb)

    ranked = sorted(((cos(query, vector), name) for name, vector in moves.items()), reverse=True)
    return [name for _, name in ranked[:k]]


def hybrid_topk(brief_id, brief, entries, k):
    """Fuse full lexical and semantic rankings with reciprocal rank fusion."""
    lexical = lexical_topk(brief, entries, len(entries))
    if not os.path.exists(VECTORS):
        return lexical[:k]

    semantic = semantic_topk(brief_id, entries, len(entries))
    if not semantic:
        return lexical[:k]

    scores = {}
    # 60 is the standard RRF constant and keeps rank differences well behaved.
    for ranked in (lexical, semantic):
        for rank, name in enumerate(ranked, start=1):
            scores[name] = scores.get(name, 0.0) + 1 / (rank + RRF_C)
    fused = sorted(((score, name) for name, score in scores.items()), reverse=True)
    return [name for _, name in fused[:k]]


def build_context(condition, brief_id, brief, entries, k):
    """Return a context and the entry names shown in its one catalog slot."""
    if condition == "a":
        shown = []
        catalog = NO_CATALOG
    elif condition == "b":
        shown = list(entries)
        catalog = "Available moves (all of them):\n\n" + _render(entries, shown)
    elif condition == "c":
        shown = lexical_topk(brief, entries, k)
        catalog = "Available moves (the closest matches):\n\n" + _render(entries, shown)
    elif condition == "d":
        shown = semantic_topk(brief_id, entries, k)
        catalog = "Available moves (the closest matches):\n\n" + _render(entries, shown)
    elif condition == "h":
        shown = hybrid_topk(brief_id, brief, entries, k)
        catalog = "Available moves (the closest matches):\n\n" + _render(entries, shown)
    else:
        raise ValueError(f"unknown condition {condition!r}")

    context = f"{FRAMING}\n{catalog}\n\nThe beat:\n\n{brief.strip()}\n"
    return context, shown
