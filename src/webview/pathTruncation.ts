// ==========================================
// DYNAMIC PATH TRUNCATION
// ==========================================
// Trunca paths ocultando carpetas completas desde el inicio,
// adaptándose al ancho disponible del contenedor.

const PATH_SEPARATOR = ' › ';
const ELLIPSIS = '…';

/**
 * One band's width, in pixels, read from the token that draws it
 * (`--bays-row-action`, base.css) so the number lives in one place.
 *
 * Cached for the life of the view: it is a constant of the stylesheet and not
 * something a theme or a resize moves, and reading it is a style query in a
 * pass that runs on every render and every resize.
 */
let cachedBandWidth = 0;

function actionBandWidth(): number {
  if (cachedBandWidth === 0) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--bays-row-action');
    cachedBandWidth = parseFloat(raw) || 24;
  }
  return cachedBandWidth;
}

/**
 * Trunca un path basándose en el ancho disponible del contenedor.
 * Muestra las carpetas que quepan desde la derecha, ocultando las de la izquierda.
 *
 * @param element - Elemento que contiene el path a truncar
 */
function truncatePathDynamic(element: HTMLElement): void {
  const pathPartsAttr = element.getAttribute('data-path-parts');
  if (!pathPartsAttr) {
    return;
  }

  let parts: string[];
  try {
    parts = JSON.parse(pathPartsAttr);
  } catch {
    console.error('[PathTruncate] Invalid JSON in data-path-parts:', pathPartsAttr);
    return;
  }

  if (!parts || parts.length === 0) {
    return;
  }

  // CRÍTICO: Medir el ancho del contenedor PADRE (.bay-text), no del elemento mismo
  // Si medimos element.clientWidth, este cambia cuando modificamos textContent,
  // causando mediciones inconsistentes y comportamiento oscilante
  const container = element.parentElement;
  if (!container) {
    return;
  }

  let availableWidth = container.clientWidth;

  // The room the band of orders will take, subtracted UP FRONT even though the
  // row is not opened for it yet. That is what makes hovering a row move
  // nothing at all: measured against the resting width, a path fitted exactly
  // would be re-cut the moment the pointer arrived — and the flex ellipsis that
  // did it would cut the TAIL, which is the folder the file actually lives in
  // and the whole reason the path is there. This pass abbreviates from the left
  // instead, where the generic folders are.
  //
  // Read off the row's own `--bay-actions` (written by `rows.ts`) rather than
  // measured: the band is out of flow and hidden, so asking the DOM for its
  // width would force a layout per row in a pass that already forces plenty.
  const row = container.closest<HTMLElement>('.bay');
  const slots = Number(row?.style.getPropertyValue('--bay-actions') ?? 0);
  if (slots > 0) { availableWidth -= slots * actionBandWidth(); }

  // En modo compact, el path comparte línea con .bay-name
  // Necesitamos restar el ancho del name y el gap
  const isInline = element.classList.contains('bay-path-inline');
  if (isInline) {
    const bayName = container.querySelector<HTMLElement>('.bay-name');
    if (bayName) {
      availableWidth -= bayName.offsetWidth;
      // Restar gap (4px según CSS) + margen izquierdo del path-inline (6px)
      availableWidth -= 10;
    }
  }

  // Buffer de seguridad para evitar comportamiento oscilante por redondeos de píxeles
  const SAFETY_BUFFER = 3;
  const containerWidth = availableWidth - SAFETY_BUFFER;

  if (containerWidth <= 0) {
    return; // No visible aún o ancho insuficiente
  }

  // Crear un elemento temporal para medir texto
  // CRÍTICO: Copiar TODOS los estilos que afectan el ancho del texto
  const computedStyle = getComputedStyle(element);
  const measurer = document.createElement('span');
  measurer.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: nowrap;
    font-size: ${computedStyle.fontSize};
    font-family: ${computedStyle.fontFamily};
    font-weight: ${computedStyle.fontWeight};
    letter-spacing: ${computedStyle.letterSpacing};
    font-variant: ${computedStyle.fontVariant};
    font-style: ${computedStyle.fontStyle};
  `;
  document.body.appendChild(measurer);

  // --- Algoritmo monótono de truncado ---
  // Garantiza que al reducir el ancho, el path solo puede mantener o
  // aumentar el nivel de truncado, nunca revertirlo.
  //
  // Estrategia: probar candidatos de mayor a menor número de partes visibles.
  // Cada candidato se mide CON la elipsis incluida (excepto el path completo),
  // eliminando la discrepancia entre "cabe sin elipsis" vs "no cabe con elipsis".

  let result = ELLIPSIS; // Caso extremo: solo elipsis

  // 1. Intentar el path completo (sin elipsis)
  const fullPath = parts.join(PATH_SEPARATOR);
  measurer.textContent = fullPath;

  if (measurer.offsetWidth <= containerWidth) {
    result = fullPath;
  } else {
    // 2. Probar N partes desde la derecha, siempre con prefijo "…\"
    //    Desde parts.length-1 (casi todo) hasta 1 (solo la última carpeta)
    for (let n = parts.length - 1; n >= 1; n--) {
      const visible = parts.slice(parts.length - n).join(PATH_SEPARATOR);
      const candidate = ELLIPSIS + PATH_SEPARATOR + visible;
      measurer.textContent = candidate;

      if (measurer.offsetWidth <= containerWidth) {
        result = candidate;
        break;
      }
    }
  }

  document.body.removeChild(measurer);
  // Only write when the value actually changed. Reassigning textContent replaces
  // the child text node (a childList mutation the observer would see), so a
  // no-op write both wastes a reflow and feeds the feedback loop.
  if (element.textContent !== result) {
    element.textContent = result;
  }
}

// Module-scoped so truncateAllPaths can pause it while mutating the DOM.
let pathObserver: MutationObserver | null = null;

/**
 * Aplica truncado dinámico a todos los paths en la página.
 */
function truncateAllPaths(): void {
  // truncateAllPaths mutates the observed subtree (appends a measurer to body,
  // rewrites path textContent). Disconnect while doing so, otherwise each pass
  // re-triggers the observer, which reschedules another pass, forever — a
  // perpetual ~16ms CPU/reflow spin. Reconnect once we're done.
  if (pathObserver) { pathObserver.disconnect(); }
  document.querySelectorAll<HTMLElement>('.bay-path, .bay-path-inline').forEach(truncatePathDynamic);
  if (pathObserver && document.body) {
    pathObserver.observe(document.body, { childList: true, subtree: true });
  }
}

/**
 * Inicializa el sistema de truncado de paths.
 * - Ejecuta truncado inicial al cargar el DOM
 * - Observa cambios en el DOM para truncar paths nuevos
 * - Re-trunca al redimensionar la ventana
 */
export function initPathTruncation(): void {
  // Ejecutar al cargar el contenido
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', truncateAllPaths);
  } else {
    truncateAllPaths();
  }

  // Re-truncar al redimensionar la ventana
  // Usar requestAnimationFrame para asegurar que el layout esté estable antes de medir
  let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      requestAnimationFrame(truncateAllPaths);
    }, 100);
  });

  // Observar cambios en el DOM para truncar paths nuevos
  pathObserver = new MutationObserver((mutations) => {
    let shouldTruncate = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldTruncate = true;
        break;
      }
    }
    if (shouldTruncate) {
      // requestAnimationFrame asegura que el layout esté completo antes de medir
      requestAnimationFrame(() => {
        setTimeout(truncateAllPaths, 10);
      });
    }
  });

  // Observar el body
  if (document.body) {
    pathObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      pathObserver?.observe(document.body, { childList: true, subtree: true });
    });
  }
}
