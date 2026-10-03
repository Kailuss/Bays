// Los ajustes que llegan del usuario, normalizados.
//
// Puro y con tests porque lo que se lee de la configuración no tiene tipo: un
// `get` devuelve lo que haya escrito en el settings.json, y ahí puede haber una
// cadena donde se espera un número o un valor que el enum no nombra. Lo que cada
// regla de aquí afirma es que lo que sale es utilizable, y en qué dirección
// falla cuando lo que entra no lo es.

import type { PathSeparator, PathSeparatorCharacter } from '../shared/protocol';

/**
 * El defecto del propio workbench para `workbench.hover.delay`.
 *
 * Se declara aquí y en ningún otro sitio: el cliente lleva el mismo número como
 * valor de partida para el instante anterior al primer mensaje, y dos copias de
 * una misma espera son dos respuestas esperando a separarse.
 */
export const HOVER_DELAY_MS = 500;

/**
 * Cuánto descansa el puntero antes de que salga un tooltip.
 *
 * Se LEE del workbench en vez de duplicarse como un ajuste nuestro: dos números
 * para una misma espera serían esta vista contradiciendo en voz baja una
 * respuesta que el usuario ya ha dado.
 *
 * Se acota por los dos extremos. Un valor negativo o absurdo no es una
 * preferencia sino un settings.json roto, y lo que costaría honrarlo es un tip
 * que sale con cada píxel que cruza el puntero, o uno que no sale nunca.
 */
export function parseHoverDelay(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) { return HOVER_DELAY_MS; }
  return Math.min(Math.max(Math.round(value), 0), 5000);
}

/**
 * Si la vista se MUEVE, fundiendo las dos respuestas que lo deciden.
 *
 * Son dos entradas a un mismo hecho y cualquiera de las dos vale para pararlo:
 * `bays.animations`, que es el interruptor maestro de esta vista, y
 * `workbench.reduceMotion`, que es la respuesta del workbench a la misma
 * pregunta.
 *
 * La media query `prefers-reduced-motion` NO se mira, y ésa es la parte
 * deliberada: reporta el SISTEMA, y esa bandera se enciende por motivos que no
 * tienen nada que ver con este panel — una máquina configurada para menos
 * animación en todo, una sesión de escritorio remoto que la fuerza. Aterrizando
 * aquí pararía la vista sin que nada en pantalla dijera por qué, y la única
 * vuelta atrás estaría en otra aplicación. La pregunta se le hace al workbench,
 * que es donde está el usuario: solo un `on` explícito para algo, y `auto` —el
 * defecto, o sea casi todo el mundo— SE MUEVE.
 */
export function parseMotion(animations: unknown, reduceMotion: unknown): boolean {
  if (animations === false) { return false; }
  return reduceMotion !== 'on';
}

/**
 * Un booleano tal como está ESCRITO, o `undefined` donde no lo está.
 *
 * El contrato que un gemelo necesita y no el de los demás parsers de aquí: la
 * regla que elige un lado depende de distinguir escrito de no escrito, y un
 * parser que funda el defecto convierte cada silencio en una respuesta — con lo
 * que el defecto del dueño le ganaría a un valor que alguien tecleó bajo el otro
 * prefijo.
 */
export function answeredFlag(raw: unknown): boolean | undefined {
  return typeof raw === 'boolean' ? raw : undefined;
}

// Tomado de Atria src/utils/settingsRules.ts @ e51aaa9: es la MISMA pregunta, asi
// que es la misma respuesta. Dos implementaciones de «quien manda» son dos
// respuestas esperando a discrepar, y el vocabulario del separador tiene que ser
// el del dueno o ceder a su clave costaria el idioma propio de esta vista.
/**
 * A setting id split as `getConfiguration` wants it: the section it hangs off
 * and the key within it. One place doing it keeps the split from being written
 * differently at each call site.
 */
export function splitSettingId(id: string): { section: string; key: string } {
  const dot = id.indexOf('.');
  return dot < 0
    ? { section: '', key: id }
    : { section: id.slice(0, dot), key: id.slice(dot + 1) };
}

//= A QUESTION TWO EXTENSIONS ASK

/**
 * Where a twin answer came from.
 *
 * `default` is not "nobody asked": it is nobody ANSWERED, so whichever
 * extension is reading falls to the default it declares for its own key.
 */
export type TwinSource = 'own' | 'owner' | 'default';

/**
 * What stands written for a question two of the house's extensions both ask,
 * each under its own prefix.
 *
 * `undefined` means NOT WRITTEN and never "written empty": the whole rule turns
 * on telling those apart, which is why a caller passes each side through its own
 * `parse*` first — an unreadable value is no answer, and that is the same thing.
 *
 * `owner` is always absent where the owning extension is not installed. A value
 * left under its prefix by an extension somebody uninstalled is not an answer
 * anybody can see the effect of, and reading it would let a removed extension go
 * on governing this one.
 */
export type TwinReading<T> = {
  readonly own?   : T;
  readonly owner? : T;
};

export type TwinAnswer<T> = {
  /** `undefined` where neither side was written: the reader's own default governs. */
  readonly value    : T | undefined;
  readonly from     : TwinSource;
  /** Both sides are written and they disagree, which is worth saying once. */
  readonly conflict : boolean;
};

/**
 * Which side of a twin setting governs: ONE answer, ONE owner.
 *
 * The owner wins where it has been answered, and that is the rule the whole
 * arrangement is for — Compare and the rail measuring one branch against two
 * different bases is the failure, and it is silent in both panels.
 *
 * What the rule adds on top is the case that makes it safe to adopt: **an
 * answered key is never given up for an unanswered one.** Somebody who wrote
 * `navigator.filters.branchBase` and never heard of Railyard has answered this
 * question, so installing Railyard must not quietly move their Compare base to
 * a default nobody chose. So the owner is preferred, not obeyed: it wins over
 * the other side's answer, never over its own silence.
 *
 * Compared with `!==`, so this is for the primitives these settings are — every
 * twin today is a string or a boolean.
 */
export function resolveTwinSetting<T>(reading: TwinReading<T>): TwinAnswer<T> {
  if (reading.owner !== undefined) {
    return {
      value    : reading.owner,
      from     : 'owner',
      conflict : reading.own !== undefined && reading.own !== reading.owner,
    };
  }
  if (reading.own !== undefined) {
    return { value: reading.own, from: 'own', conflict: false };
  }
  return { value: undefined, from: 'default', conflict: false };
}

/**
 * The characters a path may be written with: the two path signs, and two
 * TYPOGRAPHIC ones that read as the breadcrumb a painted path is.
 *
 * The second pair is here because the house's three extensions all write the
 * same path and this is the ONE key that says how (see *Ajustes gemelos*): Bays
 * draws its rows with a chevron, so a vocabulary of two could not express what
 * it already looked like — and yielding to this key would have cost it its own
 * idiom with no way to ask for it back.
 *
 * A typographic sign applies at the ENDS too, like any other: `C:\` comes out
 * `C:›`. Those runs are marks rather than boundaries, so there is an argument
 * for leaving them as they came, and it is deliberately not taken — a path
 * written in one sign throughout is one decision to read, and the mark at the
 * end of a drive is the same mark.
 */
const SEPARATOR_CHARACTERS: readonly PathSeparatorCharacter[] = ['\\', '/', '\u203a', '\u2022'];

/**
 * What goes between two folder names, out of the two settings that decide it:
 * the character and whether it carries a space on each side. Eight answers in
 * all, four characters either bare or spaced.
 *
 * COMPOSED here and travelling as one string, which is why nothing takes either
 * of them as a default argument: a second copy of the composition would be a
 * second answer waiting to disagree.
 *
 * Interpolated now rather than spelled out: the union is a template literal
 * over the four characters, so the compiler still checks that what comes out is
 * one of the eight — which eight literals written by hand would also have done,
 * and would have had to be kept in step with the list above.
 */
export function parsePathSeparator(rawCharacter: unknown, rawSpaced: unknown): PathSeparator {
  const character = SEPARATOR_CHARACTERS.find(one => one === rawCharacter) ?? '\\';
  return rawSpaced === true ? ` ${character} ` : character;
}
