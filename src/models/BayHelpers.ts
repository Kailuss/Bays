import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../platform/logger';
import { tabInstanceToken } from '../platform/tabIdentity';
import { VSCODE_COMMANDS } from '../constants/commands';
import { TIMINGS } from '../constants/timings';
import { countLayoutGroups } from '../utils/editorLayout';
import type { BayMetadata, BayState, BayCapabilities, BayViewMode as BayViewMode, BayType } from './Bay';

//· --- CONSTANTES ---
const MARKDOWN_PREVIEW_PREFIX = 'Preview ';
const MARKDOWN_PREVIEW_VIEWTYPE = 'markdown.preview';
/** Esquema de los snapshots de chat: variantes cuya tab nativa es TabInputText. */
const SNAPSHOT_TEXT_SCHEME = 'chat-editing-snapshot-text-model';
const PREVIEWABLE_EXTENSIONS = [
  '.md', '.mdx', '.markdown', // Markdown
  '.html', '.htm',            // HTML
  '.svg',                     // SVG
  '.pdf',                     // PDF
  '.ipynb',                   // Jupyter notebooks
];

//· --- BAY HELPERS PRINCIPAL ---
/**
 * Utilidades auxiliares para interactuar con pestañas nativas de VS Code y para enriquecer metadata/state.
 * Métodos agrupados por responsabilidad: nativo, metadata, capacidades, estado.
 */
export class BayHelpers {
  //· --- CONSTANTES DE COMANDOS ---
  private static readonly WEBVIEW_COMMANDS: Record<string, string> = {
    'settings': 'workbench.action.openSettings',
    'keyboard shortcuts': 'workbench.action.openGlobalKeybindings',
    'welcome': 'workbench.action.showWelcomePage',
    'release notes': 'update.showCurrentReleaseNotes',
    'interactive playground': 'workbench.action.showInteractivePlayground',
  };
  private static readonly FOCUS_GROUP_CMDS: Record<number, string> = {
    1: 'workbench.action.focusFirstEditorGroup',
    2: 'workbench.action.focusSecondEditorGroup',
    3: 'workbench.action.focusThirdEditorGroup',
    4: 'workbench.action.focusFourthEditorGroup',
    5: 'workbench.action.focusFifthEditorGroup',
    6: 'workbench.action.focusSixthEditorGroup',
    7: 'workbench.action.focusSeventhEditorGroup',
    8: 'workbench.action.focusEighthEditorGroup',
  };

  //· --- SETS DE EXTENSIONES (O(1) lookup, inicializados una sola vez) ---
  private static readonly EXT_CONFIG   = new Set(['.json', '.yaml', '.yml', '.toml', '.ini', '.env']);
  private static readonly EXT_DOC      = new Set(['.md', '.txt', '.rst', '.adoc']);
  private static readonly EXT_STYLE    = new Set(['.css', '.scss', '.sass', '.less', '.styl']);
  private static readonly EXT_SCRIPT   = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.sh', '.ps1', '.bat']);
  private static readonly EXT_DATA     = new Set(['.json', '.xml', '.csv', '.sql', '.db']);
  private static readonly EXT_ASSET    = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.ttf']);
  private static readonly EXT_BINARY   = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.exe', '.dll']);
  private static readonly NAME_BUILD   = new Set(['build', 'webpack', 'rollup', 'vite', 'esbuild']);

  //- --- UTILIDADES NATIVAS (VS CODE TAB) ---
  //· --- DETECCIÓN Y ACCESO NATIVO ---
  static isMarkdownPreview(metadata: BayMetadata): boolean {
    // viewType llega prefijado (p.ej. "mainThreadWebview-markdown.preview") → inclusión
    if (metadata.viewType?.includes(MARKDOWN_PREVIEW_VIEWTYPE)) { return true; }
    if (metadata.bayType === 'webview' && metadata.label.startsWith(MARKDOWN_PREVIEW_PREFIX)) { return true; }
    return false;
  }
  static isPreviewableFile(metadata: BayMetadata): boolean {
    if (!metadata.uri || metadata.bayType !== 'file') { return false; }
    const ext = metadata.fileExtension?.toLowerCase() || '';
    return PREVIEWABLE_EXTENSIONS.includes(ext);
  }
  static async focusGroup(viewColumn: vscode.ViewColumn): Promise<void> {
    const cmd = BayHelpers.FOCUS_GROUP_CMDS[viewColumn];
    if (cmd) { await vscode.commands.executeCommand(cmd); }
  }
  /**
   * Lleva el editor ACTIVO a otro grupo. Es la única vía para reubicar una tab de
   * webview —no tiene URI que reabrir— así que quien llama tiene que activar
   * antes la tab de origen. Vale para cualquier tipo de tab.
   *
   * **Va por `moveActiveEditor`, el ÚNICO comando que acepta a qué grupo.** Fue
   * una tabla de `workbench.action.moveEditorTo<Ordinal>Group`, y de esos
   * ordinales **el workbench solo registra `First` y `Last`**: comprobado contra
   * los bundles de 1.109, 1.128 y 1.133, `…ToSecondGroup` no existe en ninguno de
   * los tres. Un comando que no existe RECHAZA, así que la excepción subía hasta
   * `moveBetweenGroups` y el movimiento se deshacía — o sea que mover una bay
   * funcionaba hacia el grupo 1 y hacia ningún otro. Un fallo ASIMÉTRICO por
   * dirección, que es lo que lo hacía tan difícil de leer: parecía un arrastre
   * roto y era un id que no existe.
   *
   * Las órdenes con nombre del workbench son envoltorios de éste con `{to, by}`
   * fijos, así que esto no rodea nada: es la misma puerta por la que ya entraban.
   *
   * `to: 'position'` con `by: 'group'` indexa `getGroups(GRID_APPEARANCE)` en
   * base 1, que es exactamente lo que numera una `ViewColumn` — la misma
   * correspondencia de la que ya vive `FOCUS_GROUP_CMDS`.
   */
  static async moveActiveEditorToGroup(viewColumn: vscode.ViewColumn): Promise<void> {
    await vscode.commands.executeCommand(VSCODE_COMMANDS.MOVE_ACTIVE_EDITOR, {
      to   : 'position',
      by   : 'group',
      value: viewColumn,
    });
  }
  /**
   * Activates a tab that has no uri to open it by: focus its group, then open
   * the editor at its index.
   *
   * **`openEditorAtIndex` acts on the window that has OS FOCUS**, not on the
   * group just focused. The workbench resolves its active group through the
   * document that has focus, so with the group in a floating window the index
   * lands in the MAIN window's group instead: clicking the second Claude chat
   * of a floating group opened whatever sat second in the main window, and
   * lit its row. Focusing the group does ask for its window, but a webview
   * pane defers that by 50 ms and the switch is a round trip through the main
   * process, so the next command reliably won the race.
   *
   * Two things close it. When the tab is already the active one of its group,
   * focusing the group IS the activation and the index is never asked for.
   * Otherwise `getEditorLayout`, which answers for that same focused window,
   * is polled until it describes a different window; the number of groups it
   * lists against the Tab API's count says whether there is another window at
   * all, so a single window pays nothing.
   */
  static async activateByNativeTab(metadata: BayMetadata, state: BayState): Promise<void> {
    const nativeTab = BayHelpers.findNativeTab(metadata, state);
    if (nativeTab) {
      const tabIndex = nativeTab.group.tabs.indexOf(nativeTab);
      if (tabIndex !== -1) {
        try {
          Logger.log(`[BayHelper] Activating by index: ${metadata.label}, column: ${state.viewColumn}, index: ${tabIndex}, isPreview: ${nativeTab.isPreview}`);
          const before = await BayHelpers.focusedWindowLayout();
          await BayHelpers.focusGroup(state.viewColumn);
          if (nativeTab.isActive) { return; }
          await BayHelpers.awaitWindowSwitch(before);
          await vscode.commands.executeCommand(VSCODE_COMMANDS.OPEN_EDITOR_AT_INDEX, tabIndex);
          if (!nativeTab.isActive) {
            Logger.warn(`[BayHelper] Index activation did not land: ${metadata.label} (column ${state.viewColumn}, index ${tabIndex})`);
          }
          return;
        } catch (err) {
          Logger.error('[BayHelper] Failed to activate by index: ' + metadata.label, err);
        }
      }
    } else {
      Logger.warn('[BayHelper] Native bay not found for activation: ' + metadata.label);
      throw new Error(`Native bay not found: ${metadata.label}`);
    }
    const label = metadata.label.toLowerCase();
    for (const [keyword, cmd] of Object.entries(BayHelpers.WEBVIEW_COMMANDS)) {
      if (label.includes(keyword)) {
        try { await vscode.commands.executeCommand(cmd); return; } catch {}
      }
    }
  }

  /** The layout of the window that has OS focus, serialized so two reads compare. */
  private static async focusedWindowLayout(): Promise<{ groups: number; key: string }> {
    const layout: unknown = await vscode.commands.executeCommand(VSCODE_COMMANDS.GET_EDITOR_LAYOUT);
    return { groups: countLayoutGroups(layout), key: JSON.stringify(layout) };
  }

  /**
   * Waits for the OS focus to reach the window of the group just focused.
   *
   * There is nothing to wait for with a single window: the layout then lists
   * every group the Tab API knows, and `openEditorAtIndex` cannot miss. With
   * more, the layout is re-read until it describes another window, and a group
   * that lived in the focused window all along runs out the timeout, which is
   * the price of not being able to ask which window a group is in.
   */
  private static async awaitWindowSwitch(before: { groups: number; key: string }): Promise<void> {
    if (before.groups >= vscode.window.tabGroups.all.length) { return; }
    const deadline = Date.now() + TIMINGS.WINDOW_FOCUS_TIMEOUT;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, TIMINGS.WINDOW_FOCUS_POLL));
      const now = await BayHelpers.focusedWindowLayout();
      if (now.key !== before.key) { return; }
    }
    Logger.log('[BayHelper] Window focus did not move within the timeout');
  }

  /**  */
  static matchesNative(t: vscode.Tab, metadata: BayMetadata): boolean {
    if (t.input instanceof vscode.TabInputWebview) {
      // El asiento primero: el `viewType` es fijo por TIPO de panel, así que dos
      // conversaciones de Claude Code lo comparten y una comparación por viewType
      // resolvía las dos bays a la MISMA tab — activar una activaba la otra y
      // cerrar una cerraba la que no era.
      if (metadata.tabInstance) { return tabInstanceToken(t) === metadata.tabInstance; }
      // Sin asiento, el viewType ESTABLE. Algunos paneles reescriben su título en
      // runtime (el chat de Claude Code enseña el nombre de la sesión), así que un
      // match por label se queda viejo y la bay deja de poder activarse o cerrarse.
      if (metadata.viewType && t.input.viewType === metadata.viewType) { return true; }
      return t.label === metadata.label;
    }
    if (!t.input) { return metadata.bayType === 'webview' && !metadata.uri && t.label === metadata.label; }
    if (t.input instanceof vscode.TabInputTextDiff) {
      // Match on modified URI AND original URI so two different diffs of the same
      // file (e.g. working-tree vs a Copilot edit) don't resolve to each other.
      if (!metadata.sourceBayId || metadata.uri?.toString() !== t.input.modified.toString()) { return false; }
      return metadata.originalUri ? metadata.originalUri.toString() === t.input.original.toString() : true;
    }
    // Una variante NO puede resolverse a la tab de texto de su parent (la URI
    // modificada de un diff ES el archivo). Excepción: los snapshots de chat son
    // variantes cuya propia tab es TabInputText, con esquema propio — ahí la
    // comparación de URIs ya es inequívoca y bloquearla dejaba la fila muerta
    // (ni se activa ni se cierra).
    if (metadata.sourceBayId && metadata.uri?.scheme !== SNAPSHOT_TEXT_SCHEME) { return false; }
    const uri = metadata.uri;
    if (!uri) { return false; }
    if (t.input instanceof vscode.TabInputText) { return t.input.uri.toString() === uri.toString(); }
    if (t.input instanceof vscode.TabInputCustom) { return t.input.uri.toString() === uri.toString(); }
    if (t.input instanceof vscode.TabInputNotebook) { return t.input.uri.toString() === uri.toString(); }
    return false;
  }
  static findNativeTab(metadata: BayMetadata, state: BayState): vscode.Tab | undefined {
    const group = BayHelpers.nativeGroup(state.viewColumn);
    return group?.tabs.find(t => BayHelpers.matchesNative(t, metadata));
  }
  static nativeGroup(viewColumn: vscode.ViewColumn): vscode.TabGroup | undefined {
    return vscode.window.tabGroups.all.find(g => g.viewColumn === viewColumn);
  }

  //· --- METADATA Y STATE HELPERS ---
  static enrichMetadata(metadata: BayMetadata): BayMetadata {
    const enriched = { ...metadata };
    if (metadata.uri) {
      const uri = metadata.uri;
      const fsPath = uri.fsPath;
      enriched.fileName = path.basename(fsPath);
      const ext = path.extname(fsPath);
      enriched.baseName = ext ? path.basename(fsPath, ext) : path.basename(fsPath);
      enriched.dirPath = path.dirname(fsPath);
      enriched.scheme = uri.scheme;
      enriched.isRemote = uri.scheme !== 'file' && uri.scheme !== 'untitled';
      enriched.isUntitled = uri.scheme === 'untitled';
      enriched.isBinary = BayHelpers.EXT_BINARY.has(metadata.fileExtension.toLowerCase());
      enriched.category = BayHelpers.categorizeFile(metadata.fileName || metadata.label, metadata.fileExtension, metadata.dirPath);
    } else {
      enriched.fileName = undefined;
      enriched.baseName = undefined;
      enriched.dirPath = undefined;
      enriched.scheme = undefined;
      enriched.isRemote = false;
      enriched.isUntitled = false;
      enriched.isBinary = false;
      enriched.category = BayHelpers.categorizeNonFileTab(metadata.bayType, metadata.label);
    }
    return enriched;
  }

  private static categorizeFile(fileName: string, ext: string, dirPath?: string): string {
    const name = fileName.toLowerCase();
    const dir = dirPath?.toLowerCase() || '';
    const extension = ext.toLowerCase();
    if (name.includes('config') || name.includes('settings') || BayHelpers.EXT_CONFIG.has(extension) || (name.startsWith('.') && !extension)) { return 'config'; }
    if (name.includes('test') || name.includes('spec') || dir.includes('test') || dir.includes('__tests__')) { return 'test'; }
    if (BayHelpers.EXT_DOC.has(extension) || name === 'readme' || name === 'license') { return 'doc'; }
    if (BayHelpers.EXT_STYLE.has(extension)) { return 'style'; }
    if (BayHelpers.EXT_SCRIPT.has(extension)) { return dir.includes('script') ? 'script' : 'component'; }
    if (BayHelpers.EXT_DATA.has(extension)) { return 'data'; }
    if ([...BayHelpers.NAME_BUILD].some(kw => name.includes(kw))) { return 'build'; }
    if (BayHelpers.EXT_ASSET.has(extension)) { return 'asset'; }
    return 'file';
  }
  private static categorizeNonFileTab(bayType: BayType, label: string): string {
    if (bayType === 'webview') {
      const lower = label.toLowerCase();
      if (lower.includes('settings')) { return 'settings'; }
      if (lower.includes('extension')) { return 'extensions'; }
      if (lower.includes('welcome')) { return 'welcome'; }
      if (lower.includes('output')) { return 'output'; }
      return 'webview';
    }
    if (bayType === 'notebook') { return 'notebook'; }
    return 'file';
  }

  //= --- CAPABILITIES Y STATE ---
  static computeCapabilities(metadata: BayMetadata, state: Partial<BayState>): BayCapabilities {
    const hasUri = !!metadata.uri;
    const isFile = metadata.bayType === 'file';
    const isDiff = !!metadata.sourceBayId;
    const ext = metadata.fileExtension.toLowerCase();
    const supportsPreview = ['.md', '.svg', '.html', '.htm'].includes(ext);
    return {
      canClose: true,
      canPin: !state.isPinned && !isDiff,
      canRevealInExplorer: hasUri && metadata.scheme === 'file',
      canTogglePreview: supportsPreview && hasUri,
      canHaveChildren: isFile && hasUri,
    };
  }

  static createDefaultState(): Partial<BayState> {
    return {
      viewMode: 'source',
      capabilities: BayHelpers.createEmptyCapabilities(),
      isLoading: false,
      hasError: false,
      errorMessage: undefined,
      isHighlighted: false,
      lastAccessTime: Date.now(),
      syncVersion: 0,
      gitStatus: null,
      diagnosticSeverity: null,
      isTransient: false,
      isProtected: false,
      integrations: {
        copilot: { inContext: false },
        git: { hasUncommittedChanges: false },
      },
    };
  }

  private static createEmptyCapabilities(): BayCapabilities {
    return {
      canClose: false,
      canPin: false,
      canRevealInExplorer: false,
      canTogglePreview: false,
      canHaveChildren: false,
    };
  }

  // --- MAPEO DE MODOS ---
  static mapPreviewModeToViewMode(previewMode: boolean): BayViewMode {
    return previewMode ? 'preview' : 'source';
  }
  static mapViewModeToPreviewMode(viewMode: BayViewMode): boolean {
    return viewMode === 'preview';
  }
}
