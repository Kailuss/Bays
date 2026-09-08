# Changelog

All notable changes to Bays.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Odd minor versions (0.5, 0.3, …) ship on the marketplace's **pre-release**
channel; even ones are stable releases.

## [0.4.11] - 2026-09-09

### Changed

- A bay moves to another group as a live tab, so nothing is closed and reopened
  on the way.

### Fixed

- Moving a bay to another group takes its variants with it, instead of leaving
  its diffs and its preview under the header it came from.

## [0.4.10] - 2026-09-08

### Changed

- The rule between two rows fades out at both ends.
- The rule between a row and its variants is broken, and between two variants
  there is none.
- The block being dragged carries no rule under it.
- A selected row's name is drawn a step heavier, and the row a selected variant
  hangs from keeps that weight.
- A variant drags its whole block, like every other row of it.
- The View Options menu is marked with a vertical ellipsis.

### Fixed

- Reordering by drag lands each row on its slot instead of a pixel past it.

## [0.4.9] - 2026-09-08

### Changed

- The rule between rows stops short of both edges, by the same margin a group
  header keeps.
- The last row of a group carries no rule under it.

## [0.4.8] - 2026-09-08

### Changed

- The activity bar mark is the `collection` codicon.

## [0.4.7] - 2026-09-08

### Added

- `bays.trace` (off): writes a detailed trace to the Bays output channel.
  Warnings and errors are written either way.

### Changed

- Git state is read from a per-repository index by path instead of by walking
  the change lists.
- Path fitting measures once per typeface and text, and only re-measures the
  rows a render built.
- Rows are laid out with CSS containment.
- Claude Code conversation titles resolve their candidate transcripts once per
  pass, and the pass is coalesced.
- Git status and diagnostics are read once per tab conversion.
- The stylesheet is minified in production builds.
- Trace logging is off unless `bays.trace` is on.

## [0.4.6] - 2026-09-08

### Fixed

- The view no longer points an icon of its own at the 256px marketplace PNG. The
  activity bar draws a container's icon, which is the `list-flat` codicon, and a
  view that declares none inherits it: one mark, said once, and the PNG goes back
  to being what it is, the logo of the marketplace page.

## [0.4.5] - 2026-09-08

### Fixed

- A child row opens in its PARENT's group instead of wherever the focus happened
  to be. Pressing Open Preview on a bay that was not the one in front sent the
  preview to the active group, and the list is composed one group at a time: the
  preview came out as an orphan row under a foreign header while the source kept
  offering the button, because as far as that group was concerned nothing had
  opened. Open Changes and Compare with Active Editor land in their parent's
  group too.

### Changed

- A row's buttons are a full-bleed band pinned to its right edge, and the row
  opens the room for it under the pointer: the state mark now steps aside
  instead of disappearing. A state you have to move the mouse away from to read
  is one you have to remember rather than read. The same is true of a variant's
  diff counts, which used to vanish for the close button.
- One width for every band that closes a row: a bay's orders, a group header's
  buttons and the fold that ends it. Square blocks with no rounded corners,
  because a radius only means something on a shape with room around it.
- The state mark is a bare glyph rather than a 22px box, so a clean row costs no
  width at all and the marks of a column line up against each other.
- A group header is a card: loose of the panel's edges, rounded and lying on the
  list rather than cut into it. It sheds the stripe down its side, the rule under
  it and the wash it carried when folded; the rows below keep their stripe.
- An open header is a frame and a folded one is a box, and each is closed the way
  it is: open, the bottom corners are square and the group's colour rides that
  edge as a band against the rows it names; folded, all four corners round and
  the colour moves to the ring, at a fraction so an identity does not read as a
  state.
- The ring reads the theme's widget border and falls back to nothing, where it
  used to lead with the rule VS Code draws between sidebar sections over a fixed
  grey. That token is a solid line, so behind a 1.25px ring it came out as a
  heavy outline, and the grey gave a ring to themes that had asked for none.
- Moving the focus from one editor group to another now reaches the panel at all.
  A tab is active in ITS OWN group, so a split editor has one per group and none
  of those flags moves when the focus does: the check that decided whether to
  tell the view anything asked the tabs alone, and answered no.
- A group's name is neutral, and its strength says which group holds the
  foreground tab: the whole of the theme's selected-row colour on that one, a
  fraction of it on the rest. It used to be written in the group's own hue, which stated the
  thing the mark beside it and the band under it already state twice, and spent
  the one property a name had left on it.
- The group mark lines up with the icon column of the rows below. The two are
  different sizes, so it is their centres that meet.

- A bay no longer wears a stripe of its group's colour down its left edge. A row
  inside a group already reads as being in it, and the stripe repeated that on
  every row of every group. The colour lives on the header alone, which is also
  why the block stopped carrying an attribute nothing read.
- The fold moved to the header's right edge, where a repo card puts it, and its
  arrow says what pressing it does rather than which state the group is in: down
  on a folded header because pressing brings the rows back, up on an open one.
- A group header is a tab stop, and Enter or Space on it folds the group. Its
  three orders are hidden with `visibility` so they are not stops of their own
  while unseen, and the route now lands on the header first.

## [0.4.4] - 2026-09-08

### Fixed

- Two Claude Code conversations open at once only drew one row, and closing or
  activating either one acted on the same tab. A bay without a URI took its id
  from the panel's `viewType`, which names a KIND of panel and not a panel, so
  two of them composed the same id. Each tab now carries a seat of its own. The
  same collision hid a second markdown preview.
- An unsaved workspace was named after its first folder, which in a multi-root
  window says something false about the others. It is now called `Workspace`.

### Changed

- The activity bar icon is the `list-flat` codicon.
- A group is marked with `collection` instead of a folder: a group is a
  collection of editors, and the folder said what the row underneath already
  says with its own file icon. The fold moved to a chevron next to it, which
  says where pressing leads rather than which state the group is in.

## [0.4.3] - 2026-09-08

### Fixed

- A webview bay drew the base64 `data:` URI of its owning extension's logo as
  text over the row's title. It now goes through the same wrapper the file rows
  use, which validates the URI before it reaches the row.
- The header named an unsaved workspace with a timestamp. An untitled workspace
  file carries no name to read, so the header falls back to the name of the
  first folder, which is what VS Code shows.

## [0.4.2] - 2026-09-07

### Changed

- Revised extension icon.

## [0.4.1] - 2026-09-07

### Changed

- New extension icon.
- The extension is published as `Lovervoid.bays`, alongside Atria and Dark Mode
  Lover.
- The build copies the two codicon files the panel loads instead of copying the
  package's `dist/` whole and excluding the rest afterwards. The four exclusions
  written one by one had missed `metadata.json`, which shipped: 124 KB read by
  nothing. The package is 157.93 KB, down from 176.17 KB.

### Removed

- AI and agent documentation is no longer tracked by git. It stays on disk,
  which is where it is useful, and `check-layers` cuts if any of it reaches the
  index.

## [0.4.0] - 2026-09-04

### Changed

- The documentation is now a single `CLAUDE.md`, in Spanish. Five overlapping
  layers (a root Copilot agent, one `AGENT.md` per folder, `ARCHITECTURE.md` and
  a `docs/` guide) held 7598 lines that stated the same facts up to five times,
  so a change corrected one copy and left four stale. What survived is what the
  code cannot say: the invariants, the cases learned the hard way and what each
  decision costs.
- `check-layers` reads the identifiers a document cites from INSIDE each
  backtick span, not the span as a whole, and builds its corpus with comments
  stripped. The old rule needed the whole span to be one identifier, so
  `Foo[]`, `bay.method()` and `Foo.bar` slipped through it, and a name mentioned
  in a comment counted as a name the code has. Its reverse half -- an exception
  that no document cites any more -- now measures without the exception list
  itself, which lives in a build script and so vaccinated every name on it: that
  half could never fail, and 21 of its 86 entries were stale.

### Added

- Localization. Every visible string goes through `vscode.l10n.t` in the host
  and through a client-side `t()` fed by a bundle the shell injects as
  `window.__l10n`; `contributes` moved to `%key%` placeholders. Spanish and
  Catalan ship in `l10n/` and `package.nls.*`. Adding a language is two files:
  both parity rules scan the directory instead of carrying a written list.
- Build gates that fail the build instead of shipping in green: `check-docs`
  (paths cited in the docs and in code comments, images in every markdown, and
  no dashes or typographic quotes in what the marketplace renders),
  `check-release` (the manifest version has its own dated, written and unique
  entry on top of the changelog) and `check-layers` (folder membership, command
  ids declared vs registered vs named in a menu, disposal, the trust boundary
  and the identifiers this repo's prose cites).
- `esbuild.js` now refuses to produce a green build with a missing CSS entry
  point, an unresolved `@import`, an orphan stylesheet nobody imports, a
  reordered `@import` list, an empty test scan or a codicon name that
  `codicon.css` does not define.
- `scripts/release.js`: `vsce` is composed instead of typed, with the channel
  derived from the version and said out loud before anything runs.
- `src/platform/`, for the thin adapters over the VS Code API, and a pure
  `src/utils/` with unit tests that run under `node --test` in milliseconds
  (previously every test needed a real VS Code host).
- `capabilities.untrustedWorkspaces` and `virtualWorkspaces` in the manifest:
  Bays runs no workspace code, so it now works in Restricted Mode.
- Marketplace metadata that was missing: `icon`, `license`, `keywords` and
  `galleryBanner`.

### Changed

- Values read from a third-party icon theme (colour, font size, codepoint, data
  URI, font format, weight and style) are validated against a whitelist before
  reaching the webview instead of being interpolated as they arrive.
- The Content Security Policy declares `base-uri` and `form-action`, which do
  not inherit from `default-src`.
- `no-explicit-any` is an error: what reads foreign JSON is typed `unknown` and
  narrowed, so the check cannot be skipped.
- Compact mode and the file-path toggle are remembered **per project** instead
  of writing the user's global settings.
- The webview client listens for host messages through an exhaustive table, so a
  new message cannot compile without an owner.

### Fixed

- Documentation citing `src/webview/contextmenu.js`, `webview.js`, `dragdrop.js`
  and `pathTruncation.js` months after the client became TypeScript.
- `getStateIndicator` was dynamically imported on the single-bay update path.

## [0.3.7] - 2026-07-24

### Added

- Real test suites for id generation, native-tab matching, diff classification
  and path formatting, plus an activation smoke test.
- Type-aware lint (promise rules) and a CI workflow running type-check, lint,
  production build and tests.

### Changed

- The packaged VSIX drops the non-runtime codicon extras.

## [0.3.6] - 2026-07-24

### Added

- Per-group rename, colour, lock and collapse, persisted per workspace.
- Bays follow a file through rename, move and delete.
- First-class Claude Code support: the full conversation title read from the
  live transcript, and the owning extension's real logo for webview tabs.
- Drag and drop of bays between editor groups.
- A View Options submenu in the view title, with Save All appearing only when
  something is unsaved.
- Icons resolved through the contributed language registry, so themes that only
  map by language stop falling back to the generic file icon.

### Changed

- The host to webview contract is a single typed protocol, with the host
  dispatching through an exhaustive handler table.
- The webview client is TypeScript bundled by esbuild instead of scripts copied
  verbatim.
- Active-tab, dirty and git/diagnostic changes are patched incrementally instead
  of rebuilding the whole DOM.
- Markdown preview renders as a variant bay under its source.
- All state-mutating sync runs through a single promise queue.

### Fixed

- Font-based icon themes rendered empty boxes.
- Variants attached to a phantom parent, and diff ids that did not survive a
  close.
- The path row disappeared for files outside the workspace.
- Git status for nested repositories, reopened repositories and a late git
  activation.
- A truncation loop in the webview, and collapsed groups that snapped back open.

## [0.3.4] - 2026-02-23

### Added

- Cursor position synchronization between a bay and its variants, behind
  `bays.syncCursorPosition` (off by default).
