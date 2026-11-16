import { FormulaSheet, isFormula } from './formula.js';

export function parseTSV(text) {
  const rows = [[]];
  let value = '', quoted = false;
  text = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted) quoted = false;
      else if (value === '') quoted = true;
      else value += char;
    } else if (!quoted && (char === '\t' || char === '\n' || char === '\r')) {
      rows[rows.length - 1].push(value.replace(/\r\n?/g, '\n')); value = '';
      if (char !== '\t') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        rows.push([]);
      }
    } else value += char;
  }
  if (quoted) throw new Error('닫히지 않은 따옴표가 있습니다.');
  rows[rows.length - 1].push(value.replace(/\r\n?/g, '\n'));
  if (rows.length > 1 && /(?:\r\n|\r|\n)$/.test(text)) rows.pop();
  return rows;
}

export function toTSV(rows) {
  return rows.map(row => row.map(value => {
    const text = value == null ? '' : String(value);
    return /[\t\r\n"]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join('\t')).join('\r\n');
}

export class GridModel {
  constructor(columns, rows = [], { editable = true, historyLimit = 100, formulas = false } = {}) {
    if (!Array.isArray(columns) || !columns.length) throw new Error('컬럼이 필요합니다.');
    const keys = columns.map(column => column.field);
    if (keys.some(key => typeof key !== 'string' || !key || ['__proto__', 'constructor', 'prototype'].includes(key)) || new Set(keys).size !== keys.length) {
      throw new Error('컬럼 field는 중복되지 않는 안전한 문자열이어야 합니다.');
    }
    if (!Number.isInteger(historyLimit) || historyLimit < 1) throw new Error('historyLimit은 양의 정수여야 합니다.');
    this.columns = columns.map(column => ({ ...column }));
    this.editable = editable;
    this.historyLimit = historyLimit;
    this.formulas = !!formulas; this.revision = 0; this.listeners = new Set();
    this.setData(rows);
  }

  setData(rows) {
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('data는 행 객체 배열이어야 합니다.');
    this.validateRows?.(rows);
    this.rows = rows.map(row => ({ ...row }));
    this.past = []; this.future = [];
    this.touch('reset', []);
  }

  getData() { return this.rows.map(row => ({ ...row })); }
  getComputedData() { return this.formulas ? this.formulaSheet().getData() : this.getData(); }
  formulaSheet() { return this.sheet ||= new FormulaSheet(this.rows, this.columns); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  touch(reason, changes) {
    this.revision++; this.sheet = null;
    for (const listener of this.listeners) {
      try { listener({ reason, changes, revision: this.revision }); }
      catch (error) { queueMicrotask(() => { throw error; }); }
    }
  }
  validateFormulas(rows) {
    if (!this.formulas) return;
    const sheet = new FormulaSheet(rows, this.columns);
    rows.forEach((row, r) => this.columns.forEach((column, c) => {
      if (!isFormula(row[column.field]) || column.formulas === false) return;
      const result = sheet.cell(r, c);
      if (!result.error) this.convert({ ...column, formulas: false }, result.value);
    }));
  }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }

  convert(column, value) {
    if (this.formulas && column.formulas !== false && isFormula(value)) return value;
    if (value === '' || value == null) {
      if (column.required) throw new Error(`${column.header || column.field}: 필수 값입니다.`);
      return column.type === 'number' || column.type === 'boolean' ? null : '';
    }
    if (column.type === 'number') {
      let numeric = String(value).trim().replace(/\u2212/g, '-');
      if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(numeric)) numeric = numeric.replace(/,/g, '');
      if (typeof value === 'boolean' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(numeric) || !Number.isFinite(Number(numeric))) throw new Error(`${column.header || column.field}: 숫자를 입력하세요.`);
      value = Number(numeric);
    } else if (column.type === 'boolean') {
      if (typeof value === 'string') value = value.trim().toLowerCase();
      if ([true, 'true', '1', 1].includes(value)) value = true;
      else if ([false, 'false', '0', 0].includes(value)) value = false;
      else throw new Error(`${column.header || column.field}: true 또는 false를 입력하세요.`);
    } else value = String(value);
    const error = column.validate?.(value);
    if (error) throw new Error(typeof error === 'string' ? error : `${column.header || column.field}: 유효하지 않은 값입니다.`);
    return value;
  }

  apply(changes, reason = 'edit') {
    if (!this.editable) return [];
    const transaction = [], seen = new Set();
    for (const { row, field, value } of changes) {
      const column = this.columns.find(item => item.field === field);
      if (!column || !Number.isInteger(row) || row < 0 || row >= this.rows.length) throw new Error('변경할 셀의 위치가 올바르지 않습니다.');
      if (column.editable === false) continue;
      const key = `${row}:${field}`;
      if (seen.has(key)) throw new Error('같은 셀을 한 작업에서 중복 변경할 수 없습니다.');
      seen.add(key);
      const next = this.convert(column, value), previous = this.rows[row][field];
      if (!Object.is(previous, next)) transaction.push({ row, field, previous, value: next });
    }
    // Validate the entire transaction before changing any cell.
    if (!transaction.length) return [];
    if (this.validateRows || this.formulas) {
      const candidate = this.getData();
      for (const change of transaction) candidate[change.row][change.field] = change.value;
      this.validateRows?.(candidate); this.validateFormulas(candidate);
    }
    for (const change of transaction) this.rows[change.row][change.field] = change.value;
    this.remember({ changes: transaction, reason });
    this.touch(reason, transaction);
    return transaction.map(change => ({ ...change }));
  }

  remember(entry) {
    this.past.push(entry);
    if (this.past.length > this.historyLimit) this.past.shift();
    this.future = [];
  }

  replaceRows(rows, reason = 'replace', validate = true) {
    if (!this.editable) return [];
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('data는 행 객체 배열이어야 합니다.');
    const next = rows.map(row => ({ ...row }));
    if (validate) for (const row of next) for (const column of this.columns) row[column.field] = this.convert(column, row[column.field]);
    this.validateRows?.(next);
    this.validateFormulas(next);
    const before = this.getData();
    if (JSON.stringify(before) === JSON.stringify(next)) return [];
    this.rows = next;
    this.remember({ reason, before, after: this.getData() });
    this.touch(reason, [{ kind: 'rows' }]);
    return [{ kind: 'rows', row: -1, field: null, previous: before.map(row => ({ ...row })), value: this.getData() }];
  }

  insertRows(index, rows) {
    if (!Number.isInteger(index) || index < 0 || index > this.rows.length) throw new Error('행 삽입 위치가 올바르지 않습니다.');
    const next = this.getData(); next.splice(index, 0, ...rows);
    return this.replaceRows(next, 'insert', false);
  }

  removeRows(indices) {
    if (indices.some(index => !Number.isInteger(index) || index < 0 || index >= this.rows.length)) throw new Error('행 삭제 위치가 올바르지 않습니다.');
    const removed = new Set(indices);
    return this.replaceRows(this.rows.filter((_, index) => !removed.has(index)), 'delete', false);
  }

  undo() {
    const entry = this.past.pop();
    if (!entry) return [];
    if (entry.before) {
      this.rows = entry.before.map(row => ({ ...row })); this.future.push(entry);
      this.touch('undo', [{ kind: 'rows' }]);
      return [{ kind: 'rows', row: -1, field: null, previous: entry.after.map(row => ({ ...row })), value: this.getData() }];
    }
    for (const change of entry.changes) this.rows[change.row][change.field] = change.previous;
    this.future.push(entry);
    this.touch('undo', entry.changes);
    return entry.changes.map(change => ({ ...change, value: change.previous, previous: change.value }));
  }

  redo() {
    const entry = this.future.pop();
    if (!entry) return [];
    if (entry.after) {
      this.rows = entry.after.map(row => ({ ...row })); this.past.push(entry);
      this.touch('redo', [{ kind: 'rows' }]);
      return [{ kind: 'rows', row: -1, field: null, previous: entry.before.map(row => ({ ...row })), value: this.getData() }];
    }
    for (const change of entry.changes) this.rows[change.row][change.field] = change.value;
    this.past.push(entry);
    this.touch('redo', entry.changes);
    return entry.changes.map(change => ({ ...change }));
  }
}
