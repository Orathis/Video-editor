# Round 2 verdict

2043 runs, 227 briefs, 9 cells, 424 shelf entries. Completed 2026-07-31 for $17.83
against a $23.25 projection and a $60 ceiling. Zero errors, every recorded run scored.
Prompt caching covered 41.1 percent of input tokens, which is the entire gap between the
projection and the bill.

## What round 2 was for

Round 1 could not separate lexical from semantic retrieval: both tied at 0.867 mean fit
at k=10, which was the measurement ceiling of a 5 brief set against a 25 entry shelf.
With a shelf that small almost any retrieval hands over the right move. Round 2 breaks
the ceiling by growing the shelf to 424 entries and the corpus to 227 briefs, and adds a
k sweep and a fusion arm the first round did not have.

Lexical recall at k=10 on the finished corpus is 0.282. The ceiling is gone.

## Scoreboard

| cell | reads as | fit | mountable | pass | gold shown | refused | input tok | USD/1000 | fit/USD |
|---|---|---|---|---|---|---|---|---|---|
| b | everything | **0.679** | 1.000 | 0.788 | 1.000 | 0.000 | 23725 | 24.79 | 27.4 |
| d@20 | meaning, 20 | 0.375 | 0.987 | 0.414 | 0.485 | 0.013 | 1466 | 7.52 | 49.9 |
| h@10 | both merged, 10 | 0.353 | 0.960 | 0.397 | 0.432 | 0.040 | 853 | 6.88 | **51.3** |
| c@20 | words, 20 | 0.317 | 0.987 | 0.352 | 0.374 | 0.013 | 1481 | 7.48 | 42.4 |
| d@10 | meaning, 10 | 0.307 | 0.947 | 0.335 | 0.383 | 0.053 | 876 | 6.92 | 44.3 |
| c@10 | words, 10 | 0.239 | 0.947 | 0.260 | 0.282 | 0.053 | 844 | 6.85 | 34.8 |
| d@5 | meaning, 5 | 0.233 | 0.890 | 0.256 | 0.282 | 0.110 | 566 | 5.97 | 39.0 |
| c@5 | words, 5 | 0.200 | 0.894 | 0.216 | 0.229 | 0.106 | 538 | 5.69 | 35.1 |
| a | nothing | 0.184 | 0.008 | 0.313 | 0.000 | 0.000 | 237 | 6.45 | 28.6 |

## What round 2 can conclude

**1. A catalog has to exist.** Unaided, the model named a move that actually exists 0.8
percent of the time. Across 579 picks it produced 555 distinct names, so it invented a
fresh one almost every call: Rack Focus, Staggered Text Wipe, Linear Wipe Reveal,
Container Morph. All plausible, none real. The control's fit of 0.184 is an artifact of
resolving free text to its nearest shelf entry by embedding; the 0.008 mountable is the
number that carries the claim.

**2. The full shelf wins on recall and loses on judgment.** b takes the top fit at 0.679,
but only because its recall is 1.000 by construction. On the briefs where a short list
also saw the answer, every one of the seven short-list cells selects better than the full
shelf:

| cell | shared briefs | cell fit | full shelf fit | difference |
|---|---|---|---|---|
| c@5 | 52 | 0.872 | 0.788 | +0.083 |
| h@10 | 98 | 0.818 | 0.735 | +0.083 |
| c@10 | 64 | 0.846 | 0.786 | +0.060 |
| c@20 | 85 | 0.847 | 0.790 | +0.057 |
| d@10 | 87 | 0.801 | 0.747 | +0.054 |
| d@5 | 64 | 0.826 | 0.779 | +0.047 |
| d@20 | 110 | 0.774 | 0.735 | +0.039 |

Seven of seven, same direction, 0.039 to 0.083. 424 entries is more than the model chooses
well among; the surplus entries are noise it has to reject rather than free context.

This table is the one comparison that holds difficulty fixed. Reading `fit_when_shown`
straight across cells compares different brief sets, because the briefs a short list
resolves are the easy ones.

**3. Retrieval is the bottleneck, not selection.** fit runs at roughly 0.8 times recall in
every catalog cell, at every k, in both arms. A point of recall converts to about 0.8 of a
point of fit. Everything downstream is capped by whether the right move was on the list.

**4. Meaning beats words at every list length, and fusion beats both.** d over c: +0.033 at
k=5, +0.068 at k=10, +0.058 at k=20. The margin is real but modest. Fusion is the larger
effect: h@10 reaches 0.353 on 853 input tokens, within 0.022 of what d@20 needs 1466 tokens
to reach. Each method surfaces entries the other misses.

**5. The embedding arm is effectively free to set up.** Vectorizing all 424 entries and 227
briefs cost $0.00137 once. A query brief costs 138 tokens, about $0.0000028. Against
roughly $0.006 per run this does not enter the decision. The real cost of the semantic arm
is operational: vectors must be rebuilt when the catalog changes.

**6. The anti-exploit property survives at 424 entries.** Refusal rises as the list
shortens, 0.000 at the full shelf to 0.110 at k=5. When the right move is absent the model
declines rather than reaching for the nearest wrong one. Naming the whole shelf still
scores 0.0.

**7. Description quality dominates entry type.** Same shelf, same retrieval, same model:

| stratum | briefs | fit | mountable |
|---|---|---|---|
| primitive | 52 | 0.487 | 0.861 |
| component and primitive | 42 | 0.354 | 0.834 |
| block | 53 | 0.256 | 0.853 |
| component | 80 | 0.238 | 0.840 |

Primitives are more than twice as findable as components. Primitives carry authored blurbs;
components carry registry metadata. 382 of 424 entries sit on the losing side of that gap.

## What round 2 cannot conclude

- **Not "k=10 fusion is the best retrieval design."** Only that it beat the eight other
  arrangements tried here. No reranker, no query expansion, and no chunking strategy was
  in the grid.
- **Block coverage is short.** 53 block briefs against a target of 100. 21 block targets
  produced no distractors and never generated a brief; the committee dropped 26 more.
  Block results carry more noise than primitive results.
- **The corpus that ran is easier than the corpus generated.** The 45 briefs an independent
  reader could not resolve to a single move are exactly the near twin cases where retrieval
  matters most. Removing them protects the scoring and flatters every cell at once.
- **The corpus repeats its targets.** 227 briefs cover 158 distinct moves. The 52 primitive
  briefs cover only 25 primitives, so the best scoring stratum describes the narrowest
  surface.
- **Round 1's tie breaker was never tested at scale.** Its hardest briefs required reasoning
  about when a move is wrong. `avoid_when` is populated on 25 of 424 entries, `use_when` on
  128.
- **Gold is constructed, not discovered.** The blind committee bounds the label error at a
  95 percent agreement floor; it does not remove the construction bias. A move the shelf
  describes badly yields a brief the shelf describes badly.
- **One model, one temperature, one shelf snapshot.** The direction of these findings is
  solid. The magnitudes are not claimed to transfer.

## Recommended

1. **Ship retrieval, not the full catalog.** 23,725 input tokens per call for worse
   selection is the wrong trade at 424 entries.
2. **Make the retrieved list the fusion of both rankings at k=10.** Best fit per dollar on
   the board, and the refusal rate is still low there (0.040 against 0.110 at k=5).
3. **Spend the next effort on recall.** h@10 puts the answer on the list 43.2 percent of
   the time. That is the ceiling on everything else.
4. **Rewrite component and block blurbs to match primitive quality.** The largest single
   effect measured here is authored description versus registry metadata.
5. **Populate `use_when` and `avoid_when`.** They are what separates near twins, and they
   are missing on precisely the entries that score worst.

## Reproducing

```
EVAL_DRY_RUN=1 python3 run2.py      # projection, zero network calls
python3 run2.py                      # resumable, checkpointed, ceilinged
python3 build_report2.py             # report.html and summary.json
```

Scoring never involves a model judging a model. `gate2.py` compares picks to gold
mechanically: exact name match for mountable, f1 minus a flat 0.5 per known wrong pick for
fit. The control's free text is resolved to its nearest shelf entry by embedding, which is
the only mechanical way to score it.
