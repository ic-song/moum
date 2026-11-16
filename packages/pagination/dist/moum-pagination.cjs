/*! MOUM pagination v0.2.0 | MIT License | See LICENSE */
'use strict';
function paginationState(options = {}) {
  const {total=0,pageSize=20,page=1}=options;
  if(!Number.isSafeInteger(total)||total<0||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>10000||!Number.isSafeInteger(page)||page<1)throw new RangeError('total은 0 이상, page는 1 이상, pageSize는 1~10,000 정수입니다.');
  const pageCount=Math.max(1,Math.ceil(total/pageSize)),current=Math.min(page,pageCount);
  return {total,pageSize,page:current,pageCount,offset:(current-1)*pageSize,from:total?(current-1)*pageSize+1:0,to:Math.min(current*pageSize,total)};
}
function pgEl(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function paginationURLState(url,defaults={},options={}){
  const source=new URL(url),pageKey=options.pageKey??'page',sizeKey=options.sizeKey??'pageSize';
  if(typeof pageKey!=='string'||typeof sizeKey!=='string'||!pageKey||!sizeKey||pageKey===sizeKey||pageKey.length>100||sizeKey.length>100)throw new TypeError('페이지 URL 키는 서로 다른 1~100자 문자열입니다.');
  const integer=(key,fallback,max)=>{const text=source.searchParams.get(key);return text&&/^\d+$/.test(text)&&Number.isSafeInteger(Number(text))&&Number(text)>=1&&Number(text)<=max?Number(text):fallback;};
  const pageSize=integer(sizeKey,defaults.pageSize??20,10000),page=integer(pageKey,defaults.page??1,Math.floor(Number.MAX_SAFE_INTEGER/pageSize));paginationState({page,pageSize});return {page,pageSize};
}
function pgLoad(load,request,timeout){
  return new Promise((resolve,reject)=>{
    const signal=request.signal;
    const finish=(error,result)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve(result);};
    const abort=()=>finish(new DOMException('조회를 취소했습니다.','AbortError'));
    const timer=setTimeout(()=>{const error=new Error('조회 응답 시간이 초과되었습니다. 다시 시도하세요.');error.name='TimeoutError';finish(error);},timeout);
    if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
    try{Promise.resolve(load(request)).then(result=>finish(null,result),error=>finish(error));}catch(error){finish(error);}
  });
}
class Pagination {
  constructor(target,options={}){
    this.target=typeof target==='string'?document.querySelector(target):target;if(!this.target||this.target.childNodes.length)throw new Error('비어 있는 페이지 컨테이너가 필요합니다.');
    this.options={title:'페이지 이동',pageSizes:[10,20,50,100],requestTimeout:30000,...options};this.state=paginationState(options);this.data=null;this.loading=false;this.error=null;this.version=0;
    if(!Number.isFinite(this.options.requestTimeout)||this.options.requestTimeout<=0||this.options.requestTimeout>600000)throw new RangeError('requestTimeout은 0 초과 600,000 이하 밀리초입니다.');
    if(!Array.isArray(this.options.pageSizes)||this.options.pageSizes.some(n=>!Number.isInteger(n)||n<1||n>10000)||options.load!=null&&typeof options.load!=='function')throw new TypeError('페이지 옵션을 확인하세요.');
    this.historyDefaults={page:options.page??1,pageSize:options.pageSize??20};this.historyError=null;
    if(this.options.history){if(typeof this.options.history!=='object'||!['push','replace'].includes(this.options.history.mode??'push'))throw new TypeError('history는 URL 키와 push/replace 모드 객체입니다.');this.initialURLState=paginationURLState(location.href,this.historyDefaults,this.options.history);this.state=paginationState({...this.state,...this.initialURLState});this.onPopState=()=>{this.initialURLState=null;const next=paginationURLState(location.href,this.historyDefaults,this.options.history);void this.request({...this.state,...next},{fromURL:true,historyMode:'replace'});};window.addEventListener('popstate',this.onPopState);}
    this.root=pgEl('nav',null,'moum-pagination');this.root.setAttribute('aria-label',this.options.title);this.target.append(this.root);this.render();
  }
  active(){if(this.destroyed)throw new Error('제거된 페이지 컴포넌트입니다.');}
  getState(){return {...this.state,loading:this.loading,error:this.error?.message||null,historyError:this.historyError};}
  getData(){return this.data;}
  cancel(){const rollback=this.loading&&this.pendingFromURL;this.version++;this.controller?.abort();this.controller=null;this.loading=false;if(rollback&&!this.destroyed)this.syncURL('replace');if(!this.destroyed)this.render();}
  async goTo(page){this.active();this.initialURLState=null;return this.request({...this.state,page});}
  async setPageSize(pageSize){this.active();this.initialURLState=null;return this.request({...this.state,pageSize,page:1});}
  setTotal(total){this.active();const next=paginationState({...this.state,total});this.cancel();this.state=next;this.error=null;this.syncURL('replace');this.render();}
  setDisabled(disabled){this.active();this.options.disabled=!!disabled;if(disabled)this.cancel();this.render();}
  async reload(){this.active();const initial=this.initialURLState;this.initialURLState=null;return this.request(initial?{...this.state,...initial}:this.state,{fromURL:!!initial,historyMode:'replace'});}
  async retry(){this.active();return this.request(this.pending||this.state,{fromURL:this.pendingFromURL,historyMode:this.pendingHistoryMode});}
  syncURL(mode){if(!this.options.history)return;try{const o=this.options.history,url=new URL(location.href);url.searchParams.set(o.pageKey??'page',String(this.state.page));url.searchParams.set(o.sizeKey??'pageSize',String(this.state.pageSize));if(url.href!==location.href)history[mode==='replace'||o.mode==='replace'?'replaceState':'pushState'](history.state,'',url.href);this.historyError=null;}catch(error){this.historyError='페이지 URL을 저장하지 못했습니다.';this.options.onError?.(error);}}
  async request(input,{fromURL=false,historyMode='push'}={}){
    const next=paginationState(input);if(fromURL&&this.options.load){if(!Number.isSafeInteger((input.page-1)*next.pageSize))throw new RangeError('페이지 위치 범위를 초과했습니다.');next.page=input.page;next.offset=(input.page-1)*next.pageSize;next.from=0;next.to=0;}this.cancel();const version=this.version,controller=new AbortController();this.controller=controller;this.pending=next;this.pendingFromURL=fromURL;this.pendingHistoryMode=historyMode;this.loading=true;this.error=null;this.render();
    let result,committed=next;
    try{
      if(this.options.load){
        result=await pgLoad(this.options.load,{...next,signal:controller.signal},this.options.requestTimeout);
        if(this.destroyed||version!==this.version)return false;
        if(!result||!Number.isSafeInteger(result.total)||result.total<0)throw new TypeError('load는 {total, data}를 반환해야 합니다.');
        committed=paginationState({...next,total:result.total});
        if(committed.page!==next.page){result=await pgLoad(this.options.load,{...committed,signal:controller.signal},this.options.requestTimeout);if(this.destroyed||version!==this.version)return false;if(!result||!Number.isSafeInteger(result.total)||result.total<0||paginationState({...committed,total:result.total}).page!==committed.page)throw new Error('조회 중 전체 건수가 바뀌었습니다. 다시 시도하세요.');committed=paginationState({...committed,total:result.total});}
      }
    }catch(error){if(this.destroyed||version!==this.version)return false;if(error?.name==='TimeoutError')controller.abort();this.loading=false;this.controller=null;this.error=error instanceof Error?error:new Error(String(error));if(fromURL)this.syncURL('replace');this.render();this.options.onError?.(this.error);return false;}
    if(this.destroyed||version!==this.version)return false;
    this.state=committed;if(result)this.data=result.data;this.loading=false;this.controller=null;this.error=null;this.syncURL(historyMode);this.render();this.options.onChange?.({...this.getState(),data:this.data});return true;
  }
  render(){
    const focused=this.root.contains(document.activeElement)?document.activeElement?.dataset.control:null;this.root.replaceChildren();const s=this.state,o=this.options;
    this.root.setAttribute('aria-busy',String(this.loading));this.root.dataset.state=this.loading?'loading':this.error?'error':s.total?'ready':'empty';const info=pgEl('p',`${s.from}–${s.to} / ${s.total}건`,'moum-pagination-summary');this.root.append(info);const controls=pgEl('div',null,'moum-pagination-controls');
    const button=(text,page,key,disabled=false)=>{const b=pgEl('button',text);b.type='button';b.dataset.control=key;b.disabled=disabled||!!o.disabled;b.addEventListener('click',()=>{void this.goTo(page);});if(page===s.page&&/^page/.test(key))b.setAttribute('aria-current','page');controls.append(b);};
    button('처음',1,'first',s.page===1);button('이전',Math.max(1,s.page-1),'prev',s.page===1);
    const start=Math.max(1,Math.min(s.page-2,s.pageCount-4)),end=Math.min(s.pageCount,start+4);
    for(let p=start;p<=end;p++)button(String(p),p,`page-${p}`);
    button('다음',Math.min(s.pageCount,s.page+1),'next',s.page===s.pageCount);button('마지막',s.pageCount,'last',s.page===s.pageCount);this.root.append(controls);
    const label=pgEl('label','페이지 크기 '),select=pgEl('select');select.setAttribute('aria-label','페이지 크기');select.dataset.control='size';select.disabled=!!o.disabled;for(const n of [...new Set([...o.pageSizes,s.pageSize])].sort((a,b)=>a-b)){const item=pgEl('option',`${n}개`);item.value=n;item.selected=n===s.pageSize;select.append(item);}select.addEventListener('change',()=>{void this.setPageSize(Number(select.value));});label.append(select);this.root.append(label);
    const status=pgEl('p',this.loading?'불러오는 중…':this.error?this.error.message:`${s.page} / ${s.pageCount} 페이지`,'moum-pagination-status');status.setAttribute('role','status');this.root.append(status);
    if(o.jump!==false){const label=pgEl('label','페이지 번호 '),input=pgEl('input');input.type='number';input.min=1;input.max=s.pageCount;input.required=true;input.value=s.page;input.dataset.control='jump';input.disabled=!!o.disabled;const jump=pgEl('button','이동');jump.type='button';jump.dataset.control='jump-submit';jump.disabled=!!o.disabled||s.pageCount===1;const apply=()=>{if(input.checkValidity())void this.goTo(Number(input.value));else input.reportValidity();};jump.addEventListener('click',apply);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply();}});label.append(input);this.root.append(label,jump);}
    if(this.loading){const cancel=pgEl('button','조회 취소');cancel.type='button';cancel.dataset.control='cancel';cancel.addEventListener('click',()=>this.cancel());this.root.append(cancel);}
    if(this.historyError)this.root.append(pgEl('p',this.historyError,'moum-pagination-status'));
    if(this.error){const retry=pgEl('button','다시 시도');retry.type='button';retry.disabled=!!o.disabled;retry.dataset.control='retry';retry.addEventListener('click',()=>{void this.retry();});this.root.append(retry);}
    if(focused)this.root.querySelector(`[data-control="${focused}"]`)?.focus();
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;this.cancel();if(this.onPopState)window.removeEventListener('popstate',this.onPopState);this.root.remove();}
}

module.exports = { paginationState, paginationURLState, Pagination };
