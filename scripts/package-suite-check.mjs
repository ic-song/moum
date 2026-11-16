import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const consumer = path.resolve('output/suite-consumer'); await mkdir(consumer, { recursive: true });
await writeFile(path.join(consumer, 'package.json'), '{"private":true,"type":"module"}');
const require = createRequire(path.join(consumer, 'consumer.cjs'));
const declarations = [], imports = [];
for (const [name, entry] of Object.entries({charts:'Charts',gantt:'Gantt',uploader:'Uploader',calendar:'Calendar',datepicker:'DatePicker',pagination:'Pagination','infinite-scroll':'InfiniteScroll'})) {
  const target = path.join(consumer, 'node_modules/@moum', name); await mkdir(target, { recursive: true });
  const metadata=JSON.parse(await readFile(`packages/${name}/package.json`,'utf8'));
  const archive = path.resolve(`output/packages/moum-${name}-${metadata.version}.tgz`);
  const listing = execFileSync('tar', ['-tzf', archive], { encoding:'utf8' }); assert.match(listing, /package\/README.md/); assert.match(listing, /package\/index.d.ts/); assert.doesNotMatch(listing, /package\/(src|test)\//);
  execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', target]);
  const sums = (await readFile(path.join(target, 'SHA256SUMS.txt'), 'utf8')).trim().split('\n');
  for (const line of sums) { const [hash, file] = line.split('  '); assert.equal(createHash('sha256').update(await readFile(path.join(target, file))).digest('hex'), hash, `${name} ${file}`); }
  const common = require(`@moum/${name}`); assert.equal(typeof common[entry], 'function');
  const esm = await import(pathToFileURL(path.join(target, `dist/moum-${name}.mjs`))); assert.equal(typeof esm.default, 'function');
  declarations.push(`import ${entry} from '@moum/${name}';`); imports.push(`import ${entry} from '@moum/${name}'; if(typeof ${entry} !== 'function') throw Error('${name}');`);
  console.log(`PASS packed ${name}: manifest, isolated CJS/ESM, CSS/types/license, SHA-256`);
}
await writeFile(path.join(consumer, 'imports.mjs'), imports.join('\n')); await import(pathToFileURL(path.join(consumer, 'imports.mjs')));
await writeFile(path.join(consumer, 'usage.mts'), declarations.join('\n') + `
const picker=new DatePicker(document.createElement('div'),{mode:'range',onChange:value=>console.log(value)}); picker.setValue({start:'2026-11-16',end:'2026-11-20'});picker.destroy();
const pager=new Pagination<string[]>(document.createElement('div'),{load:async ({signal})=>({total:signal.aborted?0:1,data:['a']})});pager.goTo(1);pager.destroy();
const feed=new InfiniteScroll<{id:number},number>(document.createElement('div'),{auto:false,getKey:item=>item.id,load:async ({cursor})=>({items:[{id:cursor??1}],hasMore:false})});feed.loadMore();feed.destroy();
const charts=new Charts(document.createElement('div'),{type:'bar',data:{labels:['A'],datasets:[{data:[1]}]}}); charts.setType('line'); charts.destroy();
const gantt=new Gantt(document.createElement('div'),{tasks:[{id:'a',start:'2026-11-16',end:'2026-11-17'}]}); gantt.updateTask('a',{progress:50}); gantt.setView('mini'); gantt.setMiniType('summary'); gantt.setRange({start:'2026-11-01',end:'2026-12-01'}); console.log(gantt.getSummary()?.progress); gantt.destroy();
const calendar=new Calendar(document.createElement('div'),{events:[{id:'a',start:'2026-11-16',end:'2026-11-17',allDay:true}]}); calendar.getOccurrences({start:'2026-11-01',end:'2026-12-01'}); calendar.destroy();
const uploader=new Uploader(document.createElement('div'),{schema:[{field:'qty',type:'integer'}],onUpload:async ({file,data,signal,onProgress})=>{onProgress(100);return {name:file.name,data,aborted:signal.aborted};}}); uploader.addFiles([new File(['a'],'a.txt')]); uploader.destroy();
`);
await writeFile(path.join(consumer, 'tsconfig.json'), JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,lib:['ES2022','DOM']},files:['usage.mts']},null,2));
