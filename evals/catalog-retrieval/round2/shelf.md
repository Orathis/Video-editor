# Installable catalog shelf

### caliper-caption-rail
group: Annotation.
what: A specification callout opens along a measurement rail, then the instrument rotates 90 degrees onto a long object axis and locks the type against it.
use_when: A portrait shot needs a large axial measurement label physically aligned with a long, narrow object.
avoid_when: Do not use it for 16x9, because its aspects declaration does not include 16x9 and the header makes the 1080x1920 portrait format non-negotiable.
pairs_with: marker-highlight, receipt-card.
variables: none documented.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/caliper-caption-rail.html

### caption-camera-follow
group: Camera moves.
what: New words stay fixed on an expanding page while the camera pulls back exponentially until the complete sentence is readable.
use_when: A sentence must accumulate word by word while each arrival reads at roughly the same screen size.
avoid_when: Avoid placing scripts outside the composition root, because the host copies that markup without its behavior and produces a black card with no timeline.
pairs_with: kinetic-type-swap, glyph-ring-assemble.
variables: none documented.
sources: primitive+component
install_path: registry/components/caption-camera-follow

### chevron-pill-card-morph
group: Interface morphs.
what: One surface changes from a circle to a pill to a card while one accent element stretches from a chevron disc into the card action bar.
use_when: A compact search or selection control must remain visibly continuous as it expands into a checkout-style card.
avoid_when: Do not use it when verified 16x9 support is required, because its aspects declaration does not include 16x9.
pairs_with: press-ripple, state-chip-rail.
variables: none documented.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/chevron-pill-card-morph.html

### depth-rack-focus
group: Camera moves.
what: A sharp foreground dissolves into bokeh as a blurred message behind it resolves while the whole stack creeps forward.
use_when: Attention must transfer once from a near plane to a message on a far plane.
avoid_when: Avoid it when animated blur is unacceptable, because blur on the foreground and message planes is the stated focus mechanic.
pairs_with: focus-rack, z-punch-through.
variables: kicker (string, default "Q3 RESULTS"): small line above the message. headline (string, default "Revenue doubled"): message that resolves. accent (enum amber, blue, or violet, default amber): foreground bokeh color.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/depth-rack-focus.html

### echo-trail
group: Motion trails.
what: A slotted subject travels along an authored path with lagged ghost copies that collapse into it and disappear at rest.
use_when: One moving subject needs an onion-skin trail that shows its recent positions before a clean landing.
avoid_when: Avoid it when more than six ghosts or a lag outside 0.03 to 0.3 seconds is required, because echoes are limited to 2 through 6 and delta is clamped to that range.
pairs_with: particle-text-dissolve, orbit-ring-camera.
variables: echoes (number from 2 to 6, default 4): ghost copy count. delta (number in seconds, default 0.09): lag between successive ghosts, clamped from 0.03 to 0.3. path (enum sweep, rise, or arc, default "sweep"): authored traversal preset. accent (enum green, blue, or violet, default "green"): ghost and subject accent color. exit (enum none, fade, or up, default "none"): departure behavior, with none holding the final frame.
sources: primitive+component
install_path: registry/components/echo-trail

### focus-rack
group: Camera moves.
what: Focus moves exactly once from a sharp near card to a blurred, dim far card as blur, scale, and parallax change together.
use_when: Two cards at different apparent depths need one clear handoff from the foreground state to the background state.
avoid_when: Avoid it when focus must alternate repeatedly, because the rack occurs exactly once over 0.7 seconds.
pairs_with: depth-rack-focus, match-cut.
variables: label_a (string, default "Draft"): foreground card label. label_b (string, default "Published"): background card label. accent (enum green, blue, or violet, default "blue"): focus highlight color.
sources: primitive+component
install_path: registry/components/focus-rack

### glyph-ring-assemble
group: Text effects.
what: Arc-set letters leave a wordmark in reverse reading order, each completes one full orbit around a shared ring, and the letters close back into the word.
use_when: A readable wordmark must break into individually staggered glyphs without leaving a single shared circular path.
avoid_when: Avoid it when every glyph must remain visible throughout the orbit, because a glyph crossing the central mark vanishes for about 0.3 seconds.
pairs_with: kinetic-type-swap, version-plate-type.
variables: none documented.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/glyph-ring-assemble.html

### grade-split-reveal
group: Transitions.
what: A hard vertical edge sweeps left to right across two aligned copies of one plate, pauses at the midpoint for comparison, then reveals the graded copy across the full frame.
use_when: The same image or video must show a direct before-and-after color comparison in one frame.
avoid_when: Avoid it for text, SVG, or ordinary DOM content, because the documented color grading applies only to image and video media.
pairs_with: halftone-dissolve, match-cut.
variables: none documented.
sources: primitive+component
install_path: registry/components/grade-split-reveal

### halftone-dissolve
group: Transitions.
what: Accent dots appear on a fixed grid, open into windows onto scene B, and merge until scene B replaces scene A.
use_when: Two slotted scenes need a textured transition whose reveal can sweep left to right, grow from center, or scatter from a seeded map.
avoid_when: Avoid cueing the dissolve so late that its 1.3-second transition and any exit cannot fit, because dissolve_at is clamped to keep both inside the clip.
pairs_with: grade-split-reveal, match-cut.
variables: dot_size (enum small, medium, or large, default not documented): grid pitch. direction (enum ltr, center, or noise, default not documented): threshold ordering. dissolve_at (number in seconds, default not documented): dissolve start time, clamped to fit the transition and exit. accent (enum green, blue, or violet, default not documented): ink dot color. exit (enum none, fade, or up, default "none"): departure behavior, with none holding scene B.
sources: primitive+component
install_path: registry/components/halftone-dissolve

### kinetic-type-swap
group: Text effects.
what: A fixed sentence rolls one masked word slot vertically through a list of options without changing the sentence layout.
use_when: A headline must keep its prefix and suffix stationary while one word changes through several authored choices.
avoid_when: Avoid it when the sentence may reflow during a swap, because the slot is pre-sized to the widest option and all options occupy one grid cell.
pairs_with: caption-camera-follow, marker-highlight.
variables: prefix (string, default "Ship"): fixed text before the rolling slot. options (string, default "faster,smarter,together"): comma-separated words shown in order. suffix (string, default ""): fixed text after the rolling slot. cues (string, default ""): comma-separated seconds for each word swap. accent (enum green, blue, or violet, default "green"): rolling word color. exit (enum none, fade, or up, default "none"): optional departure behavior.
sources: primitive+component
install_path: registry/components/kinetic-type-swap

### marker-highlight
group: Annotation.
what: A short display line settles in, then one SVG marker stroke draws over the first matched word or phrase.
use_when: One specific word or short phrase in a single line needs a timed highlight, circle, underline, or scribble.
avoid_when: Avoid it when the emphasized phrase must wrap, because the header requires the match to stay on one line.
pairs_with: kinetic-type-swap, receipt-card.
variables: text (string, default not documented): full display line. emphasis_word (string, default not documented): first case-insensitive substring to mark, with empty or unmatched text producing no marker. style (enum highlight, circle, underline, or scribble, default not documented): marker shape. draw_at (number in seconds, default not documented): draw cue, clamped so the stroke finishes before exit. accent (enum green, blue, or violet, default not documented): marker ink color. exit (enum none, fade, or up, default "none"): departure behavior.
sources: primitive+component
install_path: registry/components/marker-highlight

### match-cut
group: Transitions.
what: Scene A drives a circle into center-frame geometry, a hard single-frame swap reveals scene B with a matching circle, and that circle immediately shrinks as scene B settles.
use_when: Two scenes share a circle that can carry motion continuously across a precise hard cut.
avoid_when: Avoid it when a crossfade is required, because scene A becomes invisible and scene B visible at the same timeline instant.
pairs_with: grade-split-reveal, z-punch-through.
variables: accent (enum green, blue, or violet, default green): matched-circle color. label_a (string, default "Start"): scene A button label. label_b (string, default "Done"): scene B result label.
sources: primitive+component
install_path: registry/components/match-cut

### orbit-ring-camera
group: Camera moves.
what: A camera tracks a lit head around a tilted ring, then dollies out to reveal the full ellipse, eight stations, and three rotating inner rails.
use_when: A close tracked journey along a loop must resolve into a complete system view with all stations visible.
avoid_when: Avoid it when square or portrait framing needs the same composition quality as landscape, because those aspects are only re-aimed while the move is composed for 16x9.
pairs_with: echo-trail, plan-room-audit.
variables: none documented.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/orbit-ring-camera.html

### particle-text-dissolve
group: Text effects.
what: Seeded particles either assemble into a crisp text line or depart from that line into a fading cloud.
use_when: A single text line must visibly form from particles or disintegrate into them with a left-to-right front.
avoid_when: Avoid the out direction when visible content must remain during the hold, because that direction ends on an empty stage.
pairs_with: kinetic-type-swap, echo-trail.
variables: text (string, default "Dissolve"): line that assembles or dissolves. direction (enum in or out, default "in"): particle travel direction. density (enum low, med, or high, default "med"): particle count cap. accent (enum green, blue, or violet, default "green"): text and particle color. exit (enum none, fade, or up, default "none"): departure behavior.
sources: primitive+component
install_path: registry/components/particle-text-dissolve

### persona-card-fan
group: Card assembly.
what: Four portrait cards deal onto the right side one at a time while displaced cards scale and rotate into a fixed outer wedge that tightens as it fills.
use_when: Options must appear beside a presenter while the deepest card stays pinned and newer cards subdivide the same fan.
avoid_when: Avoid it when portrait or square framing must be as fully composed as landscape, because those aspects are only kept inside the frame and the move is composed for 16x9.
pairs_with: thread-message-stack, receipt-card.
variables: none documented.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/persona-card-fan.html

### pill-row-collapse
group: Process sequences.
what: Five labeled pills build left to right, hold for reading, then pills two through five spread and clear while the first pill glides to center and becomes active.
use_when: A five-stage process must narrow visibly to its first stage after all five labels have been shown together.
avoid_when: Avoid it when a label may be bisected during reveal, because the type-in clip is deliberately quantized to character boundaries.
pairs_with: state-chip-rail, rank-list-settle.
variables: none documented.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/pill-row-collapse.html

### plan-room-audit
group: Annotation.
what: A floor plan sheet rotates clockwise into square while its walls draw, then five rooms fill and receive leader tags in reading order.
use_when: A portrait floor-plan scene needs a room-by-room audit whose count stays synchronized with the filled rooms.
avoid_when: Avoid it when the shot must be natively composed for landscape, because the header states that it is native to 9x16 and composed only for that orientation.
pairs_with: caliper-caption-rail, whiteboard-ink.
variables: none documented.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/plan-room-audit.html

### press-ripple
group: Interaction.
what: A cursor decelerates onto a positioned target, compresses with it, releases two ripple rings, and exits while the pressed state remains.
use_when: A caller-supplied interface target needs one explicit press gesture with a visible impact and release.
avoid_when: Avoid cueing the press outside the safe gesture window, because press_at is clamped so arrival, compression, ripple, and exit all fit inside the duration.
pairs_with: chevron-pill-card-morph, state-chip-rail.
variables: label (string, default not documented): text in the default pill, ignored when the target slot is replaced. target_x (number percent, default not documented): target-zone horizontal center in the host box. target_y (number percent, default not documented): target-zone vertical center in the host box. press_at (number in seconds, default 1.4): time when compression begins. cursor (enum light or dark, default not documented): pointer appearance. accent (enum green, blue, or violet, default not documented): ripple and pressed-fill color. exit (enum none, fade, or up, default "none"): departure behavior.
sources: primitive+component
install_path: registry/components/press-ripple

### rank-list-settle
group: List assembly.
what: A ranked list rolls upward under a fixed focus line, washes out passing rows, and stops with the final winning row fully lit on that line.
use_when: A comparison must build to one winner whose emphasis is determined by its physical position at the stop.
avoid_when: Avoid it when the winner cannot be the last row, because the geometry parks only the last row on the focus line and requires that row to carry the winner class.
pairs_with: pill-row-collapse, state-chip-rail.
variables: title (string, default "Cost per commit"): section label on whose line the winning row lands.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/rank-list-settle.html

### receipt-card
group: Card assembly.
what: A tilted quote card flies in from the right, settles flat, pushes in slowly, then fills selection boxes behind one phrase while the marked words turn white.
use_when: A portrait quote card needs one phrase marked in place after the card has landed.
avoid_when: Avoid it when landscape must be the native composition, because the header identifies the card as 9x16 native and authors its safe zone for 9x16.
pairs_with: marker-highlight, persona-card-fan.
variables: none documented.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/receipt-card.html

### state-chip-rail
group: Process sequences.
what: A row of status chips snaps through ordered states on scheduled cues while active, completed, and pending chips take distinct appearances.
use_when: A discrete state machine needs seek-exact, instantaneous advances and optional badges beside one activated state.
avoid_when: Avoid it when more than eight states or more than four badges are required, because extra states are dropped and badges are capped at four.
pairs_with: pill-row-collapse, press-ripple.
variables: states (string, default "Queued,Reading,Drafting,Done"): comma-separated chip labels in machine order, limited to 2 through 8. times (string, default ""): comma-separated activation times for each advance, with invalid entries replaced, clamped, and forced monotonic. badge_state (number, default 1): state index beside which badges appear, clamped to the state range. badges (string, default ""): comma-separated badge labels, with empty disabling badges and at most four rendered. accent (enum green, blue, or violet, default green): active-chip accent color. exit (enum none, fade, or up, default "none"): departure behavior.
sources: primitive+component
install_path: registry/components/state-chip-rail

### thread-message-stack
group: List assembly.
what: Message bubbles land on the bottom line over a moving background, push older messages upward under a mask, and show a typing pill before each incoming message.
use_when: A conversation must build through alternating incoming and outgoing bubbles while the background continues moving.
avoid_when: Avoid it when frame zero must be empty, because the thread deliberately opens on three settled bubbles.
pairs_with: persona-card-fan, receipt-card.
variables: --tms-roll-bg (color, default not documented): base under the moving blobs and letterbox color for replacement footage. --tms-out-fill (color, default #2D89E1): outgoing bubble fill. --tms-out-ink (color, default not documented): outgoing bubble text color. --tms-in-fill (color, default not documented): incoming bubble fill. --tms-in-ink (color, default not documented): incoming bubble text color. --tms-tag-ink (color, default not documented): sender tag text color. --tms-radius (length, default not documented): bubble corner radius.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/thread-message-stack.html

### version-plate-type
group: Text effects.
what: Oversized glyph plates stamp into a cluster, hard-cut to fitted words inside a selection box, then the box widens, shortens, closes on the letters, and pushes off frame.
use_when: A word sequence must read as text being manipulated one axis at a time by a visible selection box.
avoid_when: Avoid it when every word must retain its natural proportions, because resolved words are fitted to one constant ink width and the box separately changes width and height.
pairs_with: glyph-ring-assemble, kinetic-type-swap.
variables: none documented.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/version-plate-type.html

### whiteboard-ink
group: Annotation.
what: SVG paths draw one stroke at a time while a pen nib follows each active path tip and hops between strokes.
use_when: A preset or caller-supplied SVG sketch needs sequential ink drawing with a traveling pen actor and a caption after completion.
avoid_when: Avoid supplying non-path slot content, because only path elements inside the strokes group become the drawing.
pairs_with: marker-highlight, plan-room-audit.
variables: sketch (enum bulb, flow, or rocket, default not documented): preset sketch, ignored when the strokes slot contains paths. caption (string, default not documented): short line shown after drawing completes. pen (enum show or hide, default not documented): traveling nib visibility. accent (enum green, blue, or violet, default not documented): highlight-stroke color. exit (enum none, fade, or up, default "none"): completed-lockup departure behavior.
sources: primitive+component
install_path: registry/components/whiteboard-ink

### z-punch-through
group: Transitions.
what: The camera moves through an opening in a front wall as that wall passes the lens and the back plane advances into its settled state.
use_when: A scene change must feel like forward travel through an aperture rather than a flat scale zoom.
avoid_when: Avoid it when the clip needs a hold, because the documented 2.10-second envelope is filled by the move and has no hold.
pairs_with: match-cut, depth-rack-focus.
variables: front (string, default "BEFORE"): label on the wall. back (string, default "AFTER"): label on the back plane. accent (enum blue, violet, or amber, default blue): light behind the opening.
sources: primitive
install_path: evals/catalog-retrieval/sources/primitives/z-punch-through.html

### app-showcase
group: 3d, app, showcase
what: App Showcase. Fitness app product showcase with three floating smartphone screens
sources: block
install_path: registry/blocks/app-showcase

### apple-money-count
group: finance, kinetic, sfx, showcase, youtube
what: Apple Money Count. Apple-style finance counter that counts from $0 to $10,000, flashes green, and bursts money icons with sound.
sources: block
install_path: registry/blocks/apple-money-count

### blue-sweater-intro-video
group: ai, creator, sfx, showcase
what: Blue Sweater Intro Video. Warm creator intro sequence that resolves into an X follow card for @_blue_sweater_.
sources: block
install_path: registry/blocks/blue-sweater-intro-video

### chromatic-radial-split
group: shader, transition
what: Chromatic Radial Split. Shader transition with chromatic aberration radial split
sources: block
install_path: registry/blocks/chromatic-radial-split

### cinematic-zoom
group: shader, transition
what: Cinematic Zoom. Shader transition with dramatic zoom blur
sources: block
install_path: registry/blocks/cinematic-zoom

### code-3d-extrude
group: 3d, code, code-animation, developer, webgl
what: Code 3D Extrude. Syntax-highlighted code on a lit, beveled 3D slab that rotates through real space and settles to a readable rest, true WebGL depth and lighting, not a 2D transform.
sources: block
install_path: registry/blocks/code-3d-extrude

### code-diff
group: code, code-animation, developer, diff
what: Code Diff. An edit shown as a colored diff, removed lines collapse in red, added lines expand in green.
sources: block
install_path: registry/blocks/code-diff

### code-highlight
group: code, code-animation, developer, highlight
what: Code Highlight Sweep. A highlight band sweeps across a target line while the surrounding context dims, draws the eye to one line.
sources: block
install_path: registry/blocks/code-highlight

### code-morph
group: code, code-animation, developer, morph, refactor
what: Code Morph. One snippet transforms into another, tokens glide between positions, leavers fade out, enterers fade in. Shiki Magic Move re-driven as a paused GSAP timeline.
sources: block
install_path: registry/blocks/code-morph

### code-particle-assemble
group: code, code-animation, developer, gpu, particles, webgl
what: Code Particle Assemble. Thousands of GPU points scatter through space and fly to the exact glyph pixels of the code, resolving into readable syntax-highlighted text, a particle system, not a token tween.
sources: block
install_path: registry/blocks/code-particle-assemble

### code-scroll
group: code, code-animation, developer, scroll
what: Code Scroll To Line. The camera scrolls a long file to bring a target line to center and spotlights it, for walking through real modules.
sources: block
install_path: registry/blocks/code-scroll

### code-shader-dissolve
group: code, code-animation, developer, shader, webgl
what: Code Shader Dissolve. The code compiles into existence: a GPU fragment shader resolves it out of seeded noise with a chromatic dissolve front and edge glow, then holds crisp.
sources: block
install_path: registry/blocks/code-shader-dissolve

### code-snippet-apple-terminal-basic
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Basic. Apple Terminal Basic profile: white background, black text, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-basic

### code-snippet-apple-terminal-clear-dark
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Clear Dark. Apple Terminal Clear Dark profile: semi-transparent dark background, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-clear-dark

### code-snippet-apple-terminal-clear-light
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Clear Light. Apple Terminal Clear Light profile: semi-transparent light background, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-clear-light

### code-snippet-apple-terminal-grass
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Grass. Apple Terminal Grass profile: black background with green text, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-grass

### code-snippet-apple-terminal-homebrew
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Homebrew. Apple Terminal Homebrew profile: black background with bright green text and lime cursor, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-homebrew

### code-snippet-apple-terminal-man-page
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Man Page. Apple Terminal Man Page profile: pale yellow background with black text, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-man-page

### code-snippet-apple-terminal-novel
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Novel. Apple Terminal Novel profile: warm parchment background with dark brown text, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-novel

### code-snippet-apple-terminal-ocean
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Ocean. Apple Terminal Ocean profile: deep blue background with white text, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-ocean

### code-snippet-apple-terminal-pro
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Pro. Apple Terminal Pro profile: black background with grey text and lime green cursor, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-pro

### code-snippet-apple-terminal-red-sands
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Red Sands. Apple Terminal Red Sands profile: deep red background with sandy text, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-red-sands

### code-snippet-apple-terminal-silver-aerogel
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Silver Aerogel. Apple Terminal Silver Aerogel profile: dark grey background with white text, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-silver-aerogel

### code-snippet-apple-terminal-solid-colors
group: apple, apple-terminal, code, developer, showcase, terminal
what: Code Snippet - Apple Terminal Solid Colors. Apple Terminal Solid Colors profile: deep purple background with white text, per-character typing animation of a shell session.
sources: block
install_path: registry/blocks/code-snippet-apple-terminal-solid-colors

### code-snippet-dark-2026
group: code, developer, showcase, vscode
what: Code Snippet - Dark 2026. VS Code workbench with per-character typing animation in the Dark 2026 theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-dark-2026

### code-snippet-dark-modern
group: code, developer, showcase, vscode
what: Code Snippet - Dark Modern. VS Code workbench with per-character typing animation in the Dark Modern theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-dark-modern

### code-snippet-dark-plus
group: code, developer, showcase, vscode
what: Code Snippet - Dark+. VS Code workbench with per-character typing animation in the Dark+ theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-dark-plus

### code-snippet-flight
group: code, code-animation, developer, flight
what: Code Snippet Flight. Discrete code snippets fly in from the side and assemble into a stacked program, staggered. Block-level FLIP.
sources: block
install_path: registry/blocks/code-snippet-flight

### code-snippet-high-contrast
group: code, developer, showcase, vscode
what: Code Snippet - High Contrast. VS Code workbench with per-character typing animation in the High Contrast theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-high-contrast

### code-snippet-high-contrast-light
group: code, developer, showcase, vscode
what: Code Snippet - High Contrast Light. VS Code workbench with per-character typing animation in the High Contrast Light theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-high-contrast-light

### code-snippet-light-2026
group: code, developer, showcase, vscode
what: Code Snippet - Light 2026. VS Code workbench with per-character typing animation in the Light 2026 theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-light-2026

### code-snippet-light-modern
group: code, developer, showcase, vscode
what: Code Snippet - Light Modern. VS Code workbench with per-character typing animation in the Light Modern theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-light-modern

### code-snippet-light-plus
group: code, developer, showcase, vscode
what: Code Snippet - Light+. VS Code workbench with per-character typing animation in the Light+ theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-light-plus

### code-snippet-monokai
group: code, developer, showcase, vscode
what: Code Snippet - Monokai. VS Code workbench with per-character typing animation in the Monokai theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-monokai

### code-snippet-solarized-light
group: code, developer, showcase, vscode
what: Code Snippet - Solarized Light. VS Code workbench with per-character typing animation in the Solarized Light theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-solarized-light

### code-snippet-visual-studio-dark
group: code, developer, showcase, vscode
what: Code Snippet - Visual Studio Dark. VS Code workbench with per-character typing animation in the Visual Studio Dark theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-visual-studio-dark

### code-snippet-visual-studio-light
group: code, developer, showcase, vscode
what: Code Snippet - Visual Studio Light. VS Code workbench with per-character typing animation in the Visual Studio Light theme. Full editor chrome with activity bar, sidebar, tabs, terminal, and status bar.
sources: block
install_path: registry/blocks/code-snippet-visual-studio-light

### code-typing
group: code, code-animation, developer, typing
what: Code Typing. Token-streamed typing reveal with a caret that tracks the frontier, deterministic, no CSS animation.
sources: block
install_path: registry/blocks/code-typing

### cross-warp-morph
group: shader, transition
what: Cross Warp Morph. Shader transition with cross-warped morphing
sources: block
install_path: registry/blocks/cross-warp-morph

### data-chart
group: chart, data, statistics
what: Data Chart. Animated bar + line chart with staggered reveal, NYT-style typography, and value labels
sources: block
install_path: registry/blocks/data-chart

### domain-warp-dissolve
group: shader, transition
what: Domain Warp Dissolve. Shader transition with fractal noise domain warping
sources: block
install_path: registry/blocks/domain-warp-dissolve

### flash-through-white
group: shader, transition
what: Flash Through White. Shader transition with white flash crossfade
sources: block
install_path: registry/blocks/flash-through-white

### flowchart
group: diagram, flowchart, interactive
what: Flowchart. Animated decision tree with SVG connectors, sticky-note nodes, cursor interaction, and typing correction
sources: block
install_path: registry/blocks/flowchart

### flowchart-vertical
group: diagram, flowchart, interactive, portrait
what: Flowchart Vertical. Portrait animated decision tree with SVG connectors, sticky-note nodes, cursor interaction, and typing correction
sources: block
install_path: registry/blocks/flowchart-vertical

### glitch
group: shader, transition
what: Glitch. Shader transition with digital glitch artifacts
sources: block
install_path: registry/blocks/glitch

### gravitational-lens
group: shader, transition
what: Gravitational Lens. Shader transition with gravitational lensing distortion
sources: block
install_path: registry/blocks/gravitational-lens

### instagram-follow
group: instagram, overlay, social
what: Instagram Follow. Animated Instagram follow overlay with profile card and follow button
sources: block
install_path: registry/blocks/instagram-follow

### ios26-liquid-glass
group: 3d, gltf, html-in-canvas, ios26, iphone, liquid-glass-html-in-canvas, notifications, webgpu
what: iOS 26 Liquid Glass Home Screen. 3D iPhone with a normal iOS 26 home screen, liquid glass app icons, shader wallpaper, dock, and fluid glass notifications that drop from the status area onto a GLTF device model.
sources: block
install_path: registry/blocks/ios26-liquid-glass

### light-leak
group: shader, transition
what: Light Leak. Shader transition with cinematic light leak overlay
sources: block
install_path: registry/blocks/light-leak

### liquid-glass-context-menu
group: html-in-canvas, liquid-glass-html-in-canvas, webgpu
what: Liquid Glass Context Menu. Frosted glass context menu panel drifting over an aurora shader background
sources: block
install_path: registry/blocks/liquid-glass-context-menu

### liquid-glass-media-controls
group: html-in-canvas, liquid-glass-html-in-canvas, webgpu
what: Liquid Glass Media Controls. Frosted glass media control panels spreading over an aurora shader background
sources: block
install_path: registry/blocks/liquid-glass-media-controls

### liquid-glass-notification
group: html-in-canvas, liquid-glass-html-in-canvas, webgpu
what: Liquid Glass Notification. Frosted glass notification cards floating over an aurora shader background
sources: block
install_path: registry/blocks/liquid-glass-notification

### liquid-glass-widgets
group: html-in-canvas, liquid-glass-html-in-canvas, webgpu
what: Liquid Glass Widgets. Frosted glass stat cards, showcase panel and pill chips over an aurora shader background
sources: block
install_path: registry/blocks/liquid-glass-widgets

### logo-outro
group: branding, logo, outro
what: Logo Outro. Cinematic logo reveal with piece-by-piece assembly, glow bloom, tagline fade-in, and URL pill
sources: block
install_path: registry/blocks/logo-outro

### lower-third-bild
group: broadcast, lower-third, news, overlay
what: Lower Third, BILD Style. News-style lower third with tight-fit text boxes: white headline bar with red drop-shadow, red sub-line with white drop-shadow.
sources: block
install_path: registry/blocks/lower-third-bild

### lt-accent-underline
group: interview, lower-third, minimal, overlay, podcast
what: Lower Third, Accent Underline. Cardless lower third for footage overlay: name rises, an accent rule draws left-to-right, role fades in; text-shadowed for legibility
sources: block
install_path: registry/blocks/lt-accent-underline

### lt-bold-block
group: bold, interview, lower-third, overlay, podcast
what: Lower Third, Bold Block. High-energy podcast lower third: solid dark block wipes in, uppercase name slams up, accent tag pops
sources: block
install_path: registry/blocks/lt-bold-block

### lt-clean-bar
group: interview, lower-third, overlay, podcast
what: Lower Third, Clean Bar. Minimal white-card lower third for podcasts/interviews: accent tab, name + role, clip-wipe entrance
sources: block
install_path: registry/blocks/lt-clean-bar

### lt-color-block
group: bold, interview, lower-third, overlay, podcast
what: Lower Third, Color Block. High-energy lower third: bold accent-color block slides in with overshoot, condensed name + mono role
sources: block
install_path: registry/blocks/lt-color-block

### lt-dark-card
group: dark, interview, lower-third, overlay, podcast
what: Lower Third, Dark Card. Charcoal card lower third for bright footage: name, drawn accent underline, role; slide-up entrance
sources: block
install_path: registry/blocks/lt-dark-card

### lt-kicker-name
group: bold, interview, lower-third, overlay, podcast
what: Lower Third, Kicker Name. Cardless lower third with an accent eyebrow/kicker tag, heavy name, and a drawn baseline; for footage
sources: block
install_path: registry/blocks/lt-kicker-name

### lt-mask-reveal
group: bold, interview, lower-third, overlay, podcast
what: Lower Third, Mask Reveal. Cardless lower third: an accent sweep crosses and clip-path-reveals a heavy name, role fades up; for footage
sources: block
install_path: registry/blocks/lt-mask-reveal

### lt-side-rule
group: interview, lower-third, minimal, overlay, podcast
what: Lower Third, Side Rule. Cardless lower third with a vertical accent bar; condensed display name + mono role, text-shadowed for footage
sources: block
install_path: registry/blocks/lt-side-rule

### lt-soft-pill
group: interview, lower-third, minimal, overlay, podcast
what: Lower Third, Soft Pill. Rounded white pill lower third for podcasts/interviews: status dot, name + role, scale-pop entrance
sources: block
install_path: registry/blocks/lt-soft-pill

### lt-stack-bars
group: bold, interview, lower-third, overlay, podcast
what: Lower Third, Stack Bars. Two stacked bars: a dark name bar wipes from the left, an accent role bar wipes from the right
sources: block
install_path: registry/blocks/lt-stack-bars

### macos-notification
group: notification, overlay, social
what: macOS Notification. Animated macOS-style notification banner with app icon and message
sources: block
install_path: registry/blocks/macos-notification

### macos-tahoe-liquid-glass
group: 3d, gltf, html-in-canvas, macos, tahoe
what: macOS Tahoe Liquid Glass Desktop. 3D MacBook with a macOS Tahoe-style desktop, glass menu bar, Finder window, dock, and cinematic device camera move.
sources: block
install_path: registry/blocks/macos-tahoe-liquid-glass

### news-ticker
group: lower-third, news, overlay, ticker
what: News Ticker. Premium broadcast-style lower-third ticker with live label, headline ribbon, and scrolling news crawl.
sources: block
install_path: registry/blocks/news-ticker

### north-korea-locked-down
group: annotation, kinetic, map, showcase, youtube
what: North Korea Locked Down. Realistic map zoom into North Korea with a red scribble circle, locked-down pop-up label, and reddish editorial wash.
sources: block
install_path: registry/blocks/north-korea-locked-down

### nyc-paris-flight
group: map, sfx, showcase, travel, youtube
what: NYC Paris Flight. Apple-style realistic map animation with a plane flying from New York to Paris, marker circle, landing pop, and sound effects.
sources: block
install_path: registry/blocks/nyc-paris-flight

### reddit-post
group: overlay, reddit, social
what: Reddit Post Card. Animated Reddit post card overlay with upvotes and comments
sources: block
install_path: registry/blocks/reddit-post

### ridged-burn
group: shader, transition
what: Ridged Burn. Shader transition with ridged turbulence burn effect
sources: block
install_path: registry/blocks/ridged-burn

### ripple-waves
group: shader, transition
what: Ripple Waves. Shader transition with concentric ripple wave distortion
sources: block
install_path: registry/blocks/ripple-waves

### sdf-iris
group: shader, transition
what: SDF Iris. Shader transition with signed distance field iris reveal
sources: block
install_path: registry/blocks/sdf-iris

### spain-map
group: choropleth, data, europe, geography, map, spain
what: Spain Map. Animated Spain choropleth by autonomous community with staggered reveals and gradient legend, D3 conic conformal projection
sources: block
install_path: registry/blocks/spain-map

### spotify-card
group: overlay, social, spotify
what: Spotify Now Playing. Animated Spotify now-playing card with album art and progress bar
sources: block
install_path: registry/blocks/spotify-card

### swirl-vortex
group: shader, transition
what: Swirl Vortex. Shader transition with swirling vortex distortion
sources: block
install_path: registry/blocks/swirl-vortex

### thermal-distortion
group: shader, transition
what: Thermal Distortion. Shader transition with heat haze thermal distortion
sources: block
install_path: registry/blocks/thermal-distortion

### tiktok-follow
group: overlay, social, tiktok
what: TikTok Follow. Animated TikTok follow overlay with profile card and follow button
sources: block
install_path: registry/blocks/tiktok-follow

### transitions-3d
group: showcase, transition
what: 3D Transitions. Showcase of 3D perspective flip and rotate transitions
sources: block
install_path: registry/blocks/transitions-3d

### transitions-blur
group: showcase, transition
what: Blur Transitions. Showcase of blur-based transitions between scenes
sources: block
install_path: registry/blocks/transitions-blur

### transitions-cover
group: showcase, transition
what: Cover Transitions. Showcase of cover/uncover slide transitions
sources: block
install_path: registry/blocks/transitions-cover

### transitions-destruction
group: showcase, transition
what: Destruction Transitions. Showcase of destructive break-apart transitions
sources: block
install_path: registry/blocks/transitions-destruction

### transitions-dissolve
group: showcase, transition
what: Dissolve Transitions. Showcase of dissolve and fade transitions
sources: block
install_path: registry/blocks/transitions-dissolve

### transitions-distortion
group: showcase, transition
what: Distortion Transitions. Showcase of warp and distortion transitions
sources: block
install_path: registry/blocks/transitions-distortion

### transitions-grid
group: showcase, transition
what: Grid Transitions. Showcase of grid-based tile transitions
sources: block
install_path: registry/blocks/transitions-grid

### transitions-light
group: showcase, transition
what: Light Transitions. Showcase of light-based glow and flash transitions
sources: block
install_path: registry/blocks/transitions-light

### transitions-mechanical
group: showcase, transition
what: Mechanical Transitions. Showcase of mechanical shutter and iris transitions
sources: block
install_path: registry/blocks/transitions-mechanical

### transitions-other
group: showcase, transition
what: Other Transitions. Showcase of miscellaneous creative transitions
sources: block
install_path: registry/blocks/transitions-other

### transitions-push
group: showcase, transition
what: Push Transitions. Showcase of push and slide transitions
sources: block
install_path: registry/blocks/transitions-push

### transitions-radial
group: showcase, transition
what: Radial Transitions. Showcase of radial wipe and reveal transitions
sources: block
install_path: registry/blocks/transitions-radial

### transitions-scale
group: showcase, transition
what: Scale Transitions. Showcase of scale and zoom transitions
sources: block
install_path: registry/blocks/transitions-scale

### ui-3d-reveal
group: 3d, reveal, showcase
what: 3D UI Reveal. Perspective 3D reveal animation for UI elements
sources: block
install_path: registry/blocks/ui-3d-reveal

### us-map
group: choropleth, data, geography, map, usa
what: US Map. Animated US choropleth map with staggered state reveals, value labels, and gradient legend, pure inline SVG with GSAP
sources: block
install_path: registry/blocks/us-map

### us-map-bubble
group: bubble, cities, data, geography, map, usa
what: US Bubble Map. Animated US bubble map with proportional city markers, value callouts, and connection lines, composable with us-map
sources: block
install_path: registry/blocks/us-map-bubble

### us-map-flow
group: arcs, connections, data, flow, geography, map, usa
what: US Flow Map. Animated connection arcs between US cities over a base map, composable origin-destination flow visualization
sources: block
install_path: registry/blocks/us-map-flow

### us-map-hex
group: data, geography, hexgrid, map, tilegrid, usa
what: US Hex Grid Map. Animated hexagonal tile grid map, each state as an equal-weight hex with data fill and abbreviation label
sources: block
install_path: registry/blocks/us-map-hex

### vfx-iphone-device
group: 3d, device, gltf, html-in-canvas, iphone, macbook
what: iPhone & MacBook 3D Showcase. Real GLTF iPhone 15 Pro Max and MacBook Pro models with live HTML-in-Canvas screen content, morphing glass lens, product review camera choreography, and 360° turntable.
sources: block
install_path: registry/blocks/vfx-iphone-device

### vfx-liquid-background
group: background, displacement, html-in-canvas, liquid, webgl
what: Liquid Background. Organic liquid simulation with vertex displacement on a subdivided plane. HTML content floats above rippling fluid surface with real-time wave dynamics.
sources: block
install_path: registry/blocks/vfx-liquid-background

### vfx-liquid-glass
group: html-in-canvas, webgl
what: Liquid Glass. VFX composition block
sources: block
install_path: registry/blocks/vfx-liquid-glass

### vfx-magnetic
group: html-in-canvas, webgl
what: Magnetic. VFX composition block
sources: block
install_path: registry/blocks/vfx-magnetic

### vfx-portal
group: html-in-canvas, webgl
what: Portal. VFX composition block
sources: block
install_path: registry/blocks/vfx-portal

### vfx-shatter
group: html-in-canvas, webgl
what: Shatter. VFX composition block
sources: block
install_path: registry/blocks/vfx-shatter

### vfx-text-cursor
group: chromatic, cursor, html-in-canvas, shader, text
what: VFX Text Cursor. Dramatic text reveal with cursor glow, chromatic shadow rays, and directional lighting on a black stage. Canvas-based shader post-processing with spectral color edges.
sources: block
install_path: registry/blocks/vfx-text-cursor

### vpn-youtube-spot
group: app, sfx, showcase, youtube
what: VPN YouTube Spot. Snappy Apple-style YouTube insert showing a phone finding and installing a friendly VPN app with sound effects.
sources: block
install_path: registry/blocks/vpn-youtube-spot

### whip-pan
group: shader, transition
what: Whip Pan. Shader transition simulating a fast camera whip pan
sources: block
install_path: registry/blocks/whip-pan

### world-map
group: choropleth, data, geography, map, world
what: World Map. Animated world choropleth with country-by-country reveal, tooltip labels, and rotating globe inset, D3 Natural Earth projection
sources: block
install_path: registry/blocks/world-map

### x-post
group: overlay, social, twitter
what: X Post Card. Animated X/Twitter post card overlay with engagement metrics
sources: block
install_path: registry/blocks/x-post

### yt-lower-third
group: overlay, social, youtube
what: YouTube Lower Third. Animated YouTube subscribe lower third with avatar and channel info
sources: block
install_path: registry/blocks/yt-lower-third

### accordion
group: accordion, disclosure, remocn-port, ui-primitive
what: Accordion. A precise disclosure row with a machined edge, accessible expansion state, and deterministic reveal hooks
sources: component
install_path: registry/components/accordion

### ai-generation-canvas
group: ai, remocn-port, showcase
what: Generation Canvas. A prompt composer expands into a generated dashboard preview.
sources: component
install_path: registry/components/ai-generation-canvas

### ai-prompt-flow
group: ai, prompt, remocn-port, ui-flow
what: Prompt Flow. A composed prompt flow with prompt field, suggestion chips, generate action, and preview result card
sources: component
install_path: registry/components/ai-prompt-flow

### alert
group: alert, remocn-port, status, ui-primitive
what: Alert. An Operator Black status alert with a matte surface, technical icon, title, and message
sources: component
install_path: registry/components/alert

### alert-dialog
group: alert-dialog, overlay, remocn-port, ui-primitive
what: Alert Dialog. An Operator Black destructive confirmation dialog with a flat backdrop and centered Soft Optical motion
sources: component
install_path: registry/components/alert-dialog

### animated-bar-chart
group: data, remocn-port
what: Animated Bar Chart. A compact data card with deterministic bar growth and value callouts.
sources: component
install_path: registry/components/animated-bar-chart

### animated-line-chart
group: data, remocn-port
what: Animated Line Chart. A line chart draws across the card with endpoint emphasis.
sources: component
install_path: registry/components/animated-line-chart

### arc-motion-path
group: gsap-plugin, hyperframes-native, motionpath
what: Arc Motion Path. A GSAP MotionPath primitive that flies a callout along a curved arc with autorotation.
sources: component
install_path: registry/components/arc-motion-path

### ascii-render-pass
group: ascii, effects, experiment, motion-primitive, quantize, reveal, texture
what: ASCII Render Pass. A slotted scene renders as live ASCII: a canvas samples the source's luminance grid (rasterized once at mount) and draws glyphs from a density ramp charset; resolution steps coarse to fine as the piece resolves, then holds legible-fine.
use_when: Jobs: reveal. Profile: texture.
variables: charset:string=".:-=+*#%@", grid:enum="med", resolve_at:number=1.4, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/ascii-render-pass

### ascii-trail-reveal
group: ascii, grid, intro, intros-and-reveals, motion-primitive, reveal, trail
what: ASCII Trail Reveal. An authored S-curve sweeps through a deterministic ASCII grid, flipping cells away to reveal a labeled panel.
use_when: Jobs: reveal. Profile: trail.
variables: label:string="The reveal", accent:enum="green", trail_width:enum="narrow"
sources: component
install_path: registry/components/ascii-trail-reveal

### aspect-ratio
group: aspect-ratio, layout, remocn-port, ui-primitive
what: Aspect Ratio. A matte aspect-ratio frame for media and previews with a compact technical dimension label
sources: component
install_path: registry/components/aspect-ratio

### aurora-drift
group: ambient, aurora, background, backgrounds, gradient, loopable, motion-primitive, orient
what: Aurora Drift. Three soft accent-derived aurora fields drift in an exact ambient loop over a deep base and faint vignette.
use_when: Jobs: orient. Profile: ambient.
variables: accent:enum="green", mood:enum="deep"
sources: component
install_path: registry/components/aurora-drift

### avatar
group: avatar, identity, remocn-port, ui-primitive
what: Avatar. A matte initials avatar with a functional availability indicator and host-controlled sizing
sources: component
install_path: registry/components/avatar

### avatar-cloud
group: avatars, community, effects, network, prove, social-proof
what: Avatar Cloud. Lettermark avatars populate a loose elliptical cloud while fine SVG links draw between the community and its central proof label.
use_when: Jobs: prove. Profile: holdable.
variables: avatarCount:number=10, showLinks:enum="yes", label:string="50k builders"
sources: component
install_path: registry/components/avatar-cloud

### avatar-group-hover
group: avatar, hover, transition-primitive, transitions-dev-port
what: Avatar Group Hover. A distance-falloff avatar group lift with bouncy hover return
sources: component
install_path: registry/components/avatar-group-hover

### backdrop
group: remocn-port, ui-primitive
what: Backdrop. An Operator Black flat dimming backdrop for dialog, drawer, sheet, and modal scenes.
sources: component
install_path: registry/components/backdrop

### badge
group: badge, remocn-port, status, ui-primitive
what: Badge. An Operator Black semantic badge for restrained success, warning, and neutral status labels
sources: component
install_path: registry/components/badge

### badge-pop
group: badge, microinteraction, transition-primitive, transitions-dev-port
what: Badge Pop. A transitions.dev-inspired notification badge pop with elastic scale and count reveal
sources: component
install_path: registry/components/badge-pop

### beat-accent
group: burst, effects, emphasize, impact, motion-primitive, sting
what: Beat Accent. A single music-hit sting: impact flash, micro scale-pulse on the subject, immediate decay.
use_when: Jobs: emphasize. Profile: burst.
variables: text:string="BOOM", flashColor:enum="accent", intensity:number=1
sources: component
install_path: registry/components/beat-accent

### beat-pulse-background
group: background, backgrounds, beat, emphasize, motion-primitive, pulse, reactive, rhythmic
what: Beat Pulse Background. An accent-derived backdrop pulses its glow intensity and saturation on a deterministic, supplied beat grid.
use_when: Jobs: emphasize. Profile: rhythmic.
variables: beats:string="0.5,1.0,1.5,2.0,2.5,3.0,3.5", accent:enum="green", intensity:enum="subtle"
sources: component
install_path: registry/components/beat-pulse-background

### beat-timeline
group: bridge, orchestration, sequencing, timeline, transitions
what: Beat Timeline. A paused master-timeline orchestration spine that pins titled beat rows to evenly spaced named labels. Each row enters on its label, holds with the sequence, then exits with the group.
use_when: Jobs: bridge. Profile: holdable.
variables: beatCount:number=4, interval:number=0.6, labels:string="One,Two,Three,Four"
sources: component
install_path: registry/components/beat-timeline

### before-after-wipe
group: before-after, compare, holdable, prop, slots, ui-props, wipe
what: Before After Wipe. Two full-bleed content slots compare before and after states as a persistent divider wipes the after layer over the before layer and rests at a configurable split. Callers fill the named before/after slot panels; token-styled defaults render when a slot is left empty.
use_when: Jobs: compare. Profile: holdable.
variables: label_a:string="Before", label_b:string="After", rest_split:number=50, wipe_at:number=0.25, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/before-after-wipe

### bezier-callout-route
group: gsap-plugin, hyperframes-native, motionpath
what: Bezier Callout Route. A route-map primitive with multiple callouts traveling along cubic Bezier paths.
sources: component
install_path: registry/components/bezier-callout-route

### blur-in
group: blur-in, remocn-port, text-effect, ui-primitive
what: Blur In. An Operator Black word-level content reveal that resolves its own text from controlled blur
sources: component
install_path: registry/components/blur-in

### blur-out-up
group: motion-primitive, remocn-port, typography
what: Blur Out Up. Words arrive clean and depart upward with increasing blur for airy exits.
sources: component
install_path: registry/components/blur-out-up

### bottom-up-letters
group: letters, motion-primitive, reveal, text
what: Bottom Up Letters. Splits text into letters and reveals each glyph from below with deterministic staggered timing
sources: component
install_path: registry/components/bottom-up-letters

### breadcrumb
group: breadcrumb, navigation, remocn-port, ui-primitive
what: Breadcrumb. A quiet path-navigation primitive with technical SVG separators and a strong current-page treatment
sources: component
install_path: registry/components/breadcrumb

### browser-device-stage
group: browser, chrome, demonstrate, device, phone, product-demo, slot, stage
what: Browser Device Stage. A generic app surface in token-native device chrome (browser, window, or phone). The screen is a slot for caller img/video/HTML with a token-styled skeleton default; one settle entrance, a readable hold, and an optional screen swap.
use_when: Jobs: demonstrate. Profile: stage.
variables: chrome:enum="browser", title:string="app.example.com", swap_at:number=0, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/browser-device-stage

### browser-flow
group: remocn-port, showcase
what: Browser Flow. A browser frame walks through a three-step product flow.
sources: component
install_path: registry/components/browser-flow

### button
group: button, control, remocn-port, ui-primitive
what: Button. A video-safe action button with tactile press, loading, and success states
sources: component
install_path: registry/components/button

### button-group
group: button-group, control, remocn-port, ui-primitive
what: Button Group. A compact segmented action group with clear pressed-state emphasis
sources: component
install_path: registry/components/button-group

### calendar
group: calendar, date, remocn-port, ui-primitive
what: Calendar. A compact date grid with a recessed selected day and deterministic reveal
sources: component
install_path: registry/components/calendar

### camera-rig-depth-stack
group: advanced-motion, hyperframes-native
what: Camera Rig Depth Stack. A 3D camera-rig-style card stack with depth, parallax, and focus shift.
sources: component
install_path: registry/components/camera-rig-depth-stack

### camera-scan-gate
group: camera, demonstrate, interaction, prop, qr, recognition, scan, ui-props
what: Camera Scan Gate. A camera and QR recognition moment with a viewfinder sweep, bracket lock, confirmation pulse, and verified next beat.
use_when: Jobs: demonstrate. Profile: interaction.
variables: scanColor:string="var(--brand)", targetLabel:string="Verified", sweepSpeed:number=1
sources: component
install_path: registry/components/camera-scan-gate

### caption-blend-difference
group: blend-mode, contrast, effect, inversion, text, text-effect
what: Blend Difference. Auto-inverting text using mix-blend-mode: difference, flips between white and black per-pixel against the background
sources: component
install_path: registry/components/caption-blend-difference

### caption-clip-wipe
group: caption-style, captions, clip-path, reveal, wipe
what: Clip Wipe. Left-to-right clip-path wipe reveal per word
sources: component
install_path: registry/components/caption-clip-wipe

### caption-editorial-emphasis
group: caption-style, captions, editorial, emphasis, typography
what: Editorial Emphasis. Dual-font system with dramatic size contrast for emphasis words
sources: component
install_path: registry/components/caption-editorial-emphasis

### caption-emoji-pop
group: caption-style, captions, emoji, social
what: Emoji Pop. Emoji integration with stroked text and horizontal squeeze entrance
sources: component
install_path: registry/components/caption-emoji-pop

### caption-glitch-rgb
group: caption-style, captions, cyber, glitch, tech
what: Glitch RGB. RGB chromatic aberration with CRT scanline overlay
sources: component
install_path: registry/components/caption-glitch-rgb

### caption-gradient-fill
group: caption-style, captions, colorful, gradient
what: Gradient Fill. Gradient-clipped text with elastic bounce entrance
sources: component
install_path: registry/components/caption-gradient-fill

### caption-highlight
group: caption-style, captions, highlight, social, tiktok
what: Highlight. Red background sweep behind each active word, TikTok-style
sources: component
install_path: registry/components/caption-highlight

### caption-kinetic-slam
group: caption-style, captions, kinetic, slam, typography
what: Kinetic Slam. Full-screen single-word display with alternating entrance directions
sources: component
install_path: registry/components/caption-kinetic-slam

### caption-matrix-decode
group: caption-style, captions, decode, matrix, scramble
what: Matrix Decode. Character scramble animation before text reveal
sources: component
install_path: registry/components/caption-matrix-decode

### caption-neon-accent
group: accent, caption-style, captions, glow, neon
what: Neon Accent. Multi-color neon glow accents with wiggle drift animation
sources: component
install_path: registry/components/caption-neon-accent

### caption-neon-glow
group: caption-style, captions, gaming, glow, neon
what: Neon Glow. Cyan and magenta neon glow with keyword accent colors
sources: component
install_path: registry/components/caption-neon-glow

### caption-parallax-layers
group: 3d, caption-style, captions, depth, parallax
what: Parallax Layers. Behind-subject 3D text layering with vertical stretch effect
sources: component
install_path: registry/components/caption-parallax-layers

### caption-particle-burst
group: burst, caption-style, captions, effects, particles
what: Particle Burst. Keyword words trigger colored particle explosions
sources: component
install_path: registry/components/caption-particle-burst

### caption-pill-karaoke
group: caption-style, captions, karaoke, pill
what: Pill Karaoke. Pill-shaped container with per-word karaoke color highlight
sources: component
install_path: registry/components/caption-pill-karaoke

### caption-texture
group: caption-style, captions, mask, texture
what: Texture. Flowing texture mask over large uppercase text, ships with 6 textures (lava, marble, metal, wood, concrete, rock), configurable via the texture variable
sources: component
install_path: registry/components/caption-texture

### caption-weight-shift
group: caption-style, captions, minimal, typography
what: Weight Shift. Elegant font-weight transition between caption lines
sources: component
install_path: registry/components/caption-weight-shift

### card
group: card, remocn-port, surface, ui-primitive
what: Card. A single semantic card surface with calm type hierarchy, success status, a review action, and Soft Optical reveal hooks
sources: component
install_path: registry/components/card

### card-resize
group: card, layout, transition-primitive, transitions-dev-port
what: Card Resize. A transitions.dev-inspired card resize primitive that expands a compact card into a detail panel
sources: component
install_path: registry/components/card-resize

### caret
group: caret, remocn-port, typing, ui-primitive
what: Caret. A matte command-field caret with finite blink timing and a deterministic typed-value reveal
sources: component
install_path: registry/components/caret

### carousel
group: carousel, media, remocn-port, ui-primitive
what: Carousel. A restrained scene carousel with layered media surfaces, accessible position controls, and deterministic slide motion
sources: component
install_path: registry/components/carousel

### char-slam-explode
group: emphasize, impact, motion-primitive, scatter, slam, text-treatment, typography
what: Char Slam Explode. Headline glyphs hold in a deterministic scatter, then reassemble with an overshooting slam and a three-frame landing shake.
use_when: Jobs: emphasize. Profile: impact.
variables: text:string="Impact", accent:enum="green", spread:enum="tight"
sources: component
install_path: registry/components/char-slam-explode

### chart
group: chart, data, remocn-port, ui-primitive
what: Chart. An Operator Black categorical bar chart using the shared solid data palette and deterministic growth
sources: component
install_path: registry/components/chart

### chart-story
group: bars, chart, deterministic, donut, line, motion-primitive, progress, proof, proof-stats, prove, stats
what: Chart Story. One chart builds from data in reading order and lands the exact supplied values: staggered bars, a left-to-right line with area fill, a sweeping donut, or filling progress bars, with an accented value callout on the emphasized datum.
use_when: Jobs: prove. Profile: chart.
variables: type:enum="bars", data:string="12, 28, 45, 64", labels:string="Q1, Q2, Q3, Q4", emphasize:number=3, unit:string="%", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/chart-story

### chat-to-preview-layout
group: ai, remocn-port, showcase
what: Chat to Preview Layout. Split-pane chat and preview layout for agent-generated UI.
sources: component
install_path: registry/components/chat-to-preview-layout

### checkbox
group: checkbox, control, remocn-port, ui-primitive
what: Checkbox. An accessible checkbox with tactile feedback and a functional mint check state
sources: component
install_path: registry/components/checkbox

### checkout-flow
group: checkout, commerce, remocn-port, ui-flow
what: Checkout Flow. A composed checkout flow with plan summary, payment field rows, total, and purchase action
sources: component
install_path: registry/components/checkout-flow

### chromatic-aberration-wipe
group: remocn-port, transition-primitive
what: Chromatic Aberration Wipe. A fast slide wipe with RGB channel split on peak frames.
sources: component
install_path: registry/components/chromatic-aberration-wipe

### code-accordion
group: code-animation, remocn-port
what: Code Accordion. Stacked code sections expand one at a time with line highlights.
sources: component
install_path: registry/components/code-accordion

### code-diff-wipe
group: remocn-port, transition-primitive
what: Code Diff Wipe. A scene transition that wipes through added and removed code lines.
sources: component
install_path: registry/components/code-diff-wipe

### code-terminal-run
group: demonstrate, deterministic, motion-primitive, product-demo, terminal, typing, ui-props
what: Code Terminal Run. A token-chrome terminal panel runs one command: the prompt line types deterministically behind an integer-cycle caret, executes after a beat, and output lines print one per cue before a fresh prompt appears.
use_when: Jobs: demonstrate. Profile: typing.
variables: prompt_glyph:string="$", cadence:enum="human", cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/code-terminal-run

### collapsible
group: collapsible, disclosure, remocn-port, ui-primitive
what: Collapsible. A compact disclosure surface with an accessible trigger, restrained chevron motion, and deterministic height reveal
sources: component
install_path: registry/components/collapsible

### combobox
group: combobox, control, remocn-port, ui-primitive
what: Combobox. A searchable combobox with an anchored option list and explicit selection check
sources: component
install_path: registry/components/combobox

### command-menu
group: command-menu, overlay, remocn-port, ui-primitive
what: Command Menu. An Operator Black command palette with a recessed search field and mint selection check
sources: component
install_path: registry/components/command-menu

### command-menu-item
group: remocn-port, ui-primitive
what: Command Menu Item. An Operator Black command-row specimen with technical shortcuts and restrained selection state.
sources: component
install_path: registry/components/command-menu-item

### comparison-split
group: before-after, compare, holdable, prop, ui-props, wipe
what: Comparison Split. Two full-bleed panels compare before and after states as a persistent divider wipes the vivid after layer over the muted before layer and rests at a configurable split.
use_when: Jobs: compare. Profile: holdable.
variables: split:number=50, orientation:enum="horizontal", labelA:string="Before", labelB:string="After"
sources: component
install_path: registry/components/comparison-split

### confetti
group: effect, remocn-port
what: Confetti. A deterministic celebration burst with seeded particles and gravity.
sources: component
install_path: registry/components/confetti

### conic-progress-ring
group: conic-gradient, data, demonstrate, progress, prove, ring
what: Conic Progress Ring. A token-driven conic progress ring whose angular fill and center count settle together from one registered percentage.
use_when: Jobs: prove, demonstrate. Profile: holdable.
variables: progress:number=100, thickness:number=12, label:string="100"
sources: component
install_path: registry/components/conic-progress-ring

### constellation-hub
group: connector, exhibit, feature-tour, hub, motion-primitive, nodes, reveal
what: Constellation Hub. Feature nodes brighten in narration order as real-length SVG connectors draw outward from a fixed central hub, then settle into one lockup.
use_when: Jobs: exhibit. Profile: network.
variables: hub_label:string="Product", nodes:string="Capture,Compose,Render,Share", cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/constellation-hub

### context-menu
group: context-menu, menu, remocn-port, ui-primitive
what: Context Menu. An Operator Black context menu with a pointer anchor, technical shortcuts, and mint selection check
sources: component
install_path: registry/components/context-menu

### count-up
group: counter, deterministic, motion-primitive, number, proof, proof-stats, prove, stats
what: Count Up. A token-native stat counter that eases between values and lands with a restrained scale pulse.
use_when: Jobs: prove. Profile: count.
variables: start:number=0, end:number=100, prefix:string="", suffix:string="%", accent:enum="green", glow:boolean=false, exit:enum="none"
sources: component
install_path: registry/components/count-up

### cta-close
group: ask, close, cta, end-card, motion-primitive, ui-props
what: CTA Close. A display-scale action line lands per word and fills the frame with air, one generous CTA capsule pops beneath it with a single overshoot, and the finished close holds completely still.
use_when: Jobs: ask. Profile: holdable.
variables: action_line:string="Make it happen", button_label:string="Start now", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/cta-close

### cta-lockup
group: ask, cta, end-card, lockup, motion-primitive, ui-props
what: CTA Lockup. A canonical closing lockup that reveals an action line, pops in an accent CTA capsule, settles supporting microcopy, and holds with confidence.
use_when: Jobs: ask. Profile: holdable.
variables: action_line:string="Start building today", button_label:string="Get HyperFrames", microcopy:string="Free while in beta", accent:enum="green"
sources: component
install_path: registry/components/cta-lockup

### cursor
group: cursor, pointer, remocn-port, ui-primitive
what: Cursor. A technical SVG pointer with guided travel, a functional click ripple, and a compact action callout
sources: component
install_path: registry/components/cursor

### cursor-glyph-trail
group: cursor, demonstrate, deterministic, glyphs, motion-primitive, trail
what: Cursor Glyph Trail. An actor travels an authored path depositing small dithered glyphs at its past positions, each popping in and decaying in place, stamp rate scaling with the actor's velocity.
use_when: Jobs: demonstrate. Profile: stamp-decay.
variables: glyphs:string="░▒▓+·×", density:enum="med", path:enum="sweep", fade:number=0.8, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/cursor-glyph-trail

### cut-the-curve
group: bridge, demonstrate, directional-cut, transition, transitions, velocity-match, whip
what: Cut the Curve. A velocity-matched directional hard cut: the outgoing subject accelerates with power4.in, swaps at peak velocity, and the incoming subject continues in the same direction with power4.out.
use_when: Jobs: bridge, demonstrate. Profile: transition.
variables: subject:enum="cursor", direction:enum="left", cutFraction:number=0.33, blurPx:number=12, exit:enum="none"
sources: component
install_path: registry/components/cut-the-curve

### dashboard-populate
group: data, remocn-port
what: Dashboard Populate. Skeleton dashboard cards resolve into populated charts and metrics.
sources: component
install_path: registry/components/dashboard-populate

### data-flow-pipes
group: remocn-port, showcase
what: Data Flow Pipes. Animated pipe routes move packets between data nodes.
sources: component
install_path: registry/components/data-flow-pipes

### decline-chart
group: agitate, chart, data, decline, metric, motion-primitive, problem
what: Decline Chart. A metric line draws downward as its value counts down and the ambient background darkens in lockstep.
use_when: Jobs: agitate. Profile: holdable.
variables: label:string="Retention", start_value:number=82, end_value:number=34
sources: component
install_path: registry/components/decline-chart

### device-frame-stage
group: demonstrate, device, holdable, mobile, prop, tablet, ui-props
what: Device Frame Stage. A phone or tablet mockup staged as a physical scene prop with a screen slot for arbitrary reconstructed UI, rising onto the stage, settling, and holding an idle float
use_when: Jobs: demonstrate. Profile: holdable.
variables: device:enum="phone", cutout:enum="none", body:enum="graphite"
sources: component
install_path: registry/components/device-frame-stage

### device-mockup-zoom
group: remocn-port, showcase
what: Device Mockup Zoom. A device frame scales forward while UI panels parallax behind it.
sources: component
install_path: registry/components/device-mockup-zoom

### dialog
group: dialog, overlay, remocn-port, ui-primitive
what: Dialog. An Operator Black centered modal with a flat backdrop, restrained actions, and Soft Optical motion
sources: component
install_path: registry/components/dialog

### directional-wipe
group: remocn-port, transition-primitive
what: Directional Wipe. A directional scene push that slides one panel over another.
sources: component
install_path: registry/components/directional-wipe

### drag-and-drop-flow
group: remocn-port, showcase
what: Drag and Drop Flow. Cards drag from backlog to timeline with snap feedback.
sources: component
install_path: registry/components/drag-and-drop-flow

### drawer
group: drawer, overlay, remocn-port, ui-primitive
what: Drawer. An Operator Black bottom drawer with matte rows and edge-attached Soft Optical motion
sources: component
install_path: registry/components/drawer

### drift-hold
group: ambient, camera, drift, hold, loopable, motion-primitive, orient
what: Drift Hold. A centered content card stays subtly alive through loop-exact rotation, scale breathing, and a slow light sweep.
use_when: Jobs: orient. Profile: ambient.
variables: text:string="Always alive", intensity:enum="standard"
sources: component
install_path: registry/components/drift-hold

### dropdown-menu
group: dropdown-menu, menu, remocn-port, ui-primitive
what: Dropdown Menu. An Operator Black dropdown menu with origin-aware motion and a mint selection check
sources: component
install_path: registry/components/dropdown-menu

### dropdown-menu-item
group: remocn-port, ui-primitive
what: Dropdown Menu Item. An Operator Black menu-row specimen showing idle, hover, selected, and disabled treatments.
sources: component
install_path: registry/components/dropdown-menu-item

### dynamic-grid
group: background, grid, motion-primitive, ui
what: Dynamic Grid. A responsive animated grid background driven by CSS variables for SaaS, code, and data scenes
sources: component
install_path: registry/components/dynamic-grid

### ecosystem-constellation
group: remocn-port, showcase
what: Ecosystem Constellation. Orbiting product nodes connect into a constellation graph.
sources: component
install_path: registry/components/ecosystem-constellation

### empty
group: empty, remocn-port, state, ui-primitive
what: Empty. An Operator Black empty state using open space, a technical icon, clear copy, and neutral action
sources: component
install_path: registry/components/empty

### facet-morph
group: deterministic, intro, intros-reveals, low-poly, morph, motion-primitive, reveal, svg
what: Facet Morph. A faceted low-poly mass of 36 triangles continuously reshapes between three authored silhouettes (blob, mark, badge) with per-facet flat shading that recomputes as the vertices move. Light reads from the upper left; lit facets lift toward a pale accent-tinted tone while turned-away facets fall toward near-black. One calm continuous morph, then a settled hold.
use_when: Jobs: reveal. Profile: holdable.
variables: forms:string="blob,mark,badge", hold_last:boolean=true, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/facet-morph

### fade-through
group: fade, motion-primitive, scene, transition
what: Fade Through. A calm transition primitive that fades one layer out, passes through a wash, and reveals the next layer
sources: component
install_path: registry/components/fade-through

### field
group: field, form, remocn-port, ui-primitive
what: Field. A labeled field wrapper with an accessible control and supporting description
sources: component
install_path: registry/components/field

### focus-blur-resolve
group: motion-primitive, remocn-port, typography
what: Focus Blur Resolve. A premium focus pull from heavy blur to crisp text, then a soft blur-out exit.
sources: component
install_path: registry/components/focus-blur-resolve

### focus-swap
group: attention, blur, demonstrate, effect, focus, ui-props
what: Focus Swap. Moves attention between two side-by-side cards as one recedes with scale, blur, and dimming while the other advances to full focus.
use_when: Jobs: demonstrate. Profile: holdable.
variables: focus:enum="b", blurPx:number=6, dim:number=0.5
sources: component
install_path: registry/components/focus-swap

### frosted-glass-wipe
group: remocn-port, transition-primitive
what: Frosted Glass Wipe. A scene transition through a moving frosted glass pane.
sources: component
install_path: registry/components/frosted-glass-wipe

### gesture-tap
group: demonstrate, gesture, interaction, motion-primitive, tap, ui-props
what: Gesture Tap. A contact circle taps a mobile pill button, releases it into a new labeled accent state, and lifts away.
use_when: Jobs: demonstrate. Profile: interaction.
variables: tap_label:string="Follow", response_label:string="Following", accent:enum="green"
sources: component
install_path: registry/components/gesture-tap

### glass-code-block
group: code-animation, remocn-port
what: Glass Code Block. A translucent code block with scanned line highlights.
sources: component
install_path: registry/components/glass-code-block

### gloss-sweep
group: badge, card, celebrate, celebration, celebrations, gloss, motion-primitive, payoff
what: Gloss Sweep. A card lands with a restrained slam, catches one diagonal specular gloss, and holds perfectly still.
use_when: Jobs: celebrate. Profile: payoff.
variables: text:string="Pro", accent:enum="green", sweep_angle:number=25
sources: component
install_path: registry/components/gloss-sweep

### grain-field
group: ambient, background, backgrounds, dots, grain, loopable, motion-primitive, orient, texture
what: Grain Field. A clearly visible accent-tinted dot field drifts over a subtle luminance gradient in an exact ambient loop.
use_when: Jobs: orient. Profile: ambient.
variables: density:enum="fine", accent:enum="green"
sources: component
install_path: registry/components/grain-field

### grain-overlay
group: film, grain, overlay, texture
what: Grain Overlay. Animated film grain texture overlay using CSS keyframes, adds warmth and analog character to any composition
sources: component
install_path: registry/components/grain-overlay

### grid-card-assemble
group: assemble, feature-tour, grid, layout, list, motion-primitive, reveal, stagger, tour
what: Grid Card Assemble. N capability cards (thin-line icon that draws on, mono label, optional muted body) stagger-assemble into a grid or vertical list with a fade plus short slide into slot, then hold perfectly still.
use_when: Jobs: reveal, tour. Profile: assemble.
variables: items:string="Capture,Compose,Render,Publish", layout:enum="grid", columns:number=0, cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/grid-card-assemble

### grid-pixelate-wipe
group: grid, pixelate, transition, wipe
what: Grid Pixelate Wipe. Transition effect where the screen dissolves into a grid of squares that fade out with staggered timing, use between scenes
sources: component
install_path: registry/components/grid-pixelate-wipe

### headline-slam
group: emphasize, exit, headline, impact, motion-primitive, slam, typography
what: Headline Slam. A heavyweight headline scales down into frame, lands with a deterministic three-frame shake, holds with subtle drift, and whips upward on exit.
use_when: Jobs: emphasize. Profile: impact.
variables: text:string="Ship it today", accent_word_index:number=1, accent:enum="green"
sources: component
install_path: registry/components/headline-slam

### hero-device-assemble
group: remocn-port, showcase
what: Hero Device Assemble. A landing-page device hero assembles from layers.
sources: component
install_path: registry/components/hero-device-assemble

### hover-card
group: hover-card, overlay, remocn-port, ui-primitive
what: Hover Card. An Operator Black hover card with a matte profile preview and origin-aware Soft Optical reveal
sources: component
install_path: registry/components/hover-card

### icon-morph-beat
group: completion, demonstrate, icon, morph, motion-primitive, product-demo, state-change
what: Icon Morph Beat. An icon morphs between authored state silhouettes, shifts to an accent color, and marks completion with one restrained pulse.
use_when: Jobs: demonstrate. Profile: state-change.
variables: pair:enum="mic-check", accent:enum="green"
sources: component
install_path: registry/components/icon-morph-beat

### icon-swap
group: icon, swap, transition-primitive, transitions-dev-port
what: Icon Swap. A scale-and-blur icon swap primitive for toolbar and action state changes
sources: component
install_path: registry/components/icon-swap

### image-expand-to-fullscreen
group: remocn-port, transition-primitive
what: Image Expand to Fullscreen. An image tile expands into a full-frame scene transition.
sources: component
install_path: registry/components/image-expand-to-fullscreen

### infinite-bento-pan
group: remocn-port, showcase
what: Infinite Bento Pan. A bento board pans forever with feature cards at different depths.
sources: component
install_path: registry/components/infinite-bento-pan

### infinite-marquee
group: remocn-port, showcase
what: Infinite Marquee. A looping marquee primitive for logos, tags, and feature pills.
sources: component
install_path: registry/components/infinite-marquee

### ink-bleed-reveal
group: deterministic, experiment, gooey, motion-primitive, reveal, svg-filter, texture
what: Ink Bleed Reveal. Liquid ink blooms through paper under a gooey blur-plus-threshold filter, merges, then contracts as a crisp slotted mark resolves beneath it, with static seeded paper grain riding the result.
use_when: Jobs: reveal. Profile: materialize.
variables: blobs:number=5, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/ink-bleed-reveal

### inline-highlight
group: caption, highlight, motion-primitive, text
what: Inline Highlight. A clean marker-style inline highlight that animates behind text using a CSS scale variable
sources: component
install_path: registry/components/inline-highlight

### input
group: field, input, remocn-port, ui-primitive
what: Input. A video-safe text field with label, helper copy, focus state, and typed-value reveal
sources: component
install_path: registry/components/input

### input-feedback
group: feedback, input, transition-primitive, transitions-dev-port
what: Input Feedback. A transitions.dev-inspired input feedback primitive with shake, clear affordance, and success state
sources: component
install_path: registry/components/input-feedback

### input-group
group: field, input-group, remocn-port, ui-primitive
what: Input Group. A compound input with technical prefix, editable value, and attached action
sources: component
install_path: registry/components/input-group

### input-otp
group: field, input-otp, remocn-port, ui-primitive
what: Input OTP. A segmented one-time-code field with tabular digits and an active slot
sources: component
install_path: registry/components/input-otp

### iris-reveal
group: bridge, circle-reveal, clip-path, iris, reveal, slots, transition, transitions
what: Iris Reveal. A circle clip-path opens from an authored origin revealing state B over state A in one confident pass, then holds on B. Classic register dims and desaturates the before state so the after state lands in full color; a thin accent rim rides the iris edge. Callers fill the named before/after slot panels; token-styled defaults render when a slot is left empty.
use_when: Jobs: bridge, reveal. Profile: holdable.
variables: iris_x:number=50, iris_y:number=50, open_at:number=0.35, register:enum="color", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/iris-reveal

### item
group: item, list, remocn-port, ui-primitive
what: Item. A border-led interactive list row with neutral monogram, compact metadata, and deterministic hover state
sources: component
install_path: registry/components/item

### kbd
group: kbd, remocn-port, shortcut, ui-primitive
what: Kbd. A physical keyboard legend with machined keycap depth, system monospace type, and finite press motion
sources: component
install_path: registry/components/kbd

### keyframe-scrub-stack
group: advanced-motion, anime-inspired, hyperframes-native
what: Keyframe Scrub Stack. A keyframe-sequenced stack of cards with offset timing and easing presets.
sources: component
install_path: registry/components/keyframe-scrub-stack

### kinetic-center-build
group: motion-primitive, remocn-port, typography
what: Kinetic Center Build. A centered phrase builder where words push into place until the line locks.
sources: component
install_path: registry/components/kinetic-center-build

### label
group: form, label, remocn-port, ui-primitive
what: Label. A calm form label with compact requirement metadata for video UI scenes
sources: component
install_path: registry/components/label

### landing-code-showcase
group: remocn-port, showcase
what: Landing Code Showcase. A product hero where code output becomes a live preview card.
sources: component
install_path: registry/components/landing-code-showcase

### light-sweep-pass
group: deterministic, light, motion-primitive, overlay, overlays, slots, sweep, texture
what: Light Sweep Pass. A traveling key light re-shades a slotted scene: a soft diagonal gradient band crosses the frame once while every per-element highlight and shadow shifts in lockstep (all driven by one --light-x property), then the light settles into a resting key. Quiet, expensive-feeling; the scene itself never moves. Callers fill the named scene slot; a token hero-and-cards default renders when it is left empty.
use_when: Jobs: texture. Profile: holdable.
variables: angle:number=115, sweep_at:number=0.9, strength:enum="standard", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/light-sweep-pass

### line-by-line-slide
group: motion-primitive, remocn-port, typography
what: Line-by-Line Slide. Each line enters from the left with staggered slide and exits to the right.
sources: component
install_path: registry/components/line-by-line-slide

### line-swap
group: beat, deterministic, emphasize, motion-primitive, swap, text-effects
what: Line Swap. A masked full-line beat replacement: line A holds center then exits up through an overflow-hidden mask as line B enters bottom-up on the same beat, with an optional accent underline drawing beneath one word of line B.
use_when: Jobs: emphasize. Profile: beat-swap.
variables: line_a:string="Everyone promised you.", line_b:string="Almost nobody promised you control.", swap_at:number=1.5, underline_word:string="control", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/line-swap

### live-code-compilation
group: code-animation, remocn-port
what: Live Code Compilation. A code editor compiles into a preview panel with status ticks.
sources: component
install_path: registry/components/live-code-compilation

### locked-nucleus-orbit
group: deterministic, effects, intro, lockup, motion-primitive, orbit, reveal
what: Locked Nucleus Orbit. A fixed center nucleus anchors deterministic satellite orbits that settle into a composed lockup.
use_when: Jobs: reveal. Profile: orbit.
variables: label:string="core", accent:enum="green", satellites:number=4
sources: component
install_path: registry/components/locked-nucleus-orbit

### logo-brand-close
group: brand, celebrate, close, end-card, logo, motion-primitive, typography
what: Logo Brand Close. A display-scale wordmark cascades letter by letter into a centered lockup, the accent brand period lands last, an optional tagline and wide-tracked mono URL settle beneath, and the finished identity holds dead still to the end of the film.
use_when: Jobs: celebrate. Profile: holdable.
variables: wordmark:string="HYPERFRAMES", tagline:string="Write HTML. Render video.", url:string="hyperframes.heygen.com", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/logo-brand-close

### logo-sting
group: brand, impact, logo, motion-primitive, reveal, sting
what: Logo Sting. A wordmark slams into its final scale, fires one accent ring and one white impact frame, then holds completely still.
use_when: Jobs: reveal. Profile: burst.
variables: wordmark:string="HYPERFRAMES", accent:enum="green"
sources: component
install_path: registry/components/logo-sting

### logo-wall
group: data, logos, prove, social-proof, stagger
what: Logo Wall. A trusted-by wall of placeholder lettermark logos that fades and scales into place with a deterministic per-cell stagger.
use_when: Jobs: prove. Profile: holdable.
variables: rows:number=3, cols:number=5, stagger:number=45
sources: component
install_path: registry/components/logo-wall

### mask-reveal-up
group: motion-primitive, remocn-port, typography
what: Mask Reveal Up. Lines reveal upward through a tight mask with compact stagger.
sources: component
install_path: registry/components/mask-reveal-up

### masked-slide-reveal
group: motion-primitive, remocn-port, typography
what: Masked Slide Reveal. Words slide up out of an invisible horizontal mask one after another.
sources: component
install_path: registry/components/masked-slide-reveal

### matrix-decode
group: motion-primitive, remocn-port, typography
what: Matrix Decode. Random scramble resolves left-to-right into the target text.
sources: component
install_path: registry/components/matrix-decode

### menu-morph
group: menu, morph, transition-primitive, transitions-dev-port
what: Menu Morph. A transitions.dev-inspired hamburger and plus-menu morph primitive for compact action menus
sources: component
install_path: registry/components/menu-morph

### menubar
group: menubar, navigation, remocn-port, ui-primitive
what: Menubar. A compact matte menubar for editor chrome with physical press response and restrained current-item emphasis
sources: component
install_path: registry/components/menubar

### mesh-gradient-bg
group: effect, remocn-port
what: Mesh Gradient Background. A render-safe mesh gradient using animated radial layers.
sources: component
install_path: registry/components/mesh-gradient-bg

### micro-scale-fade
group: remocn-port, transition-primitive
what: Micro Scale Fade. A tiny scale-and-opacity transition for UI state changes.
sources: component
install_path: registry/components/micro-scale-fade

### micro-transitions
group: microinteraction, motion-primitive, transition, transition-primitive, transitions-dev-port, ui
what: Micro Transitions. A transitions.dev-inspired pack of badge, dropdown, modal, tabs, tooltip, and success-check micro transitions
sources: component
install_path: registry/components/micro-transitions

### modal-morph
group: demonstrate, deterministic, experiment, flip, modal, motion-primitive, shared-element, structure
what: Modal Morph. A small card expands into a full panel, shared-element style: both layouts measured once at mount, the container morphs by transform only (never width/height tweens) while keyed children counter-scale and re-flow onto their own measured targets as pure functions of time.
use_when: Jobs: demonstrate. Profile: shared-element.
variables: from_scale:number=1, expand_at:number=1.2, register:enum="calm", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/modal-morph

### morph-swap
group: bridge, condense, holdable, morph, reshape, slots, swap, transition, transitions
what: Morph Swap. Two slotted siblings stacked at one shared center: A holds, then condenses or reshapes into B on a shared 50% 50% transform origin. Condense shrink-fades A exactly as B scales up; reshape morphs the silhouette on scaleX/scaleY, never width or height tweens. Token card defaults render when a slot is left empty.
use_when: Jobs: bridge. Profile: holdable.
variables: swap_at:number=1.4, register:enum="condense", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/morph-swap

### morph-text
group: animation, gooey, kinetic, morph, text, text-effect, typography
what: Morph Text. Gooey text morph, cycles through an editable word list using SVG threshold + GSAP-driven blur for a fluid, satisfying transition effect
sources: component
install_path: registry/components/morph-text

### motion-blur
group: animation, effect, motion-blur, physics, velocity
what: Motion Blur. Velocity-driven motion blur, samples element position each frame and applies a one-sided SVG feGaussianBlur ghost trail proportional to speed
sources: component
install_path: registry/components/motion-blur

### multi-device-splay
group: demonstrate, desktop, device, motion-primitive, phone, splay, tablet, ui-props
what: Multi Device Splay. Phone, tablet, and desktop product mockups fan from a centered stack into a proud splayed arrangement with a subtle idle float.
use_when: Jobs: demonstrate. Profile: holdable.
variables: accent:enum="blue"
sources: component
install_path: registry/components/multi-device-splay

### multiplayer-cursors
group: collaboration, cursor, loop, multiplayer, pointer, pointers, presence, prove
what: Multiplayer Cursors. Labeled collaborator cursors with token-derived colors and soft glows drift from spread positions into a shared center zone, proving live multiplayer presence.
use_when: Jobs: prove. Profile: loop.
variables: cursorCount:number=4, labels:string="Ana,Ken,Wen,Mia"
sources: component
install_path: registry/components/multiplayer-cursors

### native-notification-pop
group: demonstrate, motion-primitive, notification, overlay, product-demo, spring
what: Native Notification Pop. One system-faithful notification banner (iOS or macOS) drops in over any scene on an accurate interruptible spring: fast arrival, soft overshoot, settled mass, backdrop blur, app dot, title, one body line. Holds; tucks away only via exit.
use_when: Jobs: demonstrate. Profile: holdable.
variables: title:string="Render complete", body:string="launch-cut.mp4 is ready to preview", app_label:string="HyperFrames", os:enum="ios", at:number=0.3, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/native-notification-pop

### native-select
group: control, native-select, remocn-port, ui-primitive
what: Native Select. A compact native select with a clear label, technical value, and focus state
sources: component
install_path: registry/components/native-select

### navigation-menu
group: navigation, navigation-menu, remocn-port, ui-primitive
what: Navigation Menu. An anchored navigation menu with a functional selection edge and opaque trigger-origin preview surface
sources: component
install_path: registry/components/navigation-menu

### notification-pileup
group: agitate, loop, mobile, notification, overload, pileup, ui-props
what: Notification Pileup. Mobile notification cards arrive faster and faster, each new alert pushing the existing stack downward into a dense, anxious tower.
use_when: Jobs: agitate. Profile: loop.
variables: count:number=7, speed:number=1, showBadges:enum="yes"
sources: component
install_path: registry/components/notification-pileup

### notification-stack
group: demonstrate, motion-primitive, notification, product-demo, stack, stagger
what: Notification Stack. 1 to 5 token notification cards slide-settle into a vertical stack on cues, newest on top; one card grows slightly and brightens as the focus while the rest dim by position.
use_when: Jobs: demonstrate. Profile: stack.
variables: titles:string="Build queued,Checks passed,Deploy live", bodies:string="Pipeline started for main,All 42 checks green,Now serving version 2.4", expand:number=-1, cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/notification-stack

### number-pop-in
group: number, pop, transition-primitive, transitions-dev-port
what: Number Pop In. A transitions.dev-inspired digit pop-in with blur, lift, and staggered value reveal
sources: component
install_path: registry/components/number-pop-in

### number-wheel
group: counter, data, motion-primitive, number
what: Number Wheel. A rolling digit counter primitive for metrics, prices, counts, and scoreboards
sources: component
install_path: registry/components/number-wheel

### offset-path-traveler
group: auto-rotate, demonstrate, motion-primitive, path, product-demo, traveler
what: Offset Path Traveler. A slotted traveler follows an authored path with tangent rotation, curved entry, and curved exit.
use_when: Jobs: demonstrate. Profile: path-travel.
variables: path:string="M -90 390 C 150 490 190 70 430 185 C 650 300 720 105 850 145 C 970 180 1030 85 1090 35", traveler_label:string="Live preview", accent:enum="green"
sources: component
install_path: registry/components/offset-path-traveler

### onboarding-stepper-flow
group: onboarding, remocn-port, stepper, ui-flow
what: Onboarding Stepper Flow. A composed onboarding flow with milestone rail, active step card, and next-action button
sources: component
install_path: registry/components/onboarding-stepper-flow

### orbital-feature-path
group: gsap-plugin, hyperframes-native, motionpath
what: Orbital Feature Path. Feature chips orbit a product core on timed SVG motion paths.
sources: component
install_path: registry/components/orbital-feature-path

### ordered-dither-pass
group: bridge, dither, effects, experiment, motion-primitive, quantize, reveal, texture, transition
what: Ordered Dither Pass. Bayer-matrix ordered dithering quantizes a slotted scene (rasterized once at mount): the image emerges from pure 2-tone noise to clean, or dissolves the reverse. Stateless per frame, never error diffusion.
use_when: Jobs: reveal, bridge. Profile: texture.
variables: matrix:enum="4", direction:enum="in", levels:number=2, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/ordered-dither-pass

### outline-draw
group: border, effects, mask, motion-primitive, outline, proof, prove
what: Outline Draw. A rounded outline that proves a callout by drawing clockwise as a hollow conic-gradient border with a clean closure.
use_when: Jobs: prove. Profile: burst.
variables: progress:number=100, thickness:number=6, radius:number=24
sources: component
install_path: registry/components/outline-draw

### oversized-cursor
group: actor, cursor, demonstrate, interaction, motion-primitive, pointer, pointers
what: Oversized Cursor. A deliberately oversized macOS-style pointer that enters off-screen, travels to a target, clicks to ignite a visible response, then exits
use_when: Jobs: demonstrate. Profile: interaction.
variables: cursor_variant:enum="light", target_x:number=55, target_y:number=55, click_label:string="Generate", exit:enum="none"
sources: component
install_path: registry/components/oversized-cursor

### overwhelm-surround
group: agitate, effects, notifications, overwhelm, pressure
what: Overwhelm Surround. Tasks, tabs, pings, and notification bubbles accelerate inward around a calm central subject, turning overload into visible spatial pressure.
use_when: Jobs: agitate. Profile: holdable.
variables: count:number=16, centerLabel:string="You", intensity:number=1
sources: component
install_path: registry/components/overwhelm-surround

### page-slide
group: page, slide, transition-primitive, transitions-dev-port
what: Page Slide. A transitions.dev-inspired page slide primitive with outgoing and incoming panels
sources: component
install_path: registry/components/page-slide

### pagination
group: navigation, pagination, remocn-port, ui-primitive
what: Pagination. A tactile pagination row with 40px controls, a recessed current page, and deterministic press feedback
sources: component
install_path: registry/components/pagination

### pan-stations
group: agitate, camera, cross-shelved, exhibit, features, pan, stations
what: Pan Stations. A lateral camera move across a continuous row of labeled feature stations, with a steady dwell at each stop before the next pan.
use_when: Jobs: exhibit, agitate. Profile: holdable.
variables: stationCount:number=4, labels:string="Capture,Edit,Render,Share", dwell:number=0.6
sources: component
install_path: registry/components/pan-stations

### panel-reveal
group: panel, reveal, transition-primitive, transitions-dev-port
what: Panel Reveal. A panel reveal primitive with height expansion and content fade
sources: component
install_path: registry/components/panel-reveal

### parallax-device-dive
group: camera, device, motion-primitive, parallax, phone, transition
what: Parallax Device Dive. A canonical phone rises into view before the camera pushes through its screen and layered app UI expands to fill the frame.
use_when: Jobs: transition. Profile: dive.
variables: accent:enum="blue", app_title:string="Dashboard"
sources: component
install_path: registry/components/parallax-device-dive

### parallax-unzoom
group: grid, hero, parallax, reveal, transition, unzoom
what: Parallax Unzoom. Reveal transition, focus card scales down from full frame as siblings parallax in to form a grid (reverse of parallax-zoom)
sources: component
install_path: registry/components/parallax-unzoom

### parallax-zoom
group: grid, hero, parallax, transition, zoom
what: Parallax Zoom. Center card scales up to fill the frame while siblings parallax outward, inspired by the eBay Playbook hero transition
sources: component
install_path: registry/components/parallax-zoom

### particle-image-reveal
group: canvas, deterministic, intros-reveals, motion-primitive, particles, reveal
what: Particle Image Reveal. A seeded deterministic particle field converges and settles while a slotted image reveals beneath it, the trail thinning until the image holds clean.
use_when: Jobs: reveal. Profile: materialize.
variables: density:enum="med", direction:enum="ltr", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/particle-image-reveal

### per-character-rise
group: motion-primitive, remocn-port, typography
what: Per Character Rise. Letters slide up from below with crisp, deliberate kinetic timing.
sources: component
install_path: registry/components/per-character-rise

### per-word-crossfade
group: motion-primitive, remocn-port, typography
what: Per-Word Crossfade. Words gently fade into place with a short vertical drift for calm keynote rhythm.
sources: component
install_path: registry/components/per-word-crossfade

### per-word-rise
group: motion-primitive, reveal, stagger, text-effects, typography
what: Per Word Rise. Words or characters rise into place in a controlled blur-to-sharp cascade, settle softly on landing, and hold still until the cut (optional fade or up exit).
use_when: Jobs: reveal. Profile: stagger.
variables: text:string="WORDS IN MOTION", split:enum="word", cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/per-word-rise

### perspective-marquee
group: motion-primitive, remocn-port, typography
what: Perspective Marquee. A 3D tilted marquee with depth feel as items roll toward the horizon.
sources: component
install_path: registry/components/perspective-marquee

### physical-exit
group: drop, exit, momentum, motion, motion-primitive, slide, toss
what: Physical Exit. A card exits with physical momentum in toss, drop, or slide mode, carrying acceleration and rotation through the final offscreen pose without fading.
use_when: Jobs: exit. Profile: physical.
variables: mode:enum="toss", text:string="Later", accent:enum="green"
sources: component
install_path: registry/components/physical-exit

### popover
group: overlay, popover, remocn-port, ui-primitive
what: Popover. An Operator Black anchored popover with a matte surface and trigger-origin Soft Optical motion
sources: component
install_path: registry/components/popover

### pricing-tier-focus
group: remocn-port, showcase
what: Pricing Tier Focus. Pricing cards shift focus from free to pro with spotlight emphasis.
sources: component
install_path: registry/components/pricing-tier-focus

### progress
group: progress, remocn-port, status, ui-primitive
what: Progress. An Operator Black progress primitive with a mint active segment and tabular percentage value
sources: component
install_path: registry/components/progress

### progress-steps
group: remocn-port, ui-primitive
what: Progress Steps. A vertical progress sequence with clear complete, current, and waiting states.
sources: component
install_path: registry/components/progress-steps

### pull-back-reveal
group: camera, motion-primitive, pull-back, recontextualize, reveal
what: Pull Back Reveal. A tight stat detail holds, then one decelerating camera pull-back reveals the headline and supporting cards that recontextualize it.
use_when: Jobs: reveal. Profile: reveal.
variables: detail_text:string="+312%", headline:string="Growth compounds", accent:enum="green"
sources: component
install_path: registry/components/pull-back-reveal

### pull-to-refresh
group: demonstrate, gesture, interaction, mobile, pointer, pointers, refresh
what: Pull to Refresh. A mobile list pulls through nonlinear rubber-band resistance, arms at a threshold, commits to a bounded loading indicator, then snaps exactly back to rest.
use_when: Jobs: demonstrate. Profile: interaction.
variables: pullDistance:number=120, spinnerStyle:enum="ring"
sources: component
install_path: registry/components/pull-to-refresh

### push-in
group: camera, emphasize, focus, holdable, motion-primitive, push-in
what: Push In. A centered headline gains focus through one slow, continuous camera push and a gentle fade out.
use_when: Jobs: emphasize. Profile: holdable.
variables: text:string="Focus", intensity:enum="standard"
sources: component
install_path: registry/components/push-in

### radial-surround
group: agitate, converge, layout, motion-primitive, problem-setup, radial, ring, surround
what: Radial Surround. Labeled hairline chips assemble around a centered subject on an elliptical ring, then optionally converge inward with a subtle edge dim. The center never moves: surrounded, not zoomed.
use_when: Jobs: agitate. Profile: surround.
variables: center_label:string="Your team", chips:string="Docs,Tickets,Dashboards,Inbox,Chat,Sheets", close_in:boolean=true, cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/radial-surround

### radio
group: control, radio, remocn-port, ui-primitive
what: Radio Group. An accessible radio group with restrained selection and active-label emphasis
sources: component
install_path: registry/components/radio

### registry
group: remocn-port, ui-primitive
what: Registry. An Operator Black registry list for compact installable-component metadata.
sources: component
install_path: registry/components/registry

### remocn-ui
group: remocn-port, ui-primitive
what: Remocn UI. An Operator Black summary of the UI primitive families available in HyperFrames.
sources: component
install_path: registry/components/remocn-ui

### resizable
group: layout, remocn-port, resizable, ui-primitive
what: Resizable. An accessible split-pane primitive with structural edges, a keyboard-focusable handle, and deterministic resizing
sources: component
install_path: registry/components/resizable

### rgb-glitch-text
group: motion-primitive, remocn-port, typography
what: RGB Glitch Text. RGB-offset text copies jitter briefly for a controlled glitch window.
sources: component
install_path: registry/components/rgb-glitch-text

### rolling-number
group: motion-primitive, remocn-port, typography
what: Rolling Number. Odometer-style number places roll at their own speed and settle exactly.
sources: component
install_path: registry/components/rolling-number

### rubber-band-bumper
group: bridge, motion-primitive, overshoot, resistance, rubber-band, transition, transitions
what: Rubber Band Bumper. An outgoing panel pulls against increasing resistance, holds at tension, then snaps past an edge with overshoot as the incoming panel settles behind it.
use_when: Jobs: bridge. Profile: elastic.
variables: direction:enum="up", accent:enum="green"
sources: component
install_path: registry/components/rubber-band-bumper

### scale-down-fade
group: motion-primitive, remocn-port, typography
what: Scale Down Fade. A restrained premium settle-in followed by scale-down fade readiness.
sources: component
install_path: registry/components/scale-down-fade

### scan-band
group: chromatic, distortion, effects, motion-primitive, reveal, scan, typography, wordmark
what: Scan Band. A diagonal distortion band sweeps once across a clean wordmark, revealing clipped red and cyan offsets only inside the moving band.
use_when: Jobs: reveal. Profile: sweep.
variables: wordmark:string="HYPERFRAMES", band_angle:number=12
sources: component
install_path: registry/components/scan-band

### scramble-reveal
group: deterministic, motion-primitive, reveal, scramble, text-effects
what: Scramble Reveal. A deterministic hacker-style text reveal that cycles fixed glyph rows and locks the target string from left to right.
use_when: Jobs: reveal. Profile: decode.
variables: text:string="HYPERFRAMES", accent:enum="green", style:enum="terminal", exit:enum="none"
sources: component
install_path: registry/components/scramble-reveal

### screen-flow-carousel
group: carousel, feature-tour, product-demo, rail, screens, slot
what: Screen Flow Carousel. Two to five app screens ride a horizontal rail: one primary at center, neighbors receded, advancing on cues with a velocity-matched throw and a smooth long-tail catch while a mono caption swaps with each advance. Screens are slots with token skeleton defaults.
use_when: Jobs: feature-tour. Profile: carousel.
variables: screens:number=3, captions:string="", cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/screen-flow-carousel

### scroll-area
group: layout, remocn-port, scroll-area, ui-primitive
what: Scroll Area. A focused matte viewport with spacing-led list content and synchronized seek-safe scrollbar motion
sources: component
install_path: registry/components/scroll-area

### scroll-camera-story
group: camera, demonstrate, parallax, scroll, sections, servo, slot, story
what: Scroll Camera Story. A compressed forced-scroll cinematic pass: a tall scene of slotted sections travels past the camera top to bottom, depth layers parallax at different rates, each section rises as the camera reaches it, and the pass decelerates into a held final section.
use_when: Jobs: demonstrate. Profile: camera.
variables: sections:number=3, travel:number=220, cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/scroll-camera-story

### scroll-feed
group: agitation, demonstrate, effects, feed, loop, motion-primitive, scroll
what: Scroll Feed. A loop-friendly column of varied skeleton post cards scrolls upward with subtle motion trails and an agitated pace.
use_when: Jobs: demonstrate. Profile: continuous.
variables: speed:enum="doom", card_count:number=6, cues:string="", exit:enum="none"
sources: component
install_path: registry/components/scroll-feed

### segmentation-flood
group: ai, canvas, demonstrate, deterministic, experiment, hud, motion-primitive, product-demo
what: Segmentation Flood. Machine-vision read of a slotted subject: translucent accent segmentation masks flood on in quantized scanline steps, each region gets a thin bracket and mono label chip, a deterministic 2-frame HUD flicker rides the pass, then the labeled read settles clean.
use_when: Jobs: demonstrate. Profile: machine-read.
variables: regions:string="Figure, Signal, Ground", flood_at:number=0.8, flicker:enum="on", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/segmentation-flood

### select
group: control, remocn-port, select, ui-primitive
what: Select. An origin-aware select with a matte menu and explicit selected option
sources: component
install_path: registry/components/select

### select-item
group: remocn-port, ui-primitive
what: Select Item. A compact option list with selection check, technical hints, and disabled state.
sources: component
install_path: registry/components/select-item

### separator
group: layout, remocn-port, separator, ui-primitive
what: Separator. A one-pixel structural separator with horizontal and vertical variants plus a seek-safe progress reveal
sources: component
install_path: registry/components/separator

### settings-toggle-flow
group: remocn-port, settings, toggle, ui-flow
what: Settings Toggle Flow. A composed settings flow with preference rows, toggle switches, and active-state feedback
sources: component
install_path: registry/components/settings-toggle-flow

### shader-displacement-panel
group: advanced-motion, hyperframes-native
what: Shader Displacement Panel. A CSS/WebGL-inspired displacement panel for premium scene reveals without a custom shader dependency.
sources: component
install_path: registry/components/shader-displacement-panel

### shared-axis-y
group: motion-primitive, remocn-port, typography
what: Shared Axis Y. Per-word vertical shared-axis transition for sharp editorial swaps.
sources: component
install_path: registry/components/shared-axis-y

### shared-axis-z
group: motion-primitive, remocn-port, typography
what: Shared Axis Z. Scale-based shared-axis transition for focus shifts and context depth.
sources: component
install_path: registry/components/shared-axis-z

### sheet
group: overlay, remocn-port, sheet, ui-primitive
what: Sheet. An Operator Black side sheet with a flat backdrop and right-edge Soft Optical motion
sources: component
install_path: registry/components/sheet

### shimmer-sweep
group: effect, highlight, shimmer, text
what: Shimmer Sweep. Animated light sweep across text or elements using a CSS gradient mask, ideal for accents and premium reveals
sources: component
install_path: registry/components/shimmer-sweep

### short-slide-down
group: motion-primitive, remocn-port, typography
what: Short Slide Down. New words drop from above and push the stack downward into a locked composition.
sources: component
install_path: registry/components/short-slide-down

### short-slide-right
group: motion-primitive, remocn-port, typography
what: Short Slide Right. The phrase glides in from the left while words reveal in sequence.
sources: component
install_path: registry/components/short-slide-right

### sidebar
group: navigation, remocn-port, sidebar, ui-primitive
what: Sidebar. A single-plane sidebar with spacious link rhythm, logical-start selection, and soft deterministic entry motion
sources: component
install_path: registry/components/sidebar

### signup-flow
group: form, remocn-port, signup, ui-flow
what: Signup Flow. A composed signup flow with social action, email field, password field, and submit button
sources: component
install_path: registry/components/signup-flow

### simulated-cursor
group: cursor, motion-primitive, ui, walkthrough
what: Simulated Cursor. A lightweight cursor pointer and click pulse for product walkthroughs and agent UI demos
sources: component
install_path: registry/components/simulated-cursor

### skeleton
group: loading, remocn-port, skeleton, ui-primitive
what: Skeleton. An Operator Black loading skeleton using deterministic solid layers instead of gradient shimmer
sources: component
install_path: registry/components/skeleton

### skeleton-block
group: remocn-port, ui-primitive
what: Skeleton Block. An Operator Black skeleton block built from deterministic solid loading rows.
sources: component
install_path: registry/components/skeleton-block

### skeleton-reveal
group: reveal, skeleton, transition-primitive, transitions-dev-port
what: Skeleton Reveal. A skeleton loader transition that pulses, then cross-fades into content
sources: component
install_path: registry/components/skeleton-reveal

### slider
group: control, remocn-port, slider, ui-primitive
what: Slider. An accessible slider with semantic progress fill, physical thumb, and value readout
sources: component
install_path: registry/components/slider

### slit-scan-reveal
group: canvas, deterministic, experiment, motion-primitive, reveal, slit-scan, time
what: Slit Scan Reveal. The frame's rows sample an authored subject at offset times: a canvas painter draws row slices of one pure position function evaluated at t minus offset(row), smearing arrival through time until the offsets collapse to zero and the mark holds coherent.
use_when: Jobs: reveal. Profile: time-smear.
variables: axis:enum="rows", spread:number=0.45, resolve_at:number=2.2, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/slit-scan-reveal

### slot-machine-roll
group: motion-primitive, remocn-port, typography
what: Slot Machine Roll. A vertical reel scrolls characters from one value to another.
sources: component
install_path: registry/components/slot-machine-roll

### soft-blob-touch
group: blob, demonstrate, grain, material, motion-primitive, product-demo, touch
what: Soft Blob Touch. A granular soft blob idles with slow internal drift; a scripted touch dot decel-arrives, the blob deforms toward it with an attraction bulge, then recovers with a velocity-preserving spring. No hard edges anywhere.
use_when: Jobs: demonstrate. Profile: material.
variables: touch_x:number=66, touch_y:number=38, touch_at:number=1.6, grain:enum="fine", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/soft-blob-touch

### soft-blur-in
group: blur, motion-primitive, reveal, text
what: Soft Blur In. A soft opacity, blur, and lift reveal for headlines, captions, and product UI callouts
sources: component
install_path: registry/components/soft-blur-in

### spatial-push
group: remocn-port, transition-primitive
what: Spatial Push. A physical depth transition that presses the old scene backward.
sources: component
install_path: registry/components/spatial-push

### spinner
group: loading, remocn-port, spinner, ui-primitive
what: Spinner. An Operator Black finite loading spinner with a 1.5px progress ring and status label
sources: component
install_path: registry/components/spinner

### split-tilt-cards
group: book-open, compare, holdable, layout, motion-primitive, slots, tilt
what: Split Tilt Cards. Two equal-weight cards arrive from opposite wings with mirrored rotateY book-open tilts under one shared perspective, pill badges spring-pop at each inner edge, and the pair holds with a barely-there phase-opposed idle float. Card bodies are content slots with token skeleton defaults.
use_when: Jobs: compare. Profile: holdable.
variables: label_a:string="Before", label_b:string="After", badge_a:string="v1", badge_b:string="v2", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/split-tilt-cards

### spotlight-card
group: effect, remocn-port
what: Spotlight Card. A card with a scripted cursor spotlight and lit border.
sources: component
install_path: registry/components/spotlight-card

### spring-pop
group: effects, motion-primitive, overshoot, pop, reveal, spring
what: Spring Pop. A badge pops in from a visible near-rest scale, overshoots full size once, and settles cleanly.
use_when: Jobs: reveal. Profile: burst.
variables: overshoot:number=1.7, fromScale:number=0.9, text:string="New"
sources: component
install_path: registry/components/spring-pop

### spring-scale-in
group: motion-primitive, remocn-port, typography
what: Spring Scale In. Words pop in with soft overshoot scale like a physical spring settling.
sources: component
install_path: registry/components/spring-scale-in

### spring-stack-shuffle
group: demonstrate, interruptible-spring, motion-primitive, physics, product-demo, stack
what: Spring Stack Shuffle. A stack of 3 to 5 slotted cards reshuffles on cues: the back card throws over the top and lands at the front with real mass, the rest compress and resettle; cues that land mid-flight redirect the moving cards with velocity preserved.
use_when: Jobs: demonstrate. Profile: stack.
variables: cards:number=4, cues:string="0.9, 1.7, 1.95", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/spring-stack-shuffle

### stagger-cascade
group: effects, entrance, exhibit, grid, stagger
what: Stagger Cascade. A responsive grid of tile cards that fades and travels into place with an evenly spaced per-item GSAP stagger. The ordered cascade is the only visual mechanic.
use_when: Jobs: exhibit. Profile: burst.
variables: itemCount:number=6, stagger:number=60, direction:enum="up"
sources: component
install_path: registry/components/stagger-cascade

### stagger-lattice
group: advanced-motion, anime-inspired, hyperframes-native
what: Stagger Lattice. A staggered grid reveal inspired by Anime.js v4 stagger utilities, implemented with GSAP for HyperFrames.
sources: component
install_path: registry/components/stagger-lattice

### staggered-fade-up
group: motion-primitive, remocn-port, typography
what: Staggered Fade Up. Words fade in and slide up one after another with configurable delay.
sources: component
install_path: registry/components/staggered-fade-up

### star-rating-fill
group: data, fill, fractional, prove, rating, stars
what: Star Rating Fill. A token-driven star row whose colored layer sweeps to a rating, preserves the fractional final star, and can count the value in sync.
use_when: Jobs: prove. Profile: holdable.
variables: rating:number=4.8, starCount:number=5, showValue:enum="yes"
sources: component
install_path: registry/components/star-rating-fill

### stepper
group: progress, remocn-port, stepper, ui-primitive
what: Stepper. A horizontal stepper with numbered milestones, semantic progress, and current-step emphasis
sources: component
install_path: registry/components/stepper

### sticky-mock-swap
group: crossfade, demonstrate, feature-tour, mock, motion-primitive, product-demo, sticky
what: Sticky Mock Swap. A pinned product mock cross-fades through accent-tinted feature states while matching captions rise, hold, and exit beside it.
use_when: Jobs: demonstrate. Profile: sticky-swap.
variables: captions:string="Instant previews,Zero config,Ship on Friday", accent:enum="violet"
sources: component
install_path: registry/components/sticky-mock-swap

### stitched-text-draw
group: craft, deterministic, experiment, motion-primitive, reveal, stitch, text-effects, type
what: Stitched Text Draw. Text drawn as thread stitches: a single-stroke display alphabet draws via attribute-driven dashoffset with stitch-tuned dash patterns, seeded angle jitter, needle-hole dots, a leading needle, and a thread-tail overshoot per letter.
use_when: Jobs: reveal. Profile: thread-stitch.
variables: text:string="STITCH", stitch:enum="fine", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/stitched-text-draw

### stop-motion-cadence
group: boil, demonstrate, deterministic, experiment, motion-primitive, stepped, stop-motion, time-law
what: Stop Motion Cadence. The stepped-time law as a demo primitive: one driver quantizes timeline time to floor(t * fps) / fps and feeds ALL motion; four token paper-cut shapes throw-and-land with squash on hits, 2-frame boil jitter seeded per step, and sparkle accents living exactly 2 to 3 frames.
use_when: Jobs: demonstrate. Profile: stepped-time.
variables: fps:enum="10", boil:enum="on", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/stop-motion-cadence

### store-badge-lockup
group: ask, cta, mobile, prop, store-badges, ui-props
what: Store Badge Lockup. Settles a short headline above equal-size App Store and Google Play badges as a token-driven mobile end-card call to action.
use_when: Jobs: ask. Profile: holdable.
variables: headline:string="Get the app", showApple:enum="yes", showGoogle:enum="yes"
sources: component
install_path: registry/components/store-badge-lockup

### strikethrough-replace
group: motion-primitive, remocn-port, typography
what: Strikethrough Replace. Draw a strike line across old text, then reveal the replacement.
sources: component
install_path: registry/components/strikethrough-replace

### success-check
group: check, success, transition-primitive, transitions-dev-port
what: Success Check. A success check primitive with ring pop, path draw, and subtle rotate blur
sources: component
install_path: registry/components/success-check

### svg-line-draw-loader
group: advanced-motion, anime-inspired, hyperframes-native
what: SVG Line Draw Loader. An Anime.js-style path drawing loader implemented as a seekable GSAP stroke timeline.
sources: component
install_path: registry/components/svg-line-draw-loader

### svg-mask-reveal
group: effect, effects, exhibit, mask, reveal, svg, wordmark
what: SVG Mask Reveal. A soft token-colored sweep reveals media only through an editable SVG wordmark mask.
use_when: Jobs: exhibit. Profile: burst.
variables: text:string="REVEAL", revealProgress:number=100, featherPx:number=24
sources: component
install_path: registry/components/svg-mask-reveal

### svg-stroke-trace
group: intro, intros-and-reveals, line-draw, motion-primitive, reveal, stroke, svg
what: SVG Stroke Trace. An authored SVG path draws from its measured length, holds with subtle drift, and optionally fills when the path is closed.
use_when: Jobs: reveal. Profile: trace.
variables: path:string="M 92 328 C 178 142 292 138 366 276 C 430 396 500 414 558 262 C 622 94 724 112 786 274 C 836 406 894 376 930 194", stroke_width:number=12, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/svg-stroke-trace

### swipe-rail
group: cards, demonstrate, gesture, interaction, motion-primitive, rail, swipe
what: Swipe Rail. A contact circle leads a horizontal card rail through a fast drag, momentum carry, and settled snap to the next card.
use_when: Jobs: demonstrate. Profile: gesture.
variables: card_count:number=4, accent:enum="green", card_label_prefix:string="Feature"
sources: component
install_path: registry/components/swipe-rail

### switch
group: remocn-port, switch, toggle, ui-primitive
what: Switch. A tactile switch with a physical thumb and semantic on/off treatment
sources: component
install_path: registry/components/switch

### table
group: data, remocn-port, table, ui-primitive
what: Table. A compact structured-data table with machined row rules, semantic statuses, and tabular time values
sources: component
install_path: registry/components/table

### tabs
group: navigation, remocn-port, tabs, ui-primitive
what: Tabs. A minimal tab primitive with an inset mint selection edge, open content hierarchy, and a seek-safe indicator
sources: component
install_path: registry/components/tabs

### tabs-slide-indicator
group: indicator, tabs, transition-primitive, transitions-dev-port
what: Tabs Slide Indicator. A pill indicator transition that slides between active tabs
sources: component
install_path: registry/components/tabs-slide-indicator

### telemetry-hud
group: demonstrate, deterministic, hud, motion-primitive, product-demo, telemetry
what: Telemetry HUD. Quiet mono debug-HUD readouts frame a slotted subject: corner brackets draw on, label:value lines tick their values on cues, one readout emphasized in accent. The subject never moves; the HUD breathes zero.
use_when: Jobs: demonstrate. Profile: holdable.
variables: readouts:string="fps:59.94,latency:11.8 ms,gpu:38%,heap:1.2 GB", emphasize:number=0, cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/telemetry-hud

### terminal-simulator
group: code-animation, remocn-port
what: Terminal Simulator. A terminal window types commands and streams log output.
sources: component
install_path: registry/components/terminal-simulator

### terminal-to-browser-deploy
group: remocn-port, showcase
what: Terminal to Browser Deploy. Terminal deploy logs hand off into a live browser preview.
sources: component
install_path: registry/components/terminal-to-browser-deploy

### testimonial-card
group: prop, prove, quote, social-proof, testimonial, ui-props
what: Testimonial Card. Reveals a customer quote at reading pace, then settles its avatar, author name, and handle beneath as a clean proof beat.
use_when: Jobs: prove. Profile: holdable.
variables: quote:string="This changed how we ship.", author:string="Ken Tanaka", handle:string="@ken", rating:number=5
sources: component
install_path: registry/components/testimonial-card

### testimonial-proof-card
group: deterministic, motion-primitive, proof, proof-stats, prove, quote, social-proof, testimonial
what: Testimonial Proof Card. A quote card whose testimonial reveals per-line through a soft mask, with an avatar disc (initials default, image slot), mono name and role, an optional company text mark, and one emphasis substring underlined in accent ink after the quote lands.
use_when: Jobs: prove. Profile: testimonial.
variables: quote:string="We shipped our launch video in a single afternoon", name:string="Maya Chen", role:string="Head of Product", company:string="NORTHWIND", emphasis:string="single afternoon", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/testimonial-proof-card

### text-shimmer
group: emphasis, emphasize, motion-primitive, shimmer, specular, text-effects
what: Text Shimmer. A static headline receives one clean specular gradient sweep through its glyphs, then returns to its ordinary text color.
use_when: Jobs: emphasize. Profile: drift.
variables: text:string="Effortless", accent:enum="green", sweep_at:number=1.2
sources: component
install_path: registry/components/text-shimmer

### text-stagger
group: stagger, text, transition-primitive, transitions-dev-port
what: Text Stagger. A transitions.dev-inspired text stagger primitive with enter, shimmer, and exit-ready words
sources: component
install_path: registry/components/text-stagger

### text-state-swap
group: swap, text, transition-primitive, transitions-dev-port
what: Text State Swap. A text state swap primitive with outgoing blur and incoming lift
sources: component
install_path: registry/components/text-state-swap

### textarea
group: field, remocn-port, textarea, ui-primitive
what: Textarea. A resilient multiline field with a precise focus treatment and readable copy
sources: component
install_path: registry/components/textarea

### texture-mask-text
group: effect, mask, text, text-effect, texture
what: Texture Mask Text. CSS luminance masks that cut holes through letterforms - 66 pre-built texture masks from ambientCG PBR color maps
sources: component
install_path: registry/components/texture-mask-text

### three-orbiting-cards
group: hyperframes-native, three-js, webgl
what: Three Orbiting Cards. A Three.js-powered orbit scene driven by a paused GSAP timeline for deterministic renders.
sources: component
install_path: registry/components/three-orbiting-cards

### three-particle-ribbon
group: hyperframes-native, three-js, webgl
what: Three Particle Ribbon. A lightweight Three.js point ribbon with timeline-controlled camera and shader-like color drift.
sources: component
install_path: registry/components/three-particle-ribbon

### ticker-takeover
group: headline, motion-primitive, reveal, slot-machine, ticker, typography
what: Ticker Takeover. A mono ticker rolls through options, locks on a final word with an accent flash, and promotes it into a full-frame headline.
use_when: Jobs: reveal. Profile: kinetic.
variables: options:string="faster,smarter,together,everywhere", final_word:string="together", accent:enum="green"
sources: component
install_path: registry/components/ticker-takeover

### tilt-card
group: card, tilt, transition-primitive, transitions-dev-port
what: Tilt Card. A transitions.dev-inspired tilt card primitive with depth layers and hover-style parallax
sources: component
install_path: registry/components/tilt-card

### titlecard-calm
group: calm, motion-primitive, orient, title-card, typography
what: Titlecard Calm. A restrained title card where a mono kicker and generous grotesque headline fade upward, drift almost imperceptibly, and exit cleanly.
use_when: Jobs: orient. Profile: calm.
variables: headline:string="Less, but better", kicker:string="DESIGN PRINCIPLE"
sources: component
install_path: registry/components/titlecard-calm

### titlecard-lockup
group: breather, lockup, motion-primitive, orient, title-card, typography
what: Titlecard Lockup. The calm breather titlecard: an optional mono kicker fades up, the wordmark settles dead-center with one restrained move, a hairline rule draws left to right, a mono label fades beneath, and the lockup holds truly still.
use_when: Jobs: orient. Profile: calm.
variables: wordmark:string="HYPERFRAMES", label:string="WRITE HTML. RENDER VIDEO.", kicker:string="INTRODUCING", rule:enum="show", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/titlecard-lockup

### toast
group: notification, remocn-port, toast, ui-primitive
what: Toast. An Operator Black toast with a semantic success check, progress rail, and stack-origin motion
sources: component
install_path: registry/components/toast

### toggle
group: control, remocn-port, toggle, ui-primitive
what: Toggle. A tactile toggle button with distinct pressed and unpressed states
sources: component
install_path: registry/components/toggle

### toggle-flip
group: demonstrate, interaction, prop, reference-prop, toggle, ui-props
what: Toggle Flip. An oversized UI toggle switch that flips with real physicality: thumb overshoot, track color crossfade, and a soft press-compress before release. The reference prop of the ui-props family.
use_when: Jobs: demonstrate. Profile: interaction.
variables: direction:enum="on", label:string="Auto-save", size:number=40
sources: component
install_path: registry/components/toggle-flip

### toggle-group
group: control, remocn-port, toggle-group, ui-primitive
what: Toggle Group. A segmented toggle group with a recessed sliding selection indicator
sources: component
install_path: registry/components/toggle-group

### tool-menu-slide-in
group: remocn-port, transition-primitive
what: Tool Menu Slide In. A tool menu enters with short-axis slide and icon stagger.
sources: component
install_path: registry/components/tool-menu-slide-in

### tooltip
group: overlay, remocn-port, tooltip, ui-primitive
what: Tooltip. An Operator Black tooltip with a technical trigger icon and origin-aware Soft Optical reveal
sources: component
install_path: registry/components/tooltip

### top-down-letters
group: motion-primitive, remocn-port, typography
what: Top-Down Letters. Letters descend from above in a pronounced staircase with zero blur.
sources: component
install_path: registry/components/top-down-letters

### touch-indicator
group: demonstrate, gesture, mobile, motion-primitive, pointer, pointers, touch
what: Touch Indicator. A translucent contact-circle gesture actor for mobile UI scenes: it touches the glass, causes a same-frame response, and lifts. Tap or swipe, picked by variable.
use_when: Jobs: demonstrate. Profile: interaction.
sources: component
install_path: registry/components/touch-indicator

### tracing-beam
group: attention, beam, demonstrate, motion-primitive, path, product-demo, spotlight
what: Tracing Beam. A glowing dash follows one SVG path through three UI elements, lifting and brightening each element in sequence.
use_when: Jobs: demonstrate. Profile: attention.
variables: labels:string="Search,Preview,Export", accent:enum="cyan"
sources: component
install_path: registry/components/tracing-beam

### tracking-in
group: motion-primitive, reveal, text, typography
what: Tracking In. A precise letter-spacing reveal for premium headings and interface labels
sources: component
install_path: registry/components/tracking-in

### trust-strip
group: logo-strip, motion-primitive, proof, proof-and-stats, prove, trust, wordmarks
what: Trust Strip. A monochrome trust row of wide-tracked mono wordmarks that fade in with an opacity-only left-to-right stagger, then hold dead still.
use_when: Jobs: prove. Profile: quiet-proof.
variables: marks:string="Northwind, Acme Corp, Globex, Initech, Umbra", tone:enum="muted", cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/trust-strip

### type-match-cut
group: bridge, continuity, match-cut, motion-primitive, transition, transitions, typography
what: Type Match Cut. A headline splits vertically around an incoming panel, which grows from the negative space and takes the frame as the words exit through opposite edges.
use_when: Jobs: bridge. Profile: match-cut.
variables: text:string="Meet the new editor", accent:enum="green"
sources: component
install_path: registry/components/type-match-cut

### typed-prompt
group: demonstrate, deterministic, motion-primitive, product-demo, prompt, typing, ui-props
what: Typed Prompt. A prompt line types itself in chunked human cadence behind a deterministic blinking caret, with optional backspace-and-retype correction of the final word.
use_when: Jobs: demonstrate. Profile: typing.
variables: text:string="Generate a product launch video", prompt_glyph:string=">", cadence:enum="human", caret:enum="blink", correction:string="", cues:string="", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/typed-prompt

### typewriter
group: motion-primitive, remocn-port, typography
what: Typewriter. Character-by-character text reveal with a deterministic blinking cursor.
sources: component
install_path: registry/components/typewriter

### ui-focus-zoom
group: camera, demonstrate, focus, pan, product-demo, servo, slot, zoom
what: UI Focus Zoom. A full app surface establishes with one settle, then the camera zooms and pans to an anchored region on its cue and holds the zoomed state, with an optional soft focus halo at the anchor. The surface is a slot with a token-styled skeleton default.
use_when: Jobs: demonstrate. Profile: camera.
variables: anchor_x:number=64, anchor_y:number=36, zoom:number=1.6, zoom_at:number=1.4, halo:enum="show", accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/ui-focus-zoom

### variable-axis-type
group: axis, emphasize, kinetic-type, typography, variable-font
what: Variable Axis Type. A locked one-line headline whose weight or width axis morphs into a decisive emphasis beat.
use_when: Jobs: emphasize. Profile: burst.
variables: text:string="IMPACT", axis:enum="wght", fromValue:number=200, toValue:number=900
sources: component
install_path: registry/components/variable-axis-type

### variable-font-flex
group: deterministic, emphasize, experiment, motion-primitive, text-effects, type, variable-font
what: Variable Font Flex. A word lands while its variable-font weight and width axes flex from hairline-condensed to black-wide with per-character stagger; font-size eases inversely so the letterforms gain mass while the box holds.
use_when: Jobs: emphasize. Profile: axis-flex.
variables: text:string="FLEX", axis:enum="both", stagger:number=0.06, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/variable-font-flex

### vector-editor-rig
group: app-chrome, bezier, demonstrate, design-tool, pen-tool, prop, ui-props, vector
what: Vector Editor Rig. A dark design-tool app chrome with a live vector pen path, sequential anchor points, bezier handles, a selection frame, and theme-driven blue accents.
use_when: Jobs: demonstrate. Profile: holdable.
variables: tool:enum="pen", pathLabel:string="Logo"
sources: component
install_path: registry/components/vector-editor-rig

### velocity-throw-snap
group: exhibit, feature-tour, motion-primitive, physics, rail, snap, throw, velocity
what: Velocity Throw Snap. A five-shot rail whips past on a fast decaying curve, then overshoots and snaps the selected hero shot exactly to center.
use_when: Jobs: exhibit. Profile: kinetic.
variables: hero_index:number=2, accent:enum="green", card_label_prefix:string="Shot"
sources: component
install_path: registry/components/velocity-throw-snap

### vignette
group: cinematic, effect, overlay, vignette
what: Vignette. Cinematic radial vignette overlay using a pure-CSS gradient, darkens the edges to pull focus toward the center
sources: component
install_path: registry/components/vignette

### vox-annotate
group: annotation, deterministic, emphasize, marker, motion-primitive, text-effects, typography
what: Vox Annotate. The Vox-style annotate gesture: a keyword in a held sentence gets a hand-drawn marker while a thin connector draws up to a mono callout label, all as one choreographed beat on the cue.
use_when: Jobs: emphasize. Profile: emphasis.
variables: text:string="Ship the story, not the spec", keyword:string="story", note:string="the annotate beat", style:enum="highlight", draw_at:number=0.9, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/vox-annotate

### whip-pan-cut
group: bridge, motion-blur, slots, speed-ramp, transition, transitions, velocity-match, whip-pan
what: Whip Pan Cut. A full-frame whip pan: scene A whips off laterally with capped directional motion blur while scene B enters in the same direction at matched velocity, on a speed-ramp profile with a decelerating catch. Both scenes ride one strip, so seam velocity is exact by construction. Callers fill the named before/after slot panels; token-styled defaults render when a slot is left empty.
use_when: Jobs: bridge. Profile: transition.
variables: direction:enum="left", whip_at:number=0.25, accent:enum="green", exit:enum="none"
sources: component
install_path: registry/components/whip-pan-cut

### wordmark-tiles
group: raster, reveal, tiles, typography, wordmark
what: Wordmark Tiles. A wordmark resolves from deterministic color noise into correctly cropped glyph tiles through a spatially modulated GSAP wave.
use_when: Jobs: reveal. Profile: holdable.
variables: text:string="LAUNCH", columns:number=12, waveStagger:number=40
sources: component
install_path: registry/components/wordmark-tiles

### x-follow-card
group: remocn-port, social-overlay
what: X Follow Card. A social follow card with avatar, handle, and follower motion.
sources: component
install_path: registry/components/x-follow-card

### x-followers-overview
group: remocn-port, social-overlay
what: X Followers Overview. A social analytics card with count-up and audience pills.
sources: component
install_path: registry/components/x-followers-overview

### zoom-through-transition
group: remocn-port, transition-primitive
what: Zoom Through Transition. A transition that zooms through a focal card into the next scene.
sources: component
install_path: registry/components/zoom-through-transition
