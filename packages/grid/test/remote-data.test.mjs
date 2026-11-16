import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteData } from '../src/remote-data.js';
const criteria = { query: '', sorts: [], filters: [], filterLogic: 'and' };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = (offset, limit, total = 63) => ({ total, rows: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => ({ id: offset + i, name: `행 ${offset + i}` })) });

test('remote paging forwards criteria and signal and clamps a page after server-side deletion', async () => {
  const requests = []; let total = 63;
  const remote = new RemoteData({ load: async request => { requests.push(request); return response(request.offset, request.limit, total); } });
  assert.equal(await remote.configure({ ...criteria, query: '한글', sorts: [{ field: 'id', direction: -1 }] }, 'pagination', 25), true);
  assert.equal(requests[0].query, '한글'); assert.ok(requests[0].signal instanceof AbortSignal); assert.equal(await remote.page(2), true); assert.equal(remote.rows.length, 13); assert.equal(remote.offset, 50);
  total = 20; assert.equal(await remote.reload(), true); assert.equal(remote.offset, 0); assert.equal(remote.rows.length, 20); assert.equal(remote.total, 20);
});
test('a stale response is ignored even when transport ignores abort, and criteria are snapshotted', async () => {
  const pending = [], remote = new RemoteData({ load: request => { const entry = deferred(); pending.push({ request, ...entry }); return entry.promise; } });
  const first = remote.configure(criteria, 'pagination', 25); await Promise.resolve();
  const next = { ...criteria, query: 'new' }, second = remote.configure(next, 'pagination', 25); next.query = 'changed outside'; await Promise.resolve();
  assert.equal(pending[0].request.signal.aborted, true); assert.equal(pending[1].request.query, 'new');
  pending[1].resolve(response(0, 25, 1)); assert.equal(await second, true); pending[0].resolve(response(0, 25, 63)); assert.equal(await first, false); assert.equal(remote.total, 1);
});
test('infinite loads deduplicate requests, preserve rows on failure, retry exactly the missing batch and stop', async () => {
  let calls = 0, fail = true; const gate = deferred();
  const remote = new RemoteData({ load: async request => { calls++; if (request.offset === 25) { await gate.promise; if (fail) throw Error('일시 오류'); } return response(request.offset, request.limit, 53); } });
  await remote.configure(criteria, 'infinite', 25); const first = remote.more(), second = remote.more(); assert.equal(first, second); gate.resolve(); assert.equal(await first, false); assert.equal(calls, 2); assert.equal(remote.rows.length, 25);
  assert.equal(remote.error, '일시 오류'); assert.equal(await remote.more(), false); fail = false; assert.equal(await remote.retry(), true); assert.equal(remote.rows.length, 50);
  await remote.more(); assert.equal(remote.rows.length, 53); assert.equal(await remote.more(), false);
});
test('invalid totals, partial batches, duplicate keys and bad rows reject before appending', async () => {
  for (const bad of [{ total: -1, rows: [] }, { total: 10, rows: [] }, { total: 1, rows: [{}] }, { total: 1, rows: [null] }, { total: 2, rows: [{ id: 1 }, { id: '1' }] }]) {
    const remote = new RemoteData({ load: async () => bad }); assert.equal(await remote.configure(criteria, 'infinite', 25), false); assert.equal(remote.rows.length, 0); assert.ok(remote.error);
  }
  const remote = new RemoteData({ load: async request => request.offset ? { total: 2, rows: [{ id: 0 }] } : response(0, 1, 2) });
  await remote.configure(criteria, 'infinite', 1); assert.equal(await remote.more(), false); assert.equal(remote.rows.length, 1);
});
test('disposal aborts an in-flight request and prevents callbacks and data mutation', async () => {
  const gate = deferred(); let notifications = 0, signal;
  const remote = new RemoteData({ load: request => { signal = request.signal; return gate.promise; } }, { onChange: () => notifications++ });
  const promise = remote.configure(criteria, 'pagination', 25); await Promise.resolve(); remote.dispose(); gate.resolve(response(0, 25)); assert.equal(await promise, false); assert.equal(signal.aborted, true); assert.equal(notifications, 1); assert.equal(remote.rows.length, 0);
});

test('timeout releases a hanging transport even if it ignores abort and allows retry', async () => {
  let calls = 0;
  const remote = new RemoteData({ timeoutMs: 15, load: () => ++calls === 1 ? new Promise(() => {}) : Promise.resolve(response(0, 25, 1)) });
  assert.equal(await remote.configure(criteria, 'pagination', 25), false); assert.match(remote.error, /초과/); assert.equal(remote.loading, false);
  assert.equal(await remote.retry(), true); assert.equal(remote.rows.length, 1);
});

test('continued server shrink rejects an invalid redirected page and a fresh retry can recover', async () => {
  let calls = 0;
  const remote = new RemoteData({ load: async request => response(request.offset, request.limit, ++calls === 1 ? 63 : calls === 2 ? 50 : 1) });
  await remote.configure(criteria, 'pagination', 25); assert.equal(await remote.page(2), false); assert.equal(remote.total, 63); assert.equal(remote.rows.length, 25);
  assert.equal(await remote.retry(), true); assert.equal(remote.total, 1); assert.equal(remote.offset, 0);
});

test('duplicate IDs are checked after column type conversion across batches', async () => {
  const remote = new RemoteData({ load: async () => ({ rows: [{ id: '01' }], total: 2 }) }, { convertRow: row => ({ ...row, id: Number(row.id) }) });
  await remote.configure(criteria, 'infinite', 1); assert.equal(await remote.more(), false); assert.equal(remote.rows.length, 1);
});
