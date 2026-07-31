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


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
CATALOG = HERE / "catalog-index.json"
BRIEFS_DIR = HERE / "briefs"
GOLD_DIR = HERE / "gold"

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

# This is an equal-thirds split, not a proportional sample of the shelf. Equal
# counts give all three source types the same statistical power instead of
# letting the most common registry source dominate the corpus and verdict.
# There are only 25 primitive moves, so the 100 primitive targets reuse a move
# about four times on average. Each use still receives its own presentation
# constraints and inverse-constructed brief.
PER_SOURCE = {"primitive": 100, "block": 100, "component": 100}

STRATIFICATION_TOLERANCE = 10
# This is the allowed shortfall per source after exhausted moves are dropped.
# It is not a backfill budget: replacing a dropped target would bias the corpus
# toward moves that happen to be easier to describe.

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


def choose_targets(catalog, per_source=PER_SOURCE):
    """Return deterministic, coarse-family round-robin targets by source."""
    grouped = {source: defaultdict(list) for source in per_source}
    for name, entry in catalog.items():
        source = (
            "primitive"
            if entry["sources"] in ("primitive", "primitive+component")
            else entry["sources"]
        )
        if source not in grouped:
            continue
        # build_shelf._group folds tags, jobs, and family into group. Its first
        # token is therefore a coarse family proxy, and the only uniform signal
        # because blocks and primitives do not declare a separate family field.
        bucket = entry["group"].split(",", 1)[0].strip()
        grouped[source][bucket].append(name)

    targets = []
    for source, wanted in per_source.items():
        buckets = grouped[source]
        if wanted and not buckets:
            raise ValueError(f"no catalog entries for source {source!r}")
        keys = sorted(buckets)
        names = {key: sorted(buckets[key]) for key in keys}
        offsets = {key: 0 for key in keys}
        picked = 0
        while picked < wanted:
            # Each sweep takes the next unused move from every family, and a
            # family that is spent is skipped rather than wrapped. Wrapping the
            # short families early is what made 100 block briefs land on only 53
            # of the 109 blocks: no move repeats until every move has been used.
            progressed = False
            for key in keys:
                choices = names[key]
                if offsets[key] >= len(choices):
                    continue
                targets.append((choices[offsets[key]], source))
                offsets[key] += 1
                picked += 1
                progressed = True
                if picked == wanted:
                    break
            if picked == wanted:
                break
            if not progressed:
                # More briefs wanted than the stratum has moves, so start a
                # fresh cycle. Repeats then spread evenly across families
                # instead of piling onto whichever family is smallest.
                offsets = {key: 0 for key in keys}
    return targets


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

    for index, (name, source_bucket) in enumerate(targets, start=1):
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
    targets = choose_targets(
        catalog,
        {"primitive": 2, "block": 2, "component": 2},
    )
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


def main():
    if os.environ.get("GEN_BRIEFS_FIXTURE_DEMO") == "1":
        return _fixture_demo()

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    entries = harness2.load_shelf()
    targets = choose_targets(catalog)
    print(f"target composition: {len(targets)} {_source_counts(targets)}")
    result = generate_corpus(
        entries,
        catalog,
        targets,
        chat=provider.chat,
        briefs_dir=BRIEFS_DIR,
        gold_dir=GOLD_DIR,
    )
    accepted = result["accepted"]
    dropped = result["dropped"]
    accepted_counts = _source_counts(accepted)
    print(f"accepted composition: {len(accepted)} {accepted_counts}")
    for source, wanted in PER_SOURCE.items():
        actual = accepted_counts.get(source, 0)
        if actual < wanted - STRATIFICATION_TOLERANCE:
            print(
                f"STRATIFICATION WARNING {source}: {actual} accepted, "
                f"target {wanted}, tolerance {STRATIFICATION_TOLERANCE}"
            )
    print(f"dropped: {len(dropped)}")
    for item in dropped:
        print(f"{item['name']}: {', '.join(item['reasons'])}")
    print(json.dumps(overlap_and_similarity_report(accepted, entries), sort_keys=True))
    print(json.dumps(retriever_recall_at_k(accepted, entries), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
