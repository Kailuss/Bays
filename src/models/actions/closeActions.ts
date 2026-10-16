import * as vscode from 'vscode';
import type { BayMetadata, BayState } from '../Bay';
import { BayHelpers } from '../BayHelpers';

/**
 * Close actions - Cerrar tabs y grupos
 */

export async function close(metadata: BayMetadata, state: BayState): Promise<void> {
  if (!state.capabilities.canClose) {
    vscode.window.showWarningMessage(vscode.l10n.t('This bay cannot be closed'));
    return;
  }
  const t = BayHelpers.findNativeTab(metadata, state);
  if (t) {
    await vscode.window.tabGroups.close(t);
  }
}

export async function closeOthers(
  _metadata: BayMetadata,
  _state: BayState,
  activateFn: () => Promise<void>
): Promise<void> {
  await activateFn();
  await vscode.commands.executeCommand('workbench.action.closeOtherEditors');
}

export async function closeGroup(_metadata: BayMetadata, state: BayState): Promise<void> {
  const group = BayHelpers.nativeGroup(state.viewColumn);
  if (!group) {
    return;
  }
  await vscode.window.tabGroups.close(group);
}

/**
 * Closes the rows BELOW this one in its group: the vertical "Close to the
 * Right". Which rows those are is the caller's answer (`utils/rowsBelow.ts`),
 * read off the list's order and not the tab strip's — the two part as soon as a
 * row is dragged, and the menu is read off the list.
 *
 * One `close` call for all of them, so the group settles once instead of once
 * per tab.
 */
export async function closeBelow(below: readonly { metadata: BayMetadata; state: BayState }[]): Promise<void> {
  const tabs = below
    .map(b => BayHelpers.findNativeTab(b.metadata, b.state))
    .filter((t): t is vscode.Tab => t !== undefined);
  if (tabs.length > 0) { await vscode.window.tabGroups.close(tabs); }
}
