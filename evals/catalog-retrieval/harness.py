#!/usr/bin/env python3
"""Catalog-browsing eval: context builders for conditions A, B, C, D.

The whole experiment is one variable: how much of the shelf the agent gets to
see before it picks moves for a brief. Everything else (framing, output
contract, model, temperature) is identical across conditions, so any difference
in selection quality is attributable to the browsing layer and nothing else.

    A  brief alone, no catalog          (control)
    B  brief plus all 25 shelf entries  (full read)
    C  brief plus lexical top-k         (grep)
    D  brief plus semantic top-k        (embeddings)

C and D always receive the same k, so they differ only in how the k is chosen.
"""

import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
# The round-one shelf lives inside the eval rather than being read out of a
# sibling working directory, so the eval stays reproducible from a clean
# checkout instead of depending on whatever that directory happens to hold.
SHELF = os.path.join(HERE, "sources", "SHELF.md")
VECTORS = os.path.join(HERE, "vectors.json")
TOP_K = int(os.environ.get("EVAL_TOP_K", "5"))

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


def tokens(text):
    return [w for w in re.findall(r"[a-z]+", text.lower()) if w not in STOP and len(w) > 2]


def load_shelf():
    """-> {name: block text} for the fields an agent browses."""
    entries = {}
    for block in re.split(r"^### ", open(SHELF).read(), flags=re.M)[1:]:
        lines = block.splitlines()
        body = [l for l in lines[1:] if l.split(":")[0] in ("group", "what", "use_when", "avoid_when")]
        entries[lines[0].strip()] = "\n".join(body)
    return entries


def load_briefs():
    briefs = {}
    for path in sorted(glob.glob(os.path.join(HERE, "briefs", "*.md"))):
        text = open(path).read()
        briefs[os.path.basename(path)[: -len(".md")]] = text
    return briefs


def _render(entries, names):
    return "\n\n".join(f"### {n}\n{entries[n]}" for n in names)


def lexical_topk(brief, entries, k=TOP_K):
    """Rank by shared vocabulary, length-normalized so long entries do not win by size."""
    want = set(tokens(brief))
    scored = []
    for name, body in entries.items():
        have = set(tokens(body))
        # sqrt normalization: a longer entry has more chances to overlap, and
        # without this the wordiest blurb ranks first for every brief.
        scored.append((len(want & have) / (len(have) ** 0.5 or 1), name))
    scored.sort(reverse=True)
    return [n for _, n in scored[:k]]


def semantic_topk(brief_id, entries, k=TOP_K):
    """Cosine top-k over vectors precomputed by embed.py. 25 vectors is a dot product."""
    if not os.path.exists(VECTORS):
        raise SystemExit(f"missing {VECTORS}: run embed.py first")
    v = json.load(open(VECTORS))
    q = v["briefs"][brief_id]
    moves = v["moves"]

    def cos(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(x * x for x in b) ** 0.5
        return dot / (na * nb)

    ranked = sorted(((cos(q, vec), name) for name, vec in moves.items()), reverse=True)
    return [n for _, n in ranked[:k]]


def build_context(condition, brief_id, brief, entries):
    """-> (context string, list of move names shown). Identical except the shelf part."""
    if condition == "a":
        shown = []
        catalog = "You have no catalog of existing moves. Name the moves you would use."
    elif condition == "b":
        shown = list(entries)
        catalog = "Available moves (all of them):\n\n" + _render(entries, shown)
    elif condition == "c":
        shown = lexical_topk(brief, entries)
        catalog = "Available moves (the closest matches):\n\n" + _render(entries, shown)
    elif condition == "d":
        shown = semantic_topk(brief_id, entries)
        catalog = "Available moves (the closest matches):\n\n" + _render(entries, shown)
    else:
        raise ValueError(f"unknown condition {condition!r}")
    return f"{FRAMING}\nThe beat:\n\n{brief.strip()}\n\n{catalog}\n", shown


if __name__ == "__main__":
    entries, briefs = load_shelf(), load_briefs()
    print(f"{len(entries)} moves, {len(briefs)} briefs, k={TOP_K}")
    for bid, brief in briefs.items():
        row = {c: build_context(c, bid, brief, entries)[1] for c in ("a", "b", "c")}
        print(f"  {bid}: A={len(row['a'])} B={len(row['b'])} C={row['c']}")
