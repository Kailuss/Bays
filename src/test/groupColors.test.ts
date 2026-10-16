import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_ORDER, GROUP_COLORS, autoGroupColor, parseGroupColor } from '../utils/groupColors';

test('los colores de grupo son los ocho de la casa', () => {
  assert.deepEqual([...GROUP_COLORS], ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink']);
});

test('el reparto por columna empieza como la paleta anterior', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(autoGroupColor), ['blue', 'green', 'yellow', 'orange', 'red', 'violet']);
});

test('el reparto usa los ocho y da la vuelta', () => {
  assert.deepEqual([...AUTO_ORDER].sort(), [...GROUP_COLORS].sort());
  assert.equal(autoGroupColor(9), 'blue');
  assert.equal(autoGroupColor(0), 'blue');
});

test('un purple guardado se lee como violet', () => {
  assert.equal(parseGroupColor('purple'), 'violet');
});

test('un color de la casa se lee tal cual', () => {
  assert.equal(parseGroupColor('teal'), 'teal');
  assert.equal(parseGroupColor('blue'), 'blue');
});

test('lo que no se sabe leer es el color automatico, nunca uno inventado', () => {
  assert.equal(parseGroupColor('magenta'), undefined);
  assert.equal(parseGroupColor(undefined), undefined);
  assert.equal(parseGroupColor(3), undefined);
});
