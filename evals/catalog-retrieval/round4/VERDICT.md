# Round 4 verdict

**Ships: hybrid retrieval at k=210 as the frame worker default.**

The rule this verdict is judged against was committed at `e96b4e1ff`, before any round 4 number
existed. Every number below comes from a committed artifact, named at the top of its section.

## What round 4 was for

Round 3 produced a defensible ranking and an honest list of what it could not settle. Round 4
exists to close four of those gaps: a corpus pruned by 24.79 percent in exactly the hard cases, an
underpowered known-wrong-pick comparison, a paid confirmation that ran at one list length, and a
result measured on a single model.

## Definition of done, and whether each leg held

| leg                                  | required                                                            | result |
| ------------------------------------ | ------------------------------------------------------------------- | ------ |
| 1, unbiased corpus                   | 424 moves covered, near twins scored, agreement over the scored set | HELD   |
| 2, band stability                    | separation over at least 5 contiguous list lengths                  | HELD   |
| 3, paid agreement at more than one k | eight list lengths, six inside the band and two outside             | HELD   |
| 4, reproduction on a second model    | same leading family, bands overlapping by at least 5 list lengths   | HELD   |

## The corpus

From `round4/corpus/GOLD-AUDIT.md`.

| quantity                                            | value          |
| --------------------------------------------------- | -------------- |
| briefs generated                                    | 424            |
| shelf moves covered                                 | 424 of 424     |
| scored corpus agreement, the number that gates      | 95.52% 405/424 |
| strict reconstruction rate, which does not gate     | 76.18% 323/424 |
| near twins merged into multi-target gold            | 82             |
| contested, a majority the constructor listed as bad | 13             |
| unplaceable, no majority at all                     | 6              |
| distinct clusters after merging                     | 405            |

The floor is 95.00 percent and the gating number is 95.52 percent, so leg 1 held with 0.52 points
of room. Gold set sizes after merging are 323 briefs with one acceptable move and 82 with two.

Round 3 dropped 90 of 363 briefs, 24.79 percent, and reported a strict reconstruction rate of
75.21 percent against a pre-registered 95 percent floor. Round 4's floor applies to the scored
corpus rate instead, because a brief whose beat has two right answers is now carried as gold with
both moves rather than removed.

The generator was the other half of that fix. Round 3's `distractor:no_shelf_overlap` gate silently
dropped 36 of 218 moves, all of them briefs that shared no token with a terse blurb, and the
allocator never retried a rejected move. That one reason is now a **soft** rejection: the candidate
is kept and returned when the attempt budget runs out, so 42 moves entered the corpus as
`ACCEPT-SOFT` with the reason recorded in the gold file, in `attempts.jsonl` and on stdout. Coverage
went from 388 of 424 to 424 of 424 with no move dropped.

**The cluster count is the number that limits everything else.** 405 clusters clears the
pre-registered threshold of about 351, so the known-wrong-pick comparison is resolvable at this
corpus size rather than reported as unresolved.

## The recall sweep

From `round4/summary4.json` and `round4/report4.html`.

| quantity                                   | value                                               |
| ------------------------------------------ | --------------------------------------------------- |
| leading family                             | hybrid                                              |
| separated band                             | k=20 to k=210                                       |
| band width, against the required 5         | 20 list lengths, clears                             |
| margin over the runner up, inside the band | +0.0741 at k=20, +0.0494 at k=110, +0.0247 at k=210 |
| convergence point                          | k=340                                               |
| stop reason                                | k-dependent                                         |

A second band runs k=230 to k=250, 3 list lengths, and was not added to the first: they are not
contiguous, and a rule that sums non-adjacent runs would clear its own floor out of two runs that
each fail it.

The rule ships lexical over k=5 to k=10, hybrid over k=20 to k=210, lexical at k=220, hybrid over
k=230 to k=250, and lexical over k=260 to k=423. That pattern is why the stop reason is
`k-dependent` and why the sweep alone names no operating point: **the remaining question is not
which arm, it is which k.** Step 4 of the rule is what answers it, and it was bought.

Per-arm recall at the four list lengths the confirmation bought, hybrid at w=0.5 against lexical:

| k   | hybrid@w=0.5 | lexical | tokens per run |
| --- | ------------ | ------- | -------------- |
| 20  | 0.5407       | 0.2938  | 1478           |
| 110 | 0.8790       | 0.8099  | 7148           |
| 210 | 0.9728       | 0.9481  | 13448          |
| 300 | 0.9901       | 0.9753  | 19118          |

**Round 4 recall is not comparable to round 3 recall as a level.** A hit now means any acceptable
move was shown, so the numbers are structurally higher. The band shape is comparable; the levels
are not, and they are not printed side by side.

## The paid confirmation

From `round4/confirm4.json`. 6480 runs on model A and model B over the four sampled list lengths,
plus the contiguous band described under leg 4. Every pairing is on 405 briefs, held fixed brief by
brief, with clustered 95 percent intervals.

Absolute end-to-end quality, hybrid against lexical:

| cell  | model A fit | model A pass rate | model B fit | model B pass rate |
| ----- | ----------- | ----------------- | ----------- | ----------------- |
| c@20  | 0.2194      | 0.2543            | 0.2220      | 0.2519            |
| h@20  | 0.3755      | 0.4617            | 0.3975      | 0.4642            |
| c@110 | 0.5207      | 0.6222            | 0.5262      | 0.6296            |
| h@110 | 0.5576      | 0.6815            | 0.5296      | 0.6247            |
| c@210 | 0.5626      | 0.6963            | 0.5654      | 0.6741            |
| h@210 | 0.5828      | 0.7160            | 0.5880      | 0.7136            |
| c@300 | 0.5496      | 0.6840            | 0.5995      | 0.7235            |
| h@300 | 0.5644      | 0.7037            | 0.5994      | 0.7383            |

Paired hybrid minus lexical, on fit:

| k   | model A                      | separates | model B                      | separates |
| --- | ---------------------------- | --------- | ---------------------------- | --------- |
| 20  | +0.1561 (+0.1156 to +0.1965) | yes       | +0.1755 (+0.1350 to +0.2160) | yes       |
| 110 | +0.0370 (+0.0028 to +0.0711) | yes       | +0.0035 (-0.0320 to +0.0389) | no        |
| 210 | +0.0202 (-0.0112 to +0.0515) | no        | +0.0226 (-0.0100 to +0.0553) | no        |
| 300 | +0.0147 (-0.0152 to +0.0447) | no        | -0.0002 (-0.0304 to +0.0301) | no        |

Hybrid is ahead of lexical on fit at seven of the eight cells and separably ahead at three. It is
**never separably behind at any list length on either model**, and the one list length outside the
band came out a tie on both, which is what the rule predicted before the money was spent.

Counting the five short list lengths from leg 4 as well, there are sixteen arm comparisons in this
round, eight list lengths on each of two models. Hybrid separates on fit at eleven of them and is
never separably behind at any. The five that do not separate are k=110 on model B and k=210 and
k=300 on both, which is to say every one of them sits at the long end where the arms converge.

Refusal and mountable behave as bounds, not as exact values. Refusal is 0.0000 in eleven of the
sixteen cells and never above 0.0049; mountable is 1.0000 in eleven and never below 0.9934. The
one place either separates is k=20 on model A, where lexical refuses 0.0296 of briefs and hybrid
refuses none: at a 20-entry list, lexical fails to show anything the model will name.

## Choosing the list length

The arm question is settled by the band. The k question is answered by paired differences between
adjacent list lengths **within** the hybrid arm, which change exactly one variable and so are legal
under the rule. From `round4/confirm4.json`, on pass rate:

| step       | model A                      | separates | model B                      | separates |
| ---------- | ---------------------------- | --------- | ---------------------------- | --------- |
| 20 to 110  | +0.2198 (+0.1666 to +0.2729) | yes       | +0.1605 (+0.1103 to +0.2107) | yes       |
| 110 to 210 | +0.0346 (-0.0016 to +0.0708) | no        | +0.0889 (+0.0504 to +0.1274) | yes       |
| 210 to 300 | -0.0123 (-0.0463 to +0.0217) | no        | +0.0247 (-0.0129 to +0.0623) | no        |

**k=210 is the last list length that buys anything measurable.** Going 110 to 210 separates on
model B and is positive on model A. Going 210 to 300 separates on neither model and is negative on
one, while costing 5670 more prompt tokens per run. That is where a longer list stops paying, and
it lands one grid step past the top of the separated band rather than inside it.

Shipping k=20 instead, where hybrid's advantage over lexical is largest, would trade 0.2543 of
absolute pass rate for a bigger gap. The gap is not the product. Absolute quality is.

**This choice was not pre-registered.** The rule fixed how to pick the arm and required
confirmation at several list lengths; it did not fix how to pick k inside the band. The k above was
chosen on measured absolute quality after the numbers existed, and that is stated here rather than
presented as something the rule decided.

## The reproduction, model B

From `round4/confirm4.json`, on `gpt-5.6-luna`.

| quantity                              | value                                                                 |
| ------------------------------------- | --------------------------------------------------------------------- |
| same leading family as model A        | yes, hybrid, never separably behind                                   |
| band overlap, against the required 5  | 5 contiguous list lengths, k=10 to k=50, clears exactly               |
| fit difference between the two models | +0.0220 at k=20, -0.0280 at k=110, +0.0052 at k=210, +0.0350 at k=300 |
| verdict: reproduced, or disagreed     | reproduced, with the confound below                                   |

Direct cross-model pairings separate on fit at exactly one cell of eight, `c@300`, at +0.0499
(+0.0165 to +0.0832). Everywhere else the two families are indistinguishable on fit at this corpus
size. They do differ on known-wrong-pick: model B names a known-wrong move less often at six of the
eight cells, by -0.0321 to -0.0889, and that gap separates at five of them.

Where the models differ is at k=110, where model A separates from lexical and model B does not.
That is **under-resolution, not contradiction**: model B's interval at k=110 contains model A's
point estimate, and the direct cross-model pairing at k=110 does not separate. Model A's k=110
separation is itself marginal, with a lower bound of +0.0028.

**The confound, which cannot be removed.** `gpt-5.6-luna` rejects `temperature: 0` with HTTP 400
and samples only at its default of 1, while every model A cell ran at temperature 0. A model B
cell therefore differs from its model A twin in two variables, the model and the sampling
temperature. The round's one-variable property does not hold across the two families. Whatever
model B shows, it is not a clean reproduction, and this verdict does not call it one.

A cross-model fit difference smaller than about 0.0426 is invisible at this corpus size, so
"the models agree" can only ever mean "they agree to within that", never "they are identical".

## Leg 4, and why it needed more money

The pre-registered cross-model clause asks for two things: the same arm leads, and its separated
band overlaps model A's by at least 5 contiguous list lengths. The first was answered by the four
sampled list lengths. The second was not, and could not be: the recall sweep contains no model at
all, so it produces no per-model band, and four sampled points are not a contiguous run of five.

Rather than record the clause as passed on the strength of the other half, or as unevaluable and
ship anyway, the round bought the missing measurement: both arms on both models at k=10, 30, 40 and
50, which together with the k=20 cells already in hand gives each model a contiguous run of five
list lengths in the grid.

3240 further runs on each model bought it. Paired hybrid minus lexical at the five contiguous list
lengths, on pass rate, from `round4/confirm4.json`:

| k   | model A                      | separates | model B                      | separates |
| --- | ---------------------------- | --------- | ---------------------------- | --------- |
| 10  | +0.0864 (+0.0430 to +0.1299) | yes       | +0.1062 (+0.0615 to +0.1508) | yes       |
| 20  | +0.2074 (+0.1582 to +0.2566) | yes       | +0.2123 (+0.1653 to +0.2594) | yes       |
| 30  | +0.1951 (+0.1485 to +0.2416) | yes       | +0.2000 (+0.1512 to +0.2488) | yes       |
| 40  | +0.1901 (+0.1414 to +0.2388) | yes       | +0.1901 (+0.1410 to +0.2393) | yes       |
| 50  | +0.1679 (+0.1173 to +0.2185) | yes       | +0.1704 (+0.1182 to +0.2225) | yes       |

Both models separate at all five, on fit as well as on pass rate, with hybrid ahead every time.
The two per-model bands are therefore k=10 to k=50 on both, an overlap of 5 contiguous list
lengths against a required 5. **Leg 4 holds on the measurement rather than on the argument**, and
it holds with no room to spare: had one of the ten cells come out a tie, the clause would have
failed and this verdict would have shipped nothing.

Two things this measurement does not say. It does not extend the separation to the whole recall
band: at k=110 and above the arms converge end to end, and the overlap that clears the clause sits
entirely at the short end. And it does not remove the temperature confound, which applies to these
cells exactly as it applies to the other eight.

## What money bought, and what it could not

Spend, from each step's own meter. Every figure below is recomputed from the committed usage rows
rather than read back from a run log.

| step                            | projected               | actual                       |
| ------------------------------- | ----------------------- | ---------------------------- |
| generation                      | $2.739314 to $10.957256 | not metered, see below       |
| gold committee                  | $55.217838              | $19.322173                   |
| embeddings                      | $1.00 ceiling           | about $0.0014                |
| confirmation, model A           | $150.00 ceiling         | $93.527322                   |
| reproduction, model B           | $60.00 ceiling          | $8.820651                    |
| total, against the $400 ceiling | $400.00                 | $121.671546, plus generation |

The metered total is $121.671546 over 12960 paid runs and 1272 committee passes, recomputed here
from the committed usage rows by `run2.usage_cost` rather than read back from a run log. Adding
generation's bound puts the all-in figure between $124.410860 and $132.628802, against a $400
ceiling that never fired.

Model A cost ten times model B for identical work, 6480 runs each. That is a price list, not a
quality signal, and it is why the ceilings are per model: a shared ceiling would have let the
expensive family spend the cheap one's budget.

Generation has no dollar meter and never had one. Its spend is bounded by construction at four
attempts per move over 424 moves, which is where the $10.957256 ceiling comes from, and 424 moves
landed in 424 attempt rows, so the true figure sits near the floor rather than the ceiling. That
bound holds on call count and not on tokens per call, and it is reported as a bound.

The committee projection of $55.217838 was carried over from round 3's price at the same brief
count and overshot the actual by a factor of 2.86. Both numbers are kept: a projection that was
never checked against its outturn is how a ceiling stops meaning anything.

**What no amount of money buys.** All arms draw from the same 424 shelf entries, so as k
approaches the shelf size every arm shows every entry and they must converge. The sweep puts that
convergence at k=340. That is arithmetic, not a resolution limit. No corpus size buys a k
independent arm winner. The only lever is a larger catalog, which means authoring more primitives,
and that is a product change that was explicitly out of scope for this round.

The corpus ceiling follows from the same fact: with one brief per move the number of distinct
things to be right about is the number of distinct clusters, at most 424 and 405 once near twins
merge. A second wave would add replicates inside existing clusters and shrink noise, but it would
not add anything new to be right about, which is why one wave was run and the round stopped.

## What ships

**Hybrid retrieval, reciprocal rank fusion at w=0.5, showing 210 catalog entries.**

- The arm is carried by a 20 list length separated band against a required 5, and by end-to-end
  separation on both models at the short end of that band.
- The list length is the last one that buys measurable end-to-end quality on either model.
- At the shipped point the model refuses nothing, every named move exists, and 0.7160 of briefs
  pass on model A with 0.7136 on model B.
- Cost at the shipped point is about 13448 prompt tokens per run, against 1478 at k=20 and 19118
  at k=300.

Where hybrid earns its index is short lists, and that is the version to ship if prompt tokens are
the binding cost rather than quality. Hybrid at k=50 passes 0.5778 of briefs on model A and 0.5753
on model B for about 3368 prompt tokens. Lexical does not reach that until somewhere between k=50,
where it passes 0.4099, and k=110, where it passes 0.6222, so matching hybrid's k=50 quality costs
lexical roughly twice the list. That trade is measured on both models and separates on both, which
is more than can be said for the arm choice at k=210.

The honest limits of that recommendation, in one place:

- At k=210 itself the hybrid-over-lexical difference is positive on both models and separates on
  neither. The arm choice at that point rests on the recall band and on the shorter list lengths,
  not on the end-to-end confirmation at k=210.
- Hybrid needs an embedding index that must be rebuilt whenever the catalog changes. The rule's
  tie-break would have preferred lexical for exactly that reason, and it did not fire only because
  the band cleared. If the catalog starts changing faster than the index can be rebuilt, that
  tie-break becomes the live consideration and lexical at k=210 gives up 0.0202 of fit on model A
  and 0.0226 on model B, neither of which separates.
- The two fusion weights w=0.5 and w=0.7 are not separable and their difference flips sign across
  the grid. w=0.5 ships because the rule named it as hybrid's representative before any number
  existed, not because it measured better.

## What was fixed, and stayed fixed

- `mountable` and `fit` stayed separate numbers and were never collapsed into one score.
- Scoring stayed mechanical, in `gate2.py`. No model judged a model.
- Naming the whole shelf still scored 0.0.
- Exactly one variable changed between compared cells, and a pairing that would have changed two
  was refused rather than computed.
- A pairing naming a cell that no run produced is now refused as well. It used to return a
  difference over zero briefs, and it did: sixteen pairings came back at +0.0000 on every metric
  over n=0, a table of clean zeros that read like two models agreeing and was a case mismatch
  between the runner's cell label and the report builder's.
- The spend ceiling is keyed to the model the run is buying. It used to total every row in the
  checkpoint, so model A's bill stopped model B before its first call.
- `round3/stats.py` stayed the single owner of every interval in rounds 2, 3 and 4. No interval
  claims more certainty than the corpus holds.
- The gate regressions carried forward from rounds 1, 2 and 3 kept passing: 158 in round 2, 162 in
  round 3, 26 in round 4, plus 11 and 18 standalone scenarios.
