import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeDeliveries } from '../src/deliveries.js';

const lines = [{ id: 'first', dueDate: '2026-11-20', quantity: 0.5 }, { id: 'second', dueDate: '2026-11-23', quantity: 0.2 }];
const receipts = [
  { id: 'r1', lineId: 'first', date: '2026-11-20', quantity: 0.1 },
  { id: 'r2', lineId: 'first', date: '2026-11-23', quantity: 0.2 },
  { id: 'r3', lineId: 'second', date: '2026-11-23', quantity: 0.3 },
  { id: 'r4', lineId: 'first', date: '2026-11-24', quantity: 0.2 }
];

test('split deliveries count multiple receipts, preserve decimal precision and isolate excess by line', () => {
  const report = summarizeDeliveries(lines, receipts, { asOf: '2026-11-23' });
  assert.deepEqual(report.lines, [
    { id: 'first', dueDate: '2026-11-20', planned: 0.5, received: 0.3, open: 0.2, excess: 0, overdue: 0.2 },
    { id: 'second', dueDate: '2026-11-23', planned: 0.2, received: 0.3, open: 0, excess: 0.1, overdue: 0 }
  ]);
  assert.deepEqual(report.totals, { planned: 0.7, received: 0.6, open: 0.2, excess: 0.1, overdue: 0.2 });
  assert.deepEqual(summarizeDeliveries(lines, receipts).totals, { planned: 0.7, received: 0.8, open: 0, excess: 0.1, overdue: 0 });
});

test('invalid, duplicate and precision-losing receipts are rejected', () => {
  for (const receipt of [
    { ...receipts[0], lineId: 'missing' },
    { ...receipts[0], quantity: 0.0001 },
    { ...receipts[0], quantity: -1 },
    { ...receipts[0], date: '2026-11-31' }
  ]) assert.throws(() => summarizeDeliveries(lines, [receipt]));
  assert.throws(() => summarizeDeliveries(lines, [receipts[0], receipts[0]]), /중복/);
  assert.throws(() => summarizeDeliveries([...lines, lines[0]], []), /중복/);
  assert.equal(summarizeDeliveries(lines, []).totals.open, 0.7);
  assert.equal(summarizeDeliveries(lines, [], { asOf: '2026-11-23' }).totals.overdue, 0.5);
});
