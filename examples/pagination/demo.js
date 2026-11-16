window.failNext=false;
window.pager=new MoumPagination('#component',{total:237,pageSize:10,load:async({offset,pageSize,signal})=>{
 await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,250);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('취소됨','AbortError'));},{once:true});});
 if(window.failNext){window.failNext=false;document.querySelector('#fail').setAttribute('aria-pressed','false');throw new Error('조회에 실패했습니다. 다시 시도하세요.');}
 return {total:237,data:Array.from({length:Math.min(pageSize,237-offset)},(_,i)=>({id:offset+i+1,name:`발주 검토 ${offset+i+1}`}))};
},onChange:state=>{const list=document.querySelector('#rows');list.replaceChildren();for(const item of state.data||[]){const li=document.createElement('li');li.textContent=`${item.id} · ${item.name}`;list.append(li);}document.querySelector('#result').textContent=JSON.stringify({page:state.page,total:state.total,pageSize:state.pageSize},null,2);}});
void pager.reload();
document.querySelector('#reset').addEventListener('click',()=>{window.failNext=false;document.querySelector('#fail').setAttribute('aria-pressed','false');void pager.setPageSize(10);});
document.querySelector('#fail').addEventListener('click',event=>{window.failNext=!window.failNext;event.target.setAttribute('aria-pressed',String(window.failNext));});
