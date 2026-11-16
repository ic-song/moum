// Optional development harness. Runtime/build/model tests do not need Playwright.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
const DEMO_URL = process.env.MOUM_DEMO_URL || 'http://127.0.0.1:4173';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'output/playwright'); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const origin = `${DEMO_URL}`;
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
const page = await context.newPage(), errors = [], remoteRequests = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + '/')) remoteRequests.push(request.url()); });
const cell = (row, col) => page.locator(`td[data-row="${row}"][data-col="${col}"]`);
const data = () => page.evaluate(() => grid.getData());
const selectedCount = () => page.locator('td.is-selected').count();
const record = name => { checks.push(name); console.log('PASS', name); };
const selectBlock = async () => { await cell(0, 1).click(); await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Shift+ArrowDown'); };
try {
  await page.goto(origin + '/examples/grid/index.html');
  const initial = await data(); assert.equal(initial.length, 16);
  await selectBlock(); assert.equal(await selectedCount(), 4);
  await page.keyboard.press('Shift+ArrowUp'); assert.equal(await selectedCount(), 2);
  await page.keyboard.press('Shift+ArrowDown'); record('Shift+arrows expand and contract a range');

  await page.keyboard.press('Delete');
  let rows = await data(); assert.equal(rows[0].name, ''); assert.equal(rows[1].category, ''); assert.equal(rows.length, 16);
  await page.keyboard.press('Control+z'); assert.deepEqual(await data(), initial);
  await page.keyboard.press('Control+y'); assert.equal((await data())[1].name, '');
  await page.keyboard.press('Control+z'); record('Delete / Ctrl+Z / Ctrl+Y operate on the whole selected block');

  const start = await cell(1, 1).boundingBox(), end = await cell(3, 2).boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 }); await page.mouse.up();
  assert.equal(await selectedCount(), 6); record('Mouse drag selects a rectangular range');

  await selectBlock(); await page.keyboard.press('Control+c');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(copied.replace(/\r\n/g, '\n'), '무선 키보드\t전산용품\n유선 마우스\t전산용품');
  record('Actual Ctrl+C writes Excel-compatible TSV to the browser clipboard');

  await page.evaluate(() => navigator.clipboard.writeText('품목A\t사무용품\r\n품목B\t전산용품'));
  await cell(0, 1).click(); await page.keyboard.press('Control+v');
  assert.equal((await data())[0].name, '품목A'); assert.equal((await data())[1].name, '품목B');
  await page.keyboard.press('Control+z'); assert.deepEqual(await data(), initial);
  await page.keyboard.press('Control+y'); assert.equal((await data())[1].name, '품목B');
  await page.keyboard.press('Control+z'); record('Actual Ctrl+V multi-cell paste is one undo/redo transaction');

  await page.evaluate(() => navigator.clipboard.writeText('부분 변경 금지\t분류\t숫자아님'));
  await cell(0, 1).click(); await page.keyboard.press('Control+v');
  assert.deepEqual(await data(), initial); assert.match(await page.locator('.moum-grid__status').innerText(), /숫자/);
  record('Invalid paste is atomic and reports a validation error');

  await cell(0, 0).click(); await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Delete');
  assert.equal((await data())[0].code, initial[0].code); assert.equal((await data())[0].name, '');
  await page.keyboard.press('Control+z'); assert.deepEqual(await data(), initial);
  record('Readonly cells survive range Delete and undo');

  await cell(0, 1).dblclick(); const editor = page.getByRole('textbox', { name: '품목명 편집' });
  await editor.fill('직접 편집'); await editor.press('Enter'); assert.equal((await data())[0].name, '직접 편집');
  await page.keyboard.press('Control+z'); assert.deepEqual(await data(), initial);
  await cell(0, 1).dblclick(); await editor.fill('취소'); await editor.press('Escape'); assert.deepEqual(await data(), initial);
  record('Single-cell editor commits, cancels and joins transaction history');

  await cell(0, 3).dblclick(); const numberEditor = page.getByRole('textbox', { name: '수량 편집' });
  await numberEditor.fill('oops'); await numberEditor.press('Enter');
  assert.equal(await numberEditor.getAttribute('aria-invalid'), 'true'); assert.deepEqual(await data(), initial);
  await numberEditor.press('Escape'); record('Invalid direct edit remains correctable and Escape restores focus');

  await page.getByRole('button', { name: '수량', exact: true }).click();
  const sortedCode = await cell(0, 0).innerText();
  await cell(0, 1).click(); await page.keyboard.press('Delete');
  rows = await data(); assert.equal(rows.find(row => row.code === sortedCode).name, '');
  await page.keyboard.press('Control+z'); assert.deepEqual(await data(), initial);
  await page.getByRole('searchbox').fill('무선 키보드'); assert.equal(await page.locator('tbody tr').count(), 1);
  await cell(0, 1).click(); await page.keyboard.press('Delete'); await page.getByRole('button', { name: '되돌리기', exact: true }).click();
  assert.deepEqual(await data(), initial); record('Sorted and filtered edits/undo target the original record');
  await page.getByRole('searchbox').fill('찾을수없는데이터'); assert.match(await page.locator('tbody').innerText(), /표시할 데이터가 없습니다/);
  await page.getByRole('searchbox').fill(''); record('Empty search state has readable feedback');

  await page.evaluate(() => { grid.setData([{ code: 'X', name: '<img src=x onerror=alert(1)>', category: '', quantity: 1, price: 2, team: '', note: '' }]); });
  assert.equal(await page.locator('.moum-grid img').count(), 0); assert.match(await cell(0, 1).innerText(), /<img/);
  const beforeOverflow = await data();
  await page.evaluate(() => grid.select({ row: 0, col: grid.columns.length - 1 }));
  await page.evaluate(() => navigator.clipboard.writeText('a\tb')); await page.keyboard.press('Control+v');
  assert.deepEqual(await data(), beforeOverflow); assert.match(await page.locator('.moum-grid__status').innerText(), /범위/);
  record('HTML values render as text and out-of-bounds paste is fully rejected');

  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV 내보내기', exact: true }).click();
  const download = await downloadPromise; const csvPath = path.join(out, 'sample.csv'); await download.saveAs(csvPath);
  assert.match(await readFile(csvPath, 'utf8'), /품목코드/); record('CSV download produces a readable file');
  assert.equal(remoteRequests.length, 0); assert.equal(errors.length, 0);

  const offline = await browser.newContext({ offline: true, viewport: { width: 1280, height: 800 } });
  const localPage = await offline.newPage(); const localErrors = [], localHttp = [];
  localPage.on('pageerror', error => localErrors.push(error.message));
  localPage.on('request', request => { if (/^https?:/.test(request.url())) localHttp.push(request.url()); });
  await localPage.goto(pathToFileURL(path.join(root, 'examples/grid/index.html')).href);
  assert.equal(await localPage.locator('tbody tr').count(), 16);
  await localPage.locator('td[data-row="0"][data-col="1"]').click(); await localPage.keyboard.press('Delete');
  assert.equal(await localPage.locator('td[data-row="0"][data-col="1"]').innerText(), '');
  await localPage.keyboard.press('Control+z'); assert.match(await localPage.locator('td[data-row="0"][data-col="1"]').innerText(), /무선/);
  assert.deepEqual(localErrors, []); assert.deepEqual(localHttp, []);
  await localPage.screenshot({ path: path.join(out, 'offline-file.png'), fullPage: true });
  await offline.close(); record('file:// demo works offline with zero HTTP requests, including Delete and undo');

  await writeFile(path.join(out, 'browser-check.json'), JSON.stringify({ checkedAt: new Date().toISOString(), browser: browser.version(), playwright: createRequire(import.meta.url)('playwright/package.json').version, checks, errors, remoteRequests, limitations: ['Actual Microsoft Excel application roundtrip not run', 'Native Korean IME and screen readers not tested', 'macOS shortcuts and other browser engines not tested'] }, null, 2));
} finally { await browser.close(); }
