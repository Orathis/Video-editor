# Round 3 verdict, pending

**Status: pending. This document carries no round 3 result number, because none exists yet.**

The paid confirmation stage has not run. Everything below that would need a round 3 measurement
is written as an explicit gap with the file that will fill it, rather than as an estimate, a
placeholder or a plausible-looking number. A verdict written before the data is a description of
an expectation, not a finding.

Round 2 numbers appear here only as context and are labelled as such. They are not round 3
results and must not be read as the ranking.

## What this round decides

Which catalog retrieval arm ships as the default for the frame workers: `lexical`, `semantic`, or
`hybrid` at some fusion weight, each swept over list length k.

Round 3's finding, established before any of this ran, is that the arm choice reduces entirely to
**recall**. Round 2 measured that once the correct move is already on the shown list, every arm
converts it into a good pick at the same rate, between 0.774 and 0.872 with no ordering by arm
family. Nothing distinguishes the arms except whether the answer was on the list. Recall is
decided by the retriever before a single token is bought, so the arm ranking costs nothing and
the paid stage is reduced to the two quantities recall cannot see.

## The pre-registered rule

Written and committed in `DECISION-RULE.md` before any round 3 recall number existed, and read
out of that file by `sweep.py` rather than transcribed into code, so editing the rule changes what
the sweep decides.

1. **Rank on offline recall**, every interval clustered by target move rather than by brief.
2. **If the leader clears the runner-up by more than the clustered 95 percent interval of the
   paired difference, that arm ships.** Paired on the same briefs, not a difference of two column
   means.
3. **If they do not separate, stop buying data.** The tie breaks on operations, not on the larger
   number: in favour of the arm that needs no embedding index and therefore cannot serve stale
   vectors.
4. **Then run the paid confirmation** on the top two arms only, for the two quantities recall
   cannot see: the refusal rate, and the known-wrong-pick rate that drives the flat 0.5 fit
   penalty. If the confirmation contradicts the recall ranking, that is reported as a
   contradiction and is not used to reopen step 2.

The exploratory tier (a reranker, query expansion, anything new) is swept and reported but cannot
win this decision. An exploratory arm that wins is recorded as a follow-up initiative with its
measured margin.

## The three stop reasons

The round stops at the first of three conditions, and they are three different verdicts. The
report names which one fired; it never reports them as one.

| stop reason       | what it means                                                  | how to read the ranking                                                 |
| ----------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `separated`       | the leader cleared the runner-up under step 2                  | an arm won on measurement                                               |
| `waves-exhausted` | all five waves of corpus growth completed without a separation | no arm won; the corpus ran out, and step 3 decides on operations        |
| `ceiling-reached` | the spend ceiling fired before the arms separated              | no arm won; the budget ran out, and the ranking is what the data bought |

A fourth state, `still-running`, means none of the three has fired and the report is an interim
read rather than a verdict. **That is the current state.**

**Which one fired: unknown.** No wave has completed and no round 3 sweep output is committed.
`build_report3.py` computes the stop reason from the sweep outcome, the wave count and the ceiling
flag, and prints it into `report3.html` and `summary3.json`.

## The ceiling this round is bounded by

**The shelf holds 424 entries, so no corpus size ever buys more than 424 independent things to be
right about.** Every arm draws from those same 424 entries. Growing the corpus adds briefs, and
briefs written for the same target move are correlated, which is why every interval in this round
is clustered by move and why the effective sample sits below the brief count. Round 2's own
corpus makes the size of that gap concrete: 227 briefs covering 158 distinct target moves carried
roughly 199 briefs' worth of independent information, not 227. More briefs per move buys less
than it appears to.

The consequence is a hard resolution limit. **If the arms do not separate at 424 entries, the
honest recommendation is a larger catalog, not a larger corpus.** More briefs against the same
shelf cannot manufacture a distinction the shelf does not contain. Step 3 of the rule exists so
that this case ends in a decision rather than in more spending, and the tie then goes to the arm
that needs no embedding index.

The related result, also a result and not a failure: all arms draw from the same 424 entries, so
at sufficient k they must converge. If the sweep shows that, the finding is that the real question
was **what k**, not which arm, and the report says so and names the point where token cost starts
to outrun the recall gain.

## What is missing, and what will fill it

Nothing in this section is estimated. Each row names the artifact that produces the number.

| missing number                                                    | which file produces it                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| recall per arm per k over the round 3 corpus                      | `report3.html` and `summary3.json`, built by `build_report3.py`    |
| the clustered ranking and each arm's best k                       | `report3.html`, ranking table                                      |
| the paired margin between leader and runner-up, with its interval | `report3.html`, paired table                                       |
| whether step 2 separated, tied, or was not evaluable              | `report3.html`, rule outcome line, from `sweep.decide`             |
| which arm ships                                                   | `report3.html`, rule outcome line                                  |
| the knee, where a longer list stops paying for its tokens         | `report3.html`, knee table                                         |
| which of the three stop reasons fired                             | `report3.html`, stop reason line                                   |
| how many waves completed before the round stopped                 | the wave count passed to `build_report3.py`; no wave has completed |
| the refusal rate per arm                                          | the paid confirmation stage, not yet run                           |
| the known-wrong-pick rate per arm                                 | the paid confirmation stage, not yet run                           |
| whether the confirmation contradicts the recall ranking           | this file, once both the sweep and the confirmation exist          |

The two paid quantities are not a formality: round 2 measured refusal at 0.040 for hybrid at k=10
and 0.110 for semantic at k=5. That is a round 2 number, quoted as the reason the stage exists,
not as a round 3 result.

## How to finish this document

1. Run the offline sweep and build the report. Free, local, no model call:
   `python3 build_report3.py --waves <completed waves>` (add `--ceiling-reached` only if the
   spend ceiling actually fired).
2. Read the stop reason, the ranking and the paired margin out of `report3.html` and write them
   into the gaps above, replacing each "unknown" with the measured number and its interval.
3. Run the paid confirmation on the top two arms only, then record the refusal rate and the
   known-wrong-pick rate.
4. If the confirmation contradicts the recall ranking, record it as a contradiction. Do not
   quietly resolve it in either direction and do not reopen step 2.
5. Change the status line at the top of this file from pending to the verdict, and state which of
   the three stop reasons fired.

## What is fixed and must not change while this is completed

- `mountable` and `fit` stay separate numbers and are never collapsed into one score.
- Scoring stays mechanical. No model judges a model.
- Naming the whole shelf still scores 0.0.
- Exactly one variable changes between cells in the paid confirmation.
- The gate regressions carried forward from round 1 and round 2 keep passing.
