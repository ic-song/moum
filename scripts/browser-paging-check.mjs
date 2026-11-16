import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const DEMO_URL = process.env.MOUM_DEMO_URL || 'http://127.0.0.1:4173';
const output = path.resolve('output/playwright/paging'); await mkdir(output, { recursive: true });
const exports = {}, sandbox = { module: { exports }, exports, ArrayBuffer, Uint8Array, Date };
vm.runInNewContext(await readFile('packages/grid/vendor/sheetjs/xlsx.full.min.js', 'utf8'), sandbox); const XLSX = sandbox.module.exports;
const browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `${DEMO_URL}` });
const page = await context.newPage(), checks = [], errors = [], external = [];
page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(`${DEMO_URL}/`)) external.push(request.url()); });
const record = text => { checks.push(text); console.log('PASS', text); };
const cell = (row, col) => page.locator(`#workbench td[data-row="${row}"][data-col="${col}"]`);
async function reset(mode = 'pagination', count = 103, readonly = false) {
  await page.evaluate(({ mode, count, readonly }) => {
    workbench.destroy();
    const columns = [{ field: 'id', header: '코드', editable: false }, { field: 'name', header: '품목' }, { field: 'qty', header: '수량', type: 'number', validate: value => value < 0 ? '음수 불가' : null }, { field: 'price', header: '단가', type: 'number' }, { field: 'total', header: '금액', type: 'number' }];
    const data = Array.from({ length: count }, (_, index) => ({ id: `R${index}`, name: `품목 ${index}`, qty: index + 1, price: 2, total: `=C${index + 1}*D${index + 1}` }));
    workbench = new MoumGrid('#workbench', { columns, data, formulas: true, editable: !readonly, dataMode: mode, pageSize: 25 });
  }, { mode, count, readonly }); await page.waitForTimeout(60);
}
async function download(scope, name = scope) {
  await page.selectOption('#workbench select[aria-label="엑셀 다운로드 범위"]', scope);
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '엑셀 다운로드', exact: true }).first().click(); const download = await pending;
  assert.equal(await download.failure(), null); const target = path.join(output, `${name}.xlsx`); await download.saveAs(target);
  const book = XLSX.read(await readFile(target), { type: 'buffer' }); return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: '' });
}
try {
  await page.goto(`${DEMO_URL}/examples/advanced/index.html`); await reset();
  assert.equal(await page.evaluate(() => workbench.getPagingState().pageCount), 5);
  await page.getByRole('button', { name: '다음', exact: true }).click(); assert.equal(await cell(0, 0).innerText(), 'R25');
  assert.equal(await page.locator('#workbench tbody th').first().innerText(), '26');
  await page.getByRole('spinbutton', { name: '이동할 페이지' }).fill('5'); await page.getByRole('button', { name: '이동', exact: true }).click(); assert.equal(await cell(0, 0).innerText(), 'R100');
  assert.equal(await page.locator('#workbench td[data-col="0"]').count(), 3); assert.equal(await page.getByRole('button', { name: '다음', exact: true }).isDisabled(), true);
  record('Paging options and first/next/direct/last boundaries display the correct original rows and ordinal labels');

  await page.getByRole('button', { name: '처음', exact: true }).click(); await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.evaluate(() => navigator.clipboard.writeText('붙여넣기 A\t20\r\n붙여넣기 B\t30')); await cell(0, 1).click(); await page.keyboard.press('Control+v');
  assert.equal(await page.evaluate(() => workbench.model.rows[25].qty), 20); assert.equal(await cell(0, 4).innerText(), '40'); assert.equal(await page.evaluate(() => workbench.model.rows[0].qty), 1);
  await page.keyboard.press('Control+z'); assert.equal(await cell(0, 2).innerText(), '26'); await page.keyboard.press('Control+y'); assert.equal(await cell(1, 2).innerText(), '30');
  await page.evaluate(() => { workbench.select({ row: 0, col: 1 }); workbench.select({ row: 1, col: 2 }, true); }); await page.keyboard.press('Delete'); assert.equal(await cell(1, 2).innerText(), ''); await page.keyboard.press('Control+z');
  record('Actual multi-cell clipboard paste and Delete on page two update only the mapped source records and retain formula/undo/redo behavior');

  await reset(); await page.evaluate(() => { workbench.setSorts([{ field: 'qty', direction: -1 }]); workbench.setFilters([{ field: 'qty', operator: 'gte', value: 50 }]); workbench.setPage(1); });
  let rows = await download('view'); assert.equal(rows.length, 26); assert.equal(rows[1][0], 'R77');
  rows = await download('filtered'); assert.equal(rows.length, 55); assert.equal(rows[1][2], 103); assert.equal(rows.at(-1)[2], 50);
  rows = await download('all'); assert.equal(rows.length, 104); assert.equal(rows[1][0], 'R0');
  await page.evaluate(() => { workbench.select({ row: 0, col: 1 }); workbench.select({ row: 1, col: 2 }, true); });
  rows = await download('selection'); assert.equal(rows.length, 3); assert.deepEqual(Array.from(rows[0]), ['품목', '수량']); assert.equal(rows[1][0], '품목 77'); assert.equal(rows[2][1], 77);
  record('Excel download UI produces real XLSX files for the current page, all filtered/sorted rows, all source data and a selected rectangle');

  await reset(); await page.getByRole('button', { name: '마지막', exact: true }).click(); await cell(0, 0).click(); await page.keyboard.press('Control+a'); await page.getByRole('button', { name: '선택 행 삭제', exact: true }).first().click();
  assert.equal(await page.evaluate(() => workbench.getPagingState().pageIndex), 3); assert.equal(await cell(0, 0).innerText(), 'R75');
  await page.evaluate(() => workbench.undo()); assert.equal(await page.evaluate(() => workbench.model.rows.length), 103);
  await page.evaluate(() => workbench.addRow({ name: '새 행', qty: 1, price: 3 })); assert.equal(await page.evaluate(() => workbench.getPagingState().pageIndex), 4); assert.equal(await page.locator('#workbench td.is-active').innerText(), '새 행');
  await page.getByRole('combobox', { name: '표시 행 수', exact: true }).selectOption('50'); assert.equal(await page.evaluate(() => workbench.getPagingState().pageIndex), 0); assert.equal(await page.evaluate(() => workbench.view.length), 50);
  record('Deleting the final page clamps to the remaining last page; undo restores rows, adding a row reveals it and page-size changes reset safely');

  await reset(); await cell(0, 2).dblclick(); await page.locator('#workbench td input').fill('-1');
  await page.getByRole('combobox', { name: '표시 방식', exact: true }).selectOption('infinite');
  assert.equal(await page.evaluate(() => workbench.dataMode), 'pagination'); assert.equal(await page.locator('#workbench td input').inputValue(), '-1');
  assert.equal(await page.evaluate(() => workbench.setPage(1)), false); assert.equal(await page.evaluate(() => workbench.exportXLSX()), false); await page.locator('#workbench td input').press('Escape');
  assert.equal(await page.evaluate(() => workbench.setPage(99)), false);
  record('Invalid edits remain intact and block mode changes, page navigation and Excel download until corrected or cancelled');

  await reset('infinite', 253); assert.equal(await page.evaluate(() => workbench.view.length), 25);
  await page.locator('#workbench .moum-grid__viewport').evaluate(viewport => { viewport.scrollTop = viewport.scrollHeight; }); await page.waitForFunction(() => workbench.view.length === 50);
  await page.getByRole('button', { name: '더 불러오기', exact: true }).click(); assert.equal(await page.evaluate(() => workbench.view.length), 75);
  const stable = await page.evaluate(() => {
    while (workbench.view.length < 200) workbench.loadMore();
    workbench.viewport.scrollTop = 180 * 48;
    const before = workbench.cellElement({ row: 180, col: 0 }).getBoundingClientRect().top;
    workbench.loadMore(); return { before, after: workbench.cellElement({ row: 180, col: 0 }).getBoundingClientRect().top };
  });
  assert.ok(Math.abs(stable.before - stable.after) < 1, 'infinite virtualization must not shift existing row geometry');
  await page.evaluate(() => { while (workbench.paging.hasMore) workbench.loadMore(); }); assert.equal(await page.evaluate(() => workbench.view.length), 253); assert.equal(await page.getByRole('button', { name: '모두 불러왔습니다', exact: true }).isDisabled(), true);
  assert.ok(await page.locator('#workbench td[data-row]').count() < 200);
  await page.evaluate(() => workbench.select({ row: 252, col: 1 })); await page.keyboard.press('Delete'); await page.keyboard.press('Control+z'); assert.equal(await cell(252, 1).innerText(), '품목 252');
  rows = await download('view', 'infinite-loaded'); assert.equal(rows.length, 254);
  await page.screenshot({ path: path.join(output, 'infinite-end.png'), fullPage: true });
  record('Infinite scroll appends local batches automatically and by keyboard-accessible button, virtualizes loaded rows, stops at the end and downloads all loaded rows');

  await page.getByRole('combobox', { name: '표시 방식', exact: true }).selectOption('pagination'); assert.equal(await page.evaluate(() => workbench.view.length), 25);
  assert.equal(await page.evaluate(() => workbench.model.canRedo), true); await page.evaluate(() => workbench.redo()); assert.equal(await page.evaluate(() => workbench.model.rows[252].name), ''); await page.evaluate(() => workbench.undo());
  await page.getByRole('combobox', { name: '표시 방식', exact: true }).selectOption('virtual'); assert.equal(await page.evaluate(() => workbench.view.length), 253);
  record('Switching between all three display modes preserves source values, raw formulas and the shared undo history');

  await reset('pagination', 103, true); rows = await download('all', 'readonly-all'); assert.equal(rows.length, 104); assert.equal(await page.evaluate(() => workbench.paste('blocked')), false);
  await page.evaluate(() => workbench.setSearch('not found')); assert.equal(await page.evaluate(() => workbench.paging.pageCount), 0); assert.equal(await page.getByRole('button', { name: '다음', exact: true }).isDisabled(), true);
  rows = await download('view', 'empty'); assert.equal(rows.length, 1);
  record('Readonly grids allow Excel download and page navigation; empty results have disabled navigation and a valid header-only workbook');

  await reset(); await page.evaluate(() => { workbench.setPage(3); workbench.setGroupBy(['price']); }); assert.equal(await page.evaluate(() => workbench.pageIndex), 0);
  await page.getByRole('button', { name: '다음', exact: true }).click(); assert.equal(await page.evaluate(() => workbench.view[0].index), 24);
  await page.evaluate(() => { workbench.setGroupBy([]); workbench.setTree({ idField: 'id', parentField: 'parent', labelField: 'name' }); });
  assert.equal(await page.evaluate(() => workbench.view.length), 25); await page.getByRole('button', { name: '다음', exact: true }).click(); assert.equal(await cell(0, 0).innerText(), 'R25');
  await page.evaluate(() => workbench.model.setData(workbench.model.getData())); assert.equal(await page.evaluate(() => workbench.pageIndex), 0);
  record('Group/subtotal display rows and tree data remain pageable with original source mapping and reset after view transformations or external replacement');

  await reset(); await page.getByRole('button', { name: '다음', exact: true }).click();
  for (const width of [320, 390, 639, 640, 641, 768, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(40); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `overflow ${width}`);
    if ([320, 390, 768, 1440].includes(width)) await page.screenshot({ path: path.join(output, `paging-${width}.png`), fullPage: true });
  }
  record('Mode, Excel scope and paging controls remain inside the page across ten widths including the 640px breakpoint edges');
  const local = await context.newPage(); let requests = 0; local.on('request', request => { if (/^https?:/.test(request.url())) requests++; }); local.on('pageerror', error => errors.push(error.message));
  await local.goto(pathToFileURL(path.resolve('examples/advanced/index.html')).href); await local.getByRole('combobox', { name: '표시 방식', exact: true }).selectOption('pagination');
  const offlineDownload = local.waitForEvent('download'); await local.getByRole('button', { name: '엑셀 다운로드', exact: true }).click(); await (await offlineDownload).saveAs(path.join(output, 'offline.xlsx'));
  await local.getByRole('combobox', { name: '표시 방식', exact: true }).selectOption('infinite'); assert.equal(await local.evaluate(() => workbench.getPagingState().hasMore), false); await local.close(); assert.equal(requests, 0);
  assert.deepEqual(errors, []); assert.deepEqual(external, []); record('Standalone file:// mode selection and actual Excel download work with zero HTTP requests and page errors');
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ checks, errors, external, browser: browser.version(), node: process.version }, null, 2));
} finally { await browser.close(); }
