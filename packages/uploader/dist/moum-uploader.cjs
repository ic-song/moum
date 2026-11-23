/*! MOUM uploader v0.4.0 | MIT License | See LICENSE */
'use strict';
const uploadLimits = { maxFileSize: 20 * 1024 * 1024, maxRows: 10000, maxColumns: 200, maxExpandedBytes: 100 * 1024 * 1024, maxCellLength: 100000 };
function normalizeUploadLimits(options = {}) {
  const result = { ...uploadLimits }; for (const key of Object.keys(result)) if (options[key] != null) { if (!Number.isSafeInteger(options[key]) || options[key] < 1) throw new RangeError(`${key}는 양의 정수입니다.`); result[key] = options[key]; } return result;
}
function parseDelimited(text, options = {}) {
  const limits = normalizeUploadLimits(options); text = String(text).replace(/^\uFEFF/, '');
  let delimiter = options.delimiter;
  if (delimiter == null) {
    const counts = new Map([[',', 0], ['\t', 0], [';', 0]]); let quoted = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; } else if (!quoted) { if (ch === '\r' || ch === '\n') break; if (counts.has(ch)) counts.set(ch, counts.get(ch) + 1); } }
    delimiter = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  }
  if (![',', '\t', ';', '|'].includes(delimiter)) throw new TypeError('지원하지 않는 구분자입니다.');
  const rows = [], rowNumbers = []; let row = [], value = '', quoted = false, closed = false, line = 1, rowStart = 1;
  const cell = () => { if (row.length >= limits.maxColumns) throw new RangeError('열 수 제한을 초과했습니다.'); row.push(value); value = ''; closed = false; };
  const record = () => { cell(); if (row.some(v => v !== '')) { rows.push(row); rowNumbers.push(rowStart); if (rows.length > limits.maxRows + 1) throw new RangeError('행 수 제한을 초과했습니다.'); } row = []; };
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    if (quoted) {
      if (ch === '"') { if (text[index + 1] === '"') { value += '"'; index++; } else { quoted = false; closed = true; } }
      else { value += ch; if (ch === '\n' || (ch === '\r' && text[index + 1] !== '\n')) line++; }
    } else if (ch === delimiter) cell();
    else if (ch === '\n' || ch === '\r') { record(); if (ch === '\r' && text[index + 1] === '\n') index++; line++; rowStart = line; }
    else if (ch === '"' && value === '' && !closed) quoted = true;
    else if (closed) { if (ch !== ' ' && ch !== '\t') throw new SyntaxError(`${line}행: 닫힌 따옴표 뒤에 문자가 있습니다.`); }
    else { if (ch === '"') throw new SyntaxError(`${line}행: 따옴표는 셀의 처음에 와야 합니다.`); value += ch; }
    if (value.length > limits.maxCellLength) throw new RangeError('셀 길이 제한을 초과했습니다.');
  }
  if (quoted) throw new SyntaxError('닫히지 않은 따옴표가 있습니다.');
  if (value !== '' || row.length || closed) record();
  return { rows, rowNumbers, delimiter };
}

function checkWorkbookArchive(bytes, maxExpandedBytes = uploadLimits.maxExpandedBytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const zip = data[0] === 0x50 && data[1] === 0x4b, ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((v, i) => data[i] === v);
  if (ole) return 'xls'; if (!zip) throw new Error('Excel 파일 서명이 올바르지 않습니다.');
  let eocd = -1; for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === data.length) { eocd = i; break; }
  if (eocd < 0) throw new Error('손상된 XLSX ZIP 디렉터리입니다.');
  const entries = view.getUint16(eocd + 10, true), size = view.getUint32(eocd + 12, true); let offset = view.getUint32(eocd + 16, true), expanded = 0;
  if (entries === 0xffff || offset === 0xffffffff || size === 0xffffffff || view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true)) throw new Error('ZIP64/분할 압축 파일은 지원하지 않습니다.');
  if (offset + size > eocd || entries > 10000) throw new Error('XLSX ZIP 범위가 올바르지 않습니다.');
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== 0x02014b50) throw new Error('손상된 XLSX ZIP 항목입니다.');
    if (view.getUint16(offset + 8, true) & 1) throw new Error('암호화된 Excel 파일은 지원하지 않습니다.');
    const length = view.getUint32(offset + 24, true); if (length === 0xffffffff) throw new Error('ZIP64 파일은 지원하지 않습니다.'); expanded += length;
    if (expanded > maxExpandedBytes) throw new RangeError('압축 해제 크기 제한을 초과했습니다.');
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    if (offset > eocd) throw new Error('손상된 XLSX ZIP 항목 범위입니다.');
  }
  return 'xlsx';
}

function readWorkbookSheet(workbook, sheetName, library, options = {}) {
  const limits = normalizeUploadLimits(options), sheet = workbook.Sheets[sheetName]; if (!sheet) throw new Error('시트를 찾을 수 없습니다.');
  if (!sheet['!ref']) return { name: sheetName, rows: [], rowNumbers: [], cellErrors: [] };
  const range = library.utils.decode_range(sheet['!ref']);
  if (range.e.r + 1 > limits.maxRows + 1 || range.e.c + 1 > limits.maxColumns || range.s.r < 0 || range.s.c < 0) throw new RangeError(`${sheetName}: 행/열 제한을 초과했습니다.`);
  const rows = [], rowNumbers = [], cellErrors = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = []; let populated = false;
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[library.utils.encode_cell({ r, c })]; let value = cell?.v ?? '';
      if (cell?.t === 'e' || (cell?.f && cell.v == null)) { cellErrors.push({ row: r + 1, column: c, message: cell.t === 'e' ? 'Excel 오류 셀' : '수식의 저장된 계산 결과가 없습니다.' }); value = cell.w || cell.f || '#ERROR'; }
      if (value instanceof Date) value = Number.isFinite(value.getTime()) ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : '';
      if (String(value).length > limits.maxCellLength) throw new RangeError('셀 길이 제한을 초과했습니다.');
      if (value !== '') populated = true; row.push(value);
    }
    if (populated) { rows.push(row); rowNumbers.push(r + 1); }
  }
  return { name: sheetName, rows, rowNumbers, cellErrors };
}

async function parseUploadFile(file, options = {}) {
  const limits = normalizeUploadLimits(options);
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size)) throw new TypeError('File 또는 Blob이 필요합니다.');
  if (file.size > limits.maxFileSize) throw new RangeError(`파일 크기 제한: ${Math.round(limits.maxFileSize / 1024 / 1024)}MB`);
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  if (!['csv', 'tsv', 'xlsx', 'xls', 'json'].includes(extension)) return { kind: 'file', sheets: [] };
  options.onParseStage?.('reading');
  const bytes = await file.arrayBuffer();
  options.onParseStage?.('parsing');
  if (['xlsx', 'xls'].includes(extension)) {
    const library = options.excelLibrary || globalThis.XLSX; if (!library?.read || !library?.utils) throw new Error('Excel 파서가 없습니다. 동봉 SheetJS를 먼저 로드하거나 excelLibrary로 전달하세요.');
    checkWorkbookArchive(bytes, limits.maxExpandedBytes);
    const workbook = library.read(bytes, { type: 'array', cellDates: true, sheetRows: limits.maxRows + 2, dense: false, WTF: false });
    if (!workbook.SheetNames?.length) throw new Error('Excel 파일에 시트가 없습니다.');
    if (workbook.SheetNames.length > 100) throw new RangeError('시트 수 제한(100)을 초과했습니다.');
    let totalCells = 0;
    const sheets = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name]; if (sheet['!fullref']) { const full = library.utils.decode_range(sheet['!fullref']); if (full.e.r + 1 > limits.maxRows + 1) throw new RangeError(`${name}: 행 수 제한을 초과했습니다.`); }
      if (sheet['!ref']) { const range = library.utils.decode_range(sheet['!ref']); totalCells += (range.e.r + 1) * (range.e.c + 1); if (totalCells > 2000000) throw new RangeError('전체 시트의 셀 수 제한(2,000,000)을 초과했습니다.'); }
      return readWorkbookSheet(workbook, name, library, limits);
    });
    return { kind: 'workbook', sheets };
  }
  const encoding = options.encoding || 'utf-8'; if (!['utf-8', 'euc-kr', 'utf-16le'].includes(encoding)) throw new Error('지원하지 않는 문자 인코딩입니다.');
  let text; try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); } catch { throw new Error('문자 인코딩을 읽을 수 없습니다. encoding 설정을 확인하세요.'); }
  if (extension === 'json') {
    const records = JSON.parse(text.replace(/^\uFEFF/, '')); if (!Array.isArray(records) || records.some(r => !r || typeof r !== 'object' || Array.isArray(r))) throw new TypeError('JSON은 객체 배열이어야 합니다.');
    if (records.length > limits.maxRows) throw new RangeError('행 수 제한을 초과했습니다.');
    const headers = [...new Set(records.flatMap(Object.keys))]; if (headers.length > limits.maxColumns) throw new RangeError('열 수 제한을 초과했습니다.');
    const rows = [headers, ...records.map(r => headers.map(h => { const v = Object.hasOwn(r, h) ? r[h] ?? '' : ''; const value = typeof v === 'object' ? JSON.stringify(v) : v; if (String(value).length > limits.maxCellLength) throw new RangeError('셀 길이 제한을 초과했습니다.'); return value; }))];
    return { kind: 'table', sheets: [{ name: file.name, rows, rowNumbers: rows.map((_, i) => i + 1), cellErrors: [] }] };
  }
  return { kind: 'table', sheets: [{ name: file.name, ...parseDelimited(text, { ...limits, delimiter: extension === 'tsv' ? '\t' : options.delimiter }), cellErrors: [] }] };
}

function tableFromSheet(sheet, headerRow = 1) {
  if (!Number.isInteger(headerRow) || headerRow < 0) throw new RangeError('헤더 행은 0(없음) 또는 실제 원본 행 번호입니다.');
  const index = headerRow === 0 ? -1 : sheet.rowNumbers.indexOf(headerRow);
  if (headerRow && index < 0) throw new Error('선택한 헤더 행이 비어 있거나 존재하지 않습니다.');
  const width = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0), labels = index < 0 ? [] : sheet.rows[index];
  const columns = Array.from({ length: width }, (_, i) => ({ key: `column${i + 1}`, label: String(labels[i] ?? '').trim() || `열 ${i + 1}`, index: i }));
  return { columns, rows: sheet.rows.slice(index + 1).map(row => columns.map(c => row[c.index] ?? '')), rowNumbers: sheet.rowNumbers.slice(index + 1), cellErrors: (sheet.cellErrors || []).filter(e => e.row > headerRow) };
}

function normalizeUploadSchema(schema = []) {
  if (!Array.isArray(schema)) throw new TypeError('schema는 필드 배열입니다.'); const fields = new Set();
  return schema.map(item => { if (!item || typeof item.field !== 'string' || !item.field || ['__proto__', 'prototype', 'constructor'].includes(item.field) || fields.has(item.field)) throw new Error('schema field는 안전하고 고유한 문자열이어야 합니다.'); fields.add(item.field); if (!['string', 'number', 'integer', 'boolean', 'date'].includes(item.type || 'string')) throw new Error('지원하지 않는 필드 타입입니다.'); return { ...item, label: item.label || item.field, type: item.type || 'string' }; });
}
function autoUploadMapping(columns, schema) {
  const mapping = {}; for (const field of schema) { const matches = columns.filter(c => c.label === field.field || c.label === field.label); mapping[field.field] = matches.length === 1 ? matches[0].key : ''; } return mapping;
}
function validateUploadTable(table, schema = [], mapping = {}) {
  schema = normalizeUploadSchema(schema); const errors = [], data = [], invalidRows = new Set();
  const fields = schema.length ? schema : table.columns.map(c => ({ field: c.key, label: c.label, type: 'string', preserve: true }));
  const used = new Set();
  for (const field of fields) { const key = schema.length ? mapping[field.field] : field.field; if (key && !table.columns.some(c => c.key === key)) throw new Error(`없는 원본 열: ${key}`); if (key && used.has(key)) throw new Error('하나의 원본 열을 여러 필드에 연결할 수 없습니다.'); if (key) used.add(key); if (field.required && !key) errors.push({ row: null, field: field.field, message: `${field.label}: 필수 열을 연결하세요.` }); }
  table.rows.forEach((row, index) => {
    const record = {}, rowNumber = table.rowNumbers[index];
    for (const field of fields) {
      const key = schema.length ? mapping[field.field] : field.field, col = table.columns.find(c => c.key === key); let value = col ? row[col.index] : ''; let message = '';
      const empty = value == null || (typeof value === 'string' && value.trim() === '');
      if (empty) { value = null; if (field.required) message = '필수 값입니다.'; }
      else if (field.preserve) { /* Preserve original Excel/JSON scalar types without a declared schema. */ }
      else if (field.type === 'number' || field.type === 'integer') {
        if (typeof value === 'string') { const text = value.trim(); if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) && !/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text)) message = '숫자 형식이 아닙니다.'; else value = Number(text.replaceAll(',', '')); }
        if (!message && (!Number.isFinite(value) || (field.type === 'integer' && !Number.isSafeInteger(value)))) message = field.type === 'integer' ? '안전한 정수여야 합니다.' : '유한한 숫자여야 합니다.';
        if (!message && field.min != null && value < field.min) message = `최솟값은 ${field.min}입니다.`; if (!message && field.max != null && value > field.max) message = `최댓값은 ${field.max}입니다.`;
      } else if (field.type === 'boolean') { if ([true, 1, '1', 'true', 'TRUE', 'Y', 'y', '예'].includes(value)) value = true; else if ([false, 0, '0', 'false', 'FALSE', 'N', 'n', '아니오'].includes(value)) value = false; else message = '참/거짓 값이 아닙니다.'; }
      else if (field.type === 'date') { value = String(value).trim(); const ms = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(value + 'T00:00:00Z') : NaN; if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) message = 'YYYY-MM-DD 날짜가 아닙니다.'; }
      else { value = String(value); if (field.trim !== false) value = value.trim(); }
      if (!message && field.validate && !empty) { try { const custom = field.validate(value, rowNumber); if (custom === false) message = '사용자 검증을 통과하지 못했습니다.'; else if (typeof custom === 'string') message = custom; } catch (error) { message = error.message; } }
      record[field.field] = value;
      if (message) { invalidRows.add(index); errors.push({ row: rowNumber, field: field.field, message: `${field.label}: ${message}` }); }
    }
    data.push(record);
  });
  for (const error of table.cellErrors || []) { const index = table.rowNumbers.indexOf(error.row); if (index >= 0) invalidRows.add(index); errors.push({ row: error.row, field: table.columns[error.column]?.key || '', message: error.message }); }
  return { data, validData: errors.some(e => e.row == null) ? [] : data.filter((_, i) => !invalidRows.has(i)), errors, valid: errors.length === 0, invalidRows: [...invalidRows] };
}
function uploadCSV(rows) { return '\uFEFF' + rows.map(row => row.map(v => { let text = String(v ?? ''); if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }).join(',')).join('\r\n'); }

function performUpload(transport, request, timeout = 120000) {
  if (!Number.isFinite(timeout) || timeout <= 0) return Promise.reject(new RangeError('전송 제한 시간은 양수입니다.'));
  return new Promise((resolve, reject) => {
    let done = false, timer;
    const finish = (error, value) => { if (done) return; done = true; clearTimeout(timer); request.signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(value); };
    const abort = () => finish(new DOMException('업로드 취소', 'AbortError'));
    if (request.signal.aborted) { abort(); return; }
    request.signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { const error = new Error('전송 응답 시간이 초과되었습니다. 서버 수신 여부를 확인하세요.'); error.name = 'TimeoutError'; finish(error); }, timeout);
    Promise.resolve().then(() => { if (request.signal.aborted) throw new DOMException('업로드 취소', 'AbortError'); return transport(request); }).then(value => finish(null, value), error => finish(error));
  });
}

function createXHRTransport(url, options = {}) {
  return ({ file, data, signal, onProgress, metadata }) => new Promise((resolve, reject) => {
    const target = new URL(url, globalThis.location?.href); if (!['http:', 'https:'].includes(target.protocol)) { reject(new Error('HTTP(S) 업로드 주소가 필요합니다.')); return; }
    if (signal.aborted) { reject(new DOMException('업로드 취소', 'AbortError')); return; }
    const xhr = new XMLHttpRequest(), body = new FormData(); body.append(options.fieldName || 'file', file, file.name); body.append('metadata', JSON.stringify(metadata)); if (data) body.append('data', JSON.stringify(data));
    const abort = () => xhr.abort(); signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => signal.removeEventListener('abort', abort);
    xhr.open(options.method || 'POST', target.href); xhr.timeout = options.timeout ?? 120000; xhr.withCredentials = options.withCredentials ?? false;
    for (const [name, value] of Object.entries(options.headers || {})) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total * 100); };
    xhr.onload = () => { cleanup(); if (xhr.status >= 200 && xhr.status < 300) { let result = xhr.responseText; try { result = JSON.parse(result); } catch { /* Text responses are valid transport results. */ } resolve(result); } else reject(new Error(`업로드 HTTP ${xhr.status}`)); };
    xhr.onerror = () => { cleanup(); reject(new Error('네트워크 오류입니다. 연결을 확인하고 재시도하세요.')); };
    xhr.ontimeout = () => { cleanup(); reject(new Error('업로드 시간이 초과되었습니다. 서버의 수신 여부를 확인한 뒤 재시도하세요.')); };
    xhr.onabort = () => { cleanup(); reject(new DOMException('업로드 취소', 'AbortError')); }; xhr.send(body);
  });
}


function parseUploadFileInWorker(file, options = {}, signal, onStage) {
  const limits=normalizeUploadLimits(options),timeout=options.parseTimeout??120000;
  if(!options.workerURL)throw new TypeError('workerURL을 지정하세요.');
  if(!Number.isFinite(timeout)||timeout<=0)throw new RangeError('parseTimeout은 양수입니다.');
  if(!file||!Number.isFinite(file.size)||file.size>limits.maxFileSize)throw new RangeError('파일 크기 제한을 확인하세요.');
  return new Promise((resolve,reject)=>{
    let worker,timer,settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker?.terminate();if(error)reject(error);else resolve(value);};
    const abort=()=>finish(new DOMException('파일 파싱을 취소했습니다.','AbortError'));
    if(signal?.aborted){abort();return;}
    try{
      onStage?.('starting');if(signal?.aborted){abort();return;}worker=new Worker(options.workerURL);
      signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>finish(new DOMException('파일 파싱 제한 시간을 초과했습니다.','TimeoutError')),timeout);
      worker.onmessage=({data})=>{
        if(settled)return;
        try{if(data?.stage){if(['reading','parsing'].includes(data.stage))onStage?.(data.stage);}
          else if(data?.error){const error=new Error(data.error.message);error.name=data.error.name||'Error';finish(error);}
          else if(data?.result){onStage?.('complete');finish(null,data.result);}
          else finish(new Error('파싱 Worker 응답을 확인하세요.'));
        }catch(error){finish(error);}
      };
      worker.onerror=event=>{event.preventDefault();finish(new Error('파싱 Worker를 실행하지 못했습니다. workerURL과 CSP, 로컬 SheetJS 경로를 확인하세요.'));};
      worker.onmessageerror=()=>finish(new Error('파싱 Worker 응답을 읽지 못했습니다.'));
      worker.postMessage({file,options:{...limits,encoding:options.encoding,delimiter:options.delimiter}});
    }catch(error){finish(error);}
  });
}


function uploadEl(tag, text, cls) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; }
const uploadStatus = { reading: '읽는 중', ready: '검토 완료', invalid: '검증 오류', uploading: '전송 중', uploaded: '전송 완료', error: '오류', cancelled: '취소됨' };
const sameUploadFile = (a, b) => a.name === b.name && a.size === b.size && a.type === b.type && a.lastModified === b.lastModified && (a.webkitRelativePath || '') === (b.webkitRelativePath || '');
let uploadSequence = 0;
function downloadUploadFile(content, name, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
class Uploader {
  constructor(target, options = {}) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.target || this.target.childNodes.length) throw new Error('비어 있는 업로더 컨테이너가 필요합니다.');
    const limits = normalizeUploadLimits(options); this.options = { ...limits, maxFiles: 10, pageSize: 25, uploadTimeout: 120000, uploadConcurrency: 1, accept: '', ...options }; this.schema = normalizeUploadSchema(options.schema || []);
    if (options.maxTotalFileSize !== undefined && (!Number.isSafeInteger(options.maxTotalFileSize) || options.maxTotalFileSize <= 0)) throw new RangeError('maxTotalFileSize는 양의 정수 바이트입니다.');
    if (options.rejectDuplicates !== undefined && typeof options.rejectDuplicates !== 'boolean') throw new TypeError('rejectDuplicates는 boolean입니다.');
    if(!Number.isInteger(this.options.uploadConcurrency)||this.options.uploadConcurrency<1||this.options.uploadConcurrency>6)throw new RangeError('uploadConcurrency는 1~6 정수입니다.');
    this.batchVersion=0;
    if(options.parseTimeout!=null&&(!Number.isFinite(options.parseTimeout)||options.parseTimeout<=0))throw new RangeError('parseTimeout은 양수입니다.');
    if(options.workerURL&&options.excelLibrary)throw new TypeError('Worker는 동봉 SheetJS를 사용합니다. excelLibrary와 함께 지정할 수 없습니다.');
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
      if (this.destroyed) break;
      const duplicate = this.options.rejectDuplicates && this.items.some(item => sameUploadFile(item.file, file));
      const overBudget = this.options.maxTotalFileSize !== undefined && file.size > this.options.maxTotalFileSize - this.getQueueBytes();
      if (duplicate || overBudget) {
        const reason = duplicate ? 'duplicate' : 'totalSize';
        this.message = duplicate ? `${file.name}: 같은 파일이 목록에 있습니다.` : `${file.name}: 파일 목록의 전체 용량 제한을 넘습니다.`;
        this.options.onReject?.({ file, reason, message: this.message });
        continue;
      }
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
  getQueueBytes() { return this.items.reduce((total, item) => total + item.file.size, 0); }
  async readItem(item) {
    const version = ++item.version,controller=new AbortController();item.controller=controller; item.status = 'reading'; item.error = ''; item.errorStage = null;item.parseStage='starting'; this.notify();
    try {
      const onStage=stage=>{if(this.destroyed||item.version!==version||!this.items.includes(item))return;item.parseStage=stage;this.notify();this.options.onParseProgress?.({id:item.id,stage});};
      if(!this.options.workerURL)onStage('starting');
      const parsed = this.options.workerURL?await parseUploadFileInWorker(item.file,this.options,controller.signal,onStage):await parseUploadFile(item.file,{...this.options,onParseStage:onStage});
      if(!this.options.workerURL)onStage('complete');
      if (this.destroyed || !this.items.includes(item) || item.version !== version) return;
      item.parseStage='complete';item.controller=null;
      item.parsed = parsed; item.sheetIndex = 0; item.headerRow = parsed.sheets[0]?.rowNumbers[0] ?? 0; item.page = 0;
      if (/^image\/(png|jpeg|gif|webp)$/.test(item.file.type) && !item.objectURL) item.objectURL = URL.createObjectURL(item.file);
      this.prepare(item, true);
    } catch (error) { if (this.destroyed || !this.items.includes(item) || item.version !== version) return; item.status = 'error'; item.errorStage = 'parse'; item.error = error.message; this.options.onError?.({ id: item.id, error }); }
    if(item.version===version)item.controller=null;
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
  getFiles() { return this.items.map(i => ({ id: i.id, name: i.file.name, size: i.file.size, type: i.file.type, status: i.status, progress: i.progress, parseStage:i.parseStage??null, error: i.error, sheetName: i.parsed?.sheets[i.sheetIndex]?.name ?? null, rowCount: i.table?.rows.length ?? 0, errorCount: i.result?.errors.length ?? 0 })); }
  getData(id, { validOnly = false } = {}) { const item = this.find(id); return structuredClone((validOnly ? item.result?.validData : item.result?.data) || []); }
  getErrors(id) { return structuredClone(this.find(id).result?.errors || []); }
  getMapping(id) { return { ...this.find(id).mapping }; }
  getSelectedFileId() { return this.activeId; }
  selectFile(id) { this.active(); this.find(id); this.activeId = id; this.render(); }
  notify() { if (this.destroyed) return; this.render(); this.options.onChange?.(this.getFiles()); }
  cancel(id) { this.active(); const item = this.find(id); item.version++; item.controller?.abort(); item.controller = null; item.status = 'cancelled'; item.error = '취소했습니다. 서버 전송 중이었다면 서버의 수신 여부는 별도로 확인하세요.'; this.notify(); }
  removeFile(id) { this.active(); const item = this.find(id); item.version++; item.controller?.abort(); if (item.objectURL) URL.revokeObjectURL(item.objectURL); this.items = this.items.filter(i => i !== item); if (this.activeId === id) this.activeId = this.items[0]?.id || null; this.message = ''; this.notify(); }
  clear() { this.active(); this.batchVersion++; for (const item of this.items) { item.version++; item.controller?.abort(); if (item.objectURL) URL.revokeObjectURL(item.objectURL); } this.items = []; this.activeId = null; this.message = ''; this.notify(); }
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
  cancelAll() { this.active(); this.batchVersion++; for(const item of this.items)if(item.status==='uploading')this.cancel(item.id); }
  async uploadAll() {
    this.active();if(this.batchPromise){await this.batchPromise;return;}
    const version=++this.batchVersion,queue=[...this.items];let index=0;
    const worker=async()=>{while(index<queue.length&&!this.destroyed&&version===this.batchVersion){const item=queue[index++];if(this.items.includes(item)&&item.parsed&&(!item.result||item.result.valid)&&['ready','error','cancelled'].includes(item.status))await this.upload(item.id);}};
    this.batchPromise=Promise.all(Array.from({length:this.options.uploadConcurrency},worker));try{await this.batchPromise;}finally{this.batchPromise=null;}
  }
  async attempt(action) { try { await action(); } catch (error) { this.message = error.message; if (!this.destroyed) this.render(); } }
  render() {
    this.root.replaceChildren();
    const drop = uploadEl('div', null, 'moum-uploader-drop'); const label = uploadEl('label', '파일 선택 또는 이곳에 끌어놓기'), input = uploadEl('input'); input.type = 'file'; input.multiple = this.options.maxFiles > 1; input.accept = this.options.accept; input.addEventListener('change', () => this.attempt(() => this.addFiles(input.files))); label.append(input); drop.append(label, uploadEl('p', 'Excel·CSV·TSV·JSON은 브라우저에서 읽고 검토합니다. 파일은 전송 버튼을 눌러야 서버로 전송됩니다.'));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-dragging'); }); drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging')); drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('is-dragging'); this.attempt(() => this.addFiles(e.dataTransfer.files)); }); this.root.append(drop);
    const tools = uploadEl('div', null, 'moum-uploader-toolbar');
    const button = (text, action, disabled = false) => { const b = uploadEl('button', text); b.type = 'button'; b.disabled = disabled; b.addEventListener('click', () => this.attempt(action)); return b; };
    tools.append(button('모두 전송', () => this.uploadAll(), !this.transport || !this.items.some(i => i.parsed && (!i.result || i.result.valid) && ['ready', 'error', 'cancelled'].includes(i.status))), button('목록 비우기', () => this.clear(), !this.items.length));
    tools.append(button('전체 전송 취소',()=>this.cancelAll(),!this.items.some(i=>i.status==='uploading')));
    if (this.schema.length) tools.append(button('입력 양식 CSV', () => downloadUploadFile(uploadCSV([this.schema.map(f => f.label)]), 'moum-template.csv', 'text/csv;charset=utf-8')));
    this.root.append(tools);
    const message = uploadEl('p', this.message || (this.transport ? '검토 후 전송할 파일을 선택하세요.' : '로컬 검토 모드 · 서버 전송은 연결되지 않았습니다.'), 'moum-uploader-status'); message.setAttribute('aria-live', 'polite'); if (this.message) message.setAttribute('role', 'alert'); this.root.append(message);
    const queue = uploadEl('ul', null, 'moum-uploader-queue');
    for (const item of this.items) {
      const li = uploadEl('li'); if (this.activeId === item.id) li.classList.add('is-active');
      const select = button(item.file.name, () => { this.activeId = item.id; this.render(); }); select.classList.add('moum-uploader-file-name'); select.setAttribute('aria-pressed', String(this.activeId === item.id));
      const info = uploadEl('span', `${(item.file.size / 1024).toFixed(1)}KB · ${uploadStatus[item.status]}`); info.setAttribute('role', 'status'); li.append(select, info);
      if(item.status==='reading'){const progress=uploadEl('progress');progress.setAttribute('aria-label',`${item.file.name} 파싱 중`);li.append(progress,uploadEl('span',{starting:'파서 준비 중',reading:'파일 읽는 중',parsing:'표 데이터 분석 중'}[item.parseStage]||'파일 읽는 중'));}
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

module.exports = { uploadLimits, normalizeUploadLimits, parseDelimited, checkWorkbookArchive, readWorkbookSheet, parseUploadFile, tableFromSheet, normalizeUploadSchema, autoUploadMapping, validateUploadTable, uploadCSV, performUpload, createXHRTransport, parseUploadFileInWorker, downloadUploadFile, Uploader };
