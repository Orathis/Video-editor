#!/usr/bin/env python3
"""Embed the 25 shelf moves and the 5 briefs once, write vectors.json.

Runs where the API key lives, injected from the environment:

    python3 embed.py   # with OPENAI_API_KEY exported by your secret manager

Condition D is a cosine over 25 vectors, so there is no vector database here on
purpose. The vectors are computed once and committed to the eval directory; the
key never leaves that host and no eval run makes a network call.
"""

import json
import os
import urllib.request

import harness

MODEL = "text-embedding-3-small"
OUT = os.path.join(harness.HERE, "vectors.json")


def embed(texts):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise SystemExit("OPENAI_API_KEY not set: export it before running")
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=json.dumps({"model": MODEL, "input": texts}).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        body = json.load(r)
    # The API preserves input order, but index is returned explicitly, so sort
    # by it rather than trusting position.
    return [d["embedding"] for d in sorted(body["data"], key=lambda d: d["index"])]


def main():
    entries = harness.load_shelf()
    briefs = harness.load_briefs()

    names = sorted(entries)
    # Embed the same text an agent would read, minus the name itself. Including
    # the name would let a move win on its own label rather than on meaning,
    # which is the thing lexical search already does.
    move_vecs = embed([entries[n] for n in names])

    bids = sorted(briefs)
    brief_vecs = embed([briefs[b] for b in bids])

    # Free-text stand-ins for condition-A answers. The gate's fallback matcher
    # is only trustworthy if these resolve the way a human says they should, so
    # they are embedded here and asserted in test_gate.py.
    samples = json.load(open(os.path.join(harness.HERE, "control_samples.json")))
    skeys = sorted(samples)
    sample_vecs = embed([samples[k] for k in skeys])

    out = {
        "model": MODEL,
        "moves": dict(zip(names, move_vecs)),
        "briefs": dict(zip(bids, brief_vecs)),
        "control_samples": dict(zip(skeys, sample_vecs)),
    }
    with open(OUT, "w") as fh:
        json.dump(out, fh, sort_keys=True)
        fh.write("\n")
    dims = len(move_vecs[0])
    print(f"wrote {OUT}: {len(names)} moves, {len(bids)} briefs, {dims} dims, model {MODEL}")

    for b in bids:
        print(f"  {b}: {harness.semantic_topk(b, entries)}")


if __name__ == "__main__":
    main()
