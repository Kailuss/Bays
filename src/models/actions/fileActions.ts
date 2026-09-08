import * as vscode from 'vscode';
import * as path from 'path';
import type { BayMetadata, BayState } from '../Bay';
import { BayHelpers } from '../BayHelpers';

/**
 * File manipulation actions - Duplicar, comparar, split, mover
 */

export async function duplicateFile(
  metadata: BayMetadata,
  state: BayState
): Promise<void> {
  if (!metadata.uri) {
    return;
  }
  try {
    // Read original file content
    const content = await vscode.workspace.fs.readFile(metadata.uri);

    // Generate new filename
    const dir = path.dirname(metadata.uri.fsPath);
    const ext = path.extname(metadata.uri.fsPath);
    const basename = path.basename(metadata.uri.fsPath, ext);

    // Find next available name: file-copy.ext, file-copy2.ext, etc.
    let counter = 1;
    let newName = `${basename}-copy${ext}`;
    let newPath = path.join(dir, newName);
    let newUri = vscode.Uri.file(newPath);

    while (true) {
      try {
        await vscode.workspace.fs.stat(newUri);
        // File exists, try next number
        counter++;
        newName = `${basename}-copy${counter}${ext}`;
        newPath = path.join(dir, newName);
        newUri = vscode.Uri.file(newPath);
      } catch {
        // File doesn't exist, use this name
        break;
      }
    }

    // Create the duplicate
    await vscode.workspace.fs.writeFile(newUri, content);

    // Open in the same view column as the original
    await vscode.window.showTextDocument(newUri, {
      viewColumn: state.viewColumn,
      preserveFocus: false,
    });

    vscode.window.showInformationMessage(vscode.l10n.t('File duplicated: {0}', newName));
  } catch (err) {
    vscode.window.showErrorMessage(vscode.l10n.t('Failed to duplicate file: {0}', String(err)));
  }
}

export async function compareWithActive(
  metadata: BayMetadata,
  _state: BayState
): Promise<void> {
  if (!metadata.uri) {
    return;
  }
  const active = vscode.window.activeTextEditor;
  if (!active) {
    return;
  }
  await vscode.commands.executeCommand(
    'vscode.diff',
    active.document.uri,
    metadata.uri,
    `${path.basename(active.document.fileName)} ↔ ${metadata.label}`,
    // A child bay is born in its parent's group, and the parent of THIS diff is
    // the active editor and not this bay: with two different files the ORIGINAL
    // side is the parent (`determineParentUri`), and the original side is the
    // active editor. So the column is its own, which is not always the active
    // GROUP - with a webview in front, `activeTextEditor` is the last text
    // editor to have changed input, wherever it lives.
    { viewColumn: active.viewColumn ?? vscode.ViewColumn.Active },
  );
}

export async function openChanges(metadata: BayMetadata, state: BayState): Promise<void> {
  if (!metadata.uri) {
    return;
  }
  // A child bay is born in its parent's group, and this diff hangs off THIS bay:
  // its working-tree parent is the file itself. The git extension opens it at
  // `ViewColumn.Active` and takes no column, so the group is put in front first
  // or the diff lands wherever the focus was and comes out as an orphan row.
  //
  // The GROUP is enough here, unlike the markdown preview: the command resolves
  // its resource from the uri it is handed, so it never asks which editor is in
  // front - only which group is.
  await BayHelpers.focusGroup(state.viewColumn);
  await vscode.commands.executeCommand('git.openChange', metadata.uri);
}

export async function splitRight(metadata: BayMetadata, _state: BayState): Promise<void> {
  if (!metadata.uri) {
    return;
  }
  await vscode.commands.executeCommand('vscode.open', metadata.uri, {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
  });
}

export async function moveToNewWindow(
  metadata: BayMetadata,
  _state: BayState
): Promise<void> {
  if (!metadata.uri) {
    return;
  }
  await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
}

export async function moveToGroup(
  metadata: BayMetadata,
  state: BayState,
  target: vscode.ViewColumn,
): Promise<void> {
  // The LIVE tab is moved, whatever kind of tab it is, and NOTHING is closed:
  // focus it, then run the native "move editor to group N" command.
  //
  // It used to do that only for a webview, which has no URI to reopen, and to
  // close a file bay and reopen it by URI in the target group. Three things say
  // one mechanism is the answer for all of them:
  //
  // A DIFF has a URI and is not a file. Reopening it by that URI serves the
  // plain document, so a variant relocated that way arrives as something else —
  // and moving a bay has to move its variants (`moveBayWithVariants`), which is
  // what made the difference impossible to keep ignoring.
  //
  // A close is not free. Closing a source whose PREVIEW is still open reads to
  // `BayEventService` as an external close, so it fires the full resync that
  // reopens a source left without its parent — against a move that is in the
  // middle of relocating that very source.
  //
  // And what a move owes is the TAB. A native move keeps it whole: its preview
  // state, a webview's contents, the two sides of a diff. Close and reopen
  // rebuilds an approximation of it out of a URI and a flag.
  await BayHelpers.activateByNativeTab(metadata, state);
  await BayHelpers.moveActiveEditorToGroup(target);
}
