# @moum/gantt 0.2.0

작업 계층·선후관계·일정 편집을 제공하는 MIT 독립 간트 라이브러리. 외부 런타임 의존성이 없습니다.

```html
<link rel="stylesheet" href="./moum-gantt.css">
<div id="gantt"></div>
<script src="./moum-gantt.js"></script>
<script>
const gantt = new MoumGantt('#gantt', {scale:'day',tasks:[
  {id:'plan',name:'설계',start:'2026-11-16',end:'2026-11-18',progress:50},
  {id:'build',name:'개발',start:'2026-11-19',end:'2026-11-25',dependencies:['plan']}
],onChange: change => console.log(change.tasks,change.warnings)});
</script>
```

JS/CSS/LICENSE 복사 또는 `npm pack ./packages/gantt`로 tgz 설치. npm 등록 전입니다. ESM: `import Gantt from '@moum/gantt'`, CSS: `@moum/gantt/style.css`, CommonJS: `const {Gantt}=require('@moum/gantt')`. 비어 있는 요소에 생성하고 제거 시 destroy하세요.

## 작업 계약

`{id,name,start,end,progress?,dependencies?,parentId?,type?}`. id는 고유한 문자열/숫자(내부 문자열), 날짜는 엄격한 YYYY-MM-DD이며 **종료일 포함**입니다. 계산은 UTC 일 단위입니다. progress는 0~100, type은 task/milestone이며 마일스톤은 시작=종료입니다.

dependencies는 선행 id 배열, parentId는 표시 계층입니다. 누락/순환 관계를 거절합니다. 부모 날짜/진행률은 별도 값이며 자동 집계하지 않습니다. 연결은 finish-to-start이며 날짜 충돌은 `getWarnings()`와 화면에 알립니다. 일반 편집은 다른 작업 날짜를 자동 변경하거나 강제 차단하지 않습니다.

## API와 편집

`getTasks()`, `setTasks(tasks)`, `addTask(task)`, `updateTask(id,patch)`, `removeTask(id)`, `getWarnings()`, `setScale('day'|'week'|'month')`, `selectTask(id)`, `undo()`, `redo()`, `destroy()`.

변경은 원자적으로 검증하며 오류 시 기존 값을 유지합니다. 부모 삭제는 자식부터, 작업 삭제는 해당 선행 참조도 정리합니다. getTasks는 복사본이고 setTasks는 이력을 초기화합니다. 편집 이력 최근 50건을 보관합니다.

막대 드래그: 기간 유지 이동. 오른쪽 핸들: 종료일 변경. ←/→: 하루 이동. Alt+←/→: 종료일 변경. 선택 후 날짜/진행률 입력창으로도 편집합니다. editable:false는 UI만 읽기 전용이며 호스트 API 갱신은 허용합니다.

`onChange({type,id,tasks,warnings})`, `onSelect(task)`, `onError(error)`. 서버 저장은 호스트가 연결합니다. onChange는 저장 성공이 아니므로 실패/충돌/재조회 정책을 별도 구현하세요.

최대 작업 3,000·전체 기간 10년. 행 가상화·자원 배정·업무일 달력·임계 경로·상시 자동 일정 계산·SS/FF/SF 연결은 포함하지 않습니다. CSS: `.moum-gantt`, `--moum-gantt-ink/line/action/paper`. [오프라인 예제](../../examples/gantt/index.html).

## 0.2.0 선행 일정 맞추기

`scheduleDependencies()` 또는 툴바의 선행 일정 맞추기로 FS 연결을 위상 순서로 계산합니다. 각 작업은 현재 시작일과 모든 선행 작업 종료 다음 날 중 가장 늦은 날에 시작하며 원래 일수와 마일스톤을 보존합니다. 작업을 앞당기지 않고 주말·공휴일도 달력 일수로 계산합니다. 부모 범위는 자동 집계하지 않습니다. 전체 결과는 원자적으로 검증하고 변경 전체를 한 번에 undo합니다. 자동 실행되지 않으며 사용자가 명시적으로 실행할 때만 다른 작업 일정이 이동합니다.

## 미니 간트 4종

같은 패키지·데이터·API로 사용합니다. 별도 미니 라이브러리를 설치하지 않습니다.

```js
const mini = new Gantt('#mini', {
  view: 'mini', title: '발주 일정', mini: {type: 'compact'},
  range: {start: '2026-11-01', end: '2026-12-10'},
  tasks: [{id:'po-101', name:'입고', start:'2026-11-12', end:'2026-11-20', progress:60}],
  onSelect: task => console.log(task)
});
mini.setMiniType('summary'); // 데이터·이력 보존
mini.setRange(null);         // 전체 작업 기간으로 자동 맞춤
mini.setView('full');        // 전체 간트로 전환
```

| mini.type | 용도 |
| --- | --- |
| bars (기본) | 작업별 행의 기간·진행률·마일스톤 |
| compact | 표 셀·카드용 축소형. 기본 헤더·이름·상태 숨김, 24px 트랙 |
| summary | 전체 기간과 말단 작업의 기간 가중 진행률을 한 줄로 요약 |
| milestones | type:milestone인 작업만 표시. 다른 작업 데이터는 보존 |

`view:'mini'`는 조회·선택 전용이며 날짜 드래그·편집 폼·연결선·일별 눈금을 생략합니다. editable:true여도 미니 화면에서는 편집하지 않습니다. 호스트의 updateTask/undo 등 API는 그대로 동작하며 full로 전환하면 기존 editable 옵션이 적용됩니다. mini.header/labels/status boolean으로 기본 표시를 덮어쓸 수 있습니다. 행 전체 트랙이 선택 대상이므로 좁은 막대도 키보드·터치로 선택할 수 있고 Enter/Space 선택 후 포커스를 유지합니다.

range의 종료일은 포함입니다. 지정한 범위를 벗어난 기간은 잘라 표시하며 완전히 벗어난 작업은 비활성 ‘범위 밖’ 행으로 남습니다. 범위 변경은 데이터·이력을 바꾸지 않습니다. 최대10년, getRange()는 복사본 또는 데이터가 없으면 null입니다. full 화면에서는 range를 적용하지 않으며 미니 보기로 돌아오면 지정 범위를 다시 사용합니다. 미니는 전체 보기의 계층 접힘 상태에 영향받지 않고 원본 순서대로 표시합니다.

getSummary()/ganttSummary(tasks)는 {start,end,progress,taskCount,milestoneCount} 또는 null을 반환합니다. 부모를 제외한 말단 일반 작업의 **종료일 포함 기간**으로 진행률을 가중 평균합니다. 일반 작업이 없으면 말단 마일스톤의 단순 평균을 사용합니다. 전체 기간에는 명시한 부모 기간도 포함합니다. 작업량/비용 가중치나 일정상의 실제 완료일을 의미하지 않습니다. compact는 한두 작업, bars는 작은 작업 목록에 적합하며 행 가상화는 제공하지 않습니다. [실행 예제](../../examples/gantt-mini/index.html).
