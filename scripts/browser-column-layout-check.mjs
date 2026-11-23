import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

for (const engine of [chromium, firefox, webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve('examples/grid/index.html')).href);
    const result = await page.evaluate(async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const grid = new MoumGrid(host, {
        columns: [{ field: 'name' }, { field: 'qty', type: 'number' }, { field: 'total', type: 'number' }],
        data: [{ name: 'A', qty: 2, total: '=B1*2' }], formulas: true
      });
      const original = grid.getColumnLayout();
      grid.setColumnLayout([{ field: 'total', width: 220 }, { field: 'name', visible: false }, { field: 'qty' }]);
      const layout = JSON.parse(JSON.stringify(grid.getColumnLayout()));
      const headers = [...host.querySelectorAll('col[data-field]')].map(col => col.dataset.field);
      grid.setSearch('A');
      const matches = grid.view.length;
      grid.select({ row: 0, col: 1 });
      grid.paste('3');
      const computed = grid.getData()[0];
      let rejected = false;
      try { grid.setColumnLayout([{field:'name'}, {field:'name'}, {field:'qty'}]); } catch { rejected = true; }
      const preserved = JSON.stringify(layout) === JSON.stringify(grid.getColumnLayout());
      let workbook;
      grid.downloadFile = blob => { workbook = blob.arrayBuffer().then(bytes => XLSX.read(bytes, { type: 'array' })); };
      grid.exportXLSX({ scope: 'all', formulas: true });
      const { Sheets, SheetNames } = await workbook;
      const sheet = Sheets[SheetNames[0]];
      grid.setColumnLayout(original);
      const restored = JSON.stringify(original) === JSON.stringify(grid.getColumnLayout());
      grid.undo();
      const undone = grid.getData()[0];
      grid.destroy();

      let calls = 0;
      const remote = new MoumGrid(host, {
        columns: [{ field: 'qty', type: 'number' }, { field: 'note', type: 'number' }],
        dataSource: { load: async () => ({ rows: [{ id: 1, qty: '2', note: String(++calls) }], total: 1 }) }
      });
      await remote.ready;
      remote.setColumnLayout([{ field: 'note', visible: false }, { field: 'qty' }]);
      const beforeReload = calls;
      await remote.reload();
      const hiddenValue = remote.getData()[0].note;
      remote.destroy();
      return { headers, matches, computed, rejected, preserved, restored, undone, formula: sheet.C2.f, beforeReload, hiddenValue };
    });
    assert.deepEqual(result, {
      headers: ['total', 'qty'], matches: 1, computed: { name: 'A', qty: 3, total: 6 },
      rejected: true, preserved: true, restored: true, undone: { name: 'A', qty: 2, total: 4 },
      formula: 'B2*2', beforeReload: 1, hiddenValue: 2
    });
    console.log(`PASS ${engine.name()}: layout round-trip, original columns, paste/undo, formula XLSX and server reload`);
  } finally { await browser.close(); }
}
