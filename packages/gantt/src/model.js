export const ganttDay = 86400000;
export function ganttDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('날짜는 YYYY-MM-DD 형식이어야 합니다.');
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new RangeError(`올바르지 않은 날짜: ${value}`);
  return ms;
}
export function shiftGanttDate(value, days) { return new Date(ganttDate(value) + days * ganttDay).toISOString().slice(0, 10); }
export function normalizeWorkCalendar(calendar) {
  if(calendar==null)return null;
  if(typeof calendar!=='object'||Array.isArray(calendar)||!Array.isArray(calendar.weekendDays??[])||!Array.isArray(calendar.holidays??[]))throw new TypeError('workCalendar의 weekendDays와 holidays는 배열입니다.');
  const weekendDays=[...new Set(calendar.weekendDays??[0,6])],holidays=[...new Set(calendar.holidays??[])];
  if(weekendDays.length>6||weekendDays.some(n=>!Number.isInteger(n)||n<0||n>6)||holidays.length>10000)throw new RangeError('주말은 0~6이며 최소 하루는 업무일이어야 합니다. 휴일은 최대10,000개입니다.');
  holidays.forEach(ganttDate);return {weekendDays,holidays};
}
function workStamp(stamp,calendar) { return !calendar||(!calendar.weekendDays.includes(new Date(stamp).getUTCDay())&&!calendar.holidays.includes(new Date(stamp).toISOString().slice(0,10))); }
export function isGanttWorkday(date, calendar) { return workStamp(ganttDate(date),normalizeWorkCalendar(calendar)); }
export function ganttWorkingDays(start,end,calendar) {
  calendar=normalizeWorkCalendar(calendar);const a=ganttDate(start),b=ganttDate(end);if(b<a||b-a>3650*ganttDay)throw new RangeError('업무일 계산 범위는 최대10년입니다.');
  let count=0;for(let n=a;n<=b;n+=ganttDay)if(workStamp(n,calendar))count++;return count;
}
const firstGanttStamp = ganttDate('0000-01-01'), lastGanttStamp = ganttDate('9999-12-31');
function stepWorkStamp(stamp, calendar, direction = 1) {
  for (let i = 0; i <= 36600 && stamp >= firstGanttStamp && stamp <= lastGanttStamp; i++, stamp += direction * ganttDay) {
    if (workStamp(stamp, calendar)) return stamp;
  }
  throw new RangeError('계산 가능한 업무일 범위를 초과했습니다.');
}
function moveWorkDays(stamp, days, calendar, direction = 1) {
  if (!calendar) return stamp + days * ganttDay * direction;
  for (let i = 0; i < days; i++) stamp = stepWorkStamp(stamp + direction * ganttDay, calendar, direction);
  return stamp;
}
const dependencyTypes = ['FS', 'SS', 'FF', 'SF'];
function dependencyInfo(link) {
  return typeof link === 'string' ? { taskId: link, type: 'FS', lagDays: 0 } : link;
}
function normalizeDependencies(links = []) {
  const result = new Map();
  for (const link of links) {
    const object = link !== null && typeof link === 'object' && !Array.isArray(link);
    const rawId = object ? link.taskId : link;
    if (!['string', 'number'].includes(typeof rawId) || String(rawId) === '') throw new TypeError('선행 작업 ID가 필요합니다.');
    const taskId = String(rawId), type = object ? link.type ?? 'FS' : 'FS';
    const lagDays = object ? link.lagDays ?? 0 : 0;
    if (!dependencyTypes.includes(type) || !Number.isInteger(lagDays) || lagDays < 0 || lagDays > 3650) {
      throw new RangeError('연결 유형은 FS/SS/FF/SF이며 대기일은 0~3650 정수입니다.');
    }
    const key = JSON.stringify([taskId, type]);
    const existing = result.get(key);
    if (existing && dependencyInfo(existing).lagDays !== lagDays) throw new Error('같은 선행 작업과 관계 유형에 대기일이 중복됐습니다.');
    if (!existing) result.set(key, object ? { taskId, type, lagDays } : taskId);
  }
  return [...result.values()];
}
function dependencyDate(predecessor, type, lagDays, calendar) {
  const anchor = ganttDate(type[0] === 'F' ? predecessor.end : predecessor.start);
  return moveWorkDays(anchor, lagDays + (type === 'FS' ? 1 : 0), calendar);
}
export function ganttSummary(tasks) {
  const data=normalizeTasks(tasks);if(!data.length)return null;
  const parents=new Set(data.map(t=>t.parentId).filter(id=>id!==null)),leaves=data.filter(t=>!parents.has(t.id)),work=leaves.filter(t=>t.type!=='milestone'),weighted=work.length?work:leaves;
  let weight=0,completed=0;for(const task of weighted){const days=work.length?(ganttDate(task.end)-ganttDate(task.start))/ganttDay+1:1;weight+=days;completed+=days*task.progress;}
  return {start:data.reduce((d,t)=>t.start<d?t.start:d,data[0].start),end:data.reduce((d,t)=>t.end>d?t.end:d,data[0].end),progress:Math.round(completed/weight*100)/100,taskCount:work.length,milestoneCount:leaves.filter(t=>t.type==='milestone').length};
}
export function normalizeTasks(tasks) {
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
    const baseline = t.baseline;
    if (baseline != null && (typeof baseline !== 'object' || Array.isArray(baseline)
        || ganttDate(baseline.end) < ganttDate(baseline.start))) throw new RangeError('올바른 기준 일정의 시작일과 종료일이 필요합니다.');
    if (t.deadline != null) ganttDate(t.deadline);
    return { id, name: String(t.name ?? id), start: t.start, end: t.end, progress: t.progress ?? 0, dependencies: normalizeDependencies(t.dependencies ?? []), parentId: t.parentId == null ? null : String(t.parentId), type: t.type || 'task',
      ...(baseline != null ? { baseline: { start: baseline.start, end: baseline.end } } : {}),
      ...(t.deadline != null ? { deadline: t.deadline } : {}) };
  });
  const byId = new Map(result.map(t => [t.id, t]));
  for (const task of result) {
    if (task.parentId !== null && !ids.has(task.parentId)) throw new Error(`상위 작업을 찾을 수 없습니다: ${task.parentId}`);
    for (const link of task.dependencies) {
      const { taskId } = dependencyInfo(link);
      if (!ids.has(taskId)) throw new Error(`선행 작업을 찾을 수 없습니다: ${taskId}`);
    }
  }
  const checkCycles = edges => {
    const visiting = new Set(), done = new Set();
    function visit(id) { if (visiting.has(id)) throw new Error('작업 관계에 순환이 있습니다.'); if (done.has(id)) return; visiting.add(id); for (const next of edges(byId.get(id))) visit(next); visiting.delete(id); done.add(id); }
    for (const task of result) visit(task.id);
  };
  checkCycles(t => t.dependencies.map(link => dependencyInfo(link).taskId)); checkCycles(t => t.parentId === null ? [] : [t.parentId]);
  if (result.length) {
    const starts = result.map(t => ganttDate(t.start)), ends = result.map(t => ganttDate(t.end));
    if (Math.max(...ends) - Math.min(...starts) > ganttDay * 3650) throw new RangeError('표시 기간은 최대 10년입니다.');
  }
  return result;
}
export class GanttModel {
  constructor(tasks = [], options = {}) { this.workCalendar=normalizeWorkCalendar(options.workCalendar);this.tasks = normalizeTasks(tasks); this.past = []; this.future = []; }
  getTasks() { return structuredClone(this.tasks); }
  commit(tasks) { const next = normalizeTasks(tasks); this.past.push(this.getTasks()); if (this.past.length > 50) this.past.shift(); this.future = []; this.tasks = next; return this.getTasks(); }
  setTasks(tasks) { this.tasks = normalizeTasks(tasks); this.past = []; this.future = []; }
  updateTask(id, patch) { if (!this.tasks.some(t => t.id === String(id))) throw new Error('작업을 찾을 수 없습니다.'); if (patch.id != null && String(patch.id) !== String(id)) throw new Error('작업 id는 변경할 수 없습니다.'); return this.commit(this.tasks.map(t => t.id === String(id) ? { ...t, ...patch } : t)); }
  addTask(task) { return this.commit([...this.tasks, task]); }
  captureBaseline() {
    if (this.tasks.every(task => task.baseline?.start === task.start && task.baseline?.end === task.end)) return false;
    this.commit(this.tasks.map(task => ({ ...task, baseline: { start: task.start, end: task.end } })));
    return true;
  }
  getScheduleStatus({ asOf } = {}) {
    const reportDate = asOf === undefined ? null : ganttDate(asOf);
    const daysBetween = (date, reference) => (ganttDate(date) - ganttDate(reference)) / ganttDay;
    return this.tasks.map(task => {
      const { id, start, end, baseline, deadline, progress } = task;
      return {
        id,
        startVarianceDays: baseline ? daysBetween(start, baseline.start) : null,
        finishVarianceDays: baseline ? daysBetween(end, baseline.end) : null,
        deadlineVarianceDays: deadline ? daysBetween(end, deadline) : null,
        overdue: deadline != null && reportDate != null && progress < 100 && reportDate > ganttDate(deadline)
      };
    });
  }
  scheduleDependencies() {
    const tasks = this.getTasks(), byId = new Map(tasks.map(task => [task.id, task])), done = new Set();
    const calendar = this.workCalendar;
    const visit = id => {
      if (done.has(id)) return;
      const task = byId.get(id);
      let start = ganttDate(task.start), finishBound = -Infinity;
      const span = calendar ? Math.max(1, ganttWorkingDays(task.start, task.end, calendar)) - 1 : (ganttDate(task.end) - start) / ganttDay;
      for (const link of task.dependencies) {
        const { taskId, type, lagDays } = dependencyInfo(link);
        visit(taskId);
        const bound = dependencyDate(byId.get(taskId), type, lagDays, calendar);
        if (type[1] === 'S') start = Math.max(start, bound);
        else finishBound = Math.max(finishBound, bound);
      }
      if (finishBound !== -Infinity) {
        const firstFinish = calendar ? stepWorkStamp(finishBound, calendar) : finishBound;
        start = Math.max(start, moveWorkDays(firstFinish, span, calendar, -1));
      }
      if (calendar) start = stepWorkStamp(start, calendar);
      const end = moveWorkDays(start, span, calendar);
      if (start > lastGanttStamp || end > lastGanttStamp) throw new RangeError('계산 가능한 일정 범위를 초과했습니다.');
      task.start = new Date(start).toISOString().slice(0, 10);
      task.end = new Date(end).toISOString().slice(0, 10);
      done.add(id);
    };
    for(const task of tasks)visit(task.id);
    if(tasks.some((t,i)=>t.start!==this.tasks[i].start||t.end!==this.tasks[i].end))return this.commit(tasks);
    return this.getTasks();
  }
  removeTask(id) { id = String(id); if (!this.tasks.some(t => t.id === id)) throw new Error('작업을 찾을 수 없습니다.'); if (this.tasks.some(t => t.parentId === id)) throw new Error('하위 작업을 먼저 삭제하세요.'); return this.commit(this.tasks.filter(t => t.id !== id).map(t => ({ ...t, dependencies: t.dependencies.filter(link => dependencyInfo(link).taskId !== id) }))); }
  undo() { if (!this.past.length) return false; this.future.push(this.getTasks()); this.tasks = this.past.pop(); return true; }
  redo() { if (!this.future.length) return false; this.past.push(this.getTasks()); this.tasks = this.future.pop(); return true; }
  getWarnings() {
    const byId = new Map(this.tasks.map(task => [task.id, task]));
    return this.tasks.flatMap(task => task.dependencies.flatMap(link => {
      const { taskId, type, lagDays } = dependencyInfo(link), predecessor = byId.get(taskId);
      const date = ganttDate(type[1] === 'S' ? task.start : task.end);
      // Legacy FS warnings remain a calendar ordering check.
      const calendar = typeof link === 'string' ? null : this.workCalendar;
      let bound;
      try { bound = dependencyDate(predecessor, type, lagDays, calendar); }
      catch (error) { return [{ taskId: task.id, predecessorId: taskId, message: `${task.name}: ${error.message}` }]; }
      if (date >= bound) return [];
      const message = typeof link === 'string'
        ? `${task.name}: 선행 작업 ${predecessor.name} 종료 다음 날 이후에 시작해야 합니다.`
        : `${task.name}: 선행 작업 ${predecessor.name}의 ${type} 관계(대기 ${lagDays}일)를 확인하세요.`;
      return [{ taskId: task.id, predecessorId: taskId, message }];
    }));
  }
}
