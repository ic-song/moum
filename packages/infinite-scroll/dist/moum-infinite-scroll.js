/*! MOUM infinite-scroll v0.1.0 | MIT License | See LICENSE */
(function () {
'use strict';
function infEl(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function infLoad(load,request,timeout){
  return new Promise((resolve,reject)=>{
    const signal=request.signal;
    const finish=(error,result)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve(result);};
    const abort=()=>finish(new DOMException('조회를 취소했습니다.','AbortError'));
    const timer=setTimeout(()=>{const error=new Error('조회 응답 시간이 초과되었습니다. 다시 시도하세요.');error.name='TimeoutError';finish(error);},timeout);
    if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
    try{Promise.resolve(load(request)).then(result=>finish(null,result),error=>finish(error));}catch(error){finish(error);}
  });
}
class InfiniteScroll {
  constructor(target,options={}){
    this.target=typeof target==='string'?document.querySelector(target):target;if(!this.target||this.target.childNodes.length)throw new Error('비어 있는 목록 컨테이너가 필요합니다.');
    this.options={title:'목록',auto:true,maxItems:1000,pageSize:20,initialCursor:null,requestTimeout:30000,...options};const o=this.options;
    if(!Number.isFinite(o.requestTimeout)||o.requestTimeout<=0||o.requestTimeout>600000)throw new RangeError('requestTimeout은 0 초과 600,000 이하 밀리초입니다.');
    if(typeof o.load!=='function'||!Number.isInteger(o.maxItems)||o.maxItems<1||o.maxItems>100000||!Number.isInteger(o.pageSize)||o.pageSize<1||o.pageSize>1000||o.getKey!=null&&typeof o.getKey!=='function'||o.renderItem!=null&&typeof o.renderItem!=='function')throw new TypeError('load 함수와 유효한 목록 크기 옵션이 필요합니다.');
    this.items=[];this.keys=new Set();this.cursor=o.initialCursor;this.hasMore=true;this.loading=false;this.error=null;this.version=0;
    this.root=infEl('section',null,'moum-infinite-scroll');this.root.setAttribute('aria-label',o.title);
    this.viewport=infEl('div',null,'moum-infinite-scroll-viewport');this.viewport.tabIndex=0;this.viewport.setAttribute('role','region');this.viewport.setAttribute('aria-label',`${o.title} 스크롤 영역`);
    this.list=infEl('ul',null,'moum-infinite-scroll-list');this.sentinel=infEl('div');this.sentinel.setAttribute('aria-hidden','true');this.viewport.append(this.list,this.sentinel);
    this.status=infEl('p',null,'moum-infinite-scroll-status');this.status.setAttribute('role','status');this.more=infEl('button','더 보기');this.more.type='button';this.more.addEventListener('click',()=>{void this.loadMore();});this.root.append(this.viewport,this.status,this.more);this.target.append(this.root);this.render();
    if(typeof IntersectionObserver!=='undefined'){this.observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&this.options.auto&&!this.error&&!this.loading&&this.hasMore&&this.items.length<this.options.maxItems)void this.loadMore();},{root:this.viewport,rootMargin:'80px'});this.observer.observe(this.sentinel);}
  }
  active(){if(this.destroyed)throw new Error('제거된 무한 스크롤입니다.');}
  getItems(){return this.items.slice();}
  getState(){return {count:this.items.length,cursor:this.cursor,hasMore:this.hasMore,loading:this.loading,error:this.error?.message||null,limitReached:this.items.length>=this.options.maxItems};}
  cancel(){this.version++;this.controller?.abort();this.controller=null;this.loading=false;if(!this.destroyed)this.render();}
  reset(cursor=this.options.initialCursor){this.active();this.cancel();this.cursor=cursor;this.hasMore=true;this.error=null;this.items=[];this.keys.clear();this.list.replaceChildren();this.viewport.scrollTop=0;this.render();this.rearm();}
  setAuto(auto){this.active();this.options.auto=!!auto;this.rearm();}
  rearm(){if(this.observer){this.observer.unobserve(this.sentinel);if(!this.destroyed)this.observer.observe(this.sentinel);}}
  async loadMore(){
    this.active();if(this.loading||!this.hasMore||this.items.length>=this.options.maxItems)return false;
    const version=++this.version,controller=new AbortController();this.controller=controller;this.loading=true;this.error=null;this.render();
    let result,added=[],newKeys=new Set(this.keys),fragment=document.createDocumentFragment();
    try{
      result=await infLoad(this.options.load,{cursor:this.cursor,pageSize:Math.min(this.options.pageSize,this.options.maxItems-this.items.length),signal:controller.signal},this.options.requestTimeout);
      if(this.destroyed||version!==this.version)return false;
      if(!result||!Array.isArray(result.items)||typeof result.hasMore!=='boolean'||result.items.length>Math.min(this.options.pageSize,this.options.maxItems-this.items.length))throw new TypeError('load 결과는 요청 크기 이하의 {items, nextCursor, hasMore}여야 합니다.');
      if(result.hasMore&&(result.nextCursor==null||Object.is(result.nextCursor,this.cursor)))throw new Error('다음 커서가 진행하지 않습니다.');
      for(const item of result.items){if(this.options.getKey){const key=this.options.getKey(item);if(!['string','number'].includes(typeof key)||typeof key==='number'&&!Number.isFinite(key))throw new TypeError('항목 키는 문자열 또는 유한한 숫자입니다.');if(newKeys.has(key))continue;newKeys.add(key);}
        const node=infEl('li',null,'moum-infinite-scroll-item'),content=this.options.renderItem?this.options.renderItem(item,this.items.length+added.length):String(item);
        if(typeof content==='string')node.textContent=content;else if(content?.nodeType===1&&!content.isConnected&&!content.parentNode)node.append(content);else throw new TypeError('renderItem은 문자열 또는 새 Element를 반환하세요.');fragment.append(node);added.push(item);}
      if(result.hasMore&&!added.length)throw new Error('새 항목이 없습니다. 서버 커서를 확인한 뒤 다시 시도하세요.');
    }catch(error){if(this.destroyed||version!==this.version)return false;if(error?.name==='TimeoutError')controller.abort();this.loading=false;this.error=error instanceof Error?error:new Error(String(error));this.render();this.options.onError?.(this.error);return false;}
    if(this.destroyed||version!==this.version)return false;
    this.items.push(...added);this.keys=newKeys;this.list.append(fragment);this.cursor=result.nextCursor??null;this.hasMore=result.hasMore;this.loading=false;this.error=null;this.render();this.options.onChange?.({...this.getState(),items:this.getItems()});this.rearm();return true;
  }
  retry(){return this.loadMore();}
  render(){const s=this.getState();this.root.setAttribute('aria-busy',String(s.loading));this.root.dataset.state=s.loading?'loading':s.error?'error':s.limitReached?'capacity':!s.hasMore?'complete':'ready';this.more.disabled=s.loading||!s.hasMore||s.limitReached;this.more.textContent=s.error?'다시 시도':'더 보기';this.status.textContent=s.loading?'불러오는 중…':s.error?s.error:s.limitReached?'표시 한도에 도달했습니다. 검색 조건을 좁히거나 목록을 초기화하세요.':!s.hasMore?(s.count?`${s.count}개 · 마지막 항목입니다.`:'항목이 없습니다.'):`${s.count}개 · 다음 항목을 불러올 수 있습니다.`;}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.cancel();this.observer?.disconnect();this.root.remove();}
}

globalThis.MoumInfiniteScroll = InfiniteScroll;
Object.assign(globalThis.MoumInfiniteScroll, {  });
})();
