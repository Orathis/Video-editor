import { describe, expect, it } from "vitest";

import {
  FEEDBACK_RATING_ANCHOR,
  FEEDBACK_RATING_PLACEHOLDER,
  FEEDBACK_RATING_SCALE,
  parseFeedbackRating,
} from "./feedbackRating.js";

describe("parseFeedbackRating", () => {
  it.each(["0", "10"])("accepts the NPS boundary %s", (raw) => {
    expect(parseFeedbackRating(raw)).toBe(Number(raw));
  });

  it.each(["-1", "11", "4.5", "10x", ""])("rejects invalid rating %j", (raw) => {
    expect(parseFeedbackRating(raw)).toBeNull();
  });

  it("declares the serialized rating scale", () => {
    expect(FEEDBACK_RATING_SCALE).toBe(10);
  });

  // Both hints must name the top of the scale. A bare "0-10" is what let the
  // 1-5 era's "5 = perfect" habit keep submitting mediocre scores.
  it.each([FEEDBACK_RATING_ANCHOR, FEEDBACK_RATING_PLACEHOLDER])(
    "hint %j carries the top of the scale",
    (hint) => {
      expect(hint).toContain(String(FEEDBACK_RATING_SCALE));
      expect(hint).toMatch(/best|extremely likely/);
    },
  );
});
