// What a path shows when it does not fit, as a PURE RULE.
//
// The walk through the DOM — where the available width comes from and how a
// piece of text is measured — stays in `webview/pathTruncation.ts`, which is
// what genuinely needs a document. What gets decided from those two numbers is
// arithmetic over a list of segments, and on its own it can be pinned down by
// tests that run without a browser.
//
// The part to keep in view: **every candidate is measured WITH its ellipsis**.
// Measuring "fits without the ellipsis" and painting with one afterwards makes
// the level oscillate between two neighbouring widths — the candidate clears the
// bar by a few pixels, the prefix is added, it no longer fits, so the next pass
// picks another and the one after that comes back.

/**
 * What separates two folders IN THE ROW.
 *
 * Not the `PATH_SEPARATOR` of `pathParts.ts`, and not to be merged with it: that
 * one is what the host writes into `detailLabel`, which besides seeding this row
 * is the description of a row in Copilot's quick pick. Two surfaces, and only
 * this one gets cut down.
 */
export const ROW_SEPARATOR = ' › ';

export const ELLIPSIS = '…';

/** How wide a piece of text comes out. Answered by whoever has a document. */
export type Measure = (text: string) => number;

/**
 * The longest candidate that fits in `available`.
 *
 * Candidates are tried from MOST to FEWEST segments, and that is the part that
 * matters: the answer is monotonic in the width, so narrowing the panel can only
 * hold or raise the truncation level, never take it back.
 *
 * What gets cut is the HEAD of the path, where the generic folders are. The tail
 * is the folder the file actually lives in, which is the only reason the path is
 * there at all.
 *
 * @param parts     the segments, from the root down to the containing folder.
 * @param available the pixels there are, with everything else in the row already
 *                  subtracted.
 * @param measure   how wide a text comes out in that row's typeface.
 */
export function fitPathParts(parts: readonly string[], available: number, measure: Measure): string {
  if (parts.length === 0) { return ''; }

  const full = parts.join(ROW_SEPARATOR);
  if (measure(full) <= available) { return full; }

  for (let n = parts.length - 1; n >= 1; n--) {
    const candidate = ELLIPSIS + ROW_SEPARATOR + parts.slice(parts.length - n).join(ROW_SEPARATOR);
    if (measure(candidate) <= available) { return candidate; }
  }

  // Not even the last segment fits: the ellipsis alone is the only thing still
  // saying there is a path there, and the hover gives it in full.
  return ELLIPSIS;
}
