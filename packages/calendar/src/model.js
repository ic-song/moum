export const calendarDay = 86400000;
export function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('날짜는 YYYY-MM-DD 형식입니다.');
  const ms = Date.parse(`${value}T00:00:00Z`); if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new RangeError(`올바르지 않은 날짜: ${value}`); return ms;
}
export function addCalendarDays(value, count) { return new Date(calendarDate(value) + count * calendarDay).toISOString().slice(0, 10); }
export function calendarStamp(value, allDay) {
  if (allDay) return calendarDate(value);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new TypeError('시간 일정은 시간대 없는 YYYY-MM-DDTHH:mm 형식입니다.');
  const day = calendarDate(value.slice(0, 10)), hour = Number(value.slice(11, 13)), minute = Number(value.slice(14, 16));
  if (hour > 23 || minute > 59) throw new RangeError('올바르지 않은 시간입니다.'); return day + (hour * 60 + minute) * 60000;
}
export function normalizeEvents(events) {
  if (!Array.isArray(events) || events.length > 10000) throw new RangeError('일정은 최대 10,000개까지 사용할 수 있습니다.');
  const ids = new Set();
  return events.map(event => {
    if (!event || !['string', 'number'].includes(typeof event.id) || String(event.id) === '' || ids.has(String(event.id))) throw new TypeError('일정 id는 비어 있지 않고 고유해야 합니다.');
    const id = String(event.id); ids.add(id); const allDay = event.allDay ?? !String(event.start).includes('T');
    if (typeof allDay !== 'boolean') throw new TypeError('allDay는 boolean입니다.');
    const start = calendarStamp(event.start, allDay), end = calendarStamp(event.end, allDay);
    if (end <= start) throw new RangeError('종료는 시작보다 뒤여야 합니다. 종료일/시간은 범위에 포함하지 않습니다.');
    if (end - start > 366 * calendarDay) throw new RangeError('하나의 일정 기간은 최대 366일입니다.');
    let recurrence = null;
    if (event.recurrence) {
      const r = event.recurrence;
      if (!['daily', 'weekly'].includes(r.frequency)) throw new TypeError('반복은 daily/weekly를 지원합니다.');
      const interval = r.interval ?? 1; if (!Number.isInteger(interval) || interval < 1 || interval > 52) throw new RangeError('반복 간격은 1~52입니다.');
      if (!r.until) throw new TypeError('반복 종료일(until)이 필요합니다.');
      const until = calendarDate(r.until); if (until < calendarDate(event.start.slice(0, 10)) || until - start > 3660 * calendarDay) throw new RangeError('반복 종료일은 시작 이후 최대 10년입니다.');
      recurrence = { frequency: r.frequency, interval, until: r.until };
    }
    const exceptions = event.exceptions || []; if (!Array.isArray(exceptions)) throw new TypeError('exceptions는 날짜 배열입니다.'); exceptions.forEach(calendarDate);
    return { id, title: String(event.title ?? ''), start: event.start, end: event.end, allDay, description: String(event.description ?? ''), recurrence, exceptions: [...new Set(exceptions)] };
  });
}
export function calendarRange(date, view = 'month', weekStartsOn = 0) {
  const ms = calendarDate(date); if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) throw new RangeError('weekStartsOn은 0~6입니다.');
  if (!['month', 'week', 'day', 'agenda'].includes(view)) throw new Error('지원하지 않는 캘린더 보기입니다.');
  if (view === 'day') return { start: date, end: addCalendarDays(date, 1) };
  if (view === 'week') { const offset = (new Date(ms).getUTCDay() - weekStartsOn + 7) % 7, start = addCalendarDays(date, -offset); return { start, end: addCalendarDays(start, 7) }; }
  const first = date.slice(0, 8) + '01';
  if (view === 'agenda') { const d = new Date(calendarDate(first)); d.setUTCMonth(d.getUTCMonth() + 1); return { start: first, end: d.toISOString().slice(0, 10) }; }
  const offset = (new Date(calendarDate(first)).getUTCDay() - weekStartsOn + 7) % 7, start = addCalendarDays(first, -offset); return { start, end: addCalendarDays(start, 42) };
}
export function expandCalendarEvents(events, range) {
  const from = calendarDate(range.start), to = calendarDate(range.end); if (to <= from || to - from > 370 * calendarDay) throw new RangeError('조회 기간은 최대 370일입니다.');
  const result = [];
  for (const event of events) {
    const start = calendarStamp(event.start, event.allDay), end = calendarStamp(event.end, event.allDay);
    const step = event.recurrence ? (event.recurrence.frequency === 'weekly' ? 7 : 1) * event.recurrence.interval * calendarDay : 0;
    const until = event.recurrence ? calendarDate(event.recurrence.until) + calendarDay - 1 : start;
    const firstIndex = step ? Math.max(0, Math.floor((from - end) / step) + 1) : 0;
    for (let i = firstIndex; ; i++) {
      const current = start + i * step, finish = end + i * step; if (current > until || current >= to) break;
      const date = new Date(current).toISOString().slice(0, 10);
      if (finish > from && !event.exceptions.includes(date)) {
        const format = value => new Date(value).toISOString().slice(0, event.allDay ? 10 : 16);
        result.push({ ...structuredClone(event), occurrenceId: `${event.id}@${date}`, start: format(current), end: format(finish), seriesId: event.id });
        if (result.length > 20000) throw new RangeError('조회 기간의 반복 일정이 너무 많습니다. 기간을 줄이세요.');
      }
      if (!step) break;
    }
  }
  return result.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}
export function calendarLanes(events) {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end)); const active = [], placed = []; let group = [], groupMax = 0;
  const finish = () => { for (const item of group) item.laneCount = groupMax; group = []; groupMax = 0; };
  for (const event of sorted) {
    for (let i = active.length - 1; i >= 0; i--) if (active[i].end <= event.start) active.splice(i, 1);
    if (!active.length && group.length) finish();
    let lane = 0; while (active.some(e => e.lane === lane)) lane++;
    const item = { ...event, lane, laneCount: 1 }; active.push(item); placed.push(item); group.push(item); groupMax = Math.max(groupMax, lane + 1);
  }
  finish(); return placed;
}
export class CalendarModel {
  constructor(events = []) { this.events = normalizeEvents(events); this.past = []; this.future = []; }
  getEvents() { return structuredClone(this.events); }
  setEvents(events) { this.events = normalizeEvents(events); this.past = []; this.future = []; }
  commit(events) { const next = normalizeEvents(events); this.past.push(this.getEvents()); if (this.past.length > 50) this.past.shift(); this.events = next; this.future = []; }
  addEvent(event) { this.commit([...this.events, event]); }
  updateEvent(id, patch) { id = String(id); if (!this.events.some(e => e.id === id)) throw new Error('일정을 찾을 수 없습니다.'); if (patch.id != null && String(patch.id) !== id) throw new Error('일정 id는 변경할 수 없습니다.'); this.commit(this.events.map(e => e.id === id ? { ...e, ...patch } : e)); }
  removeEvent(id) { id = String(id); if (!this.events.some(e => e.id === id)) throw new Error('일정을 찾을 수 없습니다.'); this.commit(this.events.filter(e => e.id !== id)); }
  getOccurrences(range) { return expandCalendarEvents(this.events, range); }
  undo() { if (!this.past.length) return false; this.future.push(this.getEvents()); this.events = this.past.pop(); return true; }
  redo() { if (!this.future.length) return false; this.past.push(this.getEvents()); this.events = this.future.pop(); return true; }
}
