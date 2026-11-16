import test from 'node:test';
import assert from 'node:assert/strict';
import { GridModel } from '../src/model.js';
import { RemoteData } from '../src/remote-data.js';
import { RemoteChanges } from '../src/remote-changes.js';

const rows = [{ id: 'A', _version: 1, name: 'one', qty: 1 }, { id: 'B', _version: 2, name: 'two', qty: 2 }];
function setup(save) {
  const model = new GridModel([{ field: 'id' }, { field: 'name', required: true }, { field: 'qty', type: 'number' }], rows);
  const remote = new RemoteData({ load: () => {}, save, timeoutMs: 20 });
  const changes = new RemoteChanges(remote, model); changes.reset(rows); return { model, changes, remote };
}
test('server change journal collapses edits, creates/deletes and model undo/redo', () => {
  const { model, changes } = setup();
  assert.equal(model.columns[0].editable, false);
  model.apply([{ row: 0, field: 'name', value: 'edit' }]); assert.equal(changes.getChanges().updated.length, 1);
  model.undo(); assert.equal(changes.dirty, false); model.redo(); assert.equal(changes.dirty, true);
  model.removeRows([0]); assert.deepEqual(changes.getChanges().deleted, [{ key: 'A', version: 1 }]); assert.equal(changes.getChanges().updated.length, 0);
  model.insertRows(1, [changes.newRow({ name: 'new', qty: 3 })]); assert.equal(changes.getChanges().created.length, 1);
  model.removeRows([1]); assert.equal(changes.getChanges().created.length, 0);
  model.undo(); model.undo(); model.undo(); model.undo(); assert.equal(changes.dirty, false);
});
test('server saves deduplicate and validate canonical receipts before applying', async () => {
  let calls = 0;
  const { model, changes } = setup(async batch => { calls++; return { requestId: batch.requestId, created: batch.created.map(item => ({ clientId: item.clientId, row: { id: 'C', _version: 1, ...item.values } })), updated: [{ id: 'A', _version: 2, name: 'canonical', qty: 1 }], deleted: ['B'] }; });
  model.apply([{ row: 0, field: 'name', value: 'edit' }]); model.removeRows([1]); model.insertRows(1, [changes.newRow({ name: 'new', qty: 3 })]);
  const pending = changes.save(() => {}); assert.equal(changes.save(() => {}), pending);
  const saved = await pending; assert.equal(calls, 1); assert.equal(saved[0].name, 'canonical'); assert.equal(saved[1].id, 'C'); assert.equal(changes.status, 'refresh');
});
test('unknown outcome freezes exact payload and reuses request ID until acknowledged', async () => {
  const batches = []; let fail = true;
  const { model, changes } = setup(async batch => { batches.push(structuredClone({ ...batch, signal: undefined })); if (fail) { fail = false; throw Error('network lost'); } return { requestId: batch.requestId, created: [], updated: [{ id: 'A', _version: 2, name: 'edit', qty: 1 }], deleted: [] }; });
  model.apply([{ row: 0, field: 'name', value: 'edit' }]); assert.equal(await changes.save(() => {}), null); assert.equal(changes.status, 'uncertain'); assert.equal(changes.locked, true);
  assert.ok(await changes.save(() => {})); assert.deepEqual(batches[0], batches[1]);
});
test('atomic rejection keeps changes editable; timeout/malformed receipt remain uncertain', async () => {
  const { model, changes, remote } = setup(() => { throw Object.assign(Error('conflict'), { committed: false }); });
  model.apply([{ row: 0, field: 'name', value: 'edit' }]); await changes.save(() => {}); assert.equal(changes.status, 'error'); assert.equal(changes.locked, false); assert.equal(changes.dirty, true);
  remote.source.save = () => new Promise(() => {}); await changes.save(() => {}); assert.equal(changes.status, 'uncertain'); assert.match(changes.error, /초과/);
  remote.source.save = batch => ({ requestId: batch.requestId, created: [], updated: [{ ...rows[0] }], deleted: [] });
  await changes.save(() => {}); assert.equal(changes.status, 'uncertain'); assert.equal(model.rows[0].name, 'edit');
});
test('required drafts and protected version/key changes reject before transport', async () => {
  let calls = 0; const { model, changes } = setup(() => { calls++; });
  model.insertRows(2, [changes.newRow({ name: '', qty: 3 })]); await changes.save(() => {}); assert.equal(calls, 0); assert.equal(changes.status, 'error');
  assert.throws(() => changes.validateVersions([{ ...rows[0], _version: 0 }]));
  model.rows[0].id = 'evil'; assert.throws(() => changes.getChanges());
});
test('receipt key collisions, missing fields and mismatched deletion acknowledgements reject atomically', () => {
  const { model, changes } = setup(); model.insertRows(2, [changes.newRow({ name: 'new', qty: 1 })]);
  const batch = changes.prepare(), result = { requestId: batch.requestId, created: [{ clientId: batch.created[0].clientId, row: { id: 'A', _version: 1, name: 'new', qty: 1 } }], updated: [], deleted: [] };
  assert.throws(() => changes.receipt(result, batch), /중복/);
  assert.throws(() => changes.receipt({ ...result, created: [] }, batch), /일치/);
  assert.throws(() => changes.receipt({ ...result, requestId: 'wrong' }, batch), /일치/);
  assert.throws(() => changes.receipt({ ...result, created: [{ clientId: batch.created[0].clientId, row: { id: 'C', _version: 1, name: 'new' } }] }, batch), /일치/);
  assert.equal(model.rows[2].id, '');
});
