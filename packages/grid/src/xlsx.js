import { FormulaSheet, isFormula, translateFormula } from './formula.js';

export function readXLSX(bytes, library, columns, { sheetName, header = true, formulas = false } = {}) {
  if (!library?.read) throw new Error('XLSX 모듈이 준비되지 않았습니다.');
  const signature = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error('올바른 XLSX 파일이 아닙니다.');
  const book = library.read(bytes, { type: 'array', cellDates: true });
  const name = sheetName || book.SheetNames[0], sheet = book.Sheets[name];
  if (!sheet) throw new Error('가져올 시트를 찾을 수 없습니다.');
  if (!sheet['!ref']) return [];
  const bounds = library.utils.decode_range(sheet['!ref']);
  if ((bounds.e.r + 1) * (bounds.e.c + 1) > 1000000) throw new Error('시트가 너무 큽니다. 필요한 영역만 별도 파일로 저장하세요.');
  const display = cell => cell ? cell.w ?? library.utils.format_cell(cell) : '';
  const mappings = columns.map((column, index) => {
    if (!header) return bounds.s.c + index;
    const matches = [];
    for (let col = bounds.s.c; col <= bounds.e.c; col++) {
      const label = display(sheet[library.utils.encode_cell({ r: bounds.s.r, c: col })]).trim();
      if (label === column.field || label === (column.header || column.field)) matches.push(col);
    }
    if (matches.length > 1) throw new Error(`중복 시트 헤더: ${column.header || column.field}`);
    return matches[0] ?? -1;
  });
  if (new Set(mappings.filter(index => index >= 0)).size !== mappings.filter(index => index >= 0).length) throw new Error('서로 다른 컬럼이 같은 시트 헤더에 연결됩니다.');
  if (header && mappings.every(index => index === -1)) throw new Error('시트의 첫 행에 일치하는 컬럼명이 없습니다.');
  if (formulas && (bounds.s.r !== 0 || bounds.s.c !== 0 || mappings.some((col, index) => col !== index))) throw new Error('수식 가져오기는 A1부터 시작하는 동일한 컬럼 순서의 시트가 필요합니다.');
  const rows = [];
  for (let row = bounds.s.r + (header ? 1 : 0); row <= bounds.e.r; row++) {
    const item = {}; let populated = false;
    columns.forEach((column, index) => {
      const cell = mappings[index] < 0 ? null : sheet[library.utils.encode_cell({ r: row, c: mappings[index] })];
      if (cell?.t === 'e' && !(formulas && cell.f)) throw new Error(`${row + 1}행 ${column.header || column.field}: Excel 오류 셀입니다.`);
      if (cell?.f && cell.v == null && !formulas) throw new Error(`${row + 1}행 ${column.header || column.field}: 수식 계산 결과가 없습니다. Excel에서 계산·저장 후 가져오세요.`);
      if (cell && cell.v != null && cell.v !== '') populated = true;
      let value = cell ? (column.type === 'number' || column.type === 'boolean' ? cell.v : display(cell)) : '';
      if (formulas && cell?.f) { value = translateFormula('=' + cell.f, header ? -1 : 0, 0, { absolute: true }); populated = true; }
      if (value instanceof Date) value = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
      item[column.field] = value;
    });
    if (populated || formulas) rows.push(item);
  }
  return rows;
}

export function writeXLSX(rows, library, columns, { sheetName = '데이터', merges = [], formulas = false } = {}) {
  if (!library?.write) throw new Error('XLSX 모듈이 준비되지 않았습니다.');
  const formulaSheet = formulas ? new FormulaSheet(rows, columns) : null;
  const values = [columns.map(column => column.header || column.field), ...rows.map((row, r) => columns.map((column, c) => {
    const value = row[column.field] ?? '';
    if (!formulas || column.formulas === false || !isFormula(value)) return value;
    const computed = formulaSheet.cell(r, c); if (computed.error) throw new Error(`${r + 1}행 ${column.header || column.field}: ${computed.error}`);
    return { f: translateFormula(value, 1, 0, { absolute: true }).slice(1), v: computed.value ?? '', t: typeof computed.value === 'number' ? 'n' : typeof computed.value === 'boolean' ? 'b' : 's' };
  }))];
  const sheet = library.utils.aoa_to_sheet(values);
  sheet['!cols'] = columns.map(column => ({ wch: Math.max(10, Math.round((column.width || 140) / 8)) }));
  sheet['!merges'] = merges.map(merge => ({ s: { r: merge.row + 1, c: merge.col }, e: { r: merge.row + merge.rowSpan, c: merge.col + merge.colSpan - 1 } }));
  const book = library.utils.book_new(); library.utils.book_append_sheet(book, sheet, sheetName);
  return library.write(book, { type: 'array', bookType: 'xlsx', compression: true });
}
