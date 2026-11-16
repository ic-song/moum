export const DATA_MODES = ['virtual', 'infinite', 'pagination'];
export function validatePageSize(size) {
  if (!Number.isInteger(size) || size < 1 || size > 10000) throw new Error('페이지 크기는 1~10,000의 정수여야 합니다.');
  return size;
}
export function rowWindow(result, { mode = 'virtual', pageSize = 100, pageIndex = 0, loaded = pageSize } = {}) {
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
