# Round 3, wave 1 runbook

Approved: wave 1, 424 briefs, one brief per catalog move, interactive tier, ceiling $90.
Projected $63.79 to $84.27. Every step below runs on devbox. None of it runs from a laptop
or an agent session.

The rule this round is judged by was committed at `1a4378737` and is an ancestor of every
commit here, so nothing below can have been fitted to a result it has already seen.

## Before anything

```
git fetch origin && git checkout feat-video-primitives && git pull --ff-only
cd evals/catalog-retrieval/round2
```

Secrets stay on devbox and are read from the environment at call time. Every paid command is
prefixed with `infisical run --env=dev --`, which injects them for that process only. Nothing
below writes a secret to a file or echoes one. Infisical is read only: no step here sets a
value.

Two keys are used, by name only: the chat path reads `GOOGLE_SERVICE_ACCOUNT_JSON` (override
the name with `GEMINI_SERVICE_ACCOUNT_ENV` if this installation stores it elsewhere), and the
embedding path reads the OpenAI key.

## Step 1, generation. $2.74 to $10.96

Dry run first. It makes no call and needs no key.

```
EVAL_DRY_RUN=1 BRIEF_WAVE=1 python3 gen_briefs.py
```

Expect 424 targets, floor $2.739314, ceiling $10.957256. If the target count is not 424, stop:
the catalog moved and the wave allocation is no longer one brief per move.

Then the real run.

```
infisical run --env=dev -- env BRIEF_WAVE=1 python3 gen_briefs.py
```

Known limit, stated rather than fixed: generation has no dollar meter. Its spend is bounded by
construction instead, at four attempts per move by 424 moves, which is where the $10.96 ceiling
comes from. That bound holds on call count, not on tokens per call, so a pathological run of
very long completions could exceed it. Watch the first few and stop by hand if the output size
looks wrong.

Resumability is real: allocation counts attempts, not acceptances, from `attempts.jsonl`. A
rerun after a partial failure emits only the moves never reached, and never backfills a move the
gates rejected.

## Step 2, gold committee. $55.22

Dry run first, at the wave 1 corpus.

```
EVAL_DRY_RUN=1 python3 validate_gold.py
```

Confirm the sampled brief count is 424 and the projection is near $55.22 before spending. It
prices only the tier it can charge; there is a half price batch row in the price table that
nothing submits to, so no projection quotes it.

```
infisical run --env=dev -- env EVAL_MAX_USD=90 python3 validate_gold.py
```

The ceiling stops the run before its first read if the projection exceeds it, and stops mid run
once actual spend reaches it. Checkpointed per brief, so a stopped run resumes without
re-reading what it already judged.

## Step 3, embeddings. About $0.0014

The semantic and hybrid arms cannot be swept without these, and `vectors.json` is gitignored, so
it exists only where it was built.

```
infisical run --env=dev -- python3 embed2.py
```

## Step 4, the sweep and the report. Free

No model call, no network, no spend. This is the step that actually ranks the arms.

```
cd ../round3
python3 sweep.py
python3 build_report3.py --waves 1
```

Read `report3.html` below the fold. Three things decide what happens next, and the report names
all three: the stop reason, the rule outcome, and whether the arms converged.

- Outcome `separated`: an arm won on measurement. Go to step 5 with that arm and the runner-up.
- Outcome `tie`: the arms did not separate. **Stop buying data.** Step 3 of the rule breaks the
  tie on operations, in favour of lexical, which needs no embedding index and so cannot serve
  stale vectors. Go to step 5 to confirm, not to break the tie.
- `converged` true: the arms meet at large k. The finding is that the question was what k, not
  which arm, and the knee table says where a longer list stops paying for its tokens.

If the report says `not-evaluable`, an arm family failed to load. Fix that before reading
anything else; a ranking with one family in it is not a ranking.

## Step 5, paid confirmation. About $6 to $8

Only the top two arms, only for the two quantities recall cannot see: the refusal rate and the
known-wrong-pick rate that drives the flat 0.5 fit penalty.

`EVAL_CELLS` names them. Without it the runner does the whole nine cell grid, which at wave 1
size costs roughly five times a two arm confirmation and is a second full round rather than a
check on the first. Substitute the two arms the step 4 report actually ranked.

```
cd ../round2
EVAL_CELLS="h@10,d@20" EVAL_DRY_RUN=1 python3 run2.py
```

The dry run prices the exact pair, so read its total before spending; the range above is an
estimate and the pair is not known until step 4 finishes. Then:

```
infisical run --env=dev -- env EVAL_CELLS="h@10,d@20" EVAL_MAX_USD=90 python3 run2.py
```

If the confirmation contradicts the recall ranking, record it as a contradiction. Do not resolve
it quietly in either direction and do not reopen step 2 of the rule.

## Step 6, the verdict

Fill in `round3/VERDICT.md`. It currently lists eleven absent numbers, each beside the file that
produces it. Replace each one with the measured value and its clustered interval, then change
the status line from pending and name which of the three stop reasons fired.

State the ceiling plainly whatever happens: the shelf holds 424 entries, so no corpus size ever
buys more than 424 independent things to be right about. If the arms did not separate, the
honest recommendation is a larger catalog, not a larger corpus.

## What is fixed and must not change while this runs

- `mountable` and `fit` stay separate numbers and are never collapsed into one score.
- Scoring stays mechanical. No model judges a model.
- Naming the whole shelf still scores 0.0.
- Exactly one variable changes between cells.
- The gate regressions carried forward from rounds 1 and 2 keep passing.
