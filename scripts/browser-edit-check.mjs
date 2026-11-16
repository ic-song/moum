import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const DEMO_URL = process.env.MOUM_DEMO_URL || 'http://127.0.0.1:4173';
const output = 'output/playwright/server-edit'; await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url), axe = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8'), reports = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true }), page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), checks = [], errors = [], saves = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (request.url().endsWith('/api/grid-edit/save')) saves.push(JSON.parse(request.postData())); });
  const record = text => { checks.push(text); console.log('PASS', name, text); };
  const state = () => page.evaluate(() => editGrid.getSaveState());
  const cell = (row, col) => page.locator(`#edit-grid td[data-row="${row}"][data-col="${col}"]`);
  const save = () => page.evaluate(() => editGrid.saveChanges());
  const edit = async (value, row = 0, col = 1) => { await cell(row, col).click(); await page.keyboard.press('F2'); await page.locator('#edit-grid td input').fill(value); await page.keyboard.press('Enter'); };
  try {
    await page.goto(`${DEMO_URL}/examples/server-edit/index.html`); assert.equal(await page.evaluate(() => editGrid.ready), true);
    const initial = await page.evaluate(() => ({ row: { ...editGrid.model.rows[0] }, total: editGrid.remote.total }));
    assert.equal(await cell(0, 0).getAttribute('aria-readonly'), 'true'); assert.equal(await cell(0, 1).getAttribute('aria-readonly'), 'false');
    assert.equal(await page.getByRole('button', { name: 'XLSX 가져오기', exact: true }).isDisabled(), true);
    await edit(`검증 ${name}`); assert.equal((await state()).dirty, true);
    assert.equal(await page.evaluate(() => editGrid.setPage(1)), false); assert.equal(await page.evaluate(() => editGrid.setSearch('blocked')), false); assert.equal(await page.evaluate(() => editGrid.setSorts([{ field: 'qty', direction: -1 }])), false);
    assert.equal(await page.evaluate(() => editGrid.setPageSize(50)), false); assert.equal(await page.evaluate(() => editGrid.setDataMode('infinite')), false); assert.equal(await page.evaluate(() => editGrid.setFilters([{ field: 'qty', operator: 'gt', value: 1 }])), false);
    assert.equal(await page.evaluate(() => editGrid.reload()), false); assert.equal(await page.evaluate(() => editGrid.exportXLSX({ scope: 'all' })), false);
    assert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }), true);
    await page.keyboard.press('Control+z'); assert.equal((await state()).dirty, false); await page.keyboard.press('Control+y'); assert.equal((await state()).dirty, true);
    record('F2 editing, key protection, undo/redo, leave warning and unsaved query/page guards');

    await page.evaluate(() => { editGrid.select({ row: 0, col: 3 }); const data = new DataTransfer(); data.setData('text/html', '<table><tr><td>12</td><td>1,234</td></tr><tr><td>13</td><td>2,345</td></tr></table>'); const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true }); Object.defineProperty(event, 'clipboardData', { value: data }); editGrid.table.dispatchEvent(event); });
    assert.equal(await cell(0, 4).innerText(), '1234'); await page.keyboard.press('Control+z'); await page.keyboard.press('Control+y'); assert.equal(await cell(1, 4).innerText(), '2345');
    await page.keyboard.press('Control+z');
    await page.evaluate(() => editGrid.select({ row: 0, col: 3 })); await page.keyboard.press('Delete'); assert.match(await page.locator('.moum-grid__status').innerText(), /필수/); assert.equal(await cell(0, 3).innerText(), String(initial.row.qty));
    await page.getByRole('button', { name: '행 추가', exact: true }).click(); assert.equal(await page.evaluate(() => editGrid.getChanges().created.length), 1); await page.getByRole('button', { name: '선택 행 삭제', exact: true }).click(); assert.equal(await page.evaluate(() => editGrid.getChanges().created.length), 0);
    await page.getByRole('button', { name: '행 추가', exact: true }).click(); await page.screenshot({ path: `${output}/${name}-draft.png`, fullPage: true });
    record('Excel HTML multi-cell paste and one-step undo/redo; required Delete rejects; new-then-delete collapses');

    await page.getByRole('button', { name: '다음 저장 실패', exact: true }).click(); assert.equal(await save(), false); assert.equal((await state()).status, 'error'); assert.equal(await page.evaluate(() => editGrid.editable), true); assert.equal(await page.evaluate(() => editGrid.getChanges().created.length), 1);
    await page.screenshot({ path: `${output}/${name}-rejection.png`, fullPage: true });
    await page.evaluate(() => { window.originalSave = editGrid.remote.source.save; editGrid.remote.source.save = async batch => { await new Promise(resolve => { window.releaseSave = resolve; }); return originalSave(batch); }; window.pendingSave = editGrid.saveChanges(); window.duplicateSave = editGrid.saveChanges(); });
    assert.equal(await page.evaluate(() => pendingSave === duplicateSave), true); assert.equal((await state()).status, 'saving'); assert.equal(await page.evaluate(() => editGrid.addRow()), false); assert.equal(await page.getByRole('grid').getAttribute('aria-busy'), 'true');
    await page.screenshot({ path: `${output}/${name}-saving.png`, fullPage: true });
    await page.evaluate(() => releaseSave()); assert.equal(await page.evaluate(() => pendingSave), true); await page.evaluate(() => { editGrid.remote.source.save = originalSave; });
    assert.equal((await state()).dirty, false); assert.equal(await page.evaluate(() => editGrid.remote.total), initial.total + 1); assert.equal(await cell(0, 1).innerText(), `검증 ${name}`);
    assert.equal(await page.evaluate(() => editGrid.model.canUndo), false); record('Known rejection preserves drafts; duplicate saves share one promise; pending writes freeze edits; acknowledged batch reloads');

    await page.evaluate(() => editGrid.setPage(editGrid.paging.pageCount - 1)); await page.evaluate(() => editGrid.ready);
    await page.evaluate(() => editGrid.select({ row: editGrid.view.length - 1, col: 1 })); await page.getByRole('button', { name: '선택 행 삭제', exact: true }).click(); assert.equal(await save(), true); assert.equal(await page.evaluate(() => editGrid.remote.total), initial.total);
    await page.evaluate(() => editGrid.setPage(0)); await page.evaluate(() => editGrid.ready);
    await edit('충돌 전 입력'); await page.getByRole('button', { name: '다른 사용자 수정 충돌', exact: true }).click(); assert.equal(await save(), false); assert.equal((await state()).status, 'error'); assert.match((await state()).error, /다른 사용자/); assert.equal(await cell(0, 1).innerText(), '충돌 전 입력');
    await page.screenshot({ path: `${output}/${name}-conflict.png`, fullPage: true }); assert.equal(await page.evaluate(() => editGrid.discardChanges()), true); assert.equal(await cell(0, 1).innerText(), '다른 사용자의 수정');
    record('Server-assigned creation/deletion changes totals; version conflict never overwrites; discard reloads newest row');

    await page.evaluate(() => editGrid.addRow({ name: '응답 끊김 검증' })); await page.getByRole('button', { name: '저장 후 응답 끊기', exact: true }).click(); assert.equal(await save(), false); assert.equal((await state()).status, 'uncertain');
    assert.equal(await page.evaluate(() => editGrid.addRow()), false); assert.equal(await page.evaluate(() => editGrid.discardChanges()), false); const uncertain = await state();
    await page.screenshot({ path: `${output}/${name}-uncertain.png`, fullPage: true });
    assert.equal(await save(), true, JSON.stringify(await state())); assert.equal(saves.at(-1).requestId, uncertain.requestId); assert.deepEqual(saves.at(-1).created, saves.at(-2).created); assert.equal(await page.evaluate(() => editGrid.remote.total), initial.total + 1);
    await page.evaluate(() => editGrid.setPage(editGrid.paging.pageCount - 1)); await page.evaluate(() => editGrid.ready); await page.evaluate(() => { editGrid.select({ row: editGrid.view.length - 1, col: 1 }); editGrid.deleteSelectedRows(); }); await save();
    await page.evaluate(() => editGrid.setPage(0)); await page.evaluate(() => editGrid.ready);
    record('Commit followed by lost HTTP response freezes drafts; exact request retry returns persisted receipt without duplicate create');

    await edit('갱신 실패 검증');
    await page.evaluate(() => { window.originalLoad = editGrid.remote.source.load; editGrid.remote.source.load = () => { throw Error('refresh failed'); }; });
    assert.equal(await save(), true); assert.equal((await state()).status, 'refresh'); assert.equal(await page.evaluate(() => editGrid.editable), false); await page.evaluate(() => { editGrid.remote.source.load = originalLoad; }); assert.equal(await page.evaluate(() => editGrid.retryLoad()), true); assert.equal((await state()).status, 'idle');
    await edit(initial.row.name); await save();
    await page.evaluate(() => editGrid.setDataMode('infinite')); await page.evaluate(() => editGrid.ready); await page.evaluate(() => editGrid.loadMore()); await page.evaluate(() => editGrid.ready); assert.ok(await page.evaluate(() => editGrid.remote.rows.length) >= 50);
    await edit('무한 스크롤 편집'); assert.equal(await page.evaluate(() => editGrid.loadMore()), false);
    await page.evaluate(() => { editGrid.remote.source.load = () => { throw Error('infinite discard refresh failed'); }; });
    assert.equal(await page.evaluate(() => editGrid.discardChanges()), false); assert.equal((await state()).status, 'refresh');
    await page.evaluate(() => { editGrid.remote.source.load = originalLoad; }); assert.equal(await page.evaluate(() => editGrid.retryLoad()), true);
    await page.evaluate(() => editGrid.setDataMode('pagination')); await page.evaluate(() => editGrid.ready);
    record('Acknowledged save plus failed refresh stays locked until retry; infinite mode edits block append and discard safely');

    await edit('시간 초과 검증'); await page.evaluate(() => { editGrid.remote.timeoutMs = 100; editGrid.remote.source.save = async batch => { await originalSave(batch); return new Promise(() => {}); }; });
    assert.equal(await save(), false); assert.equal((await state()).status, 'uncertain'); const timedOut = (await state()).requestId;
    await page.evaluate(() => { editGrid.remote.timeoutMs = 10000; editGrid.remote.source.save = originalSave; }); assert.equal(await save(), true); assert.equal(saves.at(-1).requestId, timedOut);
    await edit('응답 검증'); await page.evaluate(() => { editGrid.remote.source.save = async batch => { const result = await originalSave(batch); return { ...result, updated: [] }; }; });
    assert.equal(await save(), false); assert.equal((await state()).status, 'uncertain'); await page.evaluate(() => { editGrid.remote.source.save = originalSave; }); assert.equal(await save(), true);
    await edit(initial.row.name); await save();
    record('Save timeout with ignored abort and malformed post-commit receipt both recover using the same persisted request');

    await page.evaluate(axe); const accessibility = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })); assert.deepEqual(accessibility.violations.map(item => item.id), []);
    for (const width of [320, 390, 639, 640, 641, 768, 1024, 1280, 1440, 1920]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${width}`); }
    await page.screenshot({ path: `${output}/${name}-saved.png`, fullPage: true }); assert.deepEqual(errors, []); record('Automated accessibility and 10 responsive widths have no violations, page overflow or uncaught JS errors');
    reports.push({ engine: name, checks, errors, accessibility: { violations: accessibility.violations.length, incomplete: accessibility.incomplete.length } });
  } finally { await browser.close(); }
}
await writeFile(`${output}/results.json`, JSON.stringify(reports, null, 2)); console.log(`Passed ${reports.reduce((sum, item) => sum + item.checks.length, 0)} server edit flows.`);
