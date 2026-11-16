import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

// Optional development tools and an offline-installed tgz consumer; see docs/frameworks.md.
const client = path.resolve('output/usage-consumer'), output = path.resolve('output/playwright/usage');
const tooling = createRequire(import.meta.url);
const { build } = tooling('esbuild'), { parse, compileScript } = tooling('@vue/compiler-sfc');
const consumer = createRequire(path.join(client, 'package.json')), pkg = path.join(client, 'node_modules/@moum/grid');
const reports = [], record = message => { reports.push(message); console.log('PASS', message); };
await mkdir(output, { recursive: true }); await mkdir(path.join(client, 'src'), { recursive: true });
assert.equal(new (consumer('@moum/grid').GridModel)([{ field: 'name' }], [{ name: 'offline' }]).getData()[0].name, 'offline');
for (const line of (await readFile(path.join(pkg, 'SHA256SUMS.txt'), 'utf8')).trim().split('\n')) {
  const [hash, file] = line.split('  '); assert.equal(createHash('sha256').update(await readFile(path.join(pkg, file))).digest('hex'), hash, file);
}
record('Offline-installed tgz resolves CommonJS and contains matching dist/vendor/license hashes');

const guide = await readFile('docs/getting-started.md', 'utf8'), html = guide.match(/```html\n([\s\S]*?)\n```/)[1];
await mkdir(path.join(client, 'vendor/moum-grid'), { recursive: true });
for (const file of ['moum-grid.js', 'moum-grid.css']) await copyFile(path.join(pkg, 'dist', file), path.join(client, 'vendor/moum-grid', file));
await copyFile(path.join(pkg, 'LICENSE'), path.join(client, 'vendor/moum-grid/LICENSE'));
await writeFile(path.join(client, 'copied.html'), html);
await writeFile(path.join(client, 'esm.html'), '<!doctype html><html lang="ko"><meta charset="utf-8"><title>ESM</title><link rel="stylesheet" href="/node_modules/@moum/grid/dist/moum-grid.css"><div id="grid"></div><script type="module">import Grid from "/node_modules/@moum/grid/dist/moum-grid.mjs"; new Grid("#grid",{columns:[{field:"name",header:"품목"}],data:[{name:"ESM 품목"}]});</script></html>');
await copyFile('examples/react/ProductGrid.jsx', path.join(client, 'src/ProductGrid.jsx'));
const parsed = parse(await readFile('examples/vue/ProductGrid.vue', 'utf8'));
assert.deepEqual(parsed.errors, []);
await writeFile(path.join(client, 'src/ProductGridVue.js'), compileScript(parsed.descriptor, { id: 'usage-grid', inlineTemplate: true }).content);

const initial = [{ code: 'A001', name: '노트', qty: 10 }, { code: 'A002', name: '볼펜', qty: 20 }];
const shared = `const initial=${JSON.stringify(initial)}; window.usageEvents=[]; let rows=initial, version=1;`;
await writeFile(path.join(client, 'src/react-entry.js'), `import React from 'react'; import {createRoot} from 'react-dom/client'; import ProductGrid from './ProductGrid.jsx';
${shared}
let root=createRoot(document.getElementById('app'));
function render(){const handlerVersion=version;root.render(React.createElement(React.StrictMode,null,React.createElement(ProductGrid,{rows,onChange:e=>usageEvents.push({version:handlerVersion,data:e.data})})));}
window.usage={rerender(){version++;render();},replace(next){rows=next;render();},unmount(){root.unmount();},mount(){root=createRoot(document.getElementById('app'));render();}};render();`);
await writeFile(path.join(client, 'src/vue-entry.js'), `import {createApp,ref,h} from 'vue'; import ProductGrid from './ProductGridVue.js';
${shared}
const input=ref(rows), handlerVersion=ref(version);let app;
window.usage={rerender(){handlerVersion.value++;},replace(next){input.value=next;},unmount(){app.unmount();},mount(){app=createApp({setup:()=>()=>h(ProductGrid,{rows:input.value,onChange:e=>usageEvents.push({version:handlerVersion.value,data:e.data})})});app.mount('#app');}};usage.mount();`);
for (const framework of ['react', 'vue']) {
  await build({ entryPoints: [path.join(client, `src/${framework}-entry.js`)], bundle: true, outfile: path.join(client, `${framework}.js`), jsx: 'automatic', nodePaths: [path.resolve('node_modules')], define: { 'process.env.NODE_ENV': '"development"' } });
  await writeFile(path.join(client, `${framework}.html`), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${framework} integration</title><link rel="stylesheet" href="/${framework}.css"><div id="app"></div><script src="/${framework}.js"></script></html>`);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost'); if (url.pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const target = path.resolve(client, '.' + decodeURIComponent(url.pathname)), relative = path.relative(client, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403); response.end(); return; }
    const bytes = await readFile(target); response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' }); response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true }), page = await browser.newPage(); const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
    try {
      await page.goto(pathToFileURL(path.resolve('examples/quick-start/index.html')).href);
      await page.getByRole('button', { name: '현재 데이터 확인', exact: true }).click(); assert.match(await page.locator('#result').innerText(), /노트/);
      await page.locator('td[data-row="0"][data-col="2"]').click(); await page.keyboard.press('F2'); await page.locator('td input').fill('25'); await page.keyboard.press('Enter');
      await page.keyboard.press('Control+z'); assert.equal(await page.locator('td[data-row="0"][data-col="2"]').innerText(), '10'); await page.keyboard.press('Control+y');
      await page.getByRole('button', { name: '현재 데이터 확인', exact: true }).click(); assert.match(await page.locator('#result').innerText(), /25/);
      await page.getByRole('button', { name: '다른 데이터 불러오기', exact: true }).click(); assert.equal(await page.locator('td[data-row="0"][data-col="1"]').innerText(), '새 조회 결과');
      for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
      await page.reload(); await page.locator('td[data-row="1"]').first().waitFor();
      await page.screenshot({ path: path.join(output, `${name}-quick-start.png`), fullPage: true }); assert.deepEqual(errors, []); assert.equal(requests.some(url => /^https?:/.test(url)), false);
      record(`${name}: file:// quick-start edit/undo/redo/read/replace, four widths, zero HTTP requests`);
      await page.goto(pathToFileURL(path.join(client, 'copied.html')).href); assert.equal(await page.locator('td[data-row="0"][data-col="1"]').innerText(), '노트'); assert.deepEqual(errors, []);
      record(`${name}: exact guide HTML works with only copied npm package JS/CSS/LICENSE`);
      if (name === 'chromium') {
        await page.goto(`${base}/esm.html`); assert.equal(await page.locator('td[data-row="0"][data-col="0"]').innerText(), 'ESM 품목'); record('Browser ESM works from the isolated package over HTTP');
        for (const framework of ['react', 'vue']) {
          await page.goto(`${base}/${framework}.html`); await page.waitForSelector('td[data-row="0"]'); assert.equal(await page.locator('.moum-grid').count(), 1);
          await page.locator('td[data-row="0"][data-col="1"]').click(); await page.keyboard.press('F2'); await page.locator('td input').fill(`${framework} 편집`); await page.keyboard.press('Enter');
          await page.evaluate(() => usage.rerender()); await page.waitForTimeout(50); assert.equal(await page.getByRole('button', { name: '되돌리기', exact: true }).isEnabled(), true);
          await page.locator('td[data-row="0"][data-col="1"]').click(); await page.keyboard.press('F2'); await page.locator('td input').fill('두 번째 편집'); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => usageEvents.at(-1).version), 2);
          await page.evaluate(() => usage.replace([{ code: 'B001', name: '교체 완료', qty: 5 }])); await page.waitForFunction(() => document.querySelector('td[data-col="1"]')?.textContent === '교체 완료'); assert.equal(await page.getByRole('button', { name: '되돌리기', exact: true }).isDisabled(), true);
          await page.evaluate(() => usage.unmount()); assert.equal(await page.locator('.moum-grid').count(), 0); await page.evaluate(() => usage.mount()); await page.waitForSelector('.moum-grid'); assert.equal(await page.locator('.moum-grid').count(), 1);
          await page.screenshot({ path: path.join(output, `${framework}.png`), fullPage: true }); assert.deepEqual(errors, []);
          record(`${framework}: actual compiled component mount/edit/latest callback/rerender retains undo/rows replacement/unmount/remount`);
        }
      }
    } finally { await browser.close(); }
  }
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
const versions = Object.fromEntries(['react', 'react-dom', 'vue', '@vue/compiler-sfc', 'esbuild'].map(name => [name, tooling(`${name}/package.json`).version]));
await writeFile(path.join(output, 'results.json'), JSON.stringify({ versions, checks: reports }, null, 2));
