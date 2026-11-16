import {test} from 'node:test';import assert from 'node:assert/strict';import {parseUploadFileInWorker} from '../src/worker-client.js';
test('worker client stages, serialized limits, settlement and resource cleanup',async()=>{
 const Original=globalThis.Worker;let instance;
 globalThis.Worker=class{constructor(url){this.url=url;instance=this;}terminate(){this.terminated=true;}postMessage(data){this.request=data;queueMicrotask(()=>{this.onmessage({data:{stage:'reading'}});this.onmessage({data:{stage:'parsing'}});this.onmessage({data:{result:{kind:'file',sheets:[]}}});});}};
 try{const stages=[],file={size:1,name:'a.csv'},result=await parseUploadFileInWorker(file,{workerURL:'worker.js',maxRows:2,schema:[{validate:()=>true}]},undefined,s=>stages.push(s));assert.equal(result.kind,'file');assert.deepEqual(stages,['starting','reading','parsing','complete']);assert.equal(instance.terminated,true);assert.equal(instance.request.options.maxRows,2);assert.equal(instance.request.options.schema,undefined);}
 finally{globalThis.Worker=Original;}
});
test('worker client abort, timeout, constructor/clone errors and progress errors terminate',async()=>{
 const Original=globalThis.Worker;let instance,constructed=0;
 globalThis.Worker=class{constructor(){constructed++;instance=this;}terminate(){this.terminated=true;}postMessage(){}};
 const options={workerURL:'worker.js',parseTimeout:10},file={size:1};
 try{
  const c=new AbortController(),promise=parseUploadFileInWorker(file,options,c.signal);c.abort();await assert.rejects(promise,{name:'AbortError'});assert.equal(instance.terminated,true);
  await assert.rejects(parseUploadFileInWorker(file,options),{name:'TimeoutError'});assert.equal(instance.terminated,true);
  const before=constructed,c2=new AbortController();c2.abort();await assert.rejects(parseUploadFileInWorker(file,options,c2.signal),{name:'AbortError'});assert.equal(constructed,before);
  const c3=new AbortController();await assert.rejects(parseUploadFileInWorker(file,options,c3.signal,()=>c3.abort()),{name:'AbortError'});assert.equal(constructed,before);
  const p=parseUploadFileInWorker(file,options,undefined,stage=>{if(stage==='parsing')throw new Error('callback');});instance.onmessage({data:{stage:'parsing'}});await assert.rejects(p,/callback/);assert.equal(instance.terminated,true);
  const p2=parseUploadFileInWorker(file,options);instance.onmessage({data:{error:{name:'RangeError',message:'limit'}}});await assert.rejects(p2,{name:'RangeError',message:'limit'});assert.equal(instance.terminated,true);
  globalThis.Worker=class{constructor(){throw new Error('CSP');}};await assert.rejects(parseUploadFileInWorker(file,options),/CSP/);
  assert.throws(()=>parseUploadFileInWorker(file,{workerURL:'x',maxFileSize:0}));assert.throws(()=>parseUploadFileInWorker(file,{workerURL:'x',parseTimeout:0}));
 }finally{globalThis.Worker=Original;}
});
