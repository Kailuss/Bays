/**
 * Constantes para comandos de VS Code.
 * Centraliza los strings de comandos hardcodeados.
 */

export const VSCODE_COMMANDS = {
  // Editor actions
  CLOSE_ALL_EDITORS: 'workbench.action.closeAllEditors',
  OPEN_EDITOR_AT_INDEX: 'workbench.action.openEditorAtIndex',
  /**
   * Mover el editor activo, y el ÚNICO comando que acepta a QUÉ grupo.
   *
   * Sin el prefijo `workbench.action.` a propósito: ése es su id de verdad. Las
   * órdenes con nombre del workbench —*Move Editor into First Group*, *Last*,
   * *Next*, *Previous* y las cuatro direccionales— son envoltorios que delegan
   * en él con `{to, by}` fijos.
   */
  MOVE_ACTIVE_EDITOR: 'moveActiveEditor',

  // Markdown
  MARKDOWN_SHOW_PREVIEW: 'markdown.showPreview',

  // General
  VSCODE_OPEN: 'vscode.open',
} as const;
