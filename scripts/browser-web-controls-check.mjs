import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const origin = 'http://moum.test';
const demo = origin + '/examples/controls/index.html';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const output = path.resolve('output/playwright/web-controls');
const axe = await readFile('node_modules/axe-core/axe.min.js', 'utf8');
await mkdir(output, { recursive: true });
for (const engine of [chromium, firefox, webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.route(/^https?:/, async route => {
      const url = new URL(route.request().url());
      const file = path.resolve('.' + decodeURIComponent(url.pathname));
      const relative = path.relative(process.cwd(), file);
      const contentType = types[path.extname(file)];
      if (url.origin !== origin || relative.startsWith('..') || path.isAbsolute(relative) || !contentType) {
        failures.push(url.href);
        return route.abort();
      }
      return route.fulfill({ contentType, path: file });
    });
    await page.goto(demo);
    const scan = async () => {
      await page.evaluate(axe);
      assert.deepEqual(await page.evaluate(async () => (await window.axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => v.id)), []);
    };
    const firstTab = page.getByRole('tab', { name: '소개' });
    await firstTab.focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('tab', { name: '배송' }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: '규격' }).getAttribute('aria-selected'), 'true');
    assert.match(await page.getByRole('tabpanel').textContent(), /A5/);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'tabpanel');
    const questions = page.locator('#accordion summary');
    await questions.first().focus();
    await page.keyboard.press('Enter');
    await questions.nth(1).click();
    assert.deepEqual(await page.evaluate(() => accordion.getOpen()), ['address']);
    await scan();
    const open = page.locator('#open-dialog');
    await open.focus();
    await page.keyboard.press('Enter');
    const modal = page.getByRole('dialog');
    assert.equal(await modal.isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), '취소');
    assert.equal(await open.evaluate(el => { el.focus(); return document.activeElement.closest('dialog') !== null; }), true);
    await scan();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#result').textContent.includes('유지'));
    assert.equal(await open.evaluate(el => el === document.activeElement), true);
    assert.deepEqual(await page.evaluate(() => [tabs.getActive(), accordion.getOpen()]), ['specs', ['address']]);
    await open.click();
    await modal.getByRole('button', { name: '초기화' }).click();
    await page.waitForFunction(() => document.querySelector('#result').textContent.includes('초기화했습니다'));
    assert.deepEqual(await page.evaluate(() => [tabs.getActive(), accordion.getOpen()]), ['overview', []]);

    await page.locator('#popup-alert').click();
    const popupModal = page.locator('#popup-mount').getByRole('dialog');
    assert.equal(await popupModal.getByRole('button').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), '확인');
    await popupModal.getByRole('button', { name: '확인' }).click();
    await page.waitForFunction(() => document.querySelector('#popup-result').textContent === '알림을 닫았습니다.');
    await page.getByRole('tab', { name: '규격' }).click();
    await page.locator('#popup-confirm').click();
    await popupModal.getByRole('button', { name: '아니오' }).click();
    await page.waitForFunction(() => document.querySelector('#popup-result').textContent === '현재 탭을 유지했습니다.');
    assert.equal(await page.evaluate(() => tabs.getActive()), 'specs');
    await page.locator('#popup-confirm').click();
    await popupModal.getByRole('button', { name: '예', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#popup-result').textContent === '소개 탭으로 돌아갔습니다.');
    assert.equal(await page.evaluate(() => tabs.getActive()), 'overview');

    const trigger = page.locator('#popup-inline');
    const panel = page.locator('#popup-help');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await panel.waitFor();
    // WebKit's default keyboard mode skips links unless full keyboard access is enabled.
    if (engine === webkit) await panel.getByRole('link').focus();
    else await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.closest('#popup-help') !== null), true);
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await trigger.evaluate(el => { el.style.cssText = 'position: fixed; right: 8px; bottom: 8px'; });
    await trigger.click();
    await page.waitForFunction(() => Number.parseFloat(document.querySelector('#popup-help').style.getPropertyValue('--moum-popover-y')) > 0);
    const popoverBox = await panel.boundingBox(), anchorBox = await trigger.boundingBox();
    assert.ok(popoverBox.x >= 0 && popoverBox.x + popoverBox.width <= 390 && popoverBox.y + popoverBox.height < anchorBox.y);
    if (engine === chromium) await page.screenshot({ path: path.join(output, 'popover-390.png') });
    await page.getByRole('heading', { level: 1 }).click();
    await panel.waitFor({ state: 'hidden' });
    await trigger.evaluate(el => { el.style.removeProperty('position'); el.style.removeProperty('right'); el.style.removeProperty('bottom'); });

    const callbacks = await page.evaluate(async () => {
      const host = document.body.appendChild(document.createElement('div'));
      const manager = new MoumPopup(host);
      const calls = [];
      const pending = manager.confirm({
        onYes: async () => { await Promise.resolve(); calls.push('yes'); },
        onNo: () => { calls.push('no'); }
      });
      host.querySelector('.moum-dialog-confirm').click();
      const accepted = await pending;
      const cancelled = manager.confirm({ onNo: () => { calls.push('no'); } });
      manager.destroy();
      return [accepted, await cancelled, calls];
    });
    assert.deepEqual(callbacks, [true, false, ['yes', 'no']]);

    if (engine === chromium) {
      for (const [width, height] of [[320, 760], [390, 844], [768, 1024], [844, 390], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1080]]) {
        await page.setViewportSize({ width, height });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `page overflow at ${width}`);
        await open.click();
        const box = await modal.boundingBox();
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `modal overflow at ${width}`);
        if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `modal-${width}.png`) });
        await modal.getByRole('button', { name: '취소' }).click();
        await page.waitForFunction(() => document.querySelector('#result').textContent.includes('유지'));
        if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `page-${width}.png`), fullPage: true });
      }
    }
    const lifecycle = await page.evaluate(async () => {
      const host = document.body.appendChild(document.createElement('div'));
      const dialog = new MoumDialog(host);
      const result = dialog.open();
      const duplicate = await dialog.open().then(() => false, () => true);
      dialog.destroy();
      return { duplicate, result: await result, removed: !host.firstChild };
    });
    assert.deepEqual(lifecycle, { duplicate: true, result: false, removed: true });

    await page.evaluate(() => {
      const test = document.body.appendChild(document.createElement('section'));
      test.id = 'advanced-controls';
      const mount = () => test.appendChild(document.createElement('div'));
      const make = id => ({ id, label: id, content: '본문' });
      const changes = [];
      const tabs = new MoumTabs(mount(), { items: ['하나', '둘'].map(make), activation: 'manual', onChange: event => changes.push(event.id) });
      const accordion = new MoumAccordion(mount(), { items: ['하나', '둘'].map(make), single: true, openIds: ['하나'] });
      const dialog = new MoumDialog(mount());
      const requests = [];
      const options = { title: '저장', onConfirm: ({ signal }) => new Promise((resolve, reject) => requests.push({ signal, resolve, reject })) };
      window.webControls = { tabs, accordion, dialog, changes, requests, options };
    });
    const advanced = page.locator('#advanced-controls');
    await advanced.getByRole('tab', { name: '하나' }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), '둘');
    assert.equal(await advanced.getByRole('tab', { name: '하나' }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), '하나');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => webControls.changes), ['둘']);
    assert.deepEqual(await page.evaluate(() => [webControls.accordion.toggle('둘'), webControls.accordion.getOpen(), webControls.accordion.toggle('둘')]), [true, ['둘'], false]);

    await page.evaluate(() => { webControls.result = webControls.dialog.open(webControls.options); });
    const confirm = advanced.getByRole('button', { name: '확인', exact: true });
    await confirm.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => webControls.requests.length), 1);
    assert.match(await advanced.getByRole('status').textContent(), /처리 중/);
    await page.evaluate(() => webControls.requests[0].reject(new Error('연결을 확인하세요.')));
    assert.match(await advanced.getByRole('status').textContent(), /연결을 확인/);
    await confirm.click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(async () => await webControls.result), false);
    assert.equal(await page.evaluate(() => webControls.requests[1].signal.aborted), true);
    await page.evaluate(() => {
      webControls.result = webControls.dialog.open(webControls.options);
      webControls.requests[1].resolve();
    });
    assert.equal(await advanced.getByRole('dialog').isVisible(), true);
    await confirm.click();
    await page.evaluate(() => webControls.requests[2].resolve());
    assert.equal(await page.evaluate(async () => await webControls.result), true);
    assert.deepEqual(failures, []);
    console.log(`PASS ${engine.name()}: tabs, accordion, modal, focus, async retry/cancel and accessibility`);
  } finally { await browser.close(); }
}
