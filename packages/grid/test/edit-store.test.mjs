import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, unlink, rmdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EditStore } from '../../../scripts/edit-store.mjs';

test('durable demo batch is atomic, versioned, idempotent after restart and serialized', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'moum-store-')), file = path.join(directory, 'store.json');
  try {
    const store = new EditStore(file), batch = { requestId: 'test-save-0001', created: [{ clientId: 'client-00001', values: { name: ' 새 품목 ', category: '사무', qty: 2, price: 100 } }], updated: [{ key: 'R00001', version: 1, values: { qty: 9 } }], deleted: [{ key: 'R00002', version: 1 }] };
    const receipt = await store.save(batch); assert.equal(receipt.created[0].row.name, '새 품목'); assert.equal(receipt.updated[0]._version, 2); assert.deepEqual(receipt.deleted, ['R00002']);
    const restarted = new EditStore(file); assert.deepEqual(await restarted.save(batch), receipt); assert.equal((await restarted.read()).length, 123);
    await assert.rejects(restarted.save({ ...batch, deleted: [] }), { code: 'CONFLICT' });
    const before = await restarted.read();
    await assert.rejects(restarted.save({ ...batch, requestId: 'test-conflict-02', updated: [{ key: 'R00001', version: 1, values: { qty: 20 } }], deleted: [] }), { code: 'CONFLICT' }); assert.deepEqual(await restarted.read(), before);
    await assert.rejects(restarted.save({ ...batch, requestId: 'test-invalid-03', updated: [], deleted: [], created: [...batch.created, { clientId: 'client-00002', values: { name: '', category: '사무', qty: 2, price: 1 } }] }), { code: 'VALIDATION' }); assert.deepEqual(await restarted.read(), before);
    const race = await Promise.allSettled([1, 2].map(i => restarted.save({ requestId: `concurrent-${i}`, created: [], deleted: [], updated: [{ key: 'R00001', version: 2, values: { qty: i } }] })));
    assert.equal(race.filter(item => item.status === 'fulfilled').length, 1); assert.equal(race.filter(item => item.status === 'rejected')[0].reason.code, 'CONFLICT');
    assert.equal((await new EditStore(file).read()).find(row => row.id === 'R00001')._version, 3);
  } finally { await unlink(file).catch(() => {}); await rmdir(directory); }
});
test('corrupt demo persistence never resets existing data silently', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'moum-corrupt-')), file = path.join(directory, 'store.json');
  try { await writeFile(file, '{broken'); await assert.rejects(new EditStore(file).read(), SyntaxError); }
  finally { await unlink(file); await rmdir(directory); }
});
