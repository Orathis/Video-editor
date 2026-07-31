#!/usr/bin/env python3
"""Build a stratified round-two brief corpus from local catalog sources."""

import json
import os
import re
import statistics
import subprocess
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

import harness2
import provider
import run2


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
CATALOG = HERE / "catalog-index.json"
# The corpus root, not HERE: a later round writes its briefs somewhere else
# and the attempt ledger has to travel with the corpus it allocated, or a
# resume reads another round's attempts and skips moves it never generated.
CORPUS_ROOT = Path(harness2.CORPUS_ROOT)
BRIEFS_DIR = Path(harness2.BRIEFS)
GOLD_DIR = Path(harness2.GOLD)
ATTEMPTS_LOG = CORPUS_ROOT / "attempts.jsonl"

MODEL = os.environ.get("BRIEF_MODEL", provider.CHAT_MODEL)
BRIEF_TEMPERATURE = 0.7
GEN_MAX_ATTEMPTS = 4  # Regenerate-for-the-same-move cap before dropping it.

# Calibrated against round one's five hand-authored briefs, covering seven
# brief/gold-best pairs, with harness2.tokens against the round-two shelf blurb
# for each move. The observed range was 0.040816 to 0.081633, with a 0.056604
# median. This ceiling is about three times the observed maximum, leaving room
# for ordinary shared vocabulary while rejecting copied or heavily reused text.
VOCAB_MAX_OVERLAP = 0.25

NEIGHBOR_MIN_COUNT = 2
NEIGHBOR_SCORE_RATIO = 0.5
# Calibrated against the same seven known-good pairs over all 424 shelf entries.
# Competitor counts at 0.5 times the target score ranged from 17 to 306, with a
# median of 73. As a separation check, self-querying caliper-caption-rail and
# chevron-pill-card-morph produced zero competitors, at target scores 6.324555
# and 6.000000. The minimum of two catches isolation without narrowing the
# broad known-good band.
#
# This lexical band is a deliberate offline substitute for the plan's cosine
# band. Cosine neighbor retrieval becomes available through
# harness2.semantic_topk after the separately gated embed2.py vector build. The
# corpus record and reporting contract stay unchanged when those vectors exist.

STRATIFICATION_TOLERANCE = 10
# This is the allowed number of moves left behind by the gates before the run
# warns. It is not a backfill budget: replacing a dropped target would bias the
# corpus toward moves that happen to be easier to describe. Under per-move
# allocation the same refusal is expressed as an attempt that is spent whether
# or not it produced a brief, so a rejected move simply stays one brief behind
# and is reported as such.

FORCED_PORTRAIT = {"caliper-caption-rail", "chevron-pill-card-morph"}
ASPECT_ROTATION = ("16:9", "16:9", "16:9", "9:16", "1:1")
DURATION_ROTATION = (3.0, 4.0, 4.5, 5.0, 6.0, 8.0)
REGISTER_ROTATION = (
    "developer tool",
    "consumer app",
    "enterprise dashboard",
    "marketing",
    "creative tool",
    "news graphic",
)

PROMPT = """Write a short director's brief for the visual beat served by the source artifact below.

Return ONLY a JSON object, with no prose and no code fence:
{{"brief": "<3-6 sentences, director's voice>", "why_best": "<one sentence explaining why this move fits>", "why_bad": "<one sentence explaining what makes a different kind of move wrong>", "trap": "<one sentence naming the detail a near-miss would get wrong>"}}

Rules:
- Never name the move or use an obvious paraphrase of its name.
- Never reuse the source text's exact wording.
- Describe the beat's purpose, not its mechanics.
- Do not mention frame rates, easing curves, or variable names.

Source artifact and presentation constraints:
{source}
"""


def _lexical_score(query_tokens, body):
    """Mirror harness2.lexical_topk scoring, which exposes names but not scores."""
    have = set(harness2.tokens(body))
    if not have:
        return 0.0
    return len(query_tokens & have) / (len(have) ** 0.5)


def _clean_strings(value):
    if isinstance(value, str):
        return value.replace(chr(0x2014), ",")
    if isinstance(value, list):
        return [_clean_strings(item) for item in value]
    if isinstance(value, dict):
        return {_clean_strings(key): _clean_strings(item) for key, item in value.items()}
    return value


def _joined(value):
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return str(value)


def head_text(relative_path):
    """Read one tracked file's contents at HEAD instead of from the working tree.

    The shelf reads registry items from HEAD, so a brief derived from a
    working-tree copy could describe something the shelf does not contain.
    Reading the same commit keeps the two in step, and it also keeps generation
    working while another session has those files edited or deleted in this
    shared checkout. Primitives are deliberately not read this way: they live in
    an ignored scratch tree and exist only on disk.
    """
    result = subprocess.run(
        ("git", "show", f"HEAD:{relative_path}"),
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip()
        raise ValueError(f"{relative_path} is not readable at HEAD: {detail}")
    return result.stdout


def load_source_text(name, catalog_entry):
    """Load one move's source artifact at HEAD without using its shelf blurb."""
    install_path = catalog_entry["install_path"]
    if catalog_entry["sources"] == "primitive":
        text = (REPO_ROOT / install_path).read_text(encoding="utf-8")
        match = re.search(r"<!--(.*?)-->", text, flags=re.DOTALL)
        if match is None:
            raise ValueError(f"primitive {name!r} has no header comment")
        return match.group(1).strip()

    data = json.loads(head_text(f"{install_path}/registry-item.json"))
    lines = []
    for field in ("name", "type", "title", "description"):
        lines.append(f"{field}: {_joined(data.get(field, ''))}")
    for field in ("stability", "profile", "evidence", "tags", "jobs", "family"):
        if field in data:
            lines.append(f"{field}: {_joined(data[field])}")
    if "variables" in data:
        variables = []
        for variable in data["variables"]:
            variables.append(
                " | ".join(
                    str(variable.get(field, ""))
                    for field in ("id", "type", "description")
                )
            )
        lines.append("variables: " + "; ".join(variables))
    return "\n".join(lines)


def source_of(entry):
    """Fold the primitive+component hybrid into the primitive stratum."""
    if entry["sources"] in ("primitive", "primitive+component"):
        return "primitive"
    return entry["sources"]


def choose_targets(catalog, wave=1, attempts=None):
    """Return the targets that bring every catalog move up to `wave` attempts.

    Allocation is per move, not per source. Round two split briefs equally
    across the three source types so each carried the same statistical power.
    That reasoning does not survive scaling: the shelf holds 25 primitives
    against 290 components, so an equal-thirds split at round three volume
    would pile roughly 700 briefs onto 25 primitive moves. At the measured
    intra-cluster correlation of 0.33, 28 briefs on one move carry about as
    much information as three independent ones, so the stratum would look large
    and say almost nothing. One brief per move per wave keeps cluster sizes
    uniform and the clustered variance calculation honest.

    `attempts` counts generation attempts already spent per move, not briefs
    accepted. A move the gates rejected has spent its wave, so it is not
    re-emitted later: backfilling it would bias the corpus toward moves that
    happen to be easy to describe. Counting attempts is also what makes a wave
    resumable, since a rerun after a partial failure emits only the moves that
    were never reached.
    """
    if isinstance(wave, bool) or not isinstance(wave, int) or wave < 1:
        raise ValueError(f"wave must be a positive integer, got {wave!r}")
    spent = attempts or {}
    targets = []
    for name in sorted(catalog):
        source = source_of(catalog[name])
        targets.extend((name, source) for _ in range(wave - spent.get(name, 0)))
    return targets


def wave_report(catalog, wave, accepted):
    """Describe the corpus at `wave`: composition, cluster sizes and shortfall.

    Per-source counts are reported every wave because the equal-thirds
    guarantee is deliberately gone. The corpus now mirrors the shelf's own
    shape, and that shift has to be visible rather than inferred from a
    constant that no longer exists.
    """
    per_source = Counter()
    per_move_counts = Counter()
    shortfall = []
    for name in sorted(catalog):
        have = accepted.get(name, 0)
        per_source[source_of(catalog[name])] += have
        per_move_counts[have] += 1
        if have < wave:
            shortfall.append({"name": name, "accepted": have, "missing": wave - have})
    return {
        "wave": wave,
        "moves": len(catalog),
        "expected": wave * len(catalog),
        "accepted": sum(per_source.values()),
        "per_source": dict(sorted(per_source.items())),
        "per_move_counts": dict(sorted(per_move_counts.items())),
        "flat": len(per_move_counts) <= 1,
        "shortfall": shortfall,
    }


def load_attempts(path):
    """Return (attempts, accepted) counts per move from the wave log.

    Attempts are what allocation reads, so a move whose brief the gates
    rejected is not retried in a later wave. Accepted counts are what the
    shortfall is measured against, which is how the difference stays visible.
    """
    attempts = Counter()
    accepted = Counter()
    path = Path(path)
    if not path.exists():
        return attempts, accepted
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        attempts[row["name"]] += 1
        if row["status"] == "accept":
            accepted[row["name"]] += 1
    return attempts, accepted


def record_attempt(path, name, status):
    """Append one attempt outcome, so a killed wave resumes where it stopped."""
    if path is None:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps({"name": name, "status": status}) + "\n")


def next_index(briefs_dir):
    """Return the highest brief id already written, so waves do not overwrite."""
    written = [
        int(path.stem)
        for path in Path(briefs_dir).glob("*.md")
        if path.stem.isdigit()
    ]
    return max(written, default=0)


def pick_aspect(name, index):
    if name in FORCED_PORTRAIT:
        return "9:16"
    return ASPECT_ROTATION[index % len(ASPECT_ROTATION)]


def pick_duration(index):
    return DURATION_ROTATION[index % len(DURATION_ROTATION)]


def pick_register(index):
    return REGISTER_ROTATION[index % len(REGISTER_ROTATION)]


def content_overlap_ratio(brief_text, blurb_text):
    brief_tokens = set(harness2.tokens(brief_text))
    if not brief_tokens:
        return 0.0
    blurb_tokens = set(harness2.tokens(blurb_text))
    return len(brief_tokens & blurb_tokens) / len(brief_tokens)


def contains_move_name(text, name):
    folded = text.casefold()
    forms = {name, name.replace("-", " "), name.replace("-", "_")}
    return any(form.casefold() in folded for form in forms)


def distractor_gate(brief_text, name, entries):
    query = set(harness2.tokens(brief_text))
    target_score = _lexical_score(query, entries[name])
    if target_score == 0.0:
        return 0, True
    floor = NEIGHBOR_SCORE_RATIO * target_score
    count = sum(
        1
        for other, body in entries.items()
        if other != name and _lexical_score(query, body) >= floor
    )
    return count, count < NEIGHBOR_MIN_COUNT


def nearest_confusable_neighbors(name, entries, limit=2):
    query = set(harness2.tokens(entries[name]))
    scored = [
        (_lexical_score(query, body), other)
        for other, body in entries.items()
        if other != name
    ]
    scored.sort(reverse=True)
    return [other for _, other in scored[:limit]]


def validate_candidate(name, brief_text, entries):
    if contains_move_name(brief_text, name):
        return "name_leak"
    overlap = content_overlap_ratio(brief_text, entries[name])
    if overlap > VOCAB_MAX_OVERLAP:
        return f"vocabulary:{overlap:.6f}"
    competitors, isolated = distractor_gate(brief_text, name, entries)
    if isolated:
        return f"distractor:{competitors}"
    return None


def generate_move(name, source, entries, model, chat, max_attempts):
    rejections = []
    prompt = PROMPT.format(source=source)
    for _ in range(max_attempts):
        parsed, _, _, _ = chat(
            prompt,
            model,
            {"temperature": BRIEF_TEMPERATURE},
        )
        if not isinstance(parsed, dict):
            rejections.append("parse")
            continue
        parsed = _clean_strings(parsed)
        brief = parsed.get("brief")
        if not isinstance(brief, str) or not brief.strip():
            rejections.append("brief_missing")
            continue
        brief = brief.strip()
        reason = validate_candidate(name, brief, entries)
        if reason is not None:
            rejections.append(reason)
            continue
        return (
            {
                "brief": brief,
                "why_best": parsed.get("why_best", "")
                if isinstance(parsed.get("why_best", ""), str)
                else "",
                "why_bad": parsed.get("why_bad", "")
                if isinstance(parsed.get("why_bad", ""), str)
                else "",
                "trap": parsed.get("trap", "")
                if isinstance(parsed.get("trap", ""), str)
                else "",
            },
            rejections,
        )
    return None, rejections


def generate_corpus(
    entries,
    catalog,
    targets,
    model=MODEL,
    max_attempts=GEN_MAX_ATTEMPTS,
    chat=provider.chat,
    briefs_dir=BRIEFS_DIR,
    gold_dir=GOLD_DIR,
    emit=print,
    attempts_log=None,
    start_index=0,
):
    briefs_dir = Path(briefs_dir)
    gold_dir = Path(gold_dir)
    source_texts = {
        name: load_source_text(name, catalog[name]) for name, _ in dict.fromkeys(targets)
    }
    briefs_dir.mkdir(parents=True, exist_ok=True)
    gold_dir.mkdir(parents=True, exist_ok=True)
    accepted = []
    dropped = []

    for index, (name, source_bucket) in enumerate(targets, start=start_index + 1):
        brief_id = f"{index:03d}"
        duration = pick_duration(index)
        register = pick_register(index)
        aspect = pick_aspect(name, index)
        source = source_texts[name]
        source += (
            "\n\nPresentation constraints chosen by code:"
            f"\nduration: {duration} seconds"
            f"\nregister: {register}"
            f"\naspect: {aspect}"
        )
        result, reasons = generate_move(
            name,
            source,
            entries,
            model,
            chat,
            max_attempts,
        )
        if result is None:
            dropped.append(
                {"name": name, "source": source_bucket, "reasons": reasons}
            )
            record_attempt(attempts_log, name, "drop")
            emit(f"DROP {brief_id} {name}: {', '.join(reasons)}")
            continue

        bad = nearest_confusable_neighbors(name, entries)
        brief_text = result["brief"]
        brief_path = briefs_dir / f"{brief_id}.md"
        brief_path.write_text(
            f"id: {brief_id}\n"
            f"duration: {duration}\n"
            f"register: {register}\n"
            f"aspect: {aspect}\n\n"
            f"{brief_text}\n",
            encoding="utf-8",
        )
        gold = {
            "best": [name],
            "acceptable": [],
            "bad": bad,
            "why_best": result["why_best"],
            "why_bad": result["why_bad"],
            "trap": result["trap"],
        }
        (gold_dir / f"{brief_id}.json").write_text(
            json.dumps(gold, indent=2) + "\n",
            encoding="utf-8",
        )
        accepted.append(
            {
                "id": brief_id,
                "name": name,
                "source": source_bucket,
                "brief_text": brief_text,
                "duration": duration,
                "register": register,
                "aspect": aspect,
                "bad": bad,
            }
        )
        record_attempt(attempts_log, name, "accept")
        emit(f"ACCEPT {brief_id} {name} after {len(reasons) + 1} attempt(s)")

    return {"accepted": accepted, "dropped": dropped}


def _distribution(values):
    ordered = sorted(values)
    if not ordered:
        return {"values": [], "min": None, "median": None, "max": None}
    return {
        "values": ordered,
        "min": ordered[0],
        "median": statistics.median(ordered),
        "max": ordered[-1],
    }


def _cosine(left, right):
    dot = sum(a * b for a, b in zip(left, right))
    left_length = sum(value * value for value in left) ** 0.5
    right_length = sum(value * value for value in right) ** 0.5
    return dot / (left_length * right_length)


def overlap_and_similarity_report(accepted, entries):
    overlaps = [
        content_overlap_ratio(item["brief_text"], entries[item["name"]])
        for item in accepted
    ]
    similarities = None
    if os.path.exists(harness2.VECTORS):
        vectors = json.loads(Path(harness2.VECTORS).read_text(encoding="utf-8"))
        similarities = _distribution(
            [
                _cosine(
                    vectors["briefs"][item["id"]],
                    vectors["moves"][item["name"]],
                )
                for item in accepted
            ]
        )
    return {
        "n": len(accepted),
        "lexical_overlap": _distribution(overlaps),
        "cosine_similarity": similarities,
    }


def retriever_recall_at_k(accepted, entries, k=10):
    lexical_hits = sum(
        item["name"]
        in harness2.lexical_topk(item["brief_text"], entries, k)
        for item in accepted
    )
    semantic_recall = None
    if os.path.exists(harness2.VECTORS):
        semantic_hits = sum(
            item["name"] in harness2.semantic_topk(item["id"], entries, k)
            for item in accepted
        )
        semantic_recall = semantic_hits / len(accepted) if accepted else 0.0
    return {
        "k": k,
        "n": len(accepted),
        "lexical_recall": lexical_hits / len(accepted) if accepted else 0.0,
        "semantic_recall": semantic_recall,
    }


def _source_counts(items):
    counts = Counter(
        item[1] if isinstance(item, tuple) else item["source"] for item in items
    )
    return dict(sorted(counts.items()))


def _fixture_response(brief):
    return {
        "brief": brief,
        "why_best": "It gives the beat a clear visual purpose.",
        "why_bad": "A different kind of move would miss the intended emphasis.",
        "trap": "A near miss would land on the wrong visual priority.",
    }


def _fixture_demo():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    entries = harness2.load_shelf()
    # A wave covers all 424 moves, so the demo takes the first two of each
    # source rather than paying for the whole shelf to show the mechanics.
    sampled = defaultdict(list)
    for target in choose_targets(catalog, 1):
        if len(sampled[target[1]]) < 2:
            sampled[target[1]].append(target)
    targets = [target for source in sorted(sampled) for target in sampled[source]]
    passing = (
        "Group the subject into a singular beat. Shape a lucid cadence, then "
        "land decisively. Keep the moment purposeful, poised, and uncluttered."
    )
    isolated = (
        "Make the axial measurement of a portrait object the instrument's rail. "
        "Keep the finish lucid, poised, polished, refined, graceful, harmonious, "
        "intentional, sophisticated, serene, sculptural, stately, and immaculate. "
        "Leave it assured, balanced, pristine, exacting, purposeful, restrained, "
        "and clear."
    )
    scripts = []
    for position, (name, _) in enumerate(targets):
        if position == 0:
            scripts.extend((_fixture_response(isolated), _fixture_response(passing)))
        elif position == 1:
            scripts.extend(
                (
                    _fixture_response(f"Put {name} at the center of the beat."),
                    _fixture_response(passing),
                )
            )
        elif position in (2, 3):
            scripts.append(_fixture_response(passing))
        elif position == 4:
            scripts.extend(
                _fixture_response(f"Use {name} for this beat.")
                for _ in range(GEN_MAX_ATTEMPTS)
            )
        else:
            scripts.extend(
                (
                    _fixture_response(entries[name]),
                    _fixture_response(passing),
                )
            )

    calls = 0

    def canned_chat(context, model, config=None):
        nonlocal calls
        response = scripts[calls]
        calls += 1
        return response, json.dumps(response), {}, 0.0

    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        result = generate_corpus(
            entries,
            catalog,
            targets,
            chat=canned_chat,
            briefs_dir=root / "briefs",
            gold_dir=root / "gold",
            emit=lambda line: print(line),
        )
        accepted = result["accepted"]
        dropped = result["dropped"]
        print(f"targets: {len(targets)} {_source_counts(targets)}")
        print(f"accepted: {len(accepted)} {_source_counts(accepted)}")
        print(f"dropped: {len(dropped)} {_source_counts(dropped)}")
        for item in dropped:
            print(f"dropped {item['name']}: {', '.join(item['reasons'])}")
        print(
            "overlap report: "
            + json.dumps(overlap_and_similarity_report(accepted, entries), sort_keys=True)
        )
        print(
            "recall report: "
            + json.dumps(retriever_recall_at_k(accepted, entries), sort_keys=True)
        )
    print("NOTE: no model call was made; this is a fixture demo with a canned chat callable.")
    return 0


def project_generation(catalog, wave, spent=None, model=None, max_attempts=GEN_MAX_ATTEMPTS):
    """Price a generation wave from prompt lengths alone, before any call is made.

    The grid and the committee are both priced before they run. Generation was
    not, which left the one cost that scales with the corpus as the only one
    nobody could see at the gate.

    Attempts are reported as a floor and a ceiling rather than as a point. A move
    costs one call if its first brief passes every gate and up to max_attempts if
    it keeps failing them, and the acceptance rate of a wave that has not run is
    not something this function can know. Inventing a rate here would turn a
    bounded projection into a guess wearing a decimal point.
    """
    model = model or MODEL
    targets = choose_targets(catalog, wave, spent)
    # The same source text generate_corpus loads, not source_of's stratum label:
    # the prompt carries the whole artifact, so pricing the label would report a
    # cost around three orders of magnitude below the real one. Reading the files
    # here also preflights them, so a missing source fails at the gate rather than
    # partway through a paid wave.
    source_texts = {
        name: load_source_text(name, catalog[name]) for name, _ in dict.fromkeys(targets)
    }
    chars = sum(len(PROMPT.format(source=source_texts[name])) for name, _ in targets)
    projection = {
        "model": model,
        "wave": wave,
        "targets": len(targets),
        "max_attempts": max_attempts,
        "chars_per_attempt_pass": chars,
    }
    for label, attempts in (("floor", 1), ("ceiling", max_attempts)):
        calls = len(targets) * attempts
        estimated_input = chars * attempts / run2.CHARS_PER_TOKEN
        assumed_output = calls * run2.ASSUMED_OUTPUT_TOKENS
        costs = run2.usage_cost_breakdown(
            {
                "prompt_tokens": estimated_input,
                "cached_tokens": 0,
                "completion_tokens": assumed_output,
            },
            model,
        )
        projection[label] = {
            "attempts_per_move": attempts,
            "calls": calls,
            "estimated_input_tokens": estimated_input,
            "assumed_output_tokens": assumed_output,
            "projected_usd": sum(costs.values()),
        }
    return projection


def generation_dry_run(catalog, wave, spent=None, model=None, emit=print):
    """Emit the projection and make no call. Zero network, no key required."""
    projection = project_generation(catalog, wave, spent, model)
    emit("DRY RUN: zero network calls and no key required.")
    emit(
        f"Estimated input tokens use characters divided by {run2.CHARS_PER_TOKEN}; "
        "this heuristic is NOT a real tokenizer count."
    )
    emit(
        f"Assumed output tokens are {run2.ASSUMED_OUTPUT_TOKENS} per call, not "
        "measured. Cached tokens are projected as 0 because no requests are made."
    )
    emit(f"Model: {projection['model']}")
    emit(f"Wave {projection['wave']}: {projection['targets']} targets")
    for label in ("floor", "ceiling"):
        row = projection[label]
        emit(
            f"{label.capitalize()} at {row['attempts_per_move']} attempt(s) per move: "
            f"{row['calls']} calls, ${row['projected_usd']:.6f}"
        )
    emit(
        "The true cost sits between them and depends on the acceptance rate, which "
        "attempts.jsonl records once a wave has actually run."
    )
    return projection


def main():
    if os.environ.get("GEN_BRIEFS_FIXTURE_DEMO") == "1":
        return _fixture_demo()

    if os.environ.get("EVAL_DRY_RUN") == "1":
        wave = int(os.environ.get("BRIEF_WAVE", "1"))
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        spent, _ = load_attempts(ATTEMPTS_LOG)
        generation_dry_run(catalog, wave, spent)
        return 0

    wave = int(os.environ.get("BRIEF_WAVE", "1"))
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    entries = harness2.load_shelf()
    spent, _ = load_attempts(ATTEMPTS_LOG)
    targets = choose_targets(catalog, wave, spent)
    print(f"wave {wave} targets: {len(targets)} {_source_counts(targets)}")
    result = generate_corpus(
        entries,
        catalog,
        targets,
        chat=provider.chat,
        briefs_dir=BRIEFS_DIR,
        gold_dir=GOLD_DIR,
        attempts_log=ATTEMPTS_LOG,
        start_index=next_index(BRIEFS_DIR),
    )
    accepted = result["accepted"]
    dropped = result["dropped"]
    print(f"accepted this wave: {len(accepted)} {_source_counts(accepted)}")
    _, accepted_total = load_attempts(ATTEMPTS_LOG)
    report = wave_report(catalog, wave, accepted_total)
    print("wave report: " + json.dumps(report, sort_keys=True))
    if len(report["shortfall"]) > STRATIFICATION_TOLERANCE:
        print(
            f"STRATIFICATION WARNING wave {wave}: {len(report['shortfall'])} moves "
            f"below {wave} brief(s), tolerance {STRATIFICATION_TOLERANCE}, "
            "never backfilled"
        )
    print(f"dropped: {len(dropped)}")
    for item in dropped:
        print(f"{item['name']}: {', '.join(item['reasons'])}")
    print(json.dumps(overlap_and_similarity_report(accepted, entries), sort_keys=True))
    print(json.dumps(retriever_recall_at_k(accepted, entries), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
