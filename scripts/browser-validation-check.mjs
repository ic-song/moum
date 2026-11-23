import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

for (const engine of [chromium, firefox, webkit]) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('examples/grid/index.html')).href);
    const result = await page.evaluate(() => {
      const host = document.createElement('div'); document.body.append(host);
      const grid = new MoumGrid(host, { columns: [{ field: 'name', required: true }, { field: 'qty', type: 'number' }], data: [{ name: '', qty: 'bad' }, { name: 'B', qty: 2 }] });
      grid.setSorts([{ field: 'name', direction: 'desc' }]);
      grid.setSearch('B');
      const hidden = grid.validate();
      grid.setSearch('');
      grid.select({ row: 0, col: 0 }); grid.startEdit({ row: 0, col: 0 });
      grid.editor.input.value = '수정 중';
      const draft = grid.editor.input.value;
      grid.validate();
      const preserved = grid.editor.input.value === draft;
      const finished = grid.finishEdit();
      const data = grid.getData(), revision = grid.model.revision;
      const report = grid.validate();
      const unchanged = JSON.stringify(data) === JSON.stringify(grid.getData()) && revision === grid.model.revision;
      grid.destroy(); host.remove();
      const serverHost = document.createElement('div'); document.body.append(serverHost);
      const server = new MoumGrid(serverHost, { columns: [{ field: 'name', required: true }], dataSource: { load: async () => ({ rows: [{ id: 1, name: 'A', _version: 1 }], total: 1 }), save: async () => { throw Error('Unexpected save'); } } });
      return server.ready.then(() => {
        server.addRow({ name: '' });
        const loaded = server.validate(); server.destroy(); serverHost.remove();
        return { hidden, preserved, finished, report, unchanged, loaded };
      });
    });
    assert.deepEqual(result.hidden.errors.map(({ row, field }) => [row, field]), [[0, 'name'], [0, 'qty']]);
    assert.equal(result.preserved, true); assert.equal(result.finished, true); assert.equal(result.unchanged, true);
    assert.equal(result.report.errors.length, 2);
    assert.equal(result.loaded.errors[0].field, 'name');
    assert.equal(result.loaded.errors[0].row, 1);
    const expanded = await page.evaluate(async () => {
      const host = document.createElement('div'); document.body.append(host);
      const grid = new MoumGrid(host, {
        columns: [{ field: 'name' }, { field: 'note', searchable: false }],
        sortLocale: 'sv',
        data: [{ name: 'ä', note: '관리자 메모' }, { name: 'z 10' }, { name: 'z 2' }]
      });
      grid.setSorts([{ field: 'name', direction: 'asc' }]);
      const order = grid.view.map(item => item.row.name);
      grid.setSearch('메모');
      const hiddenMatches = grid.view.length;
      grid.destroy();

      const columns = ['min', 'max'].map(field => ({ field, type: 'number' }));
      const rows = [];
      let sends = 0;
      const server = new MoumGrid(host, {
        columns,
        validateRow: ({ min, max }) => min > max ? '범위를 확인하세요.' : undefined,
        dataSource: {
          load: async () => ({ rows, total: rows.length }),
          save: async ({ requestId, created }) => {
            sends++;
            const row = { ...created[0].values, id: 1, _version: 1 };
            rows.push(row);
            return { requestId, created: [{ clientId: created[0].clientId, row }], updated: [], deleted: [] };
          }
        }
      });
      await server.ready;
      server.addRow({ min: 10, max: 2 });
      const rejected = await server.saveChanges();
      const reason = server.status.textContent;
      const pending = server.getSaveState().dirty;
      server.select({ row: 0, col: 1 });
      server.paste('20');
      const saved = await server.saveChanges();
      server.destroy(); host.remove();
      return { order, hiddenMatches, rejected, reason, pending, saved, sends, rows };
    });
    assert.deepEqual(expanded, {
      order: ['z 2', 'z 10', 'ä'], hiddenMatches: 0, rejected: false,
      reason: '범위를 확인하세요.', pending: true, saved: true, sends: 1,
      rows: [{ min: 10, max: 20, id: 1, _version: 1 }]
    });
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine.name()}: validation, locale sorting, searchable columns and server save guard`);
  } finally { await browser.close(); }
}
