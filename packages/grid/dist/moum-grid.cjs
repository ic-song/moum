/*! MOUM Grid v0.7.1 | MIT License | See LICENSE */
'use strict';
// A bounded expression parser. No JavaScript evaluation or property access.
class FormulaFault extends Error { constructor(code) { super(code); this.code = code; } }
const fault = code => { throw new FormulaFault(code); };
const isFormula = value => typeof value === 'string' && value.startsWith('=');

function columnName(index) {
  let result = '';
  for (index++; index > 0; index = Math.floor((index - 1) / 26)) result = String.fromCharCode(65 + (index - 1) % 26) + result;
  return result;
}
function reference(text) {
  const match = /^(\$?)([A-Z]+)(\$?)([1-9]\d*)$/i.exec(text);
  if (!match) return null;
  let col = 0; for (const char of match[2].toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64;
  return { col: col - 1, row: Number(match[4]) - 1, fixedCol: !!match[1], fixedRow: !!match[3] };
}
function tokens(expression) {
  if (expression.length > 4096) fault('#LIMIT!');
  const output = []; let rest = expression.slice(1);
  while (rest.length) {
    const match = /^(\s+|"(?:[^"]|"")*"|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\$?[A-Za-z_][A-Za-z_0-9$]*|<>|<=|>=|[+\-*/^&=<>():,%])/.exec(rest);
    if (!match) fault('#PARSE!');
    rest = rest.slice(match[0].length); if (!/^\s/.test(match[0])) output.push(match[0]);
    if (output.length > 1024) fault('#LIMIT!');
  }
  return output;
}
const priorities = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
function parseFormula(expression) {
  const list = tokens(expression); let position = 0, depth = 0;
  const parse = (minimum = 0) => {
    if (++depth > 128) fault('#LIMIT!');
    let token = list[position++], left;
    if (token == null) fault('#PARSE!');
    if (token === '+' || token === '-') left = { kind: 'unary', op: token, value: parse(5) };
    else if (token === '(') { left = parse(); if (list[position++] !== ')') fault('#PARSE!'); }
    else if (token.startsWith('"')) left = { kind: 'value', value: token.slice(1, -1).replace(/""/g, '"') };
    else if (/^(?:\d|\.)/.test(token)) left = { kind: 'value', value: Number(token) };
    else if (reference(token)) {
      left = { kind: 'ref', ...reference(token) };
      if (list[position] === ':') { position++; const end = reference(list[position++] || ''); if (!end) fault('#PARSE!'); left = { kind: 'range', start: left, end }; }
    } else if (/^(TRUE|FALSE)$/i.test(token) && list[position] !== '(') left = { kind: 'value', value: token.toUpperCase() === 'TRUE' };
    else if (list[position++] === '(') {
      const args = [];
      if (list[position] !== ')') do { args.push(parse()); if (list[position] !== ',') break; position++; } while (true);
      if (list[position++] !== ')') fault('#PARSE!');
      left = { kind: 'call', name: token.toUpperCase(), args };
    } else fault('#NAME?');
    while (list[position] === '%') { position++; left = { kind: 'binary', op: '/', left, right: { kind: 'value', value: 100 } }; }
    while (priorities[list[position]] >= minimum) {
      const op = list[position++], priority = priorities[op];
      left = { kind: 'binary', op, left, right: parse(priority + (op === '^' ? 0 : 1)) };
    }
    depth--; return left;
  };
  const result = parse(); if (position !== list.length) fault('#PARSE!'); return result;
}
const scalar = value => { if (Array.isArray(value)) fault('#VALUE!'); return value; };
const numeric = value => {
  value = scalar(value); if (value === '' || value == null) return 0;
  if (typeof value === 'boolean') return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  fault('#VALUE!');
};
const truth = value => { value = scalar(value); if (typeof value === 'string' && !/^(true|false)$/i.test(value)) fault('#VALUE!'); return typeof value === 'string' ? value.toLowerCase() === 'true' : !!value; };

class FormulaSheet {
  constructor(rows, columns) { this.rows = rows; this.columns = columns; this.cache = new Map(); this.active = new Set(); this.parsed = new Map(); this.work = 0; }
  cell(row, col) {
    const key = `${row}:${col}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const result = { value: null, error: null };
    try {
      if (row < 0 || col < 0 || row >= this.rows.length || col >= this.columns.length) fault('#REF!');
      if (this.active.has(key)) fault('#CYCLE!');
      if (this.active.size >= 128) fault('#LIMIT!');
      const value = this.rows[row][this.columns[col].field];
      if (!isFormula(value) || this.columns[col].formulas === false) result.value = value;
      else {
        this.active.add(key); const outerWork = this.work; if (this.active.size === 1) this.work = 0;
        try {
          let ast = this.parsed.get(value); if (!ast) { ast = parseFormula(value); if (this.parsed.size < 10000) this.parsed.set(value, ast); }
          result.value = scalar(this.evaluate(ast));
          if (typeof result.value === 'number' && !Number.isFinite(result.value)) fault('#NUM!');
        } finally { this.active.delete(key); this.work = outerWork; }
      }
    } catch (error) { if (!(error instanceof FormulaFault)) throw error; result.value = result.error = error.code; }
    // A cycle discovered deeper in the stack must propagate back through callers.
    this.cache.set(key, result); return result;
  }
  evaluate(ast) {
    const result = this.evaluateNode(ast);
    if (typeof result === 'number' && !Number.isFinite(result)) fault('#NUM!');
    return result;
  }
  evaluateNode(ast) {
    if (++this.work > 100000) fault('#LIMIT!');
    const read = ref => { const result = this.cell(ref.row, ref.col); if (result.error) fault(result.error); return result.value ?? ''; };
    if (ast.kind === 'value') return ast.value;
    if (ast.kind === 'ref') return read(ast);
    if (ast.kind === 'range') {
      const top = Math.min(ast.start.row, ast.end.row), bottom = Math.max(ast.start.row, ast.end.row), left = Math.min(ast.start.col, ast.end.col), right = Math.max(ast.start.col, ast.end.col);
      if ((bottom - top + 1) * (right - left + 1) > 100000) fault('#LIMIT!');
      const values = []; for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) values.push(read({ row, col })); return values;
    }
    if (ast.kind === 'unary') return (ast.op === '-' ? -1 : 1) * numeric(this.evaluate(ast.value));
    if (ast.kind === 'binary') {
      const a = scalar(this.evaluate(ast.left)), b = scalar(this.evaluate(ast.right));
      if (ast.op === '&') return String(a ?? '') + String(b ?? '');
      if (['=', '<>', '<', '>', '<=', '>='].includes(ast.op)) {
        const x = typeof a === 'string' ? a.toLocaleLowerCase() : a, y = typeof b === 'string' ? b.toLocaleLowerCase() : b;
        return ({ '=': () => x === y, '<>': () => x !== y, '<': () => x < y, '>': () => x > y, '<=': () => x <= y, '>=': () => x >= y })[ast.op]();
      }
      const x = numeric(a), y = numeric(b);
      if (ast.op === '/' && y === 0) fault('#DIV/0!');
      return ({ '+': () => x + y, '-': () => x - y, '*': () => x * y, '/': () => x / y, '^': () => x ** y })[ast.op]();
    }
    const { name, args } = ast;
    if (name === 'IF') { if (args.length < 2 || args.length > 3) fault('#VALUE!'); return truth(this.evaluate(args[0])) ? this.evaluate(args[1]) : args[2] ? this.evaluate(args[2]) : false; }
    const functions = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'AND', 'OR', 'NOT', 'ABS', 'ROUND', 'CONCAT'];
    if (!functions.includes(name)) fault('#NAME?');
    const values = args.flatMap(arg => { const value = this.evaluate(arg); return Array.isArray(value) ? value : [value]; });
    const numbers = values.filter(value => typeof value === 'number');
    if (name === 'SUM') return numbers.reduce((a, b) => a + b, 0);
    if (name === 'AVERAGE') { if (!numbers.length) fault('#DIV/0!'); return numbers.reduce((a, b) => a + b, 0) / numbers.length; }
    if (name === 'MIN' || name === 'MAX') return numbers.length ? numbers.reduce((a, b) => name === 'MIN' ? Math.min(a, b) : Math.max(a, b)) : 0;
    if (name === 'COUNT') return numbers.length;
    if (name === 'COUNTA') return values.filter(value => value !== '' && value != null).length;
    if (name === 'CONCAT') return values.map(value => value ?? '').join('');
    if (name === 'AND' || name === 'OR') { if (!values.length) fault('#VALUE!'); const bools = values.map(truth); return name === 'AND' ? bools.every(Boolean) : bools.some(Boolean); }
    if (name === 'NOT' || name === 'ABS') { if (args.length !== 1 || values.length !== 1) fault('#VALUE!'); return name === 'NOT' ? !truth(values[0]) : Math.abs(numeric(values[0])); }
    if (args.length !== 2 || values.length !== 2) fault('#VALUE!');
    const digits = numeric(values[1]); if (!Number.isInteger(digits) || Math.abs(digits) > 15) fault('#NUM!');
    const number = numeric(values[0]), factor = 10 ** digits; return Math.sign(number) * Math.round((Math.abs(number) + Number.EPSILON) * factor) / factor;
  }
  getData() { return this.rows.map((row, r) => Object.fromEntries(Object.entries(row).map(([field, value]) => { const col = this.columns.findIndex(column => column.field === field); return [field, col < 0 ? value : this.cell(r, col).value]; }))); }
}

// Strings are tokenized first, so references inside quoted text remain untouched.
function translateFormula(expression, rowDelta, colDelta, { absolute = false } = {}) {
  if (!isFormula(expression)) return expression;
  return '=' + tokens(expression).map(token => {
    const ref = reference(token); if (!ref) return token;
    const row = ref.row + (absolute || !ref.fixedRow ? rowDelta : 0), col = ref.col + (absolute || !ref.fixedCol ? colDelta : 0);
    if (row < 0 || col < 0 || !Number.isSafeInteger(row) || !Number.isSafeInteger(col)) throw new Error('수식 참조가 범위를 벗어납니다.');
    return `${ref.fixedCol ? '$' : ''}${columnName(col)}${ref.fixedRow ? '$' : ''}${row + 1}`;
  }).join('');
}


function parseTSV(text) {
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

function toTSV(rows) {
  return rows.map(row => row.map(value => {
    const text = value == null ? '' : String(value);
    return /[\t\r\n"]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join('\t')).join('\r\n');
}

class GridModel {
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

const FILTER_OPERATORS = ['contains', 'startsWith', 'equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notEmpty'];

function compareCellValues(a, b, direction = 1) {
  const emptyA = a == null || a === '', emptyB = b == null || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  return direction * (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'ko', { numeric: true }));
}

function matchesFilters(row, filters, logic = 'and') {
  if (!filters.length) return true;
  return filters[logic === 'or' ? 'some' : 'every'](({ field, operator, value, value2 }) => {
    const current = row[field], text = String(current ?? '').toLocaleLowerCase(), input = String(value ?? '').toLocaleLowerCase();
    if (operator === 'empty') return current == null || current === '';
    if (operator === 'notEmpty') return current != null && current !== '';
    if (operator === 'contains') return text.includes(input);
    if (operator === 'startsWith') return text.startsWith(input);
    if (current == null || current === '') return operator === 'notEquals';
    const a = typeof current === 'number' ? current : text;
    const b = typeof current === 'number' ? Number(value) : input;
    if (operator === 'equals') return a === b;
    if (operator === 'notEquals') return a !== b;
    if (operator === 'gt') return a > b;
    if (operator === 'gte') return a >= b;
    if (operator === 'lt') return a < b;
    if (operator === 'lte') return a <= b;
    if (operator === 'between') return a >= b && a <= (typeof current === 'number' ? Number(value2) : String(value2).toLocaleLowerCase());
    return false;
  });
}

function treeIndex(rows, tree) {
  const byId = new Map(), children = new Map();
  rows.forEach((row, index) => {
    const value = row[tree.idField];
    if (value == null || value === '') throw new Error('트리의 노드 ID가 비어 있습니다.');
    const id = String(value);
    if (byId.has(id)) throw new Error(`중복 트리 ID: ${id}`);
    byId.set(id, { row, index, id });
  });
  for (const item of byId.values()) {
    const raw = item.row[tree.parentField], parent = raw == null || raw === '' ? null : String(raw);
    if (parent != null && !byId.has(parent)) throw new Error(`상위 노드를 찾을 수 없습니다: ${parent}`);
    item.parent = parent;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(item);
  }
  const completed = new Set();
  for (const item of byId.values()) {
    const path = new Set(); let cursor = item;
    while (cursor && !completed.has(cursor.id)) {
      if (path.has(cursor.id)) throw new Error('트리 부모 관계에 순환이 있습니다.');
      path.add(cursor.id); cursor = cursor.parent == null ? null : byId.get(cursor.parent);
    }
    for (const id of path) completed.add(id);
  }
  return { byId, children };
}

function buildDisplay(rows, { columns, query = '', filters = [], filterLogic = 'and', sorts = [], groupBy = [], collapsedGroups = new Set(), tree = null, collapsedNodes = new Set() }) {
  const text = query.trim().toLocaleLowerCase();
  const matches = row => matchesFilters(row, filters, filterLogic) && (!text || columns.some(column => String(row[column.field] ?? '').toLocaleLowerCase().includes(text)));
  const compare = (a, b) => {
    for (const sort of sorts) { const result = compareCellValues(a.row[sort.field], b.row[sort.field], sort.direction); if (result) return result; }
    return a.index - b.index;
  };
  const display = [], view = [];
  const addData = item => { view.push(item); display.push({ type: 'data', item, viewIndex: view.length - 1 }); };
  if (tree) {
    const { byId, children } = treeIndex(rows, tree), allowed = new Set();
    if (text || filters.length) {
      for (const item of byId.values()) if (matches(item.row)) {
        let cursor = item;
        while (cursor && !allowed.has(cursor.id)) { allowed.add(cursor.id); cursor = cursor.parent == null ? null : byId.get(cursor.parent); }
      }
    } else for (const id of byId.keys()) allowed.add(id);
    const stack = [...(children.get(null) || [])].sort(compare).reverse().map(item => ({ ...item, depth: 0 }));
    while (stack.length) {
      const item = stack.pop(); if (!allowed.has(item.id)) continue;
      const descendants = (children.get(item.id) || []).filter(child => allowed.has(child.id));
      const expanded = !collapsedNodes.has(item.id) || Boolean(text || filters.length);
      addData({ ...item, hasChildren: descendants.length > 0, expanded });
      if (expanded) for (const child of [...descendants].sort(compare).reverse()) stack.push({ ...child, depth: item.depth + 1 });
    }
  } else {
    const items = rows.map((row, index) => ({ row, index })).filter(item => matches(item.row)).sort(compare);
    const group = (members, depth, path) => {
      if (depth === groupBy.length) { members.forEach(addData); return; }
      const field = groupBy[depth], buckets = new Map();
      for (const item of members) {
        const value = item.row[field] ?? '', key = JSON.stringify([typeof value, value]);
        if (!buckets.has(key)) buckets.set(key, { value, items: [] }); buckets.get(key).items.push(item);
      }
      for (const bucket of buckets.values()) {
        const key = JSON.stringify([...path, [field, bucket.value]]), expanded = !collapsedGroups.has(key);
        const summary = Object.fromEntries(columns.filter(column => column.type === 'number').map(column => [column.field, bucket.items.reduce((sum, item) => sum + (typeof item.row[column.field] === 'number' ? item.row[column.field] : 0), 0)]));
        const descriptor = { key, field, value: bucket.value, count: bucket.items.length, depth, expanded, summary };
        display.push({ type: 'group', group: descriptor });
        if (expanded) { group(bucket.items, depth + 1, [...path, [field, bucket.value]]); display.push({ type: 'summary', group: descriptor }); }
      }
    };
    group(items, 0, []);
  }
  return { display, view };
}


function parseClipboardData(plain, html, numericColumns = new Set()) {
  const rich = parseClipboardHTML(html, numericColumns);
  const matrix = plain !== '' ? parseTSV(plain) : null;
  if (!rich) return matrix || [['']];
  if (!matrix || matrix.length !== rich.length || Math.max(...matrix.map(row => row.length)) !== rich[0].length) return rich;
  // Excel plain text preserves literal tabs/spaces better; rich numeric cells can carry raw precision.
  return matrix.map((row, y) => rich[y].map((value, x) => numericColumns.has(x) ? value : row[x] ?? ''));
}

function parseClipboardHTML(html, numericColumns = new Set()) {
  if (!html || !/<table[\s>]/i.test(html)) return null;
  // Read in an inert template: never attach pasted HTML or load its resources.
  const template = document.createElement('template'); template.innerHTML = html;
  const table = template.content.querySelector('table'); if (!table) return null;
  const output = [];
  const text = element => {
    if (element.nodeType === 3) return element.nodeValue;
    if (element.nodeType !== 1 || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) return '';
    if (element.tagName === 'BR') return '\n';
    return [...element.childNodes].map(text).join('');
  };
  for (const [y, row] of [...table.rows].entries()) {
    if (!output[y]) output[y] = [];
    let x = 0;
    for (const cell of row.cells) {
      while (output[y][x] !== undefined) x++;
      const height = Math.max(1, cell.rowSpan), width = Math.max(1, cell.colSpan);
      if ((y + height) * (x + width) > 100000 || height > 10000 || width > 1000) throw new Error('복사된 표가 너무 큽니다. 영역을 나누어 붙여넣으세요.');
      const rawNumber = cell.getAttribute('x:num');
      const displayed = text(cell).replace(/\r\n/g, '\n');
      const value = numericColumns.has(x) && rawNumber != null && rawNumber !== '' ? rawNumber : displayed === '\u00a0' ? '' : displayed;
      for (let dy = 0; dy < height; dy++) {
        if (!output[y + dy]) output[y + dy] = [];
        for (let dx = 0; dx < width; dx++) output[y + dy][x + dx] = dy === 0 && dx === 0 ? value : '';
      }
      x += width;
    }
  }
  const width = Math.max(0, ...output.map(row => row.length));
  return width ? output.map(row => Array.from({ length: width }, (_, col) => row[col] ?? '')) : null;
}


function readXLSX(bytes, library, columns, { sheetName, header = true, formulas = false } = {}) {
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

function writeXLSX(rows, library, columns, { sheetName = '데이터', merges = [], formulas = false } = {}) {
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

function virtualWindow(count, scrollTop, height, rowHeight = 48, overscan = 5) {
  const start = Math.max(0, Math.min(count, Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan));
  const end = Math.min(count, Math.max(start, Math.ceil((Math.max(0, scrollTop) + height) / rowHeight) + overscan));
  return { start, end, before: start * rowHeight, after: (count - end) * rowHeight };
}

function columnWindow(columns, scrollLeft, width, frozen = 0, virtual = true) {
  const widths = columns.map(column => Math.max(64, Math.min(1000, Number(column.width) || 140)));
  const offsets = [48]; for (const size of widths) offsets.push(offsets.at(-1) + size);
  let start = frozen, end = columns.length;
  if (virtual) {
    const fixed = offsets[frozen];
    while (start < columns.length && offsets[start + 1] < scrollLeft + fixed) start++;
    end = start; while (end < columns.length && offsets[end] < scrollLeft + width) end++;
    start = Math.max(frozen, start - 2); end = Math.min(columns.length, Math.max(start + 1, end + 2));
  }
  const slots = [];
  for (let col = 0; col < frozen; col++) slots.push({ col, width: widths[col] });
  if (start > frozen) slots.push({ gap: true, width: offsets[start] - offsets[frozen] });
  for (let col = start; col < end; col++) slots.push({ col, width: widths[col] });
  if (end < columns.length) slots.push({ gap: true, width: offsets.at(-1) - offsets[end] });
  return { slots, offsets, total: offsets.at(-1) };
}

const DATA_MODES = ['virtual', 'infinite', 'pagination'];
function validatePageSize(size) {
  if (!Number.isInteger(size) || size < 1 || size > 10000) throw new Error('페이지 크기는 1~10,000의 정수여야 합니다.');
  return size;
}
function rowWindow(result, { mode = 'virtual', pageSize = 100, pageIndex = 0, loaded = pageSize } = {}) {
  if (!DATA_MODES.includes(mode)) throw new Error('표시 방식은 virtual, infinite, pagination 중 선택하세요.');
  validatePageSize(pageSize);
  const total = result.display.length, pageCount = Math.ceil(total / pageSize);
  pageIndex = Math.max(0, Math.min(pageCount - 1, pageIndex));
  const start = mode === 'pagination' ? pageIndex * pageSize : 0;
  const end = Math.min(total, mode === 'pagination' ? start + pageSize : mode === 'infinite' ? Math.max(pageSize, loaded) : total);
  const view = [], display = result.display.slice(start, end).map(entry => {
    if (entry.type !== 'data') return entry;
    const item = { ...entry.item, position: entry.viewIndex };
    view.push(item); return { ...entry, item, viewIndex: view.length - 1 };
  });
  return { view, display, state: { mode, pageSize, pageIndex, pageCount, total, totalRows: result.view.length, start, end, loaded: end, hasMore: end < total } };
}

// The host supplies transport/authentication; the core never chooses a network URL.
function withRequestTimeout(load, controller, timeoutMs) {
  const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason || Error('요청 취소')), { once: true }));
  const timer = setTimeout(() => controller.abort(Object.assign(Error('서버 응답 시간이 초과됐습니다. 다시 시도하세요.'), { name: 'TimeoutError' })), timeoutMs);
  const pending = Promise.resolve().then(() => { if (controller.signal.aborted) throw controller.signal.reason; return load(); });
  return Promise.race([pending, aborted]).finally(() => clearTimeout(timer));
}

class RemoteData {
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


const draftField = '__moumClientId';
const copy = value => JSON.parse(JSON.stringify(value));
function requestToken() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
}

// Compare against the loaded server window so undo/redo also changes the pending batch.
class RemoteChanges {
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


class IndexedDraftStorage {
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
class DraftRecovery {
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


let gridSequence = 0;

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text != null) result.textContent = text;
  if (className) result.className = className;
  return result;
}

class Grid {
  constructor(target, options) {
    this.host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.host || this.host.childNodes.length) throw new Error('비어 있는 그리드 컨테이너가 필요합니다.');
    this.options = options;
    if (options.recovery && (options.model || options.dataSource && !options.dataSource.save || options.editable === false)) throw Error('복구 기능은 편집 가능한 독립 로컬/서버 save 그리드에서 사용하세요.');
    if (options.dataSource && (options.model || options.data?.length || options.formulas || options.tree || options.groupBy?.length)) throw new Error('서버 데이터는 공유 모델·초기 데이터·A1 수식·그룹·트리와 함께 사용하지 않습니다.');
    this.model = options.model || new GridModel(options.columns, options.data || [], { ...options, editable: options.dataSource ? false : options.editable });
    if (options.dataSource) this.remote = new RemoteData(options.dataSource, { onChange: () => this.renderRemote(), convertRow: row => { const item = { ...row }; for (const column of this.columns) item[column.field] = this.model.convert(column, row[column.field]); this.remoteChanges?.validateVersions([item]); return item; } });
    this.columns = options.model ? options.columns.map(column => ({ ...column })) : this.model.columns;
    this.baseEditable = this.model.editable;
    if (options.dataSource?.save != null && typeof options.dataSource.save !== 'function') throw Error('dataSource.save는 함수여야 합니다.');
    if (options.dataSource?.save && options.editable !== false) this.remoteChanges = new RemoteChanges(this.remote, this.model);
    this.virtual = options.virtual !== false; this.rowHeight = 48;
    this.dataMode = options.dataMode || (this.remote ? 'pagination' : 'virtual');
    if (this.remote && this.dataMode === 'virtual') throw new Error('서버 데이터는 pagination 또는 infinite 모드로 사용하세요.');
    if (!DATA_MODES.includes(this.dataMode)) throw new Error('올바른 dataMode가 필요합니다.');
    this.pageSize = validatePageSize(options.pageSize ?? 100); this.pageIndex = 0; this.loadedLimit = this.pageSize;
    this.anchor = { row: 0, col: 0 }; this.current = { ...this.anchor };
    this.query = ''; this.sorts = []; this.filters = []; this.filterLogic = 'and'; this.groupBy = []; this.tree = null;
    this.collapsedGroups = new Set(); this.collapsedNodes = new Set(); this.merges = []; this.mergeOwners = new Map();
    this.frozenColumns = 0; this.xlsx = options.xlsx || globalThis.XLSX;
    this.dataRevision = 0; this.importSequence = 0;
    this.editor = null; this.destroyed = false;
    this.events = new AbortController();
    const signal = this.events.signal;
    this.root = node('div', null, 'moum-grid');
    this.toolbar = node('div', null, 'moum-grid__toolbar');
    const searchLabel = node('label', '검색 ', 'moum-grid__search');
    this.search = node('input'); this.search.type = 'search'; this.search.placeholder = '전체 데이터 검색';
    this.search.addEventListener('input', () => { clearTimeout(this.searchTimer); if (this.remote) this.searchTimer = setTimeout(() => { if (!this.destroyed) this.setSearch(this.search.value); }, 200); else { this.query = this.search.value; this.merges = []; this.resetSelection(); this.render(); } }, { signal });
    searchLabel.append(this.search);
    const button = (text, action) => {
      const control = node('button', text); control.type = 'button';
      control.addEventListener('click', action, { signal }); this.toolbar.append(control); return control;
    };
    this.toolbar.append(searchLabel);
    this.undoButton = button('되돌리기', () => this.undo());
    this.redoButton = button('다시 실행', () => this.redo());
    this.clearButton = button('선택 지우기', () => this.clearSelection());
    this.addButton = button('행 추가', () => this.addRow());
    this.removeButton = button('선택 행 삭제', () => this.deleteSelectedRows());
    this.saveButton = button('변경 저장', () => this.saveChanges()); this.saveButton.hidden = !this.remoteChanges;
    this.discardButton = button('변경 취소', () => this.discardChanges()); this.discardButton.hidden = !this.remoteChanges;
    window.addEventListener('beforeunload', event => { this.persistDraft(); if (this.remoteChanges?.dirty || this.remoteChanges?.locked || this.recovery && this.isDraftDirty()) { event.preventDefault(); event.returnValue = ''; } }, { signal });
    window.addEventListener('pagehide', () => this.persistDraft(), { signal });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.persistDraft(); }, { signal });
    this.filterButton = button('필터', () => { this.filterPanel.hidden = !this.filterPanel.hidden; this.filterButton.setAttribute('aria-expanded', String(!this.filterPanel.hidden)); });
    this.filterButton.setAttribute('aria-expanded', 'false');
    this.mergeButton = button('셀 병합', () => this.mergeSelection()); this.unmergeButton = button('병합 해제', () => this.unmergeSelection());
    button('CSV 내보내기', () => this.downloadCSV());
    this.fileInput = node('input'); this.fileInput.type = 'file'; this.fileInput.accept = '.xlsx'; this.fileInput.hidden = true;
    this.fileInput.addEventListener('change', async () => { const file = this.fileInput.files[0]; if (file) await this.importXLSX(file); this.fileInput.value = ''; }, { signal });
    this.importButton = button('XLSX 가져오기', () => this.fileInput.click());
    const exportLabel = node('label', '다운로드 범위 ', 'moum-grid__option'); this.exportScope = node('select'); this.exportScope.setAttribute('aria-label', '엑셀 다운로드 범위');
    for (const [value, title] of [['view', '현재 표시 행'], ['filtered', '검색·정렬 결과'], ['all', '전체 데이터'], ['selection', '선택 영역']]) { const option = node('option', title); option.value = value; this.exportScope.append(option); }
    exportLabel.append(this.exportScope); this.toolbar.append(exportLabel);
    this.exportButton = button('엑셀 다운로드', () => this.exportXLSX({ scope: this.exportScope.value }));
    this.exportButton.title = this.xlsx ? '선택한 범위를 .xlsx 파일로 다운로드' : '로컬 SheetJS 모듈을 먼저 로드하세요.';
    this.importButton.disabled = !this.xlsx || !this.editable; this.exportButton.disabled = !this.xlsx;
    const frozenLabel = node('label', '고정 열 ', 'moum-grid__option'); this.frozenSelect = node('select');
    this.frozenSelect.setAttribute('aria-label', '고정 열');
    for (let count = 0; count <= this.columns.length; count++) { const option = node('option', count ? `${count}열` : '없음'); option.value = count; this.frozenSelect.append(option); }
    this.frozenSelect.addEventListener('change', () => this.setFrozenColumns(Number(this.frozenSelect.value)), { signal }); frozenLabel.append(this.frozenSelect); this.toolbar.append(frozenLabel);
    const groupLabel = node('label', '그룹 ', 'moum-grid__option'); this.groupSelect = node('select');
    this.groupSelect.setAttribute('aria-label', '그룹');
    const noGroup = node('option', '없음'); noGroup.value = ''; this.groupSelect.append(noGroup);
    for (const column of this.columns) { const option = node('option', column.header || column.field); option.value = column.field; this.groupSelect.append(option); }
    this.groupSelect.addEventListener('change', () => this.setGroupBy(this.groupSelect.value ? [this.groupSelect.value] : []), { signal }); groupLabel.append(this.groupSelect); this.toolbar.append(groupLabel);
    const modeLabel = node('label', '표시 방식 ', 'moum-grid__option'); this.modeSelect = node('select'); this.modeSelect.setAttribute('aria-label', '표시 방식');
    for (const [value, title] of [['virtual', '가상 스크롤'], ['infinite', '무한 스크롤'], ['pagination', '페이징']]) { const option = node('option', title); option.value = value; this.modeSelect.append(option); }
    this.modeSelect.value = this.dataMode; this.modeSelect.addEventListener('change', () => this.setDataMode(this.modeSelect.value), { signal }); modeLabel.append(this.modeSelect); this.toolbar.append(modeLabel);
    this.coordinate = node('span', '', 'moum-grid__coordinate'); this.toolbar.append(this.coordinate);
    this.filterPanel = this.createFilterPanel();
    this.viewport = node('div', null, 'moum-grid__viewport');
    this.table = node('table'); this.table.setAttribute('role', 'grid'); this.table.setAttribute('aria-label', options.label || '데이터 편집 그리드');
    this.table.setAttribute('aria-multiselectable', 'true');
    this.viewport.append(this.table);
    this.status = node('div', '', 'moum-grid__status'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    this.status.id = `moum-grid-status-${++gridSequence}`;
    this.navigation = this.createNavigation();
    this.loadState = node('div', null, 'moum-grid__load-state'); this.loadState.hidden = true;
    this.loadText = node('span'); this.loadText.setAttribute('role', 'status'); this.loadText.setAttribute('aria-live', 'polite');
    this.retryButton = node('button', '다시 시도'); this.retryButton.type = 'button'; this.retryButton.hidden = true;
    this.retryButton.addEventListener('click', () => this.retryLoad(), { signal });
    this.reloadButton = node('button', '서버 새로고침'); this.reloadButton.type = 'button'; this.reloadButton.addEventListener('click', () => this.reload(), { signal });
    this.loadState.append(this.loadText, this.retryButton, this.reloadButton);
    this.recoveryPanel = node('div', null, 'moum-grid__recovery'); this.recoveryPanel.hidden = true;
    this.recoveryText = node('span'); this.recoveryText.setAttribute('role', 'status'); this.recoveryText.setAttribute('aria-live', 'polite');
    this.draftSelect = node('select'); this.draftSelect.setAttribute('aria-label', '복구할 임시 저장본');
    const recoveryButton = (text, action) => { const control = node('button', text); control.type = 'button'; control.addEventListener('click', action, { signal }); this.recoveryPanel.append(control); return control; };
    this.recoveryPanel.append(this.recoveryText, this.draftSelect);
    this.restoreButton = recoveryButton('임시 저장 복구', () => this.restoreDraft(this.draftSelect.value));
    this.deleteDraftButton = recoveryButton('복구본 삭제', () => this.discardDraft(this.draftSelect.value));
    this.downloadDraftButton = recoveryButton('복구본 내려받기', () => this.downloadDraft(this.draftSelect.value));
    this.retryDraftButton = recoveryButton('임시 저장 재시도', () => this.flushDraft());
    this.root.append(this.toolbar, this.filterPanel, this.loadState, this.recoveryPanel, this.viewport, this.navigation, this.status, this.fileInput);
    if (this.remote) { this.modeSelect.querySelector('[value=virtual]').disabled = true; this.groupSelect.disabled = true; }
 this.host.append(this.root);
    this.table.addEventListener('keydown', event => this.onKey(event), { signal });
    this.table.addEventListener('dblclick', event => { const cell = this.cellAt(event.target); if (cell) this.startEdit(cell); }, { signal });
    this.table.addEventListener('beforeinput', event => {
      if (!this.editor && event.inputType === 'insertCompositionText') { const cell = this.cellAt(event.target); if (cell) this.startEdit(cell, ''); }
    }, { signal });
    this.table.addEventListener('pointerdown', event => {
      if (event.button !== 0 || this.editor?.input.contains(event.target)) return;
      const cell = this.cellAt(event.target); if (!cell) return;
      if (this.editor && !this.finishEdit()) return;
      this.dragging = true; this.select(cell, event.shiftKey); event.preventDefault();
    }, { signal });
    this.table.addEventListener('pointerover', event => {
      if (!this.dragging || !(event.buttons & 1)) return;
      const cell = this.cellAt(event.target); if (cell) this.select(cell, true);
    }, { signal });
    document.addEventListener('pointerup', () => { this.dragging = false; }, { signal });
    document.addEventListener('pointermove', event => {
      if (!this.resizing) return;
      this.setColumnWidth(this.resizing.field, this.resizing.width + event.clientX - this.resizing.x);
    }, { signal });
    document.addEventListener('pointerup', () => { this.resizing = null; }, { signal });
    this.viewport.addEventListener('scroll', () => {
      if (this.editor || (!this.virtualActive && this.dataMode !== 'infinite')) return;
      if (!this.scrollFrame) this.scrollFrame = requestAnimationFrame(() => {
        this.scrollFrame = 0; if (this.destroyed || this.editor) return;
        if (!this.maybeLoadMore() && this.virtualActive) this.renderViewport();
      });
    }, { signal });
    this.unsubscribe = this.model.subscribe(({ reason }) => {
      if (this.localWrite || this.destroyed) return;
      this.dataRevision++;
      if (this.editor) { this.message('외부 데이터가 변경됐습니다. 편집을 취소하고 다시 입력하세요.', true); return; }
      if (reason === 'reset') { this.resetRowWindow(); this.resetSelection(); }
      this.merges = []; this.render(); this.persistDraft();
    });
    this.resizeObserver = new ResizeObserver(() => { if (this.virtualActive && !this.editor) this.renderViewport(); else this.updateColumnGeometry(); if (!this.editor) this.maybeLoadMore(); }); this.resizeObserver.observe(this.viewport);
    this.table.addEventListener('copy', event => {
      if (this.editor || !event.clipboardData || !this.view.length) return;
      event.clipboardData.setData('text/plain', this.copySelection());
      if (this.model.formulas) event.clipboardData.setData('application/x-moum-grid', JSON.stringify(this.copyRawSelection()));
      event.preventDefault();
      this.message('선택 영역을 복사했습니다. 엑셀에 붙여넣을 수 있습니다.');
    }, { signal });
    this.table.addEventListener('paste', event => {
      if (this.editor || !event.clipboardData) return;
      const plain = event.clipboardData.getData('text/plain'), html = event.clipboardData.getData('text/html');
      if (![...event.clipboardData.types].includes('text/plain') && !/<table[\s>]/i.test(html)) return;
      event.preventDefault();
      try {
        const left = this.getSelection().left;
        const numeric = new Set(this.columns.slice(left).map((column, index) => column.type === 'number' ? index : -1));
        const matrix = parseClipboardData(plain, html, numeric);
        const own = event.clipboardData.getData('application/x-moum-grid');
        if (own && this.model.formulas) {
          const payload = JSON.parse(own);
          if (payload.version !== 1 || !Array.isArray(payload.cells)) throw new Error('수식 클립보드 형식이 올바르지 않습니다.');
          const top = this.getSelection().top;
          const translated = payload.cells.map((row, y) => row.map((cell, x) => {
            if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) throw new Error('수식 클립보드 좌표가 올바르지 않습니다.');
            return translateFormula(cell.value, (this.view[top + y]?.index ?? this.model.rows.length + top + y - this.view.length) - cell.row, this.model.columns.findIndex(item => item.field === this.columns[left + x]?.field) - cell.col);
          }));
          this.paste(translated);
        } else this.paste(matrix);
      } catch (error) { this.message(error.message, true); }
    }, { signal });
    try {
      if (options.recovery) {
        this.localDraftBaseline = JSON.stringify(this.model.rows);
        const schema = JSON.stringify([options.recovery.schemaVersion ?? '1', this.columns.map(({ field, type, editable, required }) => [field, type ?? 'text', editable !== false, !!required]), this.remote ? [this.remote.rowKey, this.remoteChanges.versionField] : null, !!options.formulas, options.tree ?? null]);
        this.recovery = new DraftRecovery(options.recovery, { schema, onChange: () => this.updateRecoveryControls() });
        this.recoveryReady = this.recovery.ready.then(() => { if (!this.destroyed) this.persistDraft(); return !this.recovery.error; });
      } else this.recoveryReady = Promise.resolve(true);
      this.render();
      if (options.frozenColumns) this.setFrozenColumns(options.frozenColumns);
      if (options.tree) this.setTree(options.tree);
      if (options.groupBy) this.setGroupBy(options.groupBy);
    } catch (error) { this.destroy(); throw error; }
  }

  get editable() { return this.model.editable && this.options.editable !== false; }

  updateEditability() {
    if (!this.remote && !this.recovery) return;
    this.model.editable = !this.recovery?.blocked && (this.remote ? !!this.remoteChanges && !this.remote.loading && !this.remote.error && !this.remoteChanges.locked : this.baseEditable);
  }
  isDraftDirty() {
    if (this.recovery?.awaiting) return true;
    const editorChanged = this.editor && this.editor.input.value !== String(this.model.rows[this.editor.dataRow]?.[this.editor.column.field] ?? '');
    return !!editorChanged || (this.remoteChanges ? this.remoteChanges.dirty || this.remoteChanges.locked : JSON.stringify(this.model.rows) !== this.localDraftBaseline);
  }
  getRecoveryState() { return this.recovery ? { ...this.recovery.getState(), dirty: this.isDraftDirty() } : { enabled: false, status: 'disabled', dirty: false }; }
  updateRecoveryControls() {
    if (this.destroyed || !this.recovery) return;
    const state = this.recovery.getState(), previous = this.model.editable;
    this.updateEditability(); this.recoveryPanel.hidden = false; this.recoveryPanel.classList.toggle('is-error', !!state.error);
    const messages = { loading: '임시 저장본을 확인하는 중…', available: `복구할 미저장 작업 ${state.candidates}개가 있습니다. 복구하거나 삭제한 뒤 편집하세요.`, writing: '브라우저에 임시 저장 중…', saved: `브라우저 임시 저장 완료 · ${new Date(state.savedAt).toLocaleTimeString()}`, idle: '미저장 작업 자동 복구 사용 중' };
    this.recoveryText.textContent = state.error || messages[state.status];
    const selected = this.draftSelect.value;
    this.draftSelect.replaceChildren(...this.recovery.candidates.map(item => { const option = node('option', `${new Date(item.updatedAt).toLocaleString()} · ${item.id.slice(0, 6)}`); option.value = item.id; return option; }));
    if (this.recovery.candidate(selected)) this.draftSelect.value = selected;
    for (const control of [this.draftSelect, this.restoreButton, this.deleteDraftButton]) control.hidden = !this.recovery.awaiting;
    this.downloadDraftButton.hidden = !this.recovery.awaiting && !state.error;
    this.retryDraftButton.hidden = !state.error || this.recovery.awaiting;
    if (!this.remoteChanges) { this.discardButton.hidden = false; this.discardButton.disabled = this.recovery.blocked || !this.isDraftDirty(); }
    if (this.view && previous !== this.model.editable && !this.editor) this.renderViewport();
  }
  snapshotDraft() {
    if (this.remoteChanges?.status === 'refresh' && this.refreshDraftSnapshot) return this.refreshDraftSnapshot;
    if (!this.recovery || !this.isDraftDirty()) return null;
    const editor = this.editor ? { row: this.editor.dataRow, field: this.editor.column.field, value: this.editor.input.value, start: this.editor.input.selectionStart, end: this.editor.input.selectionEnd } : null;
    const result = { format: 1, kind: this.remote ? 'server' : 'local', rows: this.getData({ raw: true }), baseline: this.remoteChanges?.baseline ?? JSON.parse(this.localDraftBaseline), editor };
    if (this.remote) result.server = { criteria: this.remote.criteria, mode: this.dataMode, pageSize: this.pageSize, offset: this.remote.offset, total: this.remote.total, status: this.remoteChanges.status, error: this.remoteChanges.error, pending: ['saving', 'uncertain'].includes(this.remoteChanges.status) ? this.remoteChanges.pending : null };
    return result;
  }
  persistDraft(force = false) {
    if (this.restoringDraft) return false;
    if (!this.recovery || this.recovery.blocked || this.destroyed || !force && this.remote && (this.remote.loading || this.remoteChanges.status === 'refresh')) return !this.recovery?.blocked;
    if (this.remoteChanges?.status !== 'refresh') this.refreshDraftSnapshot = null;
    const snapshot = this.snapshotDraft();
    if (this.remoteChanges?.status === 'refresh') this.refreshDraftSnapshot = snapshot;
    return this.recovery.write(snapshot);
  }
  async flushDraft() {
    if (!this.recovery) return true;
    await this.recoveryReady; if (!this.persistDraft(true)) return false; return this.recovery.flush();
  }
  markSaved() {
    if (this.remote || !this.recovery || this.recovery.blocked || !this.finishEdit()) return Promise.resolve(false);
    this.localDraftBaseline = JSON.stringify(this.model.rows); return this.flushDraft();
  }
  async restoreDraft(id = this.draftSelect.value) {
    if (!this.recovery?.awaiting) return false;
    try {
      const draft = this.recovery.read(id);
      if (draft.kind !== (this.remote ? 'server' : 'local')) throw Error('다른 데이터 모드의 복구본입니다.');
      for (const rows of [draft.rows, draft.baseline]) {
        if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('복구 행 형식이 올바르지 않습니다.');
        for (const row of rows) for (const column of this.model.columns) this.model.convert({ ...column, required: false, validate: undefined }, row[column.field]);
        this.model.validateRows?.(rows);
      }
      if (draft.editor && (!Number.isInteger(draft.editor.row) || draft.editor.row < 0 || draft.editor.row >= draft.rows.length || !this.columns.some(column => column.field === draft.editor.field && column.editable !== false) || typeof draft.editor.value !== 'string')) throw Error('복구할 입력창 위치가 올바르지 않습니다.');
      if (this.remote) {
        const state = draft.server;
        if (!state || !['pagination', 'infinite'].includes(state.mode) || !Number.isInteger(state.offset) || state.offset < 0 || !Number.isSafeInteger(state.total) || state.total < 0 || !state.criteria || typeof state.criteria.query !== 'string' || !Array.isArray(state.criteria.sorts) || !Array.isArray(state.criteria.filters) || !['and', 'or'].includes(state.criteria.filterLogic) || !['idle', 'error', 'saving', 'uncertain', 'refresh'].includes(state.status)) throw Error('서버 복구 상태가 올바르지 않습니다.');
        validatePageSize(state.pageSize); this.remote.validateRows(draft.baseline);
        if (draft.editor && ['saving', 'uncertain', 'refresh'].includes(state.status)) throw Error('잠긴 서버 저장 상태에 입력창이 포함돼 있습니다.');
        const model = new GridModel(this.model.columns, draft.rows), journal = new RemoteChanges(this.remote, model); journal.reset(draft.baseline); const changes = journal.getChanges();
        if (['saving', 'uncertain'].includes(state.status) && (!state.pending || !/^[a-f0-9]{32}$/.test(state.pending.requestId) || JSON.stringify(changes) !== JSON.stringify({ created: state.pending.created, updated: state.pending.updated, deleted: state.pending.deleted }))) throw Error('미확정 저장 요청과 복구 행이 일치하지 않습니다.');
      }
      this.editor = null; this.merges = []; this.restoringDraft = true;
      if (this.remote) {
        this.remote.sequence++; this.remote.controller?.abort(); this.remote.loading = false; this.remote.error = null;
        this.remote.pendingKey = null; this.remote.promise = Promise.resolve(true); this.ready = this.remote.promise;
        const state = draft.server; this.query = state.criteria.query; this.search.value = this.query; this.sorts = state.criteria.sorts; this.filters = state.criteria.filters; this.filterLogic = state.criteria.filterLogic;
        this.dataMode = state.mode; this.pageSize = state.pageSize; this.remote.criteria = state.criteria; this.remote.mode = state.mode; this.remote.pageSize = state.pageSize;
        if (![...this.sizeSelect.options].some(option => Number(option.value) === state.pageSize)) { const option = node('option', String(state.pageSize)); option.value = state.pageSize; this.sizeSelect.append(option); }
        this.updateFilterControls();
        this.remote.queryKey = JSON.stringify([state.criteria, state.mode, state.pageSize]); this.remote.rows = draft.baseline; this.remoteRows = this.remote.rows; this.remote.offset = state.offset; this.remote.total = state.total;
        this.remoteChanges.reset(draft.baseline); this.remoteChanges.status = state.status === 'saving' ? 'uncertain' : state.status; this.remoteChanges.error = state.error;
        this.remoteChanges.pending = state.pending; this.remoteChanges.fingerprint = state.pending ? JSON.stringify({ created: state.pending.created, updated: state.pending.updated, deleted: state.pending.deleted }) : null;
      } else {
        this.localDraftBaseline = JSON.stringify(draft.baseline);
        this.query = ''; this.search.value = ''; this.filters = []; this.sorts = []; this.collapsedGroups.clear(); this.collapsedNodes.clear(); this.updateFilterControls();
      }
      this.mutateModel('setData', draft.rows); this.dataRevision++; this.resetSelection(); this.recovery.adopt(id);
      if (this.remote) this.renderRemote(); else this.render();
      this.focusCell();
      if (draft.editor && this.editable) {
        this.revealDataRow(draft.editor.row); const row = this.view.findIndex(item => item.index === draft.editor.row), col = this.columns.findIndex(column => column.field === draft.editor.field);
        if (row >= 0) { this.startEdit({ row, col }, draft.editor.value); this.editor?.input.setSelectionRange(draft.editor.start ?? 0, draft.editor.end ?? draft.editor.value.length); }
        if (!this.editor || this.editor.column.field !== draft.editor.field) throw Error('복구할 입력창을 표시하지 못했습니다. 복구본은 보존됩니다.');
      }
      this.restoringDraft = false;
      await this.flushDraft();
      if (this.remoteChanges?.status === 'refresh') await this.reload();
      return true;
    } catch (error) {
      this.restoringDraft = false;
      if (this.recovery.source) { this.recovery.candidates.unshift(this.recovery.source); this.recovery.source = null; this.recovery.awaiting = true; this.editor = null; this.updateRecoveryControls(); }
      this.message(`복구 실패: ${error.message}`, true); return false;
    }
  }
  async discardDraft(id = this.draftSelect.value) {
    if (!this.recovery?.awaiting) return false;
    try { const result = await this.recovery.discard(id); this.persistDraft(); if (!this.recovery.awaiting) this.focusCell(); return result; }
    catch (error) { this.message(error.message, true); return false; }
  }
  downloadDraft(id = this.draftSelect.value) {
    if (!this.recovery) return false;
    const snapshot = this.recovery.awaiting ? null : this.snapshotDraft();
    const data = this.recovery.awaiting ? this.recovery.candidate(id)?.data : snapshot ? JSON.stringify(snapshot) : null;
    if (!data) return false; this.downloadFile(new Blob([data], { type: 'application/json' }), 'moum-grid-draft.json'); return true;
  }

  getChanges() { return this.remoteChanges?.getChanges() ?? { created: [], updated: [], deleted: [] }; }
  getSaveState() { return this.remoteChanges?.getState() ?? { status: 'readonly', dirty: false, error: null, requestId: null }; }
  canLeaveRemote(quiet = false) {
    if (this.recovery?.blocked) { this.message('임시 저장본을 확인하고 복구하거나 삭제하세요.', true); return false; }
    if (!this.remoteChanges) return true;
    if (this.editor && !this.finishEdit()) return false;
    if (!this.remoteChanges.dirty && !this.remoteChanges.locked) return true;
    if (!quiet) this.message('변경 내용을 저장하거나 취소한 뒤 조회 조건을 바꾸세요. 저장 결과가 불명확하면 먼저 결과를 다시 확인하세요.', true);
    this.search.value = this.query; this.modeSelect.value = this.dataMode; this.sizeSelect.value = this.pageSize; this.pageInput.value = this.pageIndex + 1; this.logicSelect.value = this.filterLogic;
    return false;
  }
  saveChanges() {
    if (!this.remoteChanges || this.destroyed) return Promise.resolve(false);
    if (this.savePromise) return this.savePromise;
    if (this.remote.loading || this.editor && !this.finishEdit()) return Promise.resolve(false);
    this.exportRequest?.abort();
    const pending = this.remoteChanges.save(() => { if (!this.destroyed) this.renderRemote(); }, async () => { if (!await this.flushDraft()) throw Object.assign(Error('저장 요청의 복구 정보를 기록하지 못했습니다. 임시 저장 오류를 먼저 해결하세요.'), { committed: false }); });
    this.savePromise = pending.then(async rows => {
      if (!rows || this.destroyed) return false;
      this.mutateModel('setData', rows); this.remoteChanges.reset(rows); this.remoteChanges.status = 'refresh'; this.refreshDraftSnapshot = null; this.dataRevision++; this.renderRemote(); this.persistDraft(true);
      const refreshed = await this.remote.reload();
      if (!this.destroyed) this.message(refreshed ? '서버에 변경 내용을 저장했습니다.' : '저장은 완료됐지만 목록 갱신에 실패했습니다. 다시 불러오세요.', !refreshed);
      return true;
    }).finally(() => { this.savePromise = null; });
    return this.savePromise;
  }
  discardChanges() {
    if (!this.remote && this.recovery && !this.recovery.blocked) {
      this.editor = null; this.mutateModel('setData', JSON.parse(this.localDraftBaseline)); this.dataRevision++; this.resetSelection(); this.render(); return this.flushDraft();
    }
    if (!this.remoteChanges || this.destroyed || this.remoteChanges.locked || this.remote.loading) return Promise.resolve(false);
    this.cancelEdit(); this.mutateModel('setData', this.remoteChanges.baseline); this.dataRevision++;
    this.remoteChanges.reset(this.model.rows); this.remoteChanges.status = 'refresh'; this.refreshDraftSnapshot = null; this.renderRemote(); this.persistDraft(true);
    return this.ready = this.remote.reload();
  }

  renderRemote() {
    if (this.destroyed) return;
    if (this.remoteRows !== this.remote.rows) {
      const append = this.remote.lastRequest?.append && this.remote.rows.length >= this.model.rows.length;
      this.remoteRows = this.remote.rows; this.mutateModel('setData', this.remote.rows); this.dataRevision++;
      const refreshing = this.remoteChanges?.status === 'refresh';
      this.remoteChanges?.reset(this.remote.rows);
      if (refreshing && this.remote.loading) this.remoteChanges.status = 'refresh';
      this.merges = []; if (!append) this.resetSelection();
    }
    this.updateEditability();
    // Ordering and filtering were already applied to the complete dataset by the server.
    this.fullResult = buildDisplay(this.model.rows, { columns: this.columns }); this.applyRowWindow(); this.persistDraft();
  }
  updateRemoteControls() {
    const { loading, error, total, lastRequest } = this.remote;
    this.loadState.hidden = false;
    const save = this.remoteChanges, changes = save?.getChanges(), dirty = save?.dirty, locked = save?.locked;
    this.loadState.classList.toggle('is-error', !!error || ['error', 'uncertain'].includes(save?.status));
    this.table.setAttribute('aria-busy', String(loading || save?.status === 'saving'));
    this.loadText.textContent = loading ? `${this.dataMode === 'pagination' ? (Math.floor(lastRequest.offset / this.pageSize) + 1) + '페이지 ' : ''}서버 데이터를 불러오는 중…` : error ? `불러오기 실패: ${error}` : this.exportRequest ? '서버 Excel 데이터를 준비하는 중…' : `서버 연결 · ${total ?? 0}행 · 읽기 전용`;
    this.retryButton.hidden = !error; this.retryButton.disabled = loading; this.reloadButton.disabled = loading;
    if (save) {
      const counts = `추가 ${changes.created.length} · 수정 ${changes.updated.length} · 삭제 ${changes.deleted.length}`;
      if (!loading && !error) this.loadText.textContent = save.status === 'saving' ? '서버에 변경 내용을 저장하는 중…' : save.status === 'uncertain' ? `저장 결과 확인 필요: ${save.error}` : save.status === 'refresh' ? '목록을 다시 불러온 뒤 편집하세요.' : save.error ? `저장 실패: ${save.error} · ${counts}` : `서버 연결 · ${total ?? 0}행 · ${dirty ? counts : '저장할 변경 없음'}`;
      this.saveButton.textContent = save.status === 'uncertain' ? '저장 결과 다시 확인' : '변경 저장';
      this.saveButton.disabled = loading || save.status === 'saving' || save.status === 'refresh' || !dirty;
      this.discardButton.disabled = loading || locked || !dirty;
      this.reloadButton.disabled = loading || dirty || locked && save.status !== 'refresh';
    }
    for (const scope of ['filtered', 'all']) this.exportScope.querySelector(`[value=${scope}]`).disabled = !this.remote.source.exportRows || dirty || locked;
    if (this.exportScope.selectedOptions[0]?.disabled) this.exportScope.value = 'view';
    this.exportButton.disabled = !this.xlsx || loading || !!this.exportRequest || locked;
  }
  retryLoad() { if (this.remoteChanges?.status !== 'refresh' && !this.canLeaveRemote()) return Promise.resolve(false); return this.remote ? this.ready = this.remote.retry() : Promise.resolve(false); }
  reload() {
    if (!this.remote) { this.render(); return Promise.resolve(true); }
    if (this.remoteChanges?.status !== 'refresh' && !this.canLeaveRemote()) return Promise.resolve(false);
    this.exportRequest?.abort(); return this.ready = this.remote.reload();
  }
  async exportRemoteXLSX({ fileName, scope, sheetName, formulas }) {
    if (!this.canLeaveRemote()) return false;
    if (!this.remote.source.exportRows) { this.message('서버 전체 다운로드용 dataSource.exportRows를 연결하세요.', true); return false; }
    if (formulas || this.exportRequest) return false;
    const controller = new AbortController(), queryKey = this.remote.queryKey;
    this.exportRequest = controller; this.updateRemoteControls();
    try {
      const criteria = scope === 'all' ? { query: '', sorts: [], filters: [], filterLogic: 'and' } : JSON.parse(JSON.stringify(this.remote.criteria));
      const data = await withRequestTimeout(() => this.remote.source.exportRows({ ...criteria, scope, signal: controller.signal }), controller, this.remote.timeoutMs);
      if (this.destroyed || controller.signal.aborted || queryKey !== this.remote.queryKey) return false;
      if (!Array.isArray(data) || data.length * this.columns.length > 1000000) throw new Error('서버 Excel 결과는 행 배열이며 최대 100만 셀이어야 합니다. 더 큰 파일은 서버에서 생성하세요.');
      const rows = this.remote.validateRows(data);
      const bytes = writeXLSX(rows, this.xlsx, this.columns, { sheetName });
      this.downloadFile(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
      this.message(`${rows.length}행 서버 결과 XLSX 다운로드 완료`); return true;
    } catch (error) { if (!this.destroyed && (!controller.signal.aborted || controller.signal.reason?.name === 'TimeoutError')) this.message(error.message, true); return false; }
    finally { this.exportRequest = null; if (!this.destroyed) this.updateRemoteControls(); }
  }

  createNavigation() {
    const region = node('div', null, 'moum-grid__navigation'); region.setAttribute('role', 'group'); region.setAttribute('aria-label', '데이터 탐색');
    const label = node('label', '표시 행 수 ', 'moum-grid__option'); this.sizeSelect = node('select'); this.sizeSelect.setAttribute('aria-label', '표시 행 수');
    for (const size of [...new Set([25, 50, 100, 200, 500, this.pageSize])].sort((a, b) => a - b)) { const option = node('option', String(size)); option.value = size; this.sizeSelect.append(option); }
    this.sizeSelect.value = this.pageSize; this.sizeSelect.addEventListener('change', () => this.setPageSize(Number(this.sizeSelect.value))); label.append(this.sizeSelect); region.append(label);
    this.pageControls = node('div', null, 'moum-grid__page-controls');
    const button = (title, action, parent = this.pageControls) => { const control = node('button', title); control.type = 'button'; control.addEventListener('click', action); parent.append(control); return control; };
    this.firstPage = button('처음', () => this.setPage(0)); this.previousPage = button('이전', () => this.setPage(this.pageIndex - 1));
    this.pageForm = node('form'); const pageLabel = node('label', '페이지 ', 'moum-grid__option'); this.pageInput = node('input'); this.pageInput.type = 'number'; this.pageInput.min = '1'; this.pageInput.step = '1'; this.pageInput.setAttribute('aria-label', '이동할 페이지'); pageLabel.append(this.pageInput); this.pageForm.append(pageLabel);
    const go = node('button', '이동'); go.type = 'submit'; this.pageForm.append(go); this.pageForm.addEventListener('submit', event => { event.preventDefault(); this.setPage(Number(this.pageInput.value) - 1); }); this.pageControls.append(this.pageForm);
    this.nextPage = button('다음', () => this.setPage(this.pageIndex + 1)); this.lastPage = button('마지막', () => this.setPage(this.paging.pageCount - 1));
    this.moreButton = button('더 불러오기', () => this.loadMore(), region);
    this.pageSummary = node('span', '', 'moum-grid__page-summary'); this.pageSummary.setAttribute('role', 'status'); this.pageSummary.setAttribute('aria-live', 'polite');
    region.append(this.pageControls, this.pageSummary); return region;
  }

  resetRowWindow() { this.pageIndex = 0; this.loadedLimit = this.pageSize; this.viewport.scrollTop = 0; }
  getPagingState() { return { ...this.paging }; }
  updateNavigation() {
    const state = this.paging; this.modeSelect.value = this.dataMode; this.sizeSelect.value = this.pageSize;
    this.navigation.hidden = this.dataMode === 'virtual'; this.pageControls.hidden = this.dataMode !== 'pagination'; this.moreButton.hidden = this.dataMode !== 'infinite';
    this.moreButton.disabled = !state.hasMore || !!this.remote?.loading || !!this.remote?.error; this.moreButton.textContent = this.remote?.loading ? '불러오는 중…' : state.hasMore ? '더 불러오기' : '모두 불러왔습니다';
    this.firstPage.disabled = this.previousPage.disabled = !state.total || !this.pageIndex;
    this.nextPage.disabled = this.lastPage.disabled = !state.total || this.pageIndex >= state.pageCount - 1;
    this.pageInput.value = state.total ? this.pageIndex + 1 : 1; this.pageInput.max = Math.max(1, state.pageCount); this.pageInput.disabled = !state.total;
    const prefix = this.dataMode === 'pagination' ? `${state.total ? this.pageIndex + 1 : 0} / ${state.pageCount}페이지 · ` : '';
    this.pageSummary.textContent = `${prefix}${state.total ? state.start + 1 : 0}–${state.end} / ${state.total} 표시 행`;
    if (this.remoteChanges?.dirty) this.pageSummary.textContent += ` · 편집 중 화면 ${this.model.rows.length}행`;
    if (this.remote) this.updateRemoteControls();
    this.exportScope.querySelector('[value=view]').textContent = this.dataMode === 'pagination' ? '현재 페이지' : this.dataMode === 'infinite' ? '불러온 행' : '현재 표시 행';
  }

  setDataMode(mode) {
    if (!this.canLeaveRemote()) return false;
    if (!DATA_MODES.includes(mode) || this.remote && mode === 'virtual') throw new Error('서버는 infinite/pagination, 로컬은 virtual/infinite/pagination을 사용하세요.');
    if (this.editor && !this.finishEdit()) { this.modeSelect.value = this.dataMode; return false; }
    this.dataMode = mode; this.resetRowWindow(); this.merges = []; this.resetSelection();
    if (this.remote) { this.render(); return this.ready = this.ready.then(ok => { if (ok && !this.destroyed) this.options.onDataModeChange?.(this.getPagingState()); return ok; }); }
    this.applyRowWindow();
    this.options.onDataModeChange?.(this.getPagingState()); return true;
  }
  setPageSize(size) {
    if (!this.canLeaveRemote()) return false;
    validatePageSize(size);
    if (this.editor && !this.finishEdit()) { this.sizeSelect.value = this.pageSize; return false; }
    if (![...this.sizeSelect.options].some(option => Number(option.value) === size)) { const option = node('option', String(size)); option.value = size; this.sizeSelect.append(option); }
    this.pageSize = size; this.resetRowWindow(); this.merges = []; this.resetSelection();
    if (this.remote) { this.render(); return this.ready; }
    this.applyRowWindow(); return true;
  }
  setPage(index) {
    if (!this.canLeaveRemote()) return false;
    if (this.dataMode !== 'pagination') throw new Error('페이지 이동은 페이징 모드에서 사용하세요.');
    if (!Number.isInteger(index) || index < 0 || index >= this.paging.pageCount) { this.pageInput.value = this.pageIndex + 1; this.message('이동할 페이지 범위를 확인하세요.', true); return false; }
    if (this.editor && !this.finishEdit()) return false;
    if (this.remote) return this.ready = this.remote.page(index).then(ok => { if (ok && !this.destroyed) { this.viewport.scrollTop = 0; this.resetSelection(); this.renderViewport(); this.options.onPageChange?.(this.getPagingState()); } return ok; });
    this.pageIndex = index; this.viewport.scrollTop = 0; this.merges = []; this.resetSelection(); this.applyRowWindow();
    this.options.onPageChange?.(this.getPagingState()); return true;
  }
  loadMore() {
    if (!this.canLeaveRemote()) return false;
    if (this.remote && this.dataMode === 'infinite') return this.ready = this.remote.more();
    if (this.dataMode !== 'infinite' || !this.paging.hasMore || this.editor) return false;
    this.loadedLimit = this.paging.end + this.pageSize; this.merges = []; this.applyRowWindow(); return true;
  }
  maybeLoadMore() {
    if (this.remoteChanges && (this.editor || this.remoteChanges.dirty || this.remoteChanges.locked)) return false;
    if (this.remote && (this.remote.loading || this.remote.error || !this.paging.hasMore)) return false;
    if (this.dataMode !== 'infinite' || this.viewport.clientHeight <= 0 || this.viewport.scrollTop + this.viewport.clientHeight < this.viewport.scrollHeight - this.rowHeight * 2) return false;
    return this.loadMore();
  }
  revealDataRow(index) {
    const position = this.fullResult.display.findIndex(entry => entry.type === 'data' && entry.item.index === index); if (position < 0) return;
    if (!this.remote && this.dataMode === 'pagination') this.pageIndex = Math.floor(position / this.pageSize);
    if (this.dataMode === 'infinite') this.loadedLimit = Math.max(this.loadedLimit, position + 1);
    this.applyRowWindow();
  }

  cellAt(target) {
    const cell = target.closest?.('td[data-row]');
    return cell && this.table.contains(cell) ? { row: Number(cell.dataset.row), col: Number(cell.dataset.col) } : null;
  }

  resetSelection() { this.anchor = { row: 0, col: 0 }; this.current = { ...this.anchor }; }
  getSelectionStats() {
    const range=this.getSelection();let count=0,numericCount=0,sum=0,min=Infinity,max=-Infinity;
    for(let row=range.top;row<=range.bottom&&row<this.view.length;row++)for(let col=range.left;col<=range.right&&col<this.columns.length;col++){
      const value=this.view[row].row[this.columns[col].field];if(value!=null&&value!=='')count++;
      if(typeof value==='number'&&Number.isFinite(value)){numericCount++;sum+=value;min=Math.min(min,value);max=Math.max(max,value);}
    }
    return {count,numericCount,sum,average:numericCount?sum/numericCount:null,min:numericCount?min:null,max:numericCount?max:null};
  }
  getSelection() {
    const range = { top: Math.min(this.anchor.row, this.current.row), bottom: Math.max(this.anchor.row, this.current.row), left: Math.min(this.anchor.col, this.current.col), right: Math.max(this.anchor.col, this.current.col) };
    let expanded;
    do {
      expanded = false;
      for (const merge of this.merges) if (this.intersects(range, merge)) {
        const bounds = [Math.min(range.top, merge.row), Math.max(range.bottom, merge.row + merge.rowSpan - 1), Math.min(range.left, merge.col), Math.max(range.right, merge.col + merge.colSpan - 1)];
        if (bounds.join() !== [range.top, range.bottom, range.left, range.right].join()) expanded = true;
        [range.top, range.bottom, range.left, range.right] = bounds;
      }
    } while (expanded);
    return range;
  }

  intersects(range, merge) { return range.top < merge.row + merge.rowSpan && range.bottom >= merge.row && range.left < merge.col + merge.colSpan && range.right >= merge.col; }
  cellElement(point) { const owner = this.mergeOwners.get(`${point.row}:${point.col}`) || point; return this.table.querySelector(`td[data-row="${owner.row}"][data-col="${owner.col}"]`); }

  select(cell, extend = false, focus = true) {
    if (!this.view.length) return;
    this.current = { row: Math.max(0, Math.min(this.view.length - 1, cell.row)), col: Math.max(0, Math.min(this.columns.length - 1, cell.col)) };
    if (!extend) this.anchor = { ...this.current };
    this.paintSelection();
    if (focus) this.focusCell();
    this.options.onSelectionChange?.(this.getSelection());
  }

  focusCell() {
    if (this.virtualActive && this.view.length) {
      const index = this.displayIndex.get(this.current.row), top = index * this.rowHeight;
      if (this.virtualRows) {
        if (top < this.viewport.scrollTop) this.viewport.scrollTop = top;
        else if (top + this.rowHeight + 56 > this.viewport.scrollTop + this.viewport.clientHeight) this.viewport.scrollTop = top + this.rowHeight + 56 - this.viewport.clientHeight;
      }
      const layout = columnWindow(this.columns, 0, 0, this.frozenColumns, false), left = layout.offsets[this.current.col], right = layout.offsets[this.current.col + 1];
      if (this.current.col >= this.frozenColumns) {
        if (left < this.viewport.scrollLeft + layout.offsets[this.frozenColumns]) this.viewport.scrollLeft = left - layout.offsets[this.frozenColumns];
        else if (right > this.viewport.scrollLeft + this.viewport.clientWidth) this.viewport.scrollLeft = right - this.viewport.clientWidth;
      }
      this.renderViewport();
    }
    const cell = this.cellElement(this.current);
    if (!cell) { this.table.focus({ preventScroll: true }); return; }
    cell.focus({ preventScroll: true });
    cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (cell && this.current.col >= this.frozenColumns) {
      const box = this.viewport.getBoundingClientRect(), rect = cell.getBoundingClientRect();
      const headers = [...this.table.querySelectorAll('thead tr:first-child > th')];
      const fixed = headers.slice(0, this.frozenColumns + 1).reduce((sum, header) => sum + header.getBoundingClientRect().width, 0);
      const left = Math.min(box.right - 24, box.left + fixed);
      if (rect.left < left) this.viewport.scrollLeft -= left - rect.left;
      else if (rect.right > box.right) this.viewport.scrollLeft += rect.right - box.right;
    }
  }

  paintSelection() {
    const range = this.getSelection();
    for (const cell of this.table.querySelectorAll('td[data-row]')) {
      const row = Number(cell.dataset.row), col = Number(cell.dataset.col);
      const selected = row >= range.top && row <= range.bottom && col >= range.left && col <= range.right;
      const owner = this.mergeOwners.get(`${this.current.row}:${this.current.col}`) || this.current;
      const active = row === owner.row && col === owner.col;
      cell.classList.toggle('is-selected', selected); cell.classList.toggle('is-active', active);
      cell.setAttribute('aria-selected', String(selected)); cell.tabIndex = active ? 0 : -1;
    }
    this.coordinate.textContent = this.view.length ? `${(this.view[this.current.row]?.position ?? this.current.row) + 1}행 ${this.current.col + 1}열 · ${(range.bottom - range.top + 1) * (range.right - range.left + 1)}셀 선택` : '선택 없음';
    if(this.options.selectionSummary&&this.view.length){const stats=this.getSelectionStats();this.coordinate.textContent+=` · 숫자 ${stats.numericCount}개 · 합계 ${stats.sum.toLocaleString()} · 평균 ${stats.average==null?'—':stats.average.toLocaleString()}`;}
  }

  render() {
    this.updateEditability();
    if (this.remote) {
      const previousKey = this.remote.queryKey;
      this.ready = this.remote.configure({ query: this.query, sorts: this.sorts, filters: this.filters, filterLogic: this.filterLogic }, this.dataMode, this.pageSize);
      if (previousKey !== this.remote.queryKey) { this.exportRequest?.abort(); this.viewport.scrollTop = 0; this.resetSelection(); }
      else this.renderRemote();
      return this.ready;
    }
    const signature = JSON.stringify([this.query, this.filters, this.filterLogic, this.sorts, this.groupBy, this.tree, [...this.collapsedGroups], [...this.collapsedNodes]]);
    if (this.viewSignature != null && this.viewSignature !== signature) this.resetRowWindow();
    this.viewSignature = signature;
    this.fullResult = buildDisplay(this.model.formulas ? this.model.getComputedData() : this.model.rows, this);
    this.applyRowWindow();
  }

  applyRowWindow() {
    const result = rowWindow(this.fullResult, { mode: this.remote ? 'virtual' : this.dataMode, pageSize: this.pageSize, pageIndex: this.pageIndex, loaded: this.loadedLimit });
    if (this.remote) {
      const offset = this.dataMode === 'pagination' ? this.remote.offset : 0, total = this.remote.total ?? 0;
      for (const item of result.view) item.position += offset;
      result.state = { mode: this.dataMode, pageSize: this.pageSize, pageIndex: Math.floor(offset / this.pageSize), pageCount: Math.ceil(total / this.pageSize), total, totalRows: total, start: offset, end: offset + this.remote.rows.length, loaded: this.remote.rows.length, draftRows: result.view.length, hasMore: offset + this.remote.rows.length < total, loading: this.remote.loading, error: this.remote.error };
    }
    this.view = result.view; this.display = result.display; this.paging = result.state; this.pageIndex = result.state.pageIndex;
    this.virtualRows = this.virtual && this.display.length > 200; this.virtualCols = this.virtual && this.columns.length > 30;
    this.virtualActive = this.virtualRows || this.virtualCols;
    if (this.virtualActive) this.merges = [];

    // Keep geometry stable when an infinite window crosses the virtualization threshold.
    this.root.classList.toggle('moum-grid--virtual', this.virtualActive || this.dataMode === 'infinite');
    this.displayIndex = new Map(); this.display.forEach((entry, index) => { if (entry.type === 'data') this.displayIndex.set(entry.viewIndex, index); });
    this.updateNavigation(); this.renderViewport();
  }

  renderViewport() {
    if (this.editor) return;
    const window = this.virtualRows ? virtualWindow(this.display.length, this.viewport.scrollTop, this.viewport.clientHeight || 530, this.rowHeight) : { start: 0, end: this.display.length, before: 0, after: 0 };
    this.layout = columnWindow(this.columns, this.viewport.scrollLeft, this.viewport.clientWidth || 800, this.frozenColumns, this.virtualCols);
    const slots = this.layout.slots;
    const hadFocus = this.table.contains(document.activeElement);
    const changedKeys = new Set(this.getChanges().updated.map(item => String(item.key)));
    const focusedCell = this.cellAt(document.activeElement);
    this.mergeOwners = new Map();
    for (const merge of this.merges) for (let row = merge.row; row < merge.row + merge.rowSpan; row++) for (let col = merge.col; col < merge.col + merge.colSpan; col++) this.mergeOwners.set(`${row}:${col}`, merge);
    this.table.replaceChildren();
    const colgroup = node('colgroup'); colgroup.append(node('col'));
    for (const slot of slots) { const col = node('col'); col.style.width = `${slot.width}px`; if (!slot.gap) col.dataset.field = this.columns[slot.col].field; colgroup.append(col); }
    this.table.append(colgroup);
    this.table.setAttribute('aria-rowcount', String(this.remote ? this.remote.total == null || this.remoteChanges?.dirty ? -1 : this.remote.total + 1 : this.display.length + 1)); this.table.setAttribute('aria-colcount', String(this.columns.length + 1));
    const head = node('thead'), heading = node('tr'), corner = node('th', '#'); corner.scope = 'col'; heading.append(corner);
    heading.setAttribute('aria-rowindex', '1');
    slots.forEach(slot => {
      if (slot.gap) { const gap = node('th'); gap.setAttribute('aria-hidden', 'true'); gap.className = 'moum-grid__gap'; heading.append(gap); return; }
      const col = slot.col, column = this.columns[col];
      const th = node('th'); th.scope = 'col';
      th.dataset.col = col; th.setAttribute('aria-colindex', String(col + 2));
      const sortIndex = this.sorts.findIndex(sort => sort.field === column.field), sorted = this.sorts[sortIndex];
      th.setAttribute('aria-sort', sorted ? sortIndex ? 'other' : sorted.direction === 1 ? 'ascending' : 'descending' : 'none');
      const control = node('button', `${column.header || column.field}${column.editable === false ? ' (읽기 전용)' : ''}${sorted ? `${sorted.direction === 1 ? ' ↑' : ' ↓'}${this.sorts.length > 1 ? ' ' + (sortIndex + 1) : ''}` : ''}`);
      control.title = `${column.header || column.field} · Shift+클릭으로 다중 정렬`;
      control.type = 'button'; control.addEventListener('click', event => {
        if (this.editor && !this.finishEdit()) return;
        let sorts = event.shiftKey ? this.sorts.filter(sort => sort.field !== column.field) : [];
        if (!sorted || sorted.direction === 1) sorts.push({ field: column.field, direction: sorted ? -1 : 1 });
        if (event.shiftKey && sorted && sorted.direction === 1) { sorts = [...this.sorts]; sorts[sortIndex] = { field: column.field, direction: -1 }; }
        this.setSorts(sorts);
      });
      const resize = node('span', null, 'moum-grid__resize'); resize.tabIndex = 0; resize.setAttribute('role', 'separator'); resize.setAttribute('aria-orientation', 'vertical'); resize.setAttribute('aria-label', `${column.header || column.field} 너비`); resize.setAttribute('aria-valuemin', '64'); resize.setAttribute('aria-valuemax', '1000');
      resize.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); this.resizing = { field: column.field, x: event.clientX, width: th.getBoundingClientRect().width }; });
      resize.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); this.setColumnWidth(column.field, (column.width || 140) + (event.key === 'ArrowRight' ? 10 : -10)); } });
      th.append(control, resize); heading.append(th);
    });
    head.append(heading); this.table.append(head);
    const body = node('tbody');
    const spacer = height => { if (!height) return; const tr = node('tr'), td = node('td'); tr.setAttribute('aria-hidden', 'true'); tr.className = 'moum-grid__spacer'; td.colSpan = slots.length + 1; td.style.height = `${height}px`; tr.append(td); body.append(tr); };
    spacer(window.before);
    for (let displayRow = window.start; displayRow < window.end; displayRow++) {
      const descriptor = this.display[displayRow];
      if (descriptor.type !== 'data') { const group = this.renderGroup(descriptor); group.setAttribute('aria-rowindex', String(displayRow + 2)); body.append(group); continue; }
      const { item: { row, ...item }, viewIndex: rowIndex } = descriptor;
      const tr = node('tr'), index = node('th', String(descriptor.item.position + 1)); index.scope = 'row'; tr.append(index);
      if (this.remoteChanges && (row.__moumClientId || changedKeys.has(String(row[this.remote.rowKey])))) { tr.dataset.state = row.__moumClientId ? 'created' : 'updated'; index.title = row.__moumClientId ? '추가 · 미저장' : '수정 · 미저장'; index.textContent += row.__moumClientId ? ' +' : ' *'; }
      tr.setAttribute('aria-rowindex', String(displayRow + 2 + (this.remote && this.dataMode === 'pagination' ? this.remote.offset : 0)));
      slots.forEach(slot => {
        if (slot.gap) { const gap = node('td'); gap.setAttribute('aria-hidden', 'true'); gap.className = 'moum-grid__gap'; tr.append(gap); return; }
        const col = slot.col, column = this.columns[col];
        const owner = this.mergeOwners.get(`${rowIndex}:${col}`);
        if (owner && (owner.row !== rowIndex || owner.col !== col)) return;
        const td = node('td', row[column.field] == null ? '' : String(row[column.field]));
        if (owner) { td.rowSpan = owner.rowSpan; td.colSpan = owner.colSpan; }
        td.dataset.row = rowIndex; td.dataset.col = col; td.setAttribute('aria-colindex', String(col + 2));
        if (this.model.formulas) { const result = this.model.formulaSheet().cell(item.index, this.model.columns.findIndex(item => item.field === column.field)); if (result.error) { td.classList.add('is-formula-error'); td.title = result.error; } }
        td.setAttribute('aria-label', `${descriptor.item.position + 1}행 ${column.header || column.field}: ${td.textContent || '빈 값'}`);
        const readonly = !this.editable || column.editable === false;
        td.setAttribute('aria-readonly', String(readonly)); td.classList.toggle('is-readonly', readonly);
        if (column.type === 'number') td.classList.add('is-number');
        if (this.tree && column.field === this.tree.labelField) {
          const label = node('span', td.textContent); td.replaceChildren(); td.classList.add('moum-grid__tree-cell');
          const indent = node('span', null, 'moum-grid__tree-indent'); indent.style.width = `${item.depth * 18}px`; td.append(indent);
          if (item.hasChildren) {
            const toggle = node('button', item.expanded ? '−' : '+', 'moum-grid__tree-toggle'); toggle.type = 'button'; toggle.setAttribute('aria-label', `${row[column.field]} ${item.expanded ? '접기' : '펼치기'}`); toggle.setAttribute('aria-expanded', String(item.expanded));
            toggle.addEventListener('pointerdown', event => event.stopPropagation()); toggle.addEventListener('dblclick', event => event.stopPropagation());
            toggle.addEventListener('click', event => { event.stopPropagation(); this.toggleNode(item.id); }); td.append(toggle);
          } else td.append(node('span', '', 'moum-grid__tree-leaf'));
          td.append(label); td.setAttribute('aria-level', String(item.depth + 1));
        }
        tr.append(td);
      }); body.append(tr);
    }
    spacer(window.after);
    if (!this.display.length) {
      const text = this.remote?.loading ? '서버 데이터를 불러오는 중입니다.' : this.remote?.error ? '데이터를 불러오지 못했습니다. 다시 시도하세요.' : '표시할 데이터가 없습니다. 검색어를 지워보세요.';
      const tr = node('tr'), td = node('td', text, 'moum-grid__empty'); tr.setAttribute('aria-hidden', 'true'); td.colSpan = slots.length + 1; tr.append(td); body.append(tr);
    }
    this.table.append(body);
    this.table.tabIndex = this.view.length && this.cellElement(this.current) ? -1 : 0;
    this.updateColumnGeometry();
    this.current.row = Math.max(0, Math.min(this.current.row, this.view.length - 1)); this.anchor.row = Math.max(0, Math.min(this.anchor.row, this.view.length - 1));
    this.undoButton.disabled = !this.editable || !this.model.canUndo; this.redoButton.disabled = !this.editable || !this.model.canRedo;
    this.addButton.disabled = !this.editable; this.removeButton.disabled = !this.editable || !this.view.length;
    this.clearButton.disabled = !this.editable; this.mergeButton.disabled = this.unmergeButton.disabled = !!this.remote;
    this.importButton.disabled = !this.xlsx || !this.editable || !!this.remote;
    this.paintSelection();
    if (hadFocus && focusedCell) (this.cellElement(focusedCell) || this.table).focus({ preventScroll: true });
    this.message(this.recovery?.blocked ? '복구할 작업을 선택하세요. 편집은 잠겨 있습니다.' : this.remoteChanges && !this.editable ? '저장·조회 상태를 확인하세요. 편집은 잠겨 있습니다.' : this.remote && !this.remoteChanges ? `${this.view.length}행 표시 · 서버 데이터는 읽기 전용입니다.` : this.view.length ? `${this.view.length}행${this.virtualActive ? ' · 가상 스크롤' : ''} · 셀 더블클릭 또는 F2로 편집` : '표시할 데이터가 없습니다. 검색·필터 조건을 확인하세요.');
  }

  message(text, error = false) { this.status.textContent = text; this.status.classList.toggle('is-error', error); }

  createFilterPanel() {
    const panel = node('section', null, 'moum-grid__filters'); panel.hidden = true; panel.setAttribute('aria-label', '조건 필터');
    const form = node('form'), field = node('select'), operator = node('select'), value = node('input'), value2 = node('input');
    const label = (text, control) => { const item = node('label', text); control.setAttribute('aria-label', text.trim()); item.append(control); form.append(item); return item; };
    this.logicSelect = node('select');
    for (const [key, title] of [['and', '모두 만족 (AND)'], ['or', '하나 이상 (OR)']]) { const option = node('option', title); option.value = key; this.logicSelect.append(option); }
    label('조건 연결 ', this.logicSelect); this.logicSelect.addEventListener('change', () => this.setFilters(this.filters, { logic: this.logicSelect.value }));
    for (const column of this.columns) { const option = node('option', column.header || column.field); option.value = column.field; field.append(option); }
    const names = ['포함', '시작', '같음', '다름', '초과', '이상', '미만', '이하', '범위', '빈 값', '값 있음'];
    FILTER_OPERATORS.forEach((name, index) => { const option = node('option', names[index]); option.value = name; operator.append(option); });
    label('컬럼 ', field); label('조건 ', operator); const first = label('기준 값 ', value), second = label('끝 값 ', value2); second.hidden = true;
    operator.addEventListener('change', () => { second.hidden = operator.value !== 'between'; first.hidden = ['empty', 'notEmpty'].includes(operator.value); });
    const add = node('button', '조건 추가'); add.type = 'submit';
    const clear = node('button', '필터 초기화'); clear.type = 'button'; clear.addEventListener('click', () => this.setFilters([])); form.append(add, clear);
    form.addEventListener('submit', event => {
      event.preventDefault();
      try { this.setFilters([...this.filters, { field: field.value, operator: operator.value, value: value.value, value2: value2.value }]); }
      catch (error) { this.message(error.message, true); }
    });
    this.filterList = node('div', null, 'moum-grid__filter-list');
    panel.append(form, node('p', 'AND는 모든 조건, OR는 하나 이상의 조건을 만족하는 행을 표시합니다. 같은 컬럼의 구간은 ‘범위’를 사용하세요.'), this.filterList);
    return panel;
  }

  setFilters(filters, { logic = this.filterLogic } = {}) {
    if (!this.canLeaveRemote()) return false;
    if (!Array.isArray(filters)) throw new Error('filters는 배열이어야 합니다.');
    if (!['and', 'or'].includes(logic)) throw new Error('필터 연결은 and 또는 or여야 합니다.');
    const prepared = filters.map(filter => {
      const column = this.columns.find(column => column.field === filter.field);
      if (!column || !FILTER_OPERATORS.includes(filter.operator)) throw new Error('지원하지 않는 필터입니다.');
      const item = { ...filter };
      if (column.type === 'number' && !['contains', 'startsWith', 'empty', 'notEmpty'].includes(item.operator)) {
        for (const key of item.operator === 'between' ? ['value', 'value2'] : ['value']) {
          const input = String(item[key] ?? '').trim().replace(/,/g, '');
          if (!input || !Number.isFinite(Number(input))) throw new Error('숫자 필터에는 숫자 기준 값을 입력하세요.');
          item[key] = Number(input);
        }
        if (item.operator === 'between' && item.value > item.value2) throw new Error('시작 값은 끝 값보다 클 수 없습니다.');
      }
      return item;
    });
    if (this.editor && !this.finishEdit()) return false;
    this.filters = prepared; this.filterLogic = logic; this.merges = []; this.resetSelection(); this.updateFilterControls();
    this.render(); return true;
  }
  updateFilterControls() {
    this.logicSelect.value = this.filterLogic; this.filterList.replaceChildren();
    this.filters.forEach((filter, index) => {
      const column = this.columns.find(column => column.field === filter.field);
      const remove = node('button', `${column.header || column.field}: ${filter.operator} ${filter.value ?? ''}${filter.operator === 'between' ? ' ~ ' + filter.value2 : ''} ×`); remove.type = 'button';
      remove.setAttribute('aria-label', `${index + 1}번 필터 제거`); remove.addEventListener('click', () => this.setFilters(this.filters.filter((_, item) => item !== index))); this.filterList.append(remove);
    });
  }

  setSorts(sorts) {
    if (!this.canLeaveRemote()) return false;
    if (!Array.isArray(sorts) || new Set(sorts.map(sort => sort.field)).size !== sorts.length) throw new Error('중복 없는 정렬 배열이 필요합니다.');
    const prepared = sorts.map(sort => {
      if (!this.columns.some(column => column.field === sort.field)) throw new Error('정렬할 컬럼이 없습니다.');
      const direction = [1, 'asc', 'ascending'].includes(sort.direction) ? 1 : [-1, 'desc', 'descending'].includes(sort.direction) ? -1 : null;
      if (!direction) throw new Error('정렬 방향은 asc 또는 desc여야 합니다.');
      return { field: sort.field, direction };
    });
    if (this.editor && !this.finishEdit()) return false;
    this.sorts = prepared; this.merges = []; this.resetSelection(); this.render(); return true;
  }

  setColumnWidth(field, width) {
    const column = this.columns.find(column => column.field === field);
    if (!column || !Number.isFinite(Number(width))) throw new Error('올바른 컬럼과 너비가 필요합니다.');
    column.width = Math.max(64, Math.min(1000, Math.round(Number(width)))); if (this.virtualActive && !this.editor) this.renderViewport(); else this.updateColumnGeometry();
    this.options.onColumnResize?.({ field, width: column.width });
  }

  setFrozenColumns(count) {
    if (!Number.isInteger(count) || count < 0 || count > this.columns.length) throw new Error('고정 열 수가 올바르지 않습니다.');
    const widths = columnWindow(this.columns, 0, 0, count, false).offsets[count];
    if (count && widths > this.viewport.clientWidth - 64) { this.frozenSelect.value = this.frozenColumns; this.message('고정 영역이 화면보다 큽니다. 고정할 열 수를 줄이세요.', true); return false; }
    if (this.editor && !this.finishEdit()) { this.frozenSelect.value = this.frozenColumns; return false; }
    this.frozenColumns = count; this.frozenSelect.value = count; this.merges = []; this.render(); return true;
  }

  updateColumnGeometry() {
    const layout = columnWindow(this.columns, this.viewport.scrollLeft, this.viewport.clientWidth || 800, this.frozenColumns, this.virtualCols);
    const cols = this.table.querySelectorAll('colgroup col'); if (!cols.length) return;
    cols[0].style.width = '48px';
    layout.slots.forEach((slot, index) => { if (cols[index + 1]) cols[index + 1].style.width = `${slot.width}px`; });
    this.table.style.width = `${layout.total}px`;
    for (const cell of this.table.querySelectorAll('[data-col]')) {
      const col = Number(cell.dataset.col), frozen = col < this.frozenColumns;
      cell.classList.toggle('is-frozen', frozen); cell.style.left = frozen ? `${layout.offsets[col]}px` : '';
      cell.querySelector('[role=separator]')?.setAttribute('aria-valuenow', String(layout.offsets[col + 1] - layout.offsets[col]));
    }
  }

  setGroupBy(fields) {
    if (this.remote && fields.length) throw new Error('서버 데이터의 그룹/소계는 이 API에서 지원하지 않습니다.');
    if (!Array.isArray(fields) || new Set(fields).size !== fields.length || fields.some(field => !this.columns.some(column => column.field === field))) throw new Error('그룹 컬럼 배열이 올바르지 않습니다.');
    if (fields.length && this.tree) throw new Error('트리와 행 그룹은 별도 모드로 사용하세요.');
    if (this.editor && !this.finishEdit()) return false;
    this.groupBy = [...fields]; this.collapsedGroups.clear(); this.merges = []; this.resetSelection();
    this.groupSelect.querySelector('[data-multiple]')?.remove();
    if (fields.length > 1) {
      const option = node('option', fields.map(field => this.columns.find(column => column.field === field).header || field).join(' → ')); option.value = '__multiple'; option.disabled = true; option.dataset.multiple = 'true'; this.groupSelect.append(option); this.groupSelect.value = '__multiple';
    } else this.groupSelect.value = fields[0] || '';
    this.render(); return true;
  }

  renderGroup(descriptor) {
    const row = node('tr', null, descriptor.type === 'group' ? 'moum-grid__group' : 'moum-grid__subtotal'), group = descriptor.group;
    if (descriptor.type === 'group') {
      const cell = node('td'); cell.colSpan = this.layout.slots.length + 1;
      const column = this.columns.find(column => column.field === group.field);
      const toggle = node('button', `${group.expanded ? '−' : '+'} ${column.header || group.field}: ${group.value === '' ? '(빈 값)' : group.value} · ${group.count}행`); toggle.type = 'button'; toggle.dataset.groupKey = group.key; toggle.style.paddingInlineStart = `${12 + group.depth * 18}px`; toggle.setAttribute('aria-expanded', String(group.expanded));
      toggle.addEventListener('click', () => { if (this.collapsedGroups.has(group.key)) this.collapsedGroups.delete(group.key); else this.collapsedGroups.add(group.key); this.resetSelection(); this.render(); [...this.table.querySelectorAll('[data-group-key]')].find(button => button.dataset.groupKey === group.key)?.focus(); });
      cell.append(toggle); row.append(cell);
    } else {
      const index = node('th', 'Σ'); index.scope = 'row'; row.append(index);
      this.layout.slots.forEach(slot => { if (slot.gap) { const gap = node('td'); gap.className = 'moum-grid__gap'; gap.setAttribute('aria-hidden', 'true'); row.append(gap); return; } const col = slot.col, column = this.columns[col]; const cell = node('td', column.type === 'number' ? String(group.summary[column.field]) : col === 0 ? '소계' : ''); cell.dataset.col = col; if (column.type === 'number') cell.classList.add('is-number'); row.append(cell); });
    }
    return row;
  }

  setTree(tree) {
    if (this.remote && tree) throw new Error('서버 데이터의 트리는 이 API에서 지원하지 않습니다.');
    if (this.editor && !this.finishEdit()) return false;
    let prepared = null;
    if (tree) {
      if (this.groupBy.length) throw new Error('행 그룹을 해제한 뒤 트리를 설정하세요.');
      if (![tree.idField, tree.parentField, tree.labelField].every(field => typeof field === 'string' && field && !['__proto__', 'constructor', 'prototype'].includes(field)) || !this.columns.some(column => column.field === tree.labelField)) throw new Error('트리 idField·parentField·labelField가 필요합니다.');
      prepared = { ...tree }; treeIndex(this.model.rows, prepared);
    }
    this.tree = prepared; this.model.validateRows = prepared ? rows => treeIndex(rows, prepared) : null;
    this.model.past = []; this.model.future = [];
    this.collapsedNodes.clear(); this.merges = []; this.resetSelection(); this.groupSelect.disabled = Boolean(prepared) || !!this.remote; this.render(); return true;
  }

  toggleNode(id) {
    if (!this.tree) return;
    if (this.editor && !this.finishEdit()) return;
    id = String(id); if (this.collapsedNodes.has(id)) this.collapsedNodes.delete(id); else this.collapsedNodes.add(id);
    this.render(); const row = this.view.findIndex(item => item.id === id);
    if (row >= 0) this.select({ row, col: this.columns.findIndex(column => column.field === this.tree.labelField) });
  }

  makeRow(values = {}, offset = 0) {
    const row = Object.fromEntries(this.model.columns.map(column => [column.field, typeof column.defaultValue === 'function' ? column.defaultValue(this.model.rows.length + offset) : column.defaultValue ?? (['number', 'boolean'].includes(column.type) ? null : '')]));
    Object.assign(row, values);
    if (this.tree && !row[this.tree.idField]) {
      let index = this.model.rows.length + offset + 1;
      do { row[this.tree.idField] = `NEW-${index++}`; } while (this.model.rows.some(item => String(item[this.tree.idField]) === row[this.tree.idField]));
      row[this.tree.parentField] = '';
    }
    return row;
  }

  addRow(values = {}) {
    if (!this.editable || this.editor && !this.finishEdit()) return false;
    const row = this.remoteChanges ? this.remoteChanges.newRow(this.makeRow(values)) : this.makeRow(values);
    const index = this.model.rows.length; let changes;
    try { changes = this.mutateModel('insertRows', index, [row]); }
    catch (error) { this.message(error.message, true); return false; }
    if (!this.remote) { this.query = ''; this.search.value = ''; this.setFilters([]); } this.changed(changes, 'insert');
    this.revealDataRow(index);
    const visible = this.view.findIndex(item => item.index === index);
    if (visible >= 0) this.select({ row: visible, col: Math.max(0, this.columns.findIndex(column => column.editable !== false)) });
    return true;
  }

  deleteSelectedRows() {
    if (!this.editable || !this.view.length || this.editor && !this.finishEdit()) return false;
    const range = this.getSelection(), indices = new Set(this.view.slice(range.top, range.bottom + 1).map(item => item.index));
    if (this.tree) {
      const { byId, children } = treeIndex(this.model.rows, this.tree);
      const pending = [...byId.values()].filter(item => indices.has(item.index));
      while (pending.length) { const item = pending.pop(); indices.add(item.index); pending.push(...(children.get(item.id) || [])); }
    }
    let changes;
    try { changes = this.mutateModel('removeRows', [...indices]); }
    catch (error) { this.message(error.message, true); return false; }
    this.changed(changes, 'delete'); return true;
  }

  mergeSelection() {
    if (this.remote) { this.message('서버 데이터의 수동 병합은 지원하지 않습니다.', true); return false; }
    if (!this.view.length || this.editor && !this.finishEdit()) return false;
    if (this.virtualActive) { this.message('가상 스크롤에서는 수동 병합을 지원하지 않습니다.', true); return false; }
    if (this.tree || this.groupBy.length) { this.message('셀 병합은 일반 그리드 모드에서 사용하세요.', true); return false; }
    const range = this.getSelection();
    if (range.top === range.bottom && range.left === range.right) { this.message('병합할 여러 셀을 선택하세요.', true); return false; }
    if (range.left < this.frozenColumns && range.right >= this.frozenColumns) { this.message('고정 열 경계를 넘는 병합은 지원하지 않습니다.', true); return false; }
    this.merges = this.merges.filter(merge => !this.intersects(range, merge));
    this.merges.push({ row: range.top, col: range.left, rowSpan: range.bottom - range.top + 1, colSpan: range.right - range.left + 1 });
    this.current = { row: range.top, col: range.left }; this.anchor = { ...this.current }; this.render(); this.focusCell(); this.message('선택 영역을 병합했습니다. 숨겨진 원본 값은 보존됩니다.'); return true;
  }

  unmergeSelection() {
    const range = this.getSelection(); this.merges = this.merges.filter(merge => !this.intersects(range, merge));
    this.render(); this.focusCell(); this.message('선택 영역의 병합을 해제했습니다.');
  }

  async importXLSX(file, options = {}) {
    if (this.remote) { this.message('서버 데이터는 셀 붙여넣기 또는 행 추가 후 저장하세요.', true); return false; }
    if (!this.editable || this.editor && !this.finishEdit()) return false;
    const revision = this.dataRevision, sequence = ++this.importSequence;
    let rows, changes;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하의 XLSX 파일을 선택하세요.');
      const bytes = file instanceof ArrayBuffer || ArrayBuffer.isView(file) ? file : await file.arrayBuffer();
      if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('20MB 이하의 XLSX 파일을 선택하세요.');
      if (this.destroyed || sequence !== this.importSequence) return false;
      if (revision !== this.dataRevision) throw new Error('파일을 읽는 동안 데이터가 변경됐습니다. 다시 가져오세요.');
      rows = readXLSX(bytes, this.xlsx, this.columns, { formulas: this.model.formulas, ...options }); changes = this.mutateModel('replaceRows', rows, 'import');
    } catch (error) { this.message(error.message, true); return false; }
    this.resetRowWindow(); this.query = ''; this.search.value = ''; this.setFilters([]); this.changed(changes, 'import'); this.message(`${rows.length}행 XLSX 가져오기 완료 · Ctrl+Z로 원복`); return true;
  }

  exportXLSX({ fileName = 'moum-grid.xlsx', scope = 'view', sheetName = '데이터', formulas = false } = {}) {
    if (this.remoteChanges?.locked) return false;
    if (this.remote?.loading) { this.message('데이터를 불러온 뒤 다운로드하세요.', true); return false; }
    if (this.remote && ['filtered', 'all'].includes(scope)) return this.exportRemoteXLSX({ fileName, scope, sheetName, formulas });
    if (this.editor && !this.finishEdit()) return false;
    try {
      if (!['view', 'filtered', 'all', 'selection'].includes(scope)) throw new Error('내보내기 scope는 view, filtered, all, selection 중 선택하세요.');
      if (formulas && (!this.model.formulas || scope !== 'all')) throw new Error('수식 보존은 formulas 모드에서 scope: all로 내보내세요.');
      let columns = this.columns, merges = scope === 'view' ? this.merges : [];
      let rows = scope === 'all' ? this.getData({ raw: formulas }) : scope === 'filtered' ? this.fullResult.view.map(item => item.row) : this.view.map(item => item.row);
      if (scope === 'filtered' && this.dataMode === 'virtual') merges = this.merges;
      if (scope === 'selection') {
        if (!this.view.length) throw new Error('다운로드할 셀을 선택하세요.');
        const range = this.getSelection(); columns = this.columns.slice(range.left, range.right + 1); rows = rows.slice(range.top, range.bottom + 1);
        merges = this.merges.filter(merge => this.intersects(range, merge)).map(merge => ({ ...merge, row: merge.row - range.top, col: merge.col - range.left }));
      }
      const bytes = writeXLSX(rows, this.xlsx, columns, { sheetName, merges, formulas });
      this.downloadFile(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
      this.message(`${rows.length}행 XLSX 내보내기 완료`); return true;
    } catch (error) { this.message(error.message, true); return false; }
  }

  downloadFile(blob, name) {
    const url = URL.createObjectURL(blob), link = node('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  onKey(event) {
    if (this.editor) return;
    if (event.isComposing || event.keyCode === 229) { if (this.cellAt(event.target)) this.startEdit(this.current, ''); return; }
    if (event.target.closest('button,[role=separator]')) return;
    const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    if (modifier && (key === 'z' || key === 'y')) {
      event.preventDefault(); if (key === 'y' || event.shiftKey) this.redo(); else this.undo(); return;
    }
    if (modifier && key === 'a') {
      if (!this.view.length) return;
      event.preventDefault(); this.anchor = { row: 0, col: 0 }; this.select({ row: this.view.length - 1, col: this.columns.length - 1 }, true); return;
    }
    if ((!this.cellAt(event.target) && event.target !== this.table) || !this.view.length) return;
    if (modifier && event.key === 'Delete') { event.preventDefault(); this.deleteSelectedRows(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); this.clearSelection(); return; }
    const destination = { ...this.current };
    const merged = this.mergeOwners.get(`${this.current.row}:${this.current.col}`);
    if (event.key === 'ArrowDown') destination.row = merged ? merged.row + merged.rowSpan : destination.row + 1;
    else if (event.key === 'ArrowUp') destination.row = merged ? merged.row - 1 : destination.row - 1;
    else if (event.key === 'ArrowLeft') destination.col = merged ? merged.col - 1 : destination.col - 1;
    else if (event.key === 'ArrowRight') destination.col = merged ? merged.col + merged.colSpan : destination.col + 1;
    else if (event.key === 'Home') { destination.col = 0; if (modifier) destination.row = 0; }
    else if (event.key === 'End') { destination.col = this.columns.length - 1; if (modifier) destination.row = this.view.length - 1; }
    else if (event.key === 'Tab') {
      const position = this.current.row * this.columns.length + this.current.col + (event.shiftKey ? -1 : 1);
      if (position < 0 || position >= this.view.length * this.columns.length) return;
      destination.row = Math.floor(position / this.columns.length); destination.col = position % this.columns.length;
    } else if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); this.startEdit(this.current); return; }
    else if (!modifier && !event.altKey && event.key.length === 1) { event.preventDefault(); this.startEdit(this.current, event.key); return; }
    else return;
    event.preventDefault(); this.select(destination, event.shiftKey && event.key !== 'Tab');
  }

  startEdit(cell, initial) {
    cell = this.mergeOwners.get(`${cell.row}:${cell.col}`) || cell;
    if (this.editor || !this.editable || this.columns[cell.col].editable === false || !this.view[cell.row]) return;
    this.select(cell);
    const column = this.columns[cell.col], dataRow = this.view[cell.row].index;
    const td = this.table.querySelector('td[tabindex="0"]'), input = node('input');
    input.type = 'text'; input.setAttribute('aria-label', `${column.header || column.field} 편집`);
    input.setAttribute('aria-describedby', this.status.id);
    if (column.type === 'number') input.inputMode = 'decimal';
    input.value = initial ?? this.model.rows[dataRow][column.field] ?? '';
    this.editor = { input, cell: { ...cell }, dataRow, column, revision: this.model.revision, composing: false };
    input.addEventListener('input', () => this.persistDraft());
    input.addEventListener('compositionstart', () => { if (this.editor?.input === input) this.editor.composing = true; });
    input.addEventListener('compositionend', () => { if (this.editor?.input === input) this.editor.composing = false; });
    input.addEventListener('keyup', event => { if (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter') { if (this.editor?.input === input) this.editor.compositionConfirm = false; } });
    td.replaceChildren(input); input.focus(); if (initial == null) input.select();
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing || event.keyCode === 229 || this.editor?.composing) {
        if (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter') this.editor.compositionConfirm = true;
        return;
      }
      if (event.key === 'Enter' && this.editor?.compositionConfirm) return;
      if (event.key === 'Escape') { event.preventDefault(); this.cancelEdit(); }
      else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault(); const location = { ...this.current };
        if (this.finishEdit()) {
          const owner = this.mergeOwners.get(`${location.row}:${location.col}`);
          if (event.key === 'Enter') location.row = owner ? event.shiftKey ? owner.row - 1 : owner.row + owner.rowSpan : location.row + (event.shiftKey ? -1 : 1);
          else { location.col = owner ? event.shiftKey ? owner.col - 1 : owner.col + owner.colSpan : location.col + (event.shiftKey ? -1 : 1); if (location.col >= this.columns.length) { location.col = 0; location.row++; } else if (location.col < 0) { location.col = this.columns.length - 1; location.row--; } }
          this.select(location);
        }
      }
    });
    input.addEventListener('blur', () => {
      // Keep invalid edits intact so the operator can correct or cancel them.
      if (this.editor?.input === input && !this.finishEdit()) queueMicrotask(() => { if (this.editor?.input === input) input.focus(); });
    });
  }

  cancelEdit() { this.editor = null; this.render(); this.focusCell(); this.persistDraft(); this.message('편집을 취소했습니다.'); }
  finishEdit() {
    if (!this.editor) return true;
    if (this.editor.composing) return false;
    if (this.editor.revision !== this.model.revision) { this.message('외부 데이터가 변경됐습니다. Esc로 취소하고 다시 입력하세요.', true); return false; }
    const { input, dataRow, column } = this.editor;
    let changes;
    try { changes = this.mutateModel('apply', [{ row: dataRow, field: column.field, value: input.value }], 'edit'); }
    catch (error) { input.setAttribute('aria-invalid', 'true'); input.title = error.message; this.message(error.message, true); return false; }
    this.editor = null; this.changed(changes, 'edit'); return true;
  }

  selectedChanges(valueFactory) {
    const range = this.getSelection(), changes = [];
    for (let row = range.top; row <= range.bottom && row < this.view.length; row++) {
      for (let col = range.left; col <= range.right; col++) if (this.columns[col].editable !== false) changes.push({ row: this.view[row].index, field: this.columns[col].field, value: valueFactory(row, col) });
    }
    return changes;
  }

  copyRawSelection() {
    const range = this.getSelection(), cells = [];
    for (let row = range.top; row <= range.bottom && row < this.view.length; row++) cells.push(this.columns.slice(range.left, range.right + 1).map((column, x) => ({ row: this.view[row].index, col: this.model.columns.findIndex(item => item.field === column.field), value: this.model.rows[this.view[row].index][column.field] })));
    return { version: 1, cells };
  }

  copySelection() {
    const range = this.getSelection(), rows = [];
    for (let row = range.top; row <= range.bottom && row < this.view.length; row++) rows.push(this.columns.slice(range.left, range.right + 1).map(column => this.view[row].row[column.field]));
    return toTSV(rows);
  }

  paste(text) {
    if (this.editor || !this.editable) return false;
    let applied, range, height, width;
    try {
      const matrix = Array.isArray(text) ? text : parseTSV(text), changes = [];
      if (!matrix.length || matrix.some(row => !Array.isArray(row))) throw new Error('붙여넣기 데이터가 올바르지 않습니다.');
      range = this.getSelection(); height = matrix.length; width = Math.max(...matrix.map(row => row.length));
      if (this.merges.some(merge => this.intersects({ top: range.top, bottom: range.top + height - 1, left: range.left, right: range.left + width - 1 }, merge))) throw new Error('붙여넣기 전에 대상 셀의 병합을 해제하세요.');
      if (!width || range.left + width > this.columns.length || height * width > 100000) throw new Error('붙여넣을 데이터가 그리드 범위를 벗어나거나 너무 큽니다.');
      const extra = Math.max(0, range.top + height - this.view.length);
      if (extra && !this.columns.slice(range.left, range.left + width).some(column => column.editable !== false)) throw new Error('읽기 전용 셀에는 행을 추가해 붙여넣을 수 없습니다.');
      if (extra && (this.dataMode !== 'virtual' || this.options.pasteAppend === false || this.query.trim() || this.filters.length || this.groupBy.length || this.tree)) throw new Error('행 범위를 넘었습니다. 가상 스크롤 모드에서 검색·필터를 해제하거나 행을 추가하세요.');
      if (extra) {
        const candidate = this.model.getData(), originalCount = candidate.length;
        for (let index = 0; index < extra; index++) candidate.push(this.makeRow({}, index));
        matrix.forEach((row, y) => row.forEach((value, x) => {
          const column = this.columns[range.left + x], target = this.view[range.top + y]?.index ?? originalCount + range.top + y - this.view.length;
          if (column.editable !== false) candidate[target][column.field] = this.model.convert(column, value);
        }));
        applied = this.mutateModel('replaceRows', candidate, 'paste', false);
      } else {
        matrix.forEach((row, y) => row.forEach((value, x) => { if (this.columns[range.left + x].editable !== false) changes.push({ row: this.view[range.top + y].index, field: this.columns[range.left + x].field, value }); }));
        applied = this.mutateModel('apply', changes, 'paste');
      }
    } catch (error) { this.message(error.message, true); return false; }
    this.anchor = { row: range.top, col: range.left }; this.current = { row: range.top + height - 1, col: range.left + width - 1 };
    this.changed(applied, 'paste'); return true;
  }

  clearSelection() {
    if (this.editor) return;
    let changes;
    try { changes = this.mutateModel('apply', this.selectedChanges(() => ''), 'clear'); }
    catch (error) { this.message(error.message, true); return; }
    this.changed(changes, 'clear');
  }

  undo() { if (!this.editable) return; if (this.editor) this.cancelEdit(); else this.changed(this.mutateModel('undo'), 'undo'); }
  redo() { if (this.editable && !this.editor) this.changed(this.mutateModel('redo'), 'redo'); }
  changed(changes, reason) {
    if (changes.length) this.dataRevision++;
    if (changes.length && (this.query.trim() || this.filters.length || this.sorts.length)) this.merges = [];
    if (changes.some(change => change.kind === 'rows')) { this.merges = []; this.resetSelection(); }
    this.render(); this.focusCell(); this.persistDraft();
    this.message(changes.length ? `${changes.some(change => change.kind === 'rows') ? '행 데이터' : changes.length + '셀'} ${reason === 'undo' ? '되돌림' : reason === 'redo' ? '다시 적용' : '변경'} · ${this.model.canUndo ? 'Ctrl+Z로 되돌리기' : '되돌릴 작업 없음'}` : '변경된 셀이 없습니다.');
    if (changes.length) this.options.onChange?.({ reason, changes, data: this.getData() });
  }
  getData({ raw = false } = {}) { return raw ? this.model.getData() : this.model.getComputedData(); }
  mutateModel(method, ...args) { this.localWrite = true; try { return this.model[method](...args); } finally { this.localWrite = false; } }
  setSearch(query) { clearTimeout(this.searchTimer); if (!this.canLeaveRemote()) return false; if (this.editor) this.cancelEdit(); this.query = String(query); this.search.value = this.query; this.merges = []; this.resetSelection(); this.render(); return true; }
  setData(rows) {
    if (this.remote) throw new Error('서버 데이터는 reload()로 갱신하세요.');
    if (this.recovery && !this.recovery.blocked && this.isDraftDirty()) { this.message('미저장 작업을 저장하거나 discardChanges()로 취소한 뒤 데이터를 교체하세요.', true); return false; }
    this.resetRowWindow(); this.mutateModel('setData', rows);
    if (this.recovery) this.localDraftBaseline = JSON.stringify(this.model.rows);
    this.dataRevision++; this.editor = null; this.merges = []; this.resetSelection(); this.render(); this.persistDraft(); return true;
  }
  downloadCSV() {
    if (this.remoteChanges?.locked) return false;
    if (this.editor && !this.finishEdit()) return;
    const quote = value => {
      let text = value == null ? '' : String(value);
      if (typeof value !== 'number' && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [this.columns.map(column => column.header || column.field), ...this.view.map(({ row }) => this.columns.map(column => row[column.field]))];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    this.downloadFile(blob, 'moum-grid.csv'); this.message('검색·정렬된 데이터를 CSV로 내보냈습니다.');
  }
  destroy() { this.persistDraft(); this.destroyed = true; clearTimeout(this.searchTimer); this.remote?.dispose(); this.remoteChanges?.dispose(); this.recovery?.dispose(); this.exportRequest?.abort(); this.editor = null; this.resizeObserver.disconnect(); this.unsubscribe?.(); cancelAnimationFrame(this.scrollFrame); this.events.abort(); this.root.remove(); }
}

module.exports = { Grid, GridModel, RemoteData, FormulaSheet, isFormula, translateFormula, columnName, parseTSV, toTSV, readXLSX, writeXLSX, virtualWindow, columnWindow };
