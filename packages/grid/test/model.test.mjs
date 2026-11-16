import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GridModel, parseTSV, toTSV } from '../src/model.js';

const columns = [
  { field: 'id', editable: false },
  { field: 'name' },
  { field: 'qty', type: 'number', validate: value => value < 0 ? '수량 오류' : null }
];
const sample = [{ id: 'A', name: '가', qty: 3 }, { id: 'B', name: '나', qty: 4 }];
const create = options => new GridModel(columns, sample, options);

test('bulk paste is one undo/redo transaction, preserving readonly fields', () => {
  const model = create();
  model.apply([
    { row: 0, field: 'id', value: '변경 불가' },
    { row: 0, field: 'name', value: '새 이름' },
    { row: 0, field: 'qty', value: '12' },
    { row: 1, field: 'name', value: '둘째' },
    { row: 1, field: 'qty', value: '24' }
  ], 'paste');
  assert.deepEqual(model.getData(), [{ id: 'A', name: '새 이름', qty: 12 }, { id: 'B', name: '둘째', qty: 24 }]);
  assert.equal(model.past.length, 1);
  model.undo(); assert.deepEqual(model.getData(), sample);
  model.redo(); assert.equal(model.getData()[1].qty, 24);
  assert.deepEqual(sample, [{ id: 'A', name: '가', qty: 3 }, { id: 'B', name: '나', qty: 4 }]);
});

test('bulk Delete clears values without removing rows, and is undoable', () => {
  const model = create();
  model.apply(sample.flatMap((_, row) => columns.map(({ field }) => ({ row, field, value: '' }))), 'clear');
  assert.deepEqual(model.getData(), [{ id: 'A', name: '', qty: null }, { id: 'B', name: '', qty: null }]);
  model.undo(); assert.deepEqual(model.getData(), sample);
  model.redo(); assert.equal(model.getData()[0].qty, null);
});

test('invalid value rejects entire transaction and does not clear redo history', () => {
  const model = create();
  model.apply([{ row: 0, field: 'name', value: '수정' }]); model.undo();
  assert.throws(() => model.apply([{ row: 0, field: 'name', value: '부분 반영 금지' }, { row: 1, field: 'qty', value: '문자' }]), /숫자/);
  assert.deepEqual(model.getData(), sample); assert.equal(model.canRedo, true);
  assert.throws(() => model.apply([{ row: 0, field: 'qty', value: -1 }]), /수량 오류/);
});

test('new change after undo invalidates redo; no-op does not consume history', () => {
  const model = create();
  model.apply([{ row: 0, field: 'name', value: 'x' }]); model.undo();
  model.apply([{ row: 0, field: 'name', value: '가' }]); assert.equal(model.canRedo, true);
  model.apply([{ row: 1, field: 'name', value: 'y' }]); assert.equal(model.canRedo, false);
});

test('required field prevents Delete and all other cells stay unchanged', () => {
  const model = new GridModel([{ field: 'name', required: true }, { field: 'qty', type: 'number' }], sample);
  assert.throws(() => model.apply([{ row: 0, field: 'qty', value: '' }, { row: 0, field: 'name', value: '' }]), /필수/);
  assert.deepEqual(model.getData(), sample);
});

test('readonly grid ignores all changes', () => {
  const model = create({ editable: false });
  assert.deepEqual(model.apply([{ row: 0, field: 'name', value: 'x' }]), []);
  assert.deepEqual(model.getData(), sample); assert.equal(model.canUndo, false);
});

test('replacement clears history and copies row containers', () => {
  const model = create(); model.apply([{ row: 0, field: 'qty', value: 8 }]);
  const rows = [{ id: 'C', name: '다', qty: 10 }]; model.setData(rows);
  model.getData()[0].name = '외부 수정'; rows[0].qty = 99;
  assert.deepEqual(model.getData(), [{ id: 'C', name: '다', qty: 10 }]);
  assert.equal(model.canUndo, false); assert.equal(model.canRedo, false);
});

test('transaction bounds and duplicated targets reject before mutation', () => {
  const model = create();
  assert.throws(() => model.apply([{ row: 0, field: 'name', value: 'x' }, { row: 99, field: 'qty', value: 1 }]), /위치/);
  assert.throws(() => model.apply([{ row: 0, field: 'name', value: 'x' }, { row: 0, field: 'name', value: 'y' }]), /중복/);
  assert.deepEqual(model.getData(), sample);
});

test('history limit discards oldest transactions', () => {
  const model = create({ historyLimit: 2 });
  for (const value of [1, 2, 5]) model.apply([{ row: 0, field: 'qty', value }]);
  model.undo(); model.undo(); model.undo(); assert.equal(model.getData()[0].qty, 1);
});

test('unsafe or duplicate field names are rejected', () => {
  for (const field of ['__proto__', 'constructor', 'prototype', '']) assert.throws(() => new GridModel([{ field }]), /field/);
  assert.throws(() => new GridModel([{ field: 'a' }, { field: 'a' }]), /field/);
});

test('boolean conversion is explicit and rejects arbitrary text', () => {
  const model = new GridModel([{ field: 'enabled', type: 'boolean' }], [{ enabled: false }]);
  model.apply([{ row: 0, field: 'enabled', value: 'true' }]); assert.equal(model.rows[0].enabled, true);
  model.apply([{ row: 0, field: 'enabled', value: ' FALSE ' }]); assert.equal(model.rows[0].enabled, false);
  model.apply([{ row: 0, field: 'enabled', value: 'TRUE' }]); assert.equal(model.rows[0].enabled, true);
  assert.throws(() => model.apply([{ row: 0, field: 'enabled', value: 'yes' }]), /true/);
});

test('Excel TSV roundtrip preserves tabs, multiline, quotes, empty trailing cells and Korean', () => {
  const rows = [['한글', '탭\t문자', '첫줄\n둘째줄', '"인용"', ''], ['둘', '', '', '', '끝']];
  assert.deepEqual(parseTSV(toTSV(rows)), rows);
  assert.deepEqual(parseTSV('A\tB\r\nC\tD\r\n'), [['A', 'B'], ['C', 'D']]);
  assert.deepEqual(parseTSV('a\t\r\n'), [['a', '']]);
  assert.deepEqual(parseTSV('\uFEFF가\t나'), [['가', '나']]);
  assert.deepEqual(parseTSV(''), [['']]);
  assert.deepEqual(parseTSV('"첫줄\r\n둘째줄"\t끝\r\n'), [['첫줄\n둘째줄', '끝']]);
  assert.throws(() => parseTSV('"닫히지 않음'), /따옴표/);
});
