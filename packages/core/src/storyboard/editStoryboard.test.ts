import { describe, it, expect } from "vitest";
import { parseStoryboard } from "./parseStoryboard.js";
import {
  appendStoryboardFrame,
  removeStoryboardFrame,
  setFrameDuration,
  setFrameImage,
  setFrameStatus,
  setFrameTransition,
  setFrameVoiceover,
  setStoryboardArchived,
  setStoryboardTitle,
} from "./editStoryboard.js";

const DOC = `---
message: Hi
---

## Frame 1 — Hook
- status: outline
- voiceover: "old line"

Hook narrative.

## Frame 2 — Close
- duration: 3s

Close narrative.
`;

describe("setFrameVoiceover / setFrameStatus", () => {
  it("replaces an existing voiceover line in place, leaving other frames untouched", () => {
    const next = setFrameVoiceover(DOC, 1, "new line");
    const parsed = parseStoryboard(next);
    expect(parsed.frames[0].voiceover).toBe("new line");
    expect(parsed.frames[1].duration).toBe("3s");
    expect(next).toContain('- voiceover: "new line"');
  });

  it("matches voiceover aliases (vo)", () => {
    const doc = "## Frame 1\n- vo: original\n\nBody.";
    const next = setFrameVoiceover(doc, 1, "updated");
    // The aliased key is preserved, only the value changes.
    expect(next).toContain("- vo: ");
    expect(parseStoryboard(next).frames[0].voiceover).toBe("updated");
  });

  it("inserts the field after the heading when absent", () => {
    const next = setFrameVoiceover("## Frame 1 — Hook\n\nBody.", 1, "hi");
    const lines = next.split("\n");
    expect(lines[0]).toBe("## Frame 1 — Hook");
    expect(lines[1]).toBe('- voiceover: "hi"');
    expect(parseStoryboard(next).frames[0].voiceover).toBe("hi");
  });

  it("advances status in place", () => {
    const next = setFrameStatus(DOC, 1, "built");
    expect(parseStoryboard(next).frames[0].status).toBe("built");
    expect(parseStoryboard(next).frames[1].status).toBe("outline");
  });

  it("round-trips a voiceover containing double quotes (always wraps)", () => {
    const next = setFrameVoiceover("## Frame 1\n- voiceover: x\n", 1, 'she said "hi"');
    expect(parseStoryboard(next).frames[0].voiceover).toBe('she said "hi"');
  });

  it("round-trips an empty voiceover and a fully-quoted phrase", () => {
    const cleared = setFrameVoiceover("## Frame 1\n- voiceover: x\n", 1, "");
    expect(parseStoryboard(cleared).frames[0].voiceover).toBe("");
    const quoted = setFrameVoiceover("## Frame 1\n- voiceover: x\n", 1, '"hello"');
    expect(parseStoryboard(quoted).frames[0].voiceover).toBe('"hello"');
  });

  it("collapses newlines in a multi-line voiceover to a single line", () => {
    const next = setFrameVoiceover(
      "## Frame 1\n- voiceover: x\n\nNarrative.",
      1,
      "line one\nline two",
    );
    expect(parseStoryboard(next).frames[0].voiceover).toBe("line one line two");
    expect(parseStoryboard(next).frames[0].narrative).toBe("Narrative.");
  });

  it("throws for an out-of-range frame", () => {
    expect(() => setFrameStatus(DOC, 9, "built")).toThrow(/not found/);
  });
});

describe("appendStoryboardFrame", () => {
  it("appends the next numbered outline without changing existing source", () => {
    const source = "# Storyboard\n\n## Frame 2 — Existing\n- status: built\n";
    const next = appendStoryboardFrame(source);

    expect(next).toContain(source.trimEnd());
    expect(next).toContain("## Frame 3 — New frame");
    expect(next).toContain("- status: outline");
    expect(next).toContain("- src: compositions/frames/03-new-frame.html");
    expect(parseStoryboard(next).frames).toHaveLength(2);
  });

  it("creates frame one for an empty storyboard", () => {
    expect(appendStoryboardFrame("")).toContain("## Frame 1 — New frame");
  });
});

describe("removeStoryboardFrame", () => {
  it("removes the selected block and renumbers the remaining headings", () => {
    const source = `---
message: Keep me
---

## Frame 1 — Hook
- src: compositions/frames/01-hook.html

Opening.

## Frame 2 — Middle
- src: compositions/frames/02-middle.html

Middle.

## Frame 3 — Close
- src: compositions/frames/03-close.html

Closing.
`;

    const next = removeStoryboardFrame(source, 2);
    const parsed = parseStoryboard(next);

    expect(parsed.globals.message).toBe("Keep me");
    expect(parsed.frames.map((frame) => frame.title)).toEqual(["Hook", "Close"]);
    expect(parsed.frames.map((frame) => frame.number)).toEqual([1, 2]);
    expect(parsed.frames[1]?.src).toBe("compositions/frames/03-close.html");
    expect(next).not.toContain("Middle.");
  });

  it("rejects deleting the only frame or an unknown frame", () => {
    expect(() => removeStoryboardFrame("## Frame 1 — Only\n", 1)).toThrow(/at least one/);
    expect(() => removeStoryboardFrame(DOC, 9)).toThrow(/not found/);
  });
});

describe("setStoryboardTitle", () => {
  it("updates an existing title without changing the rest of the frontmatter", () => {
    const next = setStoryboardTitle("---\ntitle: Old\nmessage: Keep me\n---\n", "Launch Cut");
    const parsed = parseStoryboard(next);
    expect(parsed.globals.title).toBe("Launch Cut");
    expect(parsed.globals.message).toBe("Keep me");
  });

  it("adds frontmatter when the storyboard has none", () => {
    const next = setStoryboardTitle("## Frame 1 — Hook\n\nOpening.", "Concept A");
    expect(parseStoryboard(next).globals.title).toBe("Concept A");
    expect(parseStoryboard(next).frames[0].title).toBe("Hook");
  });

  it("rejects empty titles and unterminated frontmatter", () => {
    expect(() => setStoryboardTitle(DOC, "  ")).toThrow("cannot be empty");
    expect(() => setStoryboardTitle("---\nmessage: hi", "New title")).toThrow("not closed");
  });
});

describe("setStoryboardArchived", () => {
  it("archives and restores a storyboard without changing its other frontmatter", () => {
    const source = "---\ntitle: Old Cut\nmessage: Keep me\n---\n\n## Frame 1 — Hook\n";
    const archived = setStoryboardArchived(source, true);
    expect(parseStoryboard(archived).globals.extra.archived).toBe("true");
    expect(parseStoryboard(archived).globals.title).toBe("Old Cut");
    expect(parseStoryboard(archived).globals.message).toBe("Keep me");

    const restored = setStoryboardArchived(archived, false);
    expect(parseStoryboard(restored).globals.extra.archived).toBe("false");
  });

  it("adds frontmatter when the storyboard has none", () => {
    const next = setStoryboardArchived("## Frame 1 — Hook\n", true);
    expect(parseStoryboard(next).globals.extra.archived).toBe("true");
    expect(parseStoryboard(next).frames).toHaveLength(1);
  });
});

describe("setFrameDuration", () => {
  it("updates only the selected frame duration", () => {
    const next = setFrameDuration(DOC, 2, 7.25);

    expect(parseStoryboard(next).frames.map((frame) => frame.durationSeconds)).toEqual([
      undefined,
      7.25,
    ]);
  });

  it("rejects non-positive durations", () => {
    expect(() => setFrameDuration(DOC, 1, 0)).toThrow("greater than zero");
  });
});

describe("storyboard frame media fields", () => {
  it("updates the transition and attaches an image without changing the narrative", () => {
    const withTransition = setFrameTransition(DOC, 1, "blur-crossfade");
    const next = setFrameImage(withTransition, 1, "assets/storyboard/reference.png");
    const frame = parseStoryboard(next).frames[0];

    expect(frame.transitionIn).toBe("blur-crossfade");
    expect(frame.extra.image).toBe("assets/storyboard/reference.png");
    expect(frame.narrative).toBe("Hook narrative.");
  });
});
