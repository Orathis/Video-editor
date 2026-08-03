# Asset inventory — https://example.com

**No assets were captured, and none are missing.** The page has no images, no SVGs,
no icons and no webfonts. `hyperframes capture` reported this honestly as the warning
`Asset catalog is empty — no images will be downloaded`, and `tokens.json` records
`"svgs": []`, `"ctas": []`, `"sections": []`.

The page's entire payload is 559 bytes of HTML plus one inline stylesheet
(`capture/extracted/page.html`):

- `<h1>` Example Domain
- `<p>` This domain is for use in documentation examples without needing permission. Avoid use in operations.
- `<a href="https://iana.org/domains/example">` Learn more

So the only usable visual asset is **the page itself**, which is why this video's hero
asset is `screenshots/full-page.png` — a 1x, 1920×1080 viewport capture — rather than an
extracted logo or product shot. It is staged to `assets/example-com.png` and shown at
exactly 1:1 (see `frame.md` → "The plate rule").

Optional AI image captioning did not run: the ambient `GEMINI_API_KEY` is rejected by
the API. That is a degraded optional phase, not a degraded capture — there were no
images to caption.
