import { requestToken } from './remote-changes.js';

export class IndexedDraftStorage {
  constructor(factory = globalThis.indexedDB) { this.factory = factory; }
  open() {
    return this.opening ||= new Promise((resolve, reject) => {
      if (!this.factory) { reject(Error('이 환경에서는 IndexedDB를 사용할 수 없습니다.')); return; }
      const request = this.factory.open('moum-grid-recovery', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error('다른 탭이 임시 저장소 업그레이드를 막고 있습니다.'));
      request.onsuccess = () => { this.db = request.result; this.db.onversionchange = () => this.db.close(); resolve(this.db); };
    });
  }
  async transaction(mode, action) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let transaction;
      try { transaction = db.transaction('drafts', mode, mode === 'readwrite' ? { durability: 'strict' } : undefined); }
      catch (error) { if (error.name !== 'TypeError') { reject(error); return; } transaction = db.transaction('drafts', mode); }
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error || Error('임시 저장 트랜잭션이 취소됐습니다.'));
      transaction.onerror = () => {};
      try { action(transaction.objectStore('drafts'), value => { result = value; }); }
      catch (error) { transaction.abort(); reject(error); }
    });
  }
  list(key) { return this.transaction('readonly', (store, result) => { store.getAll().onsuccess = event => result(event.target.result.filter(item => item.key === key)); }); }
  put(record) { return this.transaction('readwrite', store => store.put(record)); }
  remove(id, expected) {
    return this.transaction('readwrite', (store, result) => {
      store.get(id).onsuccess = event => {
        const current = event.target.result;
        if (!current || expected && (current.data !== expected.data || current.updatedAt !== expected.updatedAt)) { result(!current); return; }
        store.delete(id); result(true);
      };
    });
  }
  close() { this.opening?.then(db => db.close(), () => {}); }
}

// Each writer owns a separate record. A tab never replaces another tab's draft.
export class DraftRecovery {
  constructor(options, { schema, storage = new IndexedDraftStorage(), onChange = () => {} }) {
    if (!options || typeof options.key !== 'string' || !options.key.trim() || options.key.length > 500) throw Error('recovery.key에는 사용자·화면·데이터를 구분하는 문자열이 필요합니다.');
    this.maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1024 || this.maxBytes > 20 * 1024 * 1024) throw Error('recovery.maxBytes는 1KB~20MB여야 합니다.');
    this.key = options.key; this.schema = schema; this.storage = storage; this.onChange = onChange;
    this.id = requestToken(); this.candidates = []; this.loading = true; this.awaiting = false;
    this.desired = this.committed = null; this.error = null; this.savedAt = null;
    this.ready = storage.list(this.key).then(records => {
      this.candidates = records.filter(item => typeof item.id === 'string' && typeof item.data === 'string').sort((a, b) => b.updatedAt - a.updatedAt);
      this.awaiting = this.candidates.length > 0;
    }).catch(error => { this.error = error.message || String(error); }).finally(() => { this.loading = false; this.onChange(); });
  }
  get blocked() { return this.loading || this.awaiting; }
  getState() {
    return { enabled: true, status: this.loading ? 'loading' : this.awaiting ? 'available' : this.error ? 'error' : this.writer ? 'writing' : this.committed != null ? 'saved' : 'idle', candidates: this.candidates.length, savedAt: this.savedAt, error: this.error };
  }
  candidate(id = this.candidates[0]?.id) { return this.candidates.find(item => item.id === id); }
  read(id) {
    const item = this.candidate(id);
    if (!item) throw Error('복구할 임시 저장본이 없습니다.');
    if (item.schema !== this.schema) throw Error('컬럼/스키마가 달라 자동 복구할 수 없습니다. 복구본을 내려받아 확인하세요.');
    const snapshot = JSON.parse(item.data);
    if (!snapshot || snapshot.format !== 1) throw Error('지원하지 않는 복구본입니다.');
    return snapshot;
  }
  adopt(id) { this.source = this.candidate(id); this.candidates = this.candidates.filter(item => item.id !== id); this.awaiting = false; this.onChange(); }
  async discard(id) {
    const item = this.candidate(id); if (!item) return false;
    if (!await this.storage.remove(item.id, item)) throw Error('다른 탭이 복구본을 갱신했습니다. 다시 열어 최신 복구본을 확인하세요.');
    this.candidates = this.candidates.filter(record => record.id !== item.id); this.awaiting = this.candidates.length > 0; this.onChange(); return true;
  }
  write(snapshot) {
    if (this.disposed || this.blocked) return false;
    try {
      const data = snapshot == null ? null : JSON.stringify(snapshot);
      if (data != null && new TextEncoder().encode(data).length > this.maxBytes) throw Error('임시 저장 크기 한도를 초과했습니다. 복구본을 내려받거나 더 작은 데이터 구간을 사용하세요.');
      this.desired = data; this.invalid = false;
    } catch (error) { this.invalid = true; this.error = error.message; this.onChange(); return false; }
    this.drain(); return true;
  }
  drain() {
    if (this.writer || this.invalid || this.desired === this.committed && !this.source) return;
    this.writer = (async () => {
      try {
        while (this.desired !== this.committed) {
          const data = this.desired, updatedAt = Date.now();
          if (data == null) await this.storage.remove(this.id);
          else await this.storage.put({ id: this.id, key: this.key, schema: this.schema, updatedAt, data });
          this.committed = data; this.savedAt = data == null ? null : updatedAt; this.error = null;
        }
        if (this.source) { await this.storage.remove(this.source.id, this.source); this.source = null; }
        this.error = null;
        return true;
      } catch (error) { this.error = `임시 저장 실패: ${error.message || error}`; return false; }
      finally { this.writer = null; this.onChange(); }
    })();
    this.onChange();
  }
  async flush() {
    if (this.blocked || this.invalid) return false;
    this.drain(); if (this.writer && !await this.writer) return false;
    return this.desired === this.committed && !this.error;
  }
  dispose() { this.disposed = true; Promise.resolve(this.writer).finally(() => this.storage.close()); }
}
