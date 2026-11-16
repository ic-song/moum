import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EditStore } from './edit-store.mjs';
import { buildDisplay, FILTER_OPERATORS } from '../packages/grid/src/data-view.js';
import { demoColumns } from './demo-api.mjs';

const store = new EditStore(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../output/server-data/store.json'));
const fields = new Set(demoColumns.map(column => column.field));
function json(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); }
export async function handleEditAPI(request, response, url) {
  if (!['/api/grid-edit', '/api/grid-edit/save'].includes(url.pathname)) return false;
  if (request.method !== 'POST') { json(response, 405, { error: 'POST를 사용하세요.', committed: false }); return true; }
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of request) { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) throw Object.assign(Error('요청 본문이 너무 큽니다.'), { committed: false }); chunks.push(chunk); }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(Error('JSON 객체가 필요합니다.'), { committed: false });
    if (url.pathname.endsWith('/save')) {
      const { simulate = {}, ...batch } = input;
      if (simulate.fail) { json(response, 503, { error: '예제 저장 실패: 서버 데이터는 변경되지 않았습니다.', code: 'UNAVAILABLE', committed: false }); return true; }
      if (simulate.conflict && batch.updated?.[0]) {
        const item = batch.updated[0];
        await store.save({ requestId: `competing-${batch.requestId}`, created: [], updated: [{ key: item.key, version: item.version, values: { name: '다른 사용자의 수정' } }], deleted: [] });
      }
      const result = await store.save(batch);
      if (simulate.drop) { response.destroy(); return true; }
      json(response, 200, result); return true;
    }
    const { offset = 0, limit = 50, query = '', sorts = [], filters = [], filterLogic = 'and' } = input;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 10000 || typeof query !== 'string' || query.length > 100) throw Error('offset/limit/query가 올바르지 않습니다.');
    if (!Array.isArray(sorts) || sorts.length > 5 || sorts.some(sort => !sort || !fields.has(sort.field) || ![1, -1].includes(sort.direction))) throw Error('정렬이 올바르지 않습니다.');
    if (!Array.isArray(filters) || filters.length > 20 || !['and', 'or'].includes(filterLogic) || filters.some(filter => !filter || !fields.has(filter.field) || !FILTER_OPERATORS.includes(filter.operator) || [filter.value, filter.value2].some(value => value != null && !['string', 'number', 'boolean'].includes(typeof value)))) throw Error('필터가 올바르지 않습니다.');
    const result = buildDisplay(await store.read(), { columns: demoColumns, query, sorts, filters, filterLogic }).view.map(item => item.row);
    json(response, 200, { rows: input.export === true ? result : result.slice(offset, offset + limit), total: result.length });
  } catch (error) {
    if (!response.destroyed) json(response, error.code === 'CONFLICT' ? 409 : error.committed === false ? 422 : 500, { error: error instanceof SyntaxError ? '올바른 JSON 본문이 필요합니다.' : error.message, code: error.code || 'SERVER_ERROR', ...(error.committed === false ? { committed: false } : {}) });
  }
  return true;
}
