import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalDataProvider, UnsupportedFeatureError } from '../src/realgrid-compat.js';

test('provider maps fields and array/object rows, typed values and inclusive ranges', () => {
  const provider = new LocalDataProvider(true);
  provider.setFields([{ fieldName: 'name' }, { fieldName: 'qty', dataType: 'number', defaultValue: 1 }]);
  provider.setRows([['skip', 0], ['가', '1,234'], { name: '나' }], 1, 2);
  assert.equal(provider.getFieldIndex('QTY'), 1); assert.equal(provider.getFieldName(0), 'NAME'); assert.equal(provider.getOrgFieldName(0), 'name'); assert.equal(provider.getFieldCount(), 2);
  assert.deepEqual(provider.getJsonRows(0, 0), [{ name: '가', qty: 1234 }]); assert.deepEqual(provider.getRows(), [['가', 1234], ['나', 1]]);
  assert.deepEqual(provider.getFieldValues(1, 1), [1]); assert.equal(provider.rowCount, 2);
  const copy = provider.getJsonRows(); copy[0].qty = -9; assert.equal(provider.getValue(0, 'qty'), 1234);
});
test('provider CRUD shares atomic history and rejects invalid bulk loads before mutation', () => {
  const provider = new LocalDataProvider(true); provider.setFields([{ fieldName: 'a', dataType: 'number' }, 'b']); provider.setRows([[1, 'one'], [2, 'two']]);
  const events = []; provider.onValueChanged = (sender, row, field) => events.push([sender === provider, row, field]);
  provider.updateRow(1, { a: 7 }); assert.equal(provider.getValue(1, 1), 'two'); assert.deepEqual(events, [[true, 1, 0]]);
  provider.addRows([[3, 'three'], [4, 'four']]); assert.equal(provider.getRowCount(), 4); provider.undo(); assert.equal(provider.getRowCount(), 2); provider.redo();
  provider.removeRows([0, 2]); assert.deepEqual(provider.getFieldValues('a'), [7, 4]); provider.undo();
  assert.throws(() => provider.setRows([[9, 'ok'], ['bad', 'invalid']])); assert.equal(provider.getRowCount(), 4);
  assert.throws(() => provider.setFields(['other']));
  provider.clearCommandStack(); assert.equal(provider.undo(), false);
  provider.destroy(); assert.throws(() => provider.getRowCount());
});
test('unsupported compatibility arguments and operations fail explicitly', () => {
  const provider = new LocalDataProvider(); provider.setFields(['a']); provider.setRows([['one']]); provider.setValue(0, 'a', 'two'); assert.equal(provider.undo(), false);
  assert.throws(() => provider.getJsonRows(0, -1, true), UnsupportedFeatureError); assert.throws(() => provider.getRowState(0), UnsupportedFeatureError);
  assert.throws(() => provider.updateRow(0, {}, true), UnsupportedFeatureError); assert.throws(() => provider.setValue(0, 'unknown', 'x'));
  assert.throws(() => new LocalDataProvider({ undoable: true }), UnsupportedFeatureError);
});
