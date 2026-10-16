import { ROOT_COLORS, parseRootColor, type RootColor } from '../shared/rootColors';

/**
 * Los colores de un grupo son los de la CASA: los ocho tonos con los que Atria y
 * Railyard marcan un proyecto (`shared/rootColors.ts`, del kit), para que un
 * mismo nombre de color sea el mismo color en las tres vistas.
 */
export const GROUP_COLORS: readonly RootColor[] = ROOT_COLORS;

/**
 * El orden en que se reparten por COLUMNA cuando nadie ha elegido. Empieza como
 * empezaba la paleta anterior (azul, verde, amarillo, naranja, rojo, el morado
 * que ahora es violeta) para que un grupo que nunca se coloreó a mano siga con
 * el color de siempre; los dos tonos nuevos van detrás.
 */
export const AUTO_ORDER: readonly RootColor[] = ['blue', 'green', 'yellow', 'orange', 'red', 'violet', 'teal', 'pink'];

/** El color que le toca a una columna, de modo que dos grupos contiguos nunca coinciden. */
export function autoGroupColor(viewColumn: number): RootColor {
  return AUTO_ORDER[Math.max(0, viewColumn - 1) % AUTO_ORDER.length];
}

/**
 * Un color GUARDADO, leído. `purple` es el único nombre de la paleta anterior
 * que no sobrevive, y su heredero es exacto: es el mismo hueco de la rueda. Lo
 * que no se sabe leer es la ausencia de elección, o sea el color automático, y
 * nunca un color que nadie eligió.
 */
export function parseGroupColor(value: unknown): RootColor | undefined {
  if (value === 'purple') { return 'violet'; }
  return parseRootColor(value) ?? undefined;
}
