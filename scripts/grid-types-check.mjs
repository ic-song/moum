import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const npm = process.env.npm_execpath;
if (!npm) throw Error('Run npm run test:grid-types after npm run build.');
const consumer = path.resolve('output/grid-types-consumer');
const target = path.join(consumer, 'node_modules/@moum/grid');
await mkdir(target, { recursive: true });
await writeFile(path.join(consumer, 'package.json'), '{"private":true,"type":"module"}');
const packed = JSON.parse(execFileSync(process.execPath, [npm, 'pack', './packages/grid', '--pack-destination', consumer, '--json'], { encoding: 'utf8' }))[0];
const archive = path.join(consumer, packed.filename);
const files = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' });
for (const file of ['index.d.ts', 'realgrid-compat.d.ts', 'dist/moum-grid.d.cts', 'dist/moum-realgrid.d.cts']) assert.ok(files.split(/\r?\n/).includes(`package/${file}`), file);
assert.doesNotMatch(files, /package\/(src|test)\//);
execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', target]);
for (const line of (await readFile(path.join(target, 'SHA256SUMS.txt'), 'utf8')).trim().split('\n')) {
  const [hash, file] = line.split('  ');
  assert.equal(createHash('sha256').update(await readFile(path.join(target, file))).digest('hex'), hash, file);
}
const require = createRequire(path.join(consumer, 'consumer.cjs'));
const common = require('@moum/grid');
assert.equal(common.default, undefined);
const esm = await import(pathToFileURL(path.join(target, 'dist/moum-grid.mjs')));
assert.equal(esm.default, esm.Grid);
for (const module of [common, esm]) {
  const model = new module.GridModel([{ field: 'qty', type: 'number' }], [{ qty: 'invalid' }]);
  assert.equal(model.validate().errors[0].field, 'qty');
  assert.equal(module.Grid.prototype.validate.call({ model }).valid, false);
}
assert.equal(typeof require('@moum/grid/realgrid-compat').GridView, 'function');
await writeFile(path.join(consumer, 'imports.mjs'), "import Grid from '@moum/grid'; import { GridView } from '@moum/grid/realgrid-compat'; if(typeof Grid !== 'function' || typeof GridView !== 'function') throw Error('ESM exports');");
await import(pathToFileURL(path.join(consumer, 'imports.mjs')));
for (const file of ['usage.mts', 'usage.cts']) await copyFile(`packages/grid/test/types/${file}`, path.join(consumer, file));
const compiler = path.resolve('node_modules/typescript/bin/tsc');
for (const [module, moduleResolution, files] of [['NodeNext', 'NodeNext', ['usage.mts', 'usage.cts']], ['ESNext', 'Bundler', ['usage.mts']]]) {
  await writeFile(path.join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module, moduleResolution, strict: true, noEmit: true, lib: ['ES2022', 'DOM'] }, files }));
  execFileSync(process.execPath, [compiler, '-p', consumer], { stdio: 'inherit' });
  console.log(`PASS packed grid: ${moduleResolution} strict positive/negative consumer types`);
}
console.log('PASS packed grid: CJS/ESM runtime, compatibility exports, declarations and SHA-256');
