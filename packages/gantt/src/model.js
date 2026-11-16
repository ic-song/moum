export const ganttDay = 86400000;
export function ganttDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('날짜는 YYYY-MM-DD 형식이어야 합니다.');
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new RangeError(`올바르지 않은 날짜: ${value}`);
  return ms;
}
export function shiftGanttDate(value, days) { return new Date(ganttDate(value) + days * ganttDay).toISOString().slice(0, 10); }
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
export class GanttModel {
  constructor(tasks = []) { this.tasks = normalizeTasks(tasks); this.past = []; this.future = []; }
  getTasks() { return structuredClone(this.tasks); }
  commit(tasks) { const next = normalizeTasks(tasks); this.past.push(this.getTasks()); if (this.past.length > 50) this.past.shift(); this.future = []; this.tasks = next; return this.getTasks(); }
  setTasks(tasks) { this.tasks = normalizeTasks(tasks); this.past = []; this.future = []; }
  updateTask(id, patch) { if (!this.tasks.some(t => t.id === String(id))) throw new Error('작업을 찾을 수 없습니다.'); if (patch.id != null && String(patch.id) !== String(id)) throw new Error('작업 id는 변경할 수 없습니다.'); return this.commit(this.tasks.map(t => t.id === String(id) ? { ...t, ...patch } : t)); }
  addTask(task) { return this.commit([...this.tasks, task]); }
  scheduleDependencies() {
    const tasks=this.getTasks(), byId=new Map(tasks.map(t=>[t.id,t])), done=new Set();
    const visit=id=>{if(done.has(id))return;const task=byId.get(id);for(const dep of task.dependencies)visit(dep);
      const required=Math.max(ganttDate(task.start),...task.dependencies.map(dep=>ganttDate(byId.get(dep).end)+ganttDay));
      if(required>ganttDate(task.start)){const duration=ganttDate(task.end)-ganttDate(task.start);task.start=new Date(required).toISOString().slice(0,10);task.end=new Date(required+duration).toISOString().slice(0,10);}done.add(id);};
    for(const task of tasks)visit(task.id);
    if(tasks.some((t,i)=>t.start!==this.tasks[i].start||t.end!==this.tasks[i].end))return this.commit(tasks);
    return this.getTasks();
  }
  removeTask(id) { id = String(id); if (!this.tasks.some(t => t.id === id)) throw new Error('작업을 찾을 수 없습니다.'); if (this.tasks.some(t => t.parentId === id)) throw new Error('하위 작업을 먼저 삭제하세요.'); return this.commit(this.tasks.filter(t => t.id !== id).map(t => ({ ...t, dependencies: t.dependencies.filter(d => d !== id) }))); }
  undo() { if (!this.past.length) return false; this.future.push(this.getTasks()); this.tasks = this.past.pop(); return true; }
  redo() { if (!this.future.length) return false; this.past.push(this.getTasks()); this.tasks = this.future.pop(); return true; }
  getWarnings() { const byId = new Map(this.tasks.map(t => [t.id, t])); return this.tasks.flatMap(t => t.dependencies.filter(d => byId.get(d).end >= t.start).map(d => ({ taskId: t.id, predecessorId: d, message: `${t.name}: 선행 작업 ${byId.get(d).name} 종료 다음 날 이후에 시작해야 합니다.` }))); }
}
