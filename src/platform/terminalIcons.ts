import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * The icon of a TERMINAL tab living in the editor area.
 *
 * `TabInputTerminal` is an empty marker — no uri, no viewType, no terminal id —
 * so the tab itself cannot say which terminal it is, let alone what icon VS Code
 * paints on it. What IS reachable is `vscode.window.terminals`, whose entries
 * carry the `iconPath` their creator asked for (`Terminal.creationOptions`).
 *
 * The bridge between the two is the NAME, and it is taken only when it is
 * UNAMBIGUOUS: exactly one open terminal called exactly like the tab. That is
 * the same discipline `findPreviewSource` uses to pair a markdown preview with
 * its source, and for the same reason — a second candidate means the answer is
 * a guess, and a guessed icon is a brand logo on a tab that has nothing to do
 * with it. No match, and the caller keeps the generic `terminal` codicon, which
 * is never wrong.
 *
 * Nothing is matched by heuristics here on purpose: a terminal title is a title,
 * so it is free to say anything. It also means this answers for very few
 * terminals — a plain shell has no `iconPath` at all, and that is precisely the
 * one whose right icon is the generic codicon.
 */

/** What the first, synchronous paint can answer. */
export type TerminalIconLookup =
  | { state: 'codicon'; name: string }    // a ThemeIcon: no disk to read
  | { state: 'loaded'; dataUri: string }  // an image already read
  | { state: 'deferrable'; key: string }  // an image not read yet
  | { state: 'none' };                    // no terminal, no icon, or it failed

const MIME_BY_SUFFIX: Record<string, string> = {
  svg  : 'image/svg+xml',
  gif  : 'image/gif',
  jpg  : 'image/jpeg',
  jpeg : 'image/jpeg',
};

/** A codicon id goes straight into a CSS class, and this one comes from a third party. */
const SAFE_CODICON = /^[a-z0-9-]+$/;

// icon uri → data URI, or null once the read failed (stops further deferrals).
const iconDataUri = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

/**
 * Synchronous lookup for the first paint: answers from the cache only. A
 * `deferrable` result is resolved later by `resolveTerminalIconAsync` through the
 * same deferred-patch path as file and extension icons.
 */
export function lookupTerminalIcon(label: string): TerminalIconLookup {
  const icon = iconPathFor(label);
  if (!icon) { return { state: 'none' }; }

  if (icon instanceof vscode.ThemeIcon) {
    return SAFE_CODICON.test(icon.id) ? { state: 'codicon', name: icon.id } : { state: 'none' };
  }

  const key = icon.toString();
  const cached = iconDataUri.get(key);
  if (typeof cached === 'string') { return { state: 'loaded', dataUri: cached }; }
  return cached === null ? { state: 'none' } : { state: 'deferrable', key };
}

/**
 * Deferred resolution: reads the image off disk through `workspace.fs`, so it
 * also works on a remote. Null → the caller keeps the codicon placeholder.
 */
export function resolveTerminalIconAsync(key: string): Promise<string | null> {
  const known = iconDataUri.get(key);
  if (known !== undefined) { return Promise.resolve(known); }

  let loading = inflight.get(key);
  if (!loading) {
    loading = readIcon(key).finally(() => inflight.delete(key));
    inflight.set(key, loading);
  }
  return loading;
}

//= INTERNALS

/** The declared icon of the one terminal named exactly like this tab, if there is one. */
function iconPathFor(label: string): vscode.Uri | vscode.ThemeIcon | undefined {
  let found: vscode.Terminal | undefined;
  for (const terminal of vscode.window.terminals) {
    if (terminal.name !== label) { continue; }
    if (found) { return undefined; } // ambiguous: two terminals answer to this name
    found = terminal;
  }
  if (!found) { return undefined; }

  const icon = found.creationOptions.iconPath;
  if (!icon) { return undefined; }
  if (icon instanceof vscode.ThemeIcon || icon instanceof vscode.Uri) { return icon; }
  // A light/dark pair: pick the side this window is actually painting.
  const dark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
            || vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;
  return dark ? icon.dark : icon.light;
}

async function readIcon(key: string): Promise<string | null> {
  try {
    const uri     = vscode.Uri.parse(key);
    const bytes   = await vscode.workspace.fs.readFile(uri);
    const mime    = MIME_BY_SUFFIX[uri.path.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/png';
    const dataUri = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;

    iconDataUri.set(key, dataUri);
    Logger.log(`[TerminalIcons] Loaded icon ${key}`);
    return dataUri;
  } catch (err) {
    Logger.warn(`[TerminalIcons] Could not load icon ${key}: ${err instanceof Error ? err.message : String(err)}`);
    iconDataUri.set(key, null);
    return null;
  }
}
