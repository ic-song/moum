import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GanttModel } from '../src/model.js';

const task = (id, start, end, dependencies) => ({ id, start: '2026-11-' + start, end: '2026-11-' + end, dependencies });

test('FS, SS, FF and SF honor lag and duration, support combined bounds and undo as one edit', () => {
  const tasks = [
    task('a', '16', '18'),
    task('fs', '16', '17', [{ taskId: 'a', type: 'FS', lagDays: 2 }]),
    task('ss', '16', '16', [{ taskId: 'a', type: 'SS', lagDays: 1 }]),
    task('ff', '16', '17', [{ taskId: 'a', type: 'FF', lagDays: 2 }]),
    task('sf', '15', '16', [{ taskId: 'a', type: 'SF', lagDays: 2 }]),
    task('chain', '16', '17', ['ss', { taskId: 'ff', type: 'FF' }])
  ];
  const model = new GanttModel(tasks);
  assert.equal(model.getWarnings().length, 5);
  const before = model.getTasks();
  const result = model.scheduleDependencies();
  assert.deepEqual(result.map(t => [t.start.slice(-2), t.end.slice(-2)]), [['16','18'], ['21','22'], ['17','17'], ['19','20'], ['17','18'], ['19','20']]);
  assert.equal(model.getWarnings().length, 0);
  assert.equal(model.undo(), true);
  assert.deepEqual(model.getTasks(), before);
});

test('workday lag and finish alignment skip weekends and a holiday', () => {
  const model = new GanttModel([
    task('a', '20', '20'),
    task('fs', '19', '20', [{ taskId: 'a', type: 'FS', lagDays: 1 }]),
    task('ff', '19', '20', [{ taskId: 'a', type: 'FF', lagDays: 1 }])
  ], { workCalendar: { holidays: ['2026-11-23'] } });
  const [, fs, ff] = model.scheduleDependencies();
  assert.deepEqual([fs.start, fs.end], ['2026-11-25', '2026-11-26']);
  assert.deepEqual([ff.start, ff.end], ['2026-11-20', '2026-11-24']);
  assert.equal(model.getWarnings().length, 0);
});

test('dependency mutations reject invalid references and cycles atomically and remove object links', () => {
  const model = new GanttModel([task('a','16','18'), task('b','17','17',[{ taskId:'a',type:'SS' }])]);
  const before = model.getTasks();
  assert.throws(() => model.updateTask('a', { dependencies: ['b'] }), /순환/);
  assert.throws(() => model.updateTask('b', { dependencies: [{taskId:'none',type:'FF'}] }), /찾을 수 없습니다/);
  assert.throws(() => model.updateTask('b', { dependencies: [{taskId:'a',lagDays:-1}] }));
  assert.deepEqual(model.getTasks(), before);
  assert.deepEqual(model.removeTask('a')[0].dependencies, []);
});
