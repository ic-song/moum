import test from 'node:test';
import assert from 'node:assert/strict';
import { DraftRecovery } from '../src/draft-recovery.js';

class MemoryDrafts {
  records = new Map();
  async list(key) { return [...this.records.values()].filter(item => item.key === key).map(item => structuredClone(item)); }
  async put(record) { if (this.failure) throw Error('quota'); await this.wait; this.records.set(record.id, structuredClone(record)); }
  async remove(id, expected) { const current = this.records.get(id); if (expected && current && (current.data !== expected.data || current.updatedAt !== expected.updatedAt)) return false; this.records.delete(id); return true; }
  close() {}
}
const snapshot = value => ({ format: 1, kind: 'local', rows: [{ name: value }], baseline: [{ name: 'base' }], editor: null });
const create = (storage, key = 'user:dataset', schema = 'v1') => new DraftRecovery({ key }, { schema, storage });
test('draft writes drain the latest edit and survive a new controller without overwriting another tab', async () => {
  const storage = new MemoryDrafts(), first = create(storage), second = create(storage); await Promise.all([first.ready, second.ready]);
  first.write(snapshot('one')); second.write(snapshot('two')); await Promise.all([first.flush(), second.flush()]); assert.equal(storage.records.size, 2);
  const reloaded = create(storage); await reloaded.ready; assert.equal(reloaded.awaiting, true); assert.equal(reloaded.getState().candidates, 2); assert.equal(reloaded.write(snapshot('overwrite')), false);
  const id = first.id; assert.equal(reloaded.read(id).rows[0].name, 'one'); reloaded.adopt(id); reloaded.write(snapshot('recovered')); assert.equal(await reloaded.flush(), true);
  assert.equal(storage.records.has(id), false); assert.equal(storage.records.get(second.id).data, JSON.stringify(snapshot('two'))); assert.equal(storage.records.size, 2);
});
test('draft records are account scoped and incompatible/corrupt snapshots stay recoverable for export', async () => {
  const storage = new MemoryDrafts(), first = create(storage); await first.ready; first.write(snapshot('value')); await first.flush();
  const other = create(storage, 'another-user'); await other.ready; assert.equal(other.awaiting, false);
  const changed = create(storage, 'user:dataset', 'v2'); await changed.ready; assert.throws(() => changed.read(first.id), /스키마/); assert.equal(storage.records.size, 1);
  storage.records.get(first.id).data = '{broken'; const broken = create(storage); await broken.ready; assert.throws(() => broken.read(first.id), SyntaxError); assert.equal(storage.records.size, 1);
});
test('quota failure preserves prior data, retry succeeds, oversized input is explicit and clean state removes only own draft', async () => {
  const storage = new MemoryDrafts(), draft = create(storage); await draft.ready; draft.write(snapshot('before')); await draft.flush();
  storage.failure = true; draft.write(snapshot('after')); assert.equal(await draft.flush(), false); assert.match(draft.error, /quota/); assert.equal(JSON.parse(storage.records.get(draft.id).data).rows[0].name, 'before');
  storage.failure = false; assert.equal(await draft.flush(), true); assert.equal(draft.write(snapshot('x'.repeat(3 * 1024 * 1024))), false); assert.equal(await draft.flush(), false);
  draft.write(null); assert.equal(await draft.flush(), true); assert.equal(storage.records.size, 0);
});
test('discard and adoption never delete a concurrently updated source record', async () => {
  const storage = new MemoryDrafts(), writer = create(storage); await writer.ready; writer.write(snapshot('first')); await writer.flush();
  const reader = create(storage); await reader.ready; writer.write(snapshot('later')); await writer.flush();
  await assert.rejects(reader.discard(writer.id), /다른 탭/); reader.adopt(writer.id); reader.write(snapshot('old recovered copy')); await reader.flush();
  assert.equal(JSON.parse(storage.records.get(writer.id).data).rows[0].name, 'later'); assert.equal(storage.records.size, 2);
});
test('rapid queued input and clean acknowledgement leave no stale draft', async () => {
  const storage = new MemoryDrafts(); let release; storage.wait = new Promise(resolve => { release = resolve; });
  const draft = create(storage); await draft.ready; draft.write(snapshot('first')); draft.write(snapshot('second')); draft.write(null); release();
  assert.equal(await draft.flush(), true); assert.equal(storage.records.size, 0);
});
