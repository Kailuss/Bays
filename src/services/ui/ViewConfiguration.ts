import * as vscode from 'vscode';
import type { ViewPrefs } from './ViewPrefs';
import {
  answeredFlag,
  parseHoverDelay,
  parseMotion,
  parsePathSeparator,
  resolveTwinSetting,
} from '../../utils/settingsRules';
import { extensionPresent, writtenValue } from '../../platform/twinSettings';
import type { PathSeparator } from '../../shared/protocol';

/** Atria's id, which is the one thing a twin setting asks about its owner. */
const ATRIA = 'Lovervoid.atria';

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
  /** The sign a row's path is written with, out of the two keys that ask it. */
  pathSeparator      : PathSeparator;
};

/**
 * Whether the view MOVES, out of the two keys that ask it.
 *
 * One question with two prefixes — `bays.animations` here and
 * `navigator.animations` there — and whether something moves is PRESENTATION,
 * which is Atria's half of the house rule, so where it is installed its key is
 * the one that governs (see the guide, *Lo que se comparte con Atria*).
 *
 * `workbench.reduceMotion` is NOT part of the twin: it belongs to neither
 * extension and is the second input of one answer, which is why it is folded in
 * afterwards by `parseMotion`.
 */
function animations(config: vscode.WorkspaceConfiguration): unknown {
  const owner = extensionPresent(ATRIA)
    ? answeredFlag(writtenValue('navigator.animations'))
    : undefined;
  const own = answeredFlag(writtenValue('bays.animations'));
  // Back to the raw shape `parseMotion` takes, so the default stays stated in
  // one place: `undefined` is nobody having answered, which is what a key that
  // was never written already means to it.
  return resolveTwinSetting({ own, owner }).value ?? config.get('animations');
}

/**
 * The sign between two folder names, out of the two keys that ask it.
 *
 * Atria owns it for the same reason, and its vocabulary covers this view's own
 * look: the chevron this extension has always drawn is one of the four that key
 * takes, which is why yielding costs nothing. While nobody has answered either
 * key, this view's own default is what paints — so the rows look exactly as they
 * did, Atria installed or not.
 */
function separator(): PathSeparator {
  // Each side composed only where its CHARACTER was written. The spacing is a
  // second key and cannot stand on its own: a spacing with no sign to space is
  // not an answer to which sign is used, so it never carries a side.
  const ownSign = writtenValue('bays.paths.separator');
  const own = ownSign === undefined
    ? undefined
    : parsePathSeparator(ownSign, writtenValue('bays.paths.separatorSpaced') ?? true);

  const ownerSign = extensionPresent(ATRIA) ? writtenValue('navigator.paths.separator') : undefined;
  const owner = ownerSign === undefined
    ? undefined
    : parsePathSeparator(ownerSign, writtenValue('navigator.paths.separatorSpaced'));

  // Nobody has answered either: this view's own default, which is what it has
  // always drawn.
  return resolveTwinSetting({ own, owner }).value ?? ' › ';
}

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
      animations(config),
      vscode.workspace.getConfiguration('workbench').get('reduceMotion'),
    ),
    pathSeparator      : separator(),
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
      // Two of these answers are TWINS, and which side governs depends on
      // whether Atria is installed — which installing or disabling it moves
      // without reloading the window and without a configuration event.
      vscode.extensions.onDidChange(() => { this.cached = undefined; }),
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
