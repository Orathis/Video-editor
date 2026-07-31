# HyperFrames docs content audit — 2026-07-31

## Scope

This audit covers every route currently exposed under the Guides, Studio, and
Developers header tabs: 115 routes total.

The action labels are deliberately simple:

- **Keep** — the page has a distinct job and is broadly sound.
- **Rewrite** — the route is useful, but the current page does not perform its
  job well enough.
- **Split** — preserve a human task guide and move implementation detail into
  technical reference.
- **Merge** — another page already performs most of the same job.
- **Move** — the page is useful but is in the wrong audience path.
- **Reference** — dense content is acceptable because readers arrive looking
  for an exact API, command, or implementation fact.
- **Remove from nav** — keep a redirect/archive if needed, but stop presenting
  the page as a normal reading destination.

## Guides — 49 routes

### Start here

| Route           | Action             | Reason                                                                                                 |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| `/introduction` | Keep               | Strong product definition, complete film, proof wall, and one primary next step.                       |
| `/quickstart`   | Keep               | Correct human install command, short request, and equal agent/Studio/CLI continuations.                |
| `/go-further`   | Rewritten          | The page now teaches the agent/Studio/source/render control model before the four deeper destinations. |
| `/developers`   | Kept and tightened | Correct lowest-priority journey, with one explicit continuation to the technical overview.             |

### Create with an agent

| Route                  | Action           | Reason                                                                                                                           |
| ---------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/guides/prompting`    | Keep + visualize | Useful human advice. Add before/after request examples and remove any repeated “be clear” guidance.                              |
| `/guides/mcp`          | Rewrite + verify | The task is useful, but connection steps and host support are time-sensitive. Show one real connection and first result.         |
| `/guides/pipeline`     | Keep + focus     | Useful explanation of what the agent does after the request. Tie every stage to one real project instead of an abstract process. |
| `/guides/design-tools` | Merge            | Combine with the human part of Figma into one “Bring designs into a project” guide.                                              |
| `/guides/figma`        | Split            | Keep the human import workflow in Guides; move tokens, API/setup detail, and troubleshooting into Developers/Integrations.       |

### Workflows

All eight routes have a distinct input shape, a short explanation, real proof
media, and one relevant action. Keep the routes and their direct sidebar
visibility. Improve individual media only when the current preview does not
truthfully represent that workflow.

| Route                          | Action                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `/guides/product-launch-video` | Keep                                                                                |
| `/guides/faceless-explainer`   | Keep; replace the short muted proof with a complete narrated example when available |
| `/guides/pr-to-video`          | Keep                                                                                |
| `/guides/captions-and-recuts`  | Keep                                                                                |
| `/guides/motion-graphics`      | Keep                                                                                |
| `/guides/music-to-video`       | Keep                                                                                |
| `/guides/slideshow`            | Keep                                                                                |
| `/guides/general-video`        | Keep                                                                                |

### Learn

| Route                             | Action       | Reason                                                                                                        |
| --------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| `/concepts`                       | Merge        | Combine its human mental model with Project Tour into one complete “How a HyperFrames project works” page.    |
| `/guides/project-tour`            | Merge        | Overlaps Concepts and Pipeline. Preserve its file map in the merged page.                                     |
| `/concepts/compositions`          | Rewrite      | Keep a human explanation of scenes and nesting. Remove or correct the false declarative-variable statement.   |
| `/concepts/variables`             | Keep + layer | Valuable advanced-user topic. Put the common human use case first and move low-level schema edge cases later. |
| `/concepts/data-attributes`       | Move         | This is composition-schema reference for developers and agents.                                               |
| `/concepts/frame-adapters`        | Move         | Runtime adapter internals do not belong in the general-user Learn path.                                       |
| `/concepts/determinism`           | Move         | Keep the benefit in the human concepts page; move the contract and Docker detail to Developers.               |
| `/guides/html-in-canvas`          | Move         | Implementation architecture for custom render surfaces.                                                       |
| `/guides/hyperframes-vs-remotion` | Move         | A technical evaluation/migration page, not a normal user lesson.                                              |

### Media

| Route                            | Action             | Reason                                                                                                                                                              |
| -------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/guides/media`                  | Rewrite            | Currently a card hub. It should teach the shared human workflow for finding, importing, replacing, checking, and licensing media.                                   |
| `/guides/video-components`       | Keep + clarify     | Useful bridge from Catalog items to a project. Rename around the task rather than “components.”                                                                     |
| `/guides/voice-and-audio`        | Keep + demonstrate | Concise and useful; add a real narration/music mix example.                                                                                                         |
| `/guides/transcribe-and-caption` | Keep + demonstrate | Good task guide; add a visible before/after caption example.                                                                                                        |
| `/guides/remove-background`      | Split              | The current multi-thousand-word page is an engineering memo. Keep a short task guide and move alpha formats, VFX layering, and implementation detail to Developers. |
| `/guides/color-grading`          | Split              | Keep choosing/applying/reviewing a look in Guides; move LUT implementation, CORS, and pixel-pipeline detail to Developers.                                          |
| `/guides/media-effects`          | Split              | Keep a visual chooser and agent-facing task language; move effect APIs and wiring detail to reference.                                                              |
| `/guides/media-overlays`         | Remove             | The page described registry blocks and a Studio Overlays insertion surface that do not exist in the current product. Redirect the route to the real Catalog.        |

### Export and share

| Route                       | Action     | Reason                                                                        |
| --------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `/guides/export-and-share`  | Keep       | Complete human finishing path across Studio, agent, and CLI.                  |
| `/guides/quality-checklist` | Keep       | Short and useful final review.                                                |
| `/guides/publish-and-share` | Keep       | Distinct job: a review link and source-sharing expectations.                  |
| `/guides/rendering`         | Keep       | The normal local render task belongs in Guides.                               |
| `/guides/4k-rendering`      | Move       | Advanced render engineering and supersampling detail.                         |
| `/guides/hdr`               | Move       | Hardware, codec, color-space, and source constraints are technical reference. |
| `/guides/performance`       | Move + fix | Developer optimization content. Remove the duplicated Troubleshooting cards.  |

### Examples, help, and updates

| Route                      | Action          | Reason                                                                                                                    |
| -------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/examples`                | Keep            | Strong visual proof and useful source/template entry.                                                                     |
| `/help`                    | Keep + focus    | Make this the symptom-first support front door.                                                                           |
| `/guides/common-questions` | Merge           | Fold durable product questions into Help; avoid a second support index.                                                   |
| `/guides/troubleshooting`  | Keep + focus    | Reserve for project/runtime failures; remove Studio-specific and general FAQ repetition.                                  |
| `/guides/feedback`         | Keep            | Distinct action and useful evidence checklist.                                                                            |
| `/product-updates`         | Keep            | Human-readable changes and upgrade relevance.                                                                             |
| `/weekly-updates`          | Remove from nav | Overlaps Product Updates and is shaped around an internal publishing cadence. Preserve an archive if needed.              |
| `/changelog`               | Remove from nav | Roughly 24,000 words of raw release history is not a usable docs page. Prefer versioned release notes or GitHub Releases. |

## Studio — 17 routes

The Studio information architecture is broadly correct. The problem is proof:
fourteen pages are primarily text-only descriptions of visual interactions.

| Route                       | Action                 | Required proof                                                                                                                                    |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/studio`                   | Rewrite film + tighten | Current product, River voice, shared media typography/caption system, clean real project, direct edit → timing → agent boundary → check → render. |
| `/studio/tour`              | Keep + annotate        | One current full-workspace image with numbered or hotspot callouts; avoid repeating the overview narrative.                                       |
| `/studio/storyboard`        | Keep                   | Current annotated Storyboard image and one review handoff.                                                                                        |
| `/studio/canvas`            | Keep + visualize       | Select, move/resize, crop/rotate, multi-select, and auto-keyframe behavior.                                                                       |
| `/studio/layers`            | Keep + visualize       | Overlap selection, stacking, grouping, and nested composition behavior.                                                                           |
| `/studio/timeline`          | Keep + visualize       | Move, trim, split, zoom, and beat navigation shown on real clips.                                                                                 |
| `/studio/design`            | Keep + visualize       | One selected element and the exact property/result relationship.                                                                                  |
| `/studio/animation`         | Keep + visualize       | Keyframe diamonds, easing, auto-keyframe, and gesture recording.                                                                                  |
| `/studio/assets-and-blocks` | Keep + visualize       | Import, reuse, and add one Catalog item.                                                                                                          |
| `/studio/captions`          | Keep + visualize       | Correct words, timing, style, and whole-video review.                                                                                             |
| `/studio/variables`         | Keep + visualize       | Bind one visible value and test fallback/override.                                                                                                |
| `/studio/slideshows`        | Keep + visualize       | Slides, fragments, branch, hotspot, and presenter result.                                                                                         |
| `/studio/source`            | Keep + clarify         | Show the real source surface and state clearly that Studio source edits autosave.                                                                 |
| `/studio/lint-and-agent`    | Keep + recapture       | Use a small truthful finding, not an old project with 16 errors and 20 warnings.                                                                  |
| `/studio/export`            | Keep + recapture       | Current format, resolution, quality, queue, and download behavior.                                                                                |
| `/studio/shortcuts`         | Keep + verify          | Verify every shortcut against current source and group by context.                                                                                |
| `/studio/troubleshooting`   | Keep + de-duplicate    | Studio-only failures; distinguish Studio autosave from files edited elsewhere.                                                                    |

## Developers — 49 routes

### Overview and command line

| Route                  | Action         | Reason                                                                                                                     |
| ---------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/developers/overview` | Keep + improve | Correct mental model and smallest-surface chooser. Change the cramped four-column text strip to two columns at docs width. |
| `/developers/cli`      | Keep           | Useful command chooser; it earns one hop because it answers “which command?” directly.                                     |
| `/packages/cli`        | Reference      | Long but legitimate exhaustive reference. Consider one page per command only if maintenance can be generated from the CLI. |
| `/packages/lint`       | Reference      | Distinct package/API reference.                                                                                            |

### Agent setup

| Route                    | Action         | Reason                                                                                                                                                                                                           |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/guides/authentication` | Keep + correct | Narrow “everything works without a key” to local creation/media; managed cloud and hosted MCP require authentication. First-time publishing is anonymous; ownership, updates, and shared spaces require sign-in. |
| `/guides/skills`         | Rewrite        | Keep one installation truth, lifecycle behavior, and a compact catalog. Remove repetition carried by host-specific pages.                                                                                        |
| `/guides/antigravity`    | Move + verify  | Place under Developer Integrations and verify current official host behavior.                                                                                                                                    |
| `/guides/copilot-cli`    | Move + verify  | Place under Developer Integrations and verify current official CLI/skills behavior.                                                                                                                              |

### SDK

| Route                                | Action    | Reason                                                                                                                                                        |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sdk/overview`                      | Rewrite   | Keep the mental model, show one working edit, then one dominant Quickstart action. Remove the fourteen-card directory; the sidebar already carries the index. |
| `/sdk/quickstart`                    | Keep      | Compact end-to-end first result.                                                                                                                              |
| `/sdk/guides/querying-and-editing`   | Keep      |
| `/sdk/guides/timing-and-animation`   | Keep      |
| `/sdk/guides/undo-redo-and-patches`  | Keep      |
| `/sdk/guides/persistence`            | Keep      |
| `/sdk/guides/embedded-override-mode` | Keep      |
| `/sdk/guides/canvas-integration`     | Keep      |
| `/sdk/guides/editing-affordances`    | Keep      |
| `/sdk/reference/open-composition`    | Reference |
| `/sdk/reference/composition`         | Reference |
| `/sdk/reference/edit-operations`     | Reference |
| `/sdk/reference/types`               | Reference |
| `/sdk/reference/adapters`            | Reference |
| `/sdk/reference/utilities`           | Reference |

### Packages

All nine pages are legitimate package reference. Keep them out of the primary
developer learning sequence, preserve “when to use” and “when not to use,” and
verify exports against each package before substantive edits.

| Route                          | Verification note                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/packages/core`               | Verified against current exports, compiler, generators, runtime variables, and GSAP adapter.                                |
| `/packages/parsers`            | Verified against current package subpaths and parser/writer exports.                                                        |
| `/packages/studio-server`      | Verified against current adapter interface, routes, exports, and package subpaths.                                          |
| `/packages/sdk`                | Verified against current session API, operation types, adapters, and package subpaths.                                      |
| `/packages/engine`             | Verified against current capture API, config, encoders, and error conventions.                                              |
| `/packages/player`             | Corrected stale bundle-size, attribute, controls, and event-frequency claims against the current package source and README. |
| `/packages/producer`           | Verified against current render config, formats, cancellation, server, and distributed exports.                             |
| `/packages/shader-transitions` | Verified against current exports, shader registry, capture fallbacks, and compositor behavior.                              |
| `/packages/studio`             | Verified against current exports, peer dependencies, and Studio application structure.                                      |

### Composition and animation

| Route                    | Action         | Reason                                                                                                                   |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/reference/html-schema` | Reference      | Canonical composition contract.                                                                                          |
| `/guides/gsap-animation` | Keep + move    | Developer/agent animation guide; no longer belongs in general Guides.                                                    |
| `/guides/keyframes`      | Move to Studio | The page is primarily about visual keyframe editing in Studio, not a developer schema.                                   |
| moved from Guides        | Add here       | Data attributes, frame adapters, determinism, HTML-in-canvas, advanced render/media internals, and migration comparison. |

### Deployment

| Route                                     | Action                 | Reason                                                                                          |
| ----------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| new `/deploy/overview`                    | Add                    | Neutral chooser for local CLI, Producer, Engine, managed cloud, AWS, GCP, and hosted templates. |
| `/deploy/cloud`                           | Rewritten and verified | Managed HeyGen cloud guide, not the universal deployment front door.                            |
| `/guides/deploy`                          | Rename/focus           | Hosted preview+render templates only.                                                           |
| `/deploy/aws-lambda`                      | Keep                   |
| `/deploy/gcp-cloud-run`                   | Keep                   |
| `/deploy/templates-on-lambda`             | Keep                   |
| `/deploy/migrating-to-hyperframes-lambda` | Keep as deep reference | Specialized migration path; do not surface as a front door.                                     |
| `/packages/aws-lambda`                    | Reference              |
| `/packages/gcp-cloud-run`                 | Reference              |

### Contributing

All six pages have distinct maintainer/community jobs and can remain deep in
Developers. Verify release commands and current catalog counts before editing.

| Routes                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/contributing`                                                                                                                                                |
| `/contributing/catalog`                                                                                                                                        |
| `/contributing/release-channels`                                                                                                                               |
| `/contributing/changelog-process`                                                                                                                              |
| `/contributing/testing-local-changes` — removed references to fixture archives that do not exist and replaced them with a reproducible external-project check. |
| `/community/adopters`                                                                                                                                          |

## Proposed navigation shape

Keep the four header tabs and the approved Mintlify chrome.

### Guides

1. Start here
2. Create with an agent
3. Workflows
4. How projects work
5. Media
6. Export and share
7. Examples
8. Help
9. Product updates

### Studio

Keep Overview, Review, Edit, Build, and Finish. Improve the pages rather than
inventing a new taxonomy.

### Developers

1. Overview
2. Command line
3. SDK
4. Composition and animation
5. Rendering and deployment
6. Packages
7. Integrations
8. Contributing

## Immediate order

1. Correct contradictions and dead/duplicate content.
2. Rebuild the Guides and Developers navigation without changing Mintlify chrome.
3. Turn the main hubs into complete pages rather than directories.
4. Add real visual proof to the six highest-use Studio pages.
5. Replace the Studio front-door film using the revised series bible.
6. Validate every moved route, redirect, command, visual, and breakpoint.
