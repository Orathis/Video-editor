#!/usr/bin/env python3
"""Context builders for the nine round-two catalog cells."""

import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SHELF = os.path.join(HERE, "shelf.md")

# Where the corpus under test lives. Round 2's briefs and gold stay here as
# fixtures, because round3/test_stats.py and round3/test_recall.py reproduce
# round 2's published numbers from them, so a later round cannot generate over
# the top of them. It gets its own root instead.
#
# One definition, because four modules used to carry their own copy of this
# path and a corpus is only coherent if the generator, the committee, the
# embedder and the harness all mean the same directory by it. The shelf is not
# in here: every round retrieves from the same 424 entries, and that is the
# comparison.
CORPUS_ROOT = os.environ.get("EVAL_CORPUS_ROOT") or HERE
BRIEFS = os.path.join(CORPUS_ROOT, "briefs")
GOLD = os.path.join(CORPUS_ROOT, "gold")
VECTORS = os.path.join(CORPUS_ROOT, "vectors.json")
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


# vectors.json is tens of megabytes and the grid asks for a semantic ranking
# 227 briefs x 4 cells, so both the parse and the ranking are memoized. Without
# this the dry run alone re-reads and re-scores the same file 900 times.
_VECTOR_CACHE = {}
_RANK_CACHE = {}


def _load_vectors():
    # Keyed by path, not a bare flag: the tests point VECTORS at round one's
    # file and at fixtures, and a path-blind cache would answer from the wrong
    # one.
    if VECTORS not in _VECTOR_CACHE:
        if not os.path.exists(VECTORS):
            raise SystemExit(f"missing {VECTORS}: run embed2.py first")
        with open(VECTORS, encoding="utf-8") as fh:
            vectors = json.load(fh)
        # Norms fold into the vectors once, so cosine is a bare dot product.
        moves = {}
        for name, vector in vectors["moves"].items():
            norm = sum(x * x for x in vector) ** 0.5 or 1.0
            moves[name] = [x / norm for x in vector]
        _VECTOR_CACHE[VECTORS] = {"moves": moves, "briefs": vectors["briefs"]}
    return _VECTOR_CACHE[VECTORS]


def semantic_ranking(brief_id):
    """Return every move name, best cosine first."""
    key = (VECTORS, brief_id)
    if key not in _RANK_CACHE:
        vectors = _load_vectors()
        query = vectors["briefs"][brief_id]
        norm = sum(x * x for x in query) ** 0.5 or 1.0
        query = [x / norm for x in query]
        ranked = sorted(
            (
                (sum(x * y for x, y in zip(query, vector)), name)
                for name, vector in vectors["moves"].items()
            ),
            reverse=True,
        )
        _RANK_CACHE[key] = [name for _, name in ranked]
    return _RANK_CACHE[key]


def semantic_topk(brief_id, entries, k):
    """Return cosine-ranked names from the precomputed vectors."""
    return semantic_ranking(brief_id)[:k]


def hybrid_topk(brief_id, brief, entries, k):
    """Fuse full lexical and semantic rankings with reciprocal rank fusion."""
    lexical = lexical_topk(brief, entries, len(entries))
    # Falling back to the lexical list when the vectors are missing would make
    # the hybrid arm silently report lexical's numbers under its own name, and
    # an arm comparison built on that reads as a tie rather than as a broken
    # input. Semantic already exits loudly here, so hybrid does too.
    semantic = semantic_topk(brief_id, entries, len(entries))
    if not semantic:
        raise SystemExit(
            f"empty semantic ranking for {brief_id} from {VECTORS}: hybrid cannot fuse"
        )

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
