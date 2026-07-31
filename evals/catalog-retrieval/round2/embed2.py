#!/usr/bin/env python3
"""Embed the round-two shelf and briefs in resumable batches."""

import hashlib
import json
import os
import urllib.request

import harness2

MODEL = "text-embedding-3-small"
BATCH_SIZE = 96
OUT = os.path.join(harness2.HERE, "vectors.json")


def _api_key():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise SystemExit("Embedding API key is not set in the environment.")
    return key


def embed(texts):
    request = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=json.dumps({"model": MODEL, "input": texts}).encode(),
        headers={
            "Authorization": f"Bearer {_api_key()}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        body = json.load(response)
    return [item["embedding"] for item in sorted(body["data"], key=lambda item: item["index"])]


def _load_progress():
    if not os.path.exists(OUT):
        return {"model": MODEL, "moves": {}, "briefs": {}}
    with open(OUT, encoding="utf-8") as fh:
        progress = json.load(fh)
    if progress.get("model") != MODEL:
        raise SystemExit("Existing vectors use a different model.")
    if not isinstance(progress.get("moves"), dict) or not isinstance(progress.get("briefs"), dict):
        raise SystemExit("Existing vectors file has an invalid shape.")
    return progress


def _write_progress(progress):
    temporary = OUT + ".tmp"
    with open(temporary, "w", encoding="utf-8") as fh:
        json.dump(progress, fh, sort_keys=True)
        fh.write("\n")
    os.replace(temporary, OUT)


def _digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _fill_missing(progress, field, sources):
    """Embed everything whose text is not already vectored under its own name.

    Resuming on the name alone is only safe while a name always means the same
    text. Brief ids are positions in a corpus, not identities: a regenerated
    corpus numbers from 001 again, so every id collides with an older brief that
    says something else. Skipping those would hand round 3's briefs round 2's
    vectors, quietly, with the semantic and hybrid arms reading the wrong query
    and no error anywhere. Digesting the source text is what makes the resume
    mean "already embedded" rather than "name seen before".
    """
    target = progress[field]
    digests = progress.setdefault("digests", {}).setdefault(field, {})
    pending = [
        name
        for name in sorted(sources)
        if name not in target or digests.get(name) != _digest(sources[name])
    ]
    for offset in range(0, len(pending), BATCH_SIZE):
        names = pending[offset : offset + BATCH_SIZE]
        vectors = embed([sources[name] for name in names])
        if len(vectors) != len(names):
            raise RuntimeError("Embedding response count does not match request count.")
        target.update(zip(names, vectors))
        digests.update((name, _digest(sources[name])) for name in names)
        _write_progress(progress)


def main():
    _api_key()
    progress = _load_progress()
    _fill_missing(progress, "moves", harness2.load_shelf())
    _fill_missing(progress, "briefs", harness2.load_briefs())
    print(
        f"wrote vectors.json: {len(progress['moves'])} moves, "
        f"{len(progress['briefs'])} briefs, model {MODEL}"
    )


if __name__ == "__main__":
    main()
