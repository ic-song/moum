// The host supplies transport/authentication; the core never chooses a network URL.
export function withRequestTimeout(load, controller, timeoutMs) {
  const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason || Error('요청 취소')), { once: true }));
  const timer = setTimeout(() => controller.abort(Object.assign(Error('서버 응답 시간이 초과됐습니다. 다시 시도하세요.'), { name: 'TimeoutError' })), timeoutMs);
  const pending = Promise.resolve().then(() => { if (controller.signal.aborted) throw controller.signal.reason; return load(); });
  return Promise.race([pending, aborted]).finally(() => clearTimeout(timer));
}

export class RemoteData {
  constructor(source, { onChange = () => {}, convertRow = row => ({ ...row }) } = {}) {
    if (!source || typeof source.load !== 'function') throw new Error('dataSource.load 함수가 필요합니다.');
    if (source.exportRows != null && typeof source.exportRows !== 'function') throw new Error('dataSource.exportRows는 함수여야 합니다.');
    this.source = source; this.rowKey = source.rowKey ?? 'id';
    if (typeof this.rowKey !== 'string' || !this.rowKey || ['__proto__', 'constructor', 'prototype'].includes(this.rowKey)) throw new Error('안전한 rowKey가 필요합니다.');
    this.timeoutMs = source.timeoutMs ?? 30000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 300000) throw new Error('timeoutMs는 1~300,000 정수여야 합니다.');
    this.onChange = onChange; this.convertRow = convertRow; this.rows = []; this.total = null; this.offset = 0;
    this.loading = false; this.error = null; this.sequence = 0; this.disposed = false; this.promise = Promise.resolve(false);
  }
  configure(criteria, mode, pageSize) {
    if (!['pagination', 'infinite'].includes(mode)) throw new Error('서버 데이터는 pagination 또는 infinite 모드로 사용하세요.');
    const snapshot = JSON.parse(JSON.stringify(criteria)), key = JSON.stringify([snapshot, mode, pageSize]);
    if (key === this.queryKey) return this.promise;
    this.criteria = snapshot; this.mode = mode; this.pageSize = pageSize; this.queryKey = key;
    return this.request(0, { reset: true });
  }
  validateRows(rows, previous = []) {
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('서버 rows는 행 객체 배열이어야 합니다.');
    const ids = new Set(previous.map(row => String(row[this.rowKey])));
    return rows.map(row => {
      const id = row[this.rowKey];
      if (!['string', 'number'].includes(typeof id) || id === '' || typeof id === 'number' && !Number.isFinite(id)) throw new Error(`서버 행에 고유 ${this.rowKey} 값이 필요합니다.`);
      const item = this.convertRow(row), key = item[this.rowKey];
      if (!['string', 'number'].includes(typeof key) || key === '' || typeof key === 'number' && !Number.isFinite(key)) throw new Error('변환한 서버 행의 고유 키가 올바르지 않습니다.');
      if (ids.has(String(key))) throw new Error(`서버 행 키가 중복됩니다: ${key}`);
      ids.add(String(key)); return item;
    });
  }
  request(offset, { append = false, reset = false, redirected = false } = {}) {
    if (this.disposed) return Promise.resolve(false);
    const key = `${this.queryKey}:${offset}:${append}`;
    if (this.loading && this.pendingKey === key) return this.promise;
    this.controller?.abort(); const controller = new AbortController(), sequence = ++this.sequence;
    this.controller = controller; this.pendingKey = key; this.loading = true; this.error = null;
    if (reset) { this.rows = []; this.total = null; this.offset = 0; }
    const request = { ...JSON.parse(JSON.stringify(this.criteria)), offset, limit: this.pageSize, pageIndex: Math.floor(offset / this.pageSize), signal: controller.signal };
    this.lastRequest = { offset, append, reset, redirected };
    this.promise = withRequestTimeout(() => this.source.load(request), controller, this.timeoutMs).then(async result => {
      if (this.disposed || sequence !== this.sequence) return false;
      if (!result || !Number.isSafeInteger(result.total) || result.total < 0 || !Array.isArray(result.rows)) throw new Error('서버 응답은 {rows, total: 0 이상의 안전한 정수}여야 합니다.');
      if (!append && result.total > 0 && offset >= result.total && !redirected) {
        this.loading = false;
        return this.request(Math.floor((result.total - 1) / this.pageSize) * this.pageSize, { redirected: true });
      }
      if (!append && result.total > 0 && offset >= result.total) throw new Error('서버 목록이 계속 변경되고 있습니다. 새로고침 후 다시 시도하세요.');
      const expected = Math.max(0, Math.min(this.pageSize, result.total - offset));
      if (result.rows.length !== expected) throw new Error('서버 rows 길이와 total/offset/limit이 일치하지 않습니다.');
      if (append && (offset !== this.rows.length || result.total < offset)) throw new Error('서버 목록이 변경됐습니다. 새로고침 후 다시 불러오세요.');
      const rows = this.validateRows(result.rows, append ? this.rows : []);
      this.rows = append ? [...this.rows, ...rows] : rows; this.total = result.total; this.offset = append ? 0 : offset;
      return true;
    }).catch(error => {
      if (this.disposed || sequence !== this.sequence || controller.signal.aborted && controller.signal.reason?.name !== 'TimeoutError') return false;
      this.error = error instanceof Error ? error.message : String(error); return false;
    }).finally(() => {
      if (this.disposed || sequence !== this.sequence) return;
      this.loading = false; this.pendingKey = null; this.onChange();
    });
    this.onChange(); return this.promise;
  }
  page(index) {
    if (!Number.isInteger(index) || index < 0 || this.total == null || index >= Math.ceil(this.total / this.pageSize)) return Promise.resolve(false);
    return this.request(index * this.pageSize);
  }
  more() {
    if (this.loading) return this.promise;
    if (this.error || this.total == null || this.rows.length >= this.total) return Promise.resolve(false);
    return this.request(this.rows.length, { append: true });
  }
  retry() { return this.lastRequest ? this.request(this.lastRequest.offset, { ...this.lastRequest, redirected: false }) : Promise.resolve(false); }
  reload() { return this.request(this.mode === 'pagination' ? this.offset : 0, { reset: this.mode !== 'pagination' }); }
  dispose() { this.disposed = true; this.sequence++; this.controller?.abort(); }
}
