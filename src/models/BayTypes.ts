/**
 * Los vocabularios de la bay que no necesitan `vscode`.
 *
 * Viven aparte de `models/Bay.ts` porque las reglas puras de `utils/` los usan,
 * y esa carpeta no puede importar nada que arrastre el API del editor: es su
 * definición entera y lo que la mantiene testeable sin un extension host.
 * `Bay.ts` los reexporta, así que nada más se entera de la partición.
 */

/**
 * What KIND of native tab a bay wraps.
 *
 * `terminal` is a class of its own and not a webview under another name:
 * `TabInputTerminal` carries NOTHING — no uri, no viewType, not even a terminal
 * id — so it is the one input that cannot be asked anything, and everything a
 * bay does with it (matching it back to its tab, composing its id, picking its
 * icon) has to come from somewhere else. Folding it into `webview` would have
 * hidden exactly that.
 */
export type BayType = 'file' | 'webview' | 'custom' | 'notebook' | 'terminal';

/** Qué clase de comparación es una variante. */
export type DiffType =
  | 'working-tree' | 'staged' | 'snapshot' | 'commit' | 'edit'
  | 'merge-conflict' | 'incoming' | 'current' | 'incoming-current'
  | 'preview' | 'unknown';

/** Estado de git de un fichero, tal y como lo decora la vista. */
export type GitStatus =
  | 'modified' | 'added' | 'deleted' | 'untracked' | 'ignored' | 'conflict' | null;
