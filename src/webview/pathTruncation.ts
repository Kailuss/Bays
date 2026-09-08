// Fitting a path into the width its row has.
//
// It cuts from the LEFT, hiding whole folders behind an ellipsis: what tells two
// files with the same name apart is the folder they live in, which sits at the
// end, so the tail-first cut a `text-overflow` would make takes away exactly
// what the path is there to say.
//
// What governs this file is COST. Measuring text means writing to the DOM and
// reading a width back, which forces a layout per read, and this runs over every
// row in the list. Hence three rules:
//
//  - **One SINGLE measurer**, created once and reused.
//  - **Widths are CACHED** by (typeface, text). A row's candidates depend only
//    on its segments, so they never change: after the first time, a repaint and
//    a resize measure nothing at all.
//  - **Read EVERYTHING first, write EVERYTHING after.** Interleaved, each write
//    dirties the layout the next read forces again — that is the thrash, and it
//    is a document layout per row and per candidate.
//
// And there is no `MutationObserver`. One over `<body>` with `subtree` is fired
// by any node added anywhere in the document — showing a tooltip, opening the
// context menu, patching an icon, swapping a state mark — and every one of those
// would re-fit every path in the list. What knows which rows are new is the
// reconciliation (`render.ts`), which has just built them, so it is what says so.

import { fitPathParts } from '../utils/pathFit';

/** Cushion against sub-pixel rounding, which otherwise makes the level oscillate. */
const SAFETY_BUFFER = 3;

/**
 * Cap on the width cache.
 *
 * Its key carries the text, so it grows with the paths visited and not with
 * anything bounded. It is dropped WHOLE when the cap is hit, like the language
 * registry: half a cache is one more question to ask on the hot path, and what
 * is lost gets measured again next time it is needed.
 */
const MAX_MEASURE_CACHE = 2000;

/**
 * Each painted path's segments, handed over by `rows.ts` as it builds the row.
 *
 * In a `WeakMap` rather than an attribute: the client already HAS the segments
 * in the model, and writing them out as JSON to parse them back here is a round
 * trip through a string to recover an array that was in hand.
 */
const partsOf = new WeakMap<HTMLElement, string[]>();

/** The segments this path is cut down from. Without them it is left alone. */
export function setPathParts(el: HTMLElement, parts: string[]): void {
  partsOf.set(el, parts);
}

/**
 * One band's width, in pixels, read from the token that draws it
 * (`--bays-row-action`, base.css) so the number lives in one place.
 *
 * Cached for the life of the view: it is a constant of the stylesheet and not
 * something a theme or a resize moves, and reading it is a style query in a
 * pass that runs on every render and every resize.
 */
let cachedBandWidth = 0;

function actionBandWidth(): number {
  if (cachedBandWidth === 0) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--bays-row-action');
    cachedBandWidth = parseFloat(raw) || 24;
  }
  return cachedBandWidth;
}

//= THE MEASURER

/** The one element used for measuring, hung off the `<body>` a single time. */
let measurer: HTMLSpanElement | null = null;

function theMeasurer(): HTMLSpanElement {
  if (!measurer) {
    measurer = document.createElement('span');
    // Out of flow and out of sight: writing to it moves nothing in the list, so
    // the layout its read forces invalidates no other measurement.
    measurer.style.cssText =
      'position:fixed;top:0;left:0;visibility:hidden;white-space:nowrap;pointer-events:none';
    measurer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(measurer);
  }
  return measurer;
}

/** Width by (typeface, text). The key carries the font because the font moves it. */
const widths = new Map<string, number>();

/**
 * What joins the parts of a cache key.
 *
 * A control character, because every other part is free text: a font family or
 * a folder name can hold anything a filesystem allows, and a printable
 * separator is one two different keys could collide on. Written as an ESCAPE and
 * never as the character itself, which is invisible in the source.
 */
const SEP = '\u0001';

/**
 * Everything that decides how wide a text comes out, read off a real row.
 *
 * The `key` is what the cache is indexed by, and it is derived from the very
 * same fields that get applied — were they two lists, a width measured under one
 * typeface could be read back under another. A theme change or a zoom moves the
 * computed `font-size`, so the key changes by itself and whatever was cached
 * under the previous one simply stops being read.
 */
type Font = {
  key          : string;
  style        : string;
  variant      : string;
  weight       : string;
  size         : string;
  family       : string;
  letterSpacing: string;
};

function fontOf(el: HTMLElement): Font {
  const s = getComputedStyle(el);
  const font: Omit<Font, 'key'> = {
    style        : s.fontStyle,
    variant      : s.fontVariant,
    weight       : s.fontWeight,
    size         : s.fontSize,
    family       : s.fontFamily,
    letterSpacing: s.letterSpacing,
  };
  return { ...font, key: Object.values(font).join(SEP) };
}

function measure(font: Font, text: string): number {
  const key = `${font.key}${SEP}${text}`;
  const hit = widths.get(key);
  if (hit !== undefined) { return hit; }

  if (widths.size >= MAX_MEASURE_CACHE) { widths.clear(); }

  const span = theMeasurer();
  // Applied as LONGHANDS and not through the `font` shorthand: a computed
  // `font-variant` can serialise to something the shorthand does not accept
  // (it only takes `normal` or `small-caps`), and a shorthand that fails to
  // parse is DROPPED WHOLE — the measurer would keep the previous row's
  // typeface and hand back a width for a font nothing is drawn in.
  span.style.fontStyle     = font.style;
  span.style.fontVariant   = font.variant;
  span.style.fontWeight    = font.weight;
  span.style.fontSize      = font.size;
  span.style.fontFamily    = font.family;
  span.style.letterSpacing = font.letterSpacing;
  span.textContent = text;
  // The ONLY read in here that forces a layout, and only on a miss.
  const width = span.offsetWidth;

  widths.set(key, width);
  return width;
}

//= THE PASS

/** What has been read off a row, before anything is written to any of them. */
type Fit = {
  el       : HTMLElement;
  parts    : string[];
  font     : Font;
  available: number;
};

/**
 * The READ phase: what it takes to decide, without touching the DOM.
 *
 * None of these reads depends on the path's own text — `.bay-text` takes its
 * width from the row and `.bay-name` is `flex-shrink: 0` in compact mode — so
 * doing them all up front changes no answer, and removes the layout each write
 * was forcing on the next read.
 */
function readFit(el: HTMLElement, fonts: Map<string, Font>): Fit | null {
  const parts = partsOf.get(el);
  if (!parts || parts.length === 0) { return null; }

  const container = el.parentElement;
  if (!container) { return null; }

  let available = container.clientWidth;

  // The room the band of orders will take, subtracted UP FRONT even though the
  // row is not opened for it yet. That is what makes hovering a row move
  // nothing at all: measured against the resting width, a path fitted exactly
  // would be re-cut the moment the pointer arrived — and the flex ellipsis that
  // did it would cut the TAIL, which is the folder the file actually lives in
  // and the whole reason the path is there. This pass abbreviates from the left
  // instead, where the generic folders are.
  //
  // Read off the row's own `--bay-actions` (written by `rows.ts`) rather than
  // measured: the band is out of flow and hidden, so asking the DOM for its
  // width would force a layout per row.
  const row = container.closest<HTMLElement>('.bay');
  const slots = Number(row?.style.getPropertyValue('--bay-actions') ?? 0);
  if (slots > 0) { available -= slots * actionBandWidth(); }

  // In compact mode the path shares its line with `.bay-name`, so the name and
  // the gap between the two (4px gap + 6px left margin) come off the top.
  if (el.classList.contains('bay-path-inline')) {
    const bayName = container.querySelector<HTMLElement>('.bay-name');
    if (bayName) { available -= bayName.offsetWidth + 10; }
  }

  // The typeface is asked once per CLASS and not per row: there are two
  // (`.bay-path` and `.bay-path-inline`), each drawn with its own, and
  // `getComputedStyle` per element is a style query per row.
  let font = fonts.get(el.className);
  if (font === undefined) {
    font = fontOf(el);
    fonts.set(el.className, font);
  }

  return { el, parts, font, available: available - SAFETY_BUFFER };
}

/** Fits the paths it is handed, in three phases with nothing interleaved. */
function truncate(paths: Iterable<HTMLElement>): void {
  const fonts = new Map<string, Font>();

  // 1. READ. Nothing here writes, so no layout is dirtied along the way.
  const fits: Fit[] = [];
  for (const el of paths) {
    const fit = readFit(el, fonts);
    // No width yet (the row is not laid out) means there is nothing to decide.
    if (fit && fit.available > 0) { fits.push(fit); }
  }
  if (fits.length === 0) { return; }

  // 2. MEASURE. Only cache misses reach the measurer.
  const results = fits.map(fit =>
    fitPathParts(fit.parts, fit.available, text => measure(fit.font, text)));

  // 3. WRITE, and only what actually changes: reassigning `textContent` replaces
  //    the text node, so a no-op write costs a reflow for nothing.
  for (let i = 0; i < fits.length; i++) {
    if (fits[i].el.textContent !== results[i]) { fits[i].el.textContent = results[i]; }
  }
}

const PATH_SELECTOR = '.bay-path, .bay-path-inline';

/** The paths inside the blocks the reconciliation has just built. */
export function truncatePathsIn(roots: readonly HTMLElement[]): void {
  if (roots.length === 0) { return; }
  const paths: HTMLElement[] = [];
  for (const root of roots) {
    root.querySelectorAll<HTMLElement>(PATH_SELECTOR).forEach(el => paths.push(el));
  }
  truncate(paths);
}

/** Every path in the list. Asked for by a width change, which moves them all. */
export function truncateAllPaths(): void {
  truncate(document.querySelectorAll<HTMLElement>(PATH_SELECTOR));
}

/**
 * The only thing left to watch is the WIDTH, which is what changes on its own.
 *
 * New rows are announced by the render, which is what builds them, so there is
 * nothing here to observe.
 */
export function initPathTruncation(): void {
  let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // A frame of grace so the layout is settled before anything measures it.
      requestAnimationFrame(truncateAllPaths);
    }, 100);
  });
}
