export function virtualWindow(count, scrollTop, height, rowHeight = 48, overscan = 5) {
  const start = Math.max(0, Math.min(count, Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan));
  const end = Math.min(count, Math.max(start, Math.ceil((Math.max(0, scrollTop) + height) / rowHeight) + overscan));
  return { start, end, before: start * rowHeight, after: (count - end) * rowHeight };
}

export function columnWindow(columns, scrollLeft, width, frozen = 0, virtual = true) {
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
