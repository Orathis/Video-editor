#!/usr/bin/env python3
"""Run and resume the round-two catalog grid."""

import json
import os

import harness2
import provider

MODEL = os.environ.get("EVAL_MODEL", provider.CHAT_MODEL)
CELLS = (
    ("a", None),
    ("b", None),
    ("c", 5),
    ("c", 10),
    ("c", 20),
    ("d", 5),
    ("d", 10),
    ("d", 20),
    ("h", 10),
)

# USD rates per 1,000,000 tokens, read from ai.google.dev/gemini-api/docs/pricing
# on 2026-07-31. "cached" is the cache READ rate; cache storage is billed
# separately at $1.00 per million tokens per hour and is added by storage_cost().
PRICE_TABLE = {
    "gemini-3.6-flash": {
        "input": 1.50,
        "cached": 0.15,
        "output": 7.50,
    },
    # Batch halves both directions. The grid has no latency requirement, so this
    # is the tier the real run should use.
    "gemini-3.6-flash:batch": {
        "input": 0.75,
        "cached": 0.075,
        "output": 3.75,
    },
    "gemini-2.5-flash": {
        "input": 1.00,
        "cached": 0.25,
        "output": 2.00,
    },
}

CACHE_STORAGE_USD_PER_MTOK_HOUR = 1.00

CHARS_PER_TOKEN = 4.0
# Measured live on 2026-07-31, one call per cell against the 424-entry shelf:
# billed output ran 489 to 1104 tokens, mean about 760. Almost all of it is
# thinking, not the visible answer, which was 47 to 84 tokens. Round 1's model
# did not think, so its 36-65 token observation does not transfer.
ASSUMED_OUTPUT_TOKENS = 800
# The measured grid is $28.68 across 2700 runs. This leaves headroom for a
# heavier-thinking brief without letting a runaway loop spend unbounded.
DEFAULT_MAX_USD = 60.00
DEFAULT_CHECKPOINT = os.path.join(harness2.HERE, "checkpoints", "results.jsonl")
DEFAULT_KILL_FILE = os.path.join(harness2.HERE, "checkpoints", "STOP")


def _prices(model):
    try:
        return PRICE_TABLE[provider.model_id(model)]
    except KeyError:
        raise SystemExit(f"no price table entry for model {model!r}") from None


def usage_cost_breakdown(usage, model):
    prices = _prices(model)
    prompt = usage.get("prompt_tokens", 0)
    cached = usage.get("cached_tokens", 0)
    completion = usage.get("completion_tokens", 0)
    uncached = max(prompt - cached, 0)
    return {
        "uncached": uncached * prices["input"] / 1_000_000,
        "cached": cached * prices["cached"] / 1_000_000,
        "output": completion * prices["output"] / 1_000_000,
    }


def usage_cost(usage, model):
    return sum(usage_cost_breakdown(usage, model).values())


def _record_key(record):
    if (
        isinstance(record.get("brief"), str)
        and isinstance(record.get("condition"), str)
        and "k" in record
    ):
        return record["brief"], record["condition"], record["k"]
    return None


def load_checkpoint(path):
    records = []
    corrupt_final_offset = None
    if not os.path.exists(path):
        return records

    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        while True:
            offset = fh.tell()
            line = fh.readline()
            if not line:
                break
            if not line.strip():
                continue
            try:
                record = json.loads(line.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                if fh.tell() == size:
                    corrupt_final_offset = offset
                continue
            if isinstance(record, dict):
                records.append(record)

    if corrupt_final_offset is not None:
        with open(path, "r+b") as fh:
            fh.truncate(corrupt_final_offset)
    return records


def _append_checkpoint(path, record):
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, sort_keys=True) + "\n")
        fh.flush()
        os.fsync(fh.fileno())


def _cell_name(condition, k):
    return condition.upper() if k is None else f"{condition.upper()}@{k}"


def _record_cost(record, fallback_model):
    model = record.get("model", fallback_model)
    return sum(
        usage_cost(attempt.get("usage", {}), model)
        for attempt in record.get("attempts", [])
        if isinstance(attempt, dict)
    )


def run_grid(
    entries,
    briefs,
    cells=CELLS,
    checkpoint_path=None,
    kill_path=None,
    model=MODEL,
    max_usd=DEFAULT_MAX_USD,
    emit=print,
):
    checkpoint_path = checkpoint_path or os.environ.get(
        "EVAL_CHECKPOINT", DEFAULT_CHECKPOINT
    )
    kill_path = kill_path or os.environ.get("EVAL_KILL_FILE", DEFAULT_KILL_FILE)
    records = load_checkpoint(checkpoint_path)
    completed = {
        key for record in records if (key := _record_key(record)) is not None
    }
    total_usd = sum(_record_cost(record, model) for record in records)
    new_runs = 0
    stop_reason = None

    if total_usd > max_usd:
        stop_reason = "ceiling"

    for brief_id in sorted(briefs):
        for condition, k in cells:
            key = brief_id, condition, k
            if key in completed:
                continue
            if stop_reason:
                break
            if os.path.exists(kill_path):
                stop_reason = "kill file"
                break

            context, shown = harness2.build_context(
                condition, brief_id, briefs[brief_id], entries, k
            )
            attempts = []
            parsed = None
            raw = ""
            for _ in range(2):
                parsed, raw, usage, seconds = provider.chat(context, model)
                attempts.append(
                    {
                        "usage": usage,
                        "seconds": round(seconds, 2),
                        "ok": parsed is not None,
                    }
                )
                if parsed is not None:
                    break

            picks = (parsed or {}).get("picks", []) if isinstance(parsed, dict) else []
            picks = [
                pick
                for pick in picks
                if isinstance(pick, dict) and pick.get("move")
            ]
            record = {
                "brief": brief_id,
                "condition": condition,
                "k": k,
                "model": model,
                "shown": shown,
                "context_chars": len(context),
                "picks": picks,
                "confidence": (
                    (parsed or {}).get("confidence")
                    if isinstance(parsed, dict)
                    else None
                ),
                "attempts": attempts,
                "raw": raw,
            }
            if condition == "a" and picks:
                record["pick_vectors"] = provider.embed(
                    [
                        f"{pick['move']}. {pick.get('why', '')}"
                        for pick in picks
                    ]
                )

            _append_checkpoint(checkpoint_path, record)
            completed.add(key)
            records.append(record)
            new_runs += 1
            total_usd += _record_cost(record, model)
            emit(
                f"{brief_id} {_cell_name(condition, k)}: "
                f"{len(attempts)} attempt(s), total ${total_usd:.6f}"
            )
            if total_usd > max_usd:
                stop_reason = "ceiling"
                break
        if stop_reason:
            break

    return {
        "records": records,
        "new_runs": new_runs,
        "completed": len(completed),
        "total_usd": total_usd,
        "stop_reason": stop_reason,
    }


def dry_run(entries, briefs, cells=CELLS, model=MODEL, emit=print):
    _prices(model)
    rows = []
    emit("DRY RUN: zero network calls and no key required.")
    emit(
        "Estimated input tokens use characters divided by 4.0; "
        "this heuristic is NOT a real tokenizer count."
    )
    emit(
        "Assumed output tokens are 50 per built run, not measured; "
        "the assumption uses the round-one observed range of roughly 36-65."
    )
    emit("Cached tokens are projected as 0 because no requests are made.")
    emit("")
    emit(
        f"{'Cell':<6} {'Runs':>4} {'Chars':>9} {'Est uncached':>12} "
        f"{'Cached':>8} {'Assumed out':>11} {'Input USD':>10} "
        f"{'Cached USD':>11} {'Output USD':>11} {'Total USD':>10}  Status"
    )

    for condition, k in cells:
        label = _cell_name(condition, k)
        if condition == "d" and not os.path.exists(harness2.VECTORS):
            row = {
                "cell": label,
                "runs": 0,
                "chars": 0,
                "estimated_input_tokens": 0.0,
                "cached_tokens": 0,
                "assumed_output_tokens": 0,
                "input_usd": 0.0,
                "cached_usd": 0.0,
                "output_usd": 0.0,
                "projected_usd": 0.0,
                "status": "SKIPPED: missing vectors.json",
            }
        else:
            chars = 0
            built = 0
            skipped = None
            for brief_id in sorted(briefs):
                try:
                    context, _ = harness2.build_context(
                        condition, brief_id, briefs[brief_id], entries, k
                    )
                except SystemExit as error:
                    skipped = f"SKIPPED: {error}"
                    break
                chars += len(context)
                built += 1
            estimated_input = chars / CHARS_PER_TOKEN
            assumed_output = built * ASSUMED_OUTPUT_TOKENS
            costs = usage_cost_breakdown(
                {
                    "prompt_tokens": estimated_input,
                    "cached_tokens": 0,
                    "completion_tokens": assumed_output,
                },
                model,
            )
            row = {
                "cell": label,
                "runs": built,
                "chars": chars,
                "estimated_input_tokens": estimated_input,
                "cached_tokens": 0,
                "assumed_output_tokens": assumed_output,
                "input_usd": costs["uncached"],
                "cached_usd": costs["cached"],
                "output_usd": costs["output"],
                "projected_usd": sum(costs.values()),
                "status": skipped or "ready",
            }
        rows.append(row)
        emit(
            f"{row['cell']:<6} {row['runs']:>4} {row['chars']:>9} "
            f"{row['estimated_input_tokens']:>12.2f} "
            f"{row['cached_tokens']:>8} {row['assumed_output_tokens']:>11} "
            f"${row['input_usd']:>9.6f} ${row['cached_usd']:>10.6f} "
            f"${row['output_usd']:>10.6f} "
            f"${row['projected_usd']:>9.6f}  {row['status']}"
        )

    total = {
        "runs": sum(row["runs"] for row in rows),
        "chars": sum(row["chars"] for row in rows),
        "estimated_input_tokens": sum(
            row["estimated_input_tokens"] for row in rows
        ),
        "cached_tokens": sum(row["cached_tokens"] for row in rows),
        "assumed_output_tokens": sum(
            row["assumed_output_tokens"] for row in rows
        ),
        "input_usd": sum(row["input_usd"] for row in rows),
        "cached_usd": sum(row["cached_usd"] for row in rows),
        "output_usd": sum(row["output_usd"] for row in rows),
        "projected_usd": sum(row["projected_usd"] for row in rows),
    }
    emit(
        f"TOTAL  {total['runs']:>4} {total['chars']:>9} "
        f"{total['estimated_input_tokens']:>12.2f} "
        f"{total['cached_tokens']:>8} {total['assumed_output_tokens']:>11} "
        f"${total['input_usd']:>9.6f} ${total['cached_usd']:>10.6f} "
        f"${total['output_usd']:>10.6f} "
        f"${total['projected_usd']:>9.6f}  "
        f"{sum(row['status'].startswith('SKIPPED') for row in rows)} cell(s) skipped"
    )
    return rows, total


def main():
    entries = harness2.load_shelf()
    briefs = harness2.load_briefs()
    if os.environ.get("EVAL_DRY_RUN") == "1":
        dry_run(entries, briefs, model=MODEL)
        return 0

    _prices(MODEL)
    provider.validate_model(MODEL)
    try:
        max_usd = float(os.environ.get("EVAL_MAX_USD", DEFAULT_MAX_USD))
    except ValueError:
        raise SystemExit("EVAL_MAX_USD must be a number") from None
    result = run_grid(entries, briefs, model=MODEL, max_usd=max_usd)
    reason = result["stop_reason"] or "complete"
    print(
        f"{reason}: {result['completed']} completed, "
        f"{result['new_runs']} new, ${result['total_usd']:.6f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
