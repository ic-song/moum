import { CalendarModel, calendarDate, calendarDay, calendarStamp, addCalendarDays, calendarRange, calendarLanes } from './model.js';

function calEl(tag, text, cls) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; }
function calToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
let calendarSequence = 0;
export class Calendar {
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
    button.addEventListener('click', () => { this.options.onSelect?.(structuredClone(event)); this.openEditor(event.id); });
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
    }
    const close = calEl('button', '닫기'); close.type = 'button'; close.addEventListener('click', () => { form.remove(); this.editor = null; this.root.querySelector('button')?.focus(); }); buttons.append(close); form.append(buttons);
    form.addEventListener('submit', e => { e.preventDefault(); this.attempt(() => { const patch = { title: fields.title.value, start: fields.start.value, end: fields.end.value, allDay: allDay.checked, description: fields.description.value, recurrence: repeat.value === 'none' ? null : { frequency: repeat.value, interval: Number(fields.interval.value), until: fields.until.value } }; if (id == null) this.addEvent({ ...patch, id: `event-${Date.now()}-${++calendarSequence}` }); else this.updateEvent(id, patch); }); });
    this.root.append(form); fields.title.focus();
  }
  destroy() { if (this.destroyed) return; this.destroyed = true; this.root.remove(); }
}
