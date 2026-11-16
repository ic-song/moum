import { normalizeUploadLimits, parseUploadFile, tableFromSheet, normalizeUploadSchema, autoUploadMapping, validateUploadTable, uploadCSV } from './parser.js';
import { createXHRTransport, performUpload } from './transport.js';

function uploadEl(tag, text, cls) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; }
const uploadStatus = { reading: '읽는 중', ready: '검토 완료', invalid: '검증 오류', uploading: '전송 중', uploaded: '전송 완료', error: '오류', cancelled: '취소됨' };
let uploadSequence = 0;
export function downloadUploadFile(content, name, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export class Uploader {
  constructor(target, options = {}) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.target || this.target.childNodes.length) throw new Error('비어 있는 업로더 컨테이너가 필요합니다.');
    const limits = normalizeUploadLimits(options); this.options = { ...limits, maxFiles: 10, pageSize: 25, uploadTimeout: 120000, accept: '', ...options }; this.schema = normalizeUploadSchema(options.schema || []);
    if (!Number.isFinite(this.options.uploadTimeout) || this.options.uploadTimeout <= 0) throw new RangeError('uploadTimeout은 양수입니다.');
    if (!Number.isInteger(this.options.maxFiles) || this.options.maxFiles < 1 || !Number.isInteger(this.options.pageSize) || this.options.pageSize < 1 || this.options.pageSize > 200) throw new RangeError('maxFiles는 양수, pageSize는 1~200 정수입니다.');
    this.transport = options.onUpload || (options.url ? createXHRTransport(options.url, options.transportOptions) : null); this.items = []; this.activeId = null; this.message = '';
    this.root = uploadEl('section', null, 'moum-uploader'); this.root.setAttribute('aria-label', options.title || '파일 업로드와 데이터 검토'); this.target.append(this.root); this.render();
  }
  active() { if (this.destroyed) throw new Error('이미 제거된 업로더입니다.'); }
  find(id) { const item = this.items.find(i => i.id === id); if (!item) throw new Error('파일을 찾을 수 없습니다.'); return item; }
  accepts(file) { if (!this.options.accept) return true; return this.options.accept.split(',').some(raw => { const rule = raw.trim().toLowerCase(), name = file.name.toLowerCase(), mime = file.type.toLowerCase(); return rule === '*/*' || (rule.startsWith('.') ? name.endsWith(rule) : rule.endsWith('/*') ? mime.startsWith(rule.slice(0, -1)) : mime === rule); }); }
  async addFiles(files) {
    this.active(); const added = []; this.message = '';
    for (const file of Array.from(files)) {
      if (this.items.length >= this.options.maxFiles) { this.message = `최대 ${this.options.maxFiles}개 파일까지 추가할 수 있습니다.`; break; }
      const item = { id: `file-${++uploadSequence}`, file, status: 'reading', progress: 0, version: 0, parsed: null, result: null, error: '', sheetIndex: 0, headerRow: 1, mapping: {}, page: 0, edited: false, controller: null, objectURL: null };
      this.items.push(item); added.push(item.id); if (!this.activeId) this.activeId = item.id;
      if (!this.accepts(file)) { item.status = 'error'; item.errorStage = 'parse'; item.error = '허용하지 않는 파일 형식입니다.'; }
      else if (file.size > this.options.maxFileSize) { item.status = 'error'; item.errorStage = 'parse'; item.error = `최대 ${Math.round(this.options.maxFileSize / 1024 / 1024)}MB까지 선택할 수 있습니다.`; }
      else { this.render(); await this.readItem(item); }
      if (this.destroyed) break;
    }
    if (!this.destroyed) this.notify(); return added;
  }
  async readItem(item) {
    const version = ++item.version; item.status = 'reading'; item.error = ''; item.errorStage = null; this.notify();
    try {
      const parsed = await parseUploadFile(item.file, this.options);
      if (this.destroyed || !this.items.includes(item) || item.version !== version) return;
      item.parsed = parsed; item.sheetIndex = 0; item.headerRow = parsed.sheets[0]?.rowNumbers[0] ?? 0; item.page = 0;
      if (/^image\/(png|jpeg|gif|webp)$/.test(item.file.type) && !item.objectURL) item.objectURL = URL.createObjectURL(item.file);
      this.prepare(item, true);
    } catch (error) { if (this.destroyed || !this.items.includes(item) || item.version !== version) return; item.status = 'error'; item.errorStage = 'parse'; item.error = error.message; this.options.onError?.({ id: item.id, error }); }
    if (!this.destroyed) this.notify();
  }
  prepare(item, resetMapping = false) {
    if (!item.parsed?.sheets.length) { item.table = null; item.result = null; item.status = 'ready'; return; }
    const table = tableFromSheet(item.parsed.sheets[item.sheetIndex], item.headerRow);
    const mapping = resetMapping ? autoUploadMapping(table.columns, this.schema) : item.mapping;
    const result = validateUploadTable(table, this.schema, mapping); item.table = table; item.mapping = mapping; item.result = result; item.status = result.valid ? 'ready' : 'invalid'; item.error = ''; item.errorStage = null;
  }
  selectSheet(id, index) {
    this.active(); const item = this.find(id); if (item.status === 'uploading') throw new Error('전송 중에는 시트를 변경할 수 없습니다.');
    if (!Number.isInteger(index) || !item.parsed?.sheets[index]) throw new Error('시트를 찾을 수 없습니다.');
    item.sheetIndex = index; item.headerRow = item.parsed.sheets[index].rowNumbers[0] ?? 0; item.page = 0; this.prepare(item, true); this.notify();
  }
  setHeaderRow(id, row) { this.active(); const item = this.find(id); if (item.status === 'uploading') throw new Error('전송 중에는 헤더를 변경할 수 없습니다.'); const previous = item.headerRow; item.headerRow = row; try { this.prepare(item, true); } catch (error) { item.headerRow = previous; throw error; } item.page = 0; this.notify(); }
  setMapping(id, mapping) { this.active(); const item = this.find(id); if (!item.table || item.status === 'uploading') throw new Error('현재 열 매핑을 변경할 수 없습니다.'); const result = validateUploadTable(item.table, this.schema, mapping); item.mapping = { ...mapping }; item.result = result; item.status = result.valid ? 'ready' : 'invalid'; item.error = ''; this.notify(); }
  editCell(id, sourceRow, columnKey, value) {
    this.active(); const item = this.find(id); if (!item.table || item.status === 'uploading' || this.options.editable === false) throw new Error('현재 셀을 수정할 수 없습니다.');
    const column = item.table.columns.find(c => c.key === columnKey), sheet = item.parsed.sheets[item.sheetIndex], rowIndex = sheet.rowNumbers.indexOf(sourceRow);
    if (!column || rowIndex < 0 || sourceRow <= item.headerRow) throw new Error('수정할 데이터 셀을 찾을 수 없습니다.');
    if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) throw new TypeError('셀에는 문자열·숫자·boolean·null만 사용할 수 있습니다.');
    if (String(value ?? '').length > this.options.maxCellLength) throw new RangeError('셀 길이 제한을 초과했습니다.');
    sheet.rows[rowIndex][column.index] = value; sheet.cellErrors = sheet.cellErrors.filter(e => e.row !== sourceRow || e.column !== column.index); item.edited = true; this.prepare(item); this.notify();
  }
  getFiles() { return this.items.map(i => ({ id: i.id, name: i.file.name, size: i.file.size, type: i.file.type, status: i.status, progress: i.progress, error: i.error, sheetName: i.parsed?.sheets[i.sheetIndex]?.name ?? null, rowCount: i.table?.rows.length ?? 0, errorCount: i.result?.errors.length ?? 0 })); }
  getData(id, { validOnly = false } = {}) { const item = this.find(id); return structuredClone((validOnly ? item.result?.validData : item.result?.data) || []); }
  getErrors(id) { return structuredClone(this.find(id).result?.errors || []); }
  getMapping(id) { return { ...this.find(id).mapping }; }
  getSelectedFileId() { return this.activeId; }
  selectFile(id) { this.active(); this.find(id); this.activeId = id; this.render(); }
  notify() { if (this.destroyed) return; this.render(); this.options.onChange?.(this.getFiles()); }
  cancel(id) { this.active(); const item = this.find(id); item.version++; item.controller?.abort(); item.controller = null; item.status = 'cancelled'; item.error = '취소했습니다. 서버 전송 중이었다면 서버의 수신 여부는 별도로 확인하세요.'; this.notify(); }
  removeFile(id) { this.active(); const item = this.find(id); item.version++; item.controller?.abort(); if (item.objectURL) URL.revokeObjectURL(item.objectURL); this.items = this.items.filter(i => i !== item); if (this.activeId === id) this.activeId = this.items[0]?.id || null; this.notify(); }
  clear() { this.active(); for (const item of this.items) { item.version++; item.controller?.abort(); if (item.objectURL) URL.revokeObjectURL(item.objectURL); } this.items = []; this.activeId = null; this.notify(); }
  async retry(id) { this.active(); const item = this.find(id); if (item.status === 'uploading' || item.status === 'reading') return; if (!this.accepts(item.file)) throw new Error('허용하지 않는 파일 형식입니다.'); if (item.parsed) return this.upload(id); return this.readItem(item); }
  async upload(id) {
    this.active(); const item = this.find(id); if (!this.transport) throw new Error('onUpload 또는 url을 연결하세요.'); if (['reading', 'uploading', 'uploaded'].includes(item.status)) throw new Error('현재 상태에서는 전송할 수 없습니다.'); if (!item.parsed || (item.result && !item.result.valid)) throw new Error('파싱과 검증을 먼저 완료하세요.');
    const version = ++item.version, controller = new AbortController(); item.controller = controller; item.status = 'uploading'; item.error = ''; item.progress = 0; this.notify();
    try {
      const result = await performUpload(this.transport, { file: item.file, data: item.result ? this.getData(id) : null, signal: controller.signal, metadata: { sheetName: item.parsed.sheets[item.sheetIndex]?.name || null, headerRow: item.headerRow, mapping: { ...item.mapping }, edited: item.edited }, onProgress: value => { if (item.version !== version || this.destroyed) return; if (Number.isFinite(value)) { item.progress = Math.max(0, Math.min(100, value)); const progress = this.root.querySelector(`[data-progress-id="${item.id}"]`); if (progress) progress.value = item.progress; } } }, this.options.uploadTimeout);
      if (item.version !== version || this.destroyed || !this.items.includes(item)) return;
      item.status = 'uploaded'; item.progress = 100; item.uploadResult = result;
      try { this.options.onUploaded?.({ id, result, file: item.file }); } catch (error) { this.message = `서버 전송은 완료됐지만 완료 콜백에 오류가 있습니다: ${error.message}`; }
      return result;
    } catch (error) {
      if (item.version !== version || this.destroyed || !this.items.includes(item)) return;
      if (error.name === 'TimeoutError') controller.abort();
      item.status = error.name === 'AbortError' ? 'cancelled' : 'error'; item.errorStage = 'upload'; item.error = error.message; this.options.onError?.({ id, error });
    } finally { if (!this.destroyed && item.version === version && this.items.includes(item)) { item.controller = null; this.notify(); } }
  }
  async uploadAll() { this.active(); for (const item of [...this.items]) { if (this.destroyed) break; if (this.items.includes(item) && item.parsed && (!item.result || item.result.valid) && ['ready', 'error', 'cancelled'].includes(item.status)) await this.upload(item.id); } }
  async attempt(action) { try { await action(); } catch (error) { this.message = error.message; if (!this.destroyed) this.render(); } }
  render() {
    this.root.replaceChildren();
    const drop = uploadEl('div', null, 'moum-uploader-drop'); const label = uploadEl('label', '파일 선택 또는 이곳에 끌어놓기'), input = uploadEl('input'); input.type = 'file'; input.multiple = this.options.maxFiles > 1; input.accept = this.options.accept; input.addEventListener('change', () => this.attempt(() => this.addFiles(input.files))); label.append(input); drop.append(label, uploadEl('p', 'Excel·CSV·TSV·JSON은 브라우저에서 읽고 검토합니다. 파일은 전송 버튼을 눌러야 서버로 전송됩니다.'));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-dragging'); }); drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging')); drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('is-dragging'); this.attempt(() => this.addFiles(e.dataTransfer.files)); }); this.root.append(drop);
    const tools = uploadEl('div', null, 'moum-uploader-toolbar');
    const button = (text, action, disabled = false) => { const b = uploadEl('button', text); b.type = 'button'; b.disabled = disabled; b.addEventListener('click', () => this.attempt(action)); return b; };
    tools.append(button('모두 전송', () => this.uploadAll(), !this.transport || !this.items.some(i => i.parsed && (!i.result || i.result.valid) && ['ready', 'error', 'cancelled'].includes(i.status))), button('목록 비우기', () => this.clear(), !this.items.length));
    if (this.schema.length) tools.append(button('입력 양식 CSV', () => downloadUploadFile(uploadCSV([this.schema.map(f => f.label)]), 'moum-template.csv', 'text/csv;charset=utf-8')));
    this.root.append(tools);
    const message = uploadEl('p', this.message || (this.transport ? '검토 후 전송할 파일을 선택하세요.' : '로컬 검토 모드 · 서버 전송은 연결되지 않았습니다.'), 'moum-uploader-status'); message.setAttribute('aria-live', 'polite'); if (this.message) message.setAttribute('role', 'alert'); this.root.append(message);
    const queue = uploadEl('ul', null, 'moum-uploader-queue');
    for (const item of this.items) {
      const li = uploadEl('li'); if (this.activeId === item.id) li.classList.add('is-active');
      const select = button(item.file.name, () => { this.activeId = item.id; this.render(); }); select.classList.add('moum-uploader-file-name'); select.setAttribute('aria-pressed', String(this.activeId === item.id));
      const info = uploadEl('span', `${(item.file.size / 1024).toFixed(1)}KB · ${uploadStatus[item.status]}`); info.setAttribute('role', 'status'); li.append(select, info);
      if (item.status === 'uploading') { const progress = uploadEl('progress'); progress.max = 100; progress.value = item.progress; progress.dataset.progressId = item.id; progress.setAttribute('aria-label', `${item.file.name} 전송률`); li.append(progress); }
      if (['reading', 'uploading'].includes(item.status)) li.append(button('취소', () => this.cancel(item.id)));
      else if (['error', 'cancelled'].includes(item.status)) li.append(button('재시도', () => this.retry(item.id), !!item.parsed && !this.transport));
      else li.append(button('전송', () => this.upload(item.id), !this.transport || item.status !== 'ready'));
      li.append(button('제거', () => this.removeFile(item.id))); if (item.error) li.append(uploadEl('p', item.error, 'moum-uploader-error')); queue.append(li);
    }
    this.root.append(queue);
    const item = this.items.find(i => i.id === this.activeId);
    if (!item) { this.root.append(uploadEl('p', '선택한 파일이 없습니다. 파일 선택으로 시작하세요.', 'moum-uploader-empty')); return; }
    if (item.status === 'reading') { const busy = uploadEl('p', '파일을 읽고 있습니다…'); busy.setAttribute('role', 'status'); this.root.append(busy); return; }
    if (item.objectURL) { const img = uploadEl('img'); img.src = item.objectURL; img.alt = `${item.file.name} 미리보기`; img.className = 'moum-uploader-image'; this.root.append(img); }
    if (!item.parsed?.sheets.length) { if (item.parsed) this.root.append(uploadEl('p', '이 형식은 원본 파일로 전송합니다. 표 데이터 파싱 대상은 아닙니다.')); return; }
    const locked = item.status === 'uploading', controls = uploadEl('div', null, 'moum-uploader-toolbar');
    const sheetLabel = uploadEl('label', '시트 '), sheetSelect = uploadEl('select'); sheetSelect.setAttribute('aria-label', '시트'); sheetSelect.disabled = locked; item.parsed.sheets.forEach((s, i) => { const o = uploadEl('option', s.name); o.value = i; sheetSelect.append(o); }); sheetSelect.value = item.sheetIndex; sheetSelect.addEventListener('change', () => this.attempt(() => this.selectSheet(item.id, Number(sheetSelect.value)))); sheetLabel.append(sheetSelect); controls.append(sheetLabel);
    const headerLabel = uploadEl('label', '헤더 원본 행 (0: 없음) '), header = uploadEl('input'); header.type = 'number'; header.min = 0; header.max = this.options.maxRows + 1; header.value = item.headerRow; header.disabled = locked; header.addEventListener('change', () => this.attempt(() => this.setHeaderRow(item.id, Number(header.value)))); headerLabel.append(header); controls.append(headerLabel);
    controls.append(button('검증된 데이터 JSON', () => downloadUploadFile(JSON.stringify(this.getData(item.id), null, 2), item.file.name.replace(/\.[^.]*$/, '') + '.json'), !item.result?.valid)); this.root.append(controls);
    if (this.schema.length) {
      const mapping = uploadEl('fieldset', null, 'moum-uploader-mapping'); mapping.append(uploadEl('legend', '원본 열 연결'));
      for (const field of this.schema) { const label = uploadEl('label', field.label + (field.required ? ' *' : '')), select = uploadEl('select'); select.disabled = locked; const none = uploadEl('option', '연결 안 함'); none.value = ''; select.append(none); for (const col of item.table.columns) { const option = uploadEl('option', `${col.index + 1}. ${col.label}`); option.value = col.key; select.append(option); } select.value = item.mapping[field.field] || ''; select.addEventListener('change', () => this.attempt(() => this.setMapping(item.id, { ...item.mapping, [field.field]: select.value }))); label.append(select); mapping.append(label); } this.root.append(mapping);
    }
    this.renderPreview(item, button);
  }
  renderPreview(item, button) {
    const result = item.result, rows = item.table.rows; item.page = Math.min(item.page, Math.max(0, Math.ceil(rows.length / this.options.pageSize) - 1));
    const summary = uploadEl('p', `원본 ${rows.length.toLocaleString()}행 · 유효 ${result.validData.length.toLocaleString()}행 · 오류 ${result.errors.length.toLocaleString()}건${item.edited ? ' · 수정한 데이터 (원본 파일은 유지)' : ''}`, 'moum-uploader-summary'); summary.setAttribute('role', 'status'); this.root.append(summary);
    if (this.options.editable !== false) this.root.append(uploadEl('p', '셀을 더블클릭하거나 셀에서 F2/Enter로 수정합니다. Enter 적용, Esc 취소. 수정값은 전송 data에 반영되고 원본 파일은 바뀌지 않습니다.'));
    const scroll = uploadEl('div', null, 'moum-uploader-table-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', '파일 원본 데이터 미리보기'); const table = uploadEl('table'); table.append(uploadEl('caption', `${item.file.name} · ${item.parsed.sheets[item.sheetIndex].name}`));
    const head = uploadEl('thead'), hr = uploadEl('tr'); ['원본 행', ...item.table.columns.map(c => c.label), '검증'].forEach(text => { const th = uploadEl('th', text); th.scope = 'col'; hr.append(th); }); head.append(hr); table.append(head); const body = uploadEl('tbody');
    rows.slice(item.page * this.options.pageSize, (item.page + 1) * this.options.pageSize).forEach((row, i) => {
      const index = item.page * this.options.pageSize + i, sourceRow = item.table.rowNumbers[index], errors = result.errors.filter(e => e.row === sourceRow), tr = uploadEl('tr'); if (errors.length) tr.className = 'is-invalid'; const th = uploadEl('th', sourceRow); th.scope = 'row'; tr.append(th);
      row.forEach((value, columnIndex) => {
        const td = uploadEl('td', value); td.dataset.sourceRow = sourceRow; td.dataset.columnKey = item.table.columns[columnIndex].key;
        if (this.options.editable !== false && item.status !== 'uploading') {
          td.tabIndex = 0;
          const edit = () => {
            if (td.querySelector('input')) return; const input = uploadEl('input'); input.value = value ?? ''; input.setAttribute('aria-label', `${sourceRow}행 ${item.table.columns[columnIndex].label} 수정`); td.replaceChildren(input); input.focus(); input.select();
            const finish = () => this.attempt(() => { this.editCell(item.id, sourceRow, item.table.columns[columnIndex].key, input.value); this.root.querySelector(`[data-source-row="${sourceRow}"][data-column-key="${td.dataset.columnKey}"]`)?.focus(); });
            input.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); finish(); } else if (event.key === 'Escape') { td.textContent = value ?? ''; td.focus(); } }); input.addEventListener('blur', () => { if (input.isConnected) td.textContent = value ?? ''; });
          };
          td.addEventListener('dblclick', edit); td.addEventListener('keydown', event => { if (['F2', 'Enter'].includes(event.key)) { event.preventDefault(); edit(); } });
        }
        tr.append(td);
      });
      tr.append(uploadEl('td', errors.length ? errors.map(e => e.message).join(' / ') : '정상')); body.append(tr);
    }); table.append(body); scroll.append(table); this.root.append(scroll);
    const pagination = uploadEl('div', null, 'moum-uploader-toolbar'); pagination.append(button('이전 페이지', () => { item.page--; this.render(); }, item.page === 0), uploadEl('span', `${item.page + 1} / ${Math.max(1, Math.ceil(rows.length / this.options.pageSize))} 페이지`), button('다음 페이지', () => { item.page++; this.render(); }, (item.page + 1) * this.options.pageSize >= rows.length)); this.root.append(pagination);
    if (result.errors.length) { const details = uploadEl('details'); details.open = true; details.append(uploadEl('summary', `검증 오류 ${result.errors.length}건`)); const list = uploadEl('ul'); for (const error of result.errors.slice(0, 50)) list.append(uploadEl('li', `${error.row == null ? '열 연결' : `${error.row}행`}: ${error.message}`)); details.append(list); if (result.errors.length > 50) details.append(uploadEl('p', '처음 50건만 표시합니다. 전체 오류는 CSV로 확인하세요.')); details.append(button('전체 오류 CSV', () => downloadUploadFile(uploadCSV([['원본 행', '필드', '오류'], ...result.errors.map(e => [e.row, e.field, e.message])]), 'moum-errors.csv', 'text/csv;charset=utf-8'))); this.root.append(details); }
  }
  destroy() { if (this.destroyed) return; for (const item of this.items) { item.version++; item.controller?.abort(); if (item.objectURL) URL.revokeObjectURL(item.objectURL); } this.items = []; this.destroyed = true; this.root.remove(); }
}
