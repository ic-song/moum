import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'output');
const npm = process.env.npm_execpath;
assert(npm, 'Run npm run pack:offline.');
const npmRun = (args, cwd) => execFileSync(process.execPath, [npm, ...args], { cwd, encoding: 'utf8' });
const tar = args => execFileSync('tar', args);
const entries = {
  grid: 'Grid', charts: 'Charts', gantt: 'Gantt', uploader: 'Uploader', calendar: 'Calendar',
  datepicker: 'DatePicker', pagination: 'Pagination', 'infinite-scroll': 'InfiniteScroll',
  tabs: 'Tabs', accordion: 'Accordion', dialog: 'Dialog'
};

await mkdir(output, { recursive: true });
const staging = await mkdtemp(path.join(output, 'offline-build-'));
const consumer = await mkdtemp(path.join(tmpdir(), 'moum-offline-consumer-'));
try {
  const kit = path.join(staging, 'moum-offline');
  const archives = path.join(kit, 'npm');
  await mkdir(archives, { recursive: true });
  const packed = JSON.parse(npmRun(['pack', '--workspaces', '--pack-destination', archives, '--json'], root));
  assert.deepEqual(packed.map(item => item.name).sort(), Object.keys(entries).map(name => '@moum/' + name).sort());

  for (const item of packed) {
    const target = path.join(kit, 'packages', item.name.slice('@moum/'.length));
    await mkdir(target, { recursive: true });
    tar(['-xzf', path.join(archives, item.filename), '--strip-components=1', '-C', target]);
    for (const line of (await readFile(path.join(target, 'SHA256SUMS.txt'), 'utf8')).trim().split('\n')) {
      const [hash, file] = line.split('  ');
      assert.equal(await sha256(path.join(target, file)), hash, item.name + ' ' + file);
    }
  }

  for (const entry of ['examples', 'docs', 'CHANGELOG.md', 'LICENSE']) {
    await cp(path.join(root, entry), path.join(kit, entry), { recursive: true });
  }
  await mkdir(path.join(kit, 'scripts'));
  for (const file of ['serve.mjs', 'demo-api.mjs', 'edit-api.mjs', 'edit-store.mjs', 'verify-offline.mjs']) {
    await cp(path.join(root, 'scripts', file), path.join(kit, 'scripts', file));
  }
  // The optional HTTP examples use the same display rules as the library.
  await mkdir(path.join(kit, 'packages/grid/src'));
  await cp(path.join(root, 'packages/grid/src/data-view.js'), path.join(kit, 'packages/grid/src/data-view.js'));
  const versions = packed.map(item => '| `' + item.name + '` | ' + item.version + ' | `npm/' + item.filename + '` |').join('\n');
  const guide = (await readFile(path.join(root, 'docs/offline-kit.md'), 'utf8'))
    .replaceAll('](../examples/', '](examples/')
    .replace(/moum-grid-[\w.-]+\.tgz/, packed.find(item => item.name === '@moum/grid').filename);
  await writeFile(path.join(kit, 'README.md'), guide + '\n## 포함 패키지\n\n| 패키지 | 버전 | 로컬 설치 파일 |\n| --- | --- | --- |\n' + versions + '\n');

  const sums = [];
  for (const file of await filesUnder(kit)) sums.push(await sha256(path.join(kit, file)) + '  ' + file);
  await writeFile(path.join(kit, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
  execFileSync(process.execPath, [path.join(kit, 'scripts/verify-offline.mjs')], { stdio: 'inherit' });

  await writeFile(path.join(consumer, 'package.json'), '{"name":"offline-consumer","version":"1.0.0","private":true,"type":"module"}');
  npmRun(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(consumer, 'cache'), ...packed.map(item => path.join(archives, item.filename))], consumer);
  const test = `import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const entries = ${JSON.stringify(entries)};
for (const [name, entry] of Object.entries(entries)) {
  const specifier = '@moum/' + name;
  const common = require(specifier);
  const esm = await import(specifier);
  assert.equal(typeof esm.default, 'function', specifier);
  assert.equal(esm.default, esm[entry], specifier);
  assert.equal(typeof common[entry], 'function', specifier);
  assert.match(await readFile(require.resolve(specifier + '/style.css'), 'utf8'), /\\.moum-/);
}
assert.equal(typeof require('@moum/grid/realgrid-compat').GridView, 'function');
assert.equal(typeof (await import('@moum/grid/realgrid-compat')).GridView, 'function');
assert.match(require.resolve('@moum/uploader/worker.js'), /moum-uploader-worker\\.js$/);
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
assert.equal(Object.keys(lock.packages).length, Object.keys(entries).length + 1);
for (const pkg of Object.values(lock.packages).slice(1)) {
  assert.match(pkg.resolved, /^file:/);
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.deepEqual(pkg.optionalDependencies ?? {}, {});
  assert.deepEqual(pkg.peerDependencies ?? {}, {});
}
`;
  await writeFile(path.join(consumer, 'smoke.mjs'), test);
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
  console.log(`PASS ${packed.length} packages installed offline into a clean consumer with an empty npm cache.`);

  const archive = path.join(staging, 'moum-offline.tar.gz');
  tar(['-czf', archive, '-C', staging, 'moum-offline']);
  await rename(archive, path.join(output, 'moum-offline.tar.gz'));
  console.log('Created output/moum-offline.tar.gz');
} finally {
  await rm(consumer, { recursive: true, force: true });
  await rm(staging, { recursive: true, force: true });
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function filesUnder(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesUnder(path.join(dir, entry.name), relative + '/'));
    else files.push(relative);
  }
  return files.sort();
}
