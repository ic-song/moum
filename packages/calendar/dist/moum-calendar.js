/*! MOUM calendar v0.2.0 | MIT License | See LICENSE */
(function () {
'use strict';
const calendarDay = 86400000;
function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('날짜는 YYYY-MM-DD 형식입니다.');
  const ms = Date.parse(`${value}T00:00:00Z`); if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new RangeError(`올바르지 않은 날짜: ${value}`); return ms;
}
function addCalendarDays(value, count) { return new Date(calendarDate(value) + count * calendarDay).toISOString().slice(0, 10); }
function calendarStamp(value, allDay) {
  if (allDay) return calendarDate(value);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new TypeError('시간 일정은 시간대 없는 YYYY-MM-DDTHH:mm 형식입니다.');
  const day = calendarDate(value.slice(0, 10)), hour = Number(value.slice(11, 13)), minute = Number(value.slice(14, 16));
  if (hour > 23 || minute > 59) throw new RangeError('올바르지 않은 시간입니다.'); return day + (hour * 60 + minute) * 60000;
}
function normalizeEvents(events) {
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
function calendarRange(date, view = 'month', weekStartsOn = 0) {
  const ms = calendarDate(date); if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) throw new RangeError('weekStartsOn은 0~6입니다.');
  if (!['month', 'week', 'day', 'agenda'].includes(view)) throw new Error('지원하지 않는 캘린더 보기입니다.');
  if (view === 'day') return { start: date, end: addCalendarDays(date, 1) };
  if (view === 'week') { const offset = (new Date(ms).getUTCDay() - weekStartsOn + 7) % 7, start = addCalendarDays(date, -offset); return { start, end: addCalendarDays(start, 7) }; }
  const first = date.slice(0, 8) + '01';
  if (view === 'agenda') { const d = new Date(calendarDate(first)); d.setUTCMonth(d.getUTCMonth() + 1); return { start: first, end: d.toISOString().slice(0, 10) }; }
  const offset = (new Date(calendarDate(first)).getUTCDay() - weekStartsOn + 7) % 7, start = addCalendarDays(first, -offset); return { start, end: addCalendarDays(start, 42) };
}
function expandCalendarEvents(events, range) {
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
function calendarLanes(events) {
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
class CalendarModel {
  constructor(events = []) { this.events = normalizeEvents(events); this.past = []; this.future = []; }
  getEvents() { return structuredClone(this.events); }
  setEvents(events) { this.events = normalizeEvents(events); this.past = []; this.future = []; }
  commit(events) { const next = normalizeEvents(events); this.past.push(this.getEvents()); if (this.past.length > 50) this.past.shift(); this.events = next; this.future = []; }
  addEvent(event) { this.commit([...this.events, event]); }
  updateEvent(id, patch) { id = String(id); if (!this.events.some(e => e.id === id)) throw new Error('일정을 찾을 수 없습니다.'); if (patch.id != null && String(patch.id) !== id) throw new Error('일정 id는 변경할 수 없습니다.'); this.commit(this.events.map(e => e.id === id ? { ...e, ...patch } : e)); }
  removeEvent(id) { id = String(id); if (!this.events.some(e => e.id === id)) throw new Error('일정을 찾을 수 없습니다.'); this.commit(this.events.filter(e => e.id !== id)); }
  setOccurrenceExcluded(id,date,excluded=true) {
    calendarDate(date);id=String(id);const event=this.events.find(e=>e.id===id);
    if(!event?.recurrence)throw new Error('반복 일정이 필요합니다.');
    const occurrences=expandCalendarEvents([{...event,exceptions:[]}],{start:date,end:addCalendarDays(date,1)});
    if(!occurrences.some(e=>e.start.slice(0,10)===date))throw new Error('해당 날짜에 시작하는 반복 회차가 없습니다.');
    const exceptions=event.exceptions.filter(d=>d!==date);if(excluded)exceptions.push(date);this.updateEvent(id,{exceptions});
  }
  getOccurrences(range) { return expandCalendarEvents(this.events, range); }
  undo() { if (!this.past.length) return false; this.future.push(this.getEvents()); this.events = this.past.pop(); return true; }
  redo() { if (!this.future.length) return false; this.past.push(this.getEvents()); this.events = this.future.pop(); return true; }
}


function calEl(tag, text, cls) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; }
function calToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
let calendarSequence = 0;
class Calendar {
  constructor(target, options = {}) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.target || this.target.childNodes.length) throw new Error('비어 있는 캘린더 컨테이너가 필요합니다.');
    this.options = { view: 'month', date: calToday(), weekStartsOn: 0, editable: true, ...options }; calendarRange(this.options.date, this.options.view, this.options.weekStartsOn);
    this.model = new CalendarModel(options.events || []); this.root = calEl('section', null, 'moum-calendar'); this.root.setAttribute('aria-label', options.title || '캘린더'); this.target.append(this.root); this.render();
  }
  active() { if (this.destroyed) throw new Error('이미 제거된 캘린더입니다.'); }
  getEvents() { return this.model.getEvents(); }
  getOccurrences(range = calendarRange(this.options.date, this.options.view, this.options.weekStartsOn)) { return this.model.getOccurrences(range); }
  setEvents(events) { this.active(); this.model.setEvents(events); this.render(); }
  addEvent(event) { this.active(); this.model.addEvent(event); this.changed('add', String(event.id)); }
  updateEvent(id, patch) { this.active(); this.model.updateEvent(id, patch); this.changed('update', String(id)); }
  removeEvent(id) { this.active(); this.model.removeEvent(id); this.changed('remove', String(id)); }
  setOccurrenceExcluded(id,date,excluded=true) { this.active();this.model.setOccurrenceExcluded(id,date,excluded);this.changed(excluded?'exclude-occurrence':'restore-occurrence',String(id)); }
  setView(view) { this.active(); calendarRange(this.options.date, view, this.options.weekStartsOn); this.options.view = view; this.render(); this.options.onViewChange?.({ view, date: this.options.date }); }
  setDate(date) { this.active(); calendarDate(date); this.options.date = date; this.render(); this.options.onViewChange?.({ view: this.options.view, date }); }
  undo() { this.active(); if (this.model.undo()) this.changed('undo'); }
  redo() { this.active(); if (this.model.redo()) this.changed('redo'); }
  changed(type, id) { this.render(); this.options.onChange?.({ type, id, events: this.getEvents() }); }
  attempt(action) { try { action(); } catch (error) { this.status.textContent = error.message; this.status.setAttribute('role', 'alert'); this.options.onError?.(error); } }
  navigate(direction) {
    if (['day', 'week'].includes(this.options.view)) this.setDate(addCalendarDays(this.options.date, direction * (this.options.view === 'week' ? 7 : 1)));
    else { const date = new Date(calendarDate(this.options.date.slice(0, 8) + '01')); date.setUTCMonth(date.getUTCMonth() + direction); this.setDate(date.toISOString().slice(0, 10)); }
  }
  render() {
    this.draggedId = null;
    this.root.replaceChildren(); this.editor = null;
    const toolbar = calEl('div', null, 'moum-calendar-toolbar');
    const button = (text, action) => { const b = calEl('button', text); b.type = 'button'; b.addEventListener('click', () => this.attempt(action)); return b; };
    toolbar.append(button('이전', () => this.navigate(-1)), button('오늘', () => this.setDate(calToday())), button('다음', () => this.navigate(1)));
    const label = calEl('label', '기준일 '), date = calEl('input'); date.type = 'date'; date.value = this.options.date; date.addEventListener('change', () => this.attempt(() => this.setDate(date.value))); label.append(date); toolbar.append(label);
    const views = calEl('select'); views.setAttribute('aria-label', '캘린더 보기'); for (const [key, text] of Object.entries({ month: '월', week: '주', day: '일', agenda: '일정 목록' })) { const o = calEl('option', text); o.value = key; views.append(o); } views.value = this.options.view; views.addEventListener('change', () => this.attempt(() => this.setView(views.value))); toolbar.append(views);
    if (this.options.editable) { toolbar.append(button('일정 추가', () => this.openEditor(null, this.options.date))); const undo = button('되돌리기', () => this.undo()), redo = button('다시 실행', () => this.redo()); undo.disabled = !this.model.past.length; redo.disabled = !this.model.future.length; toolbar.append(undo, redo); }
    this.root.append(toolbar);
    this.status = calEl('p', '종일 일정의 종료일은 포함하지 않습니다. 시간 일정은 현지 벽시계 기준입니다.', 'moum-calendar-status'); this.status.setAttribute('aria-live', 'polite'); this.root.append(this.status);
    const range = calendarRange(this.options.date, this.options.view, this.options.weekStartsOn), events = this.getOccurrences(range);
    if (this.options.view === 'month') this.renderMonth(range, events); else if (this.options.view === 'agenda') this.renderAgenda(events); else this.renderTime(range, events);
  }
  eventButton(event) {
    const prefix = event.allDay ? '종일' : event.start.slice(11, 16);
    const button = calEl('button', `${prefix} ${event.title}${event.recurrence ? ' ↻' : ''}`, 'moum-calendar-event'); button.type = 'button'; button.dataset.eventId = event.id; button.title = `${event.title}\n${event.start} ~ ${event.end}\n${event.description}`;
    button.addEventListener('click', () => { this.options.onSelect?.(structuredClone(event)); this.openEditor(event.id, event.start.slice(0,10)); });
    if (this.options.editable && !event.recurrence) { button.draggable = true; button.addEventListener('dragstart', e => { this.draggedId = event.id; e.dataTransfer.setData('text/plain', event.title); e.dataTransfer.effectAllowed = 'move'; }); button.addEventListener('dragend', () => { this.draggedId = null; }); }
    return button;
  }
  dropTarget(element, date) {
    if (!this.options.editable) return;
    element.addEventListener('dragover', e => { if (this.draggedId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } });
    element.addEventListener('drop', e => { const id = this.draggedId; if (!id) return; this.draggedId = null; e.preventDefault(); this.attempt(() => { const event = this.model.events.find(x => x.id === id); if (!event || event.recurrence) return; const days = Math.round((calendarDate(date) - calendarDate(event.start.slice(0, 10))) / calendarDay); this.updateEvent(event.id, { start: addCalendarDays(event.start.slice(0, 10), days) + event.start.slice(10), end: addCalendarDays(event.end.slice(0, 10), days) + event.end.slice(10) }); }); });
  }
  renderMonth(range, events) {
    const scroll = calEl('div', null, 'moum-calendar-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', '월간 일정, 작은 화면에서는 가로 스크롤 가능');
    const grid = calEl('div', null, 'moum-calendar-month'); const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    for (let i = 0; i < 7; i++) grid.append(calEl('div', weekdays[(i + this.options.weekStartsOn) % 7], 'moum-calendar-weekday'));
    for (let index = 0; index < 42; index++) {
      const date = addCalendarDays(range.start, index), day = calEl('div', null, 'moum-calendar-day'); day.dataset.date = date; if (date.slice(0, 7) !== this.options.date.slice(0, 7)) day.classList.add('is-outside'); if (date === calToday()) day.classList.add('is-today');
      const heading = calEl('button', String(Number(date.slice(8))), 'moum-calendar-day-number'); heading.type = 'button'; heading.setAttribute('aria-label', `${date} ${this.options.editable ? '일정 추가' : '일간 보기'}`); heading.addEventListener('click', () => { if (this.options.editable) this.openEditor(null, date); else { this.options.date = date; this.setView('day'); } }); day.append(heading);
      const dayStart = calendarDate(date), next = dayStart + calendarDay;
      events.filter(event => calendarStamp(event.start, event.allDay) < next && calendarStamp(event.end, event.allDay) > dayStart).forEach(event => day.append(this.eventButton(event)));
      this.dropTarget(day, date); grid.append(day);
    }
    scroll.append(grid); this.root.append(scroll);
  }
  renderAgenda(events) {
    const list = calEl('div', null, 'moum-calendar-agenda'); if (!events.length) list.append(calEl('p', '이 기간에는 일정이 없습니다. 일정 추가로 시작하세요.'));
    events.forEach(event => { const row = calEl('div', null, 'moum-calendar-agenda-row'); row.append(calEl('span', `${event.start} → ${event.end}`), this.eventButton(event)); list.append(row); }); this.root.append(list);
  }
  renderTime(range, events) {
    const count = Math.round((calendarDate(range.end) - calendarDate(range.start)) / calendarDay);
    const scroll = calEl('div', null, 'moum-calendar-scroll moum-calendar-time-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', '시간별 일정, 스크롤 가능');
    const grid = calEl('div', null, 'moum-calendar-time'); grid.style.gridTemplateColumns = `64px repeat(${count}, minmax(100px, 1fr))`; grid.style.minWidth = `${64 + count * 100}px`;
    const axis = calEl('div', null, 'moum-calendar-axis'); const spacer = calEl('div', '시간', 'moum-calendar-time-heading'); axis.append(spacer); const axisBody = calEl('div', null, 'moum-calendar-hours');
    for (let hour = 0; hour < 24; hour++) { const tick = calEl('span', `${String(hour).padStart(2, '0')}:00`); tick.style.top = `${hour * 48}px`; axisBody.append(tick); } axis.append(axisBody); grid.append(axis);
    for (let index = 0; index < count; index++) {
      const date = addCalendarDays(range.start, index), dayStart = calendarDate(date), dayEnd = dayStart + calendarDay;
      const col = calEl('div', null, 'moum-calendar-time-column'), header = calEl('div', null, 'moum-calendar-time-heading'); header.append(calEl('strong', date.slice(5)));
      events.filter(e => e.allDay && calendarStamp(e.start, true) < dayEnd && calendarStamp(e.end, true) > dayStart).forEach(e => header.append(this.eventButton(e)));
      const add = calEl('button', '+ 일정'); add.type = 'button'; add.disabled = !this.options.editable; add.addEventListener('click', () => this.openEditor(null, date)); header.append(add); col.append(header);
      const lane = calEl('div', null, 'moum-calendar-time-lane'); this.dropTarget(lane, date);
      const timed = events.filter(e => !e.allDay && calendarStamp(e.start, false) < dayEnd && calendarStamp(e.end, false) > dayStart);
      calendarLanes(timed).forEach(event => { const button = this.eventButton(event), clippedStart = Math.max(dayStart, calendarStamp(event.start, false)), clippedEnd = Math.min(dayEnd, calendarStamp(event.end, false)), top = (clippedStart - dayStart) / 60000 / 60 * 48, height = (clippedEnd - clippedStart) / 60000 / 60 * 48; button.classList.add('moum-calendar-time-event'); button.style.top = `${top}px`; button.style.height = `${Math.max(24, height)}px`; button.style.left = `${event.lane / event.laneCount * 100}%`; button.style.width = `${100 / event.laneCount}%`; lane.append(button); });
      col.append(lane); grid.append(col);
    }
    scroll.append(grid); this.root.append(scroll);
  }
  openEditor(id, date = this.options.date) {
    this.editor?.remove();
    const event = id == null ? { title: '', start: `${date}T09:00`, end: `${date}T10:00`, allDay: false, description: '', recurrence: null } : this.model.events.find(e => e.id === id); if (!event) throw new Error('일정을 찾을 수 없습니다.');
    const form = calEl('form', null, 'moum-calendar-editor'); this.editor = form; form.append(calEl('h3', id == null ? '새 일정' : event.recurrence ? '반복 일정 전체 수정' : '일정 수정')); const fields = {};
    const field = (key, text, type, value) => { const label = calEl('label', text), input = calEl(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') input.type = type; input.value = value; input.disabled = !this.options.editable; label.append(input); form.append(label); fields[key] = input; return input; };
    field('title', '일정명', 'text', event.title).required = true;
    const allDay = field('allDay', '종일', 'checkbox', ''); allDay.checked = event.allDay;
    field('start', '시작', event.allDay ? 'date' : 'datetime-local', event.start).required = true;
    field('end', '종료 (범위에 포함하지 않음)', event.allDay ? 'date' : 'datetime-local', event.end).required = true;
    allDay.addEventListener('change', () => { for (const key of ['start', 'end']) { const value = fields[key].value; fields[key].type = allDay.checked ? 'date' : 'datetime-local'; fields[key].value = allDay.checked ? value.slice(0, 10) : value.slice(0, 10) + (key === 'start' ? 'T09:00' : 'T10:00'); } if (allDay.checked && fields.end.value <= fields.start.value) fields.end.value = addCalendarDays(fields.start.value, 1); });
    field('description', '내용', 'textarea', event.description);
    const repeatLabel = calEl('label', '반복'), repeat = calEl('select'); for (const [key, text] of Object.entries({ none: '반복 안 함', daily: '매일', weekly: '매주' })) { const option = calEl('option', text); option.value = key; repeat.append(option); } repeat.value = event.recurrence?.frequency || 'none'; repeat.disabled = !this.options.editable; repeatLabel.append(repeat); form.append(repeatLabel);
    field('interval', '반복 간격', 'number', event.recurrence?.interval || 1); fields.interval.min = 1; fields.interval.max = 52;
    field('until', '반복 종료일', 'date', event.recurrence?.until || addCalendarDays(event.start.slice(0, 10), 30));
    const buttons = calEl('div', null, 'moum-calendar-editor-actions');
    if (this.options.editable) {
      const save = calEl('button', '일정 저장'); save.type = 'submit'; buttons.append(save);
      if (id != null) { const remove = calEl('button', event.recurrence ? '반복 일정 전체 삭제' : '일정 삭제'); remove.type = 'button'; remove.addEventListener('click', () => this.attempt(() => this.removeEvent(id))); buttons.append(remove); }
      if(id!=null&&event.recurrence){const exclude=calEl('button',`${date} 회차만 제외`);exclude.type='button';exclude.addEventListener('click',()=>this.attempt(()=>this.setOccurrenceExcluded(id,date)));buttons.append(exclude);}
    }
    const close = calEl('button', '닫기'); close.type = 'button'; close.addEventListener('click', () => { form.remove(); this.editor = null; this.root.querySelector('button')?.focus(); }); buttons.append(close); form.append(buttons);
    form.addEventListener('submit', e => { e.preventDefault(); this.attempt(() => { const patch = { title: fields.title.value, start: fields.start.value, end: fields.end.value, allDay: allDay.checked, description: fields.description.value, recurrence: repeat.value === 'none' ? null : { frequency: repeat.value, interval: Number(fields.interval.value), until: fields.until.value } }; if (id == null) this.addEvent({ ...patch, id: `event-${Date.now()}-${++calendarSequence}` }); else this.updateEvent(id, patch); }); });
    this.root.append(form); fields.title.focus();
  }
  destroy() { if (this.destroyed) return; this.destroyed = true; this.root.remove(); }
}

globalThis.MoumCalendar = Calendar;
Object.assign(globalThis.MoumCalendar, { calendarDay, calendarDate, addCalendarDays, calendarStamp, normalizeEvents, calendarRange, expandCalendarEvents, calendarLanes, CalendarModel });
})();
