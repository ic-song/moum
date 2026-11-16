import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.MOUM_DEMO_URL || 'http://127.0.0.1:4173', output = path.resolve('output/playwright/resilience');
await mkdir(output, { recursive: true }); const profile = await mkdtemp(path.join(output, 'crash-profile-'));
const executable = process.env.MOUM_CHROMIUM_EXECUTABLE || chromium.executablePath();
let child, browser; const checks = [], record = text => { checks.push(text); console.log('PASS', text); };
async function launch() {
  const listener = createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve)); const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  child = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => {});
  const endpoint = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode != null) throw Error(`Test browser exited: ${child.exitCode}`);
    try { const response = await fetch(`${endpoint}/json/version`); if (response.ok) break; } catch {}
    if (attempt === 149) throw Error('Test browser did not expose its local CDP endpoint.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.connectOverCDP(endpoint); const page = await browser.contexts()[0].newPage(); page.on('dialog', dialog => dialog.accept()); return page;
}
async function killOwnedBrowser() {
  assert.ok(child?.pid, 'Only the child created by this script may be killed'); const closed = once(child, 'close'); child.kill('SIGKILL'); await closed; child = null; browser = null;
}
async function open(page, mode) { await page.goto(`${base}/examples/recovery/index.html?mode=${mode}`); await page.evaluate(() => recoveryGrid.recoveryReady); if (mode === 'server') await page.evaluate(() => recoveryGrid.ready); }
let metrics;
try {
  let page = await launch(); await open(page, 'local');
  await page.locator('td[data-row="0"][data-col="1"]').click(); await page.keyboard.press('F2'); await page.locator('td input').fill('프로세스 종료 직전 미확정 한글');
  assert.equal(await page.evaluate(() => recoveryGrid.flushDraft()), true); await killOwnedBrowser();
  page = await launch(); await open(page, 'local'); assert.equal(await page.evaluate(() => recoveryGrid.getRecoveryState().status), 'available'); assert.equal(await page.evaluate(() => recoveryGrid.restoreDraft()), true);
  assert.equal(await page.locator('td input').inputValue(), '프로세스 종료 직전 미확정 한글'); await page.keyboard.press('Escape'); await page.evaluate(() => recoveryGrid.discardChanges());
  record('OS-level SIGKILL of an isolated browser process preserves the last completed draft and its uncommitted editor after profile reopen');

  await open(page, 'server'); const total = await page.evaluate(() => recoveryGrid.remote.total), label = `중단된 저장 ${Date.now()}`;
  await page.evaluate(label => { recoveryGrid.addRow({ name: label }); const original = recoveryGrid.remote.source.save; recoveryGrid.remote.source.save = async batch => { await original(batch); window.commitObserved = true; return new Promise(() => {}); }; window.interruptedSave = recoveryGrid.saveChanges(); }, label);
  await page.waitForFunction(() => window.commitObserved === true); const requestId = await page.evaluate(() => recoveryGrid.getSaveState().requestId); assert.equal(await page.evaluate(() => recoveryGrid.getSaveState().status), 'saving'); await killOwnedBrowser();
  page = await launch(); await open(page, 'server'); assert.equal(await page.evaluate(() => recoveryGrid.restoreDraft()), true); assert.equal(await page.evaluate(() => recoveryGrid.getSaveState().status), 'uncertain'); assert.equal(await page.evaluate(() => recoveryGrid.getSaveState().requestId), requestId);
  assert.equal(await page.evaluate(() => recoveryGrid.saveChanges()), true); assert.equal(await page.evaluate(() => recoveryGrid.remote.total), total + 1);
  await page.evaluate(label => recoveryGrid.setSearch(label), label); await page.evaluate(() => recoveryGrid.ready); assert.equal(await page.evaluate(() => recoveryGrid.model.rows.length), 1); await page.evaluate(() => { recoveryGrid.select({ row: 0, col: 1 }); recoveryGrid.deleteSelectedRows(); }); await page.evaluate(() => recoveryGrid.saveChanges()); await page.evaluate(() => recoveryGrid.flushDraft());
  record('Forced process death during a committed-but-unacknowledged save restores the exact request ID and reconciles without duplicate creation');

  await page.goto(`${base}/examples/quick-start/index.html`); const key = `stress:${Date.now()}`;
  const install = async () => { await page.evaluate(key => { grid.destroy(); window.stressGrid = new MoumGrid('#grid', { columns: [{ field: 'id', editable: false }, { field: 'qty', type: 'number' }], data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i), qty: i })), recovery: { key }, historyLimit: 100 }); }, key); await page.evaluate(() => stressGrid.recoveryReady); };
  await install(); const cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const before = await cdp.send('Memory.getDOMCounters'); const started = performance.now();
  for (let batch = 0; batch < 20; batch++) {
    const result = await page.evaluate(async batch => { for (let offset = 0; offset < 100; offset++) { const i = batch * 100 + offset, changes = stressGrid.mutateModel('apply', [{ row: i % 1000, field: 'qty', value: i + 1 }]); stressGrid.changed(changes, 'edit'); } return { flushed: await stressGrid.flushDraft(), rows: stressGrid.table.querySelectorAll('tbody tr').length, history: stressGrid.model.past.length }; }, batch);
    assert.equal(result.flushed, true); assert.ok(result.rows < 35); assert.ok(result.history <= 100);
    if (batch % 5 === 4) console.log('Stress committed edits', (batch + 1) * 100);
  }
  await page.evaluate(() => { for (let i = 0; i < 25; i++) { const host = document.createElement('div'); document.body.append(host); const instance = new MoumGrid(host, { columns: [{ field: 'name' }], data: Array.from({ length: 1000 }, () => ({ name: 'remount' })) }); instance.startEdit({ row: 0, col: 0 }); instance.destroy(); host.remove(); } });
  await cdp.send('HeapProfiler.collectGarbage'); const after = await cdp.send('Memory.getDOMCounters'); assert.ok(after.jsEventListeners - before.jsEventListeners < 100); assert.ok(after.nodes - before.nodes < 1000);
  metrics = { elapsedMs: Math.round(performance.now() - started), edits: 2000, rows: 1000, remounts: 25, before, after, browser: browser.version(), executable };
  await page.reload(); await install(); assert.equal(await page.evaluate(() => stressGrid.restoreDraft()), true); assert.equal(await page.evaluate(() => stressGrid.getData()[0].qty), 1001); assert.equal(await page.evaluate(() => stressGrid.getData()[999].qty), 2000); await page.evaluate(() => stressGrid.markSaved());
  record('2,000 edits with completed persistence and 25 mount/destroy cycles retain bounded DOM/history/listeners; the final data recovers after reload');
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, metrics, note: 'Controlled crash/stress scenarios are not a long-term production or power-loss guarantee.' }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (child && child.exitCode == null) { const closed = once(child, 'close'); child.kill('SIGKILL'); await closed; }
  const resolved = await realpath(profile), allowed = await realpath(output);
  if (path.dirname(resolved) !== allowed || !path.basename(resolved).startsWith('crash-profile-')) throw Error('Refusing cleanup outside this test profile directory.');
  await rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
