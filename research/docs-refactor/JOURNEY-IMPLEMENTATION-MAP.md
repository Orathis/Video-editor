# Journey implementation map

Status: **Implemented**

This map prevents individual page edits from drifting away from the approved end-to-end journeys.

## Canonical journeys

| Journey                           | Canonical route | Entry promise                                                         | Primary supporting pages                                           | Success state                                                                              |
| --------------------------------- | --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Understand HyperFrames            | `/introduction` | Understand the product in under a minute and see convincing proof     | Examples, Quickstart                                               | Person can explain the request → agent → editable project → result loop                    |
| Create a first video              | `/quickstart`   | Make a valid first request without writing a production specification | Workflows, Studio, CLI                                             | Person has a playable project and knows the agent, Studio, and CLI are equal continuations |
| Go further as an experienced user | `/go-further`   | Choose the kind of control needed without searching the whole site    | Studio, Prompting, Media, Concepts, Catalog, Quality, Export, Help | Person completes an edit, improvement, deeper build, or reliable final delivery            |
| Build on HyperFrames              | `/developers`   | Choose the smallest technical surface for an integration              | CLI, SDK, Player, Packages, Schema, Deployment, Contributing       | One technical surface works in the person's own system                                     |

## Consolidation decisions

- `/workflows` is the source-material router inside the beginner journey, not a
  separate maturity journey.
- `/studio` is the main direct-editing destination inside “Go further,” not a
  separate maturity journey.
- `/help` is a recovery destination available from every journey, not a front
  door.
- `/guides/create-with-agent` is replaced by `/workflows`.
- `/guides/choose-your-path` is replaced by `/workflows`.
- `/guides/help` is replaced by `/help`.
- Old routes redirect so existing support messages and external links do not break.
- `/guides` remains a concise task router. It is not the canonical product explanation.
- `/introduction` remains the one link to send when somebody asks what HyperFrames is.

## Cross-link contract

Every canonical entry route must:

1. open with the journey film, without a repeated title card or preamble;
2. keep the written expansion shorter than the film and useful on its own;
3. show one visually dominant next action;
4. rank secondary discovery links at the end;
5. avoid incidental links between steps;
6. avoid requiring repository or framework architecture knowledge.

Supporting pages should return people to the journey they came from instead of ending in unrelated reference material.

## Visual contract

Available now:

- lean Introduction composition with one film, one definition, proof wall, three
  truths, and one dominant action;
- corrected Quickstart composition with the human installation command, one
  short request, and agent/Studio/CLI as equal continuations;
- visual source-material chooser for creation workflows;
- four always-visible visual control paths on Go further;
- real Studio workspace imagery;
- copyable requests based on realistic source material.

Film status:

- Introduction journey film: published and integrated;
- re-authored Quickstart journey film: published and integrated;
- Go-further journey film: published and integrated;
- Developer journey film: published and integrated;
- Studio journey film and compact Studio task loops: published and integrated.

## Removal rule

A page should be merged, hidden, or removed when it:

- duplicates a canonical entry route;
- supports no approved journey, real support question, or required reference;
- introduces internal terminology before the task requires it;
- ends without helping the person return to a task.
