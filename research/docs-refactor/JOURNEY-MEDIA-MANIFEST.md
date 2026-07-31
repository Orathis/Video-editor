# Journey media manifest

Status: complete

All public media filenames are immutable and versioned. Never overwrite an
existing CDN object.

| Journey                 | Production source                           | Public filename                                                                         | Page                           | Status                   |
| ----------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ |
| Understand HyperFrames  | `journey-films-v1/introduction`             | `showcase/journey-introduction-v1.mp4` and `.jpg`                                       | `/introduction`                | Published and integrated |
| Make a first video      | `journey-films-v1/quickstart`               | `showcase/journey-quickstart-v4.mp4` and `.jpg`                                         | `/quickstart`                  | Published and integrated |
| Go further              | `journey-films-v1/go-further`               | `showcase/journey-go-further-v1.mp4` and `showcase/journey-go-further-v1-poster-v2.jpg` | `/go-further`                  | Published and integrated |
| Build on HyperFrames    | `journey-films-v1/developers`               | `showcase/journey-developers-v1.mp4` and `.jpg`                                         | `/developers`                  | Published and integrated |
| Product launch workflow | `product-launch-film-v1/videos/huly-launch` | `showcase/product-launch-huly-v1.mp4` and `.jpg`                                        | `/guides/product-launch-video` | Published and integrated |
| Studio overview         | `studio-films-v1/deliverables`              | `showcase/studio-front-door-v1.mp4` and `.jpg`                                          | `/studio`                      | Published and integrated |
| Studio task loops       | `studio-films-v1/deliverables`              | `showcase/studio-{design,timing,motion,export}-loop-v1.mp4` and `.jpg`                  | `/studio` and `/go-further`    | Published and integrated |

Quickstart uses one real frame from the final film so the page's agent, Studio,
and CLI continuations visibly belong to the same project:

- `showcase/journey-quickstart-v4-paths.jpg` — published and integrated

CDN base:

`https://static.heygen.ai/hyperframes-oss/docs/images/`

Upload destination:

`s3://heygen-public/hyperframes-oss/docs/images/`

Before upload, each row requires:

- source and final MP4 review;
- poster and contact-sheet review;
- HyperFrames lint and browser check;
- H.264 1080p video and AAC stereo audio;
- narration, music, SFX, and captions verified;
- loudness and peak checks;
- blank-frame, missing-media, legibility, and claim review.
