// A bounded expression parser. No JavaScript evaluation or property access.
class FormulaFault extends Error { constructor(code) { super(code); this.code = code; } }
const fault = code => { throw new FormulaFault(code); };
export const isFormula = value => typeof value === 'string' && value.startsWith('=');

export function columnName(index) {
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

export class FormulaSheet {
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
export function translateFormula(expression, rowDelta, colDelta, { absolute = false } = {}) {
  if (!isFormula(expression)) return expression;
  return '=' + tokens(expression).map(token => {
    const ref = reference(token); if (!ref) return token;
    const row = ref.row + (absolute || !ref.fixedRow ? rowDelta : 0), col = ref.col + (absolute || !ref.fixedCol ? colDelta : 0);
    if (row < 0 || col < 0 || !Number.isSafeInteger(row) || !Number.isSafeInteger(col)) throw new Error('수식 참조가 범위를 벗어납니다.');
    return `${ref.fixedCol ? '$' : ''}${columnName(col)}${ref.fixedRow ? '$' : ''}${row + 1}`;
  }).join('');
}
