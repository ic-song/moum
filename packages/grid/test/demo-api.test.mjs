import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleDemoAPI } from '../../../scripts/demo-api.mjs';

test('real HTTP demo applies offset, server criteria, complete export and reduced totals', async t => {
  const server = http.createServer(async (request, response) => { if (!await handleDemoAPI(request, response, new URL(request.url, 'http://localhost'))) { response.writeHead(404); response.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/grid`;
  const post = async data => { const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: response.status, ...await response.json() }; };
  let result = await post({ offset: 100, limit: 25 }); assert.equal(result.status, 200); assert.equal(result.total, 1023); assert.equal(result.rows.length, 25); assert.equal(result.rows[0].id, 'R00101');
  const criteria = { offset: 0, limit: 25, sorts: [{ field: 'qty', direction: -1 }], filters: [{ field: 'qty', operator: 'gte', value: 91 }, { field: 'category', operator: 'equals', value: '전산' }] };
  result = await post(criteria); assert.equal(result.total, 33); assert.equal(result.rows[0].id, 'R00200'); assert.equal(result.rows.length, 25);
  result = await post({ ...criteria, export: true }); assert.equal(result.rows.length, 33);
  result = await post({ offset: 100, limit: 25, simulate: { total: 20 } }); assert.equal(result.total, 20); assert.equal(result.rows.length, 0);
  assert.equal((await post({ simulate: { fail: true } })).status, 503);
  for (const data of [null, [], { offset: -1 }, { sorts: [{ field: '__proto__', direction: 1 }] }, { filters: [{ field: 'qty', operator: 'unknown' }] }]) assert.equal((await post(data)).status, 400);
  assert.equal((await fetch(url)).status, 405);
  const encoded = Buffer.from(JSON.stringify({ offset: 0, limit: 25, query: '서버 품목 1023' })), split = encoded.indexOf(Buffer.from('서')) + 1;
  const unicode = await new Promise((resolve, reject) => {
    const request = http.request(url, { method: 'POST' }, response => { const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve(JSON.parse(Buffer.concat(chunks)))); });
    request.on('error', reject); request.write(encoded.subarray(0, split)); setImmediate(() => request.end(encoded.subarray(split)));
  });
  assert.equal(unicode.total, 1); assert.equal(unicode.rows[0].id, 'R01023');
});
