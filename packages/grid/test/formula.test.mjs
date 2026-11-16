import test from 'node:test';
import assert from 'node:assert/strict';
import { FormulaSheet, translateFormula } from '../src/formula.js';
import { GridModel } from '../src/model.js';
import { virtualWindow, columnWindow } from '../src/virtual.js';
const columns = [{ field: 'a', type: 'number' }, { field: 'b', type: 'number' }, { field: 'c' }];

test('formula references, ranges, lazy IF, strings and numeric functions', () => {
  const sheet = new FormulaSheet([{ a: 2, b: 3, c: '=SUM(A1:B1)^2' }, { a: '=AVERAGE(A1:B1)', b: '=IF(A1>0,ROUND(-1.25,1),1/0)', c: '="A1"&" 한글"' }], columns);
  assert.equal(sheet.cell(0, 2).value, 25); assert.equal(sheet.cell(1, 0).value, 2.5); assert.equal(sheet.cell(1, 1).value, -1.3); assert.equal(sheet.cell(1, 2).value, 'A1 한글');
});
test('formula errors propagate without evaluating script or external references', () => {
  for (const [formula, error] of [['=1/0', '#DIV/0!'], ['=Z99', '#REF!'], ['=fetch("x")', '#NAME?'], ['=window.alert(1)', '#PARSE!'], ['=SUM(', '#PARSE!'], ['=A1', '#CYCLE!'], ['=A1:A99999999', '#LIMIT!']]) {
    assert.equal(new FormulaSheet([{ a: formula }], columns).cell(0, 0).error, error, formula);
  }
  const sheet = new FormulaSheet([{ a: '=B1', b: '=A1', c: '=A1+1' }], columns); assert.equal(sheet.cell(0, 2).error, '#CYCLE!');
  assert.equal(new FormulaSheet([{ a: '=(10^999)>0' }], columns).cell(0, 0).error, '#NUM!');
});
test('raw expressions survive dependent recalculation, atomic validation, undo and row snapshots', () => {
  const model = new GridModel([{ field: 'a', type: 'number' }, { field: 'b', type: 'number', validate: value => value > 10 ? 'limit' : null }], [{ a: 2, b: '=A1*2' }], { formulas: true });
  model.apply([{ row: 0, field: 'a', value: 3 }]); assert.equal(model.getComputedData()[0].b, 6); assert.equal(model.getData()[0].b, '=A1*2');
  assert.throws(() => model.apply([{ row: 0, field: 'a', value: 9 }]), /limit/); assert.equal(model.rows[0].a, 3);
  model.undo(); assert.equal(model.getComputedData()[0].b, 4); model.redo(); assert.equal(model.getComputedData()[0].b, 6);
  model.insertRows(1, [{ a: 4, b: '=A2*2' }]); assert.equal(model.getComputedData()[1].b, 8); model.undo(); assert.equal(model.rows.length, 1); model.redo(); assert.equal(model.getComputedData()[1].b, 8);
  const literal = new GridModel(columns, [{ a: 1, c: '=A1' }]); assert.equal(literal.getComputedData()[0].c, '=A1');
});
test('relative references translate, absolute references and strings stay fixed', () => {
  assert.equal(translateFormula('=SUM(A1:$B$2)+$C3+D$4&"A1"', 2, 1), '=SUM(B3:$B$2)+$C5+E$4&"A1"');
  assert.equal(translateFormula('=$A$1+A2', 1, 0, { absolute: true }), '=$A$2+A3');
  assert.throws(() => translateFormula('=A1', -1, 0), /범위/);
});
test('virtual windows bound DOM rows and retain fixed columns with exact gap widths', () => {
  const window = virtualWindow(100000, 48000, 530); assert.equal(window.before + (window.end - window.start) * 48 + window.after, 4800000); assert.ok(window.end - window.start < 24);
  const cols = columnWindow(Array.from({ length: 200 }, (_, index) => ({ field: String(index), width: 100 })), 15000, 1000, 2);
  assert.deepEqual(cols.slots.slice(0, 2).map(slot => slot.col), [0, 1]); assert.ok(cols.slots.length < 20); assert.equal(cols.slots.reduce((sum, slot) => sum + slot.width, 48), 20048);
});
