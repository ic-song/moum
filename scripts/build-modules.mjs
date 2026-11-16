import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = {
  charts: { entry: 'Charts', global: 'MoumCharts', parts: ['model', 'charts'] },
  gantt: { entry: 'Gantt', global: 'MoumGantt', parts: ['model', 'gantt'] },
  uploader: { entry: 'Uploader', global: 'MoumUploader', parts: ['parser', 'transport', 'uploader'] },
  calendar: { entry: 'Calendar', global: 'MoumCalendar', parts: ['model', 'calendar'] },
  datepicker: { entry: 'DatePicker', global: 'MoumDatePicker', parts: ['datepicker'] },
  pagination: { entry: 'Pagination', global: 'MoumPagination', parts: ['pagination'] },
  'infinite-scroll': { entry: 'InfiniteScroll', global: 'MoumInfiniteScroll', parts: ['infinite-scroll'] }
};
for (const [name, config] of Object.entries(modules)) {
  const dir = path.join(root, 'packages', name), metadata = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  const source = (await Promise.all(config.parts.map(part => readFile(path.join(dir, 'src', `${part}.js`), 'utf8')))).join('\n').replace(/\r\n?/g, '\n').replace(/^import .*;\n/gm, '');
  const plain = source.replace(/^export /gm, ''), names = [...source.matchAll(/^export (?:async )?(?:class|function|const) (\w+)/gm)].map(m => m[1]);
  new Script(plain, { filename: `moum-${name}.js` });
  const banner = `/*! MOUM ${name} v${metadata.version} | MIT License | See LICENSE */\n`;
  await mkdir(path.join(dir, 'dist'), { recursive: true });
  const files = [];
  const save = async (file, text) => { await writeFile(path.join(dir, file), text); files.push(file); };
  await save(`dist/moum-${name}.mjs`, banner + source + `\nexport default ${config.entry};\n`);
  await save(`dist/moum-${name}.cjs`, banner + `'use strict';\n${plain}\nmodule.exports = { ${names.join(', ')} };\n`);
  await save(`dist/moum-${name}.js`, banner + `(function () {\n'use strict';\n${plain}\nglobalThis.${config.global} = ${config.entry};\nObject.assign(globalThis.${config.global}, { ${names.filter(n => n !== config.entry).join(', ')} });\n})();\n`);
  await save(`dist/moum-${name}.css`, (await readFile(path.join(dir, 'src', `${name}.css`), 'utf8')).replace(/\r\n?/g, '\n') + '\n' + (await readFile(path.join(root, 'styles/components.css'), 'utf8')).replace(/\r\n?/g, '\n'));
  await save('LICENSE', (await readFile(path.join(root, 'LICENSE'), 'utf8')).replace(/\r\n?/g, '\n'));
  if (name === 'uploader') {
    await mkdir(path.join(dir, 'vendor/sheetjs'), { recursive: true });
    for (const file of ['xlsx.full.min.js', 'LICENSE']) { const relative = `vendor/sheetjs/${file}`; await copyFile(path.join(root, 'packages/grid', relative), path.join(dir, relative)); files.push(relative); }
    files.push('THIRD_PARTY_NOTICES.md');
  }
  files.push('index.d.ts');
  const hashes = []; for (const file of files) hashes.push(`${createHash('sha256').update(await readFile(path.join(dir, file))).digest('hex')}  ${file}`);
  await writeFile(path.join(dir, 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
  console.log(`Built @moum/${name}: browser / ESM / CommonJS / CSS / types / license`);
}
