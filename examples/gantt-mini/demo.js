const miniTasks=[
 {id:'project',name:'구매 시스템',start:'2026-11-02',end:'2026-12-04',progress:45},
 {id:'plan',parentId:'project',name:'요구사항 정리',start:'2026-11-02',end:'2026-11-06',progress:100},
 {id:'design',parentId:'project',name:'화면·데이터 설계',start:'2026-11-09',end:'2026-11-13',progress:100,dependencies:['plan']},
 {id:'build',parentId:'project',name:'발주·입고 개발',start:'2026-11-16',end:'2026-11-25',progress:35,dependencies:['design']},
 {id:'review',parentId:'project',name:'검토 승인',start:'2026-11-26',end:'2026-11-26',type:'milestone',dependencies:['build']},
 {id:'release',parentId:'project',name:'운영 시작',start:'2026-12-04',end:'2026-12-04',type:'milestone',dependencies:['review']}
];
const miniRange={start:'2026-11-01',end:'2026-12-10'};
const selected=task=>{document.querySelector('#result').textContent=JSON.stringify({id:task.id,name:task.name,start:task.start,end:task.end,progress:task.progress},null,2);};
window.miniGantt=new MoumGantt('#mini',{view:'mini',title:'구매 시스템 작업',tasks:miniTasks,range:miniRange,editable:false,onSelect:selected});
window.summaryGantt=new MoumGantt('#summary',{view:'mini',title:'구매 시스템 요약',mini:{type:'summary'},tasks:miniTasks,range:miniRange});
window.milestonesGantt=new MoumGantt('#milestones',{view:'mini',title:'검토·운영 시점',mini:{type:'milestones'},tasks:miniTasks,range:miniRange,onSelect:selected});
window.rowGantt=new MoumGantt('#row-mini',{view:'mini',title:'PO-101 발주 일정',mini:{type:'compact'},tasks:[{id:'po-101',name:'PO-101 입고',start:'2026-11-12',end:'2026-11-20',progress:60}],range:miniRange,onSelect:selected});
window.rowGantt2=new MoumGantt('#row-mini-2',{view:'mini',title:'PO-102 발주 일정',mini:{type:'compact'},tasks:[{id:'po-102',name:'PO-102 입고',start:'2026-11-22',end:'2026-12-02',progress:20}],range:miniRange,onSelect:selected});
document.querySelector('#mini-type').addEventListener('change',event=>miniGantt.setMiniType(event.target.value));
document.querySelector('#range').addEventListener('click',event=>{const clipped=event.target.getAttribute('aria-pressed')!=='true';event.target.setAttribute('aria-pressed',String(clipped));for(const chart of [miniGantt,summaryGantt,milestonesGantt,rowGantt,rowGantt2])chart.setRange(clipped?{start:'2026-11-15',end:'2026-11-30'}:miniRange);});
document.querySelector('#full').addEventListener('click',event=>{const full=event.target.getAttribute('aria-pressed')!=='true';event.target.setAttribute('aria-pressed',String(full));miniGantt.setView(full?'full':'mini');});
document.querySelector('#empty').addEventListener('click',()=>{for(const chart of [miniGantt,summaryGantt,milestonesGantt])chart.setTasks([]);});
document.querySelector('#reset').addEventListener('click',()=>{for(const chart of [miniGantt,summaryGantt,milestonesGantt])chart.setTasks(miniTasks);for(const chart of [miniGantt,summaryGantt,milestonesGantt,rowGantt,rowGantt2])chart.setRange(miniRange);miniGantt.setView('mini');miniGantt.setMiniType('bars');document.querySelector('#mini-type').value='bars';for(const id of ['range','full'])document.querySelector(`#${id}`).setAttribute('aria-pressed','false');});
