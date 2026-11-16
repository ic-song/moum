import test from 'node:test';
import assert from 'node:assert/strict';
import { rowWindow } from '../src/row-window.js';
import { buildDisplay } from '../src/data-view.js';
const columns = [{ field: 'id' }, { field: 'n', type: 'number' }];
const rows = Array.from({ length: 103 }, (_, index) => ({ id: String(index), n: index }));
const result = buildDisplay(rows, { columns, sorts: [{ field: 'n', direction: -1 }] });
test('pagination slices sorted visible records without changing source indices and clamps after deletion', () => {
  const page = rowWindow(result, { mode: 'pagination', pageSize: 25, pageIndex: 1 });
  assert.equal(page.view.length, 25); assert.equal(page.view[0].index, 77); assert.equal(page.view[0].position, 25); assert.equal(page.display[0].viewIndex, 0); assert.equal(page.state.pageCount, 5);
  assert.equal(rowWindow(result, { mode: 'pagination', pageSize: 25, pageIndex: 99 }).view.length, 3);
  assert.equal(rowWindow({ display: [], view: [] }, { mode: 'pagination' }).state.pageIndex, 0);
});
test('infinite window exposes loaded records in batches and all mode keeps the complete result', () => {
  assert.equal(rowWindow(result, { mode: 'infinite', pageSize: 25 }).view.length, 25);
  const next = rowWindow(result, { mode: 'infinite', pageSize: 25, loaded: 50 }); assert.equal(next.view.length, 50); assert.equal(next.state.hasMore, true);
  assert.equal(rowWindow(result, { mode: 'infinite', loaded: 200 }).state.hasMore, false);
  assert.equal(rowWindow(result).view.length, 103);
});
test('group rows count toward page size and data cells retain correct indices', () => {
  const grouped = buildDisplay(rows, { columns, groupBy: ['id'] });
  const page = rowWindow(grouped, { mode: 'pagination', pageSize: 4, pageIndex: 1 });
  assert.equal(page.display.length, 4); assert.deepEqual(page.view.map(item => item.index), [1, 2]); assert.deepEqual(page.display.filter(item => item.type === 'data').map(item => item.viewIndex), [0, 1]);
  for (const pageSize of [0, 1.5, 10001, NaN]) assert.throws(() => rowWindow(result, { pageSize }));
  assert.throws(() => rowWindow(result, { mode: 'unknown' }));
});
