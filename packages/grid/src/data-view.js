export const FILTER_OPERATORS = ['contains', 'startsWith', 'equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notEmpty'];

const defaultCellCompare = new Intl.Collator('ko', { numeric: true }).compare;

export function compareCellValues(a, b, direction = 1, compareText = defaultCellCompare) {
  const emptyA = a == null || a === '', emptyB = b == null || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  return direction * (typeof a === 'number' && typeof b === 'number' ? a - b : compareText(String(a), String(b)));
}

const lower = value => String(value ?? '').toLocaleLowerCase();
const empty = value => value == null || value === '';
const comparisons = {
  equals: (a, b) => a === b,
  notEquals: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  between: (a, b, end) => a >= b && a <= end
};

function numericFilterValue(value) {
  // Preserve lazy coercion for non-primitive filter values.
  if (typeof value === 'symbol' || (value != null && typeof value === 'object') || typeof value === 'function') return () => Number(value);
  const number = Number(value);
  return () => number;
}

function compileFilter({ field, operator, value, value2 }) {
  if (operator === 'empty') return row => empty(row[field]);
  if (operator === 'notEmpty') return row => !empty(row[field]);
  const input = lower(value);
  if (operator === 'contains') return row => lower(row[field]).includes(input);
  if (operator === 'startsWith') return row => lower(row[field]).startsWith(input);
  if (!Object.hasOwn(comparisons, operator)) return () => false;
  const compare = comparisons[operator], numeric = numericFilterValue(value);
  const end = operator === 'between' ? String(value2).toLocaleLowerCase() : undefined;
  const numericEnd = operator === 'between' ? numericFilterValue(value2) : undefined;
  return row => {
    const current = row[field];
    if (empty(current)) return operator === 'notEquals';
    if (typeof current !== 'number') return compare(lower(current), input, end);
    if (numericEnd) return current >= numeric() && current <= numericEnd();
    return compare(current, numeric());
  };
}

function compileFilters(filters, logic) {
  if (!filters.length) return () => true;
  const checks = filters.map(compileFilter);
  const any = logic === 'or';
  return row => {
    for (const check of checks) if (check(row) === any) return any;
    return !any;
  };
}

export function matchesFilters(row, filters, logic = 'and') {
  return compileFilters(filters, logic)(row);
}

export function treeIndex(rows, tree) {
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

export function buildDisplay(rows, { columns, allColumns = columns, query = '', filters = [], filterLogic = 'and', sorts = [], groupBy = [], collapsedGroups = new Set(), tree = null, collapsedNodes = new Set(), compareText = defaultCellCompare }) {
  const text = query.trim().toLocaleLowerCase();
  const searchFields = text ? allColumns.filter(column => column.searchable !== false).map(column => column.field) : [];
  const matchesFilter = compileFilters(filters, filterLogic);
  const matches = row => matchesFilter(row) && (!text || searchFields.some(field => lower(row[field]).includes(text)));
  const compare = (a, b) => {
    for (const sort of sorts) { const result = compareCellValues(a.row[sort.field], b.row[sort.field], sort.direction, compareText); if (result) return result; }
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
    const items = [];
    if (!groupBy.length && !sorts.length) {
      rows.forEach((row, index) => { if (matches(row)) addData({ row, index }); });
      return { display, view };
    }
    rows.forEach((row, index) => { if (matches(row)) items.push({ row, index }); });
    if (sorts.length) items.sort(compare);
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
