import * as vscode from 'vscode';
import { GitSyncService      } from '../../integration/GitSyncService';
import { convertToBay        } from '../helpers/tabConverter';
import { Logger              } from '../../../platform/logger';
import { fileBayId           } from '../../../utils/idRules';

/**
 * BayHeadService - opens the parent of a diff the user has just opened.
 *
 * A diff opened with its base file closed (from Source Control, a Claude edit, a
 * timeline entry) is a row with nothing to hang from. Opening the file next to
 * it, in the SAME group, is the answer to that act — the user just asked for the
 * diff, and the file is what the diff is OF.
 *
 * It answers the OPEN and nothing else, which is what keeps it from fighting the
 * user. It never runs on a reconcile, so a parent the user closes with its diff
 * still open stays closed and the diff is drawn as a root row. And it never runs
 * for a markdown PREVIEW: opening a preview replaces an italic `.md` tab, and
 * closing the `.md` is something people do on purpose to keep only the preview.
 */
export class BayHeadService {
  constructor(private gitSyncService: GitSyncService) {}

  /**
   * Opens the parent file of a freshly opened variant tab when it is not already
   * open in that tab's group. The reconcile that follows picks both up.
   */
  async openMissingParent(variantTab: vscode.Tab): Promise<void> {
    const variant = convertToBay(variantTab, this.gitSyncService);
    if (!variant || variant.metadata.diffType === 'preview') { return; }

    const parentId  = variant.metadata.sourceBayId;
    // The PARENT's uri, not the variant's: a git/timeline/snapshot diff carries a
    // scheme of its own, and opening that would show the index, not the file.
    const parentUri = variant.metadata.sourceUri;
    if (!parentId || !parentUri) { return; }

    const group = variantTab.group;
    if (hasTabForBayId(group, parentId)) { return; }

    Logger.log(`[BayHead] Opening parent for new variant: ${variant.metadata.label} → ${parentUri.fsPath}`);
    try {
      const document = await vscode.workspace.openTextDocument(parentUri);
      await vscode.window.showTextDocument(document, {
        viewColumn   : group.viewColumn,
        preview      : false,
        preserveFocus: true,
      });
    } catch (error) {
      // A remote, a permission, a deleted file: the diff stays a root row.
      Logger.warn(`[BayHead] Failed to open parent ${parentUri.fsPath}: ${error}`);
    }
  }
}

/**
 * Whether a native tab in `group` is the bay `bayId`.
 *
 * Compared by ID, not by a loose uri: a variant's parent id can derive from the
 * diff's original uri rather than its own, and eyeballing uris is exactly what
 * left variants hanging from a parent that did not exist.
 */
function hasTabForBayId(group: vscode.TabGroup, bayId: string): boolean {
  return group.tabs.some(tab => {
    const uri = nativeTabUri(tab);
    return !!uri && fileBayId(uri.toString(), group.viewColumn) === bayId;
  });
}

/** URI del archivo que respalda una tab nativa (texto, custom editor o notebook). */
function nativeTabUri(tab: vscode.Tab): vscode.Uri | undefined {
  if (tab.input instanceof vscode.TabInputText)     { return tab.input.uri; }
  if (tab.input instanceof vscode.TabInputCustom)   { return tab.input.uri; }
  if (tab.input instanceof vscode.TabInputNotebook) { return tab.input.uri; }
  return undefined;
}
