import * as vscode from 'vscode';

/**
 * Un token ESTABLE y ÚNICO por tab nativa, para las tabs que no tienen uri.
 *
 * Por qué existe: el id de una bay sin uri se compone del `viewType`, que es
 * fijo durante la vida del panel (ver `utils/idRules.ts`), y eso convierte a dos
 * paneles del MISMO tipo en el mismo id — dos conversaciones de Claude Code, dos
 * vistas previas de markdown. El mapa de bays va indexado por id, así que la
 * segunda pisaba a la primera y solo se veía una; y `matchesNative` resolvía las
 * dos a la misma tab, con lo que cerrar una cerraba la otra.
 *
 * De dónde sale la estabilidad: el objeto `vscode.Tab` que expone el API es el
 * MISMO durante toda la vida de la tab. El host de extensiones memoiza ese objeto
 * y lo conserva al reetiquetar la tab (`acceptDtoUpdate`), al moverla dentro de
 * su grupo y al reconciliar el modelo entero (`_reconcileTabs`, que reusa por
 * `tabId`); solo abrir y cerrar crean y tiran uno. O sea: exactamente la vida de
 * la tab, que es la vida que el id necesita.
 *
 * Por eso es un `WeakMap` y no un mapa por `viewType` ni un índice dentro del
 * grupo: un ÍNDICE no se puede reconstruir en el camino de CIERRE —VS Code saca
 * la tab del grupo antes de anunciar el evento, así que ahí ya no tiene posición
 * que contar— y la identidad del objeto sí sigue estando.
 *
 * El token no viaja a disco: nada persiste ids de bay, así que una numeración por
 * sesión basta y no hay nada que migrar al recargar la ventana.
 */
const tokens = new WeakMap<vscode.Tab, string>();
let next = 0;

/** El token de esta tab, acuñado la primera vez que se pregunta por ella. */
export function tabInstanceToken(tab: vscode.Tab): string {
  const known = tokens.get(tab);
  if (known) { return known; }
  const minted = String(++next);
  tokens.set(tab, minted);
  return minted;
}
