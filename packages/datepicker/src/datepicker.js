const dateDay = 86400000;
export function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('날짜는 YYYY-MM-DD 형식입니다.');
  const stamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value || value < '0001-01-01' || value > '9999-12-31') throw new RangeError('올바른 날짜를 입력하세요.');
  return stamp;
}
function dpDate(stamp) { return new Date(stamp).toISOString().slice(0, 10); }
function dpToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export class DatePickerModel {
  constructor(options = {}) {
    this.options = { mode: 'single', min: '0001-01-01', max: '9999-12-31', disabledWeekdays: [], ...options };
    const o = this.options;
    if (!['single','range'].includes(o.mode) || dateValue(o.min) > dateValue(o.max) || !Array.isArray(o.disabledWeekdays) || o.disabledWeekdays.some(n => !Number.isInteger(n) || n < 0 || n > 6) || (o.isDateDisabled != null && typeof o.isDateDisabled !== 'function')) throw new TypeError('날짜 선택 옵션을 확인하세요.');
    this.value = null; this.setValue(o.value ?? null);
  }
  isDisabled(date) { const n = dateValue(date), o = this.options; return date < o.min || date > o.max || o.disabledWeekdays.includes(new Date(n).getUTCDay()) || !!o.isDateDisabled?.(date); }
  getValue() { return structuredClone(this.value); }
  setValue(value) {
    if (value === null || value === '') { this.value = null; return; }
    if (this.options.mode === 'single') { if (this.isDisabled(value)) throw new RangeError('선택할 수 없는 날짜입니다.'); this.value = value; return; }
    if (!value || typeof value !== 'object' || !value.start || (value.end != null && typeof value.end !== 'string')) throw new TypeError('기간은 {start, end} 형식입니다.');
    const a = dateValue(value.start), b = value.end == null ? a : dateValue(value.end);
    if (b < a || (b-a)/dateDay > 3660) throw new RangeError('기간은 시작일부터 최대 3,660일입니다.');
    for (let n = a; n <= b; n += dateDay) if (this.isDisabled(dpDate(n))) throw new RangeError('기간에 선택할 수 없는 날짜가 있습니다.');
    this.value = { start: value.start, end: value.end ?? null };
  }
  select(date) {
    if (this.options.mode === 'single') this.setValue(date);
    else { const v = this.value; this.setValue(!v || v.end ? {start:date,end:null} : {start:date < v.start ? date : v.start,end:date < v.start ? v.start : date}); }
    return this.getValue();
  }
}
function dpEl(tag, text, cls) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
let dpSequence = 0;
function dpInputValue(text,range) { text=text.trim();if(!text)return null;if(!range)return text;const parts=text.split(/\s*~\s*/);if(parts.length>2)throw new TypeError('기간은 시작일 ~ 종료일 형식입니다.');return {start:parts[0],end:parts[1]||null}; }
export class DatePicker {
  static attach(input, options = {}) {
    input = typeof input === 'string' ? document.querySelector(input) : input;
    if (!(input instanceof HTMLInputElement) || !['text','search'].includes(input.type)) throw new TypeError('팝업에는 text 또는 search 입력 필드가 필요합니다.');
    const host = dpEl('div'); document.body.append(host);
    let picker;
    try { picker = new DatePicker(host, { ...options, value: options.value === undefined ? dpInputValue(input.value,options.mode==='range') : options.value }); }
    catch (error) { host.remove(); throw error; }
    picker.popupInput = input; picker.popupHost = host; picker.root.classList.add('moum-datepicker-popup'); picker.root.hidden = true;
    picker.inputClassAdded=!input.classList.contains('moum-datepicker-input');input.classList.add('moum-datepicker-input');
    picker.root.id = `moum-datepicker-popup-${++dpSequence}`; picker.root.setAttribute('role','dialog');
    picker.savedAttributes = new Map(['role','aria-autocomplete','aria-haspopup','aria-expanded','aria-controls','aria-invalid','aria-describedby','readonly','aria-disabled'].map(name=>[name,input.getAttribute(name)]));
    picker.savedReadOnly=input.readOnly;input.readOnly=picker.options.disabled||picker.savedReadOnly;input.setAttribute('aria-disabled',String(picker.options.disabled));
    picker.inputError=dpEl('span',null,'moum-datepicker-input-error');picker.inputError.id=picker.root.id+'-error';picker.inputError.hidden=true;picker.inputError.setAttribute('role','alert');input.insertAdjacentElement('afterend',picker.inputError);
    input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),picker.inputError.id].filter(Boolean).join(' '));
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','none');
    input.setAttribute('aria-haspopup','dialog'); input.setAttribute('aria-expanded','false'); input.setAttribute('aria-controls',picker.root.id);
    const open = () => picker.open(), key = e => { if(e.key==='ArrowDown'){e.preventDefault();picker.open();} }, change = () => picker.attempt(()=>{
      if(picker.options.disabled||input.disabled)return;
      picker.setValue(dpInputValue(input.value,options.mode==='range')); picker.options.onChange?.(picker.getValue());
    });
    const outside = e => { if(!picker.root.contains(e.target)&&e.target!==input)picker.close(false); };
    const escape = e => { if(e.key==='Escape'&&!picker.root.hidden){e.preventDefault();picker.close();} };
    const position = () => picker.positionPopup();
    for(const [node,event,fn,capture] of [[input,'click',open],[input,'keydown',key],[input,'change',change],[document,'pointerdown',outside,true],[document,'focusin',outside],[document,'keydown',escape],[window,'resize',position],[window,'scroll',position,true]]){
      node.addEventListener(event,fn,capture); (picker.popupListeners??=[]).push(()=>node.removeEventListener(event,fn,capture));
    }
    picker.render(); return picker;
  }
  constructor(target, options = {}) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.target || this.target.childNodes.length) throw new Error('비어 있는 날짜 선택 컨테이너가 필요합니다.');
    this.options = { title: '날짜 선택', locale: 'ko-KR', weekStartsOn: 0, disabled: false, ...options };
    if (!Number.isInteger(this.options.weekStartsOn) || this.options.weekStartsOn < 0 || this.options.weekStartsOn > 6) throw new RangeError('weekStartsOn은 0~6입니다.');
    this.format = new Intl.DateTimeFormat(this.options.locale, { year:'numeric',month:'long',timeZone:'UTC' });
    this.model = new DatePickerModel(options); const v = this.model.getValue();
    this.focusDate = options.date || (typeof v === 'string' ? v : v?.start) || dpToday(); dateValue(this.focusDate);
    this.focusDate = this.focusDate < this.model.options.min ? this.model.options.min : this.focusDate > this.model.options.max ? this.model.options.max : this.focusDate;
    this.month = this.focusDate.slice(0,7)+'-01';
    this.root = dpEl('section',null,'moum-datepicker'); this.root.setAttribute('aria-label',this.options.title); this.target.append(this.root); this.render();
  }
  active() { if (this.destroyed) throw new Error('제거된 날짜 선택입니다.'); }
  syncInput() { if(!this.popupInput)return; const v=this.getValue();this.popupInput.value=typeof v==='string'?v:v?`${v.start}${v.end?' ~ '+v.end:''}`:'';this.popupInput.removeAttribute('aria-invalid');this.inputError.hidden=true;this.inputError.textContent=''; }
  open() { this.active();if(!this.popupInput||this.options.disabled||this.popupInput.disabled)return;this.root.hidden=false;this.popupInput.setAttribute('aria-expanded','true');this.render();this.root.querySelector('[data-date][tabindex="0"]')?.focus(); }
  close(restoreFocus = true) { this.active();if(!this.popupInput)return;const wasOpen=!this.root.hidden;this.root.hidden=true;this.root.replaceChildren();this.popupInput.setAttribute('aria-expanded','false');if(wasOpen&&restoreFocus)this.popupInput.focus(); }
  positionPopup() {
    if(!this.popupInput||this.root.hidden)return;
    const rect=this.popupInput.getBoundingClientRect(),edge=8,viewport=window.visualViewport;
    const width=viewport?.width||innerWidth,height=viewport?.height||innerHeight,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0;
    this.root.style.width=`${Math.min(380,width-edge*2)}px`;this.root.style.maxHeight=`${height-edge*2}px`;
    const box=this.root.getBoundingClientRect();this.root.style.left=`${Math.max(left+edge,Math.min(rect.left,left+width-box.width-edge))}px`;
    this.root.style.top=`${Math.max(top+edge,Math.min(rect.bottom+edge,top+height-box.height-edge))}px`;
  }
  getValue() { return this.model.getValue(); }
  setValue(value) { this.active(); this.model.setValue(value); const v=this.getValue(), date=typeof v==='string'?v:v?.start; if(date) {this.focusDate=date;this.month=date.slice(0,7)+'-01';} this.render(); }
  setDisabled(disabled) { this.active(); this.options.disabled=!!disabled;if(this.popupInput){this.popupInput.readOnly=!!disabled||this.savedReadOnly;this.popupInput.setAttribute('aria-disabled',String(!!disabled));} if(disabled)this.close(false);this.render(); }
  clear() { this.active(); this.model.setValue(null); this.render(); this.options.onChange?.(null); }
  attempt(fn) { try { fn(); } catch(error) { this.root.dataset.state='error';this.status.textContent=error.message;if(this.popupInput){this.popupInput.setAttribute('aria-invalid','true');this.inputError.textContent=error.message;this.inputError.hidden=false;} this.options.onError?.(error); } }
  moveMonth(delta) {
    const d = new Date(dateValue(this.month)); d.setUTCMonth(d.getUTCMonth()+delta); const year=d.getUTCFullYear(); if(year<1||year>9999)return;
    this.month=dpDate(d.getTime()); this.focusDate=this.month; this.render(); this.root.querySelector(`[data-nav="${delta}"]`)?.focus();
  }
  choose(date) { this.active(); if(this.options.disabled)return; this.model.select(date); this.focusDate=date; this.month=date.slice(0,7)+'-01'; this.render(); this.root.querySelector(`[data-date="${date}"]`)?.focus(); if(this.options.mode!=='range'||this.getValue()?.end)this.close();this.options.onChange?.(this.getValue()); }
  key(event,date) {
    const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}; let stamp=dateValue(date);
    if(event.key in offsets) stamp += offsets[event.key]*dateDay;
    else if(event.key==='Home'||event.key==='End') {const n=(new Date(stamp).getUTCDay()-this.options.weekStartsOn+7)%7;stamp+=(event.key==='Home'?-n:6-n)*dateDay;}
    else if(event.key==='PageUp'||event.key==='PageDown') {event.preventDefault();this.moveMonth(event.key==='PageUp'?-1:1);this.root.querySelector('[data-date][tabindex="0"]')?.focus();return;}
    else return;
    event.preventDefault(); if(stamp<dateValue('0001-01-01')||stamp>dateValue('9999-12-31'))return;
    this.focusDate=dpDate(stamp);this.month=this.focusDate.slice(0,7)+'-01';this.render();this.root.querySelector(`[data-date="${this.focusDate}"]`)?.focus();
  }
  render() {
    if(this.popupInput&&this.root.hidden){this.root.replaceChildren();this.syncInput();return;}
    this.root.replaceChildren(); const o=this.options,v=this.getValue(),range=o.mode==='range';this.root.dataset.state=o.disabled?'disabled':v?'selected':'empty';
    const button=(text,fn)=>{const b=dpEl('button',text);b.type='button';b.disabled=o.disabled;b.addEventListener('click',()=>this.attempt(fn));return b;};
    this.root.append(dpEl('h3',o.title));const tools=dpEl('div',null,'moum-datepicker-toolbar');
    for(const [n,text] of [[-1,'이전 달'],[1,'다음 달']]) {const b=button(text,()=>this.moveMonth(n));b.dataset.nav=n;if(n<0&&this.month==='0001-01-01'||n>0&&this.month==='9999-12-01')b.disabled=true;tools.append(b);}
    const heading=dpEl('strong',this.format.format(new Date(dateValue(this.month))));heading.setAttribute('aria-live','polite');tools.insertBefore(heading,tools.lastChild);this.root.append(tools);
    const grid=dpEl('table',null,'moum-datepicker-grid');grid.setAttribute('aria-label',`${heading.textContent} 날짜`);const head=dpEl('thead'),hr=dpEl('tr');
    const weekday=new Intl.DateTimeFormat(o.locale,{weekday:'short',timeZone:'UTC'});
    for(let i=0;i<7;i++){const th=dpEl('th',weekday.format(new Date(Date.UTC(2023,0,1+(i+o.weekStartsOn)%7))));th.scope='col';hr.append(th);}head.append(hr);grid.append(head);
    const body=dpEl('tbody'),first=dateValue(this.month),offset=(new Date(first).getUTCDay()-o.weekStartsOn+7)%7;let tabbable=false;
    for(let r=0;r<6;r++){const row=dpEl('tr');for(let c=0;c<7;c++){const cell=dpEl('td'),stamp=first+(r*7+c-offset)*dateDay;
      if(stamp>=dateValue('0001-01-01')&&stamp<=dateValue('9999-12-31')){const date=dpDate(stamp),b=button(String(new Date(stamp).getUTCDate()),()=>this.choose(date));b.dataset.date=date;b.setAttribute('aria-label',date);b.disabled=o.disabled;const unavailable=this.model.isDisabled(date);b.setAttribute('aria-disabled',String(unavailable||o.disabled));if(unavailable)b.addEventListener('click',e=>e.stopImmediatePropagation(),{capture:true});
        const selected=range?!!v&&(date===v.start||date===v.end):v===date;b.setAttribute('aria-pressed',String(selected));b.dataset.outside=String(date.slice(0,7)!==this.month.slice(0,7));b.dataset.inRange=String(range&&v?.end&&date>=v.start&&date<=v.end||false);b.tabIndex=date===this.focusDate?0:-1;if(b.tabIndex===0)tabbable=true;b.addEventListener('keydown',e=>this.key(e,date));cell.append(b);}
      row.append(cell);}body.append(row);}grid.append(body);if(!tabbable){const b=grid.querySelector('[data-date]');if(b)b.tabIndex=0;}this.root.append(grid);
    const fields=dpEl('div',null,'moum-datepicker-fields');this.inputs=[];
    for(const [i,label] of (range?['시작일','종료일']:['선택일']).entries()){const wrap=dpEl('label',label),input=dpEl('input');input.type='date';input.min=this.model.options.min;input.max=this.model.options.max;input.disabled=o.disabled;input.value=range?(i?v?.end:v?.start)||'':v||'';if(o.name)input.name=range?`${o.name}.${i?'end':'start'}`:o.name;wrap.append(input);fields.append(wrap);this.inputs.push(input);}
    fields.append(button('날짜 적용',()=>{if(range&&!this.inputs[0].value&&this.inputs[1].value)throw new Error('시작일을 입력하세요.');this.model.setValue(range?(this.inputs[0].value?{start:this.inputs[0].value,end:this.inputs[1].value||null}:null):this.inputs[0].value);const next=this.getValue();this.setValue(next);this.options.onChange?.(next);this.root.querySelector('input')?.focus();}),button('지우기',()=>{this.clear();this.root.querySelector('input')?.focus();}));this.root.append(fields);
    this.status=dpEl('p',range?(v?.end?`${v.start} ~ ${v.end}`:v?'종료일을 선택하세요.':'시작일을 선택하세요.'):(v||'날짜를 선택하세요.'),'moum-datepicker-status');this.status.setAttribute('role','status');this.root.append(this.status);
    const quick=dpEl('div',null,'moum-datepicker-toolbar'),jump=dpEl('input');jump.type='month';jump.value=this.month.slice(0,7);jump.min=this.model.options.min.slice(0,7);jump.max=this.model.options.max.slice(0,7);jump.disabled=o.disabled;jump.setAttribute('aria-label','이동할 월');
    jump.addEventListener('change',()=>this.attempt(()=>{if(!/^\d{4}-\d{2}$/.test(jump.value))throw new Error('이동할 월을 선택하세요.');const date=jump.value+'-01';dateValue(date);if(jump.value<jump.min||jump.value>jump.max)throw new RangeError('이동할 수 없는 월입니다.');this.month=date;this.focusDate=date;this.render();this.root.querySelector('[aria-label="이동할 월"]')?.focus();}));quick.append(jump,button('오늘',()=>this.choose(dpToday())));
    if(range)quick.append(button('이번 달',()=>{const today=dpToday(),start=today.slice(0,7)+'-01',d=new Date(dateValue(start));d.setUTCMonth(d.getUTCMonth()+1);const end=dpDate(d.getTime()-dateDay);this.setValue({start,end});this.close();this.options.onChange?.(this.getValue());}));
    if(this.popupInput)quick.append(button('닫기',()=>this.close()));this.root.append(quick);this.syncInput();this.positionPopup();
  }
  destroy() { if(this.destroyed)return;this.popupListeners?.forEach(remove=>remove());if(this.popupInput)for(const [name,value]of this.savedAttributes){if(value===null)this.popupInput.removeAttribute(name);else this.popupInput.setAttribute(name,value);}if(this.inputClassAdded)this.popupInput.classList.remove('moum-datepicker-input');this.inputError?.remove();this.destroyed=true;this.root.remove();this.popupHost?.remove(); }
}
