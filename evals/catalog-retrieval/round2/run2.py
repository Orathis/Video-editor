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
    # Batch halves both directions, but nothing here submits batch work: every
    # caller goes through provider.chat, which posts to the synchronous endpoint.
    # This row is a note on what the tier would cost, not a price anything can
    # pay, so no projection may quote it. Quoting it once already understated a
    # gate by half. Add the submission path first, in the same change that starts
    # pricing it.
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
    # Second model family, read from anthropic.com/pricing on 2026-08-01.
    # "cached" is the cache READ rate, 0.1x input; nothing here writes a cache.
    # These rows exist because the round 4 rule makes the model a cell variable:
    # pricing a model B cell off the Gemini row would understate or overstate
    # every projection the spend gate reads, and the gate is the only thing
    # standing between a runaway loop and an unbounded bill.
    "claude-haiku-4-5": {
        "input": 1.00,
        "cached": 0.10,
        "output": 5.00,
    },
    # List price, not the introductory rate that runs through 2026-08-31. A
    # projection that quotes the promotion under-reads the gate the day it ends.
    "claude-sonnet-5": {
        "input": 3.00,
        "cached": 0.30,
        "output": 15.00,
    },
    # The family that actually runs as model B, read from the model's own page,
    # developers.openai.com/api/docs/models/gpt-5.6-luna, on 2026-08-01. The
    # page presents these as standard list prices and marks none of them
    # promotional or introductory, so this is the list price the gate should
    # read. Two published surcharges are deliberately not modelled here, and
    # both err in the safe direction for this grid: a prompt over 272K tokens
    # is billed at 2x input and 1.5x output for the whole request, which the
    # 424-entry shelf does not approach, and a cache WRITE is billed at 1.25x
    # the uncached input rate, which nothing here asks for. If either ever
    # becomes reachable, price it before running, not after.
    "gpt-5.6-luna": {
        "input": 0.20,
        "cached": 0.02,
        "output": 1.20,
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
# Under the corpus root, not next to the code, for the reason the committee
# checkpoint already moved: a checkpoint records what a model said about
# particular briefs, so it belongs to the corpus those briefs came from. Shared
# at HERE, a later round appended its runs into the previous round's file. Two
# things then went wrong at once. Resume reads by brief id, condition and k, so
# a later corpus numbering from 001 again inherits verdicts for runs that never
# happened on its briefs. And the ceiling sums every record in the file, so a
# new round started its budget already spent by the round before it and stopped
# partway through a prefix of the corpus rather than covering it.
DEFAULT_CHECKPOINT = os.path.join(harness2.CORPUS_ROOT, "checkpoints", "results.jsonl")
DEFAULT_KILL_FILE = os.path.join(harness2.CORPUS_ROOT, "checkpoints", "STOP")


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
    """Identify the cell a checkpoint row belongs to, model included.

    The model is part of the key because round 4 runs the same grid twice. Keyed
    on brief, condition and k alone, resume would read model A's run as model B
    already done and the second model would produce nothing, while every report
    that groups by this key would merge two models' answers into one cell and
    call the average a reproduction.
    """
    if (
        isinstance(record.get("brief"), str)
        and isinstance(record.get("condition"), str)
        and isinstance(record.get("model"), str)
        and "k" in record
    ):
        return (
            record["brief"],
            record["condition"],
            record["k"],
            provider.model_id(record["model"]),
        )
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


# Wide enough for the longest arm label followed by the longest model id in the
# price table. The label carries the model, so the column has to hold it.
CELL_WIDTH = 28


def _cell_name(condition, k, model=None):
    arm = condition.upper() if k is None else f"{condition.upper()}@{k}"
    return arm if model is None else f"{arm}/{provider.model_id(model)}"


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
            key = brief_id, condition, k, provider.model_id(model)
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
                f"{brief_id} {_cell_name(condition, k, model)}: "
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


# Why the output figure measured on CHAT_MODEL is or is not conservative when
# it is carried over to another family. Said out loud rather than left to the
# reader, and said per family rather than once, because the reasons are
# opposite: one of these families is not asked to think and the other one
# thinks whether or not it is asked. A single sentence covering both would be
# false for one of them, which in a spend banner is worse than saying nothing.
CARRIED_OUTPUT_NOTE = {
    "anthropic": (
        "This model is not asked to think, so the same figure is carried over "
        "as an over-estimate, not as a measurement of it."
    ),
    "openai": (
        "This model reports reasoning tokens of its own and bills them as "
        "output, so the same figure is carried over as an estimate and NOT as "
        "an upper bound on what this model will spend on thinking. Replace it "
        "with a measured number once the first cell has landed."
    ),
}


def _totals(rows):
    """Sum a set of projected rows. One adder, whether it is one model or two."""
    return {
        field: sum(row[field] for row in rows)
        for field in (
            "runs",
            "chars",
            "estimated_input_tokens",
            "cached_tokens",
            "assumed_output_tokens",
            "input_usd",
            "cached_usd",
            "output_usd",
            "projected_usd",
        )
    }


def _emit_total(label, total, rows, emit):
    emit(
        f"{label:<{CELL_WIDTH}} {total['runs']:>4} {total['chars']:>9} "
        f"{total['estimated_input_tokens']:>12.2f} "
        f"{total['cached_tokens']:>8} {total['assumed_output_tokens']:>11} "
        f"${total['input_usd']:>9.6f} ${total['cached_usd']:>10.6f} "
        f"${total['output_usd']:>10.6f} "
        f"${total['projected_usd']:>9.6f}  "
        f"{sum(row['status'].startswith('SKIPPED') for row in rows)} cell(s) skipped"
    )


def _dry_run_model(entries, briefs, cells, model, emit):
    _prices(model)
    family = provider.model_family(model)
    rows = []
    emit("DRY RUN: zero network calls and no key required.")
    # Named because the same grid is projected once per model and the
    # projections are not interchangeable: the families are priced differently
    # and the reader is approving one of them, not an average.
    emit(f"Model: {model} ({family} rates).")
    emit(
        "Estimated input tokens use characters divided by 4.0; "
        "this heuristic is NOT a real tokenizer count."
    )
    # Interpolated, never restated. The banner said 50 while the constant said
    # 800, so the one line a reader checks before approving spend disagreed
    # with the arithmetic under it by a factor of sixteen.
    emit(
        f"Assumed output tokens are {ASSUMED_OUTPUT_TOKENS} per built run, not "
        "measured; thinking is billed as output and ran 489 to 1104 tokens per "
        "run across the nine cells while the visible answer was 47 to 84."
    )
    if family != "vertex":
        # A projection that quietly reused another model's observation as its
        # own would not be honest about where its number came from, so it says.
        emit(
            f"That output measurement was taken on {provider.CHAT_MODEL}. "
            + CARRIED_OUTPUT_NOTE[family]
        )
    if family == "openai":
        # Printed as a named confound rather than buried in the provider, since
        # this banner is where a reader approves what the round is about to buy,
        # and what they are approving here is a cell that is not a clean twin of
        # its model A counterpart.
        emit(
            "CONFOUND, read before approving: this family rejects temperature 0 "
            "with HTTP 400 and samples only at its default of 1, while rounds 2 "
            "and 3 ran every paid cell at temperature 0. A cell run on this "
            "model therefore differs from its model A twin in TWO variables, "
            "the model and the sampling temperature, so the round 4 rule's "
            "one-variable property does not hold across the two families and "
            "the verdict must say so rather than reporting a clean "
            "reproduction."
        )
    emit("Cached tokens are projected as 0 because no requests are made.")
    emit("")
    emit(
        f"{'Cell':<{CELL_WIDTH}} {'Runs':>4} {'Chars':>9} {'Est uncached':>12} "
        f"{'Cached':>8} {'Assumed out':>11} {'Input USD':>10} "
        f"{'Cached USD':>11} {'Output USD':>11} {'Total USD':>10}  Status"
    )

    for condition, k in cells:
        label = _cell_name(condition, k, model)
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
            f"{row['cell']:<{CELL_WIDTH}} {row['runs']:>4} {row['chars']:>9} "
            f"{row['estimated_input_tokens']:>12.2f} "
            f"{row['cached_tokens']:>8} {row['assumed_output_tokens']:>11} "
            f"${row['input_usd']:>9.6f} ${row['cached_usd']:>10.6f} "
            f"${row['output_usd']:>10.6f} "
            f"${row['projected_usd']:>9.6f}  {row['status']}"
        )

    total = _totals(rows)
    _emit_total("TOTAL", total, rows, emit)
    return rows, total


def parse_models(spec):
    """Read a model selection like "gemini-3.6-flash,gpt-5.6-luna".

    Empty spec means the single model EVAL_MODEL names. Each id is resolved to a
    family here rather than at the first call, so a typo stops the projection
    instead of being priced against whichever backend the prefix happened to
    match. Duplicates are refused rather than deduplicated: a grid that names the
    same model twice was meant to name two, and quietly halving it would price
    half of what the reader is approving.
    """
    if not spec:
        return (MODEL,)
    chosen = []
    for token in spec.split(","):
        token = token.strip()
        if not token:
            continue
        provider.model_family(token)
        if token in chosen:
            raise SystemExit(f"EVAL_MODELS names {token!r} more than once")
        chosen.append(token)
    if not chosen:
        raise SystemExit(f"EVAL_MODELS={spec!r} selected no models")
    return tuple(chosen)


def dry_run(entries, briefs, cells=CELLS, models=(MODEL,), emit=print):
    """Price the whole grid, which from round 4 on is cells times models.

    Each model gets its own complete block, banner included, rather than a
    shared header and a merged table. The families are priced differently and
    carry different caveats, and the reader is approving each of them rather
    than an average of the two: an openai block carries the temperature confound
    and a vertex block must not appear to.

    The grand total is only printed when there is more than one model, so a
    single model projection reads exactly as it did before the grid existed.
    """
    rows = []
    for model in models:
        model_rows, _ = _dry_run_model(entries, briefs, cells, model, emit)
        rows.extend(model_rows)
    total = _totals(rows)
    if len(models) > 1:
        emit("")
        emit(
            "The whole grid, over {0} models. The per model blocks above are "
            "what each family costs on its own row; this line is what the round "
            "is about to buy in total, and it is a sum and not an "
            "average.".format(len(models))
        )
        _emit_total("GRAND TOTAL", total, rows, emit)
    return rows, total


def parse_cells(spec):
    """Read a cell selection like "h@10,d@20" or "b". Empty spec means every cell.

    Step 4 of the pre-registered rule runs the paid confirmation on the top two
    arms only. run_grid has always taken a cells argument, but nothing exposed it,
    so the only reachable run was all nine cells. That is not a confirmation, it
    is a second full grid, and at wave 1 size it costs about five times what the
    rule asks for.

    k is validated for arity, not against the three values CELLS happens to list.
    Choosing k is stage 1's entire job, and the round was designed to look past
    the k = 5, 10, 20 that round 2 sampled, so a whitelist of those three would
    let the sweep name a list length the confirmation could never be asked for.
    The condition letter is still checked, because that is a typo, and so is the
    arity, because a and b build no short list and have no k to take.
    """
    if not spec:
        return CELLS
    conditions = {condition for condition, _ in CELLS}
    takes_k = {condition for condition, k in CELLS if k is not None}
    chosen = []
    for token in spec.split(","):
        token = token.strip()
        if not token:
            continue
        condition, _, k = token.partition("@")
        if condition not in conditions:
            raise SystemExit(
                f"cell {token!r}: unknown condition {condition!r}, "
                f"pick from {sorted(conditions)}"
            )
        if not k:
            if condition in takes_k:
                raise SystemExit(f"cell {token!r}: condition {condition!r} needs a k")
            chosen.append((condition, None))
            continue
        if condition not in takes_k:
            raise SystemExit(f"cell {token!r}: condition {condition!r} takes no k")
        if not k.isdigit() or int(k) < 1:
            raise SystemExit(f"cell {token!r}: k must be a positive integer")
        chosen.append((condition, int(k)))
    if not chosen:
        raise SystemExit(f"EVAL_CELLS={spec!r} selected no cells")
    return tuple(chosen)


def main():
    entries = harness2.load_shelf()
    briefs = harness2.load_briefs()
    cells = parse_cells(os.environ.get("EVAL_CELLS", ""))
    models = parse_models(os.environ.get("EVAL_MODELS", ""))
    if os.environ.get("EVAL_DRY_RUN") == "1":
        dry_run(entries, briefs, cells=cells, models=models)
        return 0

    if len(models) > 1:
        # The projection covers the grid; the run covers one model. Left to
        # fall through, this would spend on EVAL_MODEL alone and report the
        # grid as done, and the missing half would only surface as a model B
        # column that never appeared. The checkpoint key carries the model, so
        # the two passes fill one file without colliding.
        raise SystemExit(
            "EVAL_MODELS names {0} models and the paid run executes one. Price "
            "the grid with EVAL_DRY_RUN=1 and EVAL_MODELS, then run once per "
            "model with EVAL_MODEL: {1}".format(
                len(models), ", ".join(models)
            )
        )

    _prices(MODEL)
    provider.validate_model(MODEL)
    try:
        max_usd = float(os.environ.get("EVAL_MAX_USD", DEFAULT_MAX_USD))
    except ValueError:
        raise SystemExit("EVAL_MAX_USD must be a number") from None
    result = run_grid(entries, briefs, cells=cells, model=MODEL, max_usd=max_usd)
    reason = result["stop_reason"] or "complete"
    print(
        f"{reason}: {result['completed']} completed, "
        f"{result['new_runs']} new, ${result['total_usd']:.6f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
