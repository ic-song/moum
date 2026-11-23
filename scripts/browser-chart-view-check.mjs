import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

for (const engine of [chromium, firefox, webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('examples/charts/index.html')).href);
    const legend = page.locator('.moum-charts-legend button');
    const marks = page.locator('#chart svg [role=button]');
    await legend.nth(1).click();
    await page.locator('#chart summary').click();
    const state = await page.evaluate(() => JSON.parse(JSON.stringify(chart.getViewState())));
    assert.deepEqual(state.hidden, [1]);
    assert.equal(state.tableOpen, true);
    assert.equal(await marks.count(), 6);
    await page.locator('#reset').click();
    assert.equal(await marks.count(), 12);
    await page.evaluate(state => chart.setViewState(state), state);
    assert.equal(await marks.count(), 6);
    assert.equal(await legend.nth(1).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#chart details').evaluate(el => el.open), true);
    assert.equal(await page.locator('#chart tbody tr').count(), 6);
    await page.evaluate(state => chart.setViewState({ ...state, tableOpen: false }), state);
    assert.equal(await page.locator('#chart details').evaluate(el => el.open), false);

    const invalid = await page.evaluate(state => {
      const before = JSON.stringify(chart.getViewState());
      const svg = chart.toSVG();
      const inputs = [
        { ...state, version: 2 }, { ...state, hidden: [0, 0] }, { ...state, hidden: [99] },
        { ...state, labels: state.labels.slice().reverse() }, { ...state, type: 'pie' }
      ];
      return inputs.every(input => {
        try { chart.setViewState(input); return false; }
        catch { return before === JSON.stringify(chart.getViewState()) && svg === chart.toSVG(); }
      });
    }, state);
    assert.equal(invalid, true);

    await page.selectOption('#chart-type', 'donut');
    await legend.first().click();
    const donut = await page.evaluate(() => chart.getViewState());
    assert.deepEqual(donut.hidden, [0]);
    assert.equal(await marks.count(), 3);
    await page.locator('#reset').click();
    await page.evaluate(state => chart.setViewState(state), donut);
    assert.equal(await marks.count(), 3);
    assert.equal(await page.evaluate(() => chart.getData().datasets[0].data[0]), 45);
    const locale = await page.evaluate(() => {
      chart.setOptions({ locale: 'de-DE' });
      const value = chart.formatValue(1234.5);
      chart.setOptions({ locale: 'en-US' });
      return [value, chart.formatValue(1234.5)];
    });
    assert.match(locale[0], /^1[.\s]234,5/);
    assert.match(locale[1], /^1,234\.5/);
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine.name()}: series and donut state, table, invalid state, unchanged data and locale`);
  } finally { await browser.close(); }
}
