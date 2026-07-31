# Video primitive shelf (25 moves)

How to use this file, frame worker:

1. Check this shelf first. When a storyboard mechanic matches an entry's use_when, use that primitive.
2. Read what and avoid_when together so the visible move and its documented constraints both fit the shot.
3. Pass only variables documented by the primitive, and follow its stated slot or markup contract when supplying content.

### caliper-caption-rail

group: Annotation.
what: A specification callout opens along a measurement rail, then the instrument rotates 90 degrees onto a long object axis and locks the type against it.
use_when: A portrait shot needs a large axial measurement label physically aligned with a long, narrow object.
avoid_when: Do not use it for 16x9, because its aspects declaration does not include 16x9 and the header makes the 1080x1920 portrait format non-negotiable.
pairs_with: marker-highlight, receipt-card.
variables: none documented.

### caption-camera-follow

group: Camera moves.
what: New words stay fixed on an expanding page while the camera pulls back exponentially until the complete sentence is readable.
use_when: A sentence must accumulate word by word while each arrival reads at roughly the same screen size.
avoid_when: Avoid placing scripts outside the composition root, because the host copies that markup without its behavior and produces a black card with no timeline.
pairs_with: kinetic-type-swap, glyph-ring-assemble.
variables: none documented.

### chevron-pill-card-morph

group: Interface morphs.
what: One surface changes from a circle to a pill to a card while one accent element stretches from a chevron disc into the card action bar.
use_when: A compact search or selection control must remain visibly continuous as it expands into a checkout-style card.
avoid_when: Do not use it when verified 16x9 support is required, because its aspects declaration does not include 16x9.
pairs_with: press-ripple, state-chip-rail.
variables: none documented.

### depth-rack-focus

group: Camera moves.
what: A sharp foreground dissolves into bokeh as a blurred message behind it resolves while the whole stack creeps forward.
use_when: Attention must transfer once from a near plane to a message on a far plane.
avoid_when: Avoid it when animated blur is unacceptable, because blur on the foreground and message planes is the stated focus mechanic.
pairs_with: focus-rack, z-punch-through.
variables: kicker (string, default "Q3 RESULTS"): small line above the message. headline (string, default "Revenue doubled"): message that resolves. accent (enum amber, blue, or violet, default amber): foreground bokeh color.

### echo-trail

group: Motion trails.
what: A slotted subject travels along an authored path with lagged ghost copies that collapse into it and disappear at rest.
use_when: One moving subject needs an onion-skin trail that shows its recent positions before a clean landing.
avoid_when: Avoid it when more than six ghosts or a lag outside 0.03 to 0.3 seconds is required, because echoes are limited to 2 through 6 and delta is clamped to that range.
pairs_with: particle-text-dissolve, orbit-ring-camera.
variables: echoes (number from 2 to 6, default 4): ghost copy count. delta (number in seconds, default 0.09): lag between successive ghosts, clamped from 0.03 to 0.3. path (enum sweep, rise, or arc, default "sweep"): authored traversal preset. accent (enum green, blue, or violet, default "green"): ghost and subject accent color. exit (enum none, fade, or up, default "none"): departure behavior, with none holding the final frame.

### focus-rack

group: Camera moves.
what: Focus moves exactly once from a sharp near card to a blurred, dim far card as blur, scale, and parallax change together.
use_when: Two cards at different apparent depths need one clear handoff from the foreground state to the background state.
avoid_when: Avoid it when focus must alternate repeatedly, because the rack occurs exactly once over 0.7 seconds.
pairs_with: depth-rack-focus, match-cut.
variables: label_a (string, default "Draft"): foreground card label. label_b (string, default "Published"): background card label. accent (enum green, blue, or violet, default "blue"): focus highlight color.

### glyph-ring-assemble

group: Text effects.
what: Arc-set letters leave a wordmark in reverse reading order, each completes one full orbit around a shared ring, and the letters close back into the word.
use_when: A readable wordmark must break into individually staggered glyphs without leaving a single shared circular path.
avoid_when: Avoid it when every glyph must remain visible throughout the orbit, because a glyph crossing the central mark vanishes for about 0.3 seconds.
pairs_with: kinetic-type-swap, version-plate-type.
variables: none documented.

### grade-split-reveal

group: Transitions.
what: A hard vertical edge sweeps left to right across two aligned copies of one plate, pauses at the midpoint for comparison, then reveals the graded copy across the full frame.
use_when: The same image or video must show a direct before-and-after color comparison in one frame.
avoid_when: Avoid it for text, SVG, or ordinary DOM content, because the documented color grading applies only to image and video media.
pairs_with: halftone-dissolve, match-cut.
variables: none documented.

### halftone-dissolve

group: Transitions.
what: Accent dots appear on a fixed grid, open into windows onto scene B, and merge until scene B replaces scene A.
use_when: Two slotted scenes need a textured transition whose reveal can sweep left to right, grow from center, or scatter from a seeded map.
avoid_when: Avoid cueing the dissolve so late that its 1.3-second transition and any exit cannot fit, because dissolve_at is clamped to keep both inside the clip.
pairs_with: grade-split-reveal, match-cut.
variables: dot_size (enum small, medium, or large, default not documented): grid pitch. direction (enum ltr, center, or noise, default not documented): threshold ordering. dissolve_at (number in seconds, default not documented): dissolve start time, clamped to fit the transition and exit. accent (enum green, blue, or violet, default not documented): ink dot color. exit (enum none, fade, or up, default "none"): departure behavior, with none holding scene B.

### kinetic-type-swap

group: Text effects.
what: A fixed sentence rolls one masked word slot vertically through a list of options without changing the sentence layout.
use_when: A headline must keep its prefix and suffix stationary while one word changes through several authored choices.
avoid_when: Avoid it when the sentence may reflow during a swap, because the slot is pre-sized to the widest option and all options occupy one grid cell.
pairs_with: caption-camera-follow, marker-highlight.
variables: prefix (string, default "Ship"): fixed text before the rolling slot. options (string, default "faster,smarter,together"): comma-separated words shown in order. suffix (string, default ""): fixed text after the rolling slot. cues (string, default ""): comma-separated seconds for each word swap. accent (enum green, blue, or violet, default "green"): rolling word color. exit (enum none, fade, or up, default "none"): optional departure behavior.

### marker-highlight

group: Annotation.
what: A short display line settles in, then one SVG marker stroke draws over the first matched word or phrase.
use_when: One specific word or short phrase in a single line needs a timed highlight, circle, underline, or scribble.
avoid_when: Avoid it when the emphasized phrase must wrap, because the header requires the match to stay on one line.
pairs_with: kinetic-type-swap, receipt-card.
variables: text (string, default not documented): full display line. emphasis_word (string, default not documented): first case-insensitive substring to mark, with empty or unmatched text producing no marker. style (enum highlight, circle, underline, or scribble, default not documented): marker shape. draw_at (number in seconds, default not documented): draw cue, clamped so the stroke finishes before exit. accent (enum green, blue, or violet, default not documented): marker ink color. exit (enum none, fade, or up, default "none"): departure behavior.

### match-cut

group: Transitions.
what: Scene A drives a circle into center-frame geometry, a hard single-frame swap reveals scene B with a matching circle, and that circle immediately shrinks as scene B settles.
use_when: Two scenes share a circle that can carry motion continuously across a precise hard cut.
avoid_when: Avoid it when a crossfade is required, because scene A becomes invisible and scene B visible at the same timeline instant.
pairs_with: grade-split-reveal, z-punch-through.
variables: accent (enum green, blue, or violet, default green): matched-circle color. label_a (string, default "Start"): scene A button label. label_b (string, default "Done"): scene B result label.

### orbit-ring-camera

group: Camera moves.
what: A camera tracks a lit head around a tilted ring, then dollies out to reveal the full ellipse, eight stations, and three rotating inner rails.
use_when: A close tracked journey along a loop must resolve into a complete system view with all stations visible.
avoid_when: Avoid it when square or portrait framing needs the same composition quality as landscape, because those aspects are only re-aimed while the move is composed for 16x9.
pairs_with: echo-trail, plan-room-audit.
variables: none documented.

### particle-text-dissolve

group: Text effects.
what: Seeded particles either assemble into a crisp text line or depart from that line into a fading cloud.
use_when: A single text line must visibly form from particles or disintegrate into them with a left-to-right front.
avoid_when: Avoid the out direction when visible content must remain during the hold, because that direction ends on an empty stage.
pairs_with: kinetic-type-swap, echo-trail.
variables: text (string, default "Dissolve"): line that assembles or dissolves. direction (enum in or out, default "in"): particle travel direction. density (enum low, med, or high, default "med"): particle count cap. accent (enum green, blue, or violet, default "green"): text and particle color. exit (enum none, fade, or up, default "none"): departure behavior.

### persona-card-fan

group: Card assembly.
what: Four portrait cards deal onto the right side one at a time while displaced cards scale and rotate into a fixed outer wedge that tightens as it fills.
use_when: Options must appear beside a presenter while the deepest card stays pinned and newer cards subdivide the same fan.
avoid_when: Avoid it when portrait or square framing must be as fully composed as landscape, because those aspects are only kept inside the frame and the move is composed for 16x9.
pairs_with: thread-message-stack, receipt-card.
variables: none documented.

### pill-row-collapse

group: Process sequences.
what: Five labeled pills build left to right, hold for reading, then pills two through five spread and clear while the first pill glides to center and becomes active.
use_when: A five-stage process must narrow visibly to its first stage after all five labels have been shown together.
avoid_when: Avoid it when a label may be bisected during reveal, because the type-in clip is deliberately quantized to character boundaries.
pairs_with: state-chip-rail, rank-list-settle.
variables: none documented.

### plan-room-audit

group: Annotation.
what: A floor plan sheet rotates clockwise into square while its walls draw, then five rooms fill and receive leader tags in reading order.
use_when: A portrait floor-plan scene needs a room-by-room audit whose count stays synchronized with the filled rooms.
avoid_when: Avoid it when the shot must be natively composed for landscape, because the header states that it is native to 9x16 and composed only for that orientation.
pairs_with: caliper-caption-rail, whiteboard-ink.
variables: none documented.

### press-ripple

group: Interaction.
what: A cursor decelerates onto a positioned target, compresses with it, releases two ripple rings, and exits while the pressed state remains.
use_when: A caller-supplied interface target needs one explicit press gesture with a visible impact and release.
avoid_when: Avoid cueing the press outside the safe gesture window, because press_at is clamped so arrival, compression, ripple, and exit all fit inside the duration.
pairs_with: chevron-pill-card-morph, state-chip-rail.
variables: label (string, default not documented): text in the default pill, ignored when the target slot is replaced. target_x (number percent, default not documented): target-zone horizontal center in the host box. target_y (number percent, default not documented): target-zone vertical center in the host box. press_at (number in seconds, default 1.4): time when compression begins. cursor (enum light or dark, default not documented): pointer appearance. accent (enum green, blue, or violet, default not documented): ripple and pressed-fill color. exit (enum none, fade, or up, default "none"): departure behavior.

### rank-list-settle

group: List assembly.
what: A ranked list rolls upward under a fixed focus line, washes out passing rows, and stops with the final winning row fully lit on that line.
use_when: A comparison must build to one winner whose emphasis is determined by its physical position at the stop.
avoid_when: Avoid it when the winner cannot be the last row, because the geometry parks only the last row on the focus line and requires that row to carry the winner class.
pairs_with: pill-row-collapse, state-chip-rail.
variables: title (string, default "Cost per commit"): section label on whose line the winning row lands.

### receipt-card

group: Card assembly.
what: A tilted quote card flies in from the right, settles flat, pushes in slowly, then fills selection boxes behind one phrase while the marked words turn white.
use_when: A portrait quote card needs one phrase marked in place after the card has landed.
avoid_when: Avoid it when landscape must be the native composition, because the header identifies the card as 9x16 native and authors its safe zone for 9x16.
pairs_with: marker-highlight, persona-card-fan.
variables: none documented.

### state-chip-rail

group: Process sequences.
what: A row of status chips snaps through ordered states on scheduled cues while active, completed, and pending chips take distinct appearances.
use_when: A discrete state machine needs seek-exact, instantaneous advances and optional badges beside one activated state.
avoid_when: Avoid it when more than eight states or more than four badges are required, because extra states are dropped and badges are capped at four.
pairs_with: pill-row-collapse, press-ripple.
variables: states (string, default "Queued,Reading,Drafting,Done"): comma-separated chip labels in machine order, limited to 2 through 8. times (string, default ""): comma-separated activation times for each advance, with invalid entries replaced, clamped, and forced monotonic. badge_state (number, default 1): state index beside which badges appear, clamped to the state range. badges (string, default ""): comma-separated badge labels, with empty disabling badges and at most four rendered. accent (enum green, blue, or violet, default green): active-chip accent color. exit (enum none, fade, or up, default "none"): departure behavior.

### thread-message-stack

group: List assembly.
what: Message bubbles land on the bottom line over a moving background, push older messages upward under a mask, and show a typing pill before each incoming message.
use_when: A conversation must build through alternating incoming and outgoing bubbles while the background continues moving.
avoid_when: Avoid it when frame zero must be empty, because the thread deliberately opens on three settled bubbles.
pairs_with: persona-card-fan, receipt-card.
variables: --tms-roll-bg (color, default not documented): base under the moving blobs and letterbox color for replacement footage. --tms-out-fill (color, default #2D89E1): outgoing bubble fill. --tms-out-ink (color, default not documented): outgoing bubble text color. --tms-in-fill (color, default not documented): incoming bubble fill. --tms-in-ink (color, default not documented): incoming bubble text color. --tms-tag-ink (color, default not documented): sender tag text color. --tms-radius (length, default not documented): bubble corner radius.

### version-plate-type

group: Text effects.
what: Oversized glyph plates stamp into a cluster, hard-cut to fitted words inside a selection box, then the box widens, shortens, closes on the letters, and pushes off frame.
use_when: A word sequence must read as text being manipulated one axis at a time by a visible selection box.
avoid_when: Avoid it when every word must retain its natural proportions, because resolved words are fitted to one constant ink width and the box separately changes width and height.
pairs_with: glyph-ring-assemble, kinetic-type-swap.
variables: none documented.

### whiteboard-ink

group: Annotation.
what: SVG paths draw one stroke at a time while a pen nib follows each active path tip and hops between strokes.
use_when: A preset or caller-supplied SVG sketch needs sequential ink drawing with a traveling pen actor and a caption after completion.
avoid_when: Avoid supplying non-path slot content, because only path elements inside the strokes group become the drawing.
pairs_with: marker-highlight, plan-room-audit.
variables: sketch (enum bulb, flow, or rocket, default not documented): preset sketch, ignored when the strokes slot contains paths. caption (string, default not documented): short line shown after drawing completes. pen (enum show or hide, default not documented): traveling nib visibility. accent (enum green, blue, or violet, default not documented): highlight-stroke color. exit (enum none, fade, or up, default "none"): completed-lockup departure behavior.

### z-punch-through

group: Transitions.
what: The camera moves through an opening in a front wall as that wall passes the lens and the back plane advances into its settled state.
use_when: A scene change must feel like forward travel through an aperture rather than a flat scale zoom.
avoid_when: Avoid it when the clip needs a hold, because the documented 2.10-second envelope is filled by the move and has no hold.
pairs_with: match-cut, depth-rack-focus.
variables: front (string, default "BEFORE"): label on the wall. back (string, default "AFTER"): label on the back plane. accent (enum blue, violet, or amber, default blue): light behind the opening.
