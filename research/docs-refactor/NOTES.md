# HyperFrames documentation refactor notes

This is the working notebook for facts, judgments, questions, and progress. Keep raw observations here; keep durable decisions in `PLAN.md`.

## 2026-07-31 — content correction and consolidation pass

- `guides/video-components.mdx` was labeled and linked as “Images and video”
  but contained a Catalog-components guide. It now performs the actual image
  and footage task.
- `guides/media-overlays.mdx` duplicated treatment-overlay blocks already owned
  by the Registry and implied a separate Studio insertion surface. The page and
  nav entry were removed; the old URL redirects to the real Catalog.
- `concepts/compositions.mdx` incorrectly said declarative `data-var-*`
  bindings do not exist. Runtime code, tests, the HTML schema, and the Variables
  page prove `data-var-text`, `data-var-src`, and scalar CSS bindings are
  supported. The contradiction is corrected.
- General authentication no longer claims that everything works without a key.
  Local creation/media have fallbacks; managed cloud and hosted MCP require
  authentication. First-time `publish` works anonymously and returns a claim
  URL; sign-in is needed for immediate ownership, in-place updates, and shared
  spaces.
- Studio source and visual edits autosave. Troubleshooting now asks users to
  save only files changed in an external editor or by an agent.
- Project Tour duplicated Concepts and Pipeline; its useful file map moved into
  `/concepts` and the old route redirects there.
- Common Questions repeated the journey, Studio, media, export, and support
  pages; it was removed from navigation and redirected to `/help`.
- The 3,339-word background-removal page, 1,757-word color-grading page, and
  1,509-word media-effects page were reduced to task guides. Exact flags and
  persistence contracts already live in CLI and schema reference.
- Current official host documentation was checked before updating the MCP
  setup: Claude custom connectors, ChatGPT MCP apps/developer mode, and Grok
  custom connectors have different plan and workspace requirements.
- The Studio front-door film passed its planning gate and is now in production
  under `scratchpad/studio-front-door-v2`. It uses a new real `Field Notes`
  project, River narration, the TT Norms media identity from the changelog
  workflow, the shared caption rail, music, sound, and real Studio capture. Do
  not integrate or upload it until the render, contact sheet, lint/check logs,
  media probe, and docs-width review pass.
- Source verification corrected several inherited absolutes and stale details:
  - seek-driven rendering does not promise identical pixels across machines;
  - HTML-in-Canvas is experimental and falls back to normal capture;
  - the current variable contract has seven types, including `font` and
    `image`;
  - the exported `FrameAdapter` utility is an experimental v0 API rather than
    the complete internal renderer contract;
  - current Remotion Studio supports direct visual editing and saves back to
    React code;
  - Figma storyboard reconstruction can use REST frame exports and does not
    require an MCP connector.
  - `hyperframes media-treatment` is a current, tested CLI command. It
    discovers the capability surface, analyzes local media, and applies,
    previews, or clears the same `data-color-grading` contract Studio uses.
  - Studio's current Effects surface is broader than Blur and Pixelate:
    Essentials, Retro & Glitch, Print, and Art groups are implemented in source.
  - The source-of-truth pass now targets a clean snapshot of current
    `origin/main`, not the older merge base of the docs branch. Final review
    requires rebasing/merging current main before sign-off.

## Baseline audit

- Public navigation contains 213 pages.
- 133 are catalog entries.
- 80 are non-catalog documentation pages.
- Current top tabs are Documentation, Catalog, Packages, SDK, and Reference.
- Product capability matrix: 82 capabilities.
  - Covered: 21
  - Partial: 29
  - Misplaced: 2
  - Wrong: 5
  - Missing: 25
- Studio capability matrix: 35 capabilities.
  - Covered: 1
  - Partial: 15
  - Misplaced: 1
  - Wrong: 2
  - Missing: 16
- Non-catalog docs contain about 130,000 words.
- The CLI package page alone contains more than 10,000 words.
- `mint validate` and `mint broken-links` passed before the refactor.
- Mintlify CLI currently needs Node 20 locally. Default Node 26 is unsupported.

## Confirmed content problems

- `introduction.mdx` says there is no timeline editor. This is false.
- `guides/timeline-editing.mdx` says split is unsupported. Studio ships split at playhead, a razor tool, and split-all behavior.
- Several guides use incomplete or outdated skills installation guidance.
- `packages/studio.mdx` documents the Studio package and embedding surface, not how to use the Studio product.
- `contributing/studio-manual-dom-editing.mdx` contains important user-facing Studio behavior in the wrong section.
- `weekly-updates.mdx` has almost no content.
- `guides/mcp.mdx` exists but is not in public navigation.
- `guides/website-to-video.mdx` describes a workflow now handled by Product Launch Video.
- Showcase and Launch Videos overlap.
- Claude Design and Open Design overlap.
- Common Mistakes and Troubleshooting overlap.

## Current Studio facts verified in source

- Storyboard and Preview modes.
- Storyboard board/source views, frame statuses, focus, comments, direction, voiceover iteration, and agent handoff.
- Canvas selection and direct manipulation: move, resize, rotate, crop, nudge, snapping, marquee, groups, and stacking order.
- Layers panel.
- Timeline move, trim, split, razor, split-all, snapping, beats, zoom, auto-keyframe, keyframe diamonds, nested composition expansion, breadcrumbs, and multi-drag.
- GSAP animation editing, speed curves, per-keyframe easing, keyframe CRUD and retiming, motion paths, gesture recording, and computed-tween unrolling.
- Property controls for text, layout, style, media, 3D, and color grading.
- Assets import, preview, cross-project assets, and timeline drag/drop.
- Blocks browsing, search, insertion, and drag/drop.
- Source editor and file tree.
- Variables creation, binding, and live preview.
- Captions timeline, properties, and animation.
- Slideshow slides, notes, fragment holds, branches, and hotspots.
- Lint modal and copy-issues-to-agent.
- Render queue with MP4, WebM, MOV, quality, resolution, FPS, cancel, download, delete, and hide-finished controls.
- Undo/redo, capture current frame, and Ask Agent.

## Navigation judgment

The existing navigation is repository-shaped:

- Packages, SDK, and Reference are separate top-level destinations.
- Studio has no top-level human manual.
- General workflows are mixed with implementation concepts and deployment.
- Important pages compete with changelog and empty weekly updates in Getting Started.

New navigation should be task-shaped:

- Guides
- Studio
- Catalog
- Developers

## Header judgment

- Use the native Mintlify Aspen theme.
- Aspen was tested with the real refactored docs at desktop and 390px mobile widths.
- It provides a genuine full-width top header with logo, search, GitHub, primary action, and theme toggle.
- It places the four section tabs in a second full-width row.
- Maple was rejected because its header began after the left sidebar and kept the logo and theme toggle inside the sidebar column.
- Current logo is already configured for light and dark modes.
- The default appearance now follows the user’s system setting.
- Add GitHub and a primary action.
- Confirm the canonical Studio URL before adding the primary action.
- The temporary primary action is **Get started** and points to Quickstart.
- Keep Aspen's full-width header. A desktop-only layout override is intentional so the logo, tabs, search, actions, and theme toggle fit on one row.

## Questions to verify during implementation

- What is the canonical public Studio URL?
- Is Studio always used locally, hosted publicly, or both?
- Which screenshots can be generated from stable fixture projects?
- Which product workflows deserve separate pages based on actual user questions?
- Should old release URLs remain public but hidden, or redirect to a release archive?
- Is there an existing analytics baseline for searches and failed searches?

## Work log

### 2026-07-28

- Completed repository and public-doc audit.
- Built validated interactive report in `research/docs-audit/report.html`.
- Selected four-tab architecture.
- Created persistent docs rules, plan, and notes.
- Rebuilt navigation as Guides, Studio, Catalog, and Developers.
- Added collapsible nested groups and folded all Catalog categories by default.
- Switched from Maple to Aspen after desktop and mobile visual comparison.
- Rewrote Introduction and Quickstart.
- Added Guides, Catalog, Developers, concepts, media, export, help, product-launch, and path-selection landing pages.
- Added a 17-page Studio user section.
- Retired the empty Weekly Updates page.
- Replaced the stale Website to Video and incorrect Timeline Editing pages with redirects.
- Added MCP to public navigation.
- Corrected the main outdated skills installation commands.
- Mintlify build validation and broken-link checks passed after the first implementation pass.

### 2026-07-28 — second pass

- Added sendable, task-first pages for project structure, faceless explainers, PR videos, captions and recuts, motion graphics, music-driven videos, general video, voice and audio, transcription, quality review, and publishing.
- Merged Claude Design and Open Design into one maintained Design tools page.
- Merged Common Mistakes into a symptom-first Troubleshooting hub and redirected the old URL.
- Merged Showcase and Launch Videos into one Examples page with real finished work, source links, and starter templates.
- Added a human-readable Product updates page while keeping Changelog as the complete release archive.
- Added a task-based CLI guide before the full command reference.
- Removed the buried Studio manual-editing page and redirected it to the current user-facing Canvas guide.
- Retired the overlapping video-editor cheatsheet in favor of the current Studio shortcuts and task guides.
- Added Authentication and the orphaned Motion Blur component to public navigation. Every remaining MDX page is now reachable from navigation.
- Captured the current Studio from the included storyboard fixture and added the real workspace image to the Studio tour.
- Added freshness and ownership rules to `docs/AGENTS.md`.
- Mintlify build validation and broken-link checks passed after the second pass.

### 2026-07-28 — Studio and Catalog verification pass

- Verified the Studio manual against current UI source, tests, and a running Studio fixture.
- Corrected conceptual or outdated panel names to the visible controls people actually see:
  - top bar: Storyboard, Preview, Capture, Inspector, Export;
  - left sidebar: Code, Comps, Assets, Catalog;
  - inspector: Design, Layers, Renders, Slideshow when applicable, Variables;
  - lower-left action: Lint.
- Verified Code autosave, Assets project scopes, Catalog insertion behavior, render formats and controls, lint handoff, storyboard status meanings, and current keyboard shortcuts.
- Added real 1280×720 Studio images for the workspace, Storyboard, Inspector, and Renders panel.
- Added a narrow `.gitignore` exception for `docs/images/studio/*.jpg` so these authored screenshots are included while generated Catalog media remains ignored.
- Corrected the Storyboard feedback loop to **Save & copy message** followed by pasting into agent chat.
- Documented that `SCRIPT.md`, when present, is the final narration source and that **Open in Preview** applies to built frames.
- Reworked the Catalog page generator for all 134 items:
  - removed duplicate body titles;
  - added a plain-language agent request;
  - kept the terminal command as an alternative;
  - moved files, dimensions, and embed markup into labeled technical accordions.
- Added a short Common questions page with sendable answers for the most likely first-use and support questions.
- Replaced the oversized Feedback Collection telemetry specification with a task-focused Share feedback guide. Kept the public-project warning and essential privacy explanation.
- Reviewed the new Common questions, Storyboard, and Catalog item pages in a local Mintlify preview.
- Mintlify local search results cannot be tested: the local preview explicitly reports “Not available on local preview.” Search-result quality must be checked after deployment or through Mintlify analytics.
- Mintlify validation and broken-link checks passed after this pass.

### 2026-07-28 — final editorial and structural pass

- Resolved the header destination:
  - Studio remains project-local through `npx hyperframes preview`;
  - the global header action is **Playground**, linking to the official `https://www.hyperframes.dev/` browser experience.
- Rewrote the remaining general-audience outliers:
  - Prompt Guide → a concise human brief and feedback guide;
  - The Pipeline → a flexible idea-to-export explanation rather than a mandatory internal process;
  - HyperFrames vs Remotion → a shorter, balanced decision guide with current Studio and licensing language;
  - Rendering → a task-first CLI render guide, leaving exhaustive flags in the CLI reference;
  - Video Components → a human guide for choosing and adapting Catalog visuals;
  - HyperFrames MCP → current host-aware setup with honest plan, workspace, and beta caveats.
- Corrected stale public documentation:
  - removed hard-coded skill counts that had already drifted from the repository;
  - replaced obsolete `validate` composition guidance with `npx hyperframes check`;
  - removed old Website to Video labels;
  - standardized the HyperFrames brand spelling;
  - removed the remaining duplicate body H1;
  - guaranteed a description for every generated Catalog page.
- Added Playground as a no-local-setup path in Introduction and Choose your path.
- Added `research/docs-audit/current-state.html`, a visual after-state dashboard alongside the baseline audit.
- Final structural inventory:
  - 253 public documentation pages after syncing the latest `main` branch;
  - 253 pages represented in navigation;
  - zero orphan pages;
  - zero missing navigation targets;
  - every MDX page has frontmatter, a title, and a description.
- Final visual review confirmed the full-width Aspen header, Playground action, rewritten guide rendering, Studio images, default Mintlify navigation behavior, and after-state dashboard.
- Final checks:
  - `mint validate` passed;
  - `mint broken-links` passed;
  - `oxlint` passed for changed scripts;
  - `git diff --check` passed.

### 2026-07-28 — navigation polish after preview review

- Restored the navigation behavior used on `origin/main`: ordinary top-level groups in every tab, with no nested root, directory, expanded, or drilldown behavior.
- Kept the refactored page inventory and the new Guides, Studio, Catalog, and Developers information architecture.
- Removed all custom sidebar hierarchy and **On this page** CSS so both surfaces use Mintlify's unchanged default rendering.
- Confirmed the result in a local Mintlify preview; validation and broken-link checks still pass.

### 2026-07-28 — final navigation visual correction

- Kept the Aspen theme, four refactored tabs, and current page groupings.
- Matched the deployed main docs' sidebar treatment: 14px medium group headings, square links, no horizontal dividers, and one border segment per page so the active segment tracks the current page. Groups remain open and non-collapsible.
- Kept Mintlify's right-side **On this page** surface completely unchanged.
- Fit the Aspen desktop header into one row, with the GitHub destination shown as a compact icon.
- Corrected Aspen's stale 96px sticky-sidebar offset to the actual 56px header height and removed its early scroll-fade mask.
- Restored the GitHub star count while keeping the repository name hidden, and normalized Aspen's darker surface borders to main's quieter border color.
- Verified that the documentation font did not change: both main and the refactor use the same TT Norms Pro files and the same body and heading typography.
- Explicitly forced Mintlify's live GitHub star span to remain visible and gave the floating agent input a distinct surface, stronger border, and restrained shadow.
- Prevented the GitHub control from blinking during client-side navigation: Mintlify removes the live count for about 49ms while remounting, so the control now keeps a fixed width and shows the last verified count as a transient CSS fallback.

### 2026-07-29 — journey-led documentation proposal

- Leadership feedback requires the documentation strategy to begin with realistic end-to-end user journeys rather than the inherited page inventory.
- Created `USER-JOURNEYS-PROPOSAL.md` as an approval document. It defines seven journeys, recommends five as P0, assigns one canonical starting link to each, and specifies the sequence, success state, visual formats, current gaps, and validation method.
- Public docs should not be restructured again until the journeys are approved.

### 2026-07-29 — journey implementation approved

- The product owner approved the proposed journey model.
- Added `JOURNEY-IMPLEMENTATION-MAP.md` as the implementation contract.
- Began consolidating the P0 entrances around `/introduction`, `/quickstart`, `/workflows`, `/studio`, and `/help`.
- The established Aspen header, sidebar behavior, right-side table of contents, borders, typography, GitHub control, and agent input treatment remain unchanged.

### 2026-07-29 — journey implementation pass

- Rebuilt the five P0 entrances:
  - `/introduction` now provides immediate proof, the product loop, human-control guidance, and focused next steps;
  - `/quickstart` now starts from source material and ends at a played or exported result;
  - `/workflows` is the canonical outcome-led creation chooser with useful requests;
  - `/studio` now follows the real review → direct edit or agent revision → check → export journey;
  - `/help` now starts from visible symptoms and produces a fix or useful diagnostic.
- Removed the duplicate Choose your path, Create with an agent, and old Help pages. Added redirects for every old route.
- Added the missing human-facing slideshow workflow, including the current live-deck output and honest MP4 limitation.
- Standardized the seven existing creation workflow pages with direction approval, review guidance, common problems, and a return to Studio or the workflow chooser.
- Reworked Catalog around the visual job and Developers around the smallest technical surface.
- Removed large machine-facing Claude Design and Open Design authoring specifications from the human navigation while preserving their source URLs.
- Added `VISUAL-PRODUCTION-BRIEFS.md` for the three P0 videos and eight Studio task loops.
- Updated the visual current-state dashboard around the five approved journeys.
- Browser-reviewed Introduction, Quickstart, Workflows, Help, Studio, Catalog, and Developers in the local Mintlify preview.
- `mint validate`, `mint broken-links`, and `git diff --check` pass.

### 2026-07-29 — composition-led front-door rebuild

- The product owner approved the new `/workflows` page composition.
- The page is a visual router, not an explainer:
  - route choices begin in the first viewport;
  - people choose from the source they already have, not internal workflow names;
  - each tile names what to bring and links directly to the working guide;
  - repetitive setup, “after you choose,” and large first-project callouts are removed.
- Every route tile must show a short, real output from that exact workflow. These
  previews may be muted loops because they are compact chooser media; the full
  films on important destination pages retain narration, music, and purposeful
  sound.
- Existing truthful previews cover product launch, faceless explainer, captions
  and recuts, pull requests, motion graphics, music-driven video, and general
  video.
- Produced the missing interactive-presentation preview from a real
  `hyperframes present` deck:
  - real fragment reveals;
  - real slide navigation;
  - real hotspot branch navigation and return;
  - 1280×720 H.264, 60 fps, 8.3 seconds, 419 KB;
  - first and final states match for a clean loop;
  - the deck passes HyperFrames lint and check with zero errors and warnings.
- The shipped `registry/examples/slideshow-demo` does not currently resolve its
  scene-only slide references under `hyperframes present`; the preview therefore
  uses a purpose-built deck with explicit slide bounds. This appears to be a
  real example/runtime gap worth fixing separately.
- The approved composition sketch is
  `/Users/ularkimsanov/.codex/visualizations/2026/07/29/019fab3f-b40d-7682-b7c6-d8b65ff7f710/workflows-page-composition.html`.

### 2026-07-30 — Studio front-door composition

- The product owner approved the new `/studio` page direction.
- Its one job is to take someone who already has a project through human
  control: watch the result, change something visible, and export a version.
- The page no longer begins by teaching the interface or presenting every
  panel. It leads with one real project and routes by the visible task:
  - text or layout;
  - timing or order;
  - animation or media;
  - export.
- The Studio-versus-agent decision is reduced to one rule:
  - if you can point at the exact thing, start in Studio;
  - if the story, several scenes, or source material must change, ask the agent.
- The first implementation uses verified Studio captures. Replace them with
  short real task loops as those production assets are approved.
- The top capture is a temporary truthful first paint. Replace it with the
  complete narrated Studio film before treating the front door as finished.
- The approved composition sketch is
  `/Users/ularkimsanov/.codex/visualizations/2026/07/29/019fab3f-b40d-7682-b7c6-d8b65ff7f710/studio-page-composition.html`.

### 2026-07-30 — Quickstart front-door composition

- The product owner approved the new `/quickstart` page rhythm:
  - show the finished result first;
  - recognize the source material;
  - make one useful request;
  - approve the creative direction;
  - make one visible change in Studio;
  - export the file.
- Rewrote the actual page around those six beats and removed the inherited
  installation-first framing, long prompt checklist, five-question review
  checklist, repeated completion explanation, and oversized workflow card.
- Installation is now a subordinate, first-time-only disclosure. It no longer
  interrupts the main journey.
- The full hero film is one continuous, self-demonstrating project. Unlike small
  chooser previews, it must ship with narration, music, purposeful sound, and
  captions.
- The finished hero film is now embedded with its real closing frame as the
  poster:
  - 43.7 seconds, 1920×1080, H.264 + stereo AAC, 30 fps;
  - full narration, music arc, purposeful SFX, and burned-in captions;
  - one real project throughout, including a real Studio before/after edit;
  - HyperFrames lint has zero errors; the full browser check passes;
  - five scene seams pass with zero failures or warnings;
  - integrated loudness is −16.0 LUFS and true peak is −0.5 dBTP with no clipping.
- The film's one accepted delivery compromise is the −0.5 dBTP peak. It is safe
  but slightly hotter than the preferred approximately −1 dBTP delivery
  headroom. Lowering the whole master would weaken an otherwise verified
  narration/music balance.
- Browser review confirmed the approved hierarchy, unchanged Mintlify chrome,
  and no horizontal overflow. Mintlify validation and broken-link checks pass.
- The approved composition sketch is
  `/Users/ularkimsanov/.codex/visualizations/2026/07/29/019fab3f-b40d-7682-b7c6-d8b65ff7f710/quickstart-page-composition.html`.

### 2026-07-30 — Workflow destination media audit

- Audited the eight destination guides linked from `/workflows`.
- Their existing top media was uniformly a 6–8 second, video-only loop. That is
  appropriate on the chooser, where motion is a compact preview, but insufficient
  as the only proof on a destination guide.
- Replaced five destination loops with the matching complete controllable films
  with sound:
  - captions and recuts → 43.6-second variables film;
  - pull request → 32.1-second PR film;
  - motion graphic → 26.5-second Hypecard film;
  - music-driven video → 90-second music film;
  - custom video → 33.5-second timeline film.
- Added the real 8.3-second interactive-deck proof to the slideshow guide. It
  remains a silent loop because it demonstrates interaction rather than pretending
  to be a complete narrated film.
- Product launch and faceless explainer still have only short silent previews on
  their destination pages. Honest full sound masters are the remaining media gap;
  do not label the existing loops as complete films.
- The content pattern across all eight guides is too mechanical: intro prose →
  approval checklist → review checklist → common-problems table → two standard
  cards. The next editorial pass should compose each page around its distinct
  decision and review moment instead of preserving this repeated template.

### 2026-07-30 — Pull request destination

- Traced the complete PR workflow before editing the page: GitHub data access,
  diff and commit inspection, story archetypes, audience choice, evidence
  requirements, storyboard, authoring, browser validation, and rendering.
- Rebuilt the page around the decision that materially changes the story:
  whether the video is for users, contributors, or a social audience.
- Added a small interactive audience chooser that produces a useful request for
  each audience instead of teaching an abstract prompt formula.
- Removed the inherited common-problems table and generic approval language.
  The remaining checks are specific to PR truth: branch, release state,
  before-and-after behavior, migrations, readable code excerpts, and claims
  supported by the diff.
- Browser testing confirmed that all three audience choices update the request
  and expose the selected state correctly.

### 2026-07-30 — Captions and talking-head destination

- Traced both complete workflows before editing:
  - embedded captions preserve the source clip and use a clean verbatim rail
    with scarce expressive emphasis;
  - talking-head repackaging preserves the source clip and audio while adding
    transcript-led titles, quotes, statistics, side panels, or picture-in-picture;
  - neither workflow removes pauses, reorders speech, or changes the source edit.
- Rebuilt the page around the real three-way decision:
  - add readable captions;
  - add designed overlays;
  - change the footage through General Video.
- Avoided presenting internal caption backend modes as user-facing choices.
  HyperFrames recommends a treatment after inspecting the clip.
- Kept only source-specific gates and review checks: suitable single-subject
  footage, transcript-sensitive names and terms, safe regions around the
  speaker, synchronization, muted playback, and the final graphic clearing.
- Live Mintlify review found that the selected pill label disappeared in dark
  mode. Fixed the active state in both this chooser and the PR audience chooser
  with a consistent high-contrast HyperFrames accent.
- Formatting, linting, Mintlify validation, broken-link checking, interaction
  testing, and visual review all pass.

### 2026-07-30 — Product and website destination

- Traced the complete product-launch workflow before editing: intent interview,
  website capture, brand extraction, story and script, audio, rough-layout
  review, frame build, Studio review, seam checks, and render.
- The decisive user choice is not a list of video formats. It is what the video
  must do with the source:
  - sell it through a persuasive launch story;
  - show it as an honest product tour;
  - prove one point in a short social video.
- Rebuilt the page around an interactive chooser and editable URL. Each purpose
  produces a distinct brief from the same source.
- Reduced the capture explanation to the three human-facing ingredients that
  matter: real screens, product language, and the brand system. The detailed
  extraction inventory remains developer/agent implementation detail.
- Made the real review sequence explicit: story → rough layouts → Studio →
  export. Removed the generic approval list, goal table, “keep it narrow”
  lecture, and common-problems table.
- The existing silent Huly loop is labeled honestly as a preview. A dedicated
  complete product film with narration, BGM, SFX, and captions is now in
  production through Claude Code using `ANTHROPIC_API_KEY`.
- Browser testing confirmed all purpose choices, URL editing, selected states,
  and prompt updates. A second visual check found Mintlify's code style forcing
  horizontal prompt scrolling; all three interactive brief builders now wrap
  their complete requests.

### 2026-07-30 — Faceless explainer destination

- Traced the complete faceless-explainer workflow before editing. It has no
  website capture or asset inventory: source text supplies information; every
  visual is invented later to teach the selected story.
- The workflow's core editorial rule is that paragraph order is not scene
  order. It extracts the teaching spine, omits asides, and builds toward one
  retained idea.
- Rebuilt the page around two connected decisions:
  - the teaching shape: concept, process, three parallel points, or story;
  - the one sentence the viewer should be able to say afterward.
- The interactive chooser produces a different brief for each teaching shape
  and lets the reader edit the intended landing line.
- Removed the duplicated “approve the explanation” and “review the explanation”
  checklists plus the generic common-problems table. The remaining review gate
  tests whether the piece actually creates and resolves understanding.
- Audited the complete 39.5-second SpaceX/Grok production master. It has 1080p60
  H.264 video and stereo AAC audio, but too much of its runtime demonstrates the
  Grok chat flow before the explanation. Rejected it as the destination hero
  rather than closing the media gap with a weaker fit.
- Live browser testing confirmed all four teaching shapes, landing-line edits,
  selected states, prompt wrapping, and zero page-level horizontal overflow.

### 2026-07-30 — Motion Graphics destination

- Traced the complete autonomous motion-graphics flow: classify, decide whether
  real-source search is required, resolve assets, design around those assets,
  reuse catalog building blocks, verify opening/signature/final proof frames,
  then render after approval.
- Verified the real public boundary: usually under ten seconds, up to roughly
  thirty seconds; one dominant visual idea; normally no narration; MP4 or a
  transparent WebM/MOV overlay. Longer, narrated, or multi-scene work belongs
  in General Video.
- The workflow spans six useful human-facing source types: words, one number,
  data, a logo, an overlay, or a real page/post/map. The underlying category
  system also covers articles, tweets, captured UI, and image-to-data fusion.
- Rebuilt the page around an interactive “what are you animating?” chooser with
  six concrete requests. Removed the generic approval checklist and repeated
  common-problems table.
- Kept the workflow's intentional audio exception honest: the complete
  year-in-review graphic uses music and sound but no narration because motion
  carries the message.
- Live browser testing confirmed every selection pattern, readable prompt
  wrapping, selected-state contrast, and zero page-level horizontal overflow.

### 2026-07-30 — Music-to-Video destination

- Traced the complete music-grounded flow: stage the track and optional media,
  run the single canonical audio analysis, map meaningful musical sections,
  decide beat-grid versus phrase-flow pacing, plan treatments, build frames,
  assemble the track once, review proof moments, and render.
- Corrected the public mental model: “beat-synced” does not mean cutting on
  every measured beat. A genuinely rhythmic track may use its beat grid; calm
  or loose music should flow by phrase and energy.
- Rebuilt the page around the three real source modes:
  - supplied photos or video;
  - synchronized lyrics;
  - completely invented typography and graphics.
- Added an editable energy-direction field so the request names where the
  visual arc changes and how it should end.
- Removed the repeated approval checklist and common-problems table. The
  remaining review checks focus on the chosen track section, required media,
  lyric truth, meaningful musical changes, readability, and the landing/loop.
- Live browser testing confirmed every mode, energy-direction edits, selected
  states, readable prompt wrapping, and zero page-level horizontal overflow.

### 2026-07-30 — Interactive presentation destination

- Traced the complete slideshow contract, player/controller behavior, fragments,
  branches, hotspots, presenter/audience split, media cleanup, screen-sharing
  constraints, handoff, and validation.
- Preserved the essential output truth near the top: a HyperFrames slideshow is
  a live navigable deck. Normal video rendering can resolve only the first
  slide, so a complete linear MP4 is not currently a supported slideshow output.
- Rebuilt the page around the type of control the presenter needs:
  - a direct main story;
  - progressive reveals;
  - optional detail branches;
  - conversion of an existing interactive page.
- Kept the real 8.3-second deck recording because it demonstrates actual
  fragment navigation, slide navigation, hotspot branching, and return to the
  main line.
- Removed the oversized warning, “use it when” list, long approval checklist,
  duplicated supported-output section, and troubleshooting section. Kept the
  minimum presenter handoff and Meet/Zoom sharing guidance because those
  behaviors affect whether the audience view works.
- Live browser testing confirmed all four deck paths, selected states, prompt
  wrapping, visible output limitation, and zero page-level horizontal overflow.

### 2026-07-30 — General Video destination

- Traced the complete custom-video flow, including source adapters, state
  resumption, automation versus storyboard review, companion mode, design and
  media dependencies, scene build strategy, assembly, validation, Studio
  approval, and render.
- Tightened the route boundary: custom work means mixed source types, editable
  underlying footage, longer or unusual multi-scene structure, deliberately
  redesigned formats, or close creative collaboration. A focused input should
  stay in its focused workflow.
- Made the page's unique decision the collaboration shape:
  - build autonomously;
  - review the story and layouts;
  - co-direct through companion mode.
- Explained companion mode as a complete ceiling treatment proposed up front:
  story, visual system, scene motion, transitions, audio identity, opening, and
  ending. The person trims or redirects it instead of assembling quality through
  many small approvals.
- Removed the generic approval checklist, generic five-step review loop, and
  common-problems table. Kept only route-specific source, audio, format, opening,
  ending, and validation checks.
- Live browser testing confirmed all collaboration modes, selected states,
  prompt wrapping, route-boundary visibility, and zero page-level horizontal
  overflow.

### 2026-07-30 — Cross-workflow editorial pass

- Compared all eight destination pages after their individual rewrites:
  headings, word counts, route statements, repeated phrases, common filler, and
  ending actions.
- Pages now remain compact at roughly 225–338 words of body content before
  component-rendered prompt text.
- Removed the last inherited template residue: the identical “Choose another
  workflow” card that ended every page. The sidebar and adjacent navigation
  already provide that route; each guide now ends on its own useful action in
  Studio, Storyboard, Timeline, Catalog, or Slideshow controls.
- No destination page retains the old “Common problems,” “Approve the…,” or
  generic workflow-ending copy.
- Reformatted and linted only the new/changed interactive snippets after
  restoring two unrelated tracked snippets that a broad formatter glob touched.
- Full Mintlify validation, broken-link checking, snippet linting, and diff
  whitespace checks pass after the cross-page cleanup.

## Maintenance issue

- The repo instructions refer to `.agents/skills/hyperframes/SKILL.md`, but that repo-local path is absent in this checkout. The installed current router at `/Users/ularkimsanov/.agents/skills/hyperframes/SKILL.md` was used as the workflow source of truth for this pass.

### 2026-07-30 — Four maturity journeys replace the earlier front doors

- The product owner clarified that the docs need four levels of intent:
  understand HyperFrames, create a first video, go further as an experienced
  user, and build on top of HyperFrames as a developer.
- Canonical routes are now `/introduction`, `/quickstart`, `/go-further`, and
  `/developers`.
- `/workflows` remains the beginner's source-material router. `/studio` becomes
  a major destination inside “Go further.” Neither is a separate maturity
  journey.
- Added a visual `/go-further` hub that changes its proof media and destination
  around four kinds of control: direct editing, stronger agent direction,
  richer media/motion, and project internals.

### 2026-07-30 — Journey-film rebuild begins

- Replaced the Introduction's repeated four-step explanation and workflow-card
  wall with one definition, the existing proof wall, three product truths, and
  one dominant first-video action.
- Rebuilt Quickstart around the README's human-facing installation command:
  `npx skills add heygen-com/hyperframes --full-depth`, followed by selection of
  the Core Skills group.
- Reduced the first request to:
  `Using /hyperframes, make a 10-second product intro for https://example.com.`
- Removed Quickstart's source tabs, long pricing prompt, scattered links,
  unrelated Studio image, required-Studio framing, and required-Renders-panel
  export.
- Made agent revision/render, Studio, and CLI preview/render equal continuations
  from the same first playable project.
- Replaced Go further's hidden tab chooser with four always-visible, linked
  preview tiles.
- Reduced the Developer hub to five smallest useful surfaces. Each card now
  states its first useful result; packages, deployment, and contributing remain
  deeper reference.
- Wrote the shared four-film series bible and exact producer briefs.
- Launched Introduction and Quickstart as Wave 1 using isolated Claude Code
  sessions authenticated only through `ANTHROPIC_API_KEY`.
- Mintlify build validation, broken-link checks, snippet formatting/linting,
  desktop review, and 390px mobile review pass for the current page compositions.
- The separate Studio producer delivered a verified 68-second narrated film and
  four real-UI preview loops for design, timing, motion, and export. Its report
  confirms 1080p H.264, AAC on the full film, muted video-only loops, passing
  browser checks, no blank frames, and readable framing at the actual docs width.
- The Studio capture proved there is no user-editable version-name field in the
  current export panel. Removed the inaccurate “useful name” instruction; Studio
  dates rendered files and keeps them in the queue.
- AWS SSO was refreshed. The Studio film, all four Studio loops, and the Huly
  product-launch film are published under versioned immutable CDN filenames and
  integrated into their pages.
- Wave 2 production for Go further and Developers began once the Wave 1 scripts
  and storyboards were locked.
- Wave 1 acceptance watch items:
  - Introduction must use the exact ElevenLabs River voice
    (`SAz9YHcvj6GT2YYXdXww`), not a substitute labelled as River.
  - Quickstart's three continuation paths must remain visually equal. Its final
    transition must enter the shared project/result, not make the center Studio
    panel look like the required path.

### 2026-07-30 — Four journey films completed

- Published and integrated complete narrated films for `/introduction`,
  `/quickstart`, `/go-further`, and `/developers`.
- Every film uses the exact ElevenLabs River voice
  (`SAz9YHcvj6GT2YYXdXww`), burned phrase captions, music, purposeful SFX, real
  product behavior, controls, and no autoplay or loop.
- The Go-further film uses one real Studio project from opening through final
  result. It proves a story-level agent revision, a direct `168px → 148px`
  Studio edit, Catalog and variable use, and real CLI checks and rendering.
- The exact variable render command shown in that film was executed and
  inspected. A current mounted-block limitation is documented in its production
  report: host variables work, while standalone block lint reports two
  `unknown_variable_binding` warnings.
- Final Go-further delivery: H.264 High 1920×1080 at 30 fps, AAC-LC 48 kHz
  stereo, exactly 58 seconds, −16.8 LUFS, −1.3 dBFS peak, and zero blank frames.
- All journey media uses versioned immutable CDN filenames. The media manifest
  records every published source and destination.

### 2026-07-31 — Full Guides, Studio, and Developers audit reopened

- The owner explicitly rejected treating the four journey pages as the end of
  the refactor. Guides, Studio, and Developers must work as complete reading
  systems, not collections of routers and reference fragments.
- Current in-scope inventory:
  - Guides: 49 routes
  - Studio: 17 routes
  - Developers: 49 routes
  - Total: 115 routes
- Studio is the clearest visual gap. Fourteen of its seventeen pages are mostly
  text-only even when the subject is inherently visual: Canvas, Layers,
  Timeline, Design, Animation, Assets, Variables, and related editing tasks.
- The existing Studio front-door film is a separate older production:
  `bm_george` from local Kokoro, Inter captions, a 68-second Airbnb project, and
  a captured lint panel with 16 errors and 20 warnings. It does not share the
  four journey films' River narrator or their current caption/visual system.
- The Studio film must be re-authored around the current page job and current
  product. Real captures may be reused only when the UI and behavior still
  match. Do not reuse its old voice or error-heavy lint sequence.
- The changelog-video kit was only partially adopted. Some journey revisions
  use TT Norms Pro, but Studio still uses Inter. The useful shared assets are:
  ABC Solar Display for rare editorial display moments, TT Norms Pro for
  narration captions/body, TT Norms Mono for machine truth, the darkened house
  pattern as connective tissue, and the restrained house sound family. Do not
  inherit weekly labels, dates, scene counters, progress dots, or filenames.
- The prior series bible instruction to move phrase captions around the frame
  conflicts with direct owner feedback. New and revised docs films use a
  consistent lower caption rail unless a real product control occupies that
  space; captions do not jump to arbitrary positions.
- Guides currently mix human and engineering material. Frame adapters,
  deterministic-render internals, 4K/HDR implementation details, performance
  engineering, and much of the background-removal implementation do not belong
  in the primary general-user reading path.
- Concrete content defects found:
  - `concepts/compositions.mdx` denies automatic `data-var-*` binding while
    `concepts/variables.mdx` documents the supported declarative bindings.
  - Help and Studio troubleshooting say to save manually while the Studio Source
    page says source edits autosave. The wording must distinguish Studio edits
    from files edited in another application.
  - `guides/performance.mdx` ends with duplicate Troubleshooting cards.
  - Product Updates, Weekly Updates, and the roughly 24,000-word raw Changelog
    overlap and compete for the same job.
- Developers is technically stronger than Guides and Studio, but its front doors
  still create avoidable hops:
  - the CLI reference is roughly 7,900 words;
  - the SDK overview is a fourteen-card directory before the quickstart;
  - skill installation is repeated across setup pages;
  - there is no neutral deployment chooser comparing local CLI, Producer,
    Engine, managed cloud, AWS Lambda, Google Cloud Run, and hosted templates.
- Desktop browser testing on the current local preview confirms the Developers
  header tab currently resolves to `/developers/overview`, including from the
  `/developers` journey page. Keep the journey in Guides and the technical
  overview in the Developers tab, but continue testing the tab after navigation
  edits because the two neighboring routes are easy to confuse.
- Do not change the approved Mintlify chrome or its Inter site font as part of
  film branding. Changelog typography reuse applies to authored docs media, not
  to the Mintlify shell.

### 2026-07-31 — Source verification continues

- The current Studio store initializes auto-keyframing as enabled. The Canvas
  and Animation pages now tell readers to check the highlighted toolbar state
  and turn it off before a constant layout edit instead of assuming it starts
  disabled.
- Save behavior is surface-specific. Preview's Code editor and direct visual
  controls autosave. Storyboard narration, source, and feedback drafts expose
  their own explicit Save actions. Help and Studio troubleshooting now state
  that distinction.
- Studio's Lint endpoint scans every HTML file independently, while the
  project-level CLI linter recognizes mounted sub-compositions. The Studio
  troubleshooting path now makes `npx hyperframes lint` and
  `npx hyperframes check` the final verdict for nested projects.
- The Player documentation was stale: the unsupported “3KB gzipped” claim was
  removed, `timeupdate` was corrected from roughly 30 fps to the package
  README's roughly 10 fps, and current audio, volume, source-document, and
  shader-preview attributes were documented from source.
- The four existing Studio stills are not one coherent set. The Storyboard
  still is neutral and current; Overview, Design, and Export use the older
  Airbnb production. Replace those three from the clean project created for
  the Studio front-door rebuild, then reuse the same capture set across the
  highest-value Studio task pages.
- Studio film v2 is in production after owner approval. Its job is narrow:
  show how a person understands and makes precise edits to the exact project
  an agent created while Studio, agent, and terminal remain equal
  continuations. It uses River, the shared media fonts, one stable caption
  rail, real current UI, and no weekly-show chrome.
- The first pass inspected an older CLI surface and incorrectly treated
  `hyperframes media-treatment` and several Studio effect groups as absent.
  Current `origin/main` source and generated CLI help supersede that finding;
  the corrected contract is recorded in the rendering and deployment audit
  below.
- The current `hyperframes skills` command no longer takes the old
  `--claude`/`--cursor`/`--gemini` flags. The reference now documents the real
  bare install plus `skills check` and `skills update [workflow]`.
- The render reference now follows the current CLI help and worker resolver:
  root `data-fps` precedes the 30 fps fallback; automatic worker sizing considers
  CPU, memory, frame count, composition cost, and concurrency limits; local
  browser GPU mode probes before falling back to software; and every shipped
  render flag is represented.
- `hyperframes skills update` installs into the global Claude/shared agent
  stores and mirrors bundles to compatible installed agents; it does not write
  a project-local `.agents/skills` tree. Corrected the host-specific setup pages
  and the skills overview to state the real scope.
- The hosted MCP endpoint was checked directly. The canonical trailing-slash
  route is live and returns the expected authorization challenge; host
  availability and setup wording were checked against the current official
  Claude, ChatGPT, Grok, Copilot CLI, and Antigravity documentation.
- Authentication now distinguishes account-free local work from managed cloud,
  hosted MCP, and authenticated publishing. Local Kokoro and MusicGen fallbacks
  can require a first-use model download before they operate offline.

### 2026-07-31 — Rendering, deployment, and maintainer audit

- The earlier note that `hyperframes media-treatment` did not exist is
  superseded. The command is present in current source and CLI help. Its real
  surface is capability discovery, bounded local-media analysis, validated
  `data-color-grading` mutation, dry-run, and clear. The Media Effects, Color
  Grading, and CLI pages now document that actual contract.
- Verified the managed cloud, AWS Lambda, and Google Cloud Run commands against
  current source and generated CLI help. Removed nonexistent Lambda
  `--bitrate` / `--crf` flags from migration instructions and replaced the
  old manual-first Cloud Run page with the shipped `cloudrun` CLI flow.
- Verified the current Vercel, Cloudflare, and Modal template repositories.
  Replaced stale template names and Cloudflare architecture, then removed
  volatile timing, price, and cold-start promises.
- Reduced the 4K, HDR, and performance pages from 507 to 186 lines. The pages
  now lead with the actual task, constraints, and verification instead of
  internal pipeline detail and one-machine benchmarks.
- Rewrote the main contributing and Catalog-contribution pages against current
  workspace scripts, registry schema, and generated Catalog workflow. Removed
  the stale “52 blocks” count rather than replacing it with another volatile
  number.
- Synced the public adopters page with `ADOPTERS.md`, including Typeframe.
- Deleted the retired Weekly Updates page and redirected its old route to the
  concise Product Updates page.
- Replaced fictional local-testing fixture archives with a reproducible
  maintainer workflow against any real external project. The named archives in
  the old page are not present in the repository.
- Reduced the managed-cloud guide from 232 to 117 lines while preserving the
  verified sign-in, render, archive, format, variable, webhook, retry, and
  render-management behavior.
- The Mintlify shell stays on Inter. TT Norms Pro, TT Norms Mono, ABC Solar,
  and the changelog sound/visual kit are for authored docs films, not a shell
  typography change. Removing the cross-origin TT Norms declarations also
  removes four repeatable browser console errors while preserving the approved
  effective site font.
