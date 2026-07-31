# Catalog browsing eval: verdict

30 runs, 5 briefs, `gpt-4o-mini` at temperature 0, scored by `gate.py` against a
hand-authored gold set. Total cost 34,604 tokens and 28.5 seconds of model time.

## Result

| condition       | what it sees   | mean fit | mountable | passed | tokens/run |
| --------------- | -------------- | -------- | --------- | ------ | ---------- |
| A control       | nothing        | 0.367    | 0.00      | 3/5    | 332        |
| B full read     | all 25 entries | 0.867    | 1.00      | 5/5    | 2639       |
| C lexical k=5   | grep top 5     | 0.467    | 0.80      | 3/5    | 748        |
| D semantic k=5  | cosine top 5   | 0.867    | 1.00      | 5/5    | 751        |
| C lexical k=10  | grep top 10    | 0.867    | 1.00      | 5/5    | 1221       |
| D semantic k=10 | cosine top 10  | 0.867    | 1.00      | 5/5    | 1227       |

`fit` is whether the run picked the right move for the beat. `mountable` is
whether the names it returned exist and can actually be installed. They are kept
apart on purpose: condition A cannot name shelf moves because it never saw the
shelf, so its picks are resolved to their nearest shelf move by embedding before
being scored on fit. Otherwise the control would score zero by construction and
the catalog would win without demonstrating anything.

## What to do

**Do not build the vector endpoint.** Semantic retrieval beat lexical decisively
at k=5 (0.867 against 0.467) and that gap vanished completely at k=10, where both
score 0.867 within 6 tokens of each other. The entire measured advantage of
embeddings was a consequence of too narrow a window, and widening the grep window
is free: no embedding model, no index to keep in sync with the shelf, no drift
when an entry is reworded, no service to operate.

**Keep the catalog.** The control is the weakest condition on both axes. Its
`mountable` score is 0.00 across all five briefs, meaning every move it named was
invented and none could be installed. On brief 05 it named a move the gold set
marks as known-wrong. Without a shelf, the agent produces plausible motion
vocabulary that does not correspond to anything that exists.

**Retrieve rather than paste the whole file.** Lexical k=10 matches full read
exactly on quality at 46% of the tokens (1221 against 2639). At 25 moves that
saving is small in absolute terms, but the shelf is expected to grow and full
read scales linearly with it while top-k does not.

So: grep the shelf, take 10, skip the embeddings.

## The honest limitation

0.867 is the ceiling this brief set can measure, not a score with headroom above
it. Briefs 01 and 05 each have two gold answers, and every condition that found
one found only one, scoring 0.667 on those two and 1.0 on the other three. Four
of the six configurations hit that exact ceiling. The tie between B, C at k=10,
and D is therefore a measurement limit rather than a demonstrated equivalence:
this brief set has no remaining power to separate them.

What the data does support confidently is the two conditions that lost, and both
losses are large and mechanically explained rather than marginal:

- A loses because it cannot name anything installable (0.00 mountable, 10 of 10
  picks unresolvable to the shelf by exact name).
- C at k=5 loses because lexical retrieval never surfaces the gold move for
  briefs 02 and 03. The gold entry ranks 8th and 6th by shared vocabulary, so a
  top-5 window structurally cannot contain it. On brief 02 the run correctly
  returned an empty pick list rather than inventing an answer, which is the right
  behavior and still a failure of the retrieval layer.

The briefs were written in a director's voice rather than the shelf's, and the
retrieval ranks confirm they are not tilted toward either retriever: lexical
recall@5 of the gold answer is 5/7 and semantic is 6/7, and each one catches a
brief the other misses.

## What would break the tie

Harder briefs. Specifically ones where the right answer requires reading
`avoid_when` rather than matching on what the move does, since that is the field
a top-k window is most likely to truncate away and the one a full read always
carries. The current set rewards recognizing a mechanic, which every condition
above the floor can do.

Also worth noting before treating this as settled: one model, one temperature,
one run per cell. The ordering is consistent across 30 runs but the sample is
small, and no result here has been shown to hold on a second model.

## Sources

- Runs: `runs.json` (20 at k=5), `runs-k10.json` (10 at k=10)
- Scorer: `gate.py`, proven against the gold set by `test_gate.py` (11 checks)
- Shelf: `../video-primitives/SHELF.md` (25 moves), locked by `check_shelf.py`
- Index: `../video-primitives/catalog-index.json`
- Contexts: `harness.py`, one variable between conditions
- Vectors: `vectors.json`, `text-embedding-3-small`, 1536 dimensions

## Not covered

- Filmstrips. The plan fed condition B filmstrip paths, which carry no
  information to a text-only run, so they were not baked. A vision tier is a
  separate experiment.
- Whether a selected move actually mounts and renders. Every run here produces a
  selection, not a composition.
- Blind human ranking of rendered output, which is the axis the design doc cares
  most about and the one this round cannot supply.
