import { withRequestTimeout } from './remote-data.js';

const draftField = '__moumClientId';
const copy = value => JSON.parse(JSON.stringify(value));
export function requestToken() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
}

// Compare against the loaded server window so undo/redo also changes the pending batch.
export class RemoteChanges {
  constructor(remote, model) {
    this.remote = remote; this.model = model; this.versionField = remote.source.versionField ?? '_version';
    if (remote.rowKey === draftField) throw Error(`${draftField}는 내부 예약 필드입니다.`);
    if (typeof this.versionField !== 'string' || !this.versionField || [remote.rowKey, draftField, '__proto__', 'constructor', 'prototype'].includes(this.versionField)) throw Error('안전한 versionField가 필요합니다.');
    if (model.columns.some(column => column.field === draftField)) throw Error(`${draftField}는 내부 예약 필드입니다.`);
    for (const column of model.columns) if ([remote.rowKey, this.versionField].includes(column.field)) column.editable = false;
    this.fields = model.columns.filter(column => column.editable !== false).map(column => column.field);
    this.baseline = []; this.status = 'idle'; this.error = null;
  }
  validateVersions(rows) {
    for (const row of rows) if (Object.hasOwn(row, draftField) || !Number.isSafeInteger(row[this.versionField]) || row[this.versionField] < 1) throw Error(`서버 저장 행에 양의 정수 ${this.versionField}가 필요합니다.`);
    return rows;
  }
  reset(rows) { this.baseline = copy(rows); this.status = 'idle'; this.error = null; this.pending = null; }
  newRow(row) { return { ...row, [this.remote.rowKey]: '', [this.versionField]: 0, [draftField]: requestToken() }; }
  getChanges() {
    const keyField = this.remote.rowKey, baseline = new Map(this.baseline.map(row => [String(row[keyField]), row])), seen = new Set(), clients = new Set();
    const created = [], updated = [];
    for (const row of this.model.rows) {
      const values = Object.fromEntries(this.fields.map(field => [field, row[field] ?? null]));
      if (row[draftField]) {
        if (row[keyField] !== '' || row[this.versionField] !== 0 || clients.has(row[draftField])) throw Error('신규 행 식별자가 변경되거나 중복됐습니다.');
        clients.add(row[draftField]); created.push({ clientId: row[draftField], values }); continue;
      }
      const key = String(row[keyField]), before = baseline.get(key);
      if (!before || seen.has(key) || row[this.versionField] !== before[this.versionField]) throw Error('서버 행 키/버전은 직접 변경할 수 없습니다.');
      seen.add(key);
      const changes = Object.fromEntries(this.fields.filter(field => !Object.is(row[field], before[field])).map(field => [field, row[field] ?? null]));
      if (Object.keys(changes).length) updated.push({ key: before[keyField], version: before[this.versionField], values: changes });
    }
    const deleted = this.baseline.filter(row => !seen.has(String(row[keyField]))).map(row => ({ key: row[keyField], version: row[this.versionField] }));
    return copy({ created, updated, deleted });
  }
  get dirty() { const changes = this.getChanges(); return Object.values(changes).some(items => items.length); }
  get locked() { return ['saving', 'uncertain', 'refresh'].includes(this.status); }
  getState() { return { status: this.status, error: this.error, dirty: this.dirty, requestId: this.pending?.requestId ?? null }; }
  prepare() {
    if (this.status === 'uncertain') return this.pending;
    for (const row of this.model.rows) for (const column of this.model.columns) {
      if (row[draftField] && [this.remote.rowKey, this.versionField].includes(column.field)) continue;
      this.model.convert(column, row[column.field]);
    }
    const changes = this.getChanges(), fingerprint = JSON.stringify(changes);
    if (this.pending && fingerprint === this.fingerprint) return this.pending;
    this.fingerprint = fingerprint; return this.pending = { requestId: requestToken(), ...changes };
  }
  receipt(result, batch) {
    const fail = () => { throw Error('저장 응답이 변경 묶음과 일치하지 않습니다. 같은 요청으로 결과를 다시 확인하세요.'); };
    if (!result || result.requestId !== batch.requestId || !Array.isArray(result.created) || !Array.isArray(result.updated) || !Array.isArray(result.deleted) || result.created.length !== batch.created.length || result.updated.length !== batch.updated.length || result.deleted.length !== batch.deleted.length) fail();
    const keyField = this.remote.rowKey, versions = new Map(batch.updated.map(item => [String(item.key), item.version]));
    const clients = new Set(batch.created.map(item => item.clientId)), created = new Map(), updated = new Map();
    const received = [...result.created.map(item => item?.row), ...result.updated];
    if (received.some(row => !row || this.model.columns.some(column => !Object.hasOwn(row, column.field)))) fail();
    const canonical = this.validateVersions(this.remote.validateRows(received));
    for (let i = 0; i < result.created.length; i++) {
      const item = result.created[i]; if (!clients.delete(item.clientId)) fail(); created.set(item.clientId, canonical[i]);
    }
    for (const row of canonical.slice(result.created.length)) {
      const key = String(row[keyField]), version = versions.get(key);
      if (version == null || row[this.versionField] <= version) fail(); versions.delete(key); updated.set(key, row);
    }
    const deleted = new Set(batch.deleted.map(item => String(item.key)));
    for (const key of result.deleted) if (!deleted.delete(String(key))) fail();
    if (deleted.size || versions.size || clients.size) fail();
    const rows = this.model.rows.map(row => created.get(row[draftField]) || updated.get(String(row[keyField])) || row);
    this.validateVersions(this.remote.validateRows(rows)); return rows;
  }
  save(onChange, beforeSend = () => {}) {
    if (this.status === 'saving') return this.promise;
    if (!this.dirty || this.status === 'refresh') return Promise.resolve(null);
    let batch;
    try { batch = this.prepare(); } catch (error) { this.status = 'error'; this.error = error.message; onChange(); return Promise.resolve(null); }
    this.controller = new AbortController(); this.status = 'saving'; this.error = null;
    const controller = this.controller;
    this.promise = withRequestTimeout(async () => { await beforeSend(); if (controller.signal.aborted) throw controller.signal.reason; return this.remote.source.save({ ...copy(batch), signal: controller.signal }); }, controller, this.remote.timeoutMs)
      .then(result => { const rows = this.receipt(result, batch); this.status = 'refresh'; return rows; })
      .catch(error => { this.status = error?.committed === false ? 'error' : 'uncertain'; this.error = error?.message || String(error); return null; })
      .finally(onChange);
    onChange(); return this.promise;
  }
  dispose() { this.controller?.abort(); }
}
