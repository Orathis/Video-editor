#!/usr/bin/env python3
"""Build the deterministic combined catalog shelf from local and HEAD sources."""

import json
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
SHELF = HERE / "shelf.md"
INDEX = HERE / "catalog-index.json"
# Where the primitive source artifacts live, relative to a repo root. Named once
# because the builder resolves it against the real checkout and the test suite
# resolves it against a synthetic one; two spellings would let the fixture drift
# away from what the builder actually reads.
PRIMITIVE_RELATIVE = ("evals", "catalog-retrieval", "sources")
PRIMITIVE_ROOT = REPO_ROOT.joinpath(*PRIMITIVE_RELATIVE)
BASE_FIELDS = ("group", "what", "use_when", "avoid_when")
PRIMITIVE_FIELDS = BASE_FIELDS + ("pairs_with", "variables")
SHELF_FIELDS = PRIMITIVE_FIELDS + ("sources", "install_path")
DESCRIPTIVE_FIELDS = ("what", "use_when", "avoid_when")
# Moves that exist both as a primitive and as an installable component, so the
# shelf lists them once. Pinned rather than derived: a move silently appearing
# on or dropping off this list changes the entry count the whole eval is
# measured against.
EXPECTED_PRIMITIVE_COMPONENT_COLLISIONS = frozenset(
    (
        "caption-camera-follow",
        "echo-trail",
        "focus-rack",
        "grade-split-reveal",
        "halftone-dissolve",
        "kinetic-type-swap",
        "marker-highlight",
        "match-cut",
        "particle-text-dissolve",
        "press-ripple",
        "state-chip-rail",
        "whiteboard-ink",
    )
)
_RESTRICTED_CODEPOINTS = (
    (67, 108, 97, 117, 100, 101),
    (65, 110, 116, 104, 114, 111, 112, 105, 99),
    (65, 73),
    (97, 115, 115, 105, 115, 116, 97, 110, 116),
    (103, 101, 110, 101, 114, 97, 116, 101, 100, 32, 119, 105, 116, 104),
)


class BuildError(Exception):
    pass


@dataclass(frozen=True)
class ShelfEntry:
    name: str
    fields: dict


@dataclass(frozen=True)
class SourceEntry:
    name: str
    sources: str
    fields: dict
    install_path: str
    proofs: tuple

    @property
    def blurb_source(self):
        return "primitive" if self.sources == "primitive+component" else self.sources


@dataclass(frozen=True)
class SourceScan:
    entries: tuple
    counts: dict
    duplicates: frozenset
    failures: tuple

    @property
    def entry_count(self):
        return sum(self.counts.values()) - len(self.duplicates)


class GitHeadRegistry:
    def __init__(self, repo_root=REPO_ROOT):
        self.repo_root = Path(repo_root).resolve()

    def _run(self, *args):
        result = subprocess.run(
            ("git", *args),
            cwd=self.repo_root,
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode:
            detail = result.stderr.strip() or result.stdout.strip()
            raise BuildError(f"git {' '.join(args)} failed: {detail}")
        return result.stdout

    def verify(self):
        self._run("cat-file", "-e", "HEAD^{commit}")

    def names(self, plural):
        prefix = f"registry/{plural}/"
        output = self._run("ls-tree", "-d", "--name-only", "HEAD", prefix)
        names = []
        for path in output.splitlines():
            if not path.startswith(prefix):
                raise BuildError(f"unexpected HEAD tree path: {path}")
            names.append(path.removeprefix(prefix))
        return names

    def item_text(self, plural, name):
        path = f"registry/{plural}/{name}/registry-item.json"
        return self._run("show", f"HEAD:{path}")

    def tree_paths(self, plural, name):
        prefix = f"registry/{plural}/{name}/"
        output = self._run("ls-tree", "-r", "--name-only", "HEAD", prefix)
        return set(output.splitlines())


class DirectoryRegistry:
    """Filesystem view used only by local negative controls."""

    def __init__(self, repo_root):
        self.repo_root = Path(repo_root).resolve()

    def verify(self):
        return None

    def names(self, plural):
        root = self.repo_root / "registry" / plural
        return sorted(path.name for path in root.iterdir() if path.is_dir())

    def item_text(self, plural, name):
        path = self.repo_root / "registry" / plural / name / "registry-item.json"
        return path.read_text(encoding="utf-8")

    def tree_paths(self, plural, name):
        root = self.repo_root / "registry" / plural / name
        return {
            path.relative_to(self.repo_root).as_posix()
            for path in root.rglob("*")
            if path.is_file()
        }


def parse_shelf(text):
    entries = []
    for block in re.split(r"^### ", text, flags=re.M)[1:]:
        lines = block.splitlines()
        fields = {}
        for line in lines[1:]:
            match = re.match(r"^(\w+): (.+)$", line)
            if match and match.group(1) in SHELF_FIELDS:
                fields[match.group(1)] = match.group(2)
        entries.append(ShelfEntry(lines[0].strip(), fields))
    return entries


def _restricted_terms():
    return tuple(
        "".join(chr(value) for value in codepoints)
        for codepoints in _RESTRICTED_CODEPOINTS
    )


def _term_pattern(term):
    return rf"(?<![A-Za-z]){re.escape(term)}(?![A-Za-z])"


def clean_text(value):
    if not isinstance(value, str):
        return ""
    text = value.replace(chr(0x2014), ",")
    for position, term in enumerate(_restricted_terms()):
        flags = 0 if position == 2 else re.I
        text = re.sub(_term_pattern(term), "", text, flags=flags)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    text = re.sub(r",\s*,", ",", text)
    return text.strip(" ,")


def contains_restricted_text(text):
    if chr(0x2014) in text:
        return True
    for position, term in enumerate(_restricted_terms()):
        flags = 0 if position == 2 else re.I
        if re.search(_term_pattern(term), text, flags=flags):
            return True
    return False


def _metadata_values(data, field):
    value = data.get(field)
    if isinstance(value, list):
        return value
    return [] if value is None else [value]


def _group(data):
    values = []
    seen = set()
    for field in ("tags", "jobs", "family"):
        for raw in _metadata_values(data, field):
            value = clean_text(raw)
            key = value.casefold()
            if value and key not in seen:
                seen.add(key)
                values.append(value)
    values.sort(key=str.casefold)
    return ", ".join(values) if values else "unknown"


def _use_when_candidate(data):
    explicit = clean_text(data.get("use_when"))
    if explicit:
        return explicit
    jobs = ", ".join(
        value
        for value in (clean_text(v) for v in _metadata_values(data, "jobs"))
        if value
    )
    profile = clean_text(data.get("profile"))
    parts = []
    if jobs:
        parts.append(f"Jobs: {jobs}.")
    if profile:
        parts.append(f"Profile: {profile}.")
    return " ".join(parts)


def _format_variable(variable):
    if not isinstance(variable, dict):
        return ""
    vid = clean_text(variable.get("id"))
    vtype = clean_text(variable.get("type"))
    if not vid or not vtype:
        return ""
    piece = f"{vid}:{vtype}"
    if "default" in variable:
        default = variable["default"]
        if isinstance(default, str):
            piece += f'="{clean_text(default)}"'
        elif isinstance(default, bool):
            piece += f"={str(default).lower()}"
        elif isinstance(default, (int, float)):
            piece += f"={default}"
    return piece


def _registry_variables_text(data):
    variables = data.get("variables")
    if not isinstance(variables, list) or not variables:
        return ""
    pieces = [piece for piece in (_format_variable(v) for v in variables) if piece]
    return ", ".join(pieces)


def _derived_fields(data):
    title = clean_text(data.get("title"))
    description = clean_text(data.get("description"))
    what = ". ".join(value for value in (title, description) if value) or "unknown"
    fields = {"group": _group(data), "what": what}
    use_when = _use_when_candidate(data)
    if use_when:
        fields["use_when"] = use_when
    avoid_when = clean_text(data.get("avoid_when"))
    if avoid_when:
        fields["avoid_when"] = avoid_when
    variables = _registry_variables_text(data)
    if variables:
        fields["variables"] = variables
    return fields


def _select_descriptive(fields):
    selected = {}
    emitted_texts = []
    for name in DESCRIPTIVE_FIELDS:
        text = fields.get(name, "")
        normalized = text.strip() if isinstance(text, str) else ""
        if not normalized or normalized.casefold() == "unknown":
            continue
        if any(normalized.casefold() in prior.casefold() for prior in emitted_texts):
            continue
        selected[name] = normalized
        emitted_texts.append(normalized)
    return selected


def _load_primitives(repo_root):
    # Read from the eval's own vendored copies rather than a sibling scratch
    # directory. The shelf has to be regenerable byte for byte from a clean
    # checkout, and a gitignored working directory is not part of one.
    root = repo_root.joinpath(*PRIMITIVE_RELATIVE)
    failures = []
    previews = sorted((root / "previews").glob("*.mp4"))
    try:
        shelf_entries = parse_shelf((root / "SHELF.md").read_text(encoding="utf-8"))
        source_index = json.loads(
            (root / "primitive-index.json").read_text(encoding="utf-8")
        )
    except (json.JSONDecodeError, OSError) as error:
        return [], len(previews), [f"primitives: source data cannot be read: {error}"]

    by_name = defaultdict(list)
    for entry in shelf_entries:
        by_name[entry.name].append(entry)
    preview_names = {path.stem for path in previews}
    index_names = set(source_index) if isinstance(source_index, dict) else set()

    for name, matches in sorted(by_name.items()):
        if len(matches) != 1:
            failures.append(f"{name}: duplicate primitive shelf entry")
    for name in sorted(set(by_name) - preview_names):
        failures.append(f"{name}: primitive shelf entry has no preview")
    for name in sorted(preview_names - set(by_name)):
        failures.append(f"{name}: primitive preview has no shelf entry")
    for name in sorted(preview_names - index_names):
        failures.append(f"{name}: primitive preview has no catalog index entry")
    for name in sorted(index_names - preview_names):
        failures.append(f"{name}: primitive catalog index entry has no preview")

    entries = []
    for preview in previews:
        matches = by_name.get(preview.stem, [])
        index_entry = source_index.get(preview.stem) if isinstance(source_index, dict) else None
        if len(matches) != 1 or not isinstance(index_entry, dict):
            continue
        fields = matches[0].fields
        for field in PRIMITIVE_FIELDS:
            if not fields.get(field):
                failures.append(f"{preview.stem}: primitive shelf is missing {field}")
        install_path = index_entry.get("source")
        if not isinstance(install_path, str) or not install_path:
            failures.append(f"{preview.stem}: primitive index has no source path")
            install_path = "unknown"
        entries.append(
            SourceEntry(
                preview.stem,
                "primitive",
                fields,
                install_path,
                (preview.relative_to(repo_root).as_posix(),),
            )
        )
    return entries, len(previews), failures


def _file_path(plural, directory, item, position, failures):
    relative = (
        item
        if isinstance(item, str)
        else item.get("path")
        if isinstance(item, dict)
        else None
    )
    if not isinstance(relative, str) or not relative:
        failures.append(f"{directory}: files[{position}] has no path")
        return None
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts:
        failures.append(f"{directory}: files[{position}] leaves its registry directory")
        return None
    return f"registry/{plural}/{directory}/{path.as_posix()}"


def _load_registry(provider, plural, source_type):
    failures = []
    entries = []
    names = sorted(provider.names(plural))
    for directory in names:
        try:
            data = json.loads(provider.item_text(plural, directory))
            tree = provider.tree_paths(plural, directory)
        except (BuildError, json.JSONDecodeError, OSError) as error:
            failures.append(f"{directory}: registry source cannot be read: {error}")
            continue

        item_path = f"registry/{plural}/{directory}/registry-item.json"
        if item_path not in tree:
            failures.append(f"{directory}: registry-item.json is absent from its tree")
        name = data.get("name")
        if not isinstance(name, str) or not name:
            failures.append(f"{directory}: registry item has no name")
            continue
        if name != directory:
            failures.append(f"{name}: registry name does not match directory {directory}")

        files = data.get("files")
        if not isinstance(files, list) or not files:
            failures.append(f"{name}: files must be a non-empty array")
            files = []
        proof_paths = []
        for position, item in enumerate(files):
            path = _file_path(plural, directory, item, position, failures)
            if path is None:
                continue
            proof_paths.append(path)
            if path not in tree:
                failures.append(f"{name}: missing HEAD file from files array: {path}")

        entries.append(
            SourceEntry(
                name,
                source_type,
                _derived_fields(data),
                f"registry/{plural}/{directory}",
                tuple(f"HEAD:{path}" for path in (item_path, *proof_paths)),
            )
        )
    return entries, len(names), failures


def _collision_failure(label, names):
    return f"unexpected {label} collision: {', '.join(sorted(names))}"


def scan_sources(repo_root=REPO_ROOT, registry=None):
    repo_root = Path(repo_root).resolve()
    registry = registry or GitHeadRegistry(repo_root)
    registry.verify()
    primitives, primitive_count, failures = _load_primitives(repo_root)
    blocks, block_count, block_failures = _load_registry(registry, "blocks", "block")
    components, component_count, component_failures = _load_registry(
        registry, "components", "component"
    )
    failures.extend(block_failures)
    failures.extend(component_failures)

    primitive_by_name = {entry.name: entry for entry in primitives}
    block_by_name = {entry.name: entry for entry in blocks}
    component_by_name = {entry.name: entry for entry in components}
    duplicates = frozenset(primitive_by_name) & frozenset(component_by_name)
    if duplicates != EXPECTED_PRIMITIVE_COMPONENT_COLLISIONS:
        missing = EXPECTED_PRIMITIVE_COMPONENT_COLLISIONS - duplicates
        extra = duplicates - EXPECTED_PRIMITIVE_COMPONENT_COLLISIONS
        failures.append(
            "primitive/component collision set changed: "
            f"missing={','.join(sorted(missing)) or 'none'}; "
            f"extra={','.join(sorted(extra)) or 'none'}"
        )

    primitive_block = frozenset(primitive_by_name) & frozenset(block_by_name)
    component_block = frozenset(component_by_name) & frozenset(block_by_name)
    if primitive_block:
        failures.append(_collision_failure("primitive/block", primitive_block))
    if component_block:
        failures.append(_collision_failure("component/block", component_block))

    entries = []
    for name in sorted(primitive_by_name):
        primitive = primitive_by_name[name]
        if name in duplicates:
            component = component_by_name[name]
            entries.append(
                SourceEntry(
                    name,
                    "primitive+component",
                    primitive.fields,
                    component.install_path,
                    component.proofs,
                )
            )
        else:
            entries.append(primitive)
    entries.extend(block_by_name[name] for name in sorted(block_by_name))
    entries.extend(
        component_by_name[name]
        for name in sorted(component_by_name)
        if name not in duplicates
    )
    return SourceScan(
        tuple(entries),
        {
            "primitives": primitive_count,
            "blocks": block_count,
            "components": component_count,
        },
        duplicates,
        tuple(failures),
    )


def shelf_fields(entry):
    fields = {}
    if "group" in entry.fields:
        fields["group"] = entry.fields["group"]
    fields.update(_select_descriptive(entry.fields))
    for field in ("pairs_with", "variables"):
        if field in entry.fields:
            fields[field] = entry.fields[field]
    fields["sources"] = entry.sources
    fields["install_path"] = entry.install_path
    return fields


def render_shelf(scan):
    sections = ["# Installable catalog shelf"]
    for entry in scan.entries:
        fields = shelf_fields(entry)
        lines = [f"### {entry.name}"]
        lines.extend(f"{field}: {value}" for field, value in fields.items())
        sections.append("\n".join(lines))
    output = "\n\n".join(sections) + "\n"
    if contains_restricted_text(output):
        raise BuildError("rendered shelf contains restricted text")
    return output


def index_data(scan):
    return {
        entry.name: {
            **entry.fields,
            "sources": entry.sources,
            "blurb_source": entry.blurb_source,
            "install_path": entry.install_path,
            "existence_proof": list(entry.proofs),
        }
        for entry in scan.entries
    }


def render_index(scan):
    output = json.dumps(
        index_data(scan), sort_keys=True, indent=2, separators=(",", ": ")
    ) + "\n"
    if contains_restricted_text(output):
        raise BuildError("rendered catalog index contains restricted text")
    return output


def build(
    repo_root=REPO_ROOT,
    shelf_path=SHELF,
    index_path=INDEX,
    registry=None,
):
    scan = scan_sources(repo_root, registry)
    if scan.failures:
        raise BuildError("\n".join(scan.failures))
    Path(shelf_path).write_text(render_shelf(scan), encoding="utf-8")
    Path(index_path).write_text(render_index(scan), encoding="utf-8")
    return scan


def main():
    try:
        scan = build()
    except (BuildError, OSError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(
        f"{scan.entry_count} entries from "
        f"{scan.counts['primitives']} primitives, "
        f"{scan.counts['blocks']} blocks, "
        f"{scan.counts['components']} components, "
        f"{len(scan.duplicates)} merged duplicates"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
