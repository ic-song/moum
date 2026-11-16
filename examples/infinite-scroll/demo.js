window.failNext=false;
window.feed=new MoumInfiniteScroll('#component',{title:'업무 알림',auto:false,pageSize:10,maxItems:80,getKey:item=>item.id,renderItem:item=>`${item.id} · ${item.name}`,load:async({cursor,pageSize,signal})=>{
 await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,250);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('취소됨','AbortError'));},{once:true});});
 if(window.failNext){window.failNext=false;document.querySelector('#fail').setAttribute('aria-pressed','false');throw new Error('다음 항목을 불러오지 못했습니다. 다시 시도하세요.');}
 const start=cursor??0,end=Math.min(start+pageSize,53);return {items:Array.from({length:end-start},(_,i)=>({id:start+i+1,name:`입고 확인 알림 ${start+i+1}`})),nextCursor:end,hasMore:end<53};
},onChange:state=>{document.querySelector('#result').textContent=JSON.stringify({count:state.count,hasMore:state.hasMore,limitReached:state.limitReached},null,2);}});
void feed.loadMore();
document.querySelector('#reset').addEventListener('click',()=>{window.failNext=false;document.querySelector('#fail').setAttribute('aria-pressed','false');feed.reset();void feed.loadMore();});
document.querySelector('#fail').addEventListener('click',event=>{window.failNext=!window.failNext;event.target.setAttribute('aria-pressed',String(window.failNext));});
document.querySelector('#auto').addEventListener('click',event=>{const auto=event.target.getAttribute('aria-pressed')!=='true';feed.setAuto(auto);event.target.setAttribute('aria-pressed',String(auto));});
