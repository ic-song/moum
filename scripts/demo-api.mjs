import { buildDisplay, FILTER_OPERATORS } from '../packages/grid/src/data-view.js';

export const demoColumns = [{ field: 'id' }, { field: 'name' }, { field: 'category' }, { field: 'qty', type: 'number' }, { field: 'price', type: 'number' }];
const fields = new Set(demoColumns.map(column => column.field));
const source = Array.from({ length: 1023 }, (_, i) => ({ id: `R${String(i + 1).padStart(5, '0')}`, name: `서버 품목 ${i + 1}`, category: ['사무', '전산', '시설'][i % 3], qty: i % 100 + 1, price: 1000 + i % 40 * 500 }));
function json(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); }
export async function handleDemoAPI(request, response, url) {
  if (url.pathname !== '/api/grid') return false;
  if (request.method !== 'POST') { json(response, 405, { error: 'POST를 사용하세요.' }); return true; }
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of request) { bytes += chunk.length; if (bytes > 65536) throw Error('요청 본문이 너무 큽니다.'); chunks.push(chunk); }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('요청은 JSON 객체여야 합니다.');
    const { offset = 0, limit = 50, query = '', sorts = [], filters = [], filterLogic = 'and', simulate = {} } = input;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 10000 || typeof query !== 'string' || query.length > 100) throw Error('offset/limit/query가 올바르지 않습니다.');
    if (!Array.isArray(sorts) || sorts.length > 5 || sorts.some(sort => !sort || !fields.has(sort.field) || ![1, -1].includes(sort.direction))) throw Error('정렬이 올바르지 않습니다.');
    if (!Array.isArray(filters) || filters.length > 20 || !['and', 'or'].includes(filterLogic) || filters.some(filter => !filter || !fields.has(filter.field) || !FILTER_OPERATORS.includes(filter.operator) || [filter.value, filter.value2].some(value => value != null && !['string', 'number', 'boolean'].includes(typeof value)))) throw Error('필터가 올바르지 않습니다.');
    if (!simulate || typeof simulate !== 'object' || ![0, 300, 1000].includes(simulate.delay ?? 0) || simulate.total != null && (!Number.isInteger(simulate.total) || simulate.total < 0 || simulate.total > source.length)) throw Error('예제 통신 설정이 올바르지 않습니다.');
    if (simulate.delay) {
      const connected = await new Promise(resolve => { const timer = setTimeout(() => resolve(true), simulate.delay); response.once('close', () => { clearTimeout(timer); resolve(false); }); });
      if (!connected) return true;
    }
    if (simulate.fail) { json(response, 503, { error: '예제에서 요청한 일시적인 서버 오류입니다.' }); return true; }
    const data = simulate.total == null ? source : source.slice(0, simulate.total);
    const result = buildDisplay(data, { columns: demoColumns, query, sorts, filters, filterLogic }).view.map(item => item.row);
    const rows = input.export === true ? result : result.slice(offset, offset + limit);
    json(response, 200, { rows, total: result.length });
  } catch (error) { if (!response.destroyed) json(response, 400, { error: error instanceof SyntaxError ? '올바른 JSON 본문이 필요합니다.' : error.message }); }
  return true;
}
