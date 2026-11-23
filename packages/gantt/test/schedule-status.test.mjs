import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GanttModel } from '../src/model.js';

const task = { id: 'receipt', start: '2026-11-23', end: '2026-11-25', deadline: '2026-11-26' };

test('date variance and open overdue report preserve signed calendar days', () => {
  const model = new GanttModel([
    { ...task, baseline: { start: '2026-11-24', end: '2026-11-24' } },
    { ...task, id: 'complete', progress: 100, end: '2026-11-27' },
    { ...task, id: 'untracked', deadline: null }
  ]);
  assert.deepEqual(model.getScheduleStatus({ asOf: '2026-11-27' }), [
    { id: 'receipt', startVarianceDays: -1, finishVarianceDays: 1, deadlineVarianceDays: -1, overdue: true },
    { id: 'complete', startVarianceDays: null, finishVarianceDays: null, deadlineVarianceDays: 1, overdue: false },
    { id: 'untracked', startVarianceDays: null, finishVarianceDays: null, deadlineVarianceDays: null, overdue: false }
  ]);
  assert.equal(model.getScheduleStatus({ asOf: '2026-11-26' })[0].overdue, false);
  assert.equal(model.getScheduleStatus()[0].overdue, false);
});

test('baseline capture is one undoable edit and scheduling leaves baseline and deadline intact', () => {
  const model = new GanttModel([
    { id: 'order', start: '2026-11-20', end: '2026-11-24' },
    { ...task, dependencies: ['order'] }
  ]);
  assert.equal(model.captureBaseline(), true);
  assert.equal(model.captureBaseline(), false);
  const original = model.getTasks();
  model.scheduleDependencies();
  assert.deepEqual(model.getTasks()[1].baseline, { start: '2026-11-23', end: '2026-11-25' });
  assert.equal(model.getScheduleStatus()[1].deadlineVarianceDays, 1);
  model.undo();
  assert.deepEqual(model.getTasks(), original);
  model.undo();
  assert.equal(model.getTasks()[1].baseline, undefined);
  model.redo();
  assert.deepEqual(model.getTasks(), original);
});

test('invalid schedule metadata is rejected atomically and can be cleared', () => {
  const model = new GanttModel([task]);
  model.captureBaseline();
  const before = model.getTasks();
  assert.throws(() => model.updateTask('receipt', { deadline: '2026-02-30' }));
  assert.throws(() => model.updateTask('receipt', { baseline: { start: '2026-11-25', end: '2026-11-23' } }));
  assert.throws(() => model.getScheduleStatus({ asOf: 'today' }));
  assert.deepEqual(model.getTasks(), before);
  model.updateTask('receipt', { baseline: null, deadline: null });
  assert.equal(model.getScheduleStatus()[0].finishVarianceDays, null);
  assert.equal(model.getScheduleStatus()[0].deadlineVarianceDays, null);
});
