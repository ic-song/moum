import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const DEMO_URL = process.env.MOUM_DEMO_URL || 'http://127.0.0.1:4173';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'output/playwright/advanced'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `${DEMO_URL}` });
const page = await context.newPage(), errors = [], remoteRequests = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(`${DEMO_URL}/`)) remoteRequests.push(request.url()); });
const cell = (row, col) => page.locator(`td[data-row="${row}"][data-col="${col}"]`);
const data = () => page.evaluate(() => grid.getData());
const record = name => { checks.push(name); console.log('PASS', name); };
const reset = async () => { await page.selectOption('#example-mode', 'plain'); await page.getByRole('button', { name: '예제 초기화', exact: true }).click(); };
const clipboard = async (text, html) => page.evaluate(async ({ text, html }) => {
  if (html) await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
  else await navigator.clipboard.writeText(text);
}, { text, html });
try {
  await page.goto(`${DEMO_URL}/examples/grid/index.html`); const baseline = await data();
  await clipboard('엑셀 물품\t분류\t1,234\t12,500.50\t총무\t"첫줄\n둘째줄"', '<table><tr><td>엑셀 물품</td><td>분류</td><td x:num="1234">1,234</td><td x:num="12500.5">12,500.50</td><td>총무</td><td>첫줄<br>둘째줄</td></tr></table>');
  await cell(0, 1).click(); await page.keyboard.press('Control+v');
  let rows = await data(); assert.equal(rows[0].quantity, 1234); assert.equal(rows[0].price, 12500.5); assert.equal(rows[0].note, '첫줄\n둘째줄');
  await page.keyboard.press('Control+z'); assert.deepEqual(await data(), baseline); await page.keyboard.press('Control+y'); assert.equal((await data())[0].quantity, 1234);
  record('HTML and TSV Excel clipboard values paste with formatted numbers and multiline cells, undo/redo atomically');

  await reset();
  await page.evaluate(() => {
    grid.select({ row: 0, col: 1 }); const transfer = new DataTransfer();
    transfer.setData('text/html', '<table><tr><td>안전<img src="https://invalid.example/moum.png"><script>window.pastedScriptRan=true</script></td><td>분류</td></tr></table>');
    document.querySelector('td[tabindex="0"]').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
  });
  assert.equal((await data())[0].name, '안전'); assert.equal(await page.evaluate(() => window.pastedScriptRan), undefined);
  assert.equal(await page.locator('.moum-grid img').count(), 0); record('Pasted HTML is parsed inertly without executing scripts or requesting images');

  await reset(); await page.evaluate(() => grid.setData([]));
  await clipboard('무시코드\t신규1\t사무\t1,234\t20,000\t총무\t메모\t\r\n무시2\t신규2\t전산\t2\t300\t개발\t\t');
  await page.getByRole('grid').focus(); await page.keyboard.press('Control+v'); rows = await data();
  assert.equal(rows.length, 2); assert.equal(rows[0].name, '신규1'); assert.equal(rows[0].quantity, 1234); assert.equal(rows[0].code, '');
  await page.keyboard.press('Control+z'); assert.equal((await data()).length, 0);
  await page.keyboard.press('Control+y'); assert.equal((await data()).length, 2);
  record('Pasting into an empty registration grid appends rows and a single undo removes the whole paste');

  await reset(); await page.getByRole('button', { name: '행 추가', exact: true }).click(); assert.equal((await data()).length, 17);
  await page.keyboard.press('Control+z'); assert.deepEqual(await data(), baseline); await page.keyboard.press('Control+y'); assert.equal((await data()).length, 17);
  await reset(); await page.evaluate(() => { grid.setSorts([{ field: 'quantity', direction: 'asc' }]); grid.select({ row: 0, col: 1 }); });
  const targetCode = await cell(0, 0).innerText(); await page.getByRole('button', { name: '선택 행 삭제', exact: true }).click();
  assert(!(await data()).some(row => row.code === targetCode)); await page.keyboard.press('Control+z'); assert.deepEqual(await data(), baseline);
  record('Row insertion/deletion and undo/redo work after sorting with original record mapping');

  await reset(); await page.getByRole('button', { name: '필터', exact: true }).click();
  const panel = page.getByRole('region', { name: '조건 필터' });
  await panel.getByLabel('컬럼', { exact: true }).selectOption('quantity'); await panel.getByLabel('조건', { exact: true }).selectOption('between');
  await panel.getByLabel('기준 값', { exact: true }).fill('8'); await panel.getByLabel('끝 값', { exact: true }).fill('20'); await panel.getByRole('button', { name: '조건 추가', exact: true }).click();
  const quantities = await page.locator('td[data-col="3"][data-row]').allTextContents(); assert(quantities.length > 0 && quantities.every(text => +text >= 8 && +text <= 20));
  await panel.getByRole('button', { name: '필터 초기화', exact: true }).click(); assert.equal(await page.locator('td[data-row][data-col="0"]').count(), 16);
  await page.evaluate(() => grid.setFilters([{ field: 'quantity', operator: 'gt', value: 90 }, { field: 'team', operator: 'equals', value: '개발팀' }]));
  assert.equal(await page.locator('td[data-row][data-col="0"]').count(), 0);
  await panel.getByLabel('조건 연결', { exact: true }).selectOption('or'); assert.equal(await page.locator('td[data-row][data-col="0"]').count(), 4);
  await panel.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await page.screenshot({ path: path.join(output, 'filters.png'), fullPage: true }); record('Conditional filter UI accepts a numeric range and resets without changing source data');

  await page.locator('thead th[data-col="2"] button').click(); await page.locator('thead th[data-col="3"] button').click({ modifiers: ['Shift'] });
  const sortState = await page.evaluate(() => ({ sorts: grid.sorts, ids: grid.view.map(item => item.row.code) }));
  assert.deepEqual(sortState.sorts, [{ field: 'category', direction: 1 }, { field: 'quantity', direction: 1 }]);
  const expected = [...baseline].sort((a, b) => a.category.localeCompare(b.category, 'ko', { numeric: true }) || a.quantity - b.quantity).map(row => row.code);
  assert.deepEqual(sortState.ids, expected); record('Shift+header multi-sort preserves ordered sort priorities');

  await reset(); const handle = page.getByRole('separator', { name: '품목명 너비', exact: true }); const bounds = await handle.boundingBox();
  const before = await page.evaluate(() => grid.columns[1].width);
  await page.mouse.move(bounds.x + 5, bounds.y + 10); await page.mouse.down(); await page.mouse.move(bounds.x + 47, bounds.y + 10, { steps: 6 }); await page.mouse.up();
  assert((await page.evaluate(() => grid.columns[1].width)) >= before + 40);
  await handle.focus(); const widthBeforeKey = await handle.getAttribute('aria-valuenow'); await handle.press('ArrowRight'); assert.equal(+(await handle.getAttribute('aria-valuenow')), +widthBeforeKey + 10);
  await page.getByLabel('고정 열', { exact: true }).selectOption('1'); await page.setViewportSize({ width: 720, height: 1000 });
  await page.waitForTimeout(100); const fixedBefore = await cell(0, 0).boundingBox();
  await page.locator('.moum-grid__viewport').evaluate(element => { element.scrollLeft = 350; });
  const fixedAfter = await cell(0, 0).boundingBox(); assert(Math.abs(fixedAfter.x - fixedBefore.x) < 2);
  await page.screenshot({ path: path.join(output, 'frozen-columns.png'), fullPage: true });
  await page.getByLabel('고정 열', { exact: true }).selectOption('0'); await page.setViewportSize({ width: 1440, height: 1000 });
  record('Column widths resize by mouse/keyboard and frozen columns remain fixed while scrolling and resizing the viewport');

  await reset(); await page.selectOption('#example-mode', 'group');
  assert((await page.locator('.moum-grid__subtotal').count()) > 0); const initialVisible = await page.locator('td[data-col="0"][data-row]').count();
  await page.locator('.moum-grid__group button').first().click(); assert((await page.locator('td[data-col="0"][data-row]').count()) < initialVisible);
  await page.locator('.moum-grid__group button').first().focus(); await page.keyboard.press('Enter'); assert.equal(await page.locator('td[data-col="0"][data-row]').count(), initialVisible);
  await cell(0, 3).click(); await page.keyboard.press('Delete'); await page.keyboard.press('Control+z'); assert.deepEqual(await data(), baseline);
  await page.screenshot({ path: path.join(output, 'groups.png'), fullPage: true }); record('Nested groups, numeric subtotals, keyboard collapse/expand, and data undo coexist');

  await page.selectOption('#example-mode', 'tree'); const originalTree = await data(); assert.equal(originalTree.length, 6);
  await page.getByRole('button', { name: '운영본부 접기', exact: true }).click(); assert.equal(await page.locator('td[data-row][data-col="0"]').count(), 1);
  await page.getByRole('button', { name: '운영본부 펼치기', exact: true }).focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('td[data-row][data-col="0"]').count(), 6);
  await page.getByRole('searchbox').fill('무선 키보드'); assert.equal(await page.locator('td[data-row][data-col="0"]').count(), 3); await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: '전산 자산 접기', exact: true }).click(); await cell(1, 1).click(); await page.keyboard.press('Control+Delete');
  assert.equal((await data()).length, 3); await page.keyboard.press('Control+z'); assert.deepEqual(await data(), originalTree);
  await page.screenshot({ path: path.join(output, 'tree.png'), fullPage: true }); record('Tree expansion, ancestor-preserving search, descendant deletion and atomic undo work together');

  await reset(); await cell(0, 1).click(); await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Shift+ArrowDown');
  await page.getByRole('button', { name: '셀 병합', exact: true }).click();
  assert.equal(await cell(0, 1).getAttribute('rowspan'), '2'); assert.equal(await cell(0, 1).getAttribute('colspan'), '2'); assert.deepEqual(await data(), baseline);
  await cell(0, 1).click(); await clipboard('금지'); await page.keyboard.press('Control+v'); assert.deepEqual(await data(), baseline);
  assert.match(await page.locator('.moum-grid__status').innerText(), /병합/);
  await page.keyboard.press('Delete'); assert.equal((await data())[1].category, ''); await page.keyboard.press('Control+z'); assert.deepEqual(await data(), baseline);
  const mergedDownloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '엑셀 다운로드', exact: true }).click();
  await (await mergedDownloadPromise).saveAs(path.join(output, 'merged.xlsx'));
  await page.screenshot({ path: path.join(output, 'merged.png'), fullPage: true });
  await page.getByRole('button', { name: '병합 해제', exact: true }).click(); assert.equal(await cell(1, 2).count(), 1); assert.deepEqual(await data(), baseline);
  record('Cell merge/unmerge preserves hidden values, protects paste targets and expands Delete/undo to the full merged region');

  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: '엑셀 다운로드', exact: true }).click();
  const download = await downloaded, exportedPath = path.join(output, 'exported.xlsx'); await download.saveAs(exportedPath);
  const exported = await readFile(exportedPath); assert.equal(exported[0], 0x50); assert.equal(exported[1], 0x4b);
  await page.locator('input[type=file]').setInputFiles(exportedPath); await page.waitForFunction(() => grid.model.rows.length === 16 && grid.model.canUndo);
  assert.equal((await data())[0].name, baseline[0].name); await page.getByRole('button', { name: '되돌리기', exact: true }).click(); assert.deepEqual(await data(), baseline);
  await page.getByRole('button', { name: '다시 실행', exact: true }).click(); assert.equal((await data())[0].price, baseline[0].price);
  record('Real XLSX download/import roundtrip succeeds and file replacement has one-step undo/redo');

  await reset(); const fakePath = path.join(output, 'invalid.xlsx'); await writeFile(fakePath, 'not a workbook');
  await page.locator('input[type=file]').setInputFiles(fakePath); await page.waitForFunction(() => document.querySelector('.moum-grid__status').textContent.includes('올바른 XLSX'));
  assert.deepEqual(await data(), baseline); record('Invalid XLSX files do not mutate data or history');

  const race = await page.evaluate(async () => {
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['품목명'], ['늦게 읽은 파일']]), '데이터');
    const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }); let release;
    const loading = grid.importXLSX({ size: bytes.byteLength, arrayBuffer: () => new Promise(resolve => { release = resolve; }) });
    grid.addRow({ name: '파일 읽는 중 편집' }); release(bytes);
    return { applied: await loading, data: grid.getData(), message: document.querySelector('.moum-grid__status').textContent };
  });
  assert.equal(race.applied, false); assert.equal(race.data.length, 17); assert.equal(race.data[16].name, '파일 읽는 중 편집'); assert.match(race.message, /데이터가 변경/);
  record('Late asynchronous XLSX reads cannot overwrite edits made while a file is being read');

  const lifecycle = await page.evaluate(async () => {
    const host = document.createElement('div'); document.body.append(host); let rejected = false;
    try { new MoumGrid(host, { columns: [{ field: 'id' }, { field: 'parent' }, { field: 'name' }], data: [{ id: 'A', parent: 'missing', name: '잘못된 트리' }], tree: { idField: 'id', parentField: 'parent', labelField: 'name' } }); }
    catch { rejected = true; }
    const cleaned = host.childNodes.length === 0;
    const readonly = new MoumGrid(host, { columns: [{ field: 'name' }], data: [{ name: '보호 값' }], editable: false });
    const blocked = !readonly.paste('변경') && !readonly.addRow() && !readonly.deleteSelectedRows() && !await readonly.importXLSX(new ArrayBuffer(0));
    const protectedValue = readonly.getData()[0].name; readonly.destroy(); const destroyed = host.childNodes.length === 0; host.remove();
    return { rejected, cleaned, blocked, protectedValue, destroyed };
  });
  assert.deepEqual(lifecycle, { rejected: true, cleaned: true, blocked: true, protectedValue: '보호 값', destroyed: true });
  record('Invalid construction cleans up its DOM and readonly grids block row, clipboard and file mutations');

  let nativeExcelFixture = 'not available';
  try {
    const fixture = JSON.parse(await readFile(path.join(root, 'output/excel-fixture/clipboard.json'), 'utf8'));
    await reset(); await clipboard(fixture.plainText, fixture.html); await cell(0, 1).click(); await page.keyboard.press('Control+v');
    const imported = await data();
    for (let index = 0; index < fixture.expected.length; index++) for (const [key, value] of Object.entries(fixture.expected[index])) assert.equal(imported[index][key], value);
    await page.keyboard.press('Control+z'); assert.deepEqual(await data(), baseline);
    await page.locator('input[type=file]').setInputFiles(path.join(root, 'output/excel-fixture/excel-source.xlsx'));
    await page.waitForFunction(() => grid.model.rows[0]?.code === '00123');
    assert.equal((await data())[0].price, 12500.5); assert.equal((await data())[0].note, '첫줄\n둘째줄');
    nativeExcelFixture = fixture.source; record('Actual Excel-created XLSX and copied-range HTML/TSV preserve numbers, leading-zero codes, tabs and multiline values');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  const offline = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 } }), local = await offline.newPage();
  const localRequests = [], localErrors = [];
  local.on('request', request => { if (/^https?:/.test(request.url())) localRequests.push(request.url()); }); local.on('pageerror', error => localErrors.push(error.message));
  await local.goto(pathToFileURL(path.join(root, 'examples/grid/index.html')).href);
  const localDownload = local.waitForEvent('download'); await local.getByRole('button', { name: '엑셀 다운로드', exact: true }).click(); await localDownload;
  await local.selectOption('#example-mode', 'group'); assert((await local.locator('.moum-grid__subtotal').count()) > 0);
  await local.selectOption('#example-mode', 'tree'); assert.equal(await local.locator('td[data-col="0"][data-row]').count(), 6);
  assert.deepEqual(localRequests, []); assert.deepEqual(localErrors, []); await offline.close(); record('XLSX export, grouping and tree modes work from file:// offline with zero HTTP requests');
  assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ checkedAt: new Date().toISOString(), browser: browser.version(), checks, nativeExcelFixture, errors, remoteRequests }, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
