const initialTasks = [
  { id: 'project', name: '구매 시스템 구축', start: '2026-11-02', end: '2026-12-04', progress: 45 },
  { id: 'plan', parentId: 'project', name: '요구사항 정리', start: '2026-11-02', end: '2026-11-06', progress: 100 },
  { id: 'design', parentId: 'project', name: '화면·데이터 설계', start: '2026-11-09', end: '2026-11-13', progress: 100, dependencies: ['plan'] },
  { id: 'build', parentId: 'project', name: '발주·입고 기능 개발', start: '2026-11-16', end: '2026-11-25', baseline: { start: '2026-11-16', end: '2026-11-23' }, deadline: '2026-11-24', progress: 35, dependencies: ['design'] },
  { id: 'test', parentId: 'project', name: '사용자 검증', start: '2026-11-26', end: '2026-12-03', progress: 0, dependencies: ['build'] },
  { id: 'release', parentId: 'project', name: '운영 시작', start: '2026-12-04', end: '2026-12-04', type: 'milestone', dependencies: ['test'] }
];
window.gantt = new MoumGantt('#gantt', {
  tasks: initialTasks,
  workCalendar: { weekendDays: [0, 6], holidays: ['2026-11-18'] },
  onSelect: task => {
    const asOf = '2026-11-25';
    const schedule = gantt.getScheduleStatus({ asOf }).find(item => item.id === task.id);
    document.querySelector('#result').textContent = JSON.stringify({ task, asOf, schedule }, null, 2);
  },
  onChange: detail => { document.querySelector('#result').textContent = JSON.stringify({ type: detail.type, id: detail.id, warnings: detail.warnings }, null, 2); }
});
let nextTask = 0;
document.querySelector('#add').addEventListener('click', () => gantt.addTask({ id: `followup-${++nextTask}`, name: '운영 후속 점검', start: '2026-12-07', end: '2026-12-09', dependencies: gantt.getTasks().some(t => t.id === 'release') ? ['release'] : [] }));
document.querySelector('#empty').addEventListener('click', () => gantt.setTasks([]));
document.querySelector('#reset').addEventListener('click', () => gantt.setTasks(initialTasks));
document.querySelector('#export').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([JSON.stringify(gantt.getTasks(), null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'moum-tasks.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });

document.querySelector('#mini-view').addEventListener('click',event=>{const mini=event.target.getAttribute('aria-pressed')!=='true';gantt.setView(mini?'mini':'full');document.querySelector('#gantt + .demo-help').hidden=mini;event.target.setAttribute('aria-pressed',String(mini));event.target.textContent=mini?'전체 보기':'미니 보기';});
