# **Every open file, down the side.**

The tab bar works until it doesn't. Open a dozen files and the tabs shrink, then scroll, then start hiding the one you want behind a chevron.

**Editor Bays puts your open editors in a vertical list in the sidebar**, where a name stays readable however many of them there are.

## A list you can actually read

Every open editor gets a row: its name, and the folder it lives in underneath.

- **Real icons**: from whichever file icon theme you already use.
- **State on the row that owns it**: unsaved dots, Git status, errors and warnings.
- **The active file**: highlighted, always.
- **Compact mode**: name and path on one line, when you would rather see more rows.

## Actions where the file already is

Hover a bay and its actions appear. While you are only reading, none of them are on screen.

- **Pin** the files you keep coming back to, and they stay at the top.
- **Close** without aiming at a small target.
- **Add to Copilot Chat** straight from the row.
- **Do what the file does**: preview a Markdown, an image or a CSV, run a test or a script, format a JSON, send an `.http` request, open a PDF in the app that owns it.

## A menu that matches the editor's own

Right-click gives you a context menu built to VS Code's own shape: it opens under the cursor, with submenus, keyboard navigation and type-ahead.

- Close, close others, close to the right, close the group.
- Reveal in the Explorer view, or in the system file manager.
- Copy the relative path, the absolute path, or the contents.
- Compare with the active editor, open changes, split right.
- Open the timeline, duplicate the file, move it to a new window.

## Groups, when you split

Split the editor and the view gathers each group under a heading of its own.

- **Rename** a group to what it actually is.
- **Colour** it blue, green, yellow, orange, red or purple, all from your theme.
- **Lock** it so nothing closes by accident.
- **Fold** it away while you work somewhere else.

## Diffs sit under the file they came from

A diff, a staged change, a snapshot or a comparison is drawn indented under its source, as a variant of it.

Three versions of one file stay one entry with three rows beneath it, and the parent says how many it has.

## Claude Code conversations keep their name

A Claude Code tab gets its own branding and its **whole** title, read from the live transcript instead of the truncated `Conversation with...` VS Code shows. Plan previews are recognised too.

## It follows your files

Rename a file, move it, drag a folder or delete it, and the open bays follow.

No stale paths, and no rows pointing at something that is no longer there.

## Make the list yours

| Setting | What it does | Default |
|---|---|---|
| `bays.showFilePath` | The folder under each name | On |
| `bays.compactMode` | One line per bay, at reduced height | Off |
| `bays.enableHoverActions` | The buttons that appear on hover | On |
| `bays.enableDragDrop` | Reorder by dragging, within a group and across groups | On |
| `bays.animations` | Everything the view moves. `workbench.reduceMotion` turns it off too | On |
| `bays.followProductIconTheme` | Draw the panel's glyphs with your product icon theme | On |
| `bays.syncCursorPosition` | Hold the cursor at the same line in a bay and its variants | Off |

The toolbar carries a **View Options** menu for the two you flip most, and a **Save All** button that appears only while something is unsaved.

## A few things worth knowing

Editor Bays has a few deliberate boundaries:

- **Cursor position sync is experimental**, and off until you ask for it.
- A webview cannot cross the application boundary: nothing can be dragged in from outside VS Code.
- The view shows what the editor has open. It is not a file browser.

## Getting started

Click the **Editors** icon in the Activity Bar.

Your open editors are already in it. There is nothing to configure.

Settings use the `bays.` prefix: filter for `@ext:Lovervoid.bays`.

Requires VS Code **1.85** or later.

## Why Editor Bays?

Because the tab bar runs out of room and the sidebar does not.

**Every file you have open. Readable. In one column.**

Questions and bug reports: the **Q&A** tab on this listing.

MIT License.
