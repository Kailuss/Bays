import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adoptableEntries, HANDOFF_MARK } from '../utils/handoffRules';

// Lo que ofrece la carcasa de `Lovervoid.bays` llega de OTRA extensión: estos
// casos fijan que solo se rellenan huecos y que nada ajeno entra en el almacén.

test('adoptableEntries: toma las claves propias que aún no hay', () => {
  const offered = { 'bays.viewPrefs': { compactMode: true }, 'bays.groupCustomizations': { 1: { label: 'API' } } };
  assert.deepEqual(adoptableEntries(offered, []), [
    ['bays.groupCustomizations', { 1: { label: 'API' } }],
    ['bays.viewPrefs', { compactMode: true }],
  ]);
});

test('adoptableEntries: lo ya guardado bajo el id nuevo gana', () => {
  const offered = { 'bays.viewPrefs': { compactMode: true }, 'bays.groupCustomizations': {} };
  assert.deepEqual(adoptableEntries(offered, ['bays.viewPrefs']), [['bays.groupCustomizations', {}]]);
});

test('adoptableEntries: ni claves ajenas ni la marca del traspaso', () => {
  const offered = { 'other.key': 1, [HANDOFF_MARK]: true, 'bays.viewPrefs': {} };
  assert.deepEqual(adoptableEntries(offered, []), [['bays.viewPrefs', {}]]);
});

test('adoptableEntries: una oferta que no es un objeto no adopta nada', () => {
  for (const offered of [undefined, null, 'bays.viewPrefs', 42, [['bays.viewPrefs', {}]]]) {
    assert.deepEqual(adoptableEntries(offered, []), []);
  }
});

test('adoptableEntries: un valor undefined no se escribe', () => {
  assert.deepEqual(adoptableEntries({ 'bays.viewPrefs': undefined }, []), []);
});
