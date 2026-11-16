window.picker=new MoumDatePicker('#component',{title:'조회 기간',mode:'range',date:'2026-11-16',min:'2026-01-01',max:'2027-12-31',disabledWeekdays:[0,6],name:'period',onChange:value=>{document.querySelector('#result').textContent=JSON.stringify(value,null,2);}});
document.querySelector('#reset').addEventListener('click',()=>picker.setValue(null));
document.querySelector('#disabled').addEventListener('click',event=>{const disabled=event.target.getAttribute('aria-pressed')!=='true';picker.setDisabled(disabled);event.target.setAttribute('aria-pressed',String(disabled));});
