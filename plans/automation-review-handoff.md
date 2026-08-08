# Automation lane feature — post-review fix handoff

**Written** 2026-08-05, end of a long session. **Read this top to bottom before touching code.**

**Worktree:** `/Users/vanceingalls/src/wt/hyperframes/webaudio-fx`
**Currently checked out:** `wa-18-lane-stretch`
**Nothing is pushed.** All four branches are ahead of their remotes. Do not push without asking Vance.

---

## 1. What this feature is

A time-selection model for audio automation lanes in the HyperFrames Studio timeline: drag-select a
time range on a lane, then delete it, fill it with a shape (ramp/swell/dip), simplify it, copy/paste
it, or stretch it by its edges. Four stacked PRs in `gh stack` #3027 (which is 18 PRs deep overall;
these are the top four).

Design spec: `plans/automation-time-selection-design.md`
Implementation plan: `plans/automation-time-selection-plan.md`
Both are local-only and uncommitted by convention — **specs do not go in PRs in this repo.**

The feature was built via superpowers subagent-driven-development: 11 tasks, each with its own
scoped review, plus a final whole-branch review. All of that passed. Then `/code-review max` found
15 findings the entire SDD review chain had missed. Sections 3–5 are that list.

---

## 2. Stack state and SHAs

| Branch | local | remote (stale) | PR |
| --- | --- | --- | --- |
| `wa-15-lane-selection` | `515f258d5` | `46b31b059` | #3050 |
| `wa-16-lane-shapes` | `2ad363095` | `704a06779` | #3055 |
| `wa-17-lane-clipboard` | `d8c41e5f9` | `5cc8422da` | #3056 |
| `wa-18-lane-stretch` | `b4d4b758f` | `7cde74807` | #3058 |

Everything below `wa-15` is `wa-14-lane-gestures` (already reviewed and out of scope).

**Verified green at the `wa-18` tip:** 3492 tests passing / 18 todo, `tsc --noEmit` clean,
`oxlint packages/studio/src` clean, `bunx fallow audit --base origin/main --fail-on-issues` clean
(exit 0; only warn-level duplication).

Working tree is clean apart from untracked `plans/`.

### Restack mechanics that worked

Amending a lower branch requires rebasing every branch above it. The command that worked:

```bash
git rebase --onto wa-17-lane-clipboard <OLD_wa-17_tip> wa-18-lane-stretch
GIT_EDITOR=true git rebase --continue   # after resolving conflicts
```

Use `--onto` with the *old* parent tip. A plain `git rebase <parent>` replays already-rebased
commits and makes a mess.

**Repo hazards (from Vance's notes, both real):** two LFS fixtures always show as modified and can
block a rebase; unsigned pushes are rejected with GH013. Also: never run two committing agents in
this one worktree — they collide on the shared HEAD and index. Do the branches strictly serially.

---

## 3. Fixed and verified

### `wa-15` — `515f258d5` "let an automation range keep Delete from the clip"

**The worst bug in the set: Delete destroyed the whole audio clip.** `useAppHotkeys` listens on
`window` capture; `useAutomationSelectionKeyboard` listens on `document` capture. Capture runs
window → document, so the app handler **always** ran first regardless of mount order, and the
automation hook's `stopImmediatePropagation()` was dead code. The app's Delete branch guards
keyframe-delete on `selectedKeyframes.size > 0`, found nothing, and fell through to
`handleTimelineElementDelete(el)` — and `selectedElementId` is necessarily set, because that is what
makes a lane editable at all.

Fixed in `useAppHotkeys.ts` (not by moving the listener — that would make correctness depend on
mount order) with `if (usePlayerStore.getState().automationSelection) return;`, no `preventDefault`,
so the downstream handler still gets the key. `dispatchPlainKey` was exported to test it. 4 tests.

### `wa-17` — `d8c41e5f9` "repair the automation paste path and finish the key arbitration"

Six paste findings plus the Cmd+C/V arbitration. Paste was the least safe path in the feature.

- **Write channel.** `resolvePasteTarget` resolved its element from `selectedElementId` but committed
  through `domEditSelection`, a different, asynchronously-lagging channel. Clicking clip B then
  immediately pasting serialized B's automation onto A and left B untouched. Now bails unless
  `binding.commitTargetKey === elementKey`. `useAutomationLanes` exposes that key via
  `resolveTimelineIdForSelection` — the same resolver `applyDomSelection` uses — read in the same
  render as the commit handlers, so a handler and the key cannot describe different moments.
- **Chain-in-place.** Anchor now comes from `sel.t1` (plus a `markLastPaste` marker), not `sel.t0`.
  Before, a second Cmd+V recomputed the identical `atT` and overwrote the first paste. The code
  comment claimed the correct behaviour while the code did the opposite, and no test pressed Cmd+V
  twice — which is why every reviewer believed the comment.
- **Empty-range copy.** `copyRange` now returns `false` rather than arming a clipboard whose every
  paste is a destructive flatten (`inner: []` is byte-identical to the delete payload), and samples
  the range's edges so copying a smooth stretch yields a real segment.
- **Playhead.** The playhead branch requires the playhead to be *inside* the clip instead of
  silently clamping an out-of-clip playhead to the clip's own start.
- **Key normalization + modifier mask.** One `isChord` helper does `e.key.toLowerCase()` and gates
  on `!shiftKey && !altKey`, matching `useAppHotkeys`. CapsLock no longer kills the shortcut;
  Ctrl+Alt+V no longer pastes where the app-level handler declines.
- **Cmd+C/V arbitration.** `useAppHotkeys` now consults `automationOwnsKey(event)` before its `c`/`v`
  branch. Without it, Cmd+V duplicated the clip *while* the automation paste wrote the same file
  (two async read-modify-writes of one file from one keypress, last-write-wins), and Cmd+C armed
  both clipboards and toasted "Copied clip". Returns without `preventDefault`, and declines when the
  automation clipboard is empty so clip paste still works. `dispatchModifierKey` exported to test it.
- **Double-action guard.** The hook returns early on `e.defaultPrevented`. The wa-15 guard sits
  *below* the keyframes branch (deliberately — there is a test asserting keyframes outrank a range),
  so Delete with keyframes *and* a range selected deleted the keyframes there **and** emptied the
  range here. `preventDefault` does not stop propagation, so the claim has to be read, not assumed.

4 new arbitration tests in `useAppHotkeys.test.ts`, including that Cmd+V still falls through to clip
paste when the automation clipboard is empty.

### `wa-18` — rebased, one conflict resolved

`b4d4b758f` is the old final-review fix wave replayed onto the new wa-17. The conflict was the
predicted one: wa-18's inline `clamp(...)` ternary for the paste anchor vs. wa-17's new
`pasteAnchor()` helper, which subsumes it (clamping + in-clip playhead + chaining). Kept
`pasteAnchor()`, dropped the superseded block, preserved wa-18's 34 test lines — all still pass.

---

## 4. Still open — `wa-17`

1. **Clipboard has no project scoping and no session reset.** `automationClipboard.ts` is a
   module-level `let entry` that persists for the page's lifetime. `clearAutomationClipboard()`
   exists but has **zero production callers** (tests only). Compare `useClipboard.ts:64-66,142`,
   which scopes the clip clipboard with a `useRef` *and* an explicit `projectIdRef` guard.
   Failure: copy an `fx.n1.frequency` range in project A, switch projects, select any audio clip in
   B, Cmd+V — A's shape is written into B, mapped through A's captured `sourceRange` for an FX node
   that does not exist in B, and the event is consumed so clip paste never runs.
   Fix: scope `entry` to a project id and clear it from `beginTimelineSession`.
   **I checked and there is no `projectId` anywhere in that file — this is genuinely not started.**
   (I mis-stated mid-session that the +70 lines were scoping; they were the empty-copy edge
   sampling. Don't trust that earlier claim.)

2. **`createTimelineResetState()` omits `automationSelection`.** Verified: `automationSelection`
   appears in `playerStore.ts` only as an import. That function resets 30+ timeline fields including
   `selectedElementId`, `selectedKeyframes`, `selectedElementIds`, and runs from
   `beginTimelineSession` on project-identity change. A stale `elementKey` surviving a project switch
   can match a same-keyed element in B and redirect `handlePaste` down the
   `sel.elementKey === paste.elementKey` branch to a stale `t0`. One-line addition.

3. **The six paste fixes are only partly pinned by tests.** No test yet for: pressing Cmd+V twice
   (chaining), a commit-target mismatch, an out-of-clip playhead, an empty-range copy, or CapsLock.
   **This matters more than it looks** — see §6. `useAutomationSelectionKeyboard.test.tsx` currently
   has 7 tests; the mock binding needs `commitTargetKey: "bgm"` to match the element key or
   `resolvePasteTarget` bails (that field was the thing breaking typecheck when I picked this up).

---

## 5. Still open — `wa-18` (nothing started)

All seven are relayed from the `/code-review max` agent. I verified #4 and #6 partially by reading
the code; the rest I did **not** independently reproduce. Verify before fixing.

1. **`onPointerCancel` commits an interrupted stretch instead of reverting.** `~:434` routes to
   `endDrag` → `finishEdgeDrag`, which persists the partial retime via `commitPoints(lane.points,
   true)`. A `pointercancel` means the browser abandoned the gesture. Also: `capturePointer` attaches
   to `e.target` rather than the svg, so if that child unmounts mid-drag, capture is lost with no
   `pointercancel`, `edgeDrag` stays non-null, and every later button-less `pointermove` keeps
   retiming and firing live writes. There is no `onLostPointerCapture`/`onPointerLeave`/
   `onPointerOut` and no Escape or blur path.
2. **`finishEdgeDrag` has no movement threshold.** A bare click in the 8px halo around either edge
   persists a no-op commit and pushes an undo entry that changes nothing (`commitDataAttribute` has
   no unchanged-value short-circuit). Worse, it makes the pre-existing "click the background to
   clear the selection" escape unreachable near the edges. The sibling `finishRangeDrag` has exactly
   this guard via `rangeCrossed`, ~13 lines below.
3. **The stretch handle disables itself on the edge it just created.** `replaceRange` pins an anchor
   at the union bound and `finishEdgeDrag` sets the selection edge to that same time, so after any
   stretch (or range delete, or shape insert) a breakpoint sits exactly on the edge, inside
   `hitIndex`'s `GRAB_PX * 1.6` = 11.2px disc. Re-grabbing that edge **at the envelope's height**
   resolves to a point-drag. I confirmed this one by tracing the fixture: it is narrower than
   "disabled" (the edge halo ignores `clientY`, so other heights still work) but the natural place
   to grab is on the line. Needs a hit-priority rule: inside an active selection, the edge wins over
   a point sitting on it. **This is the worst product outcome in the set — the feature isn't
   repeatable.**
4. **The selection highlight is frozen for the whole stretch.** `moveEdge` never fires
   `onRangeSelect`, and the hook returns only `edgeDrag?.edge`, discarding `current` (~`:524`). The
   rect and both edge lines render purely from the `rangeSelection` prop, so they stay pinned at the
   pre-drag bounds and snap into place on release — you drag an invisible handle. `moveRangeDrag`
   fires `onRangeSelect` live precisely so the marquee tracks the pointer, so the two range gestures
   are inconsistent.
5. **`edgeAt`'s `d0 <= d1` tiebreak makes the `t1` edge ungrabbable on a narrow selection.** For a
   selection narrower than ~16 screen px the halos overlap, every press resolves to `"t0"`, and
   `moveEdge` clamps it to `origin.t1 - POINT_MERGE_SEC` — so the only reachable gesture immediately
   widens the selection. Trivially produced by a Cmd+V of a short span or a range drag at low zoom.
   Inside that halo the user can neither start a fresh range nor clear the old one without Escape.
   `edgeAt` also ignores `clientY` entirely.
6. **`moveEdge`'s clamp is applied after the 0-floor and only bounds against the partner edge**, so
   a sub-`POINT_MERGE_SEC` selection's `t0` edge yields negative times, which core's `cleanPoint`
   then collapses onto duplicate `t=0` on the serialize round-trip. Reachable at ordinary zoom:
   `moveRangeDrag` fires once the drag crosses 3px, i.e. under 0.02s above ~150 px/s. Also borrowing
   `POINT_MERGE_SEC` as a minimum selection *width* couples two unrelated behaviours.
7. **`retimeRange` reshapes the envelope outside the selection, and the test that caught it was
   deleted rather than the bug fixed.** See §6 — this one is mine.

### Recommended approach for wa-18

Findings 1, 2, 3, 5 and 6 are one underlying defect, not five: `edgeDrag` was bolted on as a fifth
mutually-exclusive gesture state **without joining the threshold / live-preview / revert-on-cancel
contract the other four gestures follow.** Six separate patches will be more code and less coherent
than one focused pass making edge-stretch structurally parallel to `rangeDrag`. Do that.

File sizes (studio hard cap is 600 lines, enforced by the lefthook `filesize` hook, which reads the
**git index**, not the working tree): `useAutomationLaneGestures.ts` 538, `TimelineAutomationLane.tsx`
510, `useAutomationSelectionKeyboard.ts` 353, `automationClipboard.ts` 112. The gestures file has
only ~60 lines of headroom, so the refactor will likely need an extraction — do it deliberately, not
by shaving comments. Test files are exempt from the cap.

---

## 6. Mistakes I made — do not repeat these

**I deleted a test assertion that was catching a real bug.** During the SDD run, Task 10's
`retimeRange` test failed at `t=5.1`. I hand-traced it, concluded the reshaping was inherent, and
directed the implementer to delete that probe (commit now replayed as part of wa-18). The reviewer
later identified the actual mechanism I missed: `pointsIn` is **endpoint-inclusive**, so a breakpoint
sitting exactly on the selection edge is treated as interior, retimed onto the new edge, and then
*suppresses the far anchor* (`anchor()` returns `[]` when `inner` has a point within
`POINT_MERGE_SEC`). Numerically, on the test's own fixture
`retimeRange(ramp, t0:2, t1:3, newT0:2, newT1:5)` → `[(0,1),(2,0.6),(5,0.4),(6,0)]`; the original
3→6 segment sloped −0.133/s, the new 5→6 slopes −0.4/s, so the envelope at `t=5.5` moves from 0.067
to 0.2 — outside the union `[2,5]`.

Some reshaping genuinely is unavoidable (you cannot have both the retimed boundary point and a
preservation anchor at the same time), but **whether a point *on* the edge should move with the
stretch or stay put is a design question I never pinned down and then declared settled.** Decide it
explicitly. And the test still claims "preserves the envelope outside the union" while probing only
`[0, 1, 1.9]` — the left side, where `newT0 === t0` makes it trivially true. Restore a right-side
assertion.

**I twice claimed something was done without checking.** I said the clipboard's +70 lines were
project scoping (they were edge sampling), and I briefly thought a clamp test had been lost in the
restack (it was on wa-18, above the branch I was reading). Grep before asserting.

### The process lesson — the most important thing in this doc

**Three of these bugs were actively certified as correct by the test suite:**

- the chain-paste comment claimed "chains right after this one" and no test pressed Cmd+V twice;
- the `t=5.1` assertion that caught the invariant break was deleted instead of the bug being fixed;
- the stretch test block's own header concedes "edges deliberately off any existing point", so the
  normal post-stretch state (finding 5.3) is the one state never tested.

Eleven scoped task reviews plus a final whole-branch review on the strongest model missed all 15
findings. The pattern: **every reviewer read a diff against a brief.** None mounted the real app,
and the worst bug lives in `useAppHotkeys` — a file no task touched, so it was outside every diff by
construction. Gates pass precisely *because* tests mount hooks in isolation.

So: **fixing the code without correcting those tests leaves the suite green on the same bugs.** For
each fix, add the test that fails before it. And where two hooks arbitrate one keystroke, the test
must mount **both** — an isolated-hook test is what let the clip-destroying Delete through.

---

## 7. Suggested order for the next session

1. `wa-17` §4.1 + §4.2 (clipboard scoping + reset field) — small, self-contained.
2. `wa-17` §4.3 (the five missing paste tests) — each should fail against `d8c41e5f9^`.
3. `wa-18` §5 as one gesture-contract pass, plus restoring the `t=5.1` assertion (§6).
4. Full verify at the tip: `cd packages/studio && bunx vitest run src` (expect ≥3492),
   `bunx tsc --noEmit`, `bunx oxlint packages/studio/src`, `bunx oxfmt --check` on touched files,
   `bunx fallow audit --base origin/main --fail-on-issues` from the worktree root.
5. Manual smoke — nobody has run this feature in a real browser yet, which is how 15 findings
   survived: `npx hyperframes preview` on a project with music + voiceover. Drag-select on a volume
   lane → Delete → right-click → Dip → Cmd+C, click another clip, Cmd+V → drag an edge → **stretch
   the same edge again** (that's finding 5.3).
6. Only then ask Vance about pushing. Each branch is fixed in place — do **not** stack new fix PRs
   on top, or `wa-17` merges with known-broken paste geometry and its reviewer has to know a later
   branch repairs it.

Commit style: conventional, and the repo's commits explain *why* at length — match that. No `any`,
no `as T`, no `!` non-null assertions (test files have heavy pre-existing `as T` precedent for
mock-call reads; new production code should not add any). bun, oxlint/oxfmt — never eslint,
prettier, or biome.

---

## 8. Session of 2026-08-06 — §4, §5 and §6 done; two NEW findings, both out of scope

**Nothing pushed.** Branch tips are now:

| Branch | local | remote (stale) | PR |
| --- | --- | --- | --- |
| `wa-15-lane-selection` | `515f258d5` (unchanged) | `46b31b059` | #3050 |
| `wa-16-lane-shapes` | `2ad363095` (unchanged) | `704a06779` | #3055 |
| `wa-17-lane-clipboard` | `f477bbd35` (amended) | `5cc8422da` | #3056 |
| `wa-18-lane-stretch` | `55c1a203f` (restacked + 1 new commit) | `7cde74807` | #3058 |

Verified at the `wa-18` tip: 3515 tests passing / 18 todo (was 3492; +23), `tsc --noEmit` clean,
`oxlint packages/studio/src` clean, `oxfmt --check` clean, `fallow audit --base origin/main
--fail-on-issues` exit 0. Working tree clean apart from untracked `plans/`.

### Closed

- **§4.1 clipboard scoping** — `automationClipboard` scopes itself: every entry point carries the
  project it speaks for, a mismatch empties the module. Chosen over clearing from
  `beginTimelineSession` so no future caller can forget the guard; `isLastPasteSpan`'s mark is scoped
  transitively through the same check.
- **§4.2** — `createTimelineResetState()` now clears `automationSelection`.
- **§4.3** — all five paste tests added (chain, commit-target mismatch, out-of-clip playhead,
  empty-range copy, CapsLock). Each verified to FAIL against `d8c41e5f9^`.
- **§5 (wa-18)** — one gesture-contract pass, as recommended, extracted to
  `useAutomationEdgeStretch.ts` (238 lines) + `automationLanePointer.ts`; the gestures file dropped
  538 → 440. Threshold, live `onRangeSelect`, revert on `pointercancel`, capture on the svg instead
  of `e.target` plus a buttons-0 guard for a silently lost capture, edge-beats-coincident-point hit
  priority, and clamp-order (0-floor last, own `MIN_SELECTION_SEC`). Seven new lane tests, all
  verified to fail before the change, plus a `clampEdge` unit test.
- **§6 / finding 5.7** — the on-edge-breakpoint question is DECIDED and documented on `retimeRange`:
  the point is interior and travels with the stretch, because the commonest stretch is grabbing an
  edge to drag exactly that point outward. Both halves pinned: exact points + sampled slope for the
  on-edge case, and the full two-sided invariant for a selection whose edges are off any breakpoint.

**Finding 5.5 does not survive.** `edgeAt`'s `d0 <= d1` tiebreak IS nearest-wins — a press right of
the midpoint already resolved to `t1`, so the far edge was never ungrabbable. The midpoint split now
in the code is the same rule written legibly; its test is labelled as characterizing, not fixing.
What WAS unreachable inside a narrow halo — starting a fresh range, clearing the old one — the
movement threshold fixes.

### §7.5 browser smoke — RUN, and it paid for itself

Driven through a real Chrome against the studio dev server (`bun run dev`, :5190) on a throwaway
project with `bgm.wav` + `narration.wav`, real CDP mouse events so pointer capture is real.
Confirmed live: Delete empties the range and does NOT destroy the clip (wa-15); Cmd+C is claimed by
the range, no "Copied clip" toast (wa-17 arbitration); clicking another clip then pasting
immediately writes to NEITHER clip; an out-of-clip playhead declines the paste; a second Cmd+V
chains after the first; right-click → Dip; the selection tracks the pointer through a stretch with a
live hint and `col-resize`; **and the same edge stretches twice in a row, pressed exactly on the
breakpoint the first stretch left there, at the envelope's own height** (finding 5.3); a bare click
on an edge clears the selection and writes nothing.

### NEW finding A — the player store's automation attribute never refreshes after a commit

`handleDomAttributeQuietCommit` deliberately skips the preview refresh, and nothing else resyncs the
element's `data-automation` in the player store. Measured: after two pastes the FILE held four
points while `__playerStore.getState().elements` still held the original two — the store was frozen
at the last preview parse for the whole session.

This splits the feature in half. The component paths (shape menu, simplify, stretch, point drag)
compose against the lane's local `draft` and look correct. The keyboard paths — **Delete, Cmd+C,
Cmd+V** — resolve through `lanes.bind()` and therefore read the frozen store. Consequences, all
observed: a second range op silently discards what the first one wrote outside its own span (a
chained paste dropped the first paste's leading breakpoint), and Cmd+C can copy a shape that is no
longer on screen.

The mirror image of the same split: after Cmd+Z the lane keeps drawing the pre-undo envelope,
because the draft is released only when the `automation` prop's OBJECT IDENTITY changes and
`automationLaneData` caches parses by attribute text — undo restores text that is already cached, so
identity is unchanged and the draft survives. A right-click → Dip after an undo composed against the
undone envelope and lost a breakpoint.

Introduced by `66df209b5` / `885b1eee7` / `a2df6c6f7`, all below `wa-15`, so out of scope here and
deliberately not touched. It is the biggest remaining risk to this feature and wants its own branch:
one source of truth, or a write receipt the draft can wait on rather than an identity compare.

### NEW finding B — audio elements multiply in the source file

Mid-smoke the fixture went from one `<audio id="bgm">` to three (`bgm`, `bgm-2`, `bgm-3`), all
carrying the SAME `data-hf-id="hf-snao"`, written into the source HTML. The duplicate rows appeared
in the store before they appeared on disk, then a later commit materialised them. Also the cause of
apparently flaky drag-selects during the smoke: only one of the three rows is selected, so the other
lanes are read-only and swallow the gesture. dom-edit / patcher level, far below this stack, but it
makes automation on audio hazardous — a user's composition gains junk clips.

### Next

`wa-15` and `wa-16` were not touched (nothing was open on them). Nothing is pushed; each branch is
fixed in place, so the four PRs update rather than gaining a fifth. Findings A and B want their own
branch below `wa-15`.

---

## 9. Carve fix, amended in place (2026-08-06, same session)

The voiceover carve's "Analyse and apply" was reported as not working. Two things:
the button is disabled until a voice is chosen in "Listen to", with nothing saying so;
and the real defect, below.

**`intelligibilityBias` had no authority.** Scoring was `power × weight` with
`weight = 1 - bias + bias * shaped`, bounded below by `1 - bias`, so the bias could move a
ranking by at most `10*log10(1/(1 - bias))` — 5.2 dB at the 0.7 default. Speech tilts 20-30 dB
across the candidate bands, so every bias under ~0.95 ranked exactly like bias 0 and carved the
fundamental: the outcome the bias exists to prevent, per its own doc comment. Measured on
`examples/docs-reference-project/assets/narration.wav`: 160/250/400 Hz before, 400/1600/2500 Hz
after. Verified live in Studio (400 Hz −11.83, 1600 Hz −21.72, 2500 Hz −12.52 at the user's
maxCutDb of 21.72).

Fixed by scoring in dB: `powerDb − bias * 30 dB * (1 − shaped)`. Bias 0 is unchanged (raw power);
relative cut depths now come from a dB difference. Three tests added, two of which fail without
it — the old fixture spread its bands over 2 dB, where 5 dB of authority looks decisive.

Not fixed, noted in a test comment: `CANDIDATE_CENTERS_HZ` steps ~2/3 octave while each band is
1/3 octave wide, so there are gaps — a 2 kHz tone is invisible to the analysis.

### The amend and the 16-branch restack

The carve analysis is `79a532341`, INSIDE `wa-3-fx-render` (not `wa-4-carve` — that branch is a
stale duplicate outside the stack). Amended to `65629692d`, then every branch above was replayed:

```
git rebase --onto <new-parent-tip> <old-parent-tip> <branch>
```

run parent-first down the chain, reading each new tip from the ref as it lands (script in the
session log). Zero conflicts — nothing else in the stack touches `audioCarve.{ts,test.ts}`. Commit
count unchanged at 54.

New tips for the four branches under review: `wa-15` `1b4f8cd8d`, `wa-16` `559e96651`,
`wa-17` `ce90d046b`, `wa-18` `c1dae3e13`. Still nothing pushed; all four remotes stale.

**Trap that cost half an hour, worth knowing:** vitest resolves `@hyperframes/core` through the
package's `node` export to `packages/core/dist`, which is a build artifact. The studio dev server
was running while HEAD was detached on the old carve commit, so it rebuilt `dist` from that tree —
and 19 studio tests started failing on an empty-looking FX registry (`automatable` present 18 times
in src, once in dist). Nothing to do with the restack: the same tests failed at the pre-restack tip.
`bun run --filter @hyperframes/core build` restored them. Kill the dev server before checking out
another commit, and re-run the core build after any detached-HEAD excursion.

Also uncommitted on `wa-18`: `AUTOMATION_LANE_H` 48 → 72 (taller automation lanes, drawing area
36px → 60px), left out of a commit pending a look at the height.
