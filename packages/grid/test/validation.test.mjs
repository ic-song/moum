import test from 'node:test';
import assert from 'node:assert/strict';
import { GridModel } from '../src/model.js';
import { Grid } from '../src/grid.js';

test('row validator receives normalized fields after cell checks and preserves original values', () => {
  const calls = [];
  const model = new GridModel([{ field: 'min', type: 'number' }, { field: 'max', type: 'number' }], [
    { min: '1,200', max: '=4+5' }, { min: 'bad', max: 0 }, { min: 1, max: 2 }
  ], {
    formulas: true,
    validateRow(values, index) {
      calls.push([values.min, values.max, index]);
      if (values.min > values.max) return '최대값은 최소값 이상이어야 합니다.';
    }
  });
  assert.deepEqual(model.validate().errors.map(({ row, field }) => [row, field]), [[0, null], [1, 'min']]);
  assert.deepEqual(calls, [[1200, 9, 0], [1, 2, 2]]);
  assert.equal(model.getData()[0].min, '1,200');
  assert.equal(model.getData()[0].max, '=4+5');
});

test('validation collects every invalid committed cell without changing data or history', () => {
  const model = new GridModel([
    { field: 'name', required: true, editable: false },
    { field: 'qty', type: 'number', validate: value => value < 0 && '음수 금지' },
    { field: 'active', type: 'boolean' }
  ], [{ name: '', qty: 'oops', active: 'unknown' }, { name: 'B', qty: -1, active: true }]);
  const before = model.getData(), revision = model.revision;
  let notifications = 0; model.subscribe(() => notifications++);
  const result = model.validate();
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map(({ row, field }) => [row, field]), [[0, 'name'], [0, 'qty'], [0, 'active'], [1, 'qty']]);
  assert.equal(result.errors[3].message, '음수 금지');
  assert.equal(result.errors[1].value, 'oops');
  assert.deepEqual(model.getData(), before);
  assert.equal(model.revision, revision);
  assert.equal(notifications, 0);
  assert.equal(model.canUndo, false);
  assert.deepEqual(Grid.prototype.validate.call({ model }), result);
});

test('validation checks formula results, errors, required blanks and opt-out columns', () => {
  const model = new GridModel([
    { field: 'qty', type: 'number', required: true, validate: value => value < 0 && '음수 금지' },
    { field: 'note', formulas: false }
  ], [{ qty: '=1/0', note: '=1/0' }, { qty: '=-1', note: '' }, { qty: '=1+2', note: '' }, { qty: '', note: '' }], { formulas: true });
  assert.deepEqual(model.validate().errors.map(({ row, message }) => [row, message]), [[0, '#DIV/0!'], [1, '음수 금지'], [3, 'qty: 필수 값입니다.']]);
  model.setData([{ qty: '=1+2', note: '=1/0' }]);
  assert.deepEqual(model.validate(), { valid: true, errors: [] });
});

test('validation supports empty/read-only models, conversion and preserves undo/redo', () => {
  const columns = [{ field: 'qty', type: 'number' }];
  assert.deepEqual(new GridModel(columns).validate(), { valid: true, errors: [] });
  assert.equal(new GridModel(columns, [{ qty: 'bad' }], { editable: false }).validate().valid, false);
  const model = new GridModel(columns, [{ qty: '1,200' }]);
  model.apply([{ row: 0, field: 'qty', value: 3 }]); model.undo();
  assert.equal(model.validate().valid, true);
  assert.equal(model.getData()[0].qty, '1,200');
  assert.equal(model.canRedo, true); model.redo();
  assert.equal(model.getData()[0].qty, 3);
});
