import {test} from 'node:test';import assert from 'node:assert/strict';
import {GanttModel,ganttWorkingDays,isGanttWorkday,normalizeWorkCalendar} from '../src/model.js';
const workCalendar={holidays:['2026-11-16']};
test('working calendar skips weekend/holiday, preserves inclusive work duration and atomic undo',()=>{
 const tasks=[{id:'a',start:'2026-11-13',end:'2026-11-13'},{id:'b',start:'2026-11-12',end:'2026-11-13',dependencies:['a']},{id:'m',type:'milestone',start:'2026-11-14',end:'2026-11-14',dependencies:['b']}];
 const model=new GanttModel(tasks,{workCalendar}),before=model.getTasks();
 assert.deepEqual(model.getTasks(),before);const result=model.scheduleDependencies();assert.equal(result[1].start,'2026-11-17');assert.equal(result[1].end,'2026-11-18');assert.equal(result[2].start,'2026-11-19');assert.equal(result[2].end,result[2].start);
 assert.equal(ganttWorkingDays('2026-11-13','2026-11-18',workCalendar),3);assert.equal(isGanttWorkday('2026-11-16',workCalendar),false);
 model.scheduleDependencies();assert.equal(model.past.length,1);assert.equal(model.undo(),true);assert.deepEqual(model.getTasks(),before);assert.equal(model.redo(),true);assert.deepEqual(model.getTasks(),result);
});
test('calendar default unchanged; custom weekend and zero-day tasks; validation',()=>{
 const task=[{id:'a',start:'2026-11-14',end:'2026-11-15'}];assert.deepEqual(new GanttModel(task).scheduleDependencies(),new GanttModel(task).getTasks());
 assert.equal(new GanttModel(task,{workCalendar:{}}).scheduleDependencies()[0].start,'2026-11-16');
 assert.equal(ganttWorkingDays('2024-02-28','2024-03-01',{weekendDays:[]}),3);
 assert.equal(isGanttWorkday('2026-11-15',{weekendDays:[5,6]}),true);
 for(const calendar of [{weekendDays:[0,1,2,3,4,5,6]},{weekendDays:'bad'},{holidays:['2026-02-30']},{weekendDays:[9]}])assert.throws(()=>normalizeWorkCalendar(calendar));
 assert.throws(()=>ganttWorkingDays('2026-11-15','2026-11-14',{}));
});
test('out of range schedule rejects without committing',()=>{const model=new GanttModel([{id:'a',start:'9999-12-31',end:'9999-12-31'},{id:'b',start:'9999-12-31',end:'9999-12-31',dependencies:['a']}],{workCalendar:{weekendDays:[]}}),before=model.getTasks();assert.throws(()=>model.scheduleDependencies());assert.deepEqual(model.getTasks(),before);assert.equal(model.past.length,0);});
