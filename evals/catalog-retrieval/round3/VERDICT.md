# Round 3 verdict: the question was what k, not which arm

**Status: complete. The pre-registered rule does not name an arm, because the arm it ships
depends on the list length it is read at. That outcome was written into the rule before any
round 3 number existed, and it is what happened.**

Everything below is measured. Round 2 numbers appear only as labelled context.

## What this round decided

Which catalog retrieval arm ships as the default for the frame workers: `lexical`, `semantic`,
or `hybrid` at some fusion weight, each swept over list length k.

Round 3's premise, established before any of this ran, is that the arm choice reduces entirely
to **recall**. Round 2 measured that once the correct move is already on the shown list, every
arm converts it into a good pick at the same rate, between 0.774 and 0.872 with no ordering by
arm family. Recall is decided by the retriever before a token is bought, so the arm ranking cost
nothing and the paid stage was reduced to the two quantities recall cannot see.

That premise was verified rather than assumed. Rerunning `harness2.lexical_topk` offline
reproduced round 2's paid grid exactly: 0 disagreements over 227 briefs at k=5, 10 and 20.

## The answer

**The rule ships a different family depending on k.**

| list length    | what the rule says        | branch    |
| -------------- | ------------------------- | --------- |
| k=5            | lexical, on the tie break | tie       |
| k=10 to k=150  | hybrid                    | separated |
| k=160 to k=423 | lexical, on the tie break | tie       |

The arms converge completely at k=423, one below the shelf size, where every arm returns the
whole shelf and every recall is 1.0000. They are already indistinguishable well before that:
from k=260 upward, every paired difference between the leader and its nearest rival from another
family is exactly 0.0000.

So there is no single arm to ship, and naming one would be reporting a choice of list length as
a choice of retriever. `DECISION-RULE.md` pre-registered this exact case: all arms draw from the
same 424 entries, so at sufficient k they must converge, and the finding is then what k.

### Where the question is live, hybrid wins

Inside k=10 to k=150 the arms do separate, and hybrid separates. Read at k=10, the shortest list
length at which the rule separates them, the ranking over 273 briefs and 273 target moves is:

| place | arm          | family   | recall | 95% ci           | n eff |
| ----- | ------------ | -------- | ------ | ---------------- | ----- |
| 1     | hybrid@w=0.7 | hybrid   | 0.3810 | 0.3230 to 0.4389 | 273.0 |
| 2     | hybrid@w=0.5 | hybrid   | 0.3663 | 0.3088 to 0.4238 | 273.0 |
| 3     | semantic     | semantic | 0.3150 | 0.2596 to 0.3705 | 273.0 |
| 4     | hybrid@w=0.3 | hybrid   | 0.3004 | 0.2456 to 0.3551 | 273.0 |
| 5     | lexical      | lexical  | 0.2051 | 0.1569 to 0.2533 | 273.0 |

Paired against the leader, brief by brief, so difficulty is held fixed:

| arm          | against      | difference | 95% ci             |
| ------------ | ------------ | ---------- | ------------------ |
| hybrid@w=0.5 | hybrid@w=0.7 | -0.0147    | -0.0580 to 0.0287  |
| semantic     | hybrid@w=0.7 | -0.0659    | -0.1033 to -0.0285 |
| hybrid@w=0.3 | hybrid@w=0.7 | -0.0806    | -0.1357 to -0.0255 |
| lexical      | hybrid@w=0.7 | -0.1758    | -0.2378 to -0.1139 |

k=10 is chosen mechanically, not for effect: among the list lengths that satisfy step 2, the
shortest is the only one defensible on token cost, and being the minimum it cannot have been
picked to widen a margin. Read at the longest comparable k instead, both tables are degenerate.

The three hybrid weights do not separate from each other. `hybrid@w=0.5` sits inside
`hybrid@w=0.7`'s interval, and `hybrid@w=0.3` leads at longer lists. The family separates; the
weight does not.

### Where a longer list stops paying for its tokens

| arm          | knee at k | input tokens per run | recall | 95% ci           |
| ------------ | --------- | -------------------- | ------ | ---------------- |
| hybrid@w=0.3 | 90        | 5888                 | 0.9341 | 0.9044 to 0.9637 |
| hybrid@w=0.5 | 60        | 3999                 | 0.8425 | 0.7990 to 0.8860 |
| hybrid@w=0.7 | 70        | 4628                 | 0.8608 | 0.8195 to 0.9021 |
| lexical      | 110       | 7148                 | 0.8571 | 0.8154 to 0.8989 |
| semantic     | 70        | 4628                 | 0.7802 | 0.7308 to 0.8297 |

The exchange rate is round 2's own: 63.0 input tokens per slot of k, fitted to its cost rows, and
23725 tokens per unit of recall, taken from the full shelf cell.

## The paid confirmation

The two quantities recall cannot see, measured on the model, one variable between the cells: the
retriever. Both cells at k=80, which sits inside the separated band. Condition `h` is
`harness2.hybrid_topk`, proven identical to `sweep.weighted_hybrid(0.5)` with 0 disagreements
over 273 briefs at k=5, 20, 80 and 120, so the paid arm is the arm the sweep ranked. Condition
`c` is lexical.

546 runs over 273 briefs, 3,143,883 tokens, **$7.02** against a $20 ceiling, **0 errors**.

| cell           | refusal | 95% ci           | known-wrong-pick | 95% ci           | mountable | fit    | pass rate |
| -------------- | ------- | ---------------- | ---------------- | ---------------- | --------- | ------ | --------- |
| h@80 (hybrid)  | 0.0000  | 0.0000 to 0.0110 | 0.1648           | 0.1205 to 0.2091 | 1.0000    | 0.6215 | 0.7179    |
| c@80 (lexical) | 0.0000  | 0.0000 to 0.0110 | 0.1319           | 0.0915 to 0.1723 | 1.0000    | 0.5134 | 0.6007    |

Paired brief by brief, hybrid against lexical:

| quantity         | difference | 95% ci            | separated |
| ---------------- | ---------- | ----------------- | --------- |
| refusal          | +0.0000    | -0.0110 to 0.0110 | no        |
| known-wrong-pick | +0.0330    | -0.0044 to 0.0703 | no        |
| mountable        | +0.0000    | -0.0110 to 0.0110 | no        |
| fit              | +0.1081    | 0.0550 to 0.1612  | yes       |
| pass rate        | +0.1172    | 0.0575 to 0.1769  | yes       |

**The confirmation does not contradict the recall ranking.** Hybrid is ahead on fit and on pass
rate, and the interval on both excludes zero. Its known-wrong-pick rate is nominally higher, but
that difference contains zero and is not a separation.

Two things the confirmation settled that the sweep could not:

- **Refusal is a short-list problem, not an arm problem.** At k=80 neither arm ever refused: 0
  of 273 runs, in both cells. That is not a measured rate of exactly zero. Nothing varied, so the
  interval falls back to the rule of three and bounds the rate under 1.1%, which is the most the
  corpus can say. Round 2 measured 0.040 at hybrid k=10 and 0.110 at semantic k=5, both far above
  that bound, so the drop is real even though its floor is not pinned.
- **Every pick resolved to a real shelf move.** Mountable is 1.0000 in both cells, bounded below
  at 0.9890 by the same rule, so the fit gap is a choosing problem and not a naming problem.

### What 546 runs could and could not resolve

The corpus is large enough for the comparison the round was run to make, and not large enough for
one of the two quantities the paid stage bought:

| quantity         | difference | half width | resolved                                     |
| ---------------- | ---------- | ---------- | -------------------------------------------- |
| fit              | +0.1081    | 0.0531     | yes, the margin is twice the half width      |
| pass rate        | +0.1172    | 0.0597     | yes                                          |
| known-wrong-pick | +0.0330    | 0.0374     | no, the margin sits just inside the interval |
| refusal          | +0.0000    | 0.0110     | bounded, not resolved                        |

Resolving the known-wrong-pick gap at its observed size would need about 351 briefs, from
273 x (0.0374 / 0.0330)^2. That is affordable against the 424-entry ceiling, but it would buy one
secondary number and would not change what ships, since fit and pass rate already separate and
point the same way. It is recorded here as a known limit rather than run.

## What actually ships

The rule names no arm, so this is a recommendation read off the measurements, not the rule
shipping something. It is marked as such deliberately.

**Ship hybrid, at a k inside the separated band, with the k chosen at the knee.** The cheapest
defensible point is `hybrid@w=0.5` at k=60: 3999 input tokens per run for 0.8425 recall. If the
extra tokens are affordable, `hybrid@w=0.3` at k=90 buys 0.9341 for 5888.

Two things this recommendation is not:

- It is **not** a claim that hybrid beats lexical at every list length. Outside k=10 to k=150 it
  does not, and above k=160 the rule's own tie break prefers lexical, which needs no embedding
  index and therefore cannot serve stale vectors.
- It is **not** a claim that the fusion weight matters. The three weights never separated from
  each other.

If the operational cost of maintaining an embedding index is judged higher than the fit gap is
worth, lexical at its own knee (k=110, 7148 tokens, 0.8571 recall) is a defensible ship, and the
rule's tie break already points there. That is a cost decision, not a measurement decision, and
the measurement does not make it.

## Which stop reason fired

**None of the three.** `separated`, `waves-exhausted` and `ceiling-reached` all assume the swept
ks agree on an arm. They did not, so the report records a fourth outcome, `k-dependent`, and says
what it means: the rule ships a different family depending on the list length it is read at, so
the round ends on the question the rule pre-registered for this case. Growing the corpus cannot
change it, because every arm draws from the same shelf and so they must converge at sufficient k.

1 wave of 5 ran. The spend ceiling was not reached.

## The caveat that matters most

**The corpus that produced these numbers is easier than the corpus that was generated, and the
briefs removed are exactly the ones where retrieval matters most.**

363 briefs were generated. A blind committee, holding the whole shelf and reading each brief
alone, reconstructed the brief's target move for 273 of them: **75.21% (273/363)**, below the
95.00% floor. The 90 it could not reconstruct describe a beat that two near-twin moves answer
equally well. Those briefs do not have one right answer and cannot score a retrieval arm fairly,
so `prune_corpus.py` moved them, with their gold, into `corpus/excluded/`. Nothing was deleted
and nothing was rewritten, so the drop is auditable and reversible.

`GOLD-AUDIT.md` now reads 100.00% (273/273). **That is 100% by construction, not an independent
pass**: it measures the corpus that was defined as the briefs the committee agreed on. Every
recall number in this document should be read as an upper bound on the generated corpus.

A drop correlated with the thing being measured can manufacture a ranking, so the finding was
re-run on both halves of a blurb-length split, since near-twin moves skew toward thin blurbs. It
survives in both:

| half  | briefs | blurb chars | bands                                                               |
| ----- | ------ | ----------- | ------------------------------------------------------------------- |
| short | 136    | 65 to 202   | lexical at k=5, hybrid k=10 to 90, lexical k=100 to 423             |
| long  | 137    | 203 to 557  | lexical at k=5, hybrid over k=10 to 20, 40, and 70 to 110, else tie |

Both halves reproduce the same shape: a tie at the shortest list, a band where hybrid separates,
a tie again at long lists, and convergence at k=423. The long half is choppier because half the
briefs widen every interval, not because the ordering changed. Blurb length is a proxy for
near-twinness and not the thing itself, so this reduces the concern rather than closing it.

## The ceiling this round is bounded by

**The shelf holds 424 entries, so no corpus size ever buys more than 424 independent things to be
right about.** This round's corpus carries one brief per target move, so for once clustering costs
nothing: 273 briefs over 273 moves gives an intra-cluster correlation of 0.0, a design effect of
1.0, and an effective n of 273.0. Round 2's corpus makes the contrast concrete: 227 briefs over
158 moves carried roughly 199 briefs' worth of information, not 227.

The convergence result is what that ceiling looks like from the inside. It is a result, not a
failure: **if a distinction is wanted between arms at long list lengths, the fix is a larger
catalog, not a larger corpus.** More briefs against the same 424 entries cannot manufacture a
distinction the shelf does not contain.

## What was fixed, and stayed fixed

- `mountable` and `fit` are separate numbers and were never collapsed into one score.
- Scoring stayed mechanical, in `gate2.py`, unchanged. No model judged a model.
- Naming the whole shelf still scores 0.0.
- Exactly one variable changed between the paid cells: the retriever, both at k=80.
- The gate regressions carried forward from round 1 and round 2 still pass. 110 tests in this
  round's directory, 0 failures, and 90 in round 2's.
- No interval claims more certainty than the corpus holds. A column where every cluster landed on
  the same value used to report a width of exactly zero, which is arithmetic rather than evidence;
  it now falls back to the rule of three, and every rate interval is clipped to the range a rate
  can occupy rather than printing a negative refusal rate as a bound.
- The rule was read out of `DECISION-RULE.md` by `sweep.py` rather than transcribed into code,
  and that file is a committed ancestor of every commit that produced a number here.

## How to reproduce

Free, offline, no model call and no spend:

```
EVAL_CORPUS_ROOT=<round3>/corpus python3 build_report3.py \
  --ks 5,10,20,30,...,420,423 --waves 1
```

The paid confirmation, from its checkpoint, also with no new spend:

```
EVAL_CORPUS_ROOT=<round3>/corpus python3 confirm3.py --paired h@80:c@80
```

Outputs: `report3.html`, `summary3.json`, `confirm3.json`.
