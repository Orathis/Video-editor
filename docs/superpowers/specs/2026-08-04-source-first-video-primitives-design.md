# Source-first video primitives design

Status: approved in Miguel's smart catalog design thread on 2026-08-04.

Visual source of truth: `docs/plans/2026-08-04-video-primitives-source-first.html`

## Outcome

HyperFrames video primitives should be more customizable than React components. Installing a primitive copies its complete HTML, CSS, and JavaScript into the user's project. Structured inputs accelerate common generation tasks, but they never become the only interface.

## Current constraint

The current composition variable model supports `string`, `number`, `color`, `boolean`, `enum`, `font`, and `image`. It does not model arbitrary arrays or nested objects. Several current primitives therefore hardcode repeatable content in their HTML. `thread-message-stack.html`, for example, authors a fixed set of message bubbles and fixed push distances.

Extending every Studio and runtime variable surface to support arbitrary nested values would make the first implementation much larger than the product proof requires.

## Approved contract

Each installed primitive is ordinary, editable HyperFrames source. A primitive may also expose one optional JSON data seam:

```html
<script type="application/json" data-hf-primitive-data>
{
  "messages": [
    { "side": "out", "text": "Ship the new primitive?" },
    { "side": "in", "text": "Make it twenty messages." }
  ],
  "timing": { "stagger": 0.42, "hold": 0.8 }
}
</script>
```

The primitive's own JavaScript reads this data and creates its markup or scene objects. Catalog installation or an agent can materialize user-provided data into the copied file. The user can then edit the data, markup, styles, timing, effects, rendering logic, and media directly.

Common scalar values may still be promoted into the existing composition variable system for Studio controls. This is optional and additive.

## User journey

1. The user describes the desired video element, such as an iMessage thread with 20 messages.
2. Local catalog discovery returns installable candidates immediately.
3. The user explicitly chooses Smart discovery when they want a broader semantic match. That action starts HeyGen OAuth and returns to the same query and selected primitive.
4. The CLI installs the complete primitive source.
5. The agent or installer writes the requested structured data into the primitive's JSON seam.
6. The user can render immediately or edit any source line.
7. The existing HyperFrames lint, check, preview, and render path remains authoritative.

The funnel should measure local query, Smart selection, OAuth completion, primitive install, and first successful render.

## First migration

Convert `thread-message-stack.html` from a fixed bubble list to an arbitrary `messages[]` collection while preserving its authored layout and timeline behavior.

Acceptance example:

- A user requests 20 messages.
- The installed primitive renders all 20 in order.
- Incoming and outgoing sides remain customizable per item.
- The user can change any bubble, selector, keyframe, or script directly.
- No framework ejection or wrapper removal is required.

## Migration archetypes

- Collections: Thread Message Stack, Rank List Settle, Pill Row Collapse, State Chip Rail, Persona Card Fan, Plan Room Audit.
- Copy and cards: Kinetic Type Swap, Version Plate Type, Marker Highlight, Caliper Caption Rail, Caption Camera Follow, Receipt Card, Chevron Pill Card Morph, Grade Split Reveal.
- Effects and transitions: Echo Trail, Halftone Dissolve, Particle Text Dissolve, Press Ripple, Whiteboard Ink, Match Cut.
- Spatial and camera: Depth Rack Focus, Focus Rack, Orbit Ring Camera, Glyph Ring Assemble, Z Punch Through.

Only primitives with repeatable or externally supplied content need a JSON collection in the first pass. Scalar-only primitives can keep their current variable declarations and open source.

## V1 boundaries

Ship:

- One arbitrary JSON data seam inside installed source.
- One real collection migration, starting with Thread Message Stack.
- Catalog materialization of requested data into the copied source.
- Existing scalar Studio controls where they already fit.
- Existing runtime, GSAP registration, lint, check, preview, and render behavior.

Defer:

- A new universal component runtime.
- A nested object and array editor in Studio.
- A no-code scene graph that models every HTML and CSS capability.
- A shared slot protocol before at least two real migrations require the same slot.
- Any wrapper or compatibility layer that hides the installed source.

## Design rationale

The source file already expresses the full browser platform and HyperFrames motion contract. Making it canonical gives users an escape hatch by default, so the structured layer can stay deliberately small. This proves the high-value workflow, including the HeyGen authentication funnel, without committing the team to a universal schema engine first.

## Verification before implementation

- Confirm the installed source remains lintable and renderable with the JSON data block present.
- Mutation-test the 20-message example by changing collection length, side, timing, style, and markup.
- Verify a user can delete the optional data block and hand-author the source without breaking the primitive contract.
- Verify Smart OAuth returns to the same query and selected primitive.
- Keep the HTML explainer synchronized with any approved contract change.
