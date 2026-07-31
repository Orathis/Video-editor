# Gold Audit

> Fixture data only. This report is a test and demonstration artifact.
> The real briefs and gold corpus do not exist yet, and no external call was made.

## Boundary

The committee is not a judge of runs. It never sees any run output, run record, checkpoint, score, or anything derived from the eval grid. Each pass sees exactly one brief and the full shelf, and answers which move the brief describes. This is a reconstruction task against the corpus gold-construction process.

The three passes are independent. Every pass receives an identical context built only from the brief and full shelf, with no prior pass response or accumulated state.

## Corpus result

- Corpus accuracy: 100.00% (3/3)
- Accuracy floor: 95.00%
- Status: PASS
- Unanimous agreement count: 1
- Disagreement count: 2

The 95 percent floor limits uncertain labels to at most 15 of a 300-brief corpus. A 90 percent floor could admit 30 wrong briefs and contaminate 270 main-grid cells, so it is too permissive before a large paid run. Falling below the floor blocks the grid with no continue-with-caveat path.

Hand decisions are authoritative. When present, a hand decision replaces both the constructed gold candidate and the committee resolution for the final corpus result.

## Disagreements

### Disagreement 02

Constructed gold candidates: move-delta

Committee candidates: move-beta

Committee majority: move-beta

- Pass 1: move-beta, fixture beta reason 0
- Pass 2: move-beta, fixture beta reason 1
- Pass 3: move-beta, fixture beta reason 2

Hand decision: move-epsilon (authoritative)

Final move: move-epsilon

### Disagreement 03

Constructed gold candidates: move-alpha

Committee candidates: move-alpha, move-beta

Committee majority: move-alpha

- Pass 1: move-alpha, fixture majority reason one
- Pass 2: move-beta, fixture minority reason
- Pass 3: move-alpha, fixture majority reason two

## Sampled for hand decision

Disagreements are sampled deterministically by shelf group at 20 percent, with at least one per represented group when the sample size permits, capped at 30 and further bounded by the number of unanimous agreements. The control sample therefore has the same size and matches those groups where unanimous agreements are available.

The control exists because checking only disagreements cannot reveal errors where the constructor and committee share the same blind spot. Such an error appears as unanimous agreement and would otherwise never be audited.

### Disagreement sample

- 02 [layout], hand decision: move-epsilon

### Unanimous control sample

- 01 [type], hand decision: pending
