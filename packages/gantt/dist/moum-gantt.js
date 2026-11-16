/*! MOUM gantt v0.3.0 | MIT License | See LICENSE */
(function () {
'use strict';
const ganttDay = 86400000;
function ganttDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('날짜는 YYYY-MM-DD 형식이어야 합니다.');
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new RangeError(`올바르지 않은 날짜: ${value}`);
  return ms;
}
function shiftGanttDate(value, days) { return new Date(ganttDate(value) + days * ganttDay).toISOString().slice(0, 10); }
function normalizeWorkCalendar(calendar) {
  if(calendar==null)return null;
  if(typeof calendar!=='object'||Array.isArray(calendar)||!Array.isArray(calendar.weekendDays??[])||!Array.isArray(calendar.holidays??[]))throw new TypeError('workCalendar의 weekendDays와 holidays는 배열입니다.');
  const weekendDays=[...new Set(calendar.weekendDays??[0,6])],holidays=[...new Set(calendar.holidays??[])];
  if(weekendDays.length>6||weekendDays.some(n=>!Number.isInteger(n)||n<0||n>6)||holidays.length>10000)throw new RangeError('주말은 0~6이며 최소 하루는 업무일이어야 합니다. 휴일은 최대10,000개입니다.');
  holidays.forEach(ganttDate);return {weekendDays,holidays};
}
function workStamp(stamp,calendar) { return !calendar||(!calendar.weekendDays.includes(new Date(stamp).getUTCDay())&&!calendar.holidays.includes(new Date(stamp).toISOString().slice(0,10))); }
function isGanttWorkday(date, calendar) { return workStamp(ganttDate(date),normalizeWorkCalendar(calendar)); }
function ganttWorkingDays(start,end,calendar) {
  calendar=normalizeWorkCalendar(calendar);const a=ganttDate(start),b=ganttDate(end);if(b<a||b-a>3650*ganttDay)throw new RangeError('업무일 계산 범위는 최대10년입니다.');
  let count=0;for(let n=a;n<=b;n+=ganttDay)if(workStamp(n,calendar))count++;return count;
}
function nextWorkStamp(stamp,calendar) { for(let i=0;i<=36600;i++,stamp+=ganttDay){if(stamp>ganttDate('9999-12-31'))break;if(workStamp(stamp,calendar))return stamp;}throw new RangeError('계산 가능한 업무일 범위를 초과했습니다.'); }
function ganttSummary(tasks) {
  const data=normalizeTasks(tasks);if(!data.length)return null;
  const parents=new Set(data.map(t=>t.parentId).filter(id=>id!==null)),leaves=data.filter(t=>!parents.has(t.id)),work=leaves.filter(t=>t.type!=='milestone'),weighted=work.length?work:leaves;
  let weight=0,completed=0;for(const task of weighted){const days=work.length?(ganttDate(task.end)-ganttDate(task.start))/ganttDay+1:1;weight+=days;completed+=days*task.progress;}
  return {start:data.reduce((d,t)=>t.start<d?t.start:d,data[0].start),end:data.reduce((d,t)=>t.end>d?t.end:d,data[0].end),progress:Math.round(completed/weight*100)/100,taskCount:work.length,milestoneCount:leaves.filter(t=>t.type==='milestone').length};
}
function normalizeTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length > 3000) throw new RangeError('작업은 최대 3,000개까지 사용할 수 있습니다.');
  const ids = new Set();
  const result = tasks.map(t => {
    if (!t || !['string', 'number'].includes(typeof t.id) || String(t.id) === '' || ids.has(String(t.id))) throw new TypeError('작업 id는 비어 있지 않고 중복되지 않아야 합니다.');
    const id = String(t.id); ids.add(id);
    const start = ganttDate(t.start), end = ganttDate(t.end);
    if (end < start) throw new RangeError('종료일은 시작일보다 빠를 수 없습니다.');
    if (t.progress != null && (!Number.isFinite(t.progress) || t.progress < 0 || t.progress > 100)) throw new RangeError('진행률은 0~100입니다.');
    if (t.dependencies != null && !Array.isArray(t.dependencies)) throw new TypeError('dependencies는 선행 작업 id 배열입니다.');
    if (t.type != null && !['task', 'milestone'].includes(t.type)) throw new TypeError('type은 task 또는 milestone입니다.');
    if (t.type === 'milestone' && start !== end) throw new RangeError('마일스톤의 시작일과 종료일은 같아야 합니다.');
    return { id, name: String(t.name ?? id), start: t.start, end: t.end, progress: t.progress ?? 0, dependencies: [...new Set((t.dependencies || []).map(String))], parentId: t.parentId == null ? null : String(t.parentId), type: t.type || 'task' };
  });
  const byId = new Map(result.map(t => [t.id, t]));
  for (const task of result) {
    if (task.parentId !== null && !ids.has(task.parentId)) throw new Error(`상위 작업을 찾을 수 없습니다: ${task.parentId}`);
    for (const dep of task.dependencies) if (!ids.has(dep)) throw new Error(`선행 작업을 찾을 수 없습니다: ${dep}`);
  }
  const checkCycles = edges => {
    const visiting = new Set(), done = new Set();
    function visit(id) { if (visiting.has(id)) throw new Error('작업 관계에 순환이 있습니다.'); if (done.has(id)) return; visiting.add(id); for (const next of edges(byId.get(id))) visit(next); visiting.delete(id); done.add(id); }
    for (const task of result) visit(task.id);
  };
  checkCycles(t => t.dependencies); checkCycles(t => t.parentId === null ? [] : [t.parentId]);
  if (result.length) {
    const starts = result.map(t => ganttDate(t.start)), ends = result.map(t => ganttDate(t.end));
    if (Math.max(...ends) - Math.min(...starts) > ganttDay * 3650) throw new RangeError('표시 기간은 최대 10년입니다.');
  }
  return result;
}
class GanttModel {
  constructor(tasks = [], options = {}) { this.workCalendar=normalizeWorkCalendar(options.workCalendar);this.tasks = normalizeTasks(tasks); this.past = []; this.future = []; }
  getTasks() { return structuredClone(this.tasks); }
  commit(tasks) { const next = normalizeTasks(tasks); this.past.push(this.getTasks()); if (this.past.length > 50) this.past.shift(); this.future = []; this.tasks = next; return this.getTasks(); }
  setTasks(tasks) { this.tasks = normalizeTasks(tasks); this.past = []; this.future = []; }
  updateTask(id, patch) { if (!this.tasks.some(t => t.id === String(id))) throw new Error('작업을 찾을 수 없습니다.'); if (patch.id != null && String(patch.id) !== String(id)) throw new Error('작업 id는 변경할 수 없습니다.'); return this.commit(this.tasks.map(t => t.id === String(id) ? { ...t, ...patch } : t)); }
  addTask(task) { return this.commit([...this.tasks, task]); }
  scheduleDependencies() {
    const tasks=this.getTasks(), byId=new Map(tasks.map(t=>[t.id,t])), done=new Set();
    const visit=id=>{if(done.has(id))return;const task=byId.get(id);for(const dep of task.dependencies)visit(dep);
      let required=Math.max(ganttDate(task.start),...task.dependencies.map(dep=>ganttDate(byId.get(dep).end)+ganttDay));
      if(this.workCalendar){
        required=nextWorkStamp(required,this.workCalendar);const count=task.type==='milestone'?1:Math.max(1,ganttWorkingDays(task.start,task.end,this.workCalendar));let end=required;
        for(let n=1;n<count;n++)end=nextWorkStamp(end+ganttDay,this.workCalendar);
        task.start=new Date(required).toISOString().slice(0,10);task.end=new Date(end).toISOString().slice(0,10);
      }else if(required>ganttDate(task.start)){const duration=ganttDate(task.end)-ganttDate(task.start);task.start=new Date(required).toISOString().slice(0,10);task.end=new Date(required+duration).toISOString().slice(0,10);}done.add(id);};
    for(const task of tasks)visit(task.id);
    if(tasks.some((t,i)=>t.start!==this.tasks[i].start||t.end!==this.tasks[i].end))return this.commit(tasks);
    return this.getTasks();
  }
  removeTask(id) { id = String(id); if (!this.tasks.some(t => t.id === id)) throw new Error('작업을 찾을 수 없습니다.'); if (this.tasks.some(t => t.parentId === id)) throw new Error('하위 작업을 먼저 삭제하세요.'); return this.commit(this.tasks.filter(t => t.id !== id).map(t => ({ ...t, dependencies: t.dependencies.filter(d => d !== id) }))); }
  undo() { if (!this.past.length) return false; this.future.push(this.getTasks()); this.tasks = this.past.pop(); return true; }
  redo() { if (!this.future.length) return false; this.past.push(this.getTasks()); this.tasks = this.future.pop(); return true; }
  getWarnings() { const byId = new Map(this.tasks.map(t => [t.id, t])); return this.tasks.flatMap(t => t.dependencies.filter(d => byId.get(d).end >= t.start).map(d => ({ taskId: t.id, predecessorId: d, message: `${t.name}: 선행 작업 ${byId.get(d).name} 종료 다음 날 이후에 시작해야 합니다.` }))); }
}


function ganttEl(tag, text, cls) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; }
function ganttSvg(tag, attrs) { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; }
const ganttScales = { day: 36, week: 12, month: 4 };
function miniGanttRange(range) {
  if(range==null)return null;
  const start=ganttDate(range.start),end=ganttDate(range.end);
  if(end<start||end-start>3650*ganttDay)throw new RangeError('미니 간트 범위는 종료일 포함, 최대10년입니다.');
  return {start:range.start,end:range.end};
}
function miniGanttOptions(options={}) {
  if(options!=null&&(typeof options!=='object'||Array.isArray(options)))throw new TypeError('mini 옵션은 객체입니다.');
  const type=options?.type??'bars';if(!['bars','compact','summary','milestones'].includes(type))throw new TypeError('미니 타입은 bars/compact/summary/milestones입니다.');
  const result={header:type!=='compact',labels:type!=='compact',status:type!=='compact',...options,type};
  for(const key of ['header','labels','status'])if(typeof result[key]!=='boolean')throw new TypeError(`mini.${key}는 boolean입니다.`);
  return result;
}
let ganttSequence = 0;
class Gantt {
  constructor(target, options = {}) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.target || this.target.childNodes.length) throw new Error('비어 있는 간트 컨테이너가 필요합니다.');
    if (options.scale && !ganttScales[options.scale]) throw new Error('scale은 day/week/month입니다.');
    if(options.view!=null&&!['full','mini'].includes(options.view))throw new TypeError('view는 full 또는 mini입니다.');
    this.options = { scale: 'day', editable: true, view:'full', ...options, range:miniGanttRange(options.range), mini:miniGanttOptions(options.mini) };this.miniOverrides={...options.mini}; this.model = new GanttModel(options.tasks || [],options); this.collapsed = new Set(); this.selected = null; this.sequence = ++ganttSequence;
    this.root = ganttEl('section', null, 'moum-gantt'); this.root.setAttribute('aria-label', options.title || '작업 일정'); this.target.append(this.root); this.render();
  }
  active() { if (this.destroyed) throw new Error('이미 제거된 간트입니다.'); }
  getTasks() { return this.model.getTasks(); }
  getWarnings() { return this.model.getWarnings(); }
  shadeWorkdays(track,first,last,unit) {
    if(!this.model.workCalendar)return;
    const key=`${first}/${last}/${unit}`;
    if(this.shadeKey!==key){const calendar=this.model.workCalendar,holidays=new Set(calendar.holidays),stops=[];
      for(let stamp=first;stamp<last;stamp+=ganttDay){const date=new Date(stamp);if(calendar.weekendDays.includes(date.getUTCDay())||holidays.has(date.toISOString().slice(0,10))){const a=(stamp-first)/ganttDay*unit,b=a+unit;stops.push(`transparent ${a}%, var(--moum-gantt-offday, #e9eeeb) ${a}%, var(--moum-gantt-offday, #e9eeeb) ${b}%, transparent ${b}%`);}}
      this.shadeKey=key;this.shadeValue=stops.length?`linear-gradient(to right, ${stops.join(', ')})`:'';
    }
    if(this.shadeValue){track.style.backgroundImage=this.shadeValue;track.style.backgroundSize='100% 100%';}
  }
  setTasks(tasks) { this.active(); this.model.setTasks(tasks); this.selected = null; this.collapsed.clear(); this.render(); }
  updateTask(id, patch) { this.active(); this.model.updateTask(id, patch); this.changed('update', String(id)); }
  addTask(task) { this.active(); this.model.addTask(task); this.changed('add', String(task.id)); }
  scheduleDependencies() { this.active(); this.model.scheduleDependencies(); this.changed('schedule'); }
  removeTask(id) { this.active(); this.model.removeTask(id); if (this.selected === String(id)) this.selected = null; this.changed('remove', String(id)); }
  setScale(scale) { this.active(); if (!ganttScales[scale]) throw new Error('scale은 day/week/month입니다.'); this.options.scale = scale; this.render(); }
  setView(view) { this.active();if(!['full','mini'].includes(view))throw new TypeError('view는 full 또는 mini입니다.');this.options.view=view;this.render(); }
  setMiniType(type) { this.active();const overrides={...this.miniOverrides,type},next=miniGanttOptions(overrides);this.miniOverrides=overrides;this.options.mini=next;this.render(); }
  getSummary() { return ganttSummary(this.model.tasks); }
  setRange(range) { this.active();const next=miniGanttRange(range);this.options.range=next;this.render(); }
  getRange() { if(this.options.range)return {...this.options.range};const tasks=this.model.tasks;if(!tasks.length)return null;return {start:tasks.reduce((d,t)=>t.start<d?t.start:d,tasks[0].start),end:tasks.reduce((d,t)=>t.end>d?t.end:d,tasks[0].end)}; }
  undo() { this.active(); if (this.model.undo()) this.changed('undo'); }
  redo() { this.active(); if (this.model.redo()) this.changed('redo'); }
  changed(type, id) { this.render(); this.options.onChange?.({ type, id, tasks: this.getTasks(), warnings: this.getWarnings() }); }
  attempt(action) { try { action(); } catch (error) { this.status.textContent = error.message; this.status.setAttribute('role', 'alert'); this.options.onError?.(error); } }
  visibleTasks() {
    const rows = [], tasks = this.model.tasks;
    const walk = (parent, depth) => { for (const task of tasks.filter(t => t.parentId === parent)) { rows.push({ ...task, depth }); if (!this.collapsed.has(task.id)) walk(task.id, depth + 1); } }; walk(null, 0); return rows;
  }
  selectTask(id) { this.active();id=String(id);const task=this.getTasks().find(t=>t.id===id);if(!task)throw new Error('작업을 찾을 수 없습니다.');this.selected = id; this.render(); this.options.onSelect?.(task); }
  render() {
    const oldScroll = this.scroll ? { left: this.scroll.scrollLeft, top: this.scroll.scrollTop } : null;
    this.cancelDrag?.(); this.root.replaceChildren();
    this.root.classList.toggle('moum-gantt-mini',this.options.view==='mini');
    this.root.classList.toggle('moum-gantt-mini--no-labels',this.options.view==='mini'&&!this.options.mini.labels);
    this.root.classList.toggle('moum-gantt-mini--compact',this.options.view==='mini'&&this.options.mini.type==='compact');
    if(this.options.view==='mini'){this.scroll=null;this.renderMini();return;}
    const toolbar = ganttEl('div', null, 'moum-gantt-toolbar');
    const scaleLabel = ganttEl('label', '시간 단위 '), scale = ganttEl('select'); scale.setAttribute('aria-label', '시간 단위'); for (const [value, label] of Object.entries({ day: '일', week: '주', month: '월' })) { const o = ganttEl('option', label); o.value = value; scale.append(o); } scale.value = this.options.scale; scale.addEventListener('change', () => this.setScale(scale.value)); scaleLabel.append(scale); toolbar.append(scaleLabel);
    if (this.options.editable) for (const [label, action, disabled] of [['되돌리기', () => this.undo(), !this.model.past.length], ['다시 실행', () => this.redo(), !this.model.future.length]]) { const b = ganttEl('button', label); b.type = 'button'; b.disabled = disabled; b.addEventListener('click', action); toolbar.append(b); }
    if(this.options.editable){const b=ganttEl('button','선행 일정 맞추기');b.type='button';b.addEventListener('click',()=>this.attempt(()=>this.scheduleDependencies()));toolbar.append(b);}
    this.root.append(toolbar);
    if(this.model.workCalendar)this.root.append(ganttEl('p','업무일 달력 · 음영은 주말·휴일입니다. 선행 일정 맞추기는 업무일 수를 유지합니다.','moum-gantt-calendar-info'));
    this.status = ganttEl('p', this.getWarnings().map(w => w.message).join(' ') || '작업을 선택해 날짜와 진행률을 확인하세요.', 'moum-gantt-status'); this.status.setAttribute('aria-live', 'polite');
    if (!this.model.tasks.length) { this.root.append(ganttEl('p', '표시할 작업이 없습니다. tasks 데이터로 작업을 추가하세요.', 'moum-gantt-empty'), this.status); return; }
    const tasks = this.visibleTasks(), all = this.model.tasks;
    const first = Math.min(...all.map(t => ganttDate(t.start))) - ganttDay * 2, last = Math.max(...all.map(t => ganttDate(t.end))) + ganttDay * 3;
    const days = Math.round((last - first) / ganttDay), dayWidth = ganttScales[this.options.scale], width = Math.max(400, days * dayWidth), rowHeight = 48, listWidth = 230;
    const scroll = ganttEl('div', null, 'moum-gantt-scroll'); this.scroll = scroll; scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', '작업 목록과 일정표, 가로 스크롤 가능');
    const canvas = ganttEl('div', null, 'moum-gantt-canvas'); canvas.style.width = `${listWidth + width}px`;
    const header = ganttEl('div', null, 'moum-gantt-header'); header.style.height = `${rowHeight}px`; const headName = ganttEl('div', '작업 · 진행률', 'moum-gantt-name'); header.append(headName);
    const ticks = ganttEl('div', null, 'moum-gantt-ticks'); ticks.style.width = `${width}px`;
    for (let day = 0; day < days; day++) {
      const date = new Date(first + day * ganttDay), value = date.toISOString().slice(0, 10), weekday = date.getUTCDay();
      if (this.options.scale === 'day' || (this.options.scale === 'week' ? weekday === 1 : date.getUTCDate() === 1) || day === 0) { const tick = ganttEl('span', this.options.scale === 'month' ? value.slice(0, 7) : value.slice(5)); tick.style.left = `${day * dayWidth}px`; ticks.append(tick); }
    }
    header.append(ticks); canvas.append(header);
    const content = ganttEl('div', null, 'moum-gantt-body'); content.style.height = `${tasks.length * rowHeight}px`;
    const coordinates = new Map();
    tasks.forEach((task, rowIndex) => {
      const row = ganttEl('div', null, 'moum-gantt-row'); row.style.height = `${rowHeight}px`; if (task.id === this.selected) row.classList.add('is-selected');
      const name = ganttEl('div', null, 'moum-gantt-name'); name.style.paddingLeft = `${12 + Math.min(task.depth, 6) * 16}px`;
      if (all.some(t => t.parentId === task.id)) { const toggle = ganttEl('button', this.collapsed.has(task.id) ? '+' : '−', 'moum-gantt-toggle'); toggle.type = 'button'; toggle.setAttribute('aria-label', `${task.name} 하위 작업`); toggle.setAttribute('aria-expanded', String(!this.collapsed.has(task.id))); toggle.addEventListener('click', () => { if (this.collapsed.has(task.id)) this.collapsed.delete(task.id); else this.collapsed.add(task.id); this.render(); }); name.append(toggle); }
      const choose = ganttEl('button', `${task.name} · ${task.progress}%`, 'moum-gantt-task-name'); choose.type = 'button'; choose.title = task.name; choose.addEventListener('click', () => this.selectTask(task.id)); name.append(choose); row.append(name);
      const lane = ganttEl('div', null, 'moum-gantt-lane'); lane.style.width = `${width}px`; lane.style.backgroundSize = `${dayWidth}px 100%`;
      this.shadeWorkdays(lane,first,last,dayWidth/width*100);
      const x = (ganttDate(task.start) - first) / ganttDay * dayWidth, barWidth = (ganttDate(task.end) - ganttDate(task.start) + ganttDay) / ganttDay * dayWidth;
      const bar = ganttEl('button', null, 'moum-gantt-bar'); bar.type = 'button'; bar.dataset.taskId = task.id; bar.style.left = `${x}px`; bar.style.width = `${Math.max(16, barWidth)}px`;
      bar.setAttribute('aria-label', `${task.name}, ${task.start} ~ ${task.end}, ${task.progress}%. 방향키 날짜 이동, Alt+방향키 종료일 변경`);
      const progress = ganttEl('span', null, 'moum-gantt-progress'); progress.style.width = `${task.progress}%`; bar.append(progress, ganttEl('span', task.name, 'moum-gantt-bar-label')); if (task.type === 'milestone') { bar.classList.add('is-milestone'); bar.textContent = '◆'; }
      bar.addEventListener('click', () => { if (!this.suppressClick) this.selectTask(task.id); });
      if (this.options.editable) {
        bar.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); const shift = event.key === 'ArrowLeft' ? -1 : 1; this.attempt(() => { this.updateTask(task.id, event.altKey && task.type !== 'milestone' ? { end: shiftGanttDate(task.end, shift) } : { start: shiftGanttDate(task.start, shift), end: shiftGanttDate(task.end, shift) }); this.root.querySelector(`[data-task-id="${CSS.escape(task.id)}"]`)?.focus(); }); });
        bar.addEventListener('pointerdown', event => this.startDrag(event, task, dayWidth, false));
        if (task.type !== 'milestone') { const resize = ganttEl('span', null, 'moum-gantt-resize'); resize.title = '종료일 조절 (키보드: Alt+방향키)'; resize.addEventListener('pointerdown', event => { event.stopPropagation(); this.startDrag(event, task, dayWidth, true); }); bar.append(resize); }
      }
      lane.append(bar); row.append(lane); content.append(row); coordinates.set(task.id, { x, end: x + barWidth, y: rowIndex * rowHeight + rowHeight / 2 });
    });
    const lines = ganttSvg('svg', { width, height: tasks.length * rowHeight, class: 'moum-gantt-links', 'aria-hidden': 'true' }); lines.style.left = `${listWidth}px`;
    const defs = ganttSvg('defs', {}), marker = ganttSvg('marker', { id: `moum-gantt-arrow-${this.sequence}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }); marker.append(ganttSvg('path', { d: 'M0 0 L10 5 L0 10 Z', fill: 'currentColor' })); defs.append(marker); lines.append(defs);
    tasks.forEach(task => task.dependencies.forEach(dep => { const a = coordinates.get(dep), b = coordinates.get(task.id); if (!a || !b) return; const elbow = Math.max(a.end + 10, b.x - 10); lines.append(ganttSvg('path', { d: `M${a.end},${a.y} H${elbow} V${b.y} H${b.x}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'marker-end': `url(#moum-gantt-arrow-${this.sequence})` })); }));
    content.append(lines); canvas.append(content); scroll.append(canvas); this.root.append(scroll, this.status);
    if (oldScroll) { scroll.scrollLeft = oldScroll.left; scroll.scrollTop = oldScroll.top; }
    const selected = this.model.tasks.find(t => t.id === this.selected); if (selected) this.renderEditor(selected);
  }
  renderMini() {
    const options=this.options.mini,range=this.getRange();this.root.dataset.miniType=options.type;
    if(options.header){const header=ganttEl('div',null,'moum-gantt-mini-header');header.append(ganttEl('strong',this.options.title||'작업 일정'));if(range)header.append(ganttEl('span',`${range.start} ~ ${range.end}`));this.root.append(header);}
    this.status=ganttEl('p',this.getWarnings().length?`선행 일정 충돌 ${this.getWarnings().length}건`:'작업을 선택하면 일정과 진행률을 확인할 수 있습니다.','moum-gantt-status');this.status.setAttribute('role','status');
    if(!this.model.tasks.length){this.root.append(ganttEl('p','표시할 작업이 없습니다.','moum-gantt-empty'));if(options.status)this.root.append(this.status);return;}
    const first=ganttDate(range.start),last=ganttDate(range.end)+ganttDay,total=last-first,list=ganttEl('div',null,'moum-gantt-mini-list');
    if(options.type==='summary'){
      const summary=this.getSummary(),row=ganttEl('div',null,'moum-gantt-mini-row');if(options.labels)row.append(ganttEl('span','전체 진행','moum-gantt-mini-name'));
      const track=ganttEl('div',null,'moum-gantt-mini-track');track.setAttribute('role','progressbar');track.setAttribute('aria-label',`전체 ${summary.taskCount}개 말단 작업, 마일스톤 ${summary.milestoneCount}개 진행률`);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(summary.progress));track.title=`${summary.start} ~ ${summary.end} · ${summary.progress}%`;
      this.shadeWorkdays(track,first,last,ganttDay/total*100);
      const start=ganttDate(summary.start),end=ganttDate(summary.end)+ganttDay,a=Math.max(start,first),b=Math.min(end,last);
      if(b>a){const bar=ganttEl('span',null,'moum-gantt-mini-bar');bar.style.left=`${(a-first)/total*100}%`;bar.style.width=`${(b-a)/total*100}%`;const fill=ganttEl('span',null,'moum-gantt-mini-progress');fill.style.width=`${Math.max(0,Math.min(1,(start+(end-start)*summary.progress/100-a)/(b-a)))*100}%`;bar.append(fill,ganttEl('span',`${summary.progress}%`,'moum-gantt-mini-progress-text'));track.append(bar);}else track.append(ganttEl('span','범위 밖','moum-gantt-mini-outside'));
      row.append(track);list.append(row);this.root.append(list);if(options.status){this.status.textContent=`작업 ${summary.taskCount}개 · 마일스톤 ${summary.milestoneCount}개 · 기간 가중 진행률 ${summary.progress}%`;this.root.append(this.status);}return;
    }
    const tasks=options.type==='milestones'?this.model.tasks.filter(t=>t.type==='milestone'):this.model.tasks;
    if(!tasks.length)list.append(ganttEl('p','표시할 마일스톤이 없습니다.','moum-gantt-empty'));
    for(const task of tasks){
      const row=ganttEl('div',null,'moum-gantt-mini-row');if(options.labels){const name=ganttEl('span',task.name,'moum-gantt-mini-name');name.title=task.name;row.append(name);}
      const start=ganttDate(task.start),end=ganttDate(task.end)+ganttDay,visible=end>first&&start<last,track=ganttEl('button',null,'moum-gantt-mini-track');track.type='button';track.dataset.miniTask=task.id;track.disabled=!visible;track.setAttribute('aria-pressed',String(this.selected===task.id));track.setAttribute('aria-label',`${task.name}, ${task.start} ~ ${task.end}, 진행률 ${task.progress}%${visible?'':', 표시 범위 밖'}`);track.title=track.getAttribute('aria-label');
      this.shadeWorkdays(track,first,last,ganttDay/total*100);
      if(visible){const bar=ganttEl('span',null,'moum-gantt-mini-bar');bar.setAttribute('aria-hidden','true');
        if(task.type==='milestone'){bar.classList.add('is-milestone');bar.textContent='◆';bar.style.left=`calc(${((start+ganttDay/2-first)/total)*100}% - 7px)`;}
        else {const a=Math.max(start,first),b=Math.min(end,last);bar.style.left=`${(a-first)/total*100}%`;bar.style.width=`${(b-a)/total*100}%`;const progress=ganttEl('span',null,'moum-gantt-mini-progress'),completed=start+(end-start)*task.progress/100;progress.style.width=`${Math.max(0,Math.min(1,(completed-a)/(b-a)))*100}%`;bar.append(progress,ganttEl('span',`${task.progress}%`,'moum-gantt-mini-progress-text'));}
        track.append(bar);
      }else track.append(ganttEl('span','범위 밖','moum-gantt-mini-outside'));
      track.addEventListener('click',()=>this.attempt(()=>{this.selectTask(task.id);[...this.root.querySelectorAll('[data-mini-task]')].find(e=>e.dataset.miniTask===task.id)?.focus();const selected=this.getTasks().find(t=>t.id===task.id);this.status.textContent=`${selected.name} · ${selected.start} ~ ${selected.end} · ${selected.progress}%`; }));
      row.append(track);list.append(row);
    }
    this.root.append(list);if(options.status)this.root.append(this.status);
  }
  startDrag(event, task, dayWidth, resize) {
    if (event.button !== 0) return;
    const startX = event.clientX, bar = event.currentTarget.closest('.moum-gantt-bar'), initial = parseFloat(bar.style.left), width = parseFloat(bar.style.width); let delta = 0;
    const move = e => { delta = Math.round((e.clientX - startX) / dayWidth); if (resize) bar.style.width = `${Math.max(16, width + delta * dayWidth)}px`; else bar.style.left = `${initial + delta * dayWidth}px`; };
    const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); this.cancelDrag = null; };
    const cancel = () => { cleanup(); this.render(); };
    const up = () => { cleanup(); if (delta) { this.suppressClick = true; this.render(); this.attempt(() => this.updateTask(task.id, resize ? { end: shiftGanttDate(task.end, delta) } : { start: shiftGanttDate(task.start, delta), end: shiftGanttDate(task.end, delta) })); setTimeout(() => { this.suppressClick = false; }, 0); } };
    this.cancelDrag?.(); this.cancelDrag = cleanup; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true }); window.addEventListener('pointercancel', cancel, { once: true });
  }
  renderEditor(task) {
    const form = ganttEl('form', null, 'moum-gantt-editor'); form.append(ganttEl('strong', task.name)); const inputs = {};
    for (const [key, label, type] of [['start', '시작일', 'date'], ['end', '종료일', 'date'], ['progress', '진행률 (%)', 'number']]) { const wrap = ganttEl('label', label), input = ganttEl('input'); input.type = type; input.value = task[key]; input.required = true; input.disabled = !this.options.editable; if (key === 'progress') { input.min = 0; input.max = 100; } wrap.append(input); form.append(wrap); inputs[key] = input; }
    if (this.options.editable) { const save = ganttEl('button', '변경 적용'); save.type = 'submit'; form.append(save); form.addEventListener('submit', e => { e.preventDefault(); this.attempt(() => this.updateTask(task.id, { start: inputs.start.value, end: inputs.end.value, progress: Number(inputs.progress.value) })); }); }
    this.root.append(form);
  }
  destroy() { if (this.destroyed) return; this.cancelDrag?.(); this.destroyed = true; this.root.remove(); }
}

globalThis.MoumGantt = Gantt;
Object.assign(globalThis.MoumGantt, { ganttDay, ganttDate, shiftGanttDate, normalizeWorkCalendar, isGanttWorkday, ganttWorkingDays, ganttSummary, normalizeTasks, GanttModel });
})();
