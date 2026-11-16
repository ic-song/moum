import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
const DEMO_URL = process.env.MOUM_DEMO_URL || 'http://127.0.0.1:4173';
const require = createRequire(import.meta.url), output = path.resolve('output/playwright/server'); await mkdir(output, { recursive: true });
const sheetExports = {}, sandbox = { module: { exports: sheetExports }, exports: sheetExports, ArrayBuffer, Uint8Array, Date };
vm.runInNewContext(await readFile('packages/grid/vendor/sheetjs/xlsx.full.min.js', 'utf8'), sandbox); const XLSX = sandbox.module.exports;
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const reports = [];
for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await type.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), checks = [], errors = [], requests = [], external = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => {
    if (request.url().endsWith('/api/grid')) requests.push(JSON.parse(request.postData()));
    if (/^https?:/.test(request.url()) && !request.url().startsWith(`${DEMO_URL}/`)) external.push(request.url());
  });
  const record = text => { checks.push(text); console.log('PASS', name, text); };
  const cell = (row, col) => page.locator(`#server-grid td[data-row="${row}"][data-col="${col}"]`);
  const ready = async () => page.evaluate(() => serverGrid.ready);
  const reset = async () => { await page.goto(`${DEMO_URL}/examples/server/index.html`); assert.equal(await ready(), true); };
  async function download(scope) {
    await page.getByRole('combobox', { name: '엑셀 다운로드 범위', exact: true }).selectOption(scope);
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '엑셀 다운로드', exact: true }).click();
    const download = await pending; assert.equal(await download.failure(), null); const target = path.join(output, `${name}-${scope}.xlsx`); await download.saveAs(target);
    const book = XLSX.read(await readFile(target), { type: 'buffer' }); return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: '' });
  }
  try {
    await reset(); assert.equal(await cell(0, 0).innerText(), 'R00001'); assert.equal(await page.evaluate(() => serverGrid.model.rows.length), 50); assert.equal(await page.evaluate(() => serverGrid.paging.total), 1023);
    assert.match(await cell(0, 0).getAttribute('aria-label'), /R00001/); assert.equal(requests[0].offset, 0); assert.equal(requests[0].limit, 50);
    const callsBeforeFreeze = requests.length; await page.evaluate(() => serverGrid.setFrozenColumns(1)); assert.equal(await cell(0, 0).getAttribute('class').then(value => value.includes('is-frozen')), true); assert.equal(requests.length, callsBeforeFreeze); await page.evaluate(() => serverGrid.setFrozenColumns(0));
    await page.getByRole('button', { name: '다음', exact: true }).click(); await ready(); assert.equal(await cell(0, 0).innerText(), 'R00051'); assert.equal(await page.getByRole('grid').getAttribute('aria-rowcount'), '1024'); assert.equal(await page.locator('#server-grid tbody tr').first().getAttribute('aria-rowindex'), '52');
    await page.getByRole('button', { name: '마지막', exact: true }).click(); await ready(); assert.equal(await page.evaluate(() => serverGrid.view.length), 23); assert.equal(await cell(0, 0).innerText(), 'R01001');
    record('Actual HTTP paging retrieves only the requested rows and handles the partial final page');

    await page.selectOption('#delay', '1000'); await page.getByRole('button', { name: '처음', exact: true }).click();
    await page.waitForFunction(() => serverGrid.remote.loading); assert.equal(await page.getByRole('grid').getAttribute('aria-busy'), 'true'); assert.match(await page.locator('.moum-grid__load-state').innerText(), /불러오는 중/); await page.screenshot({ path: path.join(output, `${name}-loading.png`), fullPage: true }); await ready(); await page.selectOption('#delay', '0');
    await page.getByRole('searchbox', { name: '검색', exact: true }).fill('서버 품목 1023'); await page.waitForFunction(() => serverGrid.remote.criteria.query === '서버 품목 1023' && !serverGrid.remote.loading);
    assert.equal(await page.evaluate(() => serverGrid.paging.total), 1); assert.equal(await cell(0, 0).innerText(), 'R01023');
    await page.evaluate(() => { serverGrid.setSearch(''); serverGrid.setSorts([{ field: 'qty', direction: -1 }]); serverGrid.setFilters([{ field: 'qty', operator: 'gte', value: 91 }, { field: 'category', operator: 'equals', value: '전산' }]); }); await ready();
    assert.equal(await page.evaluate(() => serverGrid.paging.total), 33); assert.equal(await cell(0, 0).innerText(), 'R00200'); assert.equal(requests.at(-1).filters.length, 2);
    record('Loading is announced and search, ordered sorts and AND filters run against the full server dataset');

    await reset(); await page.getByRole('button', { name: '다음 요청 실패시키기' }).click(); await page.getByRole('button', { name: '다음', exact: true }).click(); assert.equal(await ready(), false);
    assert.equal(await cell(0, 0).innerText(), 'R00001'); assert.match(await page.locator('.moum-grid__load-state').innerText(), /실패/); await page.screenshot({ path: path.join(output, `${name}-error.png`), fullPage: true }); const failures = requests.length;
    await page.waitForTimeout(120); assert.equal(requests.length, failures); await page.getByRole('button', { name: '다시 시도', exact: true }).click(); assert.equal(await ready(), true); assert.equal(await cell(0, 0).innerText(), 'R00051');
    await page.selectOption('#delay', '1000'); await page.evaluate(() => { serverGrid.remote.timeoutMs = 50; serverGrid.reload(); }); assert.equal(await ready(), false); assert.match(await page.locator('.moum-grid__load-state').innerText(), /초과/);
    await page.selectOption('#delay', '0'); await page.evaluate(() => { serverGrid.remote.timeoutMs = 10000; }); await page.getByRole('button', { name: '다시 시도', exact: true }).click(); assert.equal(await ready(), true);
    record('HTTP failure and timeout preserve committed rows, stop automatic retry loops and allow explicit recovery');

    await reset();
    const slowStarted = page.waitForRequest(request => request.url().endsWith('/api/grid') && JSON.parse(request.postData()).query === '서버 품목 1');
    await page.evaluate(() => {
      window.originalLoad = serverGrid.remote.source.load;
      serverGrid.remote.source.load = async ({ signal, ...request }) => {
        const response = await fetch('/api/grid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, simulate: { delay: request.query === '서버 품목 1' ? 1000 : 0 } }) }); return response.json();
      };
      serverGrid.setSearch('서버 품목 1'); window.oldLoad = serverGrid.ready;
    });
    await slowStarted;
    await page.evaluate(() => serverGrid.setSearch('서버 품목 1023')); assert.equal(await ready(), true); assert.equal(await page.evaluate(() => oldLoad), false);
    await page.waitForTimeout(1100); assert.equal(await cell(0, 0).innerText(), 'R01023'); assert.equal(await page.evaluate(() => serverGrid.paging.total), 1);
    await page.evaluate(() => { serverGrid.remote.source.load = window.originalLoad; });
    record('A delayed real HTTP response cannot overwrite a newer query even when the transport ignores AbortSignal');

    await reset(); await page.getByRole('combobox', { name: '표시 방식', exact: true }).selectOption('infinite'); await ready(); assert.equal(await page.evaluate(() => serverGrid.model.rows.length), 50);
    await page.locator('.moum-grid__viewport').evaluate(viewport => { viewport.scrollTop = viewport.scrollHeight; }); await page.waitForFunction(() => serverGrid.model.rows.length === 100 && !serverGrid.remote.loading);
    await page.evaluate(() => { serverGrid.select({ row: 10, col: 1 }); serverGrid.select({ row: 11, col: 2 }, true); });
    const before = requests.filter(request => request.offset === 100).length;
    assert.equal(await page.evaluate(async () => { const first = serverGrid.loadMore(), second = serverGrid.loadMore(); return first === second && await first; }), true);
    assert.equal(requests.filter(request => request.offset === 100).length - before, 1);
    assert.deepEqual(await page.evaluate(() => serverGrid.getSelection()), { top: 10, bottom: 11, left: 1, right: 2 });
    await page.getByRole('button', { name: '다음 요청 실패시키기' }).click(); await page.getByRole('button', { name: '더 불러오기', exact: true }).click(); assert.equal(await ready(), false); assert.equal(await page.evaluate(() => serverGrid.model.rows.length), 150);
    await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await ready(); assert.equal(await page.evaluate(() => serverGrid.model.rows.length), 200);
    await page.evaluate(async () => { while (serverGrid.paging.hasMore && serverGrid.model.rows.length < 300) await serverGrid.loadMore(); }); assert.ok(await page.locator('td[data-row]').count() < 180);
    await page.evaluate(() => { window.beforeDuplicate = serverGrid.remote.source.load; serverGrid.remote.source.load = async request => { const result = await window.beforeDuplicate(request); result.rows[0].id = serverGrid.model.rows[0].id; return result; }; });
    const loaded = await page.evaluate(() => serverGrid.model.rows.length); assert.equal(await page.evaluate(() => serverGrid.loadMore()), false); assert.equal(await page.evaluate(() => serverGrid.model.rows.length), loaded);
    await page.evaluate(() => { serverGrid.remote.source.load = window.beforeDuplicate; }); await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await ready();
    await page.evaluate(async () => { while (serverGrid.paging.hasMore) if (!await serverGrid.loadMore()) throw Error('append failed'); }); assert.equal(await page.evaluate(() => serverGrid.model.rows.length), 1023); assert.equal(await page.getByRole('button', { name: '모두 불러왔습니다' }).isDisabled(), true);
    record('HTTP infinite loading deduplicates batches, retries only the failed batch, rejects duplicate IDs atomically, virtualizes and terminates');

    await reset(); await page.getByRole('button', { name: '마지막', exact: true }).click(); await ready();
    await page.evaluate(() => { const original = serverGrid.remote.source.load; serverGrid.remote.source.load = async ({ signal, ...request }) => {
      const result = await fetch('/api/grid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, simulate: { total: 20 } }), signal }); return result.json();
    }; window.restoreLoad = original; serverGrid.reload(); }); await ready();
    assert.equal(await page.evaluate(() => serverGrid.paging.pageIndex), 0); assert.equal(await page.evaluate(() => serverGrid.model.rows.length), 20);
    record('A server-side row-count reduction redirects an invalid last page to the remaining valid page');

    await reset(); assert.equal(await page.getByRole('button', { name: '행 추가', exact: true }).isDisabled(), true); assert.equal(await page.evaluate(() => serverGrid.paste('blocked')), false); assert.equal(await page.evaluate(() => serverGrid.addRow()), false); assert.equal(await page.evaluate(() => serverGrid.importXLSX(new Uint8Array())), false);
    await cell(0, 1).click(); await page.keyboard.press('Delete'); assert.equal(await cell(0, 1).innerText(), '서버 품목 1'); assert.equal(await cell(0, 1).getAttribute('aria-readonly'), 'true');
    let values = await download('view'); assert.equal(values.length, 51); values = await download('all'); assert.equal(values.length, 1024);
    await page.evaluate(() => { serverGrid.setSearch('서버 품목 1023'); }); await ready(); values = await download('filtered'); assert.equal(values.length, 2); assert.equal(values[1][0], 'R01023');
    await page.evaluate(() => { serverGrid.select({ row: 0, col: 1 }); serverGrid.select({ row: 0, col: 2 }, true); }); values = await download('selection'); assert.equal(values[0].length, 2); assert.equal(values[1][0], '서버 품목 1023');
    await page.evaluate(() => { window.exportRows = serverGrid.remote.source.exportRows; delete serverGrid.remote.source.exportRows; serverGrid.updateRemoteControls(); });
    assert.equal(await page.locator('select[aria-label="엑셀 다운로드 범위"] option[value=all]').isDisabled(), true); assert.equal(await page.evaluate(() => serverGrid.exportXLSX({ scope: 'all' })), false);
    await page.evaluate(() => { serverGrid.remote.source.exportRows = window.exportRows; serverGrid.updateRemoteControls(); });
    record('Server rows are readonly and real XLSX exports distinguish loaded, full, filtered and selected data; unsupported full export is blocked');

    let unexpectedDownloads = 0; const extraDownload = () => unexpectedDownloads++; page.on('download', extraDownload);
    const exportStarted = page.waitForRequest(request => request.url().endsWith('/api/grid') && JSON.parse(request.postData()).export === true);
    await page.evaluate(() => {
      window.realExport = serverGrid.remote.source.exportRows;
      serverGrid.remote.source.exportRows = async ({ signal, ...request }) => (await (await fetch('/api/grid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, export: true, simulate: { delay: 1000 } }) })).json()).rows;
      window.pendingExport = serverGrid.exportXLSX({ scope: 'filtered' });
    });
    await exportStarted;
    await page.evaluate(() => serverGrid.setSearch('서버 품목 999')); await ready(); assert.equal(await page.evaluate(() => pendingExport), false); assert.equal(unexpectedDownloads, 0); page.off('download', extraDownload);
    await page.evaluate(() => { serverGrid.remote.source.exportRows = window.realExport; });
    await page.evaluate(() => serverGrid.setSearch('없는 서버 결과 xyz')); await ready(); assert.equal(await page.evaluate(() => serverGrid.paging.total), 0); await page.screenshot({ path: path.join(output, `${name}-empty.png`), fullPage: true }); assert.equal(await page.getByRole('button', { name: '다음', exact: true }).isDisabled(), true);
    await page.evaluate(() => { window.savedExport = serverGrid.remote.source.exportRows; serverGrid.remote.timeoutMs = 30; serverGrid.remote.source.exportRows = () => new Promise(() => {}); });
    assert.equal(await page.evaluate(() => serverGrid.exportXLSX({ scope: 'all' })), false); assert.match(await page.locator('.moum-grid__status').innerText(), /초과/);
    await page.evaluate(() => { serverGrid.remote.timeoutMs = 10000; serverGrid.remote.source.exportRows = window.savedExport; });
    record('Criteria changes cancel an outstanding full export, export timeouts release controls and empty responses disable paging without phantom rows');

    await reset(); await page.evaluate(() => serverGrid.setSearch('서버 품목 1023')); await ready();
    await page.evaluate(axeSource); const accessibility = await page.evaluate(async () => {
      const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }); return { violations: result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), incomplete: result.incomplete.map(item => item.id) };
    });
    await writeFile(path.join(output, `${name}-axe.json`), JSON.stringify(accessibility, null, 2)); assert.deepEqual(accessibility.violations, []);
    for (const width of [320, 390, 639, 640, 641, 768, 1024, 1440, 1920, 2560]) { await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(30); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false); if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true }); }
    record('Automated WCAG 2 A/AA and 2.1 AA checks find no violations; the server screen fits ten widths including breakpoint edges');

    await page.goto(`${DEMO_URL}/examples/grid/index.html`);
    const localCell = page.locator('td[data-row="0"][data-col="1"]'); const original = await localCell.innerText(); await localCell.click(); await page.keyboard.press('F2'); await page.locator('td input').fill('다중 엔진 입력'); await page.keyboard.press('Enter'); assert.equal(await localCell.innerText(), '다중 엔진 입력');
    await page.keyboard.press('Control+z'); assert.equal(await localCell.innerText(), original); await page.keyboard.press('Control+y'); assert.equal(await localCell.innerText(), '다중 엔진 입력');
    await page.evaluate(() => { grid.select({ row: 0, col: 1 }); grid.select({ row: 1, col: 2 }, true); }); await page.keyboard.press('Delete'); await page.keyboard.press('Control+z');
    assert.equal(await localCell.innerText(), '다중 엔진 입력'); record('Existing local F2 editing, Korean text, range Delete and undo/redo work on this browser engine');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    reports.push({ name, browser: browser.version(), checks, apiRequests: requests.length, errors, external, accessibility });
    await writeFile(path.join(output, 'report.json'), JSON.stringify(reports, null, 2));
  } finally { await browser.close(); }
}
