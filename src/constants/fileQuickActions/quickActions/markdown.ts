import * as vscode from 'vscode';
import { VSCODE_COMMANDS } from '../../commands';
import type { DynamicFileQuickAction } from '../types';
import { byExtension } from '../matchers';

/**
 * Markdown: opens the rendered preview.
 *
 * The preview is a real VARIANT of the bay (a child row with its own tab), so
 * there is no toggle here: this button only CREATES the preview, and the builder
 * hides it once the bay has a preview variant. The preview tab takes the focus
 * itself (`setFocus: false` - the source is not reactivated afterwards).
 *
 * The source is brought to the FOREGROUND first, and that is the law and not a
 * nicety: a child bay is born in its parent's group. `markdown.showPreview`
 * takes no column and reads one off `window.activeTextEditor`, so pressed from a
 * bay that was not the one in front, the preview landed wherever the focus
 * happened to be - drawn as an orphan row under a foreign header, with the .md
 * still offering the button because the variant never reached it.
 *
 * Focusing the GROUP is not enough: with a webview in front of it there is no
 * active text editor to read a column from, and the command falls back to column
 * one. What has to be in front is the source EDITOR.
 */
export const MARKDOWN_TOGGLE_ACTION: DynamicFileQuickAction = {
  id: 'toggleMarkdownPreview',
  setFocus: false,
  match: byExtension('.md', '.mdx', '.markdown'),
  resolve: () => ({
    icon: 'preview',
    tooltip: 'Open Preview',
    actionId: 'openMarkdownPreview',
  }),
  execute: async (uri, context) => {
    if (context?.viewColumn !== undefined) {
      // `preview` is left out on purpose: showing a tab that is already open
      // keeps whatever it is, so an italic tab stays italic and a permanent one
      // stays permanent. Naming it would convert the source as a side effect of
      // asking for its preview.
      await vscode.window.showTextDocument(uri, {
        viewColumn    : context.viewColumn,
        preserveFocus : false,
      });
    }
    await vscode.commands.executeCommand(VSCODE_COMMANDS.MARKDOWN_SHOW_PREVIEW, uri);
  },
};
