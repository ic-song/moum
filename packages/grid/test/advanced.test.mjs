import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { GridModel } from '../src/model.js';
import { matchesFilters, buildDisplay, treeIndex } from '../src/data-view.js';
import { readXLSX, writeXLSX } from '../src/xlsx.js';

const columns = [{ field: 'id', header: '코드', editable: false }, { field: 'name', header: '이름' }, { field: 'qty', header: '수량', type: 'number' }, { field: 'team', header: '부서' }];
const rows = [{ id: '1', name: '키보드', qty: 20, team: 'A' }, { id: '2', name: '마우스', qty: 3, team: 'A' }, { id: '3', name: '모니터', qty: 8, team: 'B' }];

test('Excel formatted numbers convert strictly, with malformed separators rejected atomically', () => {
  const model = new GridModel(columns, rows);
  for (const [input, expected] of [['1,234', 1234], ['12,345.50', 12345.5], ['−1,234', -1234], ['1e3', 1000]]) {
    model.apply([{ row: 0, field: 'qty', value: input }]); assert.equal(model.rows[0].qty, expected);
  }
  for (const input of ['1,23', '0x10', 'Infinity', '   ', true]) assert.throws(() => model.apply([{ row: 0, field: 'qty', value: input }]), /숫자/);
});

test('row insertion, cell edit and deletion share ordered undo/redo history', () => {
  const model = new GridModel(columns, rows);
  model.insertRows(1, [{ id: '4', name: '', qty: null, team: '' }]);
  model.apply([{ row: 1, field: 'name', value: '추가' }]);
  model.removeRows([0, 2]); assert.deepEqual(model.rows.map(row => row.id), ['4', '3']);
  model.undo(); model.undo(); model.undo(); assert.deepEqual(model.getData(), rows);
  model.redo(); model.redo(); model.redo(); assert.deepEqual(model.rows.map(row => row.id), ['4', '3']);
  model.undo(); model.apply([{ row: 1, field: 'name', value: '새 편집' }]); assert.equal(model.canRedo, false);
});

test('import replacement validates all values before mutation and is one undo transaction', () => {
  const model = new GridModel(columns, rows);
  assert.throws(() => model.replaceRows([{ id: 'X', name: '실패', qty: '숫자아님', team: '' }], 'import'), /숫자/);
  assert.deepEqual(model.getData(), rows); assert.equal(model.canUndo, false);
  model.replaceRows([{ id: 'X', name: '신규', qty: '1,200', team: 'C' }], 'import');
  assert.equal(model.rows[0].qty, 1200); model.undo(); assert.deepEqual(model.getData(), rows);
  model.redo(); assert.equal(model.rows[0].id, 'X');
});

test('structural change payloads cannot mutate stored history snapshots', () => {
  const model = new GridModel(columns, rows);
  const changes = model.replaceRows([{ id: 'X', name: '신규', qty: 1, team: '' }]);
  changes[0].previous[0].name = '이력 변조'; changes[0].value[0].name = '현재값 변조';
  assert.equal(model.rows[0].name, '신규'); model.undo(); assert.deepEqual(model.getData(), rows);
  const undo = model.redo(); undo[0].previous[0].name = '재실행 이력 변조'; model.undo(); assert.deepEqual(model.getData(), rows);
});

test('condition filters and multi-sort use raw types and stable source indices', () => {
  assert(matchesFilters(rows[0], [{ field: 'qty', operator: 'between', value: 10, value2: 30 }, { field: 'name', operator: 'contains', value: '보드' }]));
  assert(!matchesFilters(rows[1], [{ field: 'qty', operator: 'gt', value: 10 }]));
  assert(matchesFilters(rows[1], [{ field: 'qty', operator: 'gt', value: 10 }, { field: 'team', operator: 'equals', value: 'A' }], 'or'));
  assert(matchesFilters(rows[1], [], 'or'));
  const result = buildDisplay(rows, { columns, sorts: [{ field: 'team', direction: 1 }, { field: 'qty', direction: 1 }] });
  assert.deepEqual(result.view.map(item => item.index), [1, 0, 2]);
});

test('nested grouping computes per-group subtotals and collapsed groups hide only their members', () => {
  const result = buildDisplay(rows, { columns, groupBy: ['team'] });
  const first = result.display.find(item => item.type === 'group').group;
  assert.equal(first.summary.qty, 23); assert.equal(first.count, 2);
  const collapsed = buildDisplay(rows, { columns, groupBy: ['team'], collapsedGroups: new Set([first.key]) });
  assert.deepEqual(collapsed.view.map(item => item.row.id), ['3']);
  const nested = buildDisplay(rows, { columns, groupBy: ['team', 'name'] });
  assert.equal(nested.display.filter(item => item.type === 'summary').length, 5);
});

const tree = { idField: 'id', parentField: 'parent', labelField: 'name' };
const treeRows = [{ id: 'root', name: '본부', parent: '' }, { id: 'child', name: '팀', parent: 'root' }, { id: 'leaf', name: '키보드', parent: 'child' }];
test('tree rejects duplicate, missing parent and cyclic IDs', () => {
  assert.throws(() => treeIndex([...treeRows, treeRows[0]], tree), /중복/);
  assert.throws(() => treeIndex([{ id: 'a', parent: 'missing' }], tree), /상위/);
  assert.throws(() => treeIndex([{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }], tree), /순환/);
});
test('tree collapse, filtering with ancestors, and sibling sorting preserve hierarchy', () => {
  const collapsed = buildDisplay(treeRows, { columns, tree, collapsedNodes: new Set(['root']) });
  assert.deepEqual(collapsed.view.map(item => item.id), ['root']);
  const filtered = buildDisplay(treeRows, { columns, tree, query: '키보드', collapsedNodes: new Set(['root']) });
  assert.deepEqual(filtered.view.map(item => item.id), ['root', 'child', 'leaf']);
  assert.deepEqual(filtered.view.map(item => item.depth), [0, 1, 2]);
});
test('tree validation guards cell and structural transactions before mutation', () => {
  const model = new GridModel([{ field: 'id' }, { field: 'parent' }, { field: 'name' }], treeRows);
  model.validateRows = rows => treeIndex(rows, tree);
  assert.throws(() => model.apply([{ row: 0, field: 'parent', value: 'leaf' }]), /순환/);
  assert.throws(() => model.removeRows([0]), /상위/); assert.deepEqual(model.getData(), treeRows);
});

const sheetExports = {};
const sandbox = { module: { exports: sheetExports }, exports: sheetExports, Uint8Array, ArrayBuffer, Date };
vm.runInNewContext(fs.readFileSync(new URL('../vendor/sheetjs/xlsx.full.min.js', import.meta.url), 'utf8'), sandbox);
const XLSX = sandbox.module.exports;
test('real XLSX bytes roundtrip Korean, numeric values, multiline and formula-like text safely', () => {
  const source = [{ id: '00123', name: '첫줄\n둘째줄', qty: 1234.5, team: '=1+1' }];
  const bytes = writeXLSX(source, XLSX, columns);
  assert.equal(new Uint8Array(bytes)[0], 0x50); assert.equal(new Uint8Array(bytes)[1], 0x4b);
  assert.deepEqual(readXLSX(bytes, XLSX, columns), source);
  const book = XLSX.read(bytes, { type: 'array' }); const sheet = book.Sheets[book.SheetNames[0]];
  assert.equal(sheet.D2.t, 's'); assert.equal(sheet.D2.f, undefined);
});
test('XLSX import maps reordered headers, keeps text number formats and rejects duplicates', () => {
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([['수량', '코드', '이름'], [12, 123, '물품']]);
  sheet.B2.z = '00000'; XLSX.utils.book_append_sheet(book, sheet, '테스트');
  const imported = readXLSX(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), XLSX, columns);
  assert.deepEqual(imported, [{ id: '00123', name: '물품', qty: 12, team: '' }]);
  const duplicate = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(duplicate, XLSX.utils.aoa_to_sheet([['이름', '이름'], ['가', '나']]), '데이터');
  assert.throws(() => readXLSX(XLSX.write(duplicate, { type: 'array', bookType: 'xlsx' }), XLSX, columns), /중복/);
});

test('XLSX errors and uncached formulas cannot silently become numeric values or blanks', () => {
  for (const cell of [{ t: 'e', v: 7 }, { t: 'n', f: '1+1' }]) {
    const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([['수량'], [1]]); sheet.A2 = cell;
    XLSX.utils.book_append_sheet(book, sheet, '데이터');
    assert.throws(() => readXLSX(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), XLSX, columns), /오류 셀|계산 결과/);
  }
});

test('opt-in XLSX formulas preserve raw A1 addresses, absolute references, cached values and blank rows', () => {
  const fields = [{ field: 'a', type: 'number' }, { field: 'b', type: 'number' }];
  const source = [{ a: 2, b: '=$A$1*3' }, { a: null, b: null }, { a: 4, b: '=SUM(A1:A3)' }];
  const bytes = writeXLSX(source, XLSX, fields, { formulas: true });
  const sheet = XLSX.read(bytes, { type: 'array' }).Sheets['데이터'];
  assert.equal(sheet.B2.f, '$A$2*3'); assert.equal(sheet.B2.v, 6); assert.equal(sheet.B4.f, 'SUM(A2:A4)'); assert.equal(sheet.B4.v, 6);
  assert.deepEqual(readXLSX(bytes, XLSX, fields, { formulas: true }), source.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value ?? '']))));
  assert.throws(() => writeXLSX([{ a: '=A1', b: 1 }], XLSX, fields, { formulas: true }), /CYCLE/);
  assert.throws(() => readXLSX(bytes, XLSX, [...fields].reverse(), { formulas: true }), /컬럼 순서/);
});
