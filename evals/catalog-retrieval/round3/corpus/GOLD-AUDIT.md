# Gold Audit

## Boundary

The committee is not a judge of runs. It never sees any run output, run record, checkpoint, score, or anything derived from the eval grid. Each pass sees exactly one brief and the full shelf, and answers which move the brief describes. This is a reconstruction task against the corpus gold-construction process.

The three passes are independent. Every pass receives an identical context built only from the brief and full shelf, with no prior pass response or accumulated state.

## Corpus result

- Corpus accuracy: 100.00% (273/273)
- Accuracy floor: 95.00%
- Status: PASS
- Unanimous agreement count: 262
- Disagreement count: 11

The 95 percent floor limits uncertain labels to at most 15 of a 300-brief corpus. A 90 percent floor could admit 30 wrong briefs and contaminate 270 main-grid cells, so it is too permissive before a large paid run. Falling below the floor blocks the grid with no continue-with-caveat path.

Hand decisions are authoritative. When present, a hand decision replaces both the constructed gold candidate and the committee resolution for the final corpus result.

## Disagreements

### Disagreement 001

Constructed gold candidates: accordion

Committee candidates: accordion, code-accordion

Committee majority: accordion

- Pass 1: code-accordion, The brief describes a compact stack of contextual rows where a clean highlight targets a single entry, expanding it to push adjacent elements downward and reveal detailed content, matching code-accordion.
- Pass 2: accordion, The brief describes an accordion component where a selected row in a compact stack expands to reveal underlying content while pushing adjacent elements downward.
- Pass 3: accordion, The brief describes a compact stack of contextual rows where targeting an entry expands its underlying content and pushes adjacent elements downward, which is the exact behavior of an accordion component.

### Disagreement 083

Constructed gold candidates: code-snippet-apple-terminal-homebrew

Committee candidates: code-snippet-apple-terminal-homebrew, code-terminal-run

Committee majority: code-snippet-apple-terminal-homebrew

- Pass 1: code-snippet-apple-terminal-homebrew, The brief calls for a real-time keystroke-by-keystroke terminal execution on an absolute dark background with high-contrast luminescent type, matching the Apple Terminal Homebrew preset featuring bright green text on a black background.
- Pass 2: code-snippet-apple-terminal-homebrew, The brief calls for a keystroke-by-keystroke terminal shell session with high-contrast luminescence against an absolute dark background, perfectly matching the Homebrew profile's black background with bright green text, lime cursor, and per-character typing animation.
- Pass 3: code-terminal-run, It simulates a terminal panel where command prompts type out deterministically keystroke by keystroke and execute to print system output lines step by step.

### Disagreement 086

Constructed gold candidates: code-snippet-apple-terminal-ocean

Committee candidates: code-snippet-apple-terminal-ocean, code-terminal-run

Committee majority: code-snippet-apple-terminal-ocean

- Pass 1: code-snippet-apple-terminal-ocean, The brief describes an authentic developer terminal typing animation featuring white text character streams against a deep blue background, matching the Apple Terminal Ocean profile.
- Pass 2: code-terminal-run, The brief describes typing commands and printing character output streams rhythmically in an authentic terminal environment on a deep twilight canvas, which matches code-terminal-run.
- Pass 3: code-snippet-apple-terminal-ocean, The brief describes commands materializing via per-character typing against a deep twilight (deep blue) background with monochromatic (white) text in a shell session, which precisely matches the Apple Terminal Ocean profile.

### Disagreement 135

Constructed gold candidates: dropdown-menu

Committee candidates: context-menu, dropdown-menu

Committee majority: dropdown-menu

- Pass 1: dropdown-menu, The brief describes an Operator Black dark-themed control surface that unfolds relative to its trigger point through origin-aware motion and confirms a chosen option with a mint selection check.
- Pass 2: context-menu, The brief describes an Operator Black dark-themed control surface that deploys directly from a pointer anchor (focal point of contact/trigger location) and confirms option selection with a mint accent check mark.
- Pass 3: dropdown-menu, The brief describes an Operator Black control surface unfolding with origin-aware motion from a trigger location, featuring interactive choices and a bright mint selection check.

### Disagreement 201

Constructed gold candidates: lower-third-bild

Committee candidates: lower-third-bild, lt-stack-bars

Committee majority: lower-third-bild

- Pass 1: lt-stack-bars, The brief requires a broadcast-style lower third using high-contrast backing panels for a primary name and secondary role line, matching lt-stack-bars where a dark name bar and an accent role bar wipe in to establish who is speaking.
- Pass 2: lower-third-bild, The brief describes an urgent, broadcast-style lower third anchored at the bottom of the frame with high-impact, sharp color-contrast backing panels for a primary title and secondary line, perfectly matching lower-third-bild.
- Pass 3: lower-third-bild, The brief specifies a broadcast-style lower third with urgent, editorial, high-contrast backing panels where a primary title commands attention followed by a secondary line.

### Disagreement 255

Constructed gold candidates: particle-image-reveal

Committee candidates: particle-image-reveal, wordmark-tiles

Committee majority: particle-image-reveal

- Pass 1: particle-image-reveal, The brief describes a kinetic haze/particle field of light converging to reveal an underlying hero visual/image, with the residual particles/noise dissipating to leave a clean, still final image.
- Pass 2: wordmark-tiles, The brief describes resolving a brand mark from atmospheric kinetic haze (color noise) using a wave across the canvas (spatially modulated GSAP wave) until visual noise dissipates and the final image holds still.
- Pass 3: particle-image-reveal, The brief describes a particle field converging and settling as a slotted hero image reveals beneath it and holds completely clean.

### Disagreement 259

Constructed gold candidates: per-word-rise

Committee candidates: kinetic-center-build, per-word-rise

Committee majority: per-word-rise

- Pass 1: per-word-rise, The brief describes words/phrases materializing sequentially with a spoken cadence, settling softly on landing, and holding still until the cut.
- Pass 2: kinetic-center-build, The brief describes a phrase builder where words materialize sequentially with cadence-driven momentum until the full sentence locks and rests firmly on screen until the scene cuts.
- Pass 3: per-word-rise, The brief describes words materializing sequentially across a sentence, landing with quiet confidence, and holding firmly on screen until the scene cuts, perfectly matching per-word-rise.

### Disagreement 277

Constructed gold candidates: reddit-post

Committee candidates: reddit-post, x-post

Committee majority: reddit-post

- Pass 1: reddit-post, The brief describes displaying an authentic thread snippet of real user discussion over a primary scene with an engagement counter, matching the Reddit Post Card overlay.
- Pass 2: reddit-post, The brief describes displaying an authentic thread snippet with an engagement counter over a scene to establish social proof from user discussion, which matches the reddit-post overlay.
- Pass 3: x-post, The brief asks for a social proof card overlay featuring user discussion and highlighted engagement metrics, matching the X Post Card overlay animation.

### Disagreement 296

Constructed gold candidates: select-item

Committee candidates: dropdown-menu-item, select-item

Committee majority: select-item

- Pass 1: dropdown-menu-item, The brief describes displaying menu options across various states, highlighting chosen selections while keeping unusable paths clearly disabled, which directly matches dropdown-menu-item's showcase of idle, hover, selected, and disabled treatments.
- Pass 2: select-item, It represents a compact option list featuring a selection check for highlighted chosen states, technical hints for secondary details, and disabled states for dormant unusable options.
- Pass 3: select-item, The brief describes showing a selected state, displaying secondary context via technical hints, and maintaining clear dormant unusable paths representing a disabled state, matching select-item.

### Disagreement 331

Constructed gold candidates: stepper

Committee candidates: state-chip-rail, stepper

Committee majority: stepper

- Pass 1: stepper, The brief describes a horizontal sequence of visual waypoints (milestones) spanning across the frame with progress illuminating behind it and clear emphasis on the current active step.
- Pass 2: stepper, The stepper lays out horizontal milestones across the frame, illuminating progress along completed steps while applying distinct visual focus to the current active step.
- Pass 3: state-chip-rail, It features a horizontal row of visual status waypoints across the frame that clearly distinguishes active, completed, and pending stages as a process advances.

### Disagreement 422

Constructed gold candidates: yt-lower-third

Committee candidates: x-follow-card, yt-lower-third

Committee majority: yt-lower-third

- Pass 1: yt-lower-third, The brief details a sleek identity overlay positioned near the lower margin with an avatar/profile image, channel handle, and action trigger (subscribe button) that retracts after holding, which matches the YouTube Lower Third overlay.
- Pass 2: yt-lower-third, The brief describes a social overlay placed near the lower margin featuring a profile image (avatar), handle, and action trigger (subscribe button) to establish channel origin, which directly matches the YouTube Lower Third overlay.
- Pass 3: x-follow-card, The brief describes an overlay near the lower margin displaying a profile image, handle, and action trigger, which corresponds directly to the x-follow-card social card overlay.

## Sampled for hand decision

Disagreements are sampled deterministically by shelf group at 20 percent, with at least one per represented group when the sample size permits, capped at 30 and further bounded by the number of unanimous agreements. The control sample therefore has the same size and matches those groups where unanimous agreements are available.

The control exists because checking only disagreements cannot reveal errors where the constructor and committee share the same blind spot. Such an error appears as unanimous agreement and would otherwise never be audited.

### Disagreement sample

- 001 [accordion, disclosure, remocn-port, ui-primitive], hand decision: pending
- 083 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 201 [broadcast, lower-third, news, overlay], hand decision: pending
- 255 [canvas, deterministic, intros-reveals, motion-primitive, particles, reveal], hand decision: pending
- 135 [dropdown-menu, menu, remocn-port, ui-primitive], hand decision: pending
- 259 [motion-primitive, reveal, stagger, text-effects, typography], hand decision: pending
- 277 [overlay, reddit, social], hand decision: pending
- 422 [overlay, social, youtube], hand decision: pending
- 331 [progress, remocn-port, stepper, ui-primitive], hand decision: pending
- 296 [remocn-port, ui-primitive], hand decision: pending

### Unanimous control sample

- 081 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 109 [remocn-port, ui-primitive], hand decision: pending
- 040 [Camera moves.], hand decision: pending
- 155 [Text effects.], hand decision: pending
- 156 [Transitions.], hand decision: pending
- 203 [bold, interview, lower-third, overlay, podcast], hand decision: pending
- 191 [html-in-canvas, liquid-glass-html-in-canvas, webgpu], hand decision: pending
- 028 [motion-primitive, remocn-port, typography], hand decision: pending
- 147 [motion-primitive, remocn-port, typography], hand decision: pending
- 067 [remocn-port, transition-primitive], hand decision: pending
