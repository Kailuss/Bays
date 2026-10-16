// @lovervoid/kit shared/rootColors.ts: synced by `lovervoid sync`. Edit it in the kit, not here.
// The colour a workspace folder can be marked with, and what that colour IS on
// screen. Shared because both sides need the same answer: the host builds the
// palette menu and stores the choice, the client paints the accent under the
// path bar and the bar down the card's heading. Two tables would drift, and a
// drift here means a card striped in a colour no folder wears.
//
// The values are a FIXED palette, stated in `src/styles/base.css` as custom
// properties, one set worn by both theme kinds. Eight hues is what fits in ONE
// row of the menu's grid alongside the no-colour swatch, which is what a palette
// has to be to be compared at a glance; and it is still more than the theme's
// chart family, which runs out after six.
// A `var()` and not a literal on this side because the two sets are
// picked by the theme KIND, which only CSS can answer — the host builds the menu
// long before it could know, and a theme switch would otherwise have to be a
// message.

/**
 * One mark a workspace folder can carry. Absent — never a value of its own — is
 * "no colour", which is the DEFAULT and a real answer rather than a gap: a
 * folder joining the window arrives that way and stays that way until somebody
 * picks, because a mark handed out by position is a mark nobody chose — it
 * changes when the folders are reordered, and it paints three projects three
 * colours in a window where the user only ever cared about one of them.
 *
 * And it is the one answer here with TWO faces, which is what the accent stopped
 * being a swatch to become: a project with no hue of its own reads as a neutral
 * grey at rest (`NO_ROOT_COLOR_CSS`) and wears the theme's own accent on the
 * card being stood in. Both faces are stated in CSS, because which of the two
 * answers is the card's STATE and nothing this side can see.
 */
export type RootColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'violet'
  | 'pink';

/**
 * The palette, in the order the menu lays it out: round the wheel with the warm
 * hues leading, and all of it in ONE row. Comparing the colours against each
 * other is the only thing anyone does with a palette, and a row is swept in a
 * single look — no pair of these has to be held in the head across a line break.
 *
 * ONE colour per hue and every one of them named by its hue, which is the whole
 * of what keeps them apart: a palette with two reds in it makes the user read
 * the difference instead of seeing it, and at the two pixels of the path bar's
 * accent there is no difference left to read. That is what the far end of the
 * row costs: violet, purple and pink were three names for one stretch of the
 * wheel, and the middle one was the closest pair of the whole palette in the
 * light set. Two hues split the same stretch with room to be told apart, and
 * eight is what a row of the menu holds while a project's mark is still a hue
 * anyone can name.
 *
 * Every member is a hue OF OURS, and that is what the accent's leaving bought:
 * one list, one literal per entry, and no case standing beside them.
 */
export const ROOT_COLORS: readonly RootColor[] = [
  'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink',
];

/**
 * What an UNMARKED folder wears AT REST, ready to assign to a CSS property: the
 * theme's own neutral grey. It is the answer the stylesheets already fall back
 * to when `--nav-repo-color` and `--nav-accent` are unset, and it is stated here
 * as well because the menu has to paint the swatch that means it — a chip with
 * no fill would be the one answer in the row that cannot be compared with the
 * others.
 *
 * At rest, and only there: on the card being stood in that same unmarked project
 * wears the theme's accent instead (`--nav-root-accent`, base.css). The swatch
 * paints the RESTING face, because a row of chips is read by comparing colours
 * and the other face is a state rather than one more colour to pick between.
 */
export const NO_ROOT_COLOR_CSS = 'var(--nav-root-none, #8A8A8A)';

/**
 * What each hue IS. The two fields are the two theme kinds, and they hold the
 * same HUE toned differently: one palette, so a project keeps its colour
 * whichever theme the window is on, with only saturation and lightness moving so
 * that each mark carries on the surface it is painted on. Pink needs neither and
 * repeats unchanged.
 *
 * These are the SAME values `base.css` declares and the same the manifest
 * declares under `contributes.colors`, and that is not a coincidence to be
 * maintained by hand — the build pins all three sides by VALUE
 * (`checkRootColors` in esbuild.js). Three copies exist because three readers
 * cannot share one: the stylesheet picks the set by theme kind through the
 * cascade, the manifest is what a `ThemeColor` resolves against, and this table
 * is the only one the HOST can read a literal out of — which it has to, because
 * `workbench.colorCustomizations` takes a colour and not a token
 * (`services/windowAccent/`).
 *
 * Which set answers is the theme KIND, the one thing CSS knows for free and the
 * host has to ask for (`vscode.window.activeColorTheme.kind`).
 */
export const ROOT_HUE_HEX: Record<RootColor, { readonly dark: string; readonly light: string }> = {
  red    : { dark: '#FF4766', light: '#FF5773' },
  orange : { dark: '#FF8547', light: '#FF884D' },
  yellow : { dark: '#FFC247', light: '#FFBD38' },
  green  : { dark: '#95C92C', light: '#93C926' },
  teal   : { dark: '#2CC9C9', light: '#52A7A7' },
  blue   : { dark: '#2C7AC9', light: '#196EC2' },
  violet : { dark: '#9068DE', light: '#644C94' },
  pink   : { dark: '#D770A3', light: '#D770A3' },
};

/**
 * What to paint `color` with, ready to assign to a CSS property.
 *
 * The literal behind it is read out of `ROOT_HUE_HEX` rather than stated a
 * second time, which is the point: written separately these had quietly drifted
 * into a THIRD palette — eight literals nothing on screen ever matched, showing
 * only in the one case the fallback exists for. The custom property is this
 * extension's own and not the theme's, so it only fails to resolve if the view's
 * stylesheet never loaded — but an unresolvable `var()` paints nothing at all,
 * and a swatch that paints nothing reads as an unmarked folder rather than as a
 * missing stylesheet.
 *
 * Renaming the property on one side only breaks silently — the build pins both
 * sides (`checkRootColors` in esbuild.js).
 */
export function cssColorFor(color: RootColor): string {
  return `var(--nav-root-${color}, ${ROOT_HUE_HEX[color].dark})`;
}

/**
 * The literal `color` is worth on this kind of theme, for the one reader that
 * cannot go through a token: `workbench.colorCustomizations` takes a colour.
 *
 * Nothing for an UNMARKED folder, and that is the case worth stating: inside the
 * panel such a project borrows the theme's accent on the card being stood in,
 * but the window's chrome is drawn in that accent already — so it has nothing of
 * its own to wear out there, which is exactly what writing no override leaves it
 * as.
 */
export function rootColorHex(color: RootColor | null, dark: boolean): string | null {
  if (color === null) { return null; }
  return dark ? ROOT_HUE_HEX[color].dark : ROOT_HUE_HEX[color].light;
}

/**
 * The same colour named for the HOST side, where there is no stylesheet to read
 * a custom property out of — the status strip's mark, which is a `ThemeColor`
 * and nothing else (`services/statusBar/`).
 *
 * A registered theme colour and NOT one of the literals above, and that is the
 * whole point: the two sets are picked by the theme KIND, which is exactly what
 * the host cannot answer and what a hard-coded literal would get wrong in half
 * of them — the dark set worn by a light theme, with nothing reporting it. VS
 * Code resolves these against `contributes.colors`, which states both sets and a
 * high-contrast one, so a theme switch needs no message and costs no repaint of
 * ours; and it puts every one of them in reach of
 * `workbench.colorCustomizations`, which the custom properties never were.
 *
 * `null` is the UNMARKED folder and has an id like any other, because the mark
 * is drawn either way: the strip has one shape in every window, and a folder
 * nobody has marked wears the theme's own neutral grey rather than nothing. The
 * grey and not the accent, even though the strip only ever describes the ACTIVE
 * project: the accent is the PANEL's own colour, so borrowing it out in the
 * workbench's own status bar would read as a mark where nobody picked one. It is
 * the same line `rootColorHex` draws for the window's chrome.
 *
 * Declared on one side only, this fails silently — an unknown id resolves to the
 * default foreground, so the mark simply stops being a mark. The build pins both
 * sides (`checkRootColors` in esbuild.js).
 */
export function themeColorIdFor(color: RootColor | null): string {
  return `navigator.root.${color ?? 'none'}`;
}

/**
 * Reads a colour off something untrusted — a value stored by another version,
 * or an action id fabricated by the webview. Anything unrecognized is `null`,
 * which is the unmarked folder: a mark nobody can name should not be painted.
 *
 * Nothing needs translating on the way in, and that is not luck: every palette
 * this extension has had names its colours by hue, so a name that survives is
 * read back as itself. A name that did NOT survive has no heir and gets none —
 * the nearest surviving hue would be a colour the user never picked, when an
 * unreadable name means exactly what the palette already has a swatch for:
 * no colour.
 *
 * `accent` is the one dropped name whose loss migrates itself, and it is why
 * merging the two answers needed no table at all: a project stored as the accent
 * reads back as no colour, and no colour is precisely what wears the accent now.
 */
export function parseRootColor(value: unknown): RootColor | null {
  return typeof value === 'string' && (ROOT_COLORS as readonly string[]).includes(value)
    ? value as RootColor
    : null;
}

/**
 * The colour a folder actually WEARS, which is the one it was GIVEN and nothing
 * else. Null is "no colour": the neutral grey of `NO_ROOT_COLOR_CSS` at rest and
 * the theme's accent on the card being stood in, and the state a folder is in
 * until somebody picks.
 *
 * No colour is ever handed out by position: a mark nobody chose moves when the
 * folders are reordered, so the thing it exists to identify is the thing it
 * fails to hold still. Picking is what marks a repo, only what the user picked
 * is stored, and the picker is available in every window, single-folder ones
 * included.
 *
 * It stays a function of its own, and both sides ask it, so "what does this
 * folder wear" keeps one door for both sides of the wire to ask through.
 */
export function effectiveRootColor(chosen: RootColor | null): RootColor | null {
  return chosen;
}
