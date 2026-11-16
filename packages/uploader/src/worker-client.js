import { normalizeUploadLimits } from './parser.js';

export function parseUploadFileInWorker(file, options = {}, signal, onStage) {
  const limits=normalizeUploadLimits(options),timeout=options.parseTimeout??120000;
  if(!options.workerURL)throw new TypeError('workerURL을 지정하세요.');
  if(!Number.isFinite(timeout)||timeout<=0)throw new RangeError('parseTimeout은 양수입니다.');
  if(!file||!Number.isFinite(file.size)||file.size>limits.maxFileSize)throw new RangeError('파일 크기 제한을 확인하세요.');
  return new Promise((resolve,reject)=>{
    let worker,timer,settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker?.terminate();if(error)reject(error);else resolve(value);};
    const abort=()=>finish(new DOMException('파일 파싱을 취소했습니다.','AbortError'));
    if(signal?.aborted){abort();return;}
    try{
      onStage?.('starting');if(signal?.aborted){abort();return;}worker=new Worker(options.workerURL);
      signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>finish(new DOMException('파일 파싱 제한 시간을 초과했습니다.','TimeoutError')),timeout);
      worker.onmessage=({data})=>{
        if(settled)return;
        try{if(data?.stage){if(['reading','parsing'].includes(data.stage))onStage?.(data.stage);}
          else if(data?.error){const error=new Error(data.error.message);error.name=data.error.name||'Error';finish(error);}
          else if(data?.result){onStage?.('complete');finish(null,data.result);}
          else finish(new Error('파싱 Worker 응답을 확인하세요.'));
        }catch(error){finish(error);}
      };
      worker.onerror=event=>{event.preventDefault();finish(new Error('파싱 Worker를 실행하지 못했습니다. workerURL과 CSP, 로컬 SheetJS 경로를 확인하세요.'));};
      worker.onmessageerror=()=>finish(new Error('파싱 Worker 응답을 읽지 못했습니다.'));
      worker.postMessage({file,options:{...limits,encoding:options.encoding,delimiter:options.delimiter}});
    }catch(error){finish(error);}
  });
}
