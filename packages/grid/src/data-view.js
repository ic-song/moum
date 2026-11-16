export const FILTER_OPERATORS = ['contains', 'startsWith', 'equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notEmpty'];

export function compareCellValues(a, b, direction = 1) {
  const emptyA = a == null || a === '', emptyB = b == null || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  return direction * (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'ko', { numeric: true }));
}

export function matchesFilters(row, filters, logic = 'and') {
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

export function buildDisplay(rows, { columns, query = '', filters = [], filterLogic = 'and', sorts = [], groupBy = [], collapsedGroups = new Set(), tree = null, collapsedNodes = new Set() }) {
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
