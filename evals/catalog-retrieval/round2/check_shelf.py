#!/usr/bin/env python3
"""Lock the combined shelf and index to their installable sources."""

import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from build_shelf import (
    BASE_FIELDS,
    BuildError,
    INDEX,
    REPO_ROOT,
    SHELF,
    contains_restricted_text,
    index_data,
    parse_shelf,
    render_index,
    render_shelf,
    scan_sources,
    shelf_fields,
)

BASELINE_SHELF_CHARS = 187730
PRESENCE_FIELDS = ("group", "what", "use_when", "avoid_when", "variables")


@dataclass(frozen=True)
class CheckReport:
    entry_count: int
    computed_count: int
    source_counts: dict
    shelf_source_counts: Counter
    duplicate_count: int
    unknowns: dict
    field_presence: dict
    blurb_lengths: dict
    shelf_chars: int
    failures: tuple


def _read(path, failures):
    try:
        return Path(path).read_text(encoding="utf-8")
    except OSError as error:
        failures.append(f"{Path(path).name}: cannot be read: {error}")
        return ""


def _load_index(text, failures):
    try:
        value = json.loads(text)
    except json.JSONDecodeError as error:
        failures.append(f"catalog-index.json: does not parse: {error}")
        return {}
    if not isinstance(value, dict):
        failures.append("catalog-index.json: top level must be an object")
        return {}
    return value


def check(
    repo_root=REPO_ROOT,
    shelf_path=SHELF,
    index_path=INDEX,
    registry=None,
    source_scan=None,
):
    failures = []
    scan = source_scan or scan_sources(repo_root, registry)
    failures.extend(scan.failures)
    shelf_text = _read(shelf_path, failures)
    index_text = _read(index_path, failures)
    entries = parse_shelf(shelf_text)
    index = _load_index(index_text, failures)

    shelf_by_name = defaultdict(list)
    for entry in entries:
        shelf_by_name[entry.name].append(entry)
    for name, matches in sorted(shelf_by_name.items()):
        if len(matches) != 1:
            failures.append(f"{name}: duplicate shelf entry")

    expected_by_name = {entry.name: entry for entry in scan.entries}
    for name in sorted(set(shelf_by_name) - set(expected_by_name)):
        failures.append(f"{name}: shelf entry has no installable source")
    for name in sorted(set(expected_by_name) - set(shelf_by_name)):
        failures.append(f"{name}: installable source is absent from shelf")
    for name in sorted(set(shelf_by_name) & set(expected_by_name)):
        actual = shelf_by_name[name][0].fields
        expected = shelf_fields(expected_by_name[name])
        if actual != expected:
            failures.append(f"{name}: shelf fields do not match source")

    expected_index = index_data(scan)
    for name in sorted(set(index) - set(expected_index)):
        failures.append(f"{name}: catalog index entry has no installable source")
    for name in sorted(set(expected_index) - set(index)):
        failures.append(f"{name}: installable source is absent from catalog index")
    for name in sorted(set(index) & set(expected_index)):
        if index[name] != expected_index[name]:
            failures.append(f"{name}: catalog index entry does not match source")

    names = set(shelf_by_name)
    for entry in entries:
        pairs = entry.fields.get("pairs_with")
        if not pairs:
            continue
        for reference in re.split(r"[,\s]+", pairs.rstrip(".")):
            if reference and reference not in names:
                failures.append(
                    f"{entry.name}: pairs_with names unknown entry {reference!r}"
                )

    if shelf_text and shelf_text != render_shelf(scan):
        failures.append("shelf.md is not byte-identical to regeneration")
    if index_text and index_text != render_index(scan):
        failures.append("catalog-index.json is not byte-identical to regeneration")
    if contains_restricted_text(shelf_text):
        failures.append("shelf.md contains restricted text")
    if contains_restricted_text(index_text):
        failures.append("catalog-index.json contains restricted text")

    for entry in entries:
        for field in PRESENCE_FIELDS:
            value = entry.fields.get(field)
            if isinstance(value, str) and value.casefold() == "unknown":
                failures.append(f"{entry.name}: {field} emits literal unknown")
        for field in BASE_FIELDS[1:]:
            value = entry.fields.get(field)
            if not isinstance(value, str):
                continue
            for other_field in BASE_FIELDS[1:]:
                if field == other_field:
                    continue
                other_value = entry.fields.get(other_field)
                if (
                    isinstance(other_value, str)
                    and value.casefold() in other_value.casefold()
                ):
                    failures.append(
                        f"{entry.name}: {field} is a substring of {other_field}"
                    )

    shelf_source_counts = Counter(
        entry.fields.get("sources", "unknown") for entry in entries
    )
    unknowns = {}
    field_presence = {}
    for source in sorted(shelf_source_counts):
        source_entries = [
            entry for entry in entries if entry.fields.get("sources") == source
        ]
        unknowns[source] = Counter(
            {
                field: sum(
                    entry.fields.get(field) == "unknown" for entry in source_entries
                )
                for field in BASE_FIELDS
            }
        )
        field_presence[source] = {
            field: (
                sum(field in entry.fields for entry in source_entries),
                len(source_entries),
            )
            for field in PRESENCE_FIELDS
        }

    lengths = defaultdict(list)
    for entry in scan.entries:
        lengths[entry.blurb_source].append(
            len(
                "\n".join(
                    f"{field}: {entry.fields[field]}"
                    for field in BASE_FIELDS
                    if field in entry.fields
                )
            )
        )
    return CheckReport(
        len(entries),
        scan.entry_count,
        scan.counts,
        shelf_source_counts,
        len(scan.duplicates),
        unknowns,
        field_presence,
        dict(lengths),
        len(shelf_text),
        tuple(failures),
    )


def _distribution(values):
    return (
        f"n={len(values)}, min={min(values)}, "
        f"median={statistics.median(values):g}, max={max(values)} characters"
    )


def print_report(report):
    print(f"Total entries: {report.entry_count} (computed: {report.computed_count})")
    print(
        "Source counts: "
        f"primitives={report.source_counts['primitives']}, "
        f"blocks={report.source_counts['blocks']}, "
        f"components={report.source_counts['components']}"
    )
    shelf_counts = ", ".join(
        f"{source}={count}"
        for source, count in sorted(report.shelf_source_counts.items())
    )
    print(f"Shelf source counts: {shelf_counts}")
    print(f"Duplicate count: {report.duplicate_count}")
    print("Unknown tally per field per source:")
    for source, counts in sorted(report.unknowns.items()):
        details = ", ".join(f"{field}={counts[field]}" for field in BASE_FIELDS)
        print(f"  {source}: {details}")
    print("Field presence rate per source:")
    for source, presence in sorted(report.field_presence.items()):
        details = ", ".join(
            f"{field}={present}/{total} ({present / total:.0%})"
            for field, (present, total) in presence.items()
        )
        print(f"  {source}: {details}")
    saved = 100 * (BASELINE_SHELF_CHARS - report.shelf_chars) / BASELINE_SHELF_CHARS
    print(
        f"Shelf characters: before={BASELINE_SHELF_CHARS} "
        f"after={report.shelf_chars} saved={saved:.1f}%"
    )
    print("Blurb length distribution per source:")
    for source, values in sorted(report.blurb_lengths.items()):
        print(f"  {source}: {_distribution(values)}")
    for failure in report.failures:
        print("FAIL", failure)
    print(f"Failures: {len(report.failures)}")


def main():
    try:
        report = check()
    except (BuildError, KeyError, OSError, ValueError) as error:
        print(f"FAIL checker crashed: {error}")
        print("Failures: 1")
        return 1
    print_report(report)
    return 1 if report.failures else 0


if __name__ == "__main__":
    sys.exit(main())
