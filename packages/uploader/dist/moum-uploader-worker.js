/*! MOUM uploader v0.3.0 | MIT License | See LICENSE */
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

self.onmessage = async ({data}) => {
  try {
    if(/\.(xlsx|xls)$/i.test(data.file?.name||''))importScripts('../vendor/sheetjs/xlsx.full.min.js');
    const result=await parseUploadFile(data.file,{...data.options,onParseStage:stage=>self.postMessage({stage})});
    self.postMessage({result});
  }catch(error){self.postMessage({error:{name:error.name,message:error.message}});}
};
