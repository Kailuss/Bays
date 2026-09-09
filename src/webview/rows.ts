// El markup de la lista, construido AQUÍ.
//
// El host manda datos (`GroupSection`, `BayView`, `VariantView`) y este módulo
// decide cómo se dibujan. Antes componía el host las cadenas de HTML y el
// cliente las pegaba, así que la forma de una fila vivía en dos sitios: cambiar
// un tooltip, una clase de animación o una cadena localizada obligaba a tocar la
// capa de servicios del extension host.
//
// Se construye con `document.createElement` y nunca con `innerHTML`, así que no
// hay ningún `esc()` que recordar: un nombre de fichero con `<` es texto porque
// entra por `textContent`. La ÚNICA excepción son los iconos, que llegan como
// HTML deduplicado por clave — es markup que compone el host a partir del tema
// de iconos, y pasa por la lista blanca de `utils/iconHtml.ts`.

import type { BayView, GroupView, VariantView } from '../shared/protocol';
import { BAY_STATES } from '../shared/bayState';
import { ICONS } from '../shared/icons';
import { setTip, setOverflowTip } from './tooltip';
import { setPathParts } from './pathTruncation';
import { t } from './l10n';

/** Los iconos del render actual: clave → HTML. */
let iconDictionary: Record<string, string> = {};

export function setIconDictionary(icons: Record<string, string>): void {
  iconDictionary = icons;
}

/** Cómo se dibuja la lista: lo dicen los dos ajustes que la vista conmuta. */
export type RowLayout = { compact: boolean; showPath: boolean };

//= PIEZAS

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) { node.className = className; }
  return node;
}

/** Un codicon suelto. El nombre sale de `shared/icons.ts`, que el build fija. */
function glyph(name: string): HTMLSpanElement {
  return el('span', `codicon codicon-${name}`);
}

/** Un botón de acción de fila: su glifo, su tooltip y a qué bay apunta. */
function actionButton(action: string, bayId: string, icon: string, label: string): HTMLButtonElement {
  const button = el('button');
  button.dataset.action = action;
  button.dataset.bayId  = bayId;
  // El nombre accesible va en `aria-label` y lo que se lee al sobrevolarlo en
  // `data-tip`: son dos lectores distintos, y un `title` intentaría servir a los
  // dos con el tooltip del sistema.
  button.setAttribute('aria-label', label);
  setTip(button, label);
  button.appendChild(glyph(icon));
  return button;
}

/**
 * El icono de una fila.
 *
 * Es lo único de aquí que entra por `innerHTML`, y solo porque el markup de un
 * icono lo compone el host: puede ser un `<img>` con un `data:` URI del tema, un
 * glifo de su fuente o un SVG de reserva. Lo que impide que eso sea una puerta
 * es que cada valor interpolado pasa por la lista blanca de `utils/iconHtml.ts`.
 */
function iconSlot(key: string): HTMLSpanElement {
  const slot = el('span', 'bay-icon');
  slot.innerHTML = iconDictionary[key] ?? '';
  return slot;
}

/** La marca de estado de una fila, o la ranura vacía que la reserva. */
export function stateSlot(state: BayView['state']): HTMLSpanElement {
  if (!state) { return el('span', 'bay-state clean'); }

  const { icon, title } = BAY_STATES[state];
  const slot = el('span', `bay-state state-${state}`);
  setTip(slot, t(title));
  slot.appendChild(glyph(icon));
  return slot;
}

/** La clase con la que el nombre se tiñe. */
export function nameClassFor(state: BayView['state']): string {
  return state ? ` ${BAY_STATES[state].nameClass}` : '';
}

//= LAS FILAS

function buildBayRow(bay: BayView, layout: RowLayout): HTMLDivElement {
  const row = el('div', `bay${layout.compact ? ' compact' : ''}${bay.active ? ' active' : ''}`);
  row.dataset.bayId = bay.id;
  // La ruta entera, y SOLO cuando el nombre no cabe: con el nombre a la vista el
  // tip no diría nada que la fila no diga ya, y una caja saliendo sobre cada fila
  // por la que pasa el puntero es ruido y no ayuda.
  setOverflowTip(row, bay.tooltip, '.bay-name');

  row.appendChild(iconSlot(bay.iconKey));

  const text = el('div', 'bay-text');

  const name = el('div', `bay-name${nameClassFor(bay.state)}`);
  name.appendChild(document.createTextNode(bay.label));
  if (bay.pinned) {
    const badge = el('span', `pin-badge codicon codicon-${ICONS.row.pinned}`);
    setTip(badge, t('Pinned'));
    name.appendChild(badge);
  }
  text.appendChild(name);

  // The path goes in a node of its own, and its segments are HANDED to the
  // fitting pass (`pathTruncation.ts`), which needs them to cut from the left.
  // Handed, not written out as JSON on an attribute for it to parse back: that
  // is a round trip through a string to recover an array already in hand.
  if (bay.detail) {
    const path = el('div', layout.compact ? 'bay-path-inline' : 'bay-path');
    setPathParts(path, bay.pathParts ?? []);
    path.textContent = bay.detail;
    text.appendChild(path);
  }
  row.appendChild(text);
  row.appendChild(stateSlot(bay.state));

  const actions = el('span', 'bay-actions');
  if (bay.quickAction) {
    const button = actionButton('fileAction', bay.id, bay.quickAction.icon, bay.quickAction.tooltip);
    button.dataset.actionid = bay.quickAction.actionId;
    actions.appendChild(button);
  }
  if (bay.canChat)  { actions.appendChild(actionButton('addToChat', bay.id, ICONS.row.chat, t('Add to Copilot Chat'))); }
  if (bay.canClose) { actions.appendChild(actionButton('closeBay',  bay.id, ICONS.row.close, t('Close'))); }
  attachActions(row, actions);

  return row;
}

/**
 * Hangs the band of orders off a row, and tells the row how wide it is.
 *
 * The band is out of flow, so the row cannot learn its width from the layout:
 * what opens the room under the pointer is the row's own `padding-right`, and
 * that number is the COUNT of buttons times one band width. Unlike a pinned row
 * in Atria — one button, one width, no slots to count — a bay carries between
 * zero and three, so the count is written here and read back by the stylesheet.
 *
 * An EMPTY band is not appended at all: a row with no orders must not open a
 * padding for buttons that are not coming, and `.bay:has(.bay-actions)` is what
 * says so.
 */
function attachActions(row: HTMLElement, actions: HTMLElement): void {
  if (actions.childElementCount === 0) { return; }
  row.style.setProperty('--bay-actions', String(actions.childElementCount));
  row.appendChild(actions);
}

function buildVariantRow(variant: VariantView): HTMLDivElement {
  const classes = ['bay', 'variant'];
  if (variant.active) { classes.push('active'); }
  if (variant.diffClass) { classes.push(variant.diffClass); }

  const row = el('div', classes.join(' '));
  row.dataset.bayId = variant.id;
  setTip(row, variant.tooltip);

  const icon = el('span', 'bay-icon');
  icon.appendChild(glyph(variant.icon));
  row.appendChild(icon);

  const label = el('span', 'variant-label');
  label.textContent = variant.label;
  row.appendChild(label);

  if (variant.stats) {
    const stats = el('span', `variant-stats${variant.stats.conflict ? ' conflict' : ''}`);
    setTip(stats, variant.stats.tooltip);
    if (variant.stats.counts) {
      // Two spans and not one string: each number takes the colour the theme
      // gives added and removed lines, the same pair a row's git state wears.
      const added = el('span', 'stats-added');
      added.textContent = `+${variant.stats.counts.added}`;
      const removed = el('span', 'stats-removed');
      removed.textContent = `-${variant.stats.counts.removed}`;
      stats.append(added, removed);
    } else {
      stats.textContent = variant.stats.text ?? '';
    }
    row.appendChild(stats);
  }

  const actions = el('span', 'bay-actions');
  if (variant.canClose) {
    actions.appendChild(actionButton('closeVariant', variant.id, ICONS.row.closeVariant, t('Close variant')));
  }
  attachActions(row, actions);

  return row;
}

/**
 * A bay's block: the unit of drag and drop, with the row and its variants in it.
 *
 * It no longer carries its group's colour. That colour was written here so every
 * row could wear a stripe down its left edge; the hue lives on the header alone
 * now, and an attribute nothing reads is a fact in the DOM that the next reader
 * would take for one that means something.
 */
export function buildBayBlock(bay: BayView, layout: RowLayout): HTMLDivElement {
  const block = el('div', 'bay-block');
  block.dataset.bayId  = bay.id;
  block.dataset.pinned = String(bay.pinned);
  block.dataset.groupid = String(bay.groupId);

  if (bay.unmovable) { block.dataset.unmovable = 'true'; }
  if (bay.variants.length > 0) { block.classList.add('has-children'); }
  block.appendChild(buildBayRow(bay, layout));

  for (const variant of bay.variants) {
    block.appendChild(buildVariantRow(variant));
  }

  return block;
}

export function buildGroupHeader(group: GroupView): HTMLDivElement {
  // `.current` is the group holding the focused tab. It is a class and not a
  // colour on the name, because a name says WHICH group and this says which one
  // is being worked in — two facts, and one of them has to be the strength the
  // other is written at.
  const header = el('div', `group-header${group.active ? ' current' : ''}`);
  // A TAB STOP, and it has to be one: the three orders are hidden with
  // `visibility` so they are not stops of their own while unseen, which is what
  // keeps the route from landing on a button nobody can see. Focus lands on the
  // header, the band comes into view, and the next Tab has somewhere to go.
  // It is also the keyboard's route to the fold — Enter on the header collapses
  // it, the same thing a click anywhere on it does.
  header.tabIndex = 0;
  header.dataset.groupid = String(group.id);
  header.dataset.color   = group.color;
  header.dataset.locked  = String(group.locked);

  // What the group IS, ahead of its name: the two together are what names the
  // group at a glance. It is not a control and takes no hover; what reports the
  // fold is the chevron at the far end of the line.
  const mark = glyph(ICONS.group.mark);
  mark.classList.add('group-mark');
  header.appendChild(mark);

  const label = el('span', 'group-label');
  label.textContent = group.label;
  header.appendChild(label);

  const actions = el('span', 'group-actions');
  actions.appendChild(groupButton(group.id, 'renameGroup', ICONS.group.rename, t('Rename Group')));
  actions.appendChild(groupButton(group.id, 'setGroupColor', ICONS.group.color, t('Set Color')));

  // El candado refleja el estado además de alternarlo: bloqueado, el botón se
  // queda visible sin hover (ver group-header.css) y es el único indicio de por
  // qué a las bays de este grupo les falta la X.
  const lock = groupButton(
    group.id, 'toggleGroupLock',
    group.locked ? ICONS.group.locked : ICONS.group.unlocked,
    group.locked ? t('Unlock Group') : t('Lock Group'),
  );
  lock.classList.add('group-lock-btn');
  actions.appendChild(lock);

  header.appendChild(actions);

  // The fold CLOSES the line, full bleed against the card's right rim — the same
  // place a repo card puts it. It is last of the run so it takes the rounded
  // corner the header clips with, and it is the one control here drawn at all
  // times: it reports a STATE, and a folded header whose fold only appeared
  // under the pointer would be a header whose rows vanished with nothing saying
  // why.
  const fold = el('button', 'group-fold');
  fold.dataset.action = 'toggleGroup';
  fold.dataset.groupid = String(group.id);
  // El nombre accesible y el hover se escriben de la MISMA cadena, que es lo que
  // impide que se separen: los dos dicen que hace pulsarlo.
  const foldName = t('Collapse or Expand');
  fold.setAttribute('aria-label', foldName);
  setTip(fold, foldName);
  fold.appendChild(glyph(ICONS.group.foldExpanded));
  header.appendChild(fold);

  return header;
}

/**
 * La caja en la que van las filas de un grupo, detrás de su cabecera.
 *
 * Existe por UNA cosa: el plegado. La lista es plana —una bay es hermana de la
 * cabecera y no hija suya— así que sin ella no hay ninguna caja cuyo alto animar,
 * y animar cada bloque por su cuenta da un acordeón (cada fila recortada por su
 * mitad) en vez de un plegado, que recorta el grupo entero desde abajo.
 *
 * Y de propina se lleva dos cosas que había que componer a mano: el plegado deja
 * de escribirse fila a fila —es una clase en la caja, así que un bloque que
 * nazca dentro de un grupo plegado nace escondido— y "la última fila de un
 * grupo" pasa a ser `:last-child`, donde antes era la que tenía una cabecera
 * detrás.
 *
 * Sin cabecera también la lleva: con un solo grupo no hay nada que plegar, pero
 * una lista cuya forma dependa de eso sería una segunda forma que mantener.
 */
export function buildGroupRows(groupId: number): HTMLDivElement {
  const rows = el('div', 'group-rows');
  rows.dataset.groupid = String(groupId);
  return rows;
}

function groupButton(groupId: number, action: string, icon: string, label: string): HTMLButtonElement {
  const button = el('button', 'group-btn');
  button.dataset.action  = action;
  button.dataset.groupid = String(groupId);
  button.setAttribute('aria-label', label);
  setTip(button, label);
  button.appendChild(glyph(icon));
  return button;
}

/** La fila que se dibuja cuando no hay ninguna bay abierta. */
export function buildEmpty(): HTMLDivElement {
  const empty = el('div', 'empty');
  empty.textContent = t('No open bays');
  return empty;
}
