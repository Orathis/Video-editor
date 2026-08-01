---
title: Round 4, an unbiased corpus and a second model
date: 2026-08-01
branch: feat-video-primitives
execution: code
status: planned
supersedes_nothing: true
---

# Round 4 plan: buy the confidence that round 3 could not

Round 3 produced a defensible ranking and an honest list of what it could not settle. Round 4
exists to close four of those five gaps. The fifth is structural and is stated here as a scope
boundary rather than promised as a deliverable.

The budget is waived. The binding constraints are corpus bias and statistical resolution, and
both of those are bought with corpus coverage and a second model, not with more runs of the same
thing.

## What round 3 already settled, and is not re-measured here

Taken as given from `evals/catalog-retrieval/round3/` at commits `30b3f9546`, `29cfb364d`,
`85b25e448`.

- Arm choice reduces entirely to recall. Once the gold move is on the shown list, every arm
  converts it to a good pick at the same rate. Measured, not assumed.
- Over a 44 value k grid (5, then 10 to 420 in steps of 10, then 423) on 273 briefs and 273
  target moves: k=5 ties, k=10 to 150 separates and ships hybrid at all 15 separated list
  lengths, k=160 to 423 ties. Margins over the runner up: +0.0659 at k=10, +0.0989 at k=80,
  +0.0440 at k=150, none of them touching zero.
- Paid confirmation at k=80, 546 runs, $7.02, zero errors: hybrid ahead on fit by +0.1081
  (0.0550 to 0.1612) and on pass rate by +0.1172 (0.0575 to 0.1769). Refusal was 0 of 273 in
  both cells, bounded under 1.1 percent by the rule of three. Mountable was 1.0000 in both,
  bounded below at 0.9890.
- Fusion weights are themselves k dependent. `hybrid@w=0.3` is separably worse than `w=0.5` at 7
  of 44 list lengths and worse than `w=0.7` at 9, all of them short. The two leaders `w=0.5` and
  `w=0.7` separate at only 2 of 44 list lengths (110 and 120) and the sign of their difference
  flips across the grid. Resolving them at their closest point needs about 231 independent moves
  against a shelf of 424, so this is genuine k dependence and not a power problem.

## The four gaps this round closes

**Gap 1, corpus pruning bias. Highest priority.** 363 briefs were generated and a blind committee
reconstructed the target for only 273 of them, 75.21 percent, below the pre-registered 95 percent
floor. The 90 dropped briefs describe a beat that two near twin moves answer equally well.
`round3/GOLD-AUDIT.md` reports 100.00 percent agreement, but that is 100 percent by construction,
because the disagreements were removed before the audit ran. Every round 3 recall number is
therefore an upper bound on the generated corpus, and the exclusion is correlated with exactly
the cases where retrieval is hardest. A blurb length split reproduced the band shape in both
halves, which reduces the concern without closing it.

Round 4 fixes this at the root rather than measuring around it. Gold becomes a set: `best` is
every move that genuinely answers the beat. A brief whose beat has two right answers is then
scored fairly instead of excluded, and the corpus covers all 424 shelf moves.

**Gap 2, an underpowered secondary metric.** The known-wrong-pick gap is +0.0330 with a half
width of 0.0374, so it does not separate. Resolving it at its observed size needs about 351
briefs, from 273 x (0.0374 / 0.0330)^2. Full shelf coverage at 424 clears that.

**Gap 3, single point paid confirmation.** The paid stage ran at exactly one list length. The end
to end claim is asserted for a band and verified at a point. Round 4 verifies it at several
points inside the band and at least one outside it.

**Gap 4, single model, and the deepest one.** Every paid number in rounds 2 and 3 came from one
model. Nothing yet distinguishes "hybrid wins inside the band" as a property of the retriever
from the same sentence as a property of that model. A second model family on the same grid is the
only way to tell them apart, and it is the single largest confidence gain available.

## Scope boundary: what no amount of money buys

**There is no k independent arm winner to be bought.** All arms draw from the same 424 shelf
entries, so as k approaches the shelf size every arm shows every entry and they must converge.
This is arithmetic, not a resolution limit, and no corpus size changes it. The only lever that
would move it is a larger catalog, which means authoring more primitives. That is a product
change and it is explicitly out of scope for round 4.

Round 4 also does not re-open the fusion weight question. Round 3 established that the two
leading weights are genuinely k dependent rather than under-measured. Round 4 carries `w=0.5`
forward as the hybrid representative and records the sweep for the others without letting them
decide anything.

## Definition of done

"Fully confident" means one shippable **(arm, k)** operating point for the frame worker default,
backed by all four of:

1. **An unbiased corpus.** All 424 shelf moves covered, near twins scored under multi-target gold
   rather than excluded, and a committee agreement rate reported on the corpus that is actually
   scored rather than on a survivor set.
2. **Band stability.** The leader separates from the runner up across a contiguous run of list
   lengths, not at a single lucky k, and the plan states the required band width before the
   numbers exist.
3. **Paid agreement at more than one k.** End to end confirmation at several list lengths inside
   the separated band and at least one outside it, with the outside point expected to tie.
4. **Reproduction on a second model family.** The same recall band and the same end to end
   ordering, measured on a second chat model, with the paid cells differing in exactly one
   variable.

If any of the four fails, the round reports which one and ships nothing. A failed reproduction is
a result.

## Pre-registration, mandatory

`round4/DECISION-RULE.md` is written and committed **before any round 4 number exists**, with the
same ancestry check round 3 used:

```
git merge-base --is-ancestor <rule commit> <any result commit>
```

It must carry, at minimum:

- The ranking rule, on offline recall, with clustered errors, and the clustering key restated for
  multi-target gold.
- The band stability requirement, as a number, stated before any sweep runs.
- The tie break, unchanged in substance from round 3: hybrid needs both a lexical index and an
  embedding index, and the embedding index goes stale whenever the catalog changes, while lexical
  needs neither. A tie on quality is broken in favour of the arm that cannot go stale.
- A stopping ceiling, in waves and in dollars, so the round can actually end.
- **A power table written up front**, stating which comparisons 424 moves can and cannot resolve,
  so no result gets spun after the fact. The table must name the known-wrong-pick comparison as
  resolvable and the top two fusion weights as not resolvable.
- The cross-model clause: what counts as reproduction, and what happens when the two models
  disagree. Disagreement is reported as disagreement and is not resolved by picking the friendlier
  model.

## Statistics, carried forward and not forked

`round3/stats.py` stays the single owner of every interval in rounds 2, 3 and 4.
`round2/build_report2.py` already imports it. It provides cluster-robust sandwich intervals, the
design effect, icc and n_eff diagnostic, the rule-of-three fallback for a constant column, and
clipping of rate intervals to the range a rate can occupy. Round 4 reuses it and does not fork it.

One thing does change, and it is a design decision rather than a code change: with multi-target
gold, `best[0]` is no longer a well defined cluster key. The clustering key becomes the sorted
tuple of the acceptable set, so briefs answered by the same near-twin family land in one cluster.
That is the honest key: two briefs whose right answers are the same pair of moves are correlated
in exactly the way clustering exists to absorb.

The hard ceiling is unchanged. With one brief per move the effective n cannot exceed the number
of distinct clusters, so 424 remains the absolute cap on independent observations, and merging
near twins into shared clusters can only push it below 424, never above.

## Comparability warning, stated once and repeated in the verdict

Multi-target gold changes what recall means. A brief counts as a hit when **any** acceptable move
is shown, so round 4 recall numbers are structurally higher than round 3 recall numbers and the
two are **not comparable as levels**. What is comparable is the shape: which arm leads, over which
band, by how much. The verdict must say this in its own words rather than printing the two rounds
side by side.

## Cost model, and why the dry runs are still mandatory

Round 3 measured $7.02 for 546 runs at k=80, which is $0.0129 per run. Per-run cost scales with
the shown list, so a k=150 cell costs materially more than a k=10 cell, and a projection built by
multiplying the k=80 rate by run count will understate the top of the band.

Rough scale, to be replaced by measured dry runs before anything paid executes:

| step                         | size                                   | estimate                     |
| ---------------------------- | -------------------------------------- | ---------------------------- |
| generation, 424 moves        | 4 attempts per move, bounded by count  | $2.74 to $10.96, measured    |
| gold committee, multi-target | 424 briefs, reads all 424 entries each | around $55, scales with size |
| embeddings                   | 424 entries plus briefs                | around $0.0014, measured     |
| offline sweep and report     | no model call                          | free                         |
| paid confirmation, model A   | 2 arms x 4 ks x 424 briefs = 3392 runs | $45 to $90                   |
| paid confirmation, model B   | same grid                              | provider dependent           |

Order of magnitude for the round is low hundreds of dollars, well inside a waived budget. **A
waived budget is not a reason to run unpriced.** Every paid step runs `EVAL_DRY_RUN=1` first and
its projection is read before the real call. Every paid step carries `EVAL_MAX_USD` as a hard
ceiling that stops the run before its first read when the projection exceeds it and stops it mid
run once actual spend reaches it. The kill switch and per-brief checkpointing carry forward
unchanged from rounds 2 and 3.

Round ceiling: `$400`, split per step, with the split written into `round4/RUNBOOK.md`.

## Implementation units

Execution is delegated to **Claude subagents via the Agent tool with `isolation: "worktree"`**,
not to codex-exec. This is deliberate and overrides the usual global convention for this work.

### U1: Pre-register the round 4 decision rule

- **Goal**: `round4/DECISION-RULE.md` exists and is committed before any round 4 number, carrying
  the ranking rule, the band stability number, the tie break, the stopping ceiling, the up-front
  power table, and the cross-model clause.
- **Files**: create `evals/catalog-retrieval/round4/DECISION-RULE.md`.
- **Approach**: follow `round3/DECISION-RULE.md`, including its machine-readable JSON block, so
  the sweep reads its branch from the file rather than from code. Add keys for the band width
  requirement, the model list, and the reproduction clause.
- **Patterns to follow**: `round3/DECISION-RULE.md` end to end.
- **Test scenarios**: a test asserts the JSON block parses, that the sweep's branch constants come
  from it and not from a literal in `sweep.py`, and that the power table names both the resolvable
  and the unresolvable comparison.
- **Verification**: `git merge-base --is-ancestor` from this commit to every later result commit
  succeeds.
- **Depends on**: nothing. Must be first.

### U2: Multi-target gold, end to end

- **Goal**: `best` becomes a set of acceptable moves everywhere it is read, and a near twin brief
  is scored rather than excluded.
- **Files**: modify `round2/validate_gold.py` (committee emits a set and reports agreement on the
  scored corpus), `round3/recall.py` (a hit is any acceptable move shown), `round3/confirm3.py`
  (fit and known-wrong-pick evaluated against the set), `round3/sweep.py` and
  `round3/prune_corpus.py` (near twins are merged into one gold record, not dropped). Tests:
  `round3/test_recall.py`, `round3/test_confirm3.py`, `round3/test_sweep.py`, and a new
  `round2/test_validate_gold_multitarget.py`.
- **Approach**: keep the on-disk gold schema backward readable so round 3's fixtures still load
  and round 3's published numbers still reproduce. A single-element set must behave exactly as
  round 3's scalar did.
- **Patterns to follow**: the existing gold record shape in `round3/corpus/`, and the round 3
  test convention of reproducing a published number from a committed fixture.
- **Test scenarios**: single-target gold reproduces round 3's numbers byte for byte; a two-target
  brief counts as a hit when either move is shown and as a miss when neither is; the cluster key
  is the sorted tuple, so two briefs over the same pair share a cluster; a `bad` move that is also
  in `best` is a schema error and fails loudly rather than scoring both ways; the known-wrong-pick
  metric never counts an acceptable move as wrong.
- **Verification**: the full round 2 and round 3 suites pass, and the round 3 verdict numbers
  regenerate unchanged from the round 3 corpus.
- **Depends on**: U1.

### U3: Full shelf generation, all 424 moves

- **Goal**: a wave covers every shelf move, and near twins are detected and recorded as
  multi-target gold instead of being pruned away.
- **Files**: modify `round2/gen_briefs.py` (wave allocation to full shelf coverage, bias gates
  unchanged), `round3/prune_corpus.py` (exclusion path becomes a merge path). Tests:
  `round2/test_gen_briefs.py`, `round3/test_prune_corpus.py`.
- **Approach**: keep the existing attempt-counting resumability, which counts attempts rather than
  acceptances from `attempts.jsonl`, so a partial failure resumes without backfilling a rejected
  move.
- **Test scenarios**: allocation emits exactly 424 targets on a full shelf; a rerun after partial
  failure emits only unreached moves; a near twin pair produces one gold record with two
  acceptable moves; a brief that no committee member can place still fails, and the failure is
  counted and reported rather than silently dropped.
- **Verification**: `EVAL_DRY_RUN=1` reports 424 targets and a priced floor and ceiling.
- **Depends on**: U2.

### U4: Sweep with a band stability test

- **Goal**: the sweep reports not just where the leader separates but whether it separates over a
  contiguous band wide enough to satisfy the pre-registered requirement.
- **Files**: modify `round3/sweep.py`, `round3/build_report3.py` or a new
  `round4/build_report4.py`. Tests: `round3/test_sweep.py`, plus report tests.
- **Approach**: read the band width requirement from U1's JSON block. Report the contiguous
  separated run, its width, and whether it clears the requirement, as three separate fields.
- **Test scenarios**: a synthetic sweep that separates at one isolated k fails the band test; one
  that separates over a contiguous run at or above the requirement passes; a sweep that separates
  in two disjoint short runs reports both and passes only if one of them clears the requirement on
  its own.
- **Verification**: the free sweep runs on the round 4 corpus and its report names the stop
  reason, the outcome, the band, and the convergence point.
- **Depends on**: U2.

### U5: A second chat model family

- **Goal**: the paid stage can run the identical grid against a second model family, with exactly
  one variable different between the two runs.
- **Files**: modify `round2/provider.py` (a second chat backend behind the existing
  `validate_model` entitlement probe), `round2/run2.py` (model becomes a cell variable). Tests:
  `round2/test_provider.py`.
- **Approach**: the current chat path is Vertex only, at `CHAT_MODEL = "gemini-3.6-flash"` via
  `_vertex_auth()`. The second family is constrained to credentials already present on devbox.
  `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are both present in the dev environment, confirmed by a
  read-only name listing, so **no Infisical write is required**. Infisical stays read only.
- **Test scenarios**: `validate_model` refuses to start on unparseable credentials and on a model
  the account is not entitled to, for the new backend as well as the old; a cell label carries the
  model so two models never merge into one cell; the dry run prices each model separately, since
  their token prices differ.
- **Verification**: the entitlement probe makes one single-digit-token call and returns silently
  on devbox.
- **Depends on**: U1.

### U6: Multi-k, multi-model paid confirmation

- **Goal**: the end to end claim is confirmed at several list lengths and on both models.
- **Files**: modify `round3/confirm3.py` and the report builder to accept a grid of cells rather
  than a pair. Tests: `round3/test_confirm3.py`.
- **Approach**: cells are `(arm, k, model)`. The comparison stays paired on the same briefs and
  never becomes a difference of two column means. Exactly one variable changes between any two
  compared cells, so an arm comparison holds k and model fixed, and a model comparison holds arm
  and k fixed.
- **Test scenarios**: cells differing in two variables are refused rather than compared; a cell
  that never ran pairs against nothing rather than reporting an even result; a brief missing from
  one cell is excluded from that pairing and from no other.
- **Verification**: dry run prices the full grid before anything paid runs.
- **Depends on**: U4, U5.

### U7: Runbook, execution, verdict and report

- **Goal**: `round4/RUNBOOK.md` with the per-step dollar split, then the executed round, then
  `round4/VERDICT.md` and the report HTML.
- **Files**: create `evals/catalog-retrieval/round4/RUNBOOK.md`, `round4/VERDICT.md`, and the
  round 4 report output.
- **Approach**: mirror `round3/RUNBOOK.md`, including its corpus root discipline. Round 4 writes
  its own `EVAL_CORPUS_ROOT` and must not generate over round 2's or round 3's, because both are
  the fixtures that reproduce their own published numbers.
- **Test scenarios**: the report builder is tested on a synthetic summary, as in round 3.
- **Verification**: zero em-dashes in every rendered document, confirmed by a count returning 0;
  the report HTML reflects the committed summary JSON; the verdict names which stop reason fired.
- **Depends on**: U3, U6.

## Execution and safety constraints, all standing

- The eval is **never executed by the agent session**. Every paid step runs on devbox.
- Secrets stay on devbox, read from the environment at call time via `infisical run --env=dev`.
  Never written to a file, never echoed, never placed in an HTTP header without first confirming
  the value is a single line ASCII token.
- **Infisical is read only.** No step in this round runs any Infisical write command. Listing
  names and injecting values are the only permitted uses.
- Stealth: no pull requests and no issues. Pushing code to `origin feat-video-primitives` for
  backup is allowed.
- Never modify the main checkout. Every unit works in an isolated worktree.
- No AI attribution anywhere, in any commit, document or comment.
- No em-dashes in any rendered document or HTML, verified by a count returning 0.

## Honesty properties carried forward unchanged

- `mountable` and `fit` stay separate numbers and are never collapsed into one score.
- Scoring stays mechanical, in `gate2.py`. No model judges a model.
- Naming the whole shelf still scores 0.0.
- Exactly one variable changes between cells.
- The gate regressions from rounds 1, 2 and 3 keep passing.

## Deferred to implementation

- The exact list lengths for U6's paid grid come from U4's band, which does not exist yet. The
  runbook records them at execution time rather than guessing here.
- The second model family's specific model id is chosen at U5 against whatever the devbox
  credentials are actually entitled to, proven by the entitlement probe rather than by the
  credential's name.
- Whether the near-twin merge is driven by committee disagreement alone or also by an embedding
  similarity threshold is a U3 implementation call. Committee disagreement is the honest primary
  signal, since it is what surfaced the problem.

## A note on where this document lives

The ce-plan convention is `docs/plans/`. That directory does not exist in this worktree, and this
eval's own established convention is to commit the round's governing documents beside the round's
code, as `round3/DECISION-RULE.md` and `round3/RUNBOOK.md` already do. This plan follows the local
convention rather than the global one, so that everything a reader needs to judge round 4 sits in
one directory.
