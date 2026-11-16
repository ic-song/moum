import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const columns = ['name', 'category', 'qty', 'price'];
const fail = (message, code = 'VALIDATION') => { throw Object.assign(Error(message), { code, committed: false }); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function values(input, partial) {
  if (!object(input) || Object.keys(input).some(key => !columns.includes(key)) || !partial && columns.some(key => !Object.hasOwn(input, key))) fail('저장 필드가 올바르지 않습니다.');
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (['name', 'category'].includes(key)) {
      if (typeof value !== 'string' || !value.trim() || value.length > 200) fail(`${key}: 1~200자 문자열이 필요합니다.`);
      result[key] = value.trim();
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9 || key === 'qty' && !Number.isInteger(value)) fail(`${key}: 올바른 0 이상의 숫자가 필요합니다.`);
      result[key] = value;
    }
  }
  return result;
}
export const editFixture = () => Array.from({ length: 123 }, (_, i) => ({ id: `R${String(i + 1).padStart(5, '0')}`, _version: 1, name: `편집 품목 ${i + 1}`, category: ['사무', '전산', '시설'][i % 3], qty: i % 100 + 1, price: 1000 + i % 40 * 500 }));

// Single-process demo: replace this file transaction with a DB transaction in a host service.
export class EditStore {
  constructor(file) { this.file = file; this.queue = Promise.resolve(); }
  async read() {
    if (!this.state) await (this.initializing ||= this.initialize().finally(() => { this.initializing = null; }));
    return structuredClone(this.state.rows);
  }
  async initialize() {
    let state;
    try { state = JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; state = { rows: editFixture(), nextId: 124, receipts: {} }; }
    if (!object(state) || !Array.isArray(state.rows) || !Number.isSafeInteger(state.nextId) || state.nextId < 1 || !object(state.receipts)) throw Error('저장 파일 형식이 올바르지 않습니다.');
    const keys = new Set();
    for (const row of state.rows) {
      if (!object(row) || typeof row.id !== 'string' || !/^R\d+$/.test(row.id) || Number(row.id.slice(1)) >= state.nextId || keys.has(row.id) || !Number.isSafeInteger(row._version) || row._version < 1) throw Error('저장 행의 키/버전이 올바르지 않습니다.');
      values(Object.fromEntries(columns.map(key => [key, row[key]])), false); keys.add(row.id);
    }
    this.state = state;
  }
  save(batch) {
    const operation = this.queue.then(() => this.commit(batch));
    this.queue = operation.catch(() => {}); return operation;
  }
  async commit(batch) {
    await this.read();
    if (!object(batch) || typeof batch.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(batch.requestId) || ['created', 'updated', 'deleted'].some(key => !Array.isArray(batch[key])) || batch.created.length + batch.updated.length + batch.deleted.length > 10000) fail('저장 요청 형식이 올바르지 않습니다.');
    const payload = { requestId: batch.requestId, created: batch.created, updated: batch.updated, deleted: batch.deleted };
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex'), prior = Object.hasOwn(this.state.receipts, batch.requestId) ? this.state.receipts[batch.requestId] : null;
    if (prior) { if (prior.hash !== hash) fail('같은 요청 ID의 내용이 달라졌습니다.', 'CONFLICT'); return structuredClone(prior.result); }
    const candidate = structuredClone(this.state), byId = new Map(candidate.rows.map(row => [row.id, row])), seen = new Set(), clients = new Set();
    const result = { requestId: batch.requestId, created: [], updated: [], deleted: [] };
    for (const item of [...batch.updated, ...batch.deleted]) {
      if (!object(item) || typeof item.key !== 'string' || !Number.isSafeInteger(item.version) || item.version < 1 || seen.has(item.key)) fail('중복되거나 잘못된 행 키입니다.');
      seen.add(item.key); const row = byId.get(item.key);
      if (!row || row._version !== item.version) fail(`${item.key}: 다른 사용자가 변경했습니다. 취소 후 다시 조회하세요.`, 'CONFLICT');
      if (row._version >= Number.MAX_SAFE_INTEGER) fail('행 버전 한도를 초과했습니다.');
    }
    for (const item of batch.created) {
      if (candidate.nextId >= Number.MAX_SAFE_INTEGER) fail('신규 행 키 한도를 초과했습니다.');
      if (!object(item) || typeof item.clientId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(item.clientId) || clients.has(item.clientId)) fail('신규 행 식별자가 올바르지 않습니다.');
      clients.add(item.clientId); const row = { id: `R${String(candidate.nextId++).padStart(5, '0')}`, _version: 1, ...values(item.values, false) };
      candidate.rows.push(row); result.created.push({ clientId: item.clientId, row: { ...row } });
    }
    for (const item of batch.updated) { const row = byId.get(item.key); Object.assign(row, values(item.values, true)); row._version++; result.updated.push({ ...row }); }
    const deleted = new Set(batch.deleted.map(item => item.key)); candidate.rows = candidate.rows.filter(row => !deleted.has(row.id)); result.deleted = [...deleted];
    candidate.receipts[batch.requestId] = { hash, result };
    await mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`; let handle;
    try {
      handle = await open(temporary, 'wx'); await handle.writeFile(JSON.stringify(candidate)); await handle.sync(); await handle.close(); handle = null;
      await rename(temporary, this.file);
    } catch (error) { await handle?.close(); await unlink(temporary).catch(() => {}); throw error; }
    this.state = candidate; return structuredClone(result);
  }
}
