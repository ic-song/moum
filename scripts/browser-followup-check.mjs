import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const DEMO_URL = process.env.MOUM_DEMO_URL || 'http://127.0.0.1:4173';
const output = path.resolve('output/playwright/followup'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `${DEMO_URL}` });
const page = await context.newPage(), errors = [], requests = [], checks = [], timings = {};
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(`${DEMO_URL}/`)) requests.push(request.url()); });
const record = text => { checks.push(text); console.log('PASS', text); };
const cell = (row, col, host = 'workbench') => page.locator(`#${host} td[data-row="${row}"][data-col="${col}"]`);
const scenario = async name => { await page.selectOption('#scenario', name); await page.waitForTimeout(80); };
try {
  await page.goto(`${DEMO_URL}/examples/advanced/index.html`);
  assert.equal(await cell(0, 3).innerText(), '150000');
  await cell(0, 1).dblclick(); await page.locator('#workbench td input').fill('10'); await page.keyboard.press('Enter');
  assert.equal(await cell(0, 3).innerText(), '300000'); assert.equal(await cell(2, 3).innerText(), '480000');
  await page.keyboard.press('Control+z'); assert.equal(await cell(0, 3).innerText(), '150000'); await page.keyboard.press('Control+y');
  await page.evaluate(() => { workbench.setSorts([{ field: 'amount', direction: -1 }]); workbench.setFilters([{ field: 'amount', operator: 'gt', value: 200000 }]); });
  assert.equal(await page.evaluate(() => workbench.view.length), 2); assert.equal(await page.evaluate(() => workbench.getData({ raw: true })[0].amount), '=B1*C1');
  record('Formula recalculation, dependency totals, undo/redo and computed-value sort/filter preserve raw expressions');

  await scenario('formulas');
  const copied = await page.evaluate(() => {
    workbench.select({ row: 0, col: 3 }); const transfer = new DataTransfer();
    workbench.table.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: transfer }));
    workbench.select({ row: 1, col: 3 }); workbench.table.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
    return { plain: transfer.getData('text/plain'), raw: workbench.getData({ raw: true }), computed: workbench.getData() };
  });
  assert.equal(copied.plain, '150000'); assert.equal(copied.raw[1].amount, '=B2*C2'); assert.equal(copied.computed[1].amount, 180000);
  await cell(1, 3).click(); await page.keyboard.press('Control+c'); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '180000');
  record('Copy exposes computed TSV for Excel and an internal clipboard format relocates relative formula references');
  await cell(0, 3).dblclick(); await page.locator('#workbench td input').fill('=D1'); await page.keyboard.press('Enter');
  assert.equal(await cell(0, 3).innerText(), '#CYCLE!'); assert.equal(await cell(2, 3).innerText(), '#CYCLE!'); await page.keyboard.press('Control+z');
  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => workbench.exportXLSX({ scope: 'all', formulas: true }))]);
  await download.saveAs(path.join(output, 'formulas.xlsx'));
  await page.evaluate(async () => {
    const bytes = XLSX.write({ SheetNames: ['데이터'], Sheets: { '데이터': { '!ref': 'A1:D2', A1: { t: 's', v: '품목' }, B1: { t: 's', v: '수량' }, C1: { t: 's', v: '단가' }, D1: { t: 's', v: '금액' }, A2: { t: 's', v: '가져오기' }, B2: { t: 'n', v: 4 }, C2: { t: 'n', v: 5 }, D2: { t: 'n', f: 'B2*C2', v: 20 } } } }, { type: 'array', bookType: 'xlsx' });
    await workbench.importXLSX(bytes);
  });
  assert.equal(await cell(0, 3).innerText(), '20'); assert.equal(await page.evaluate(() => workbench.getData({ raw: true })[0].amount), '=B1*C1');
  await page.keyboard.press('Control+z'); assert.equal(await cell(0, 3).innerText(), '150000');
  record('Circular errors propagate visibly; XLSX import shifts header references and formula export downloads real XLSX bytes');

  await scenario('rows');
  timings.rows100k = await page.evaluate(() => {
    const data = workbench.model.getData(), columns = workbench.columns.map(column => ({ ...column })); workbench.destroy();
    const start = performance.now(); workbench = new MoumGrid('#workbench', { data, columns }); const initial = performance.now() - start;
    return { initialMs: initial, rowsInDOM: workbench.table.querySelectorAll('tbody tr:not(.moum-grid__spacer)').length, cellsInDOM: workbench.table.querySelectorAll('td[data-row]').length, logicalRows: workbench.view.length };
  });
  assert.equal(timings.rows100k.logicalRows, 100000); assert.ok(timings.rows100k.rowsInDOM < 30); assert.ok(timings.rows100k.cellsInDOM < 400);
  await cell(0, 0).click(); await page.keyboard.press('Control+End');
  assert.equal(await cell(99999, 11).innerText(), '1000001'); assert.equal(await cell(99999, 11).getAttribute('tabindex'), '0');
  assert.ok(await cell(99999, 11).isVisible());
  await page.keyboard.press('Shift+ArrowUp'); await page.keyboard.press('Delete');
  assert.equal(await page.evaluate(() => workbench.getData()[99998].c11), null); await page.keyboard.press('Control+z'); assert.equal(await cell(99999, 11).innerText(), '1000001');
  await page.keyboard.press('Control+y'); await page.keyboard.press('Control+z');
  record('100,000 rows mount fewer than 30 rows; Ctrl+End, offscreen range Delete and undo/redo reach the original final records');

  timings.scroll100k = await page.evaluate(async () => {
    const samples = [];
    for (const index of [1000, 50000, 10, 99950, 20000]) {
      const start = performance.now(); workbench.viewport.scrollTop = index * 48;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const visible = [...workbench.table.querySelectorAll('td[data-row]')].find(cell => { const box = cell.getBoundingClientRect(), viewport = workbench.viewport.getBoundingClientRect(); return box.top >= viewport.top + 56 && box.top < viewport.bottom; });
      if (!visible || Math.abs(Number(visible.dataset.row) - index) > 3) throw new Error(`Virtual row window mismatch at ${index}: ${visible?.dataset.row}`);
      samples.push(performance.now() - start);
    }
    return samples;
  });
  await page.evaluate(() => { workbench.select({ row: 19990, col: 1 }); workbench.select({ row: 20060, col: 2 }, true); });
  await page.keyboard.press('Control+c'); assert.equal((await page.evaluate(() => navigator.clipboard.readText())).split('\r\n').length, 71);
  await page.keyboard.press('Delete'); assert.equal(await page.evaluate(() => workbench.model.rows[19990].c1), null); assert.equal(await page.evaluate(() => workbench.model.rows[20060].c2), null); await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(() => workbench.mergeSelection()), false);
  await page.screenshot({ path: path.join(output, 'virtual-100k.png'), fullPage: true });
  record('Native scroll positions show the correct logical rows; copying and clearing a 71-row range works beyond mounted cells');

  await scenario('columns'); await page.evaluate(() => workbench.setFrozenColumns(1)); await cell(0, 0).click(); await page.keyboard.press('Control+End');
  assert.equal(await cell(999, 199).innerText(), '10189'); assert.ok(await page.locator('#workbench td[data-row]').count() < 600);
  const geometry = await page.evaluate(() => { const frozen = workbench.cellElement({ row: 999, col: 0 }).getBoundingClientRect(), viewport = workbench.viewport.getBoundingClientRect(); return { left: frozen.left - viewport.left, total: workbench.viewport.scrollWidth, mounted: workbench.table.querySelectorAll('thead th[data-col]').length }; });
  assert.ok(Math.abs(geometry.left - 48) < 2); assert.ok(geometry.mounted < 20);
  await page.keyboard.press('F2'); await page.locator('#workbench td input').fill('123'); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => workbench.model.rows[999].c199), 123); await page.keyboard.press('Control+z');
  await page.screenshot({ path: path.join(output, 'virtual-200-columns.png'), fullPage: true });
  record('200-column windows retain frozen columns and keyboard navigation/edit/undo at the final original column');

  await page.evaluate(() => {
    workbench.destroy();
    const data = Array.from({ length: 500 }, (_, index) => ({ id: String(index), parent: index % 10 ? String(Math.floor(index / 10) * 10) : '', name: `항목 ${index}`, bucket: String(index % 5), qty: index }));
    const columns = [{ field: 'id', editable: false }, { field: 'parent', editable: false }, { field: 'name' }, { field: 'bucket' }, { field: 'qty', type: 'number' }];
    workbench = new MoumGrid('#workbench', { data, columns }); workbench.setGroupBy(['bucket']); workbench.select({ row: 400, col: 4 });
  });
  const grouped = await page.evaluate(() => ({ index: workbench.view[400].index, shown: workbench.cellElement(workbench.current).textContent, count: workbench.table.querySelectorAll('tbody tr:not(.moum-grid__spacer)').length }));
  assert.equal(grouped.shown, String(grouped.index)); assert.ok(grouped.count < 30); await page.keyboard.press('Delete'); assert.equal(await page.evaluate(index => workbench.model.rows[index].qty, grouped.index), null); await page.keyboard.press('Control+z');
  await page.evaluate(() => { workbench.setGroupBy([]); workbench.setTree({ idField: 'id', parentField: 'parent', labelField: 'name' }); workbench.select({ row: 499, col: 2 }); });
  assert.equal(await cell(499, 2).innerText(), '항목 499'); await page.evaluate(() => { workbench.setSearch('항목 499'); });
  assert.deepEqual(await page.evaluate(() => workbench.view.map(item => item.id)), ['490', '499']);
  record('Virtual group/summary and tree windows map logical data rows correctly across focus, Delete/undo and ancestor-preserving search');

  await scenario('compat');
  await page.evaluate(() => { primaryView.orderBy('quantity', 'descending'); primaryView.setCurrent({ dataRow: 0, column: 'quantity' }); });
  assert.equal(await page.evaluate(() => primaryView.getCurrent().dataRow), 0);
  await cell(1, 1).dblclick(); await page.locator('#workbench td input').fill('42'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => provider.getValue(0, 'quantity')), 42); assert.equal(await cell(0, 1, 'mirror').innerText(), '42');
  await page.evaluate(() => secondaryView.undo()); assert.equal(await page.evaluate(() => provider.getValue(0, 1)), 5); assert.equal(await cell(0, 1, 'mirror').innerText(), '5');
  await page.evaluate(() => secondaryView.redo());
  await cell(0, 0, 'mirror').dblclick(); const editing = page.locator('#mirror td input'); await editing.fill('작성 중');
  await page.evaluate(() => provider.setValue(0, 'name', '외부 변경')); assert.equal(await editing.inputValue(), '작성 중');
  assert.equal(await page.evaluate(() => secondaryView.commit()), false); await editing.press('Escape'); assert.equal(await cell(0, 0, 'mirror').innerText(), '외부 변경');
  await page.evaluate(() => { secondaryView.setEditOptions({ editable: false }); secondaryView.grid.select({ row: 0, col: 0 }); });
  assert.equal(await page.evaluate(() => secondaryView.grid.paste('차단')), false); assert.equal(await page.evaluate(() => secondaryView.grid.addRow()), false); assert.equal(await page.evaluate(() => secondaryView.grid.deleteSelectedRows()), false);
  assert.equal(await page.evaluate(() => { try { primaryView.setDisplayOptions({ rowHeight: 22 }); return ''; } catch (error) { return error.name; } }), 'UnsupportedFeatureError');
  await page.screenshot({ path: path.join(output, 'compat-shared-provider.png'), fullPage: true });
  record('Public API subset shares one provider/history across views, maps sorted rows, preserves conflicting edits and enforces per-view readonly');

  await scenario('formulas'); await cell(0, 0).click();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Process', code: 'KeyG', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 });
  const input = page.locator('#workbench td input'); await input.waitFor();
  await page.evaluate(() => {
    window.imeEvents = [];
    const input = workbench.editor.input;
    for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'input']) input.addEventListener(type, event => imeEvents.push({ type, data: event.data, value: input.value }));
    window.imeInput = input;
  });
  await cdp.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '한글', selectionStart: 2, selectionEnd: 2 });
  await page.evaluate(() => { workbench.editor.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })); workbench.editor.input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })); workbench.editor.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', isComposing: true, bubbles: true, cancelable: true })); });
  assert.equal(await page.evaluate(() => workbench.editor.input === window.imeInput), true); assert.equal(await page.evaluate(() => workbench.getData()[0].name), '키보드');
  await cdp.send('Input.insertText', { text: '한글' }); await page.waitForTimeout(50); await input.press('Enter');
  assert.equal(await cell(0, 0).innerText(), '한글'); assert.ok(await page.evaluate(() => imeEvents.some(event => event.type === 'compositionend')));
  await page.keyboard.press('Control+z'); assert.equal(await cell(0, 0).innerText(), '키보드'); await page.keyboard.press('Control+y'); assert.equal(await cell(0, 0).innerText(), '한글');
  await writeFile(path.join(output, 'ime-events.json'), JSON.stringify(await page.evaluate(() => imeEvents), null, 2));
  await cdp.detach();
  record('Chromium IME composition pipeline retains the editor node, ignores composing Enter/Tab, commits Korean text once, and supports undo/redo');

  for (const width of [320, 375, 640, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(40);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `overflow ${width}`);
    await page.screenshot({ path: path.join(output, `formulas-${width}.png`), fullPage: true });
  }
  record('Formula example has no document overflow at seven viewport widths from 320 to 2560px');
  const offline = await context.newPage(); let http = 0; offline.on('request', request => { if (/^https?:/.test(request.url())) http++; }); offline.on('pageerror', error => errors.push(error.message));
  await offline.goto(pathToFileURL(path.resolve('examples/advanced/index.html')).href); await offline.selectOption('#scenario', 'compat'); assert.equal(await offline.evaluate(() => provider.getRowCount()), 3); await offline.close(); assert.equal(http, 0);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []); record('Standalone file:// compatibility example works with zero external requests and no page errors');
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ checks, timings, errors, requests, environment: { browser: browser.version(), node: process.version, os: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model, viewport: '1440x1000', headless: true }, ime: 'CDP composition pipeline only; Windows native IME not tested' }, null, 2));
} finally { await browser.close(); }
