import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

for (const engine of [chromium, firefox, webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('examples/gantt/index.html')).href);
    await page.getByRole('button', { name: '발주·입고 기능 개발 · 35%', exact: true }).click();
    const report = JSON.parse(await page.locator('#result').textContent());
    assert.equal(report.schedule.finishVarianceDays, 2);
    assert.equal(report.schedule.deadlineVarianceDays, 1);
    assert.equal(report.schedule.overdue, true);
    const deliveryAndLinks = await page.evaluate(() => {
      const host = document.createElement('div');
      document.body.append(host);
      const gantt = new MoumGantt(host, { tasks: [
        { id: 'order', start: '2026-11-23', end: '2026-11-25' },
        { id: 'shipping', start: '2026-11-23', end: '2026-11-24', dependencies: [{ taskId: 'order', type: 'SS', lagDays: 1 }] }
      ] });
      const edge = host.querySelector('[data-dependency-type="SS"]');
      const lag = edge.getAttribute('data-lag-days');
      host.querySelector('.moum-gantt-toolbar button:last-child').click();
      const shipping = gantt.getTasks().find(task => task.id === 'shipping');
      const receipts = MoumGantt.summarizeDeliveries([{ id: 'split-1', dueDate: '2026-11-24', quantity: 100 }], [
        { id: 'dock-1', lineId: 'split-1', date: '2026-11-23', quantity: 40 },
        { id: 'dock-2', lineId: 'split-1', date: '2026-11-25', quantity: 10 }
      ], { asOf: '2026-11-25' }).totals;
      gantt.destroy(); host.remove();
      return { lag, start: shipping.start, end: shipping.end, receipts };
    });
    assert.deepEqual(deliveryAndLinks, {
      lag: '1', start: '2026-11-24', end: '2026-11-25',
      receipts: { planned: 100, received: 50, open: 50, excess: 0, overdue: 50 }
    });
    const outcome = await page.evaluate(() => {
      const host = document.createElement('div');
      document.body.append(host);
      const task = (id, parentId = null) => ({ id, parentId, name: id, start: '2026-11-16', end: '2026-11-18' });
      const tasks = [task('parent'), task('child', 'parent'), task('other')];
      let edits = 0;
      const grid = new MoumGantt(host, {
        tasks, scale: 'week', range: { start: '2026-11-01', end: '2026-12-01' },
        mini: { type: 'compact', labels: true }, onChange: () => edits++
      });
      const rows = () => [...host.querySelectorAll('.moum-gantt-bar')].map(bar => bar.dataset.taskId);
      host.querySelector('.moum-gantt-toggle').click();
      const folded = rows();
      grid.updateTask('child', { progress: 50 });
      grid.setView('mini');
      const saved = JSON.parse(JSON.stringify(grid.getViewState()));
      grid.setMiniType('summary');
      grid.setRange(null);
      grid.setScale('month');
      grid.setViewState(saved);
      const restored = JSON.stringify(saved) === JSON.stringify(grid.getViewState());
      const compact = host.querySelector('.moum-gantt-mini--compact') !== null;
      const before = host.innerHTML;
      let rejected = 0;
      for (const input of [
        { ...saved, scale: 'constructor' }, { ...saved, range: { start: '2026-12-01', end: '2026-11-01' } },
        { ...saved, mini: { type: 'compact', status: 'no' } }, { ...saved, collapsedTaskIds: [5] }
      ]) {
        try { grid.setViewState(input); }
        catch { if (host.innerHTML === before) rejected++; }
      }
      const edited = grid.getTasks().find(task => task.id === 'child').progress;
      grid.undo();
      const undone = grid.getTasks().find(task => task.id === 'child').progress;
      const captured = grid.captureBaseline();
      const baseline = grid.getTasks().find(task => task.id === 'child').baseline;
      grid.undo();
      grid.setView('full');
      const restoredRows = rows();
      grid.setTasks([task('other'), task('new'), task('new-child', 'new')]);
      grid.setViewState({ ...saved, view: 'full' });
      const reloadedRows = rows(), remaining = grid.getViewState().collapsedTaskIds;
      grid.destroy();
      return { folded, saved, restored, compact, rejected, edited, undone, captured, baseline, edits, restoredRows, reloadedRows, remaining };
    });
    assert.deepEqual(outcome, {
      folded: ['parent', 'other'],
      saved: { version: 1, scale: 'week', view: 'mini', range: { start: '2026-11-01', end: '2026-12-01' }, mini: { type: 'compact', labels: true }, collapsedTaskIds: ['parent'] },
      restored: true, compact: true, rejected: 4, edited: 50, undone: 0, captured: true, baseline: { start: '2026-11-16', end: '2026-11-18' }, edits: 4,
      restoredRows: ['parent', 'other'], reloadedRows: ['other', 'new', 'new-child'], remaining: []
    });
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine.name()}: Gantt view, collapse, refresh, validation and undo`);
  } finally { await browser.close(); }
}
