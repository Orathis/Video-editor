export const FEEDBACK_RATING_SCALE = 10;

/**
 * Endpoint anchor for the interactive prompt. Never print the bare range:
 * the scale moved from 1-5 to 0-10 while `5` stayed a legal value, so an
 * unanchored `0-10` keeps collecting `5`s from callers (agents especially)
 * that still read 5 as top-of-scale. Both ends always travel with the range.
 */
export const FEEDBACK_RATING_ANCHOR = `0=not likely ${FEEDBACK_RATING_SCALE}=extremely likely`;

/**
 * Argument placeholder for the non-interactive surfaces (agent hint, docs,
 * skills). Same reason as `FEEDBACK_RATING_ANCHOR`, compressed to fit inline
 * in a command line.
 */
export const FEEDBACK_RATING_PLACEHOLDER = `<0-${FEEDBACK_RATING_SCALE}, ${FEEDBACK_RATING_SCALE}=best>`;

export function parseFeedbackRating(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const rating = Number(trimmed);
  return Number.isInteger(rating) && rating >= 0 && rating <= FEEDBACK_RATING_SCALE ? rating : null;
}
