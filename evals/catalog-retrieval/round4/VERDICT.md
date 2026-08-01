# Round 4 verdict

**Status: pending.** Every number below is absent until the round produces it. Each absent value
names the file that produces it, so nothing here can be filled in from memory or from round 3.

The rule this verdict is judged against was committed at `e96b4e1ff`, before any round 4 number
existed.

## What round 4 was for

Round 3 produced a defensible ranking and an honest list of what it could not settle. Round 4
exists to close four of those gaps: a corpus pruned by 24.79 percent in exactly the hard cases, an
underpowered known-wrong-pick comparison, a paid confirmation that ran at one list length, and a
result measured on a single model.

## Definition of done, and whether each leg held

| leg                                  | required                                                            | result |
| ------------------------------------ | ------------------------------------------------------------------- | ------ |
| 1, unbiased corpus                   | 424 moves covered, near twins scored, agreement over the scored set | absent |
| 2, band stability                    | separation over at least 5 contiguous list lengths                  | absent |
| 3, paid agreement at more than one k | four list lengths, three inside the band and one outside            | absent |
| 4, reproduction on a second model    | same leading family, bands overlapping by at least 5 list lengths   | absent |

A leg that failed is named. The round ships an operating point only if all four held.

## The corpus

From `round4/corpus/GOLD-AUDIT.md`.

| quantity                                            | value  |
| --------------------------------------------------- | ------ |
| briefs generated                                    | absent |
| shelf moves covered                                 | absent |
| scored corpus agreement, the number that gates      | absent |
| strict reconstruction rate, which does not gate     | absent |
| near twins merged into multi-target gold            | absent |
| contested, a majority the constructor listed as bad | absent |
| unplaceable, no majority at all                     | absent |
| distinct clusters after merging                     | absent |

Round 3 dropped 90 of 363 briefs, 24.79 percent, and reported a strict reconstruction rate of
75.21 percent against a pre-registered 95 percent floor. Round 4's floor applies to the scored
corpus rate instead, because a brief whose beat has two right answers is now carried as gold with
both moves rather than removed.

**The cluster count is the number that limits everything else.** Merging near twins can only
reduce it below 424, and the pre-registered power table says the known-wrong-pick comparison stops
being resolvable below about 351 clusters. If the count came in under that, this verdict says the
comparison is unresolved rather than reporting a gap the interval does not support.

## The recall sweep

From `round4/summary4.json` and `round4/report4.html`.

| quantity                                   | value  |
| ------------------------------------------ | ------ |
| leading family                             | absent |
| separated band                             | absent |
| band width, against the required 5         | absent |
| margin over the runner up, inside the band | absent |
| convergence point                          | absent |
| stop reason                                | absent |

**Round 4 recall is not comparable to round 3 recall as a level.** A hit now means any acceptable
move was shown, so the numbers are structurally higher. The band shape is comparable; the levels
are not, and they are not printed side by side.

## The paid confirmation, model A

From `round4/confirm4.json`, on `gemini-3.6-flash` at temperature 0.

| cell   | refusal | known-wrong-pick | mountable | fit    | pass rate |
| ------ | ------- | ---------------- | --------- | ------ | --------- |
| absent | absent  | absent           | absent    | absent | absent    |

Paired differences, on the briefs both cells ran, with clustered 95 percent intervals:

| quantity         | difference | 95% interval | separates |
| ---------------- | ---------- | ------------ | --------- |
| refusal          | absent     | absent       | absent    |
| known-wrong-pick | absent     | absent       | absent    |
| mountable        | absent     | absent       | absent    |
| fit              | absent     | absent       | absent    |
| pass rate        | absent     | absent       | absent    |

## The reproduction, model B

From `round4/confirm4.json`, on `gpt-5.6-luna`.

| quantity                              | value  |
| ------------------------------------- | ------ |
| same leading family as model A        | absent |
| band overlap, against the required 5  | absent |
| fit difference between the two models | absent |
| verdict: reproduced, or disagreed     | absent |

**The confound, which cannot be removed.** `gpt-5.6-luna` rejects `temperature: 0` with HTTP 400
and samples only at its default of 1, while every model A cell ran at temperature 0. A model B
cell therefore differs from its model A twin in two variables, the model and the sampling
temperature. The round's one-variable property does not hold across the two families. Whatever
model B shows, it is not a clean reproduction, and this verdict does not call it one.

A cross-model fit difference smaller than about 0.0426 is invisible at this corpus size, so
"the models agree" can only ever mean "they agree to within that", never "they are identical".

## What money bought, and what it could not

Spend, from each step's own meter:

| step                            | projected | actual |
| ------------------------------- | --------- | ------ |
| generation                      | absent    | absent |
| gold committee                  | absent    | absent |
| embeddings                      | absent    | absent |
| confirmation, model A           | absent    | absent |
| reproduction, model B           | absent    | absent |
| total, against the $400 ceiling | absent    | absent |

**What no amount of money buys.** All arms draw from the same 424 shelf entries, so as k
approaches the shelf size every arm shows every entry and they must converge. That is arithmetic,
not a resolution limit. No corpus size buys a k independent arm winner. The only lever is a larger
catalog, which means authoring more primitives, and that is a product change that was explicitly
out of scope for this round.

The corpus ceiling follows from the same fact: with one brief per move the number of distinct
things to be right about is the number of distinct clusters, at most 424 and lower once near twins
merge.

## What ships

Absent until legs 1 through 4 are filled in.

## What was fixed, and stayed fixed

- `mountable` and `fit` stayed separate numbers and were never collapsed into one score.
- Scoring stayed mechanical, in `gate2.py`. No model judged a model.
- Naming the whole shelf still scored 0.0.
- Exactly one variable changed between compared cells, and a pairing that would have changed two
  was refused rather than computed.
- `round3/stats.py` stayed the single owner of every interval in rounds 2, 3 and 4. No interval
  claims more certainty than the corpus holds.
- The gate regressions carried forward from rounds 1, 2 and 3 kept passing.
