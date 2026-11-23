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
    await page.goto(pathToFileURL(path.resolve('examples/uploader/index.html')).href);
    const upload = await page.evaluate(async () => {
      const host = document.body.appendChild(document.createElement('div'));
      const rejected = [];
      const uploader = new MoumUploader(host, {
        maxTotalFileSize: 6, rejectDuplicates: true,
        onReject: ({ file, reason }) => rejected.push([file.name, reason])
      });
      const file = (name, size, lastModified = 1000) => new File(['x'.repeat(size)], name, { lastModified, type: 'text/plain' });
      const [id] = await uploader.addFiles([file('a.txt', 3)]);
      const added = await uploader.addFiles([file('a.txt', 3), file('b.txt', 4), file('c.txt', 2)]);
      const beforeRemove = uploader.getQueueBytes();
      uploader.removeFile(id);
      const afterRemove = uploader.getQueueBytes();
      await uploader.addFiles([file('b.txt', 4)]);
      const names = uploader.getFiles().map(item => item.name);
      uploader.clear();
      const empty = uploader.getQueueBytes();
      await Promise.all([uploader.addFiles([file('first.txt', 4)]), uploader.addFiles([file('second.txt', 4)])]);
      const concurrent = uploader.getQueueBytes();
      uploader.destroy();
      const permissive = new MoumUploader(host);
      const allowed = (await permissive.addFiles([file('same.txt', 3), file('same.txt', 3)])).length;
      permissive.destroy();
      return { rejected, accepted: added.length, beforeRemove, afterRemove, names, empty, concurrent, allowed };
    });
    assert.deepEqual(upload, {
      rejected: [['a.txt', 'duplicate'], ['b.txt', 'totalSize'], ['second.txt', 'totalSize']],
      accepted: 1, beforeRemove: 5, afterRemove: 2, names: ['c.txt', 'b.txt'], empty: 0, concurrent: 4, allowed: 2
    });

    await page.goto(pathToFileURL(path.resolve('examples/calendar/index.html')).href);
    const calendar = await page.evaluate(async () => {
      const host = document.body.appendChild(document.createElement('div'));
      const calls = [], pending = [], events = [];
      const calendar = new MoumCalendar(host, {
        date: '2026-11-22', resources: [{ id: 'room' }],
        load: request => { calls.push(request); return new Promise(resolve => pending.push(resolve)); },
        onViewChange: state => events.push(state),
        onResourceChange: id => events.push(id)
      });
      const initial = calendar.getViewState();
      let invalid = 0;
      for (const patch of [{ date: '2026-11-31' }, { weekStartsOn: 7 }, { resourceId: 'missing' }]) {
        try { calendar.setViewState({ ...initial, ...patch }); }
        catch { if (JSON.stringify(initial) === JSON.stringify(calendar.getViewState())) invalid++; }
      }
      const next = { ...initial, view: 'week', weekStartsOn: 1, resourceId: 'room' };
      calendar.setViewState(JSON.parse(JSON.stringify(next)));
      calendar.setViewState(next);
      const request = calls[1];
      pending[1]([{ id: 'new', start: '2026-11-16', end: '2026-11-17', allDay: true, resourceId: 'room' }]);
      while (calendar.getLoadState().loading) await new Promise(resolve => setTimeout(resolve, 0));
      pending[0]([{ id: 'old', start: '2026-11-16', end: '2026-11-17', allDay: true }]);
      await Promise.resolve();
      const ids = calendar.getEvents().map(event => event.id);
      const outcome = {
        invalid, calls: calls.length, cancelled: calls[0].signal.aborted,
        range: [request.start, request.end], resource: request.resourceId, events, ids,
        restored: JSON.stringify(next) === JSON.stringify(calendar.getViewState())
      };
      calendar.destroy();
      const local = new MoumCalendar(host, { date: '2026-11-22' });
      local.addEvent({ id: 'local', start: '2026-11-22', end: '2026-11-23', allDay: true });
      local.setViewState({ ...local.getViewState(), weekStartsOn: 1 });
      const weekday = host.querySelector('.moum-calendar-weekday').textContent;
      local.undo();
      const undo = local.getEvents().length;
      local.destroy();
      return { ...outcome, weekday, undo };
    });
    assert.deepEqual(calendar, {
      invalid: 3, calls: 2, cancelled: true, range: ['2026-11-16', '2026-11-23'], resource: 'room',
      events: [{ view: 'week', date: '2026-11-22' }, 'room'], ids: ['new'], restored: true, weekday: '월', undo: 0
    });
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine.name()}: uploader queue limits and calendar view restore`);
  } finally { await browser.close(); }
}
