import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const DEMO_URL = process.env.MOUM_DEMO_URL || 'http://127.0.0.1:4173';
const output = 'output/playwright/recovery'; await mkdir(output, { recursive: true });
const axe = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8'), reports = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true }), checks = [], errors = [];
  const record = text => { checks.push(text); console.log('PASS', name, text); };
  async function open(context, mode = 'local') {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    await page.goto(`${DEMO_URL}/examples/recovery/index.html?mode=${mode}`);
    await page.evaluate(() => recoveryGrid.recoveryReady); if (mode === 'server') await page.evaluate(() => recoveryGrid.ready);
    return page;
  }
  const edit = async (page, value, col = 1, commit = true) => { await page.locator(`td[data-row="0"][data-col="${col}"]`).click(); await page.keyboard.press('F2'); await page.locator('td input').fill(value); if (commit) await page.keyboard.press('Enter'); };
  const reload = async page => { await page.reload(); await page.evaluate(() => recoveryGrid.recoveryReady); };
  try {
    {
      const context = await browser.newContext(), page = await open(context);
      await edit(page, '확정된 변경'); await page.evaluate(() => { recoveryGrid.addRow({ name: '추가 복구 행' }); recoveryGrid.select({ row: 1, col: 1 }); recoveryGrid.deleteSelectedRows(); });
      await edit(page, '숫자 아님', 3, false); assert.equal(await page.evaluate(() => recoveryGrid.flushDraft()), true);
      await reload(page); assert.equal(await page.evaluate(() => recoveryGrid.editable), false); assert.equal(await page.evaluate(() => recoveryGrid.getRecoveryState().status), 'available');
      assert.equal(await page.evaluate(() => recoveryGrid.restoreDraft()), true); assert.equal(await page.locator('td input').inputValue(), '숫자 아님');
      assert.equal(await page.evaluate(() => recoveryGrid.finishEdit()), false); assert.equal(await page.evaluate(() => recoveryGrid.getData()[0].name), '확정된 변경'); assert.equal(await page.evaluate(() => recoveryGrid.model.rows.length), 2);
      await page.keyboard.press('Escape'); await page.evaluate(() => recoveryGrid.flushDraft()); assert.equal(await page.evaluate(() => recoveryGrid.model.canUndo), false);
      assert.equal(await page.evaluate(() => recoveryGrid.setData([])), false); assert.equal(await page.evaluate(() => recoveryGrid.discardChanges()), true); assert.equal(await page.evaluate(() => recoveryGrid.getData()[0].name), '미저장 복구 품목');
      await reload(page); assert.equal(await page.evaluate(() => recoveryGrid.getRecoveryState().candidates), 0);
      await edit(page, '호스트 저장 완료'); assert.equal(await page.evaluate(() => recoveryGrid.markSaved()), true); await reload(page); assert.equal(await page.evaluate(() => recoveryGrid.getRecoveryState().candidates), 0);
      record('Committed CRUD and invalid active editor survive refresh; explicit restore/markSaved/discard and dirty setData guard work'); await context.close();
    }
    {
      const context = await browser.newContext(), first = await open(context), second = await open(context);
      await edit(first, '탭 A'); await first.evaluate(() => recoveryGrid.flushDraft()); const id = await first.evaluate(() => recoveryGrid.recovery.id);
      await edit(second, '탭 B'); await second.evaluate(() => recoveryGrid.flushDraft());
      const third = await open(context); assert.equal(await third.evaluate(() => recoveryGrid.getRecoveryState().candidates), 2); assert.equal(await third.evaluate(id => recoveryGrid.restoreDraft(id), id), true);
      assert.equal(await third.evaluate(() => recoveryGrid.getData()[0].name), '탭 A'); assert.equal(await third.evaluate(async () => (await recoveryGrid.recovery.storage.list(recoveryGrid.recovery.key)).some(item => JSON.parse(item.data).rows[0].name === '탭 B')), true);
      record('Simultaneous tabs retain independent drafts and restoring one does not replace the other'); await context.close();
    }
    {
      const context = await browser.newContext(), page = await open(context);
      await edit(page, '이전 스키마 데이터'); await page.evaluate(async () => { await recoveryGrid.flushDraft(); const storage = recoveryGrid.recovery.storage, item = (await storage.list(recoveryGrid.recovery.key))[0]; await storage.put({ ...item, schema: 'incompatible-v2' }); });
      await reload(page); assert.equal(await page.evaluate(() => recoveryGrid.restoreDraft()), false); assert.match(await page.locator('.moum-grid__status').innerText(), /스키마/);
      const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '복구본 내려받기', exact: true }).click(); assert.equal(await (await pending).failure(), null);
      assert.equal(await page.evaluate(() => recoveryGrid.getRecoveryState().candidates), 1); assert.equal(await page.evaluate(() => recoveryGrid.discardDraft()), true);
      assert.equal(await page.evaluate(() => { const host = document.createElement('div'); document.body.append(host); try { new MoumGrid(host, { columns: [{ field: 'name' }], recovery: { key: '' } }); return false; } catch { const clean = host.childNodes.length === 0; host.remove(); return clean; } }), true);
      record('Schema mismatch refuses automatic restoration, preserves the record and allows download or explicit deletion'); await context.close();
    }
    {
      const context = await browser.newContext(), page = await open(context, 'server');
      await page.evaluate(() => { recoveryGrid.setPageSize(7); recoveryGrid.setFilters([{ field: 'category', operator: 'equals', value: '사무' }], { logic: 'or' }); }); await page.evaluate(() => recoveryGrid.ready); await page.evaluate(() => recoveryGrid.setPage(1)); await page.evaluate(() => recoveryGrid.ready);
      const id = await page.evaluate(() => recoveryGrid.model.rows[0].id); await edit(page, '조회 구간 복구'); await page.evaluate(() => recoveryGrid.flushDraft()); await reload(page); await page.evaluate(() => recoveryGrid.ready); assert.equal(await page.evaluate(() => recoveryGrid.restoreDraft()), true);
      assert.equal(await page.evaluate(() => recoveryGrid.model.rows[0].id), id); assert.equal(await page.evaluate(() => recoveryGrid.pageIndex), 1); assert.equal(await page.evaluate(() => recoveryGrid.pageSize), 7);
      assert.equal(await page.evaluate(() => recoveryGrid.logicSelect.value), 'or'); assert.match(await page.locator('.moum-grid__filter-list').innerText(), /사무/); await page.evaluate(() => recoveryGrid.discardChanges()); await page.evaluate(() => recoveryGrid.flushDraft());
      record('Remote page size/index, row identity and OR filter controls restore together with the unsaved edit'); await context.close();
    }
    {
      const context = await browser.newContext(), page = await open(context);
      await edit(page, '저장 완료본'); await page.evaluate(async () => { await recoveryGrid.flushDraft(); window.originalPut = recoveryGrid.recovery.storage.put.bind(recoveryGrid.recovery.storage); recoveryGrid.recovery.storage.put = () => Promise.reject(new DOMException('disk full', 'QuotaExceededError')); });
      await edit(page, '기록 실패본'); assert.equal(await page.evaluate(() => recoveryGrid.flushDraft()), false); assert.equal(await page.evaluate(() => recoveryGrid.getRecoveryState().status), 'error');
      assert.equal(await page.evaluate(async () => JSON.parse((await recoveryGrid.recovery.storage.list(recoveryGrid.recovery.key))[0].data).rows[0].name), '저장 완료본');
      await page.evaluate(() => { recoveryGrid.recovery.storage.put = originalPut; }); assert.equal(await page.evaluate(() => recoveryGrid.flushDraft()), true);
      await reload(page); assert.equal(await page.evaluate(() => recoveryGrid.restoreDraft()), true); assert.equal(await page.evaluate(() => recoveryGrid.getData()[0].name), '기록 실패본');
      record('Quota failure remains visible and preserves the last completed draft; explicit retry writes the latest data'); await context.close();
    }
    {
      const context = await browser.newContext(), page = await open(context, 'server');
      const initial = await page.evaluate(() => recoveryGrid.remote.total); const label = `응답 복구 ${name} ${Date.now()}`;
      await page.evaluate(label => recoveryGrid.addRow({ name: label }), label); await page.check('#drop-reply'); assert.equal(await page.evaluate(() => recoveryGrid.saveChanges()), false);
      const requestId = await page.evaluate(() => recoveryGrid.getSaveState().requestId); await page.evaluate(() => recoveryGrid.flushDraft()); await reload(page); await page.evaluate(() => recoveryGrid.ready);
      assert.equal(await page.evaluate(() => recoveryGrid.restoreDraft()), true); assert.equal(await page.evaluate(() => recoveryGrid.getSaveState().requestId), requestId); assert.equal(await page.evaluate(() => recoveryGrid.getSaveState().status), 'uncertain');
      assert.equal(await page.evaluate(() => recoveryGrid.saveChanges()), true); assert.equal(await page.evaluate(() => recoveryGrid.remote.total), initial + 1); await page.evaluate(() => recoveryGrid.flushDraft());
      await page.evaluate(label => recoveryGrid.setSearch(label), label); await page.evaluate(() => recoveryGrid.ready); assert.equal(await page.evaluate(() => recoveryGrid.model.rows.length), 1);
      await page.evaluate(() => { recoveryGrid.select({ row: 0, col: 1 }); recoveryGrid.deleteSelectedRows(); }); assert.equal(await page.evaluate(() => recoveryGrid.saveChanges()), true); await page.evaluate(() => recoveryGrid.flushDraft());
      record('A post-commit lost reply survives refresh with the same request ID, reconciles exactly once and clears the acknowledged draft'); await context.close();
    }
    {
      const context = await browser.newContext(), page = await open(context, 'server');
      let writes = 0; page.on('request', request => { if (request.url().endsWith('/api/grid-edit/save')) writes++; });
      await page.evaluate(() => { recoveryGrid.recovery.maxBytes = 1024; recoveryGrid.addRow({ name: 'x'.repeat(5000) }); }); assert.equal(await page.evaluate(() => recoveryGrid.saveChanges()), false); assert.equal(writes, 0); assert.equal(await page.evaluate(() => recoveryGrid.getSaveState().status), 'error');
      record('A pending request that cannot be durably recorded never reaches the HTTP save endpoint'); await context.close();
    }
    {
      const context = await browser.newContext(), page = await open(context, 'server'); const label = `갱신 복구 ${name} ${Date.now()}`;
      await page.evaluate(() => recoveryGrid.setDataMode('infinite')); await page.evaluate(() => recoveryGrid.ready);
      await page.evaluate(label => { recoveryGrid.addRow({ name: label }); window.loadOriginal = recoveryGrid.remote.source.load; recoveryGrid.remote.source.load = () => { throw Error('refresh offline'); }; }, label);
      assert.equal(await page.evaluate(() => recoveryGrid.saveChanges()), true); assert.equal(await page.evaluate(() => recoveryGrid.getSaveState().status), 'refresh'); await page.evaluate(() => recoveryGrid.flushDraft());
      await reload(page); await page.evaluate(() => recoveryGrid.ready); assert.equal(await page.evaluate(() => recoveryGrid.restoreDraft()), true); assert.equal(await page.evaluate(() => recoveryGrid.getSaveState().status), 'idle');
      await page.evaluate(label => recoveryGrid.setSearch(label), label); await page.evaluate(() => recoveryGrid.ready); assert.equal(await page.evaluate(() => recoveryGrid.model.rows.length), 1); await page.evaluate(() => { recoveryGrid.select({ row: 0, col: 1 }); recoveryGrid.deleteSelectedRows(); }); await page.evaluate(() => recoveryGrid.saveChanges()); await page.evaluate(() => recoveryGrid.flushDraft());
      record('Confirmed save plus failed infinite refresh recovers canonical data and resumes reading without resending a write'); await context.close();
    }
    {
      const context = await browser.newContext(), page = await open(context);
      await edit(page, '접근성 복구'); await page.evaluate(() => recoveryGrid.flushDraft()); await reload(page); await page.evaluate(axe);
      const accessibility = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })); assert.deepEqual(accessibility.violations.map(item => item.id), []);
      await page.screenshot({ path: `${output}/${name}-available.png`, fullPage: true });
      for (const width of [320, 390, 639, 640, 641, 768, 1024, 1440, 1920]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} overflow ${width}`); }
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(50); await page.screenshot({ path: `${output}/${name}-mobile.png`, fullPage: true });
      assert.deepEqual(errors, []); record('Pending recovery controls pass automated WCAG checks and nine widths without page overflow or uncaught errors');
      await writeFile(`${output}/${name}-axe.json`, JSON.stringify({ violations: accessibility.violations, incomplete: accessibility.incomplete.map(item => item.id) }, null, 2)); await context.close();
    }
    reports.push({ engine: name, browser: browser.version(), checks, errors });
  } finally { await browser.close(); }
}
await writeFile(`${output}/results.json`, JSON.stringify(reports, null, 2));
