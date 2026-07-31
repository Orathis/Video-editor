# Gold Audit

## Boundary

The committee is not a judge of runs. It never sees any run output, run record, checkpoint, score, or anything derived from the eval grid. Each pass sees exactly one brief and the full shelf, and answers which move the brief describes. This is a reconstruction task against the corpus gold-construction process.

The three passes are independent. Every pass receives an identical context built only from the brief and full shelf, with no prior pass response or accumulated state.

## Corpus result

- Corpus accuracy: 83.46% (227/272)
- Accuracy floor: 95.00%
- Status: BLOCK
- Unanimous agreement count: 217
- Disagreement count: 55

The 95 percent floor limits uncertain labels to at most 15 of a 300-brief corpus. A 90 percent floor could admit 30 wrong briefs and contaminate 270 main-grid cells, so it is too permissive before a large paid run. Falling below the floor blocks the grid with no continue-with-caveat path.

Hand decisions are authoritative. When present, a hand decision replaces both the constructed gold candidate and the committee resolution for the final corpus result.

## Disagreements

### Disagreement 011

Constructed gold candidates: marker-highlight

Committee candidates: marker-highlight, vox-annotate

Committee majority: vox-annotate

- Pass 1: vox-annotate, The brief describes an editorial news graphic where a full sentence establishes first, followed by a hand-drawn marker emphasis and human callout on a key term while holding the composition steady.
- Pass 2: vox-annotate, The brief describes establishing a full statement, then applying a vivid editorial accent/human callout across a key term at a precise cue while holding steady, which matches vox-annotate.
- Pass 3: marker-highlight, The brief describes establishing a full display sentence first, followed by drawing an editorial SVG marker highlight over a targeted key phrase while holding the scene steady.

### Disagreement 020

Constructed gold candidates: particle-text-dissolve

Committee candidates: code-shader-dissolve

Committee majority: code-shader-dissolve

- Pass 1: code-shader-dissolve, The brief describes an emergent text/statement resolving out of subtle field noise into crisp readability and holding for comprehension, matching Code Shader Dissolve's effect of resolving content out of seeded noise and holding crisp.
- Pass 2: code-shader-dissolve, The brief describes a high-stakes statement resolving out of subtle field noise into sharp readability and holding for comprehension, matching Code Shader Dissolve which resolves content out of seeded noise with a shader front and holds crisp.
- Pass 3: code-shader-dissolve, The brief describes a message emerging and resolving into sharp readability from field noise and holding for comprehension, which aligns with code-shader-dissolve where content resolves out of seeded noise via a GPU shader and holds crisp.

### Disagreement 047

Constructed gold candidates: whiteboard-ink

Committee candidates: flowchart

Committee majority: flowchart

- Pass 1: flowchart, The brief describes a news-style analytical diagram constructing itself sequentially to show how elements connect, featuring a pop of focal contrast and holding alongside summary text, matching the 16:9 flowchart primitive.
- Pass 2: flowchart, The brief describes an analytical broadcast news segment featuring a diagram that builds sequentially with connected elements, sticky-note style nodes, and text summaries in a 16:9 landscape format.
- Pass 3: flowchart, The brief calls for a 16:9 animated diagram/decision tree constructing itself sequentially through connected elements before holding the complete graphic alongside summary text.

### Disagreement 061

Constructed gold candidates: marker-highlight

Committee candidates: marker-highlight, vox-annotate

Committee majority: marker-highlight

- Pass 1: vox-annotate, The brief describes letting a full statement resolve before adding a swift, expressive accent onto a key phrase that feels like an authentic live editorial review, which perfectly matches vox-annotate.
- Pass 2: marker-highlight, The brief describes displaying a complete line/statement first and then drawing an expressive marker accent over a key word/phrase like an editorial review, which directly matches marker-highlight.
- Pass 3: marker-highlight, The brief describes a full statement settling on screen first, followed by a swift SVG marker stroke accent drawn directly over a key phrase to highlight it, which exactly matches marker-highlight.

### Disagreement 063

Constructed gold candidates: receipt-card

Committee candidates: caption-blend-difference, receipt-card

Committee majority: receipt-card

- Pass 1: receipt-card, The brief describes a tilted card flying in and flattening, slowly pushing in during hold, and marking a featured phrase with selection boxes and inverted text, which exactly matches receipt-card.
- Pass 2: receipt-card, The brief describes a tilted text/quote card flying in off-axis, squaring flat, performing a slow continuous push toward the camera, and filling selection boxes behind a featured phrase to invert the text color, which matches receipt-card.
- Pass 3: caption-blend-difference, The brief describes text that automatically inverts when the background field shifts behind the featured phrase, which matches caption-blend-difference's mix-blend-mode inversion behavior.

### Disagreement 069

Constructed gold candidates: focus-rack

Committee candidates: depth-rack-focus

Committee majority: depth-rack-focus

- Pass 1: depth-rack-focus, The move transfers attention from an initial sharp foreground message to a message on a deeper secondary plane through a deliberate optical rack focus dissolve.
- Pass 2: depth-rack-focus, The brief describes transferring attention once from an initial foreground message to a secondary revelation deeper in the composition (a far plane).
- Pass 3: depth-rack-focus, The brief describes transferring viewer attention from a sharp initial foreground message to a secondary message located deeper on a far plane.

### Disagreement 072

Constructed gold candidates: whiteboard-ink

Committee candidates: flowchart, whiteboard-ink

Committee majority: whiteboard-ink

- Pass 1: whiteboard-ink, The brief describes sequential drawing on a clean board with a focused lead element (pen nib) guiding the viewer along emerging paths/strokes, concluding with a summary caption statement like a live architectural breakdown.
- Pass 2: flowchart, The brief describes an animated schematic/diagram building sequentially with connectors, nodes, cursor interaction, and text resolution as if explaining an architecture on a board, which precisely matches flowchart.
- Pass 3: whiteboard-ink, The brief describes an SVG schematic drawing sequentially on a canvas with a focused lead element (pen nib) following each path tip, ending with a summary caption on a shared whiteboard backdrop.

### Disagreement 086

Constructed gold candidates: marker-highlight

Committee candidates: vox-annotate

Committee majority: vox-annotate

- Pass 1: vox-annotate, The brief describes establishing a headline and then drawing an organic analyst-style ink marker on a key word with a secondary callout gesture, which matches vox-annotate.
- Pass 2: vox-annotate, The brief describes establishing a headline, then applying an organic ink gesture to a decisive word with a connector to elevate it into a callout, which matches vox-annotate's hand-drawn marker and callout label on a held sentence.
- Pass 3: vox-annotate, The brief describes establishing a headline, then applying an organic hand-drawn ink marker to a key word alongside a callout label while holding the composition steady, which matches vox-annotate.

### Disagreement 097

Constructed gold candidates: whiteboard-ink

Committee candidates: logo-outro

Committee majority: logo-outro

- Pass 1: logo-outro, The brief describes a hero figure assembling piece by piece, followed by a focal pop of contrast and a delayed summary label before holding steadily, which directly matches the piece-by-piece assembly, glow bloom, and tagline fade-in of logo-outro.
- Pass 2: logo-outro, The brief describes a piece-by-piece assembly of a central element that concludes with a focal glow/contrast bloom and a delayed summary label/tagline fade-in, matching logo-outro.
- Pass 3: logo-outro, The move features piece-by-piece assembly, a focal glow bloom (pop of contrast), and a delayed tagline fade-in/label reveal before holding steadily.

### Disagreement 101

Constructed gold candidates: app-showcase

Committee candidates: app-showcase, multi-device-splay

Committee majority: app-showcase

- Pass 1: multi-device-splay, The brief calls for a central mobile interface panel flanked by supporting viewports in a splayed arrangement hovering in spatial alignment, matching multi-device-splay where device mockups fan out from a center stack with an idle float.
- Pass 2: app-showcase, The brief specifies displaying multiple mobile screen layouts with a central panel flanked by supporting floating viewports, matching the three floating smartphone screens of app-showcase.
- Pass 3: app-showcase, The brief calls for presenting multiple mobile interfaces simultaneously with a central panel flanked by hovering supporting viewports, matching the composition of three floating smartphone screens in app-showcase.

### Disagreement 118

Constructed gold candidates: flowchart

Committee candidates: flowchart-vertical

Committee majority: flowchart-vertical

- Pass 1: flowchart-vertical, The brief describes a portrait-oriented decision tree animation featuring sticky-note nodes, cursor interaction, typing correction for course-corrections, and blooming SVG connector routes.
- Pass 2: flowchart-vertical, The brief describes an ideation canvas optimized for portrait viewing featuring a course-correction and a cascading structure of choices, matching the portrait animated decision tree with typing correction in flowchart-vertical.
- Pass 3: flowchart-vertical, The brief describes a portrait-oriented ideation diagram featuring an initial idea with typing correction, connected nodes, and cascading secondary decision routes, matching flowchart-vertical.

### Disagreement 130

Constructed gold candidates: code-snippet-apple-terminal-clear-dark

Committee candidates: vector-editor-rig

Committee majority: vector-editor-rig

- Pass 1: vector-editor-rig, The brief describes a master craftsperson's digital workspace with a dark aesthetic where ideas unfold incrementally in real time, matching the dark design-tool app chrome and live vector path drawing of vector-editor-rig.
- Pass 2: vector-editor-rig, The brief describes establishing a dark, technical digital workspace for a craftsperson where visual ideas unfold incrementally in real time, which directly matches vector-editor-rig's dark design-tool chrome and sequential vector path drawing.
- Pass 3: vector-editor-rig, The brief describes a dark digital workspace for a master craftsperson where ideas unfold incrementally, matching the dark design-tool app chrome and live vector pen path sequence of vector-editor-rig.

### Disagreement 134

Constructed gold candidates: flowchart-vertical

Committee candidates: flowchart

Committee majority: flowchart

- Pass 1: flowchart, The brief describes an animated decision tree featuring an incoming human correction that alters downstream outcomes, matching the description and interaction model of flowchart.
- Pass 2: flowchart, The brief describes an animated decision tree featuring interactive logic nodes, downstream branch adjustments, and typing correction, which directly matches the flowchart component.
- Pass 3: flowchart, The brief describes an automated decision system with logic panels and an incoming human correction altering the downstream outcome, which matches the flowchart move featuring an animated decision tree with cursor interaction and typing correction.

### Disagreement 136

Constructed gold candidates: lt-clean-bar

Committee candidates: lt-mask-reveal

Committee majority: lt-mask-reveal

- Pass 1: lt-mask-reveal, The brief calls for a lower third that slicingly reveals speaker credentials and identity details along the bottom edge, matching lt-mask-reveal's clip-path reveal and accent sweep mechanism.
- Pass 2: lt-mask-reveal, The brief describes a lower third positioned along the lower edge that slicingly reveals a speaker's identity details and credentials using a clean mask reveal before smoothly vanishing.
- Pass 3: lt-mask-reveal, The brief calls for a structured lower third that slicingly reveals identity details, which matches lt-mask-reveal's accent sweep and clip-path reveal for speaker context.

### Disagreement 139

Constructed gold candidates: transitions-blur

Committee candidates: cross-warp-morph, domain-warp-dissolve

Committee majority: domain-warp-dissolve

- Pass 1: cross-warp-morph, The brief describes a seamless shader transition where surrounding visuals liquify and morph into a new image around a stable focal point, matching cross-warped morphing.
- Pass 2: domain-warp-dissolve, The brief describes a shader transition where an initial image melts away hard edges into a soft, atmospheric noise field and reconstitutes into the target image, which matches Domain Warp Dissolve.
- Pass 3: domain-warp-dissolve, The brief describes dissolving an initial scene by melting hard edges into a liquid-like warped atmosphere before crystallizing into a secondary image, which matches the fractal noise domain warping mechanism of Domain Warp Dissolve.

### Disagreement 141

Constructed gold candidates: code-snippet-apple-terminal-clear-light

Committee candidates: code-snippet-apple-terminal-clear-dark, code-snippet-apple-terminal-clear-light

Committee majority: code-snippet-apple-terminal-clear-dark

- Pass 1: code-snippet-apple-terminal-clear-dark, It simulates a shell session in Apple Terminal with a semi-transparent (frosted) dark background and animated typing of command lines.
- Pass 2: code-snippet-apple-terminal-clear-dark, The brief specifies simulating a shell interaction in a clean, frosted desktop environment with rhythmic command line animation, matching the semi-transparent dark background and shell typing of Apple Terminal Clear Dark.
- Pass 3: code-snippet-apple-terminal-clear-light, The brief calls for simulating live command-line interaction on a crisp, luminous, frosted desktop surface, which matches the Apple Terminal Clear Light move featuring a semi-transparent light background and typing animation of a shell session.

### Disagreement 151

Constructed gold candidates: code-snippet-apple-terminal-grass

Committee candidates: code-snippet-apple-terminal-grass, code-snippet-apple-terminal-homebrew

Committee majority: code-snippet-apple-terminal-grass

- Pass 1: code-snippet-apple-terminal-homebrew, The brief describes a classic command-driven canvas where high-contrast green phosphor lines carve through total darkness, matching the black background and bright green typing shell animation of the Apple Terminal Homebrew profile.
- Pass 2: code-snippet-apple-terminal-grass, The brief describes a classic command-driven terminal canvas where high-contrast phosphor lines (green text on a black background) step through input, matching the Apple Terminal Grass profile.
- Pass 3: code-snippet-apple-terminal-grass, The brief calls for high-contrast phosphor lines carving through darkness in a classic command-driven canvas, matching the black background with green text shell session of Apple Terminal Grass.

### Disagreement 155

Constructed gold candidates: lt-soft-pill

Committee candidates: lt-bold-block

Committee majority: lt-bold-block

- Pass 1: lt-bold-block, The brief describes a high-energy, self-contained lower-third visual anchor that introduces speaker credentials in the lower region of the frame and holds during key speaking moments.
- Pass 2: lt-bold-block, The brief describes an energetic lower third anchor in the lower screen region designed to establish a speaker's identity and credentials without overshadowing them, matching the High-Energy Bold Block lower third.
- Pass 3: lt-bold-block, This lower-third move provides a high-energy visual anchor in the lower screen region with a block reveal and accent pop, establishing the subject's identity and credentials while keeping the speaker as the primary focus.

### Disagreement 156

Constructed gold candidates: x-post

Committee candidates: testimonial-card

Committee majority: testimonial-card

- Pass 1: testimonial-card, The brief calls for a clean, holdable social proof prop (developer quote/praise) that steps onto the screen during a technical tool demonstration and settles its validation before clearing.
- Pass 2: testimonial-card, The brief calls for presenting a snapshot of developer praise and community sentiment as social validation before clearing the frame, perfectly matching testimonial-card's function of revealing a quote and settling author credentials as a clean proof beat.
- Pass 3: testimonial-card, The brief describes displaying a snapshot of developer sentiment and social validation during a technical demo, perfectly matching testimonial-card's purpose of presenting a customer quote and credentials as a clean proof beat.

### Disagreement 160

Constructed gold candidates: code-snippet-apple-terminal-homebrew

Committee candidates: code-snippet-apple-terminal-homebrew, typed-prompt

Committee majority: code-snippet-apple-terminal-homebrew

- Pass 1: code-snippet-apple-terminal-homebrew, The prompt describes a developer shell typing session with high-contrast phosphor green text against a dark background, matching the Apple Terminal Homebrew profile.
- Pass 2: code-snippet-apple-terminal-homebrew, The brief describes typing a terminal session with a high-contrast phosphor green glow against a dark void, which matches the Apple Terminal Homebrew profile (black background with bright green text and lime cursor).
- Pass 3: typed-prompt, The brief describes typing with a cadence reflecting human thought and holding before execution, matching typed-prompt which features typing in chunked human cadence with a deterministic blinking caret and optional correction.

### Disagreement 164

Constructed gold candidates: yt-lower-third

Committee candidates: x-follow-card

Committee majority: x-follow-card

- Pass 1: x-follow-card, The brief describes an identity badge positioned near the base of the frame displaying a profile and handle alongside a call to engagement, which matches the X Follow Card overlay.
- Pass 2: x-follow-card, The brief describes introducing a social identity card showing an avatar/profile and handle with a clear call to engagement at the base of the frame, which matches the x-follow-card.
- Pass 3: x-follow-card, The brief calls for a sleek identity badge featuring a visual profile and handle to build channel authority and prompt engagement, which directly describes the X Follow Card overlay.

### Disagreement 168

Constructed gold candidates: code-snippet-apple-terminal-man-page

Committee candidates: code-snippet-apple-terminal-novel

Committee majority: code-snippet-apple-terminal-novel

- Pass 1: code-snippet-apple-terminal-novel, The brief describes text streaming onto a warm, aged canvas for command-line craft, matching the warm parchment background and terminal typing animation of code-snippet-apple-terminal-novel.
- Pass 2: code-snippet-apple-terminal-novel, The brief specifies streaming command-line text onto a warm, aged canvas reminiscent of vintage documentation, which matches the warm parchment background and shell session typing animation of the Apple Terminal Novel profile.
- Pass 3: code-snippet-apple-terminal-novel, The brief calls for a raw command-line session typing across a warm, aged canvas reminiscent of vintage documentation, matching the warm parchment background and terminal shell profile of Apple Terminal Novel.

### Disagreement 170

Constructed gold candidates: vfx-magnetic

Committee candidates: tilt-card

Committee majority: tilt-card

- Pass 1: tilt-card, The tilt card primitive uses depth layers and hover-style parallax to make UI components softly lean toward the focal point while keeping figures legible.
- Pass 2: tilt-card, The tilt-card primitive provides depth layers and hover-style parallax, causing UI components to softly lean into the focal point while maintaining legibility.
- Pass 3: tilt-card, The brief describes UI components softly leaning into the viewer's focal point with subtle depth, matching the tilt-card primitive's depth layers and hover-style parallax.

### Disagreement 174

Constructed gold candidates: code-snippet-dark-2026

Committee candidates: code-snippet-dark-modern

Committee majority: code-snippet-dark-modern

- Pass 1: code-snippet-dark-modern, The brief calls for an authentic engineering workspace with sleek dark framing where code materializes live, which matches the VS Code workbench with Dark Modern theme and per-character typing.
- Pass 2: code-snippet-dark-modern, The brief specifies an authentic engineering workspace with sleek dark framing and live content typing, matching the full VS Code editor chrome in the Dark Modern theme.
- Pass 3: code-snippet-dark-modern, The brief specifies an authentic engineering workspace with live code typing inside sleek dark framing, matching the VS Code Dark Modern workbench code snippet.

### Disagreement 175

Constructed gold candidates: vfx-portal

Committee candidates: swirl-vortex

Committee majority: swirl-vortex

- Pass 1: swirl-vortex, The brief calls for a transformative transition centered on an expanding vortex that distorts the plane, which directly matches the Swirl Vortex shader transition.
- Pass 2: swirl-vortex, The brief describes a scene transition featuring an expanding vortex distortion that opens up into a new environment, which directly corresponds to swirl-vortex.
- Pass 3: swirl-vortex, The brief describes a dramatic scene transition featuring an expanding vortex distortion that draws the visual center into the new scene.

### Disagreement 177

Constructed gold candidates: transitions-grid

Committee candidates: grid-pixelate-wipe, transitions-grid

Committee majority: grid-pixelate-wipe

- Pass 1: transitions-grid, The brief specifies replacing a simple dissolve with a transition that breaks the canvas into a matrix/grid of synchronized elements that sweep across the screen, matching grid-based tile transitions.
- Pass 2: grid-pixelate-wipe, The brief calls for replacing a simple dissolve transition with a structured matrix sweep across the display, matching grid-pixelate-wipe where the screen dissolves into a grid of squares with staggered timing.
- Pass 3: grid-pixelate-wipe, The prompt specifies replacing a simple dissolve transition with a disciplined matrix (grid) sweep where synchronized visual elements fade out with staggered timing as a new scene emerges.

### Disagreement 179

Constructed gold candidates: code-snippet-dark-modern

Committee candidates: code-terminal-run, terminal-simulator

Committee majority: code-terminal-run

- Pass 1: code-terminal-run, It showcases a dedicated terminal workspace where prompt commands type out and output lines materialize line-by-line per cue, perfectly capturing an analytical digital creation phase.
- Pass 2: code-terminal-run, The brief calls for a terminal interface where technical actions and outputs materialize line by line with deterministic precision, which matches the behavior of code-terminal-run.
- Pass 3: terminal-simulator, The brief focuses on a dedicated terminal workspace where technical actions and decisions materialize line by line, which aligns with Terminal Simulator's command typing and log output streaming.

### Disagreement 180

Constructed gold candidates: vfx-shatter

Committee candidates: transitions-destruction

Committee majority: transitions-destruction

- Pass 1: transitions-destruction, The brief describes a violent, total mechanical disruption that breaks apart and clears the canvas, matching the destructive break-apart transition showcase.
- Pass 2: transitions-destruction, The brief calls for a violent and total disruption where the visual canvas scatters outward and breaks apart, perfectly matching the description and use case of destructive break-apart transitions.
- Pass 3: transitions-destruction, The brief describes a violent mechanical disruption that scatters visual integrity outward to clear the view, which matches destructive break-apart transitions.

### Disagreement 183

Constructed gold candidates: code-snippet-apple-terminal-pro

Committee candidates: code-terminal-run, code-typing

Committee majority: code-typing

- Pass 1: code-typing, The brief describes complex logic building incrementally down the screen with a tracking caret leading the eye during real-time code generation, which matches code-typing.
- Pass 2: code-terminal-run, The brief calls for a stark dark canvas where a command sequence builds incrementally with a vibrant focal marker (caret) leading the eye as lines execute, matching code-terminal-run.
- Pass 3: code-typing, The brief describes token-streamed code creation on a dark canvas where a vibrant caret leads the typing frontier line-by-line.

### Disagreement 184

Constructed gold candidates: code-snippet-dark-plus

Committee candidates: code-snippet-dark-modern

Committee majority: code-snippet-dark-modern

- Pass 1: code-snippet-dark-modern, It frames a realistic code editor workspace with full VS Code chrome and per-character typing animation on the central canvas.
- Pass 2: code-snippet-dark-modern, The brief describes an authentic digital workshop workspace featuring character-by-character typing animation on a central canvas surrounded by full contextual editor UI chrome.
- Pass 3: code-snippet-dark-modern, The brief describes framing a digital workspace with surrounding contextual UI where code ideas form character by character, matching the VS Code workbench setup with per-character typing animation in code-snippet-dark-modern.

### Disagreement 188

Constructed gold candidates: code-snippet-flight

Committee candidates: grid-card-assemble

Committee majority: grid-card-assemble

- Pass 1: grid-card-assemble, It stagger-assembles structural cards into a grid or vertical stacked layout via controlled slide and fade entrances before settling into a clean resting state.
- Pass 2: grid-card-assemble, The brief calls for structural components/cards entering sequentially from off-screen margins to assemble into a stacked vertical architecture and land cleanly in position, matching the specification of grid-card-assemble.
- Pass 3: grid-card-assemble, The brief describes structural components entering sequentially from margins to build a stacked architecture inside a vertical layout, which matches grid-card-assemble's mechanism of stagger-assembling cards into a grid or vertical list.

### Disagreement 191

Constructed gold candidates: code-snippet-apple-terminal-silver-aerogel

Committee candidates: code-terminal-run

Committee majority: code-terminal-run

- Pass 1: code-terminal-run, It presents a crisp terminal window showing active command execution and unfolding log output on a dark, high-contrast surface.
- Pass 2: code-terminal-run, It features a broadcast-ready terminal window displaying active digital execution with typed commands and sequential output lines unfolding against a dark, restrained background.
- Pass 3: code-terminal-run, The brief calls for a dark, broadcast-ready window showing an active digital system process unfolding in a crisp, logical rhythm, which matches the terminal panel command typing, execution beat, and sequential output printing of code-terminal-run.

### Disagreement 192

Constructed gold candidates: code-snippet-high-contrast

Committee candidates: code-snippet-dark-modern

Committee majority: code-snippet-dark-modern

- Pass 1: code-snippet-dark-modern, It features a full VS Code workbench with authentic editor chrome (activity bar, sidebar, tabs, terminal, status bar) and per-character line-by-line typing animation in the sleek Dark Modern theme, perfectly matching the rich technical environment and tactile coding rhythm requested.
- Pass 2: code-snippet-dark-modern, It showcases line-by-line typing within a full VS Code editor chrome complete with activity bar, sidebar, tabs, and status bar.
- Pass 3: code-snippet-dark-modern, The brief describes a developer typing line-by-line within a digital workspace featuring rich surrounding chrome, which matches the full VS Code workbench interface and per-character typing animation of code-snippet-dark-modern.

### Disagreement 193

Constructed gold candidates: sdf-iris

Committee candidates: iris-reveal

Committee majority: iris-reveal

- Pass 1: iris-reveal, The brief describes transitioning from an initial state to a new scene via a centered opening aperture that expands outward to fill the frame, which matches the circle clip-path opening behavior of iris-reveal.
- Pass 2: iris-reveal, The brief describes transitioning between scenes using a centered visual aperture that expands outward to reveal the new scene, matching the circle clip-path reveal mechanism of iris-reveal.
- Pass 3: iris-reveal, The brief describes a transition to a new scene driven by a centered visual aperture that opens smoothly outward, matching the circle clip-path transition of iris-reveal.

### Disagreement 195

Constructed gold candidates: code-snippet-apple-terminal-solid-colors

Committee candidates: code-snippet-high-contrast, code-terminal-run

Committee majority: code-terminal-run

- Pass 1: code-terminal-run, The brief focuses on rendering commands line-by-line in a high-contrast developer environment as a build executes, matching Code Terminal Run.
- Pass 2: code-terminal-run, The brief calls for rendering commands and streaming output line-by-line in a developer-first environment, which matches code-terminal-run's execution of commands and sequential output line reveals.
- Pass 3: code-snippet-high-contrast, The brief explicitly highlights a high-contrast developer-first theme with line-by-line typing animation for code and commands, perfectly matching the Code Snippet - High Contrast template.

### Disagreement 196

Constructed gold candidates: code-snippet-high-contrast-light

Committee candidates: flowchart, vector-editor-rig

Committee majority: vector-editor-rig

- Pass 1: vector-editor-rig, It presents a dark design-tool app workspace with a steady outer frame while a vector path, anchor points, and handles materialize on canvas in real time.
- Pass 2: flowchart, The brief calls for framing a high-clarity canvas to showcase logic unfolding in real time, matching the animated decision tree and node connectors of flowchart.
- Pass 3: vector-editor-rig, The prompt describes a creative tool workspace with a steady operational frame and a stark canvas where logic and creation unfold, which matches vector-editor-rig's dark design-tool chrome and live vector path drawing.

### Disagreement 198

Constructed gold candidates: transitions-radial

Committee candidates: iris-reveal

Committee majority: iris-reveal

- Pass 1: iris-reveal, The brief calls for a scene transition that unfolds like an iris from the core outward to reveal the secondary view over the primary layer, matching the iris-reveal mechanism.
- Pass 2: iris-reveal, The brief calls for a scene shift that unfolds like an iris from the core outward, revealing state B over state A, which matches the circular clip-path reveal mechanism of iris-reveal.
- Pass 3: iris-reveal, The brief calls for an unfolding iris transition from the core outward that yields from a primary layer to secondary content, perfectly matching the circular clip-path reveal mechanism of iris-reveal.

### Disagreement 199

Constructed gold candidates: code-snippet-light-2026

Committee candidates: code-snippet-light-modern

Committee majority: code-snippet-light-modern

- Pass 1: code-snippet-light-modern, The brief calls for a bright, approachable, crisp modern workspace context where content takes shape character by character inside an anchored frame. code-snippet-light-modern presents a full VS Code workbench in a bright Light Modern theme with per-character typing animation.
- Pass 2: code-snippet-light-modern, The brief calls for a bright, approachable, and polished modern workspace context displaying character-by-character live code typing within an anchored realistic frame, matching the VS Code workbench experience in the Light Modern theme.
- Pass 3: code-snippet-light-modern, The brief describes watching new ideas take shape character by character within a bright, crisp, and modern workspace context, which matches the VS Code workbench typing animation in the Light Modern theme.

### Disagreement 205

Constructed gold candidates: camera-rig-depth-stack

Committee candidates: depth-rack-focus

Committee majority: depth-rack-focus

- Pass 1: depth-rack-focus, The brief describes transitioning focus from a sharp foreground element to a lower/far plane message that resolves as the foreground dissolves, maintaining spatial continuity across depth layers as the stack moves.
- Pass 2: depth-rack-focus, The brief describes transferring attention from the foreground plane to a deeper background plane as foreground elements recede and the lower plane resolves and clears up while preserving spatial continuity.
- Pass 3: depth-rack-focus, The brief describes shifting focus from the foreground context to deeper structural details as foreground elements dissolve/recede and lower planes resolve to take primary focus.

### Disagreement 221

Constructed gold candidates: avatar

Committee candidates: news-ticker

Committee majority: news-ticker

- Pass 1: news-ticker, The brief calls for a news graphic with broadcast clarity, an identity mark/headline ribbon, and a live connection marker, which matches the news-ticker's live label and broadcast-style lower-third ticker.
- Pass 2: news-ticker, The brief describes a broadcast-style news graphic featuring an identity visual anchor and a live connection marker, matching the news-ticker element which includes a broadcast headline ribbon and live label.
- Pass 3: news-ticker, It delivers a broadcast-ready lower-third news graphic complete with a live label to confirm real-time presence while providing a headline ribbon and crawl during ongoing commentary.

### Disagreement 228

Constructed gold candidates: before-after-wipe

Committee candidates: comparison-split

Committee majority: comparison-split

- Pass 1: comparison-split, The brief describes comparing a baseline workspace state with an upgraded version using a wiping divider that settles off-center and holds both environments side by side, matching comparison-split.
- Pass 2: comparison-split, The brief describes comparing an unrefined baseline setup with an elevated state via a sweeping divider that rests off-center to hold both environments visible simultaneously, matching the comparison-split mechanic.
- Pass 3: comparison-split, The brief describes an unrefined baseline layer being swept across to reveal an elevated state, settling the boundary off-center for side-by-side comparison, which matches comparison-split's persistent divider wipe resting at a configurable split.

### Disagreement 231

Constructed gold candidates: soft-blur-in

Committee candidates: focus-blur-resolve

Committee majority: focus-blur-resolve

- Pass 1: focus-blur-resolve, The brief calls for text to resolve out of atmospheric obscurity into sharp focus like a camera pulling its lens into clarity, matching focus-blur-resolve's camera focus pull from heavy blur to crisp text.
- Pass 2: focus-blur-resolve, The brief describes text resolving out of heavy blur into sharp clarity like a camera pulling focus, which matches focus-blur-resolve.
- Pass 3: focus-blur-resolve, The brief describes hero text resolving out of heavy blur into clarity like a camera pulling focus, which matches focus-blur-resolve's premium focus pull from heavy blur to crisp text.

### Disagreement 232

Constructed gold candidates: blur-in

Committee candidates: focus-blur-resolve

Committee majority: focus-blur-resolve

- Pass 1: focus-blur-resolve, The brief describes messaging coming into sharp clarity from an atmospheric haze, which matches focus-blur-resolve's focus pull from heavy blur to crisp text.
- Pass 2: focus-blur-resolve, The brief calls for text transitioning from atmospheric haze into sharp clarity and absolute definition, matching the focus pull from heavy blur to crisp text in focus-blur-resolve.
- Pass 3: focus-blur-resolve, The brief describes text coming into sharp mental clarity out of atmospheric haze, matching focus-blur-resolve's focus pull from heavy blur to crisp text.

### Disagreement 243

Constructed gold candidates: button-group

Committee candidates: toggle-group

Committee majority: toggle-group

- Pass 1: toggle-group, The brief describes a segmented UI control with clustered choices, tactile depth, and a fluidly sliding indicator that shifts visual weight to highlight the new active/selected state.
- Pass 2: toggle-group, The brief describes a central interface element with clustered choices where selecting an option causes a smooth, sliding shift in active state, matching the segmented toggle group with its recessed sliding selection indicator.
- Pass 3: toggle-group, The brief describes a central interface component with clustered choices where active state shifts as visual weight slides fluidly to the new focal point, matching the segmented toggle group with its sliding selection indicator.

### Disagreement 244

Constructed gold candidates: calendar

Committee candidates: stagger-lattice, stop-motion-cadence

Committee majority: stop-motion-cadence

- Pass 1: stop-motion-cadence, The brief calls for establishing a precise temporal anchor with rhythmic, tactile confidence and physical landing mechanics, perfectly describing the stepped-time quantization and physical landing characteristics of stop-motion-cadence.
- Pass 2: stop-motion-cadence, The brief emphasizes a tactile, rhythmic, and deliberate temporal anchor within a creative timeline, matching the stepped-time mechanics and physical landing behavior of stop-motion-cadence.
- Pass 3: stagger-lattice, The brief calls for a precise focal point from which a structural grid unveils itself with rhythmic confidence, matching the Anime.js-inspired staggered grid reveal mechanics of stagger-lattice.

### Disagreement 248

Constructed gold candidates: inline-highlight

Committee candidates: inline-highlight, marker-highlight

Committee majority: inline-highlight

- Pass 1: inline-highlight, It animates a subtle marker-style accent highlight behind text to draw clean, quiet focus to a keyphrase within UI copy or analytical tiles.
- Pass 2: marker-highlight, It draws a subtle, timed marker stroke over a targeted phrase within a display line to anchor attention on a key takeaway.
- Pass 3: inline-highlight, It provides a clean, subtle marker-style highlight that animates behind a target keyphrase/text, perfectly matching the need for a tactile accent wash behind key metrics.

### Disagreement 249

Constructed gold candidates: caption-clip-wipe

Committee candidates: caption-clip-wipe, short-slide-right

Committee majority: caption-clip-wipe

- Pass 1: caption-clip-wipe, It performs a left-to-right clip-path wipe reveal for each word, smoothly unveiling phrases linearly with a sweeping spotlight effect across the text.
- Pass 2: short-slide-right, The brief calls for revealing phrases in sequence horizontally across the frame with linear momentum as words unfold, matching short-slide-right where the phrase glides in from the left while words reveal in sequence.
- Pass 3: caption-clip-wipe, It reveals text phrase by phrase using a left-to-right clip-path wipe per word, smoothly unfolding each word instead of popping in abruptly.

### Disagreement 251

Constructed gold candidates: swipe-rail

Committee candidates: velocity-throw-snap, whip-pan-cut

Committee majority: velocity-throw-snap

- Pass 1: velocity-throw-snap, The brief describes dynamic movement across sequential story slates that decelerates and snaps precisely onto a final hero headline, matching velocity-throw-snap's decaying curve and snapped center lockup.
- Pass 2: velocity-throw-snap, The brief describes a dynamic sequence sweeping across sequential slates/shots at speed before overshooting and snapping precisely to a final locked focal headline.
- Pass 3: whip-pan-cut, The brief describes a dynamic newsroom transition that carries the viewer across slates with motion blur and speed-ramped velocity before landing on the next headline with a decelerating catch.

### Disagreement 253

Constructed gold candidates: carousel

Committee candidates: screen-flow-carousel, scroll-camera-story

Committee majority: screen-flow-carousel

- Pass 1: screen-flow-carousel, It showcases a sequence of screens where one primary card remains centered while receded neighboring screens linger in peripheral view, advancing on cues with a swift throw and long-tail catch to transfer focus.
- Pass 2: screen-flow-carousel, This move features a central primary screen flanked by receded adjacent screens that linger in peripheral view, smoothly advancing focus from one media canvas to the next across cues.
- Pass 3: scroll-camera-story, The brief describes a vertical progression across media sections where adjacent cards parallax in depth and each section rises and locks into focus as the camera passes through the tall scene.

### Disagreement 254

Constructed gold candidates: chart

Committee candidates: animated-bar-chart, chart

Committee majority: chart

- Pass 1: chart, The brief describes an enterprise dashboard categorical bar chart where solid vertical blocks build bottom-up to let viewers compare magnitudes across discrete buckets.
- Pass 2: chart, The brief describes vertical blocks growing bottom-up to compare magnitude across discrete buckets in an enterprise dashboard context, matching the Operator Black categorical bar chart.
- Pass 3: animated-bar-chart, The brief describes vertical bars growing bottom-up to compare magnitudes across discrete buckets, matching the deterministic bar growth and value display of the animated bar chart.

### Disagreement 256

Constructed gold candidates: checkbox

Committee candidates: toggle-flip

Committee majority: toggle-flip

- Pass 1: toggle-flip, The brief describes a workspace UI decision moment where a container compresses on engagement and launches a high-contrast state change, matching the soft press-compress, thumb overshoot, and track color crossfade of the toggle-flip move.
- Pass 2: toggle-flip, The brief describes an oversized UI toggle switch featuring a soft press-compress upon engagement, followed by an immediate track color crossfade and crisp state change.
- Pass 3: toggle-flip, The brief describes a switch container that compresses upon engagement before releasing into an active signal with an interior visual highlight locking the state change, which precisely matches toggle-flip's press-compression and track color crossfade.

### Disagreement 262

Constructed gold candidates: collapsible

Committee candidates: collapsible, panel-reveal

Committee majority: collapsible

- Pass 1: panel-reveal, The brief describes expanding height to carve out vertical space and reveal sub-properties while keeping surrounding UI steady, matching panel-reveal's height expansion and content fade mechanics.
- Pass 2: collapsible, The brief describes tucking away dense visual controls until triggered, then smoothly expanding vertical space to reveal sub-properties while keeping surrounding UI anchored, matching the compact disclosure and height reveal functionality of collapsible.
- Pass 3: collapsible, The brief describes dense controls staying tucked away until explicitly summoned to reveal sub-properties through a smooth vertical expansion, matching Collapsible's compact disclosure surface and deterministic height reveal.

### Disagreement 263

Constructed gold candidates: combobox

Committee candidates: rank-list-settle

Committee majority: rank-list-settle

- Pass 1: rank-list-settle, The brief describes establishing a fixed focus line high in the vertical layout over a rolling high-density list panel and locking onto a target final entry, matching the signature mechanics of rank-list-settle.
- Pass 2: rank-list-settle, The brief describes establishing a focal field high in a vertical layout with a structured panel below through which data is scanned and brought to rest on a winning target entry, matching the mechanics of rank-list-settle.
- Pass 3: rank-list-settle, The brief describes setting up a focal line high in a vertical composition, scanning through high-density data rows beneath it, and locking onto the final target entry with emphasis.

### Disagreement 269

Constructed gold candidates: native-select

Committee candidates: vox-annotate

Committee majority: vox-annotate

- Pass 1: vox-annotate, This move delivers an editorial news-graphic annotation by taking a held sentence or visual metric and applying a choreographed marker stroke with a drawn connector to a callout label on a cue.
- Pass 2: vox-annotate, The brief calls for a data-driven broadcast editorial focal point where an emphasis marker and callout highlight a targeted parameter/keyword, matching the Vox Annotate effect.
- Pass 3: vox-annotate, The brief describes an editorial broadcast segment annotation where an unadorned visual line is enhanced with a marker highlight and callout label on cue, matching vox-annotate.

### Disagreement 280

Constructed gold candidates: dropdown-menu

Committee candidates: context-menu

Committee majority: context-menu

- Pass 1: context-menu, The brief describes an interface control unfolding directly from the user's focal point (pointer anchor) with a fresh green confirmation (mint selection check) on selection, matching the context-menu primitive.
- Pass 2: context-menu, The brief describes an Operator Black context menu that unfolds directly from a pointer anchor (focal point) with a mint (fresh green) selection check upon confirmation before closing.
- Pass 3: context-menu, The brief describes an interface control unfolding directly from a focal point (pointer anchor) with a dark container and a fresh green confirmation indicator (mint selection check) before closing.

## Sampled for hand decision

Disagreements are sampled deterministically by shelf group at 20 percent, with at least one per represented group when the sample size permits, capped at 30 and further bounded by the number of unanimous agreements. The control sample therefore has the same size and matches those groups where unanimous agreements are available.

The control exists because checking only disagreements cannot reveal errors where the constructor and committee share the same blind spot. Such an error appears as unanimous agreement and would otherwise never be audited.

### Disagreement sample

- 101 [3d, app, showcase], hand decision: pending
- 011 [Annotation.], hand decision: pending
- 047 [Annotation.], hand decision: pending
- 061 [Annotation.], hand decision: pending
- 072 [Annotation.], hand decision: pending
- 086 [Annotation.], hand decision: pending
- 097 [Annotation.], hand decision: pending
- 069 [Camera moves.], hand decision: pending
- 063 [Card assembly.], hand decision: pending
- 020 [Text effects.], hand decision: pending
- 205 [advanced-motion, hyperframes-native], hand decision: pending
- 130 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 141 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 151 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 160 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 168 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 183 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 191 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 195 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 221 [avatar, identity, remocn-port, ui-primitive], hand decision: pending
- 228 [before-after, compare, holdable, prop, slots, ui-props, wipe], hand decision: pending
- 174 [code, developer, showcase, vscode], hand decision: pending
- 179 [code, developer, showcase, vscode], hand decision: pending
- 184 [code, developer, showcase, vscode], hand decision: pending
- 192 [code, developer, showcase, vscode], hand decision: pending
- 196 [code, developer, showcase, vscode], hand decision: pending
- 170 [html-in-canvas, webgl], hand decision: pending
- 175 [html-in-canvas, webgl], hand decision: pending
- 139 [showcase, transition], hand decision: pending
- 177 [showcase, transition], hand decision: pending

### Unanimous control sample

- 001 [Annotation.], hand decision: pending
- 018 [Annotation.], hand decision: pending
- 022 [Annotation.], hand decision: pending
- 026 [Annotation.], hand decision: pending
- 036 [Annotation.], hand decision: pending
- 043 [Annotation.], hand decision: pending
- 002 [Camera moves.], hand decision: pending
- 003 [Card assembly.], hand decision: pending
- 009 [Text effects.], hand decision: pending
- 105 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 173 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 178 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 187 [apple, apple-terminal, code, developer, showcase, terminal], hand decision: pending
- 149 [showcase, transition], hand decision: pending
- 172 [showcase, transition], hand decision: pending
- 051 [Annotation.], hand decision: pending
- 012 [Camera moves.], hand decision: pending
- 019 [Camera moves.], hand decision: pending
- 023 [Camera moves.], hand decision: pending
- 013 [Card assembly.], hand decision: pending
- 006 [List assembly.], hand decision: pending
- 008 [Process sequences.], hand decision: pending
- 016 [Text effects.], hand decision: pending
- 024 [Text effects.], hand decision: pending
- 034 [Text effects.], hand decision: pending
- 010 [Transitions.], hand decision: pending
- 017 [Transitions.], hand decision: pending
- 021 [Transitions.], hand decision: pending
- 108 [bold, interview, lower-third, overlay, podcast], hand decision: pending
- 138 [shader, transition], hand decision: pending
