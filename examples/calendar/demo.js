const initialEvents = [
  { id: 'review', title: '구매 시스템 설계 검토', start: '2026-11-16T09:00', end: '2026-11-16T10:30', description: '발주·입고 처리 흐름 확인' },
  { id: 'sync', title: '개발 진행 공유', start: '2026-11-16T10:00', end: '2026-11-16T11:00', recurrence: { frequency: 'weekly', until: '2026-12-28' } },
  { id: 'training', title: '담당자 교육', start: '2026-11-18', end: '2026-11-20', allDay: true },
  { id: 'acceptance', title: '사용자 검증', start: '2026-11-26T14:00', end: '2026-11-26T16:00' },
  { id: 'release', title: '운영 시작', start: '2026-12-04', end: '2026-12-05', allDay: true }
].map((event,i)=>({...event,resourceId:i%2?'room-b':'room-a'}));
window.calendar = new MoumCalendar('#calendar', { date: '2026-11-16', weekStartsOn: 1, resources:[{id:'room-a',title:'회의실 A'},{id:'room-b',title:'회의실 B'}], events: initialEvents, onChange: detail => { document.querySelector('#result').textContent = JSON.stringify({ type: detail.type, id: detail.id, count: detail.events.length }, null, 2); } });
document.querySelector('#empty').addEventListener('click', () => calendar.setEvents([]));
document.querySelector('#reset').addEventListener('click', () => calendar.setEvents(initialEvents));
document.querySelector('#export').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([JSON.stringify(calendar.getEvents(), null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'moum-events.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });

let remoteMode=false,failCalendar=false;
document.querySelector('#remote').addEventListener('click',event=>{
 const options={...calendar.options};calendar.destroy();remoteMode=!remoteMode;
 if(remoteMode)options.load=async({start,end,signal})=>{await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,window.slowLoad?10000:350);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('취소됨','AbortError'));},{once:true});});if(failCalendar){failCalendar=false;document.querySelector('#fail-load').setAttribute('aria-pressed','false');throw new Error('예제 조회 실패입니다. 다시 조회하세요.');}const ids=new Set(new MoumCalendar.CalendarModel(initialEvents).getOccurrences({start,end}).map(e=>e.seriesId));return structuredClone(initialEvents.filter(e=>ids.has(e.id)));};
 else delete options.load;
 options.events=initialEvents;window.calendar=new MoumCalendar('#calendar',options);event.target.setAttribute('aria-pressed',String(remoteMode));document.querySelector('#load-mode').textContent=remoteMode?'기간별 조회 예제 모드 · 로컬 데이터에 지연/실패를 재현하며 실서비스 서버는 연결하지 않았습니다.':'로컬 편집 모드 · 회차 수정은 원래 반복 날짜를 유지합니다.';
});
document.querySelector('#fail-load').addEventListener('click',event=>{failCalendar=!failCalendar;event.target.setAttribute('aria-pressed',String(failCalendar));});

window.slowLoad=false;document.querySelector('#slow-load').addEventListener('click',event=>{window.slowLoad=!window.slowLoad;event.target.setAttribute('aria-pressed',String(window.slowLoad));});
