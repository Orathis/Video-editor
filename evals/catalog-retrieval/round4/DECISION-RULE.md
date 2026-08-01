# Round 4 decision rule, pre-registered

This file is written and committed **before any round 4 number exists**. A rule chosen after
seeing the numbers is a description of the numbers, not a decision procedure. The commit that adds
this file must be an ancestor of every commit that produces a round 4 result, and that is
checkable:

```
git merge-base --is-ancestor <this commit> <any result commit>
```

## What is being decided

One shippable **(arm, k)** operating point for the frame worker default, and whether that point
survives a second model family. The arms are unchanged from round 3:

| arm      | how it retrieves                  | what it needs at run time                            |
| -------- | --------------------------------- | ---------------------------------------------------- |
| lexical  | term overlap against the shelf    | nothing, the shelf itself                            |
| semantic | cosine over embedded entries      | an embedding index, rebuilt when the catalog changes |
| hybrid   | reciprocal rank fusion of the two | both indexes, and the same rebuild                   |

Hybrid runs at `w=0.5` as its representative. Round 3 established that the two leading fusion
weights are genuinely k dependent, not under-measured, so round 4 records the other weights in the
sweep and lets none of them decide anything.

## What changed from round 3, and what it costs in comparability

Gold is now a **set**. `best` is every shelf move that genuinely answers the beat, so a brief whose
beat has two right answers is scored fairly instead of excluded. This is the fix for round 3's
real defect: 363 briefs were generated and only 273 survived a blind committee, 75.21 percent,
below the pre-registered 95 percent floor, and the 90 that were dropped were exactly the hard
retrieval cases.

The cost of the fix is that a hit now means **any** acceptable move was shown. Round 4 recall
numbers are therefore structurally higher than round 3's and the two rounds are **not comparable
as levels**. What is comparable is the shape: which arm leads, over which band, by how much. Every
report and the verdict must say this rather than printing the two rounds side by side.

## Clustering

Round 3 clustered on `best[0]`. With a set, that key is no longer well defined. The round 4
clustering key is the **sorted tuple of the acceptable set**, so two briefs whose right answers are
the same near twin family land in one cluster. That is the honest key: those briefs are correlated
in exactly the way clustering exists to absorb.

`round3/stats.py` remains the single owner of every interval in rounds 2, 3 and 4. It is reused,
not forked.

## The rule

**1. Rank on offline recall** over the round 4 corpus, with every interval clustered by the key
above.

**2. The leader ships only if it clears the runner up by more than the clustered 95 percent
interval of the paired difference, and does so across a contiguous run of at least 5 list lengths
in the k grid.** The comparison is paired on the same briefs, never a difference of two column
means. A single separated k is not a result: round 3 separated over 15 contiguous list lengths, so
5 is a floor that is achievable and still meaningful.

**3. If nothing clears the band requirement, stop buying data.** Break the tie on operations, not
on the larger number. Hybrid and semantic need an embedding index that must be rebuilt whenever
the catalog changes, which is a standing maintenance obligation and a standing chance of serving
stale vectors. Lexical needs neither and cannot go stale. **A tie on quality is broken in favour of
the arm that cannot go stale.**

**4. Confirm end to end at several list lengths**, not one: at the two ends and the middle of the
separated band, plus at least one list length outside it where the rule predicts a tie. A
confirmation that only ever runs where the answer is expected is not a test.

**5. Reproduce on a second model family**, on the same grid, with exactly one variable different
between a model A cell and its model B twin.

**If the confirmation contradicts the recall ranking, that is reported as a contradiction.** It is
not quietly resolved in either direction, and it is not used to reopen step 2.

## The cross-model clause

Reproduction means both of these on the second model:

- the same arm leads, and
- its separated band overlaps model A's band by at least 5 contiguous list lengths.

**Disagreement is reported as disagreement.** It is not resolved by picking the model that agrees
with round 3, and it is not resolved by averaging the two. If the two models disagree, the finding
is that the round 3 result was a property of that model and not of the retriever, and that finding
is the round's answer. It ships nothing.

## Power table, written before any round 4 number exists

Scaled from round 3's measured half widths at 273 clusters by the square root of the cluster ratio.
Round 4 targets 424 clusters, one per shelf move, but **near twin merging can only reduce that
count**, and the table says where that matters.

| comparison                          | round 3 half width | at 424 clusters | resolvable                                     |
| ----------------------------------- | ------------------ | --------------- | ---------------------------------------------- |
| recall, leader vs runner up in band | up to 0.0300       | about 0.0241    | yes, comfortably                               |
| end to end fit                      | 0.0531             | about 0.0426    | yes, the observed gap is 0.1081                |
| end to end pass rate                | 0.0597             | about 0.0479    | yes, the observed gap is 0.1172                |
| known-wrong-pick                    | 0.0374             | about 0.0300    | marginal, gap is 0.0330; fails below about 351 |
| refusal rate                        | rule of three      | 3/424 = 0.0071  | as a bound only, never as an exact zero        |
| mountable rate                      | rule of three      | bounded 0.9929  | as a bound only, never as an exact one         |
| top two fusion weights              | not a power issue  | unchanged       | **no**, the difference flips sign across k     |
| cross-model fit difference          | derived            | about 0.0426    | only differences larger than that              |

Two entries in that table are commitments, not observations. The known-wrong-pick comparison is
**marginal by design**: if near twin merging drops the cluster count below about 351, it stops
being resolvable and the verdict says so instead of reporting a gap that the interval does not
support. And a cross-model fit difference smaller than about 0.0426 is **invisible to this round**,
so "the models agree" always means "they agree to within 0.0426", never "they are identical".

## What no amount of money buys

All arms draw from the same 424 shelf entries, so as k approaches the shelf size every arm shows
every entry and they must converge. That is arithmetic. **No corpus size buys a k independent arm
winner.** The only lever is a larger catalog, which means authoring more primitives, and that is a
product change and out of scope for round 4.

The corpus ceiling follows from the same fact. With one brief per move, the number of distinct
things to be right about is the number of distinct clusters, at most 424 and lower once near twins
merge. Waves beyond the first add replicates inside existing clusters, which shrinks measurement
noise but does not add distinct things to be right about.

## Stopping rule

The corpus grows one brief per move per wave, to a maximum of **2 waves**. After each wave the free
sweep reruns and this rule is evaluated. The round stops at the first of:

- the leader separates under step 2 and reproduces under step 5,
- two waves complete,
- the dollar ceiling is reached.

The verdict states which of the three fired. They are three different verdicts and must not be
reported as one.

## Spending discipline

The budget for this round is waived by the user. **A waived budget is not a reason to run
unpriced.** Every paid step runs `EVAL_DRY_RUN=1` first and its projection is read before the real
call. Every paid step carries `EVAL_MAX_USD`, which stops the run before its first read when the
projection exceeds it and stops it mid run once actual spend reaches it. Checkpointing is per
brief, so a stopped run resumes without re-buying what it already has.

Round ceiling: **$400**, split per step in `round4/RUNBOOK.md`.

## Exploratory tier

A reranker, query expansion, or any other new component is swept and reported, but sits in a
separate exploratory tier and **cannot win this decision**. Both are exactly the kind of stage the
step 3 tiebreak penalises, because they add machinery that goes stale when the catalog changes.

## What is fixed and must not change mid-round

- `mountable` and `fit` stay separate numbers and are never collapsed into one score.
- Scoring stays mechanical. No model judges a model.
- Naming the whole shelf still scores 0.0.
- Exactly one variable changes between cells, and the model is now one of those variables.
- The gate regressions carried forward from rounds 1, 2 and 3 keep passing.
- Round 4 writes its own corpus root. It does not generate over round 2's or round 3's, because
  both are the fixtures that reproduce their own published numbers.

## The same rule, in machine-readable form

`sweep.py` reads this block and drives its branch from it. It restates the prose above and carries
nothing the prose does not already state, so editing this block changes what the sweep decides.
That is the point: a rule the code can only agree with is a rule that was pre-registered.

```json
{
  "confidence": 0.95,
  "decision_tier": ["lexical", "semantic", "hybrid"],
  "hybrid_weight": 0.5,
  "min_separated_band": 5,
  "cluster_key": "sorted_tuple_of_best",
  "tie_break": {
    "prefer": "lexical",
    "because": "needs no embedding index, so it cannot serve stale vectors"
  },
  "reproduction": {
    "models": 2,
    "requires_same_leader": true,
    "min_band_overlap": 5,
    "on_disagreement": "report, ship nothing"
  },
  "max_waves": 2,
  "max_usd": 400,
  "exploratory_tier_can_win": false
}
```
