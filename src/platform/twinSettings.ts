// Tomado de Atria src/platform/twinSettings.ts @ e51aaa9.
// Reading a setting another one of the house's extensions owns.
//
// Three of the house's extensions ask some of the same questions of the user,
// each under its own prefix, and the rule is ONE answer with ONE owner: what is
// PRESENTATION or a project's identity belongs to Atria, and a fact about GIT
// belongs to Railyard. The neighbour reads the owner's key where the owner is
// installed and its own where it is not. Which side wins is decided by one pure
// rule with tests (`resolveTwinSetting`); what lives here is the two facts that
// rule needs and cannot know.
//
// A setting is read straight off the configuration on purpose, and not through
// the other extension's `exports`: any extension may read any key, so this
// needs no activation, no contract version and no handshake — it works before
// the owner has activated and keeps working after it is disabled. What may NOT
// cross this way is anything in `workspaceState`, which is per extension: a
// colour, an alias or the card order travels through `exports` and nowhere
// else.

import * as vscode from 'vscode';
import { splitSettingId } from '../utils/settingsRules';

/**
 * The value WRITTEN for a setting id, or `undefined` where only its default
 * stands.
 *
 * `inspect` and not `get`, and that is the point of this function rather than a
 * detail: `get` folds the default in, so it cannot tell a value somebody typed
 * from one the manifest declares — and the twin rule turns on exactly that
 * difference. The narrowest scope first, which is the order VS Code itself
 * resolves in.
 *
 * Read defensively of the id: `inspect` returns `undefined` whole for a section
 * nothing declares, which is what an uninstalled extension's key looks like.
 */
export function writtenValue(id: string, scope?: vscode.Uri): unknown {
  const { section, key } = splitSettingId(id);
  const found = vscode.workspace.getConfiguration(section, scope).inspect<unknown>(key);
  if (!found) { return undefined; }
  return found.workspaceFolderValue
    ?? found.workspaceValue
    ?? found.globalValue
    ?? undefined;
}

/**
 * Whether an extension is INSTALLED and enabled, which is the one question the
 * twin rule asks about the owner.
 *
 * Not whether it is ACTIVE: a setting is readable whether or not the extension
 * that declares it has activated, and waiting for activation would make the
 * answer depend on the order two extensions happen to start in. Nothing is
 * activated from here.
 */
export function extensionPresent(extensionId: string): boolean {
  return vscode.extensions.getExtension(extensionId) !== undefined;
}
