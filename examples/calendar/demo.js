const initialEvents = [
  { id: 'review', title: '구매 시스템 설계 검토', start: '2026-11-16T09:00', end: '2026-11-16T10:30', description: '발주·입고 처리 흐름 확인' },
  { id: 'sync', title: '개발 진행 공유', start: '2026-11-16T10:00', end: '2026-11-16T11:00', recurrence: { frequency: 'weekly', until: '2026-12-28' } },
  { id: 'training', title: '담당자 교육', start: '2026-11-18', end: '2026-11-20', allDay: true },
  { id: 'acceptance', title: '사용자 검증', start: '2026-11-26T14:00', end: '2026-11-26T16:00' },
  { id: 'release', title: '운영 시작', start: '2026-12-04', end: '2026-12-05', allDay: true }
];
window.calendar = new MoumCalendar('#calendar', { date: '2026-11-16', weekStartsOn: 1, events: initialEvents, onChange: detail => { document.querySelector('#result').textContent = JSON.stringify({ type: detail.type, id: detail.id, count: detail.events.length }, null, 2); } });
document.querySelector('#empty').addEventListener('click', () => calendar.setEvents([]));
document.querySelector('#reset').addEventListener('click', () => calendar.setEvents(initialEvents));
document.querySelector('#export').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([JSON.stringify(calendar.getEvents(), null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'moum-events.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
