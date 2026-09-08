import * as vscode from 'vscode';
import type { ViewPrefs } from './ViewPrefs';
import { parseHoverDelay, parseMotion } from '../../utils/settingsRules';

/**
 * What governs the view right now.
 *
 * This lived in `constants/` and is not a constant: it READS configuration, from
 * four different sections. A folder whose membership rule is "things that do not
 * change" fills up with things that do the moment one of them is allowed in.
 */
export type BaysConfiguration = {
  showFilePath       : boolean;
  compactMode        : boolean;
  enableHoverActions : boolean;
  enableDragDrop     : boolean;
  /** `workbench.hover.delay`, read rather than duplicated. */
  hoverDelay         : number;
  /** `bays.animations` folded together with `workbench.reduceMotion`. */
  motion             : boolean;
};

/**
 * Reads the six answers, from the layer each of them lives in.
 *
 * The two keys a view control TOGGLES come from the per-project layer
 * (`ViewPrefs`), which falls back to the setting while nothing is stored; the
 * others are only ever typed into the settings UI, so they are read from there.
 * The criterion is the CONTROL: what the view toggles from a button of its own
 * is stored per project, and what is only written by hand is not.
 */
function readConfiguration(prefs: ViewPrefs): BaysConfiguration {
  const config = vscode.workspace.getConfiguration('bays');

  return {
    showFilePath       : prefs.get('showFilePath'),
    compactMode        : prefs.get('compactMode'),
    enableHoverActions : config.get('enableHoverActions', true),
    enableDragDrop     : config.get('enableDragDrop'    , true),
    hoverDelay         : parseHoverDelay(vscode.workspace.getConfiguration('workbench.hover').get('delay')),
    motion             : parseMotion(
      config.get('animations'),
      vscode.workspace.getConfiguration('workbench').get('reduceMotion'),
    ),
  };
}

/**
 * The six answers, cached until something moves them.
 *
 * `render()` asks for all of them on every pass, and a pass runs on every git
 * report. Reading them means up to five `getConfiguration` calls, each one
 * resolving scopes and building a proxy, for values that change a handful of
 * times in a session — so what is paid per render is a field read, and the
 * lookups are paid when an answer actually moves.
 *
 * Both things that move one are already listened to: a configuration change and
 * the per-project layer. Everything the extension reads through here is invalidated
 * by one of the two, so there is no third way for this to go stale.
 */
export class ViewConfiguration {
  private cached: BaysConfiguration | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly prefs: ViewPrefs) {
    this.disposables.push(
      // Not narrowed to `bays`: `workbench.hover.delay` and
      // `workbench.reduceMotion` are read here too, and a narrower filter would
      // leave the view answering with the previous value for either of them.
      vscode.workspace.onDidChangeConfiguration(() => { this.cached = undefined; }),
      prefs.onDidChange(() => { this.cached = undefined; }),
    );
  }

  current(): BaysConfiguration {
    if (!this.cached) { this.cached = readConfiguration(this.prefs); }
    return this.cached;
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
  }
}
