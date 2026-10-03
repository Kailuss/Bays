import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answeredFlag, parseHoverDelay, parseMotion, parsePathSeparator, resolveTwinSetting, HOVER_DELAY_MS } from '../utils/settingsRules';

// Lo que se lee de la configuracion no tiene tipo: un `get` devuelve lo que haya
// escrito en el settings.json. Lo que estos casos fijan es en que DIRECCION
// falla cada regla cuando lo que entra no es utilizable.

test('un retardo valido se respeta', () => {
  assert.equal(parseHoverDelay(300), 300);
  assert.equal(parseHoverDelay(0), 0);
});

test('lo que no es un numero cae al defecto del workbench', () => {
  assert.equal(parseHoverDelay('300'), HOVER_DELAY_MS);
  assert.equal(parseHoverDelay(undefined), HOVER_DELAY_MS);
  assert.equal(parseHoverDelay(null), HOVER_DELAY_MS);
  assert.equal(parseHoverDelay(NaN), HOVER_DELAY_MS);
  assert.equal(parseHoverDelay(Infinity), HOVER_DELAY_MS);
});

test('se acota por los dos extremos: un settings.json roto no es una preferencia', () => {
  // Negativo: un tip que sale con cada pixel que cruza el puntero.
  assert.equal(parseHoverDelay(-1), 0);
  // Absurdo: un tip que no sale nunca.
  assert.equal(parseHoverDelay(999999), 5000);
});

test('un decimal se redondea: es un setTimeout', () => {
  assert.equal(parseHoverDelay(300.6), 301);
});

test('la vista se mueve por defecto', () => {
  assert.equal(parseMotion(undefined, undefined), true);
});

test('el interruptor de la vista la para', () => {
  assert.equal(parseMotion(false, 'auto'), false);
});

test('reduceMotion en `on` la para tambien', () => {
  assert.equal(parseMotion(true, 'on'), false);
});

test('solo un `on` EXPLICITO la para: `auto` se mueve', () => {
  // `auto` es el defecto del workbench, o sea casi todo el mundo. Delegar ahi en
  // el sistema pararia la vista sin que nada en pantalla dijera por que.
  assert.equal(parseMotion(true, 'auto'), true);
  assert.equal(parseMotion(true, 'off'), true);
});

test('un valor ilegible del interruptor deja la vista moviendose', () => {
  // Falla ABIERTO: lo que espera quien nunca toco el ajuste es que se mueva.
  assert.equal(parseMotion('si', undefined), true);
  assert.equal(parseMotion(null, undefined), true);
});

//= UNA PREGUNTA QUE DOS EXTENSIONES HACEN

test('manda el dueño donde ha contestado', () => {
  // La regla por la que existe el reparto: los dos paneles de la ventana
  // escribiendo la misma ruta de dos maneras es el fallo, y es callado.
  assert.deepEqual(resolveTwinSetting({ own: ' › ', owner: ' / ' }), {
    value    : ' / ',
    from     : 'owner',
    conflict : true,
  });
});

test('una clave contestada no se cede por una sin contestar', () => {
  // Quien eligió el punto aquí y no ha tocado Atria ha contestado esta
  // pregunta: instalar Atria no puede devolverle el chevrón.
  assert.deepEqual(resolveTwinSetting({ own: ' • ' }), {
    value    : ' • ',
    from     : 'own',
    conflict : false,
  });
});

test('sin nadie que haya contestado no hay respuesta, y quien lee cae en su defecto', () => {
  assert.deepEqual(resolveTwinSetting({}), { value: undefined, from: 'default', conflict: false });
});

test('un booleano cuenta como contestado solo si lo está', () => {
  // El contrato que la regla necesita: un parser que funda el defecto
  // convertiría cada silencio en una respuesta, y entonces el defecto del
  // dueño le ganaría a un valor que alguien tecleó aquí.
  assert.equal(answeredFlag(false), false);
  assert.equal(answeredFlag(true), true);
  assert.equal(answeredFlag(undefined), undefined);
  assert.equal(answeredFlag('false'), undefined);
  assert.equal(answeredFlag(0), undefined);
});

test('el separador toma los cuatro signos de Atria y nada más', () => {
  // El vocabulario es el del dueño, y por eso incluye los dos tipográficos:
  // con dos valores, ceder a su clave le habría costado a esta vista el signo
  // que siempre ha dibujado.
  assert.equal(parsePathSeparator('›', true), ' › ');
  assert.equal(parsePathSeparator('•', true), ' • ');
  assert.equal(parsePathSeparator('/', false), '/');
  assert.equal(parsePathSeparator('\\', false), '\\');
  assert.equal(parsePathSeparator('>', true), ' \\ ');
  assert.equal(parsePathSeparator(undefined, false), '\\');
});
