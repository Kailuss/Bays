import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countLineChanges, MAX_EDITS } from '../utils/lineDiff';

// Lo que se comprueba es la CUENTA, que es lo unico que la fila escribe: un
// diff de D ediciones sobre N y M lineas anade (D + M - N) / 2 y quita el
// resto. Y las dos formas de fallar: una linea de mas por un salto final, y
// una busqueda que no acaba sobre una reescritura.

test('textos iguales: nada', () => {
  assert.deepEqual(countLineChanges('a\nb\nc\n', 'a\nb\nc\n'), { added: 0, removed: 0 });
});

test('una linea cambiada es una quitada y una anadida', () => {
  assert.deepEqual(countLineChanges('a\nb\nc\n', 'a\nB\nc\n'), { added: 1, removed: 1 });
});

test('lineas anadidas en medio', () => {
  assert.deepEqual(countLineChanges('a\nc\n', 'a\nb\nb2\nc\n'), { added: 2, removed: 0 });
});

test('lineas quitadas al final', () => {
  assert.deepEqual(countLineChanges('a\nb\nc\nd\n', 'a\nb\n'), { added: 0, removed: 2 });
});

test('un fichero nuevo lo anade entero, uno borrado lo quita entero', () => {
  assert.deepEqual(countLineChanges('', 'a\nb\n'), { added: 2, removed: 0 });
  assert.deepEqual(countLineChanges('a\nb\n', ''), { added: 0, removed: 2 });
});

test('el salto de linea final no es una linea, y perderlo no es un cambio', () => {
  assert.deepEqual(countLineChanges('a\nb\n', 'a\nb'), { added: 0, removed: 0 });
});

test('los retornos de carro no cuentan', () => {
  assert.deepEqual(countLineChanges('a\r\nb\r\n', 'a\nb\n'), { added: 0, removed: 0 });
});

test('un bloque movido cuesta lo que cuesta en un diff: quitado y anadido', () => {
  assert.deepEqual(countLineChanges('x\na\nb\n', 'a\nb\nx\n'), { added: 1, removed: 1 });
});

test('mas alla del tope la cuenta sigue siendo un numero honesto', () => {
  const lines = MAX_EDITS + 10;
  const before = Array.from({ length: lines }, (_, i) => `old ${i}`).join('\n');
  const after  = Array.from({ length: lines }, (_, i) => `new ${i}`).join('\n');
  assert.deepEqual(countLineChanges(before, after), { added: lines, removed: lines });
});
