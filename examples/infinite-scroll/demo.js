window.failNext=false;let virtualMode=false,savedSnapshot;
function createFeed(){return new MoumInfiniteScroll('#component',{title:'업무 알림',auto:false,pageSize:virtualMode?500:10,maxItems:virtualMode?20000:80,...(virtualMode?{virtual:{itemHeight:56,height:400,overscan:4},...(location.protocol!=='file:'?{cache:{key:'demo-notifications-large-v1',ttl:300000}}:{})}:{}),getKey:item=>item.id,renderItem:item=>item.id+' · '+item.name,load:async({cursor,pageSize,signal})=>{
 await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,window.slowLoad?10000:250);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('취소됨','AbortError'));},{once:true});});
 if(window.failNext){window.failNext=false;document.querySelector('#fail').setAttribute('aria-pressed','false');throw new Error('다음 항목을 불러오지 못했습니다. 다시 시도하세요.');}
 const total=virtualMode?10000:53,start=cursor??0,end=Math.min(start+pageSize,total);return {items:Array.from({length:end-start},(_,i)=>({id:start+i+1,name:'입고 확인 알림 '+(start+i+1)})),nextCursor:end,hasMore:end<total};
},onChange:state=>{document.querySelector('#result').textContent=JSON.stringify({count:state.count,hasMore:state.hasMore,limitReached:state.limitReached,restored:state.restored},null,2);}});}
window.feed=createFeed();void feed.loadMore();
document.querySelector('#reset').addEventListener('click',()=>{window.failNext=false;document.querySelector('#fail').setAttribute('aria-pressed','false');feed.reset();void feed.loadMore();});
document.querySelector('#fail').addEventListener('click',event=>{window.failNext=!window.failNext;event.target.setAttribute('aria-pressed',String(window.failNext));});
document.querySelector('#auto').addEventListener('click',event=>{const auto=event.target.getAttribute('aria-pressed')!=='true';feed.setAuto(auto);event.target.setAttribute('aria-pressed',String(auto));});
document.querySelector('#virtual').addEventListener('click',event=>{feed.destroy();virtualMode=!virtualMode;window.feed=createFeed();if(!feed.getState().count)void feed.loadMore();event.target.setAttribute('aria-pressed',String(virtualMode));event.target.textContent=virtualMode?'일반 목록':'대용량 가상 목록';document.querySelector('#auto').setAttribute('aria-pressed','false');});
document.querySelector('#batch').addEventListener('click',async event=>{if(!virtualMode){document.querySelector('#result').textContent='대용량 가상 목록으로 전환하세요.';return;}const current=feed;event.target.disabled=true;try{for(let i=0;i<10&&current===feed;i++)if(!await current.loadMore())break;}finally{event.target.disabled=false;}});
document.querySelector('#snapshot').addEventListener('click',()=>{savedSnapshot=feed.getSnapshot();document.querySelector('#result').textContent='현재 목록과 스크롤 위치를 기억했습니다.';});
document.querySelector('#restore').addEventListener('click',()=>{try{if(!savedSnapshot)throw new Error('먼저 현재 목록을 기억하세요.');feed.restoreSnapshot(savedSnapshot);}catch(error){document.querySelector('#result').textContent=error.message;}});
document.querySelector('#resume').addEventListener('click',()=>{feed.destroy();window.feed=createFeed();if(!feed.getState().count)void feed.loadMore();document.querySelector('#auto').setAttribute('aria-pressed','false');});
document.querySelector('#clear-cache').addEventListener('click',()=>{feed.clearCache();document.querySelector('#result').textContent='현재 모드의 캐시를 지웠습니다.';});

window.slowLoad=false;document.querySelector('#slow-load').addEventListener('click',event=>{window.slowLoad=!window.slowLoad;event.target.setAttribute('aria-pressed',String(window.slowLoad));});
