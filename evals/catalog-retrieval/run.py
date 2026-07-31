#!/usr/bin/env python3
"""Execute the eval: 5 briefs x 4 conditions, one model call each.

Runs where the API key lives, injected from the environment:

    python3 run.py   # with OPENAI_API_KEY exported by your secret manager

Writes runs.json. Nothing is scored here; gate.py does that, so a scoring change
never requires paying for the runs again.
"""

import json
import os
import time
import urllib.error
import urllib.request

import harness

MODEL = os.environ.get("EVAL_MODEL", "gpt-4o-mini")
EMBED_MODEL = "text-embedding-3-small"
CONDITIONS = tuple(os.environ.get("EVAL_CONDITIONS", "abcd"))
OUT = os.path.join(harness.HERE, os.environ.get("EVAL_OUT", "runs.json"))


def _post(url, payload):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise SystemExit("OPENAI_API_KEY not set: export it before running")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def ask(context):
    """-> (parsed dict or None, raw text, usage dict, seconds)."""
    t0 = time.time()
    body = _post(
        "https://api.openai.com/v1/chat/completions",
        {
            "model": MODEL,
            # Temperature 0 so a rerun of the same context is comparable. The
            # experiment is about context, and sampling noise would masquerade
            # as a condition effect.
            "temperature": 0,
            "messages": [{"role": "user", "content": context}],
        },
    )
    elapsed = time.time() - t0
    raw = body["choices"][0]["message"]["content"]
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        text = text[len("json"):] if text.startswith("json") else text
    try:
        parsed = json.loads(text.strip())
    except json.JSONDecodeError:
        parsed = None
    return parsed, raw, body.get("usage", {}), elapsed


def embed(texts):
    body = _post("https://api.openai.com/v1/embeddings", {"model": EMBED_MODEL, "input": texts})
    return [d["embedding"] for d in sorted(body["data"], key=lambda d: d["index"])]


def main():
    entries, briefs = harness.load_shelf(), harness.load_briefs()
    runs = []

    for bid in sorted(briefs):
        for cond in CONDITIONS:
            context, shown = harness.build_context(cond, bid, briefs[bid], entries)
            attempts = []
            parsed = None
            # One retry on malformed output, recorded rather than hidden, so a
            # condition that provokes bad formatting pays for it on the cost axis.
            for _ in range(2):
                parsed, raw, usage, elapsed = ask(context)
                attempts.append({"usage": usage, "seconds": round(elapsed, 2), "ok": parsed is not None})
                if parsed is not None:
                    break

            picks = (parsed or {}).get("picks", []) if isinstance(parsed, dict) else []
            picks = [p for p in picks if isinstance(p, dict) and p.get("move")]

            run = {
                "brief": bid,
                "condition": cond,
                "shown": shown,
                "context_chars": len(context),
                "picks": picks,
                "confidence": (parsed or {}).get("confidence") if isinstance(parsed, dict) else None,
                "attempts": attempts,
                "raw": raw,
            }

            # Condition A never saw the shelf, so its picks are descriptions.
            # The gate needs their vectors to judge A on fit at all; without
            # this the control is unscorable and the benchmark is rigged.
            if cond == "a" and picks:
                run["pick_vectors"] = embed([f"{p['move']}. {p.get('why', '')}" for p in picks])

            runs.append(run)
            names = [p["move"] for p in picks]
            print(f"{bid} {cond}: {len(attempts)} attempt(s), {len(context)} chars -> {names}")

    with open(OUT, "w") as fh:
        json.dump(runs, fh, indent=1, sort_keys=True)
        fh.write("\n")
    calls = sum(len(r["attempts"]) for r in runs)
    toks = sum(a["usage"].get("total_tokens", 0) for r in runs for a in r["attempts"])
    secs = sum(a["seconds"] for r in runs for a in r["attempts"])
    print(f"\nwrote {OUT}: {len(runs)} runs, {calls} calls, {toks} tokens, {secs:.1f}s, model {MODEL}")


if __name__ == "__main__":
    main()
