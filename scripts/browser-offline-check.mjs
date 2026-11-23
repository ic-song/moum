import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const temp = await mkdtemp(path.join(tmpdir(), 'moum-bundle-test-'));
let server;
try {
  execFileSync('tar', ['-xzf', path.resolve('output/moum-offline.tar.gz'), '-C', temp]);
  const kit = path.join(temp, 'moum-offline');
  execFileSync(process.execPath, ['scripts/verify-offline.mjs'], { cwd: kit, stdio: 'inherit' });
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage();
      const errors = [], outgoing = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https?:/, route => { outgoing.push(route.request().url()); return route.abort(); });
      for (const name of ['grid', 'charts', 'gantt', 'uploader', 'calendar', 'datepicker', 'pagination', 'infinite-scroll']) {
        await page.goto(pathToFileURL(path.join(kit, 'examples', name, 'index.html')).href);
        await page.locator('.moum-' + name).first().waitFor({ timeout: 5000 });
      }
      await page.goto(pathToFileURL(path.join(kit, 'examples/quick-start/index.html')).href);
      await page.getByRole('button', { name: '다른 데이터 불러오기' }).click();
      await page.getByRole('button', { name: '현재 데이터 확인' }).click();
      assert.match(await page.locator('#result').textContent(), /B001/);
      assert.deepEqual(errors, []);
      assert.deepEqual(outgoing, []);
      console.log(`PASS ${engine.name()}: 8 offline examples and quick-start interaction.`);
    } finally {
      await browser.close();
    }
  }

  const port = process.env.MOUM_OFFLINE_TEST_PORT ?? '4189';
  const origin = 'http://127.0.0.1:' + port;
  server = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: kit, env: { ...process.env, MOUM_DEMO_PORT: port }, stdio: ['ignore', 'pipe', 'inherit']
  });
  const exited = once(server, 'exit');
  await Promise.race([
    once(server.stdout, 'data'),
    exited.then(([code]) => { throw Error('Bundle server exited: ' + code); })
  ]);
  const response = await fetch(origin + '/api/grid', { method: 'POST', body: '{"limit":2}', signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).rows.length, 2);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const worker = page.waitForEvent('worker', { timeout: 10000 });
    await page.goto(origin + '/examples/uploader/index.html');
    await page.locator('#sample').click();
    assert.match((await worker).url(), /moum-uploader-worker\.js$/);
    await page.waitForFunction(() => window.uploader.getFiles().some(file => file.rowCount === 3 && file.errorCount === 0));
    await page.locator('#grid-data').click();
    assert.match(await page.locator('#import-grid').textContent(), /업무용 노트/);
    assert.deepEqual(errors, []);
    console.log('PASS bundle HTTP server, Excel worker and uploader-to-grid integration.');
  } finally {
    await browser.close();
  }
} finally {
  if (server?.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
  await rm(temp, { recursive: true, force: true });
}
