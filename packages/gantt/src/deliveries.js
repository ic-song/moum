import { ganttDate } from './model.js';

/** Aggregate a single purchase item in its own unit of measure. */
export function summarizeDeliveries(lines, receipts, { asOf, precision = 3 } = {}) {
  if (!Array.isArray(lines) || !Array.isArray(receipts)) throw new TypeError('납품 일정과 입고 내역은 배열이어야 합니다.');
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) throw new RangeError('수량 소수 자릿수는 0~6입니다.');
  const reportDate = asOf === undefined ? null : ganttDate(asOf), factor = 10 ** precision;
  const byId = new Map(), receiptIds = new Set();
  const idOf = id => {
    if (!['string', 'number'].includes(typeof id) || (typeof id === 'number' && !Number.isFinite(id)) || !String(id).trim()) throw new TypeError('납품 일정과 입고 ID가 필요합니다.');
    return String(id);
  };
  const units = value => {
    if (typeof value !== 'number' || value <= 0) throw new RangeError('허용 자릿수의 양수 수량이 필요합니다.');
    const scaled = Math.round(value * factor);
    if (!Number.isSafeInteger(scaled) || scaled / factor !== value) throw new RangeError('허용 자릿수의 양수 수량이 필요합니다.');
    return scaled;
  };
  const add = (left, right) => {
    const result = left + right;
    if (!Number.isSafeInteger(result)) throw new RangeError('합계가 안전한 수량 범위를 넘었습니다.');
    return result;
  };
  for (const line of lines) {
    const id = idOf(line?.id);
    if (byId.has(id)) throw new Error(`중복 납품 일정 ID: ${id}`);
    ganttDate(line.dueDate);
    byId.set(id, { id, dueDate: line.dueDate, planned: units(line.quantity), received: 0 });
  }
  for (const receipt of receipts) {
    const id = idOf(receipt?.id), line = byId.get(idOf(receipt.lineId));
    if (receiptIds.has(id)) throw new Error(`중복 입고 ID: ${id}`);
    if (!line) throw new Error(`입고 대상 납품 일정을 찾을 수 없습니다: ${receipt.lineId}`);
    const date = ganttDate(receipt.date), quantity = units(receipt.quantity);
    receiptIds.add(id);
    if (reportDate === null || date <= reportDate) line.received = add(line.received, quantity);
  }
  const totals = { planned: 0, received: 0, open: 0, excess: 0, overdue: 0 };
  const divide = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value / factor]));
  const schedule = [...byId.values()].map(({ id, dueDate, planned, received }) => {
    const open = Math.max(0, planned - received), excess = Math.max(0, received - planned);
    const overdue = reportDate !== null && ganttDate(dueDate) < reportDate ? open : 0;
    const quantities = { planned, received, open, excess, overdue };
    for (const key of Object.keys(totals)) totals[key] = add(totals[key], quantities[key]);
    return { id, dueDate, ...divide(quantities) };
  });
  return { lines: schedule, totals: divide(totals) };
}
