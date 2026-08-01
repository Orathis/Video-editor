# Round 4, wave 1 runbook

Wave 1 is 424 briefs, one per catalog move, so the corpus covers the whole shelf. Every step
below runs on devbox. None of it runs from a laptop or an agent session.

The rule this round is judged by was committed at `e96b4e1ff` and is an ancestor of every commit
here, so nothing below can have been fitted to a result it has already seen.

```
git merge-base --is-ancestor e96b4e1ff <any result commit>
```

## Ceiling and its split

Round ceiling `$400`, from the rule's `max_usd`. Split per step, each enforced by `EVAL_MAX_USD`
on that step's own command:

| step                       | ceiling | basis                                                    |
| -------------------------- | ------- | -------------------------------------------------------- |
| 1, generation              | $15     | measured dry run floor $2.739314, ceiling $10.957256     |
| 2, gold committee          | $90     | round 3 priced $55.22 at the same 424 briefs             |
| 3, embeddings              | $1      | round 2 measured $0.0014 for the shelf plus briefs       |
| 5, confirmation on model A | $150    | scaled from a measured dry run, see step 5               |
| 6, confirmation on model B | $60     | luna prices at roughly a seventh of model A per run      |
| reserve                    | $84     | unspent unless a step's own dry run comes in over budget |

A step whose dry run projects above its row does not get run. It gets re-priced and the new
figure gets read before anything is spent.

## Before anything

```
git fetch origin && git checkout feat-video-primitives && git pull --ff-only
cd evals/catalog-retrieval/round2
```

Secrets stay on devbox and are read from the environment at call time. Every paid command is
prefixed with `infisical run --env=dev --`, which injects them for that process only. Nothing
below writes a secret to a file or echoes one. **Infisical is read only: no step here sets a
value.**

Three credentials are in play. The chat path for model A wants a Vertex service account, the
chat path for model B reads the OpenAI key, and the embedding path reads the same OpenAI key.

`GOOGLE_SERVICE_ACCOUNT_JSON` is not in the dev environment, so `GEMINI_SERVICE_ACCOUNT_ENV` has
to name whichever variable holds a Vertex service account. `GOOGLE_SERVICE_ACCOUNT_INFO` is the
one that works, proven by the probe rather than by its name.

Both probes make one single-digit-token call and are the only honest test of entitlement:

```
infisical run --env=dev --silent -- env GEMINI_SERVICE_ACCOUNT_ENV=GOOGLE_SERVICE_ACCOUNT_INFO \
    python3 -c "import provider; provider.validate_model(provider.CHAT_MODEL)"
infisical run --env=dev --silent -- python3 -c \
    "import provider; provider.validate_model(provider.OPENAI_CHAT_MODEL)"
```

Silence and exit 0 mean entitled. Both were green on 2026-08-01.

`ANTHROPIC_API_KEY` is present in the dev environment and is **dead**: well formed, 108 ASCII
characters with the expected prefix, and the API answers HTTP 401 `authentication_error`. The
Anthropic backend in `provider.py` is written and tested and will work the moment a valid key
exists, but it is not model B for this round. Replacing that key needs a human, because Infisical
is read only here.

## The confound, read before approving any model B spend

`gpt-5.6-luna` rejects `temperature: 0` with HTTP 400 and samples only at its default of 1.
Rounds 2 and 3 ran every paid cell at temperature 0. **A model B cell therefore differs from its
model A twin in two variables, the model and the sampling temperature.** The round's one-variable
property does not hold across the two families, and no code can fix it. The dry run prints this,
the confirmation output carries it, and the verdict must state it rather than reporting a clean
reproduction.

## The corpus root

Round 4 writes its own corpus and must not generate over round 2's or round 3's. Both are the
committed fixtures that reproduce their own published numbers, so overwriting either destroys the
ability to check the statistics at all.

Every step below exports one variable, and the generator, the committee, the pruner, the embedder
and the sweep all derive their paths from it:

```
export EVAL_CORPUS_ROOT="$PWD/../round4/corpus"
```

The shelf is deliberately not under that root. Every round retrieves from the same 424 entries,
and that sameness is the comparison.

## Step 1, generation. $2.74 to $10.96

Dry run first. It makes no call and needs no key.

```
EVAL_DRY_RUN=1 BRIEF_WAVE=1 python3 gen_briefs.py
```

Expect 424 targets, floor $2.739314, ceiling $10.957256. If the target count is not 424, stop:
the catalog moved and the wave allocation is no longer one brief per move.

```
infisical run --env=dev --silent -- env BRIEF_WAVE=1 \
    GEMINI_SERVICE_ACCOUNT_ENV=GOOGLE_SERVICE_ACCOUNT_INFO python3 gen_briefs.py
```

Known limit, stated rather than fixed: generation has no dollar meter. Its spend is bounded by
construction instead, at four attempts per move by 424 moves, which is where the $10.96 ceiling
comes from. That bound holds on call count, not on tokens per call, so a pathological run of very
long completions could exceed it. Watch the first few and stop by hand if the output size looks
wrong.

Resumability is real: allocation counts attempts, not acceptances, from `attempts.jsonl`. A rerun
after a partial failure emits only the moves never reached, and never backfills a move the gates
rejected.

## Step 2, gold committee. Around $55

This is where round 4 differs from round 3 in kind and not just in size. The committee still
reads blind, but a brief the committee places on a near twin of the constructed move now produces
a **set** of acceptable moves instead of being excluded. The floor is applied to the scored
corpus agreement, not to the strict reconstruction rate, and both numbers are printed and written
into the audit.

Dry run first, at the wave 1 corpus.

```
EVAL_DRY_RUN=1 python3 validate_gold.py
```

Confirm the sampled brief count is 424 and read the projection before spending.

```
infisical run --env=dev --silent -- env EVAL_MAX_USD=90 \
    GEMINI_SERVICE_ACCOUNT_ENV=GOOGLE_SERVICE_ACCOUNT_INFO python3 validate_gold.py
```

The ceiling stops the run before its first read if the projection exceeds it, and stops it mid run
once actual spend reaches it. Checkpointed per brief, so a stopped run resumes without re-reading
what it already judged.

Then merge the near twins into gold rather than excluding them:

```
python3 prune_corpus.py --merge
```

Read the audit afterwards. Three numbers decide whether the corpus is trustworthy: the scored
corpus agreement, which gates; the strict reconstruction rate, which does not gate and exists so a
merge stays visible; and the contested and unplaceable counts, which are failures under the floor.

## Step 3, embeddings. About $0.0014

The semantic and hybrid arms cannot be swept without these, and `vectors.json` is gitignored, so
it exists only where it was built.

```
infisical run --env=dev -- python3 embed2.py
```

## Step 4, the sweep and the report. Free

No model call, no network, no spend. This is the step that ranks the arms and decides the list
lengths step 5 buys.

```
cd ../round3
KS=$(python3 -c "print(','.join(str(k) for k in [5]+list(range(10,421,10))+[423]))")
python3 sweep.py --corpus ../round4/corpus/briefs --gold ../round4/corpus/gold \
    --vectors ../round4/corpus/vectors.json --rule ../round4/DECISION-RULE.md --ks "$KS"
cd ../round4
python3 build_report4.py
```

The 44 value grid is the same one round 3 used, so the two rounds' band shapes are comparable
even though their recall levels are not.

Four things decide what happens next and the report names all four: the stop reason, the rule
outcome, the band with its width and whether it clears the required 5, and the convergence point.

- Band clears: an arm won on measurement over a wide enough run of list lengths. Go to step 5.
- Band does not clear: **stop buying data.** Step 3 of the rule breaks the tie on operations, in
  favour of lexical, which needs no embedding index and so cannot serve stale vectors. Go to step
  5 to confirm, not to break the tie.
- `converged` true: the arms meet at large k. That is expected and is not a failure. It is the
  arithmetic of a 424 entry shelf, and the report says where a longer list stops paying for its
  tokens.

If the report says `not-evaluable`, an arm family failed to load. Fix that before reading anything
else; a ranking with one family in it is not a ranking.

## Step 5, paid confirmation on model A. Around $90 at wave 1

Only the top two arms, and only for the two quantities recall cannot see: the refusal rate, and
the known-wrong-pick rate that drives the flat 0.5 fit penalty.

Round 4 buys **four list lengths, not one**: the two ends and the middle of the separated band,
plus one outside it where the rule predicts a tie. The outside point is not padding. A
confirmation that only ever runs where the answer is expected is not a test.

Substitute the band step 4 actually reports. The `c@10,h@10,c@80,h@80,c@150,h@150,c@200,h@200`
below stands in for two arms at four list lengths and must not be carried over unread.

```
cd ../round2
EVAL_CORPUS_ROOT=../round4/corpus EVAL_DRY_RUN=1 \
    EVAL_MODELS=gemini-3.6-flash,gpt-5.6-luna \
    EVAL_CELLS="c@10,h@10,c@80,h@80,c@150,h@150,c@200,h@200" python3 run2.py
```

That prices both models in one read, per family and as a grand total, and it is what gets approved
before anything is spent. A measured comparison at 273 briefs on the lexical arm alone came in at
$18.402607 for model A and $2.628401 for model B, so the full two arm grid at 424 briefs is
expected near $90 and $13. Read the real projection, not this sentence.

Then run model A alone. **The paid runner is single model on purpose**: the checkpoint key carries
the model, so two sequential passes fill one file without colliding, and a multi-model paid
invocation is refused rather than silently running one of them.

```
infisical run --env=dev --silent -- env EVAL_CORPUS_ROOT=../round4/corpus \
    EVAL_MODEL=gemini-3.6-flash EVAL_MAX_USD=150 \
    EVAL_CELLS="c@10,h@10,c@80,h@80,c@150,h@150,c@200,h@200" \
    GEMINI_SERVICE_ACCOUNT_ENV=GOOGLE_SERVICE_ACCOUNT_INFO python3 run2.py
```

## Step 6, reproduction on model B. Around $13 at wave 1

The same grid, the same corpus, the same cells, one variable changed. Plus the temperature, which
cannot be held fixed and is recorded as a confound.

```
infisical run --env=dev --silent -- env EVAL_CORPUS_ROOT=../round4/corpus \
    EVAL_MODEL=gpt-5.6-luna EVAL_MAX_USD=60 \
    EVAL_CELLS="c@10,h@10,c@80,h@80,c@150,h@150,c@200,h@200" python3 run2.py
```

Reproduction means the same leading family and bands overlapping by at least 5 contiguous list
lengths. **Disagreement is reported as disagreement.** It is not resolved by picking the model
that agrees with round 3, and it is not resolved by averaging the two. If the models disagree, the
finding is that round 3's result was a property of that model rather than of the retriever, and
that finding is the round's answer. It ships nothing.

If the confirmation contradicts the recall ranking, record it as a contradiction. Do not resolve it
quietly in either direction and do not reopen step 2 of the rule.

## Step 7, the verdict

Fill in `round4/VERDICT.md`. Replace every absent number with the measured value and its clustered
interval, name which of the three stop reasons fired, and state all four legs of the definition of
done and whether each one held.

Three things must be said plainly whatever the numbers do:

- **The shelf holds 424 entries**, so no corpus size ever buys more than 424 independent things to
  be right about, and all arms must converge as k approaches the shelf size. If the arms did not
  separate, the honest recommendation is a larger catalog, not a larger corpus.
- **Round 4 recall is not comparable to round 3 recall as a level**, because a hit now means any
  acceptable move was shown. The band shape is comparable; the numbers are not.
- **The two models differ in sampling temperature as well as in model.** Say it in the verdict, not
  only in the code.

## What is fixed and must not change while this runs

- `mountable` and `fit` stay separate numbers and are never collapsed into one score.
- Scoring stays mechanical, in `gate2.py`. No model judges a model.
- Naming the whole shelf still scores 0.0.
- Exactly one variable changes between compared cells, and a pairing that would change two is
  refused rather than computed.
- The gate regressions carried forward from rounds 1, 2 and 3 keep passing.
