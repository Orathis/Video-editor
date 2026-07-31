# Round 3 decision rule, pre-registered

This file is written and committed **before any round 3 recall number exists**. A rule chosen
after seeing the numbers is a description of the numbers, not a decision procedure. The commit
that adds this file must be an ancestor of every commit that produces a round 3 result, and that
is checkable:

```
git merge-base --is-ancestor <this commit> <any result commit>
```

## What is being decided

Which catalog retrieval arm ships as the default for the frame workers. The candidates are the
three arms round 2 already ran:

| arm      | how it retrieves                  | what it needs at run time                            |
| -------- | --------------------------------- | ---------------------------------------------------- |
| lexical  | term overlap against the shelf    | nothing, the shelf itself                            |
| semantic | cosine over embedded entries      | an embedding index, rebuilt when the catalog changes |
| hybrid   | reciprocal rank fusion of the two | both indexes, and the same rebuild                   |

Each is swept over list length k and, for hybrid, over fusion weight.

## Why the ranking is done on recall

Round 2 measured, on the same briefs, what happens once the correct move is already on the shown
list. Every arm converts that into a good pick at the same rate:

| comparison                         | briefs where both showed gold | fit difference | t     |
| ---------------------------------- | ----------------------------- | -------------- | ----- |
| hybrid k=10 against semantic k=10  | 69                            | +0.019         | 0.63  |
| lexical k=10 against semantic k=10 | 34                            | +0.015         | 0.28  |
| semantic k=20 against lexical k=20 | 49                            | -0.024         | -0.62 |
| hybrid k=10 against lexical k=10   | 53                            | +0.006         | 0.24  |

The conversion rate across all seven short-list cells sits between 0.774 and 0.872 with no
ordering by arm family. Nothing distinguishes the arms except whether the answer was on the list.

That is a recall question, and recall is computed by the retriever with no model calls. It is the
same measurement, not a cheaper proxy: rerunning the harness's own `lexical_topk` offline
reproduced the paid grid's logged recall with zero disagreements over 227 briefs at k = 5, 10
and 20.

## The rule

**1. Rank on offline recall** over the round 3 corpus, with every interval clustered by target
move rather than by brief. Briefs written for the same move are correlated; round 2's measured
intra-cluster correlation was 0.326 for hybrid k=10 and 0.276 for semantic k=20.

**2. If the leader clears the runner-up by more than the clustered 95 percent interval of the
paired difference, that arm ships.** The comparison is paired on the same briefs, not a
difference of two column means.

**3. If they do not separate, stop buying data.** Break the tie on operations, not on the
larger number. The hybrid and semantic arms need an embedding index that must be rebuilt whenever
the catalog changes, which is a standing maintenance obligation and a standing chance of serving
stale vectors. The lexical arm needs nothing and cannot go stale. **A tie on quality is broken in
favour of the arm that cannot go stale.**

**4. Then run the paid confirmation** on the top two arms only, for the two quantities recall
cannot see: the refusal rate, and the known-wrong-pick rate that drives the flat 0.5 fit penalty.
Round 2 measured refusal at 0.040 for hybrid k=10 and 0.110 for semantic k=5, so this is not a
formality.

**If the confirmation contradicts the recall ranking, that is reported as a contradiction.** It is
not quietly resolved in either direction, and it is not used to reopen step 2.

## Two outcomes that are results, not failures

**The arms may converge at larger k.** Semantic recall runs 0.383 at k=10 and 0.485 at k=20, and
round 2 never looked past k=20. All arms draw from the same 424 entries, so at sufficient k they
must converge. If that is what the sweep shows, the finding is that the real question was **what
k**, not which arm, and the report says so plainly and reports the point where token cost starts
to outrun the recall gain.

**The corpus may never separate them.** The shelf holds 424 entries, so no corpus size ever buys
more than 424 independent things to be right about. If that resolution is insufficient, the
honest recommendation is a larger catalog, not a larger corpus. Step 3 exists so this case ends in
a decision rather than in more spending.

## Exploratory tier

A reranker, query expansion, or any other new component is swept and reported, but sits in a
separate exploratory tier and **cannot win this decision**. Both are exactly the kind of stage the
step 3 tiebreak penalises, because they add machinery that goes stale when the catalog changes.

An exploratory arm that wins is recorded as a follow-up initiative with its measured margin, and
judged on its own later. It is never promoted into the shipped default by this round.

## Stopping rule for corpus growth

The corpus grows one brief per move per wave, to a maximum of five waves. After each wave the free
sweep reruns and this rule is evaluated. The round stops at the first of:

- the leader separates under step 2,
- five waves complete,
- the dollar ceiling is reached.

The verdict states which of the three fired. They are three different verdicts and must not be
reported as one.

## What is fixed and must not change mid-round

- `mountable` and `fit` stay separate numbers and are never collapsed into one score.
- Scoring stays mechanical. No model judges a model.
- Naming the whole shelf still scores 0.0.
- Exactly one variable changes between cells in the paid confirmation.
- The gate regressions carried forward from round 1 and round 2 keep passing.

## The same rule, in machine-readable form

`sweep.py` reads this block and drives its branch from it. It restates the prose above and
carries nothing the prose does not already state, so editing this block changes what the sweep
decides. That is the point: a rule the code can only agree with is a rule that was pre-registered.

```json
{
  "confidence": 0.95,
  "decision_tier": ["lexical", "semantic", "hybrid"],
  "tie_break": {
    "prefer": "lexical",
    "because": "needs no embedding index, so it cannot serve stale vectors"
  },
  "max_waves": 5,
  "exploratory_tier_can_win": false
}
```
