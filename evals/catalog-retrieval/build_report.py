#!/usr/bin/env python3
"""Build report.html: every run, what it saw, what it picked, and why it scored.

The point is that the verdict is auditable. Each of the 30 runs shows the exact
moves its condition put in front of the model, the picks that came back, and the
gate's reasoning, so a claim in VERDICT.md can be traced to the run behind it.
"""

import collections
import html
import json
import os

import gate
import harness

HERE = harness.HERE
SETS = (("runs.json", "k=5"), ("runs-k10.json", "k=10"))


def esc(s):
    return html.escape(str(s))


def collect():
    shelf, gold = harness.load_shelf(), gate.load_gold()
    vectors = json.load(open(harness.VECTORS))
    rows, agg = [], collections.defaultdict(lambda: {"fit": [], "mount": [], "pass": 0, "tok": 0})
    for path, label in SETS:
        full = os.path.join(HERE, path)
        if not os.path.exists(full):
            continue
        for r in json.load(open(full)):
            s = gate.score(
                r["brief"], [p["move"] for p in r["picks"]], gold, shelf, vectors, r.get("pick_vectors")
            )
            key = f"{r['condition'].upper()} {label}"
            tok = sum(a["usage"].get("total_tokens", 0) for a in r["attempts"])
            a = agg[key]
            a["fit"].append(s["fit"])
            a["mount"].append(s["mountable"])
            a["pass"] += s["passed"]
            a["tok"] += tok
            rows.append({"set": label, "run": r, "score": s, "tokens": tok})
    return rows, agg, gold, shelf


def summary_table(agg):
    order = ["A k=5", "B k=5", "C k=5", "D k=5", "C k=10", "D k=10"]
    seen = [k for k in order if k in agg] + [k for k in agg if k not in order]
    best = max(sum(agg[k]["fit"]) / len(agg[k]["fit"]) for k in seen)
    out = ["<table class='sum'><tr><th>condition</th><th>mean fit</th><th>mountable</th>"
           "<th>passed</th><th>tokens/run</th></tr>"]
    for k in seen:
        a = agg[k]
        n = len(a["fit"])
        fit = sum(a["fit"]) / n
        cls = " class='top'" if abs(fit - best) < 1e-9 else ""
        out.append(
            f"<tr{cls}><td>{esc(k)}</td><td>{fit:.3f}</td><td>{sum(a['mount'])/n:.2f}</td>"
            f"<td>{a['pass']}/{n}</td><td>{a['tok']//n}</td></tr>"
        )
    return "\n".join(out) + "</table>"


def run_cards(rows, gold):
    out = []
    for r in sorted(rows, key=lambda r: (r["run"]["brief"], r["set"], r["run"]["condition"])):
        run, s = r["run"], r["score"]
        g = gold[run["brief"]]
        picks = []
        for note in s["picks"]:
            name = note["resolved"]
            tag = "right" if name in g["best"] else "wrong" if name in g["bad"] else "neutral"
            tag = "unmatched" if name is None else tag
            resolved = f" &rarr; {esc(name)}" if name and note["how"] != "exact" else ""
            picks.append(
                f"<li class='{tag}'><code>{esc(note['pick'])}</code>{resolved}"
                f"<span class='how'>{esc(note['how'])}</span></li>"
            )
        shown = run["shown"]
        shown_html = (
            "<details><summary>saw " + str(len(shown)) + " move"
            + ("s" if len(shown) != 1 else "") + "</summary><p class='shown'>"
            + ", ".join(
                f"<span class='{'right' if n in g['best'] else 'wrong' if n in g['bad'] else ''}'>{esc(n)}</span>"
                for n in shown
            )
            + "</p></details>"
            if shown
            else "<p class='shown none'>saw no catalog at all</p>"
        )
        out.append(f"""
<article class="run {'pass' if s['passed'] else 'fail'}">
  <header>
    <span class="id">brief {esc(run['brief'])} &middot; condition {esc(run['condition'].upper())} &middot; {esc(r['set'])}</span>
    <span class="score">fit {s['fit']} &middot; mountable {s['mountable']:.2f} &middot; {'PASS' if s['passed'] else 'FAIL'}</span>
  </header>
  {shown_html}
  <ul class="picks">{''.join(picks) or "<li class='unmatched'>no picks returned</li>"}</ul>
  <p class="why">{esc(s['reason'])}</p>
  <p class="cost">{r['tokens']} tokens</p>
</article>""")
    return "\n".join(out)


def brief_cards(gold):
    out = []
    for bid in sorted(gold):
        g = gold[bid]
        text = open(os.path.join(HERE, "briefs", f"{bid}.md")).read()
        head, body = text.split("\n\n", 1) if "\n\n" in text else (text, "")
        out.append(f"""
<article class="brief">
  <h3>brief {esc(bid)}</h3>
  <pre class="meta">{esc(head.strip())}</pre>
  <p>{esc(body.strip())}</p>
  <p class="gold"><b>gold best:</b> <span class="right">{esc(', '.join(g['best']))}</span><br>
     <b>known wrong:</b> <span class="wrong">{esc(', '.join(g['bad']))}</span></p>
  <p class="trap">{esc(g.get('trap', ''))}</p>
</article>""")
    return "\n".join(out)


CSS = """
:root { color-scheme: light dark; --fg:#111; --dim:#666; --line:#e3e3e6; --bg:#fff;
        --ok:#0a7c3f; --no:#b3261e; --card:#fafafa; }
@media (prefers-color-scheme: dark) { :root { --fg:#e8e8ea; --dim:#9a9aa2; --line:#2a2a2e;
        --bg:#0d0d0f; --ok:#4ade80; --no:#f87171; --card:#151518; } }
* { box-sizing: border-box; }
body { margin:0 auto; padding:2.5rem 1.5rem 6rem; max-width:60rem; background:var(--bg); color:var(--fg);
       font:15px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif; }
h1 { font-size:1.6rem; margin:0 0 .3rem; letter-spacing:-.01em; }
h2 { font-size:1.1rem; margin:3rem 0 .8rem; padding-bottom:.4rem; border-bottom:1px solid var(--line); }
h3 { font-size:.95rem; margin:0 0 .5rem; }
.lede { color:var(--dim); margin:0 0 1rem; }
table { border-collapse:collapse; width:100%; margin:.5rem 0 1rem; font-variant-numeric:tabular-nums; }
th, td { text-align:left; padding:.45rem .7rem; border-bottom:1px solid var(--line); }
th { font-weight:600; color:var(--dim); font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; }
tr.top td { font-weight:650; }
tr.top td:first-child::after { content:" \\2605"; color:var(--ok); }
.callout { border-left:3px solid var(--ok); background:var(--card); padding:.9rem 1.1rem; margin:1rem 0; border-radius:0 6px 6px 0; }
.callout.warn { border-left-color:#d97706; }
.callout p { margin:.3rem 0; }
.grid { display:grid; gap:.7rem; }
.run, .brief { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:.8rem 1rem; }
.run header { display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; font-size:.82rem; }
.run .id { font-weight:600; }
.run .score { color:var(--dim); font-variant-numeric:tabular-nums; }
.run.pass { border-left:3px solid var(--ok); }
.run.fail { border-left:3px solid var(--no); }
.picks { list-style:none; margin:.5rem 0 .3rem; padding:0; display:flex; flex-wrap:wrap; gap:.4rem; }
.picks li { border:1px solid var(--line); border-radius:5px; padding:.15rem .5rem; font-size:.82rem; background:var(--bg); }
.picks li.right { border-color:var(--ok); }
.picks li.wrong { border-color:var(--no); }
.picks li.unmatched { color:var(--dim); font-style:italic; }
.how { color:var(--dim); font-size:.72rem; margin-left:.4rem; }
.right { color:var(--ok); }
.wrong { color:var(--no); }
.why, .cost, .shown, .trap { color:var(--dim); font-size:.8rem; margin:.3rem 0 0; }
.shown span { margin-right:.35rem; }
details summary { cursor:pointer; color:var(--dim); font-size:.8rem; }
pre.meta { font-size:.75rem; color:var(--dim); margin:0 0 .5rem; white-space:pre-wrap; }
code { font:12.5px ui-monospace, SFMono-Regular, Menlo, monospace; }
footer { margin-top:3rem; color:var(--dim); font-size:.8rem; border-top:1px solid var(--line); padding-top:1rem; }
"""


def main():
    rows, agg, gold, shelf = collect()
    total_tok = sum(r["tokens"] for r in rows)
    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Catalog browsing eval</title><style>{CSS}</style></head>
<body>
<h1>Catalog browsing eval</h1>
<p class="lede">{len(rows)} runs over {len(gold)} briefs, gpt-4o-mini at temperature 0,
{total_tok:,} tokens total. Every run below shows what its condition put in front of the
model and what came back, so the verdict is checkable rather than asserted.</p>

<h2>Result</h2>
{summary_table(agg)}

<div class="callout">
<p><b>Grep the shelf, take 10, skip the embeddings.</b> Semantic retrieval beat lexical
decisively at k=5 (0.867 against 0.467), and that gap vanished completely at k=10 where both
score 0.867 within 6 tokens of each other. The entire measured advantage of embeddings came
from too narrow a window, and widening the grep window costs nothing to build or operate.</p>
<p><b>Keep the catalog.</b> The control scores 0.00 mountable on every brief: all 10 moves it
named were invented and none can be installed.</p>
<p><b>Retrieve rather than paste the file.</b> Lexical k=10 matches a full read exactly on
quality at 46% of the tokens, and top-k does not scale with shelf size while a full read does.</p>
</div>

<div class="callout warn">
<p><b>The honest limitation.</b> 0.867 is the ceiling this brief set can measure, not a score
with headroom above it. Briefs 01 and 05 each have two gold answers and every condition that
found one found only one. Four of the six configurations sit on that exact ceiling, so the tie
between them is a measurement limit, not a demonstrated equivalence. What the data does support
is the two conditions that lost, and both losses are large and mechanically explained.</p>
</div>

<h2>The briefs and their gold answers</h2>
<p class="lede">Written in a director's voice, never the shelf's, so neither retriever wins on
vocabulary. Authored before any run and never shown to one.</p>
<div class="grid">{brief_cards(gold)}</div>

<h2>Every run</h2>
<p class="lede">Green outline is a gold answer, red is a move the gold set marks known-wrong.
Condition A picks are free text resolved to their nearest shelf move by embedding.</p>
<div class="grid">{run_cards(rows, gold)}</div>

<footer>Scored by gate.py against hand-authored gold sets, 11 checks passing in test_gate.py.
Shelf of {len(shelf)} moves at ../video-primitives/SHELF.md. Full write-up in VERDICT.md.</footer>
</body></html>
"""
    out = os.path.join(HERE, "report.html")
    open(out, "w").write(doc)
    print(f"wrote {out}: {len(rows)} runs, {total_tok} tokens, em-dashes {doc.count(chr(8212))}")


if __name__ == "__main__":
    main()
