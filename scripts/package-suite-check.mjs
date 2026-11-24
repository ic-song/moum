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
for (const [name, entry] of Object.entries({charts:'Charts',gantt:'Gantt',uploader:'Uploader',calendar:'Calendar',datepicker:'DatePicker',pagination:'Pagination','infinite-scroll':'InfiniteScroll',tabs:'Tabs',accordion:'Accordion',dialog:'Dialog'})) {
  const target = path.join(consumer, 'node_modules/@moum', name); await mkdir(target, { recursive: true });
  const metadata=JSON.parse(await readFile(`packages/${name}/package.json`,'utf8'));
  const archive = path.resolve(`output/packages/moum-${name}-${metadata.version}.tgz`);
  const listing = execFileSync('tar', ['-tzf', archive], { encoding:'utf8' }); assert.match(listing, /package\/README.md/); assert.match(listing, /package\/index.d.ts/); assert.doesNotMatch(listing, /package\/(src|test)\//);
  execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', target]);
  const sums = (await readFile(path.join(target, 'SHA256SUMS.txt'), 'utf8')).trim().split('\n');
  for (const line of sums) { const [hash, file] = line.split('  '); assert.equal(createHash('sha256').update(await readFile(path.join(target, file))).digest('hex'), hash, `${name} ${file}`); }
  const common = require(`@moum/${name}`); assert.equal(typeof common[entry], 'function');
  if(name==='uploader'){assert.equal(require.resolve('@moum/uploader/worker.js'),path.join(target,'dist/moum-uploader-worker.js'));assert.equal(typeof common.parseUploadFileInWorker,'function');}
  const esm = await import(pathToFileURL(path.join(target, `dist/moum-${name}.mjs`))); assert.equal(typeof esm.default, 'function');
  declarations.push(`import ${entry} from '@moum/${name}';`); imports.push(`import ${entry} from '@moum/${name}'; if(typeof ${entry} !== 'function') throw Error('${name}');`);
  console.log(`PASS packed ${name}: manifest, isolated CJS/ESM, CSS/types/license, SHA-256`);
}
await writeFile(path.join(consumer, 'imports.mjs'), imports.join('\n')); await import(pathToFileURL(path.join(consumer, 'imports.mjs')));
await writeFile(path.join(consumer, 'usage.mts'), declarations.join('\n') + `
const picker=new DatePicker(document.createElement('div'),{mode:'range',onChange:value=>console.log(value)}); picker.setValue({start:'2026-11-16',end:'2026-11-20'});picker.destroy();
const popup=DatePicker.attach(document.createElement('input'),{mode:'single'});popup.open();popup.close(false);popup.destroy();
const mixed=new Charts(document.createElement('div'),{type:'mixed',axes:{left:{title:'매출',unit:'원'},right:{title:'율',unit:'%'}},data:{labels:['A'],datasets:[{type:'bar',axis:'left',data:[10000]},{type:'line',axis:'right',data:[80]}]}});mixed.toPNG({scale:2}).then(blob=>console.log(blob.type));mixed.destroy();
import { summarizeDeliveries } from '@moum/gantt';
const receiptTotals = summarizeDeliveries([{id:'split',dueDate:'2026-11-25',quantity:8}], [{id:'r',lineId:'split',date:'2026-11-24',quantity:3}]).totals;
const openQuantity: number = receiptTotals.open;
const workGantt=new Gantt(document.createElement('div'),{workCalendar:{weekendDays:[0,6],holidays:['2026-11-18']}});workGantt.scheduleDependencies();
const ganttView=workGantt.getViewState(); workGantt.setViewState({...ganttView,view:'mini',mini:{type:'summary'}});
workGantt.addTask({id:'receipt',start:'2026-11-23',end:'2026-11-25',deadline:'2026-11-26',dependencies:[{taskId:'order',type:'SS',lagDays:1}]});
const captured:boolean=workGantt.captureBaseline();
const variance:number|null=workGantt.getScheduleStatus({asOf:'2026-11-27'})[0].finishVarianceDays;
console.log(captured,variance);
// @ts-expect-error invalid scale
workGantt.setViewState({...ganttView,scale:'year'});
workGantt.destroy();
const workerUploader=new Uploader(document.createElement('div'),{workerURL:new URL('https://localhost/assets/dist/moum-uploader-worker.js'),parseTimeout:10000,onParseProgress:({id,stage})=>console.log(id,stage)});console.log(workerUploader.getFiles()[0]?.parseStage);workerUploader.destroy();
const pager=new Pagination<string[]>(document.createElement('div'),{load:async ({signal})=>({total:signal.aborted?0:1,data:['a']})});pager.goTo(1);pager.destroy();
const feed=new InfiniteScroll<{id:number},number>(document.createElement('div'),{auto:false,getKey:item=>item.id,load:async ({cursor})=>({items:[{id:cursor??1}],hasMore:false})});feed.loadMore();feed.destroy();
const charts=new Charts(document.createElement('div'),{type:'bar',data:{labels:['A'],datasets:[{data:[1]}]}}); charts.setType('line'); const chartView=charts.getViewState(); charts.setViewState({...chartView,hidden:[0],tableOpen:true});
// @ts-expect-error unsupported view state version
charts.setViewState({...chartView,version:2});
charts.destroy();
const gantt=new Gantt(document.createElement('div'),{tasks:[{id:'a',start:'2026-11-16',end:'2026-11-17'}]}); gantt.updateTask('a',{progress:50}); gantt.setView('mini'); gantt.setMiniType('summary'); gantt.setRange({start:'2026-11-01',end:'2026-12-01'}); console.log(gantt.getSummary()?.progress); gantt.destroy();
const restorePager=new Pagination<string[]>(document.createElement('div'),{history:{pageKey:'ordersPage',sizeKey:'ordersSize'},load:async()=>({total:10,data:['x']})});restorePager.setDisabled(true);restorePager.destroy();
const virtualFeed=new InfiniteScroll<{id:number},number>(document.createElement('div'),{auto:false,virtual:{itemHeight:56},cache:{key:'consumer-test'},getKey:item=>item.id,load:async()=>({items:[],hasMore:false})});const snapshot=virtualFeed.getSnapshot();virtualFeed.restoreSnapshot(snapshot);virtualFeed.saveCache();virtualFeed.restoreCache();virtualFeed.clearCache();virtualFeed.destroy();
const resourceCalendar=new Calendar(document.createElement('div'),{resources:[{id:'A',title:'회의실 A'}],onResourceChange:id=>console.log(id),load:async ({start,end,resourceId,signal})=>signal.aborted?[]:[{id:'a',start,end,allDay:true,resourceId}]});resourceCalendar.setResource('A');resourceCalendar.updateOccurrence('series','2026-11-16',{title:'수정'});resourceCalendar.restoreOccurrence('series','2026-11-16');resourceCalendar.reload();resourceCalendar.cancelLoad();resourceCalendar.destroy();
const calendar=new Calendar(document.createElement('div'),{events:[{id:'a',start:'2026-11-16',end:'2026-11-17',allDay:true}]}); calendar.getOccurrences({start:'2026-11-01',end:'2026-12-01'}); calendar.destroy();
const uploader=new Uploader(document.createElement('div'),{schema:[{field:'qty',type:'integer'}],onUpload:async ({file,data,signal,onProgress})=>{onProgress(100);return {name:file.name,data,aborted:signal.aborted};}}); uploader.addFiles([new File(['a'],'a.txt')]); uploader.destroy();
const uploadBudget=new Uploader(document.createElement('div'),{maxTotalFileSize:1024,rejectDuplicates:true,onReject:({reason})=>console.log(reason)});const queuedBytes:number=uploadBudget.getQueueBytes();uploadBudget.destroy();
const storedCalendar=new Calendar(document.createElement('div'));storedCalendar.setViewState({...storedCalendar.getViewState(),weekStartsOn:1});storedCalendar.destroy();
const tabs=new Tabs('#tabs',{activation:'manual',items:[{id:'intro',label:'소개',content:'본문'}]}); const active:string=tabs.getActive(); tabs.setActive(active);tabs.destroy();
const accordion=new Accordion('#faq',{items:[{id:'info',label:'안내'}]}); const opened:boolean=accordion.toggle('info'); if(opened)accordion.setOpen([]);accordion.destroy();
const dialog=new Dialog('#dialog'); const confirmed:boolean=await dialog.open({title:'확인',onConfirm:async ({signal})=>{if(signal.aborted)throw Error('cancelled');}});if(!confirmed)dialog.close();dialog.destroy();
`);
await writeFile(path.join(consumer, 'tsconfig.json'), JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,lib:['ES2022','DOM']},files:['usage.mts']},null,2));
