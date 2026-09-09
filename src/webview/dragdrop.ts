// Drag & Drop del webview de bays.
// Solo se inicializa (initDragDrop) cuando enableDragDrop está activo en
// settings — el host lo publica en <body data-enable-dragdrop>.
//
// Unit de arrastre: .bay-block (contiene la bay parent + sus child bays).
// Un cloneNode(true) del bloque captura todo el contenido de una vez,
// sin necesidad de gestionar clones hijos por separado.

import { vscode } from './vscodeApi';
import type { DropBayMessage } from '../shared/protocol';

const DRAG_THRESHOLD = 5;   // Pixels antes de iniciar el drag

type GroupRegion = {
  groupId : string;
  top     : number;
  bottom  : number;
  /** Donde EMPIEZA de verdad el grupo, antes de ensanchar la banda. */
  anchor  : number;
  headerEl: HTMLElement | null;
};
type SiblingSlot = { el: HTMLElement; origTop: number; height: number };

let isDragging         = false;

/**
 * Si hay un arrastre en curso.
 *
 * Lo mira el render: reconciliar a mitad de gesto sustituye justo los nodos
 * contra los que el arrastre está midiendo, y la respuesta visual que el cliente
 * acaba de dar se deshace bajo la mano. Lo que llegue se pinta al soltar.
 */
export function dragInFlight(): boolean {
  return isDragging;
}

/**
 * Quién quiere enterarse de que el gesto ha terminado.
 *
 * Va como suscripción y no como un import de vuelta a `interactions.ts`: aquel
 * módulo ya importa éste, así que llamarlo desde aquí cerraría el ciclo. El
 * único oyente de hoy es el render aplazado.
 */
const dragEndListeners: (() => void)[] = [];

export function onDragEnd(listener: () => void): void {
  dragEndListeners.push(listener);
}
let startY             = 0;
let startMouseY        = 0;
let sourceEl: HTMLElement | null = null;  // .bay-block original que se arrastra
let cloneEl: HTMLElement | null  = null;  // clon flotante del bloque completo
let siblings: HTMLElement[] = [];         // .bay-block reordenables (excluye pinned y el arrastrado)
let originalOrder: SiblingSlot[] = [];    // rect.top y altura de cada sibling al iniciar
let currentInsertIndex = -1;    // índice de inserción actual (en siblings)
let sourceIndex        = -1;    // índice original del bloque arrastrado
let tabGroupId: string | undefined = undefined; // grupo de origen (string, del dataset)
let blockHeight        = 0;     // Alto total del bloque (parent + children automático)

// Cross-group: regiones verticales de cada grupo y grupo bajo el cursor.
let groupRegions: GroupRegion[] = [];          // al iniciar el drag
let targetGroupId: string | null = null;       // grupo actualmente bajo el cursor
let highlightedGroupId: string | null = null;  // grupo con resaltado de destino activo
let lockedSource       = false; // el grupo de origen está bloqueado (no sale nada de él)

export function initDragDrop(): void {
  // --- Mousedown: preparar un posible drag ---
  document.addEventListener('mousedown', e => {
    if (e.button !== 0) { return; }
    // Ignore a new mousedown while a previous drop is still animating/tearing down:
    // its ~160ms deferred teardown would otherwise clobber the fresh drag's state.
    if (isDragging) { return; }
    const target = e.target instanceof Element ? e.target : null;
    if (!target) { return; }
    const block = target.closest<HTMLElement>('.bay-block');
    if (!block) { return; }
    if (target.closest('button')) { return; }

    // A variant is a handle for its own BLOCK, exactly like the row above it.
    // What travels has never been a row: it is the block — a bay with its diffs
    // and previews hanging off it — so refusing the gesture on the variants left
    // most of a tall block dead to a drag that its top row answered, and the
    // only way to find that out was to try. Nothing else changes here: `block`
    // is the same `.bay-block` whichever of its rows was pressed.
    //
    // The two blocks that still refuse are below, and they refuse for what the
    // HOST would do with them: an orphan variant block and a pinned one.

    // Orphan variant blocks (a diff/preview whose parent file isn't open) render as
    // a normal .bay-block but the host rejects reordering them, so dragging would
    // just animate and snap back. Mark them data-variant and refuse to start a drag.
    if (block.dataset.variant === 'true') { return; }

    if (block.dataset.pinned === 'true') { return; }

    sourceEl    = block;
    startMouseY = e.clientY;
    startY      = block.getBoundingClientRect().top;
    tabGroupId  = block.dataset.groupid;
  });

  // --- Mousemove: iniciar o continuar el drag ---
  document.addEventListener('mousemove', e => {
    if (!sourceEl) { return; }

    if (!isDragging) {
      if (Math.abs(e.clientY - startMouseY) < DRAG_THRESHOLD) { return; }
      beginDrag();
    }
    if (!cloneEl) { return; }

    const dy = e.clientY - startMouseY;
    cloneEl.style.transform = 'translateY(' + dy + 'px)';

    // Centro del bloque clonado para determinar posición de inserción
    const cloneCenter = startY + (blockHeight / 2) + dy;

    // A qué grupo se lleva la bay lo dice el PUNTERO y no el centro del clon.
    // Los dos se separan tanto como mida el bloque: agarrado por su última
    // variante, el centro va media altura por encima de la mano, así que con un
    // bloque alto había que pasarse esa media altura por debajo de la cabecera
    // del grupo de abajo para que contara — y arrastrando hacia el último grupo
    // de la lista, esa distancia puede no existir dentro del panel. Lo que se
    // arrastra se SUELTA donde se apunta.
    //
    // El centro se queda para la reordenación local, que es otra pregunta: ahí
    // no se apunta a nada sino que se busca la RANURA en la que cabe el bloque,
    // y una ranura la decide dónde queda el bloque entero.
    const overGroup = groupAt(e.clientY);

    if (overGroup === null || overGroup === tabGroupId) {
      // Sobre el grupo de origen, o sin más grupos: reordenar in situ.
      clearTargetGroupHighlight();
      markRefused(false);
      updateSiblingPositions(cloneCenter);
      targetGroupId = tabGroupId ?? null;
    } else {
      // Sobre otro grupo: cancelar el desplazamiento local y resaltar el destino.
      clearSiblingShifts();
      targetGroupId = overGroup;

      // Un grupo BLOQUEADO no deja salir nada de él, y eso se dice mientras dura
      // el gesto en vez de callarse: el clon se atenúa y el destino no se
      // resalta, porque no lo es. Esta rama se leía antes como una reordenación
      // dentro del grupo de origen —el arrastre no decía nada en absoluto— y es
      // el rechazo ASIMÉTRICO de los cuatro: no se puede sacar una bay de un
      // grupo bloqueado y sí meterla, así que el arrastre parecía funcionar hacia
      // un lado y estar roto hacia el otro.
      //
      // Y se manda IGUAL al soltar. Quien decide la política es el HOST —es quien
      // ve el candado de verdad, y quien rechaza los otros tres motivos— así que
      // el cliente no se le adelanta: lo que hace aquí es una pista temprana, y
      // la palabra la tiene el aviso que sale al soltar. Adelantándose, el motivo
      // más común de todos era el único que nunca llegaba a decirse.
      if (lockedSource) {
        clearTargetGroupHighlight();
        markRefused(true);
      } else {
        markRefused(false);
        setTargetGroupHighlight(overGroup);
      }
    }
  });

  // --- Mouseup: terminar el drag ---
  document.addEventListener('mouseup', () => {
    if (!sourceEl) { return; }
    if (!isDragging) { sourceEl = null; return; }
    commitDrop();
  });

  // --- Cancelar si se sale de la ventana ---
  document.addEventListener('mouseleave', () => {
    if (isDragging) { cancelDrag(); }
  });
}

// ------------ helpers ------------

function beginDrag(): void {
  if (!sourceEl) { return; }
  isDragging = true;
  document.body.classList.add('drag-active');

  const rect = sourceEl.getBoundingClientRect();

  // blockHeight = alto real del bloque completo (parent + todos sus children)
  // getBoundingClientRect() ya lo calcula porque .bay-block los contiene.
  //
  // And NOTHING is added to it. Blocks sit flush — `#bays` lays them out with no
  // gap and a block carries no margin of its own — so the distance between two
  // adjacent block tops IS this height, and that is the distance every displaced
  // sibling is shifted by. The `+ 1` that used to be here was paying for a
  // border that a rect already includes, so each shifted row landed a pixel past
  // its slot: a list that settles a hair off true while the drag is still in the
  // air, which is exactly the kind of thing nothing reports.
  blockHeight = Math.round(rect.height);

  // Regiones verticales de cada grupo (para detectar arrastre entre grupos).
  // Sin cabeceras (un solo grupo visible) queda vacío ⇒ sólo reordenación local.
  groupRegions  = buildGroupRegions();
  targetGroupId = tabGroupId ?? null;

  const srcHeader = document.querySelector<HTMLElement>('.group-header[data-groupid="' + tabGroupId + '"]');
  lockedSource    = !!srcHeader && srcHeader.dataset.locked === 'true';

  // Todos los bloques arrastrables del mismo grupo (excluir pinned)
  const allBlocks      = Array.from(document.querySelectorAll<HTMLElement>('.bay-block[data-groupid="' + tabGroupId + '"]'));
  const draggable      = allBlocks.filter(b => b.dataset.pinned !== 'true');
  sourceIndex          = draggable.indexOf(sourceEl);
  currentInsertIndex   = sourceIndex;
  siblings             = draggable.filter(b => b !== sourceEl);

  // Guardar posición y alto originales de cada sibling
  originalOrder = siblings.map(b => {
    const r = b.getBoundingClientRect();
    // Same reckoning as blockHeight, and no `+ 1` for the same reason. This one
    // only decides a MIDPOINT, so a stray pixel here moves the threshold and
    // never a row — but two spellings of one height are two places to fix it.
    return { el: b, origTop: r.top, height: Math.round(r.height) };
  });

  // Clonar el bloque entero (parent + children) en una sola operación
  cloneEl = sourceEl.cloneNode(true) as HTMLElement;
  cloneEl.classList.add('drag-clone');
  cloneEl.style.top    = rect.top    + 'px';
  cloneEl.style.left   = rect.left   + 'px';
  cloneEl.style.width  = rect.width  + 'px';
  cloneEl.style.height = rect.height + 'px';   // fijar alto para que fixed no colapse
  document.body.appendChild(cloneEl);

  sourceEl.classList.add('drag-placeholder');
  siblings.forEach(b => b.classList.add('drag-shifting'));
}

function updateSiblingPositions(cloneCenter: number): void {
  let newIndex = siblings.length; // por defecto: al final

  for (let i = 0; i < originalOrder.length; i++) {
    if (cloneCenter < originalOrder[i].origTop + (originalOrder[i].height / 2)) {
      newIndex = i;
      break;
    }
  }

  if (newIndex === currentInsertIndex) { return; }
  currentInsertIndex = newIndex;

  for (let i = 0; i < originalOrder.length; i++) {
    const s           = originalOrder[i];
    const origLogical = (i < sourceIndex) ? i : i + 1;
    let   shift       = 0;

    if      (origLogical < sourceIndex && i >= currentInsertIndex) { shift =  blockHeight; }
    else if (origLogical > sourceIndex && i <  currentInsertIndex) { shift = -blockHeight; }

    s.el.style.transform = shift ? ('translateY(' + shift + 'px)') : '';
  }
}

function commitDrop(): void {
  if (!sourceEl || !cloneEl) { teardown(); return; }

  // --- Movimiento entre grupos ---
  // El host cierra la bay y la reabre en el grupo destino; eso dispara los
  // eventos nativos de tabs y provoca un rebuild completo. No hacemos un
  // movimiento de DOM en cliente: sólo animamos el clon hacia el destino como
  // puente visual y dejamos que el rebuild ponga el orden autoritativo.
  if (targetGroupId !== tabGroupId) {
    vscode.postMessage({
      type          : 'dropBay',
      sourceBayId   : sourceEl.dataset.bayId ?? '',
      targetBayId   : null,
      insertPosition: null,
      sourceGroupId : parseInt(tabGroupId ?? '', 10),
      targetGroupId : parseInt(targetGroupId ?? '', 10),
    } satisfies DropBayMessage);

    // Un grupo puede no tener cabecera —el host no la manda con uno solo
    // poblado— así que el puente visual cae en el borde de arriba del grupo, que
    // es la banda MEDIDA y nunca la ensanchada.
    const region  = groupRegions.find(r => r.groupId === targetGroupId);
    const destTop = region
      ? (region.headerEl?.getBoundingClientRect().bottom ?? region.anchor)
      : startY;
    cloneEl.style.transition = 'transform 160ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 160ms ease-out';
    cloneEl.style.transform  = 'translateY(' + (destTop - startY) + 'px) scale(0.85)';
    cloneEl.style.opacity    = '0';
    setTimeout(() => teardown(), 170);
    return;
  }

  if (currentInsertIndex !== sourceIndex) {
    let targetTabId: string | undefined, insertPosition: 'before' | 'after', refEl: HTMLElement, insertAfter: boolean;
    if (currentInsertIndex < originalOrder.length) {
      refEl          = originalOrder[currentInsertIndex].el;
      targetTabId    = refEl.dataset.bayId;
      insertPosition = 'before';
      insertAfter    = false;
    } else {
      refEl          = originalOrder[originalOrder.length - 1].el;
      targetTabId    = refEl.dataset.bayId;
      insertPosition = 'after';
      insertAfter    = true;
    }

    // El host actualiza el modelo en silencio (sin rebuild). El movimiento
    // visual lo confirma el propio cliente al terminar la animación.
    vscode.postMessage({
      type           : 'dropBay',
      sourceBayId    : sourceEl.dataset.bayId ?? '',
      targetBayId    : targetTabId ?? null,
      insertPosition : insertPosition,
      sourceGroupId  : parseInt(tabGroupId ?? '', 10),
      targetGroupId  : parseInt(tabGroupId ?? '', 10),
    } satisfies DropBayMessage);

    // Animar el clon hasta su slot como puente visual
    const finalDy = (currentInsertIndex - sourceIndex) * blockHeight;
    cloneEl.style.transition = 'transform 150ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 150ms ease-out';
    cloneEl.style.transform  = 'translateY(' + finalDy + 'px)';
    cloneEl.style.opacity    = '0';

    const movedSrc = sourceEl, movedRef = refEl, movedAfter = insertAfter;
    setTimeout(() => {
      commitDomMove(movedSrc, movedRef, movedAfter);
      teardown();
    }, 160);

  } else {
    // Sin cambio de posición — fade-out en sitio
    cloneEl.style.transition = 'transform 150ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 120ms ease-out';
    cloneEl.style.transform  = 'translateY(0)';
    cloneEl.style.opacity    = '0';
    setTimeout(() => teardown(), 160);
  }
}

// Mueve físicamente el bloque arrastrado a su nueva posición en el DOM,
// de modo que el orden sea correcto sin reconstruir todo el HTML.
function commitDomMove(src: HTMLElement, ref: HTMLElement, after: boolean): void {
  if (!src || !ref || src === ref || !ref.parentNode) { return; }
  if (after) {
    ref.parentNode.insertBefore(src, ref.nextSibling);
  } else {
    ref.parentNode.insertBefore(src, ref);
  }
}

// ------------ cross-group helpers ------------

// La banda vertical [top, bottom) que ocupa cada grupo.
//
// Se compone de lo que el grupo DE VERDAD ocupa —su cabecera y la caja de sus
// filas, que es la unión de las dos— y no de una cabecera a la siguiente. Las
// dos llevan `data-groupid`, así que cada banda se arma de sus propios
// elementos en vez de deducirse de la posición de un vecino: un orden inesperado
// en el DOM daba una banda invertida, y una banda invertida no contiene ningún
// punto — el grupo dejaba de existir como destino sin que nada lo dijera.
//
// Y no queda ni una ZONA MUERTA. El hueco entre dos tarjetas pertenece a la de
// arriba, y los dos extremos llegan a los bordes del panel: medida de cabecera a
// cabecera, la franja que hay POR ENCIMA de la primera —el margen de su
// tarjeta— no era de nadie, así que arrastrar hacia arriba pasándose un poco
// contestaba `null` y el gesto se leía como una reordenación dentro del grupo de
// origen. Pasarse hacia el grupo al que se apunta es lo normal cuando se apunta
// al primero de la lista.
function buildGroupRegions(): GroupRegion[] {
  const bands = new Map<string, { top: number; bottom: number; headerEl: HTMLElement | null }>();

  const note = (id: string, el: HTMLElement, header: HTMLElement | null): void => {
    const rect = el.getBoundingClientRect();
    // Una caja PLEGADA es `display: none` y su rectángulo es todo ceros: metida
    // en la unión arrastraría la banda hasta el borde de arriba del panel.
    if (rect.height === 0) { return; }
    const band = bands.get(id);
    if (!band) {
      bands.set(id, { top: rect.top, bottom: rect.bottom, headerEl: header });
      return;
    }
    band.top    = Math.min(band.top, rect.top);
    band.bottom = Math.max(band.bottom, rect.bottom);
    band.headerEl = band.headerEl ?? header;
  };

  document
    .querySelectorAll<HTMLElement>('.group-header')
    .forEach(h => note(h.dataset.groupid ?? '', h, h));
  document
    .querySelectorAll<HTMLElement>('.group-rows')
    .forEach(r => note(r.dataset.groupid ?? '', r, null));

  const regions: GroupRegion[] = Array.from(bands, ([groupId, band]) => ({
    groupId,
    top     : band.top,
    bottom  : band.bottom,
    anchor  : band.top,
    headerEl: band.headerEl,
  })).sort((a, b) => a.top - b.top);

  // Con menos de dos no hay ningún sitio al que llevar la bay, y decirlo así es
  // lo que deja el resto del gesto en la rama de reordenar sin condiciones
  // extra: con un solo grupo poblado el host no manda cabecera, así que la
  // cuenta que importa es la de BANDAS y no la de cabeceras.
  if (regions.length < 2) { return []; }

  for (let i = 0; i < regions.length - 1; i++) {
    regions[i].bottom = regions[i + 1].top;
  }
  regions[0].top = Number.NEGATIVE_INFINITY;
  regions[regions.length - 1].bottom = Number.POSITIVE_INFINITY;

  return regions;
}

// Devuelve el groupId (string) cuya banda contiene la coordenada y, o null.
function groupAt(y: number): string | null {
  for (const r of groupRegions) {
    if (y >= r.top && y < r.bottom) { return r.groupId; }
  }
  return null;
}

// Deshace el desplazamiento de los siblings del grupo de origen (al salir hacia
// otro grupo, el hueco de reordenación local debe cerrarse).
function clearSiblingShifts(): void {
  if (currentInsertIndex === sourceIndex) { return; }
  originalOrder.forEach(s => { s.el.style.transform = ''; });
  currentInsertIndex = sourceIndex;
}

/**
 * El clon dice que ahí no cae.
 *
 * Es lo único que un arrastre rechazado puede decir MIENTRAS dura, y sin ello el
 * gesto no se distingue de uno que funciona hasta que se suelta y no pasa nada.
 */
function markRefused(refused: boolean): void {
  cloneEl?.classList.toggle('drag-refused', refused);
}

function setTargetGroupHighlight(groupId: string): void {
  if (highlightedGroupId === groupId) { return; }
  clearTargetGroupHighlight();

  const header = document.querySelector<HTMLElement>('.group-header[data-groupid="' + groupId + '"]');
  if (header) { header.classList.add('drag-over'); }
  document
    .querySelectorAll('.bay-block[data-groupid="' + groupId + '"]')
    .forEach(b => b.classList.add('drag-target-group'));
  highlightedGroupId = groupId;
}

function clearTargetGroupHighlight(): void {
  if (highlightedGroupId === null) { return; }
  document
    .querySelectorAll('.group-header.drag-over')
    .forEach(h => h.classList.remove('drag-over'));
  document
    .querySelectorAll('.bay-block.drag-target-group')
    .forEach(b => b.classList.remove('drag-target-group'));
  highlightedGroupId = null;
}

function cancelDrag(): void { teardown(); }

function teardown(): void {
  document.querySelectorAll('.drag-clone').forEach(el => el.remove());
  cloneEl = null;

  clearTargetGroupHighlight();

  if (sourceEl) {
    sourceEl.classList.remove('drag-placeholder');
    sourceEl = null;
  }

  siblings.forEach(b => {
    b.classList.remove('drag-shifting');
    b.style.transform = '';
  });
  originalOrder.forEach(s => { s.el.style.transform = ''; });

  document.body.classList.remove('drag-active');
  const wasDragging  = isDragging;
  isDragging         = false;
  siblings           = [];
  originalOrder      = [];
  currentInsertIndex = -1;
  sourceIndex        = -1;
  blockHeight        = 0;
  groupRegions       = [];
  targetGroupId      = null;
  lockedSource       = false;

  if (wasDragging) { dragEndListeners.forEach(listener => listener()); }
}
