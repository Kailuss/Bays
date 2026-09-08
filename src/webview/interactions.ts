// Interacción principal del webview.
// Clicks, menú contextual y actualizaciones parciales que llegan del host.

import { vscode } from './vscodeApi';
import { BaysContextMenu } from './contextmenu';
import type { HostToWebviewMessage, WebviewToHostMessage, RenderMessage } from '../shared/protocol';
import { applyRender } from './render';
import { initDragDrop, dragInFlight, onDragEnd } from './dragdrop';
import { nameClassFor, stateSlot } from './rows';
import { setTipDelay, hideOrphanedTip } from './tooltip';
import { truncatePathsIn } from './pathTruncation';
import { ICONS } from '../shared/icons';

// Emisor tipado: cada mensaje saliente debe ser un WebviewToHostMessage
// válido. Un campo o `type` que no exista en el protocolo no compila.
function post(message: WebviewToHostMessage): void {
  vscode.postMessage(message);
}

//= COLAPSADO DE GRUPOS

// Collapse a group header and hide its rows (or expand). Shared by the click
// handler and the post-rebuild restore so both stay in sync.
function setGroupCollapsed(header: HTMLElement, collapsed: boolean): void {
  // Read BEFORE the toggle: an actual unfold is what has to re-fit the paths
  // below, and this runs over every header on every render that touched
  // anything — asked after, the answer would be "expanded" for all of them.
  const wasCollapsed = header.classList.contains('collapsed');
  header.classList.toggle('collapsed', collapsed);

  // Only the FOLD moves: the group's mark says what it is and does not change
  // when its rows are hidden. The whole pair is removed and the right one added,
  // rather than toggling both: were the two names ever equal, the second toggle
  // would undo the first and no glyph would be drawn at all.
  const icon = header.querySelector('.group-fold .codicon');
  if (icon) {
    icon.classList.remove(`codicon-${ICONS.group.foldExpanded}`, `codicon-${ICONS.group.foldCollapsed}`);
    icon.classList.add(`codicon-${collapsed ? ICONS.group.foldCollapsed : ICONS.group.foldExpanded}`);
  }

  const rows: HTMLElement[] = [];
  let sibling = header.nextElementSibling;
  while (sibling && !sibling.classList.contains('group-header')) {
    (sibling as HTMLElement).style.display = collapsed ? 'none' : '';
    rows.push(sibling as HTMLElement);
    sibling = sibling.nextElementSibling;
  }

  // A hidden row has no width, so its path could not be fitted while the group
  // was folded — and the render that built it has already been and gone.
  // Unfolding is the moment those rows get a width, so it is the moment they
  // get measured. Folding needs nothing: what is not drawn is not read.
  if (wasCollapsed && !collapsed) { truncatePathsIn(rows); }
}

// Flip a header's collapsed state and persist it so the next full rebuild can
// re-apply it (collapsed state lives only in the DOM otherwise). Shared by the
// fold button and a plain click anywhere on the header.
function toggleGroupCollapsed(header: HTMLElement | null): void {
  if (!header) { return; }
  const isCollapsed = !header.classList.contains('collapsed');
  setGroupCollapsed(header, isCollapsed);

  const groupId = header.dataset.groupid;
  if (groupId !== undefined) {
    const st = vscode.getState() || {};
    const collapsed = new Set((st.collapsedGroups || []).map(String));
    if (isCollapsed) { collapsed.add(String(groupId)); } else { collapsed.delete(String(groupId)); }
    st.collapsedGroups = Array.from(collapsed);
    vscode.setState(st);
  }
}

/**
 * Vuelve a aplicar el plegado a las cabeceras que hay en pantalla.
 *
 * El plegado vive SOLO en el DOM —una clase en la cabecera y un `display` en sus
 * hermanas— así que un bloque que la reconciliación acaba de sustituir vuelve
 * abierto. Se guarda por `getState()` y se reaplica tras cada render que de
 * verdad haya tocado algo.
 */
function applyCollapsedGroups(): void {
  const st = vscode.getState();
  const collapsed = new Set((st?.collapsedGroups ?? []).map(String));
  document.querySelectorAll<HTMLElement>('.group-header').forEach(header => {
    setGroupCollapsed(header, collapsed.has(String(header.dataset.groupid)));
  });
}

/**
 * Drag & drop, armado PEREZOSAMENTE la primera vez que llega encendido.
 *
 * Con el shell congelado el ajuste puede moverse sin que el documento se
 * reconstruya, así que ya no vale leerlo una vez del `<body>` al arrancar. Se
 * arma una sola vez: sus listeners son delegados en el documento y sobreviven a
 * cualquier reconciliación.
 */
/** Lo que llegó mientras había un arrastre en marcha, para pintarlo al soltar. */
let pendingRender: RenderMessage | null = null;

function paint(msg: RenderMessage): void {
  // El plegado solo se reaplica cuando el DOM se ha tocado de verdad: el render
  // llega con cada reporte de git, y casi siempre no cambia nada.
  setTipDelay(msg.hoverDelay);
  // La clase la escribe quien contesta la pregunta, y así las hojas la leen en
  // un solo sitio en vez de que cada una consulte su propio ajuste.
  document.body.classList.toggle('no-motion', !msg.motion);

  const { touched, built } = applyRender(msg.sections, msg.icons, {
    compact : msg.compact,
    showPath: msg.showPath,
  });
  if (touched) {
    applyCollapsedGroups();
    // La reconciliación puede haberse llevado el ancla del tip que estuviera
    // arriba: una caja flotando sobre donde estuvo una fila se lee como un panel
    // colgado.
    hideOrphanedTip();
  }
  // Only what is NEW: a block the reconciliation left alone is still cut to the
  // width it still has. The render saying so is what a `MutationObserver` over
  // the document cannot, which is why there isn't one.
  truncatePathsIn(built);
}

// Al soltar, se sirve lo que se aplazó.
onDragEnd(() => {
  const queued = pendingRender;
  pendingRender = null;
  if (queued) { paint(queued); }
});

let dragDropArmed = false;
function syncDragDrop(enabled: boolean): void {
  document.body.dataset.enableDragdrop = String(enabled);
  if (enabled && !dragDropArmed) {
    dragDropArmed = true;
    initDragDrop();
  }
}

//= INICIALIZACIÓN

export function initInteractions(): void {
  // El documento ya no se recarga en cada cambio estructural: la lista se
  // reconcilia por clave y el scroll ni se entera. Lo que SÍ lo recarga es que
  // el webview vuelva a nacer (moverlo de sitio, o volver de estar oculto sin
  // contexto retenido), y de eso es de lo que `getState()` protege.
  (function restoreScroll() {
    const st = vscode.getState();
    if (st && typeof st.scrollY === 'number' && st.scrollY > 0) {
      const y = st.scrollY;
      // Restore after layout so the target offset exists
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  })();

  let scrollSaveTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('scroll', () => {
    if (scrollSaveTimer) { return; }
    scrollSaveTimer = setTimeout(() => {
      scrollSaveTimer = null;
      const st = vscode.getState() || {};
      st.scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      vscode.setState(st);
    }, 100);
  }, { passive: true });

  // Evitar mensajes duplicados durante la animación de cierre
  const closingTabs = new Set<string>();

  document.addEventListener('click', e => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) { return; }

    const btn = target.closest<HTMLElement>('button[data-action]');
    if (btn) {
      e.stopPropagation();
      const action = btn.dataset.action;

      if (action === 'closeBay' || action === 'closeVariant') {
        const bayId = btn.dataset.bayId;
        if (!bayId) { return; }
        const bay = document.querySelector(`.bay[data-bay-id="${CSS.escape(bayId)}"]`);
        if (bay && !closingTabs.has(bayId)) {
          closingTabs.add(bayId);
          bay.classList.add('closing');
          setTimeout(() => {
            post({ type: action, bayId });
            closingTabs.delete(bayId);
          }, 200);
        }
        return;
      }

      if (action === 'fileAction') {
        const bayId = btn.dataset.bayId;
        const actionId = btn.dataset.actionid;
        if (bayId && actionId) { post({ type: 'fileAction', bayId, actionId }); }
        return;
      }

      // Group: collapse / expand (client-side toggle, persisted so it survives rebuilds)
      if (action === 'toggleGroup') {
        toggleGroupCollapsed(btn.closest<HTMLElement>('.group-header'));
        return;
      }

      // Group actions carry a groupId, not a bayId.
      if (action === 'renameGroup' || action === 'setGroupColor' || action === 'toggleGroupLock') {
        post({ type: action, groupId: parseInt(btn.dataset.groupid ?? '', 10) });
        return;
      }

      if (action === 'addToChat') {
        const bayId = btn.dataset.bayId;
        if (bayId) { post({ type: 'addToChat', bayId }); }
        return;
      }
      return;
    }

    // Un clic en cualquier parte de la cabecera (salvo sus botones de acción)
    // colapsa o expande el grupo — el fold es sólo el ancla visual.
    const header = target.closest<HTMLElement>('.group-header');
    if (header) { toggleGroupCollapsed(header); return; }

    const bay = target.closest<HTMLElement>('.bay');
    const bayId = bay?.dataset.bayId;
    if (bayId) { post({ type: 'openBay', bayId }); }
  });

  // Enter or Space on a focused header folds it, which is what a click anywhere
  // on it already does. A `<div tabindex="0">` synthesises no click of its own
  // — only a real button does — so without this the header would be a tab stop
  // that answers nothing, and the fold would have no keyboard route at all.
  //
  // Only when the header ITSELF has the focus: once Tab has moved into one of
  // its buttons, Enter belongs to that button.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') { return; }
    const header = e.target instanceof HTMLElement ? e.target : null;
    if (!header?.classList.contains('group-header')) { return; }
    // Space would scroll the list otherwise.
    e.preventDefault();
    toggleGroupCollapsed(header);
  });

  document.addEventListener('contextmenu', e => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) { return; }

    // Los grupos no tienen menú contextual: sus tres acciones ya son botones.
    if (target.closest('.group-header')) { e.preventDefault(); return; }

    const bay = target.closest<HTMLElement>('.bay');
    const bayId = bay?.dataset.bayId;
    if (bayId) {
      e.preventDefault();
      // Las coordenadas viajan al host y vuelven con los items: sólo él sabe qué
      // acciones tiene esta bay (grupo bloqueado, si hay URI, si Copilot está).
      post({ type: 'contextMenu', bayId, x: e.clientX, y: e.clientY });
    }
  });

  // Todo lo que llega del host. Cada variante de `HostToWebviewMessage` tiene
  // que estar NOMBRADA en `WEBVIEW_MESSAGE_LISTENERS` (shared/protocol.ts): sin
  // eso, un mensaje nuevo compila sin oyente y su feature no hace nada.
  window.addEventListener('message', (e: MessageEvent<HostToWebviewMessage>) => {
    const msg = e.data;

    if (msg.type === 'render') {
      syncDragDrop(msg.enableDragDrop);
      // A mitad de un arrastre no se toca el DOM: la reconciliación sustituiría
      // justo los nodos contra los que el gesto está midiendo. Lo que llegue se
      // pinta cuando se suelte.
      if (dragInFlight()) { pendingRender = msg; return; }
      // El plegado solo se reaplica cuando el DOM se ha tocado de verdad: este
      // mensaje llega con cada reporte de git, y casi siempre no cambia nada.
      paint(msg);
      // El fundido de entrada es del PRIMER pintado y de ninguno más.
      if (!document.body.classList.contains('loaded')) {
        requestAnimationFrame(() => document.body.classList.add('loaded'));
      }
    }

    if (msg.type === 'productIcons') {
      // Elemento propio y no el del tema de ficheros: aquel se reasigna entero
      // en cada cambio de tema, y dos escritores sobre uno se borrarian.
      const style = document.getElementById('productIcons');
      if (style) { style.textContent = msg.css; }
    }

    if (msg.type === 'themeFont') {
      // El shell manda este elemento vacío: leer la fuente de un tema es I/O de
      // disco, y ponerla en el <head> dejaría el panel en blanco hasta tenerla.
      const style = document.getElementById('themeFont');
      if (style) { style.textContent = msg.css; }
    }

    if (msg.type === 'showContextMenu') {
      BaysContextMenu.show({
        x: msg.x,
        y: msg.y,
        items: msg.items,
        onSelect: actionId => post({ type: 'menuAction', bayId: msg.bayId, actionId }),
      });
    }

    if (msg.type === 'updateActiveBay') {
      // The header of the group being worked in, kept in step on the SILENT path
      // too: this message exists so that changing tabs costs no rebuild, and a
      // mark that only a full render could move would sit on the wrong group for
      // as long as nothing else happened.
      document.querySelectorAll<HTMLElement>('.group-header').forEach(h => {
        h.classList.toggle('current', h.dataset.groupid === String(msg.activeGroupId));
      });

      const activeSet = new Set(msg.activeBayIds);
      document.querySelectorAll<HTMLElement>('.bay').forEach(t => {
        t.classList.toggle('active', activeSet.has(t.dataset.bayId ?? ''));
      });
    }

    if (msg.type === 'updateBayLabel') {
      // A webview panel rewrote its title (e.g. Claude Code). Swap only the leading
      // text node of .bay-name so any trailing pin badge / state class survives.
      // Variant rows have no .bay-name — their text lives in .variant-label.
      const bay = document.querySelector(`.bay[data-bay-id="${CSS.escape(msg.bayId)}"]`);
      if (bay) {
        const nameEl = bay.querySelector('.bay-name') || bay.querySelector('.variant-label');
        if (nameEl) {
          const first = nameEl.firstChild;
          if (first && first.nodeType === Node.TEXT_NODE) {
            first.nodeValue = msg.label;
          } else {
            nameEl.insertBefore(document.createTextNode(msg.label), nameEl.firstChild);
          }
          // In compact mode the path shares its line with the name, so what the
          // name takes decides what is left for it: a title rewritten at runtime
          // (Claude Code) otherwise leaves the path cut to the previous width.
          truncatePathsIn([bay as HTMLElement]);
        }
      }
    }

    if (msg.type === 'updateIcons') {
      // Deferred icons resolved by the host — swap each placeholder in place
      for (const it of msg.icons) {
        const bay = document.querySelector(`.bay[data-bay-id="${CSS.escape(it.bayId)}"]`);
        if (bay) {
          const iconEl = bay.querySelector('.bay-icon');
          if (iconEl) { iconEl.innerHTML = it.html; }
        }
      }
    }

    if (msg.type === 'bayStateChanged') {
      // Llega un CÓDIGO, no markup: el glifo lo elige este lado (`rows.ts`), que
      // es donde vive todo lo demás que se dibuja.
      // Las filas de variante no tienen .bay-name ni .bay-state (nunca reportan
      // estado de git ni diagnóstico), así que para ellas esto no hace nada.
      const bay = document.querySelector(`.bay[data-bay-id="${CSS.escape(msg.bayId)}"]`);
      if (bay && !bay.classList.contains('closing')) {
        const name = bay.querySelector('.bay-name');
        const slot = bay.querySelector('.bay-state');

        if (name) {
          name.className = `bay-name${nameClassFor(msg.state)}`;
          name.classList.add('changing');
          setTimeout(() => name.classList.remove('changing'), 1000);
        }
        slot?.replaceWith(stateSlot(msg.state));
        // The mark is `flex: 0 0 auto` and a clean row's is EMPTY, so gaining or
        // losing one moves what is left for the text beside it. Unfitted, the
        // path would then be cut by the stylesheet — from the TAIL, which is the
        // folder the file lives in and the whole reason it is there.
        truncatePathsIn([bay as HTMLElement]);
      }
    }
  });
}
