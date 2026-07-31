#!/usr/bin/env python3
"""Required regression and negative-control checks for the combined shelf."""

import importlib.util
import json
import re
import shutil
import tempfile
from pathlib import Path

from build_shelf import (
    BASE_FIELDS,
    EXPECTED_PRIMITIVE_COMPONENT_COLLISIONS,
    GitHeadRegistry,
    DirectoryRegistry,
    INDEX,
    REPO_ROOT,
    SHELF,
    build,
    contains_restricted_text,
    parse_shelf,
    scan_sources,
)
from check_shelf import BASELINE_SHELF_CHARS, PRESENCE_FIELDS, check


HERE = Path(__file__).resolve().parent


def _export_fixture(destination):
    primitive_source = REPO_ROOT / ".scratch" / "video-primitives"
    primitive_target = destination / ".scratch" / "video-primitives"
    (primitive_target / "showcase" / "previews").mkdir(parents=True)
    for filename in ("SHELF.md", "catalog-index.json"):
        shutil.copy2(primitive_source / filename, primitive_target / filename)
    for preview in sorted((primitive_source / "showcase" / "previews").glob("*.mp4")):
        (primitive_target / "showcase" / "previews" / preview.name).touch()

    head = GitHeadRegistry(REPO_ROOT)
    selections = {
        "blocks": ("code-snippet-dark-modern",),
        "components": tuple(sorted(EXPECTED_PRIMITIVE_COMPONENT_COLLISIONS))
        + ("alert",),
    }
    for plural, names in selections.items():
        for name in names:
            item_root = destination / "registry" / plural / name
            item_root.mkdir(parents=True)
            (item_root / "registry-item.json").write_text(
                head.item_text(plural, name), encoding="utf-8"
            )
            for path in head.tree_paths(plural, name):
                target = destination / path
                if not target.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.touch()


def _load_with_round1_parser(shelf_path):
    harness_path = REPO_ROOT / ".scratch" / "catalog-eval" / "harness.py"
    spec = importlib.util.spec_from_file_location("round1_harness", harness_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.SHELF = str(shelf_path)
    return module.load_shelf()


def assert_real_sources_and_count(scan):
    entries = parse_shelf(SHELF.read_text(encoding="utf-8"))
    expected = (
        scan.counts["primitives"]
        + scan.counts["blocks"]
        + scan.counts["components"]
        - len(scan.duplicates)
    )
    assert not scan.failures, scan.failures
    assert len(entries) == expected == scan.entry_count
    assert len({entry.name for entry in entries}) == expected
    report = check(source_scan=scan)
    assert not report.failures, report.failures
    assert report.entry_count == report.computed_count


def assert_known_duplicates_merge_once(scan):
    entries = parse_shelf(SHELF.read_text(encoding="utf-8"))
    by_name = {entry.name: entry for entry in entries}
    primitive_entries = {
        entry.name: entry
        for entry in parse_shelf(
            (
                REPO_ROOT / ".scratch" / "video-primitives" / "SHELF.md"
            ).read_text(encoding="utf-8")
        )
    }
    assert scan.duplicates == EXPECTED_PRIMITIVE_COMPONENT_COLLISIONS
    for name in scan.duplicates:
        assert sum(entry.name == name for entry in entries) == 1
        combined = by_name[name]
        assert combined.fields["sources"] == "primitive+component"
        assert combined.fields["install_path"] == f"registry/components/{name}"
        for field in (*BASE_FIELDS, "pairs_with", "variables"):
            assert combined.fields[field] == primitive_entries[name].fields[field]


def assert_existence_proofs(scan):
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    assert set(index) == {entry.name for entry in scan.entries}
    for entry in scan.entries:
        assert index[entry.name]["existence_proof"]
        if entry.sources == "primitive+component":
            assert all(
                proof.startswith(f"HEAD:registry/components/{entry.name}/")
                for proof in index[entry.name]["existence_proof"]
            )


def assert_regeneration_is_identical(temp_root):
    shelf = temp_root / "shelf.md"
    index = temp_root / "catalog-index.json"
    scan = build(shelf_path=shelf, index_path=index)
    assert shelf.read_bytes() == SHELF.read_bytes()
    assert index.read_bytes() == INDEX.read_bytes()
    return scan


def assert_negative_controls(temp_repo):
    registry = DirectoryRegistry(temp_repo)
    output = temp_repo / ".scratch" / "catalog-eval" / "round2"
    output.mkdir(parents=True)
    shelf = output / "shelf.md"
    index = output / "catalog-index.json"
    build(temp_repo, shelf, index, registry)

    preview = next(
        iter(
            sorted(
                (
                    temp_repo / ".scratch/video-primitives/showcase/previews"
                ).glob("*.mp4")
            )
        )
    )
    preview_name = preview.stem
    preview.unlink()
    report = check(temp_repo, shelf, index, registry)
    assert report.failures
    assert any(preview_name in failure for failure in report.failures), report.failures
    preview.touch()

    item_path = next(
        path
        for path in sorted(
            (temp_repo / "registry" / "blocks").glob("*/registry-item.json")
        )
        if len(json.loads(path.read_text(encoding="utf-8"))["files"]) > 1
    )
    original = item_path.read_text(encoding="utf-8")
    data = json.loads(original)
    removed = data["files"].pop()
    item_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    report = check(temp_repo, shelf, index, registry)
    assert report.failures
    assert any(data["name"] in failure for failure in report.failures), report.failures
    item_path.write_text(original, encoding="utf-8")
    assert removed


def assert_unexpected_collision_fails(temp_repo):
    name = "caliper-caption-rail"
    root = temp_repo / "registry" / "blocks" / name
    root.mkdir()
    data = {
        "name": name,
        "title": "Collision fixture",
        "description": "Collision fixture",
        "tags": ["fixture"],
        "files": [{"path": "fixture.html"}],
    }
    (root / "registry-item.json").write_text(
        json.dumps(data, indent=2) + "\n", encoding="utf-8"
    )
    (root / "fixture.html").touch()
    scan = scan_sources(temp_repo, DirectoryRegistry(temp_repo))
    assert any(
        name in failure and "unexpected primitive/block collision" in failure
        for failure in scan.failures
    ), scan.failures


def assert_pairs_and_parser():
    entries = parse_shelf(SHELF.read_text(encoding="utf-8"))
    names = {entry.name for entry in entries}
    for entry in entries:
        pairs = entry.fields.get("pairs_with", "")
        references = re.split(r"[,\s]+", pairs.rstrip("."))
        assert all(reference in names for reference in references if reference)
    assert len(_load_with_round1_parser(SHELF)) == len(entries)


def assert_unknowns_and_text_constraints():
    text = SHELF.read_text(encoding="utf-8")
    index_text = INDEX.read_text(encoding="utf-8")
    entries = parse_shelf(text)
    assert text.count(chr(0x2014)) == 0
    assert not contains_restricted_text(text)
    assert not contains_restricted_text(index_text)
    registry_entries = [
        entry
        for entry in entries
        if entry.fields["sources"] in ("block", "component")
    ]
    assert registry_entries
    assert all("avoid_when" not in entry.fields for entry in registry_entries)


def assert_no_unknown_fields():
    entries = parse_shelf(SHELF.read_text(encoding="utf-8"))
    for entry in entries:
        for field in PRESENCE_FIELDS:
            if field in entry.fields:
                assert entry.fields[field].casefold() != "unknown", (entry.name, field)


def assert_no_redundant_descriptive_fields():
    entries = parse_shelf(SHELF.read_text(encoding="utf-8"))
    descriptive_fields = BASE_FIELDS[1:]
    for entry in entries:
        for field in descriptive_fields:
            if field not in entry.fields:
                continue
            for other_field in descriptive_fields:
                if field == other_field or other_field not in entry.fields:
                    continue
                assert (
                    entry.fields[field].casefold()
                    not in entry.fields[other_field].casefold()
                ), (entry.name, field, other_field)


def assert_registry_variables_are_present():
    entries = {
        entry.name: entry
        for entry in parse_shelf(SHELF.read_text(encoding="utf-8"))
    }
    head = GitHeadRegistry(REPO_ROOT)
    for plural in ("blocks", "components"):
        for name in head.names(plural):
            data = json.loads(head.item_text(plural, name))
            variables = data.get("variables")
            if isinstance(variables, list) and variables:
                assert "variables" in entries[name].fields, (plural, name)


def assert_aurora_drift_use_when_is_distinct():
    entries = {
        entry.name: entry
        for entry in parse_shelf(SHELF.read_text(encoding="utf-8"))
    }
    entry = entries["aurora-drift"]
    use_when = entry.fields["use_when"].casefold()
    what = entry.fields["what"].casefold()
    assert use_when != what
    assert use_when not in what


def assert_shelf_character_reduction():
    assert len(SHELF.read_text(encoding="utf-8")) <= BASELINE_SHELF_CHARS * 0.8


def main():
    with tempfile.TemporaryDirectory(prefix="shelf-", dir=HERE) as temp_dir:
        temp_root = Path(temp_dir)
        scan = assert_regeneration_is_identical(temp_root)
        assert_real_sources_and_count(scan)
        assert_known_duplicates_merge_once(scan)
        assert_existence_proofs(scan)
        assert_pairs_and_parser()
        assert_unknowns_and_text_constraints()
        assert_no_unknown_fields()
        assert_no_redundant_descriptive_fields()
        assert_registry_variables_are_present()
        assert_aurora_drift_use_when_is_distinct()
        assert_shelf_character_reduction()
        temp_repo = temp_root / "repo"
        _export_fixture(temp_repo)
        assert_negative_controls(temp_repo)
        assert_unexpected_collision_fails(temp_repo)
    print("test_shelf.py: 14 scenarios passed")


if __name__ == "__main__":
    main()
