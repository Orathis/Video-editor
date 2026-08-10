# The casual author's view of the FX rack

The schematic direction won because it *adds information* — signal order,
routing, what is driven versus set. But information a casual author cannot read
is decoration, and the rack speaks entirely in Hz, dB and ratios. So the drawing
stays and the **language changes**.

`copy.mts` is the design work: a plain-language layer over every effect in the
registry. `build-preview.mts` renders the review page from it **plus the real
registry and preset catalogue**, and **fails** if any effect, parameter or
preset lacks copy — so the page cannot quietly omit something that ships.

```bash
bun plans/audio-fx-ux/build-preview.mts /tmp/rack-ux.html
```

## The three rules

1. **Two faces.** Every module opens plain: a name that says the outcome, one
   line about what it is for, and one control. The real parameters are one click
   away and never in the way. Nothing is hidden — it is ordered.
2. **One knob that matters.** A compressor has seven controls and an author
   wants one. Multi-knob modules get a single derived control, exactly as
   `carveProfile(strength)` already turns one number into six.
3. **Name the outcome, not the mechanism.** "Remove Rumble", not "High-pass".
   The DSP name stays in the corner of the module, so the vocabulary is taught
   rather than withheld — an author who learns "high-pass" here can carry it to
   any other tool.

## The shared vocabulary

Frequencies mean nothing to somebody who has not been taught them. `BANDS` names
the ranges in the words the same person would use unprompted — rumble, weight,
mud, middle, presence, edge, air — and every filter shows where it acts on that
one ruler. Naming them once makes the whole rack legible.

## What laying it all out exposed

**A preset can use the same module twice for different jobs.** "Clean Voice"
runs *Shape One Range* at node 02 (cutting mud at 250 Hz) and again at node 04
(adding clarity at 3 kHz). Read down the rack, an author sees the same words
twice and cannot tell them apart.

So one plain name per *effect* is not enough: a preset's node needs its own
**role label** — "Reduce Mud", "Add Clarity" — which means copy belongs on the
preset node as well as on the effect. This is invisible in a catalogue of cards
and obvious the moment every preset is drawn as the chain it actually builds.

## The collapsed state is a sentence

Collapsed is the most-seen state by a distance: a rack of six modules is six
collapsed lines and nothing else. So `SUMMARY` writes each one as a phrase about
what is happening to the sound — "Cutting everything below 80 Hz", "Evening out
— moderate", "A medium room, lightly" — rather than the parameter that happens
to be first. Numbers stay in, because they are what makes it checkable, but they
arrive inside a sentence. An author should be able to read their own mix top to
bottom.

Rendering all fifteen at their defaults immediately caught one: a freshly added
Peaking EQ sits at 0 dB, and "Lifting 1 kHz by 0 dB" describes a non-event as
though it were a setting — while being the FIRST thing an author reads after
adding one. It now says "Sitting on 1 kHz, doing nothing yet".

## Trap: do not use String.raw here

Bun escapes every non-ASCII character in a raw template literal into literal
`\uXXXX` text, so em-dashes, curly quotes and any glyph in a CSS `content`
property print as their escape sequence on the page. This cost three rounds of
chasing what looked like three unrelated rendering bugs. The template is a plain
literal; keep it that way, and use HTML entities for typographic characters.

## What still needs deciding

- Does the plain name **replace** the DSP name or sit beside it? Replacing is
  friendlier but strands what the author learns.
- Should the **menus** be organised by complaint ("my voice sounds boomy")
  rather than by effect family? The rack itself must stay in signal order,
  because order is audible — but the menus have no such constraint, and the
  preset section of the preview is written that way to show the difference.
- How much should **hover audition**? Hearing a preset before committing is the
  single strongest affordance here. Cheap for static presets; a measuring script
  has to analyse first and cannot preview instantly.

## Status

`copy.mts` is a proposal, not shipped code. When it lands it wants to be
`packages/core/src/audioFxCopy.ts` beside the registry, with the completeness
check as a test rather than a build step.

The `PROFILES` figures — what one knob derives at gentle/middle/strong — are
proposed values, not measured ones. They want the same before/after listen the
clip-before-duck fix got.
