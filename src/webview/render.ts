// La reconciliación de la lista, por CLAVE.
//
// Sustituye a reasignar `webview.html`, que era como se pintaba cualquier cambio
// estructural: abrir una pestaña, cerrarla, fijarla. Aquello destruía el
// documento entero y con él el scroll, el foco, los grupos plegados, el bundle
// del cliente, las hojas de estilo y el `@font-face` del tema en base64, y cada
// una de esas pérdidas costaba después su propia restauración.
//
// Aquí un bloque cuya FIRMA no ha cambiado no se toca. Ese "no se toca" es toda
// la ganancia: lo que conserva es el foco del teclado, la clase de plegado y
// cualquier animación en curso. Y es el caso corriente, porque el render llega
// con cada reporte de git.
//
// QUÉ se hace con cada bloque lo decide `utils/renderPlan.ts`, que es puro y
// tiene tests. Aquí solo queda el paseo por el DOM.
//
// El paseo es por SECCIONES y no por una lista plana: las filas de un grupo van
// dentro de su propia caja (`.group-rows`), que es lo que el plegado anima. Así
// que hay un cursor por caja en vez de uno solo para `#bays`, y el plan —que
// sigue siendo una lista de claves en orden— se lee por clave en vez de
// recorrerse. Lo que decide QUÉ hacer con cada bloque no ha cambiado; lo que
// cambia es DÓNDE va.

import type { GroupSection } from '../shared/protocol';
import { planRender, itemsToPaint, EMPTY_KEY } from '../utils/renderPlan';
import type { KeyedItem } from '../utils/renderPlan';
import { buildBayBlock, buildEmpty, buildGroupHeader, buildGroupRows, setIconDictionary } from './rows';
import type { RowLayout } from './rows';

/** La firma de lo que hay pintado, por clave. Es lo que el plan compara. */
const paintedSignature = new Map<string, string>();
/** El elemento de cada clave. */
const paintedEl = new Map<string, HTMLElement>();
/**
 * La caja de filas de cada sección, por su clave.
 *
 * Va aparte de `paintedEl` porque no es un bloque: no tiene firma que comparar
 * —lo que dibuja son sus hijos— así que no entra en el plan y se reapta contra
 * las secciones que llegan. Conservarla entre renders es lo que hace que un
 * grupo plegado siga plegado cuando cambia una de sus filas.
 */
const paintedRows = new Map<string, HTMLElement>();

/** Dónde va la lista. Lo declara el shell y no cambia nunca. */
function container(): HTMLElement | null {
  return document.getElementById('bays');
}

/** Lo que hace falta para construir un bloque, si toca construirlo. */
type Buildable = KeyedItem & { build: () => HTMLElement };

/**
 * De qué grupo es una sección.
 *
 * Se le pregunta a la cabecera cuando la hay, y a su primera bay cuando no: con
 * un solo grupo el host no manda cabecera —no hay nada de lo que distinguirlo—
 * y la caja se dibuja igual, así que la lista tiene una sola forma.
 */
function groupIdOf(section: GroupSection): number {
  return section.header?.id ?? section.bays[0]?.groupId ?? 0;
}

/** La caja de filas a la que pertenece una sección. */
function rowsKey(section: GroupSection): string {
  return `rows:${groupIdOf(section)}`;
}

/**
 * Los bloques de una lista, cada uno con su firma y con cómo se construiría.
 *
 * El constructor va como CALLBACK y no como un elemento ya hecho: la mayoría de
 * los bloques de un render no cambian, y construirlos todos para tirar los que
 * se dejan en paz sería pagar el DOM entero en cada reporte de git.
 */
function buildables(sections: GroupSection[], layout: RowLayout): Buildable[] {
  const out: Buildable[] = [];

  for (const section of sections) {
    const header = section.header;
    if (header) {
      out.push({
        key      : `group:${header.id}`,
        signature: JSON.stringify(header),
        build    : () => buildGroupHeader(header),
      });
    }
    for (const bay of section.bays) {
      out.push({
        key      : `bay:${bay.id}`,
        // La firma lleva los dos ajustes de disposición además del modelo: los
        // dos cambian lo que la fila dibuja sin cambiar nada de la bay, y sin
        // ellos un cambio del modo compacto dejaría los bloques intactos.
        // The group's COLOUR is no longer in it: a block stopped drawing with it
        // when the stripe down its left edge went, so a recolour rebuilt every
        // row of the group to produce the same markup.
        signature: JSON.stringify([bay, layout]),
        build    : () => buildBayBlock(bay, layout),
      });
    }
  }

  return out;
}

/**
 * Un padre y por dónde va su recorrido.
 *
 * Uno por caja: la raíz lleva cabeceras y cajas, y cada caja lleva sus bloques.
 * El cursor apunta al nodo que DEBERÍA ocupar la posición siguiente, así que
 * colocar es o avanzarlo —el nodo ya está donde toca— o insertar delante de él.
 */
type Slot = { parent: HTMLElement; cursor: ChildNode | null };

function openSlot(parent: HTMLElement): Slot {
  return { parent, cursor: parent.firstChild };
}

/**
 * Coloca un nodo donde toca y avanza el cursor. Contesta si hubo que MOVERLO.
 *
 * Solo se mueve el que no está ya en su sitio: un `insertBefore` sobre un nodo
 * que ya ocupa esa posición lo desconecta y lo vuelve a conectar, y eso se lleva
 * por delante el foco que tuviera dentro.
 */
function place(slot: Slot, el: HTMLElement): boolean {
  if (slot.cursor === el) {
    slot.cursor = el.nextSibling;
    return false;
  }
  slot.parent.insertBefore(el, slot.cursor);
  return true;
}

/** Los restos de un render anterior que el plan no nombra. */
function sweep(slot: Slot): boolean {
  let removed = false;
  while (slot.cursor) {
    const next = slot.cursor.nextSibling;
    slot.cursor.remove();
    slot.cursor = next;
    removed = true;
  }
  return removed;
}

/**
 * What a render leaves behind.
 *
 * `touched` is read by whoever has to re-apply what lives ONLY in the DOM (a
 * group's fold), so that pass is not paid for when nothing has changed.
 *
 * `built` is the blocks that were actually CONSTRUCTED. Path fitting asks for
 * it, because it only has to measure what is new: a block left alone is already
 * cut to the width it still has. It is said here because here is where it is
 * known — asked of the document instead, the answer is "something changed,
 * somewhere", and with that there is no choice but to re-measure everything.
 */
export type RenderResult = { touched: boolean; built: HTMLElement[] };

/** Applies the list. */
export function applyRender(
  sections: GroupSection[],
  icons: Record<string, string>,
  layout: RowLayout,
): RenderResult {
  const built: HTMLElement[] = [];
  const root = container();
  if (!root) { return { touched: false, built }; }

  // El diccionario se pone ANTES de construir nada: es de donde cada fila saca
  // el markup de su icono.
  setIconDictionary(icons);

  const items   = buildables(sections, layout);
  const wanted  = itemsToPaint(items);
  const plan    = planRender(paintedSignature, wanted);
  const byKey   = new Map(wanted.map(item => [item.key, item]));
  const buildOf = new Map(items.map(item => [item.key, item.build]));
  const opOf    = new Map(plan.actions.map(action => [action.key, action.op]));

  let touched = false;

  // Lo que ya no está se va primero: así el recorrido de abajo solo inserta y
  // mueve, y no queda nada en `root` que la lista nueva no lleve.
  for (const key of plan.remove) {
    paintedEl.get(key)?.remove();
    paintedEl.delete(key);
    paintedSignature.delete(key);
    touched = true;
  }

  // Y con ellos las CAJAS de las secciones que ya no hay. No están en el plan
  // —no son bloques con firma— así que se reaptan contra las secciones que
  // llegan, y antes del recorrido: una que sobrara seguiría en `#bays`
  // estorbando al cursor de la raíz.
  const live = new Set(sections.map(rowsKey));
  for (const [key, el] of paintedRows) {
    if (live.has(key)) { continue; }
    el.remove();
    paintedRows.delete(key);
    touched = true;
  }

  /** Pone el bloque de una clave donde toca, construyéndolo si hace falta. */
  const ensure = (key: string, slot: Slot): void => {
    const item = byKey.get(key);
    if (!item) { return; }

    let el = paintedEl.get(key);

    if (opOf.get(key) !== 'keep' || !el) {
      const build = buildOf.get(key);
      const fresh = build ? build() : buildEmpty();

      // El nodo viejo se va ANTES de colocar el nuevo, y el cursor con él: puede
      // estar apuntando justo a él, y un `insertBefore` contra un nodo que ya no
      // es hijo lanza NotFoundError.
      if (el) {
        if (slot.cursor === el) { slot.cursor = el.nextSibling; }
        el.remove();
      }

      el = fresh;
      paintedEl.set(key, el);
      paintedSignature.set(key, item.signature);
      built.push(el);
      touched = true;
    }

    if (place(slot, el)) { touched = true; }
  };

  const rootSlot = openSlot(root);

  if (byKey.has(EMPTY_KEY)) {
    // La lista vacía va suelta en la raíz: no es de ningún grupo, y una caja
    // alrededor sería una sección que no existe.
    ensure(EMPTY_KEY, rootSlot);
  } else {
    for (const section of sections) {
      if (section.header) { ensure(`group:${section.header.id}`, rootSlot); }

      const key = rowsKey(section);
      let rows  = paintedRows.get(key);
      if (!rows) {
        rows = buildGroupRows(groupIdOf(section));
        paintedRows.set(key, rows);
        touched = true;
      }
      if (place(rootSlot, rows)) { touched = true; }

      const rowsSlot = openSlot(rows);
      for (const bay of section.bays) { ensure(`bay:${bay.id}`, rowsSlot); }
      if (sweep(rowsSlot)) { touched = true; }
    }
  }

  if (sweep(rootSlot)) { touched = true; }

  return { touched, built };
}
