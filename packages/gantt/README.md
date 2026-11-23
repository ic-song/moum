# @moum/gantt 0.6.0

개인 계획, 학습·행사 준비, 제작, 프로젝트 일정에 사용할 수 있는 MIT 간트 라이브러리입니다. 작업 계층·선후관계·일정 편집을 제공하며 외부 런타임 의존성이 없습니다.

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

dependencies는 선행 ID 또는 관계 객체 배열, parentId는 표시 계층입니다. 누락·순환 관계는 거절하며, 날짜 충돌은 `getWarnings()`와 화면에 표시합니다. 부모 기간과 진행률은 별도로 입력합니다.

## API와 편집

`getTasks()`, `setTasks(tasks)`, `addTask(task)`, `updateTask(id,patch)`, `removeTask(id)`, `getWarnings()`, `setScale('day'|'week'|'month')`, `selectTask(id)`, `undo()`, `redo()`, `destroy()`.

변경은 원자적으로 검증하며 오류 시 기존 값을 유지합니다. 부모 삭제는 자식부터, 작업 삭제는 해당 선행 참조도 정리합니다. getTasks는 복사본이고 setTasks는 이력을 초기화합니다. 편집 이력 최근 50건을 보관합니다.

막대 드래그: 기간 유지 이동. 오른쪽 핸들: 종료일 변경. ←/→: 하루 이동. Alt+←/→: 종료일 변경. 선택 후 날짜/진행률 입력창으로도 편집합니다. editable:false는 UI만 읽기 전용이며 호스트 API 갱신은 허용합니다.

`onChange({type,id,tasks,warnings})`, `onSelect(task)`, `onError(error)`. 서버 저장은 호스트가 연결합니다. onChange는 저장 성공이 아니므로 실패/충돌/재조회 정책을 별도 구현하세요.

최대 작업 3,000개, 전체 기간 10년입니다. 행 가상화·자원 배정·임계 경로·상시 자동 일정 계산은 후속 범위입니다. CSS는 `.moum-gantt`와 `--moum-gantt-ink/line/action/paper`를 사용합니다. [오프라인 예제](../../examples/gantt/index.html)

## 적용 사례 · 분할 납품과 입고 수량

`summarizeDeliveries()`는 브라우저 화면 없이 발주 품목 한 건의 납품 회차와 실제 입고 내역을 집계합니다. 브라우저 전역에서는 `MoumGantt.summarizeDeliveries`, ESM과 CommonJS에서는 이름으로 가져옵니다.

```js
const { lines, totals } = summarizeDeliveries(
  [{ id: 'first', dueDate: '2026-11-20', quantity: 60 },
   { id: 'second', dueDate: '2026-11-27', quantity: 40 }],
  [{ id: 'dock-101', lineId: 'first', date: '2026-11-20', quantity: 30 },
   { id: 'dock-102', lineId: 'first', date: '2026-11-23', quantity: 15 }],
  { asOf: '2026-11-23', precision: 0 }
);
// 첫 회차는 45개 입고, 15개 납기 초과. 전체 미입고는 55개입니다.
```

회차별·전체 `planned`(예정), `received`(입고), `open`(미입고), `excess`(초과 입고), `overdue`(납기 초과 미입고) 수량을 반환합니다. 입고는 지정한 회차에만 배정됩니다. 기준일에 발생한 입고까지 반영하고 납기 다음 날부터 초과를 계산합니다. 기준일이 없으면 전체 입고를 집계하며 납기 초과는 0입니다. 같은 품목·수량 단위끼리 집계하고, 취소·반품 내역은 호스트에서 유효한 입고 내역으로 정리해 전달하세요. 양수 수량, 중복되지 않은 ID, 소수 정밀도 0~6(기본 3)을 검증합니다.

## 선후행 관계와 대기일

기존 `dependencies: ['order']`는 FS 대기 0일입니다. `dependencies: [{ taskId: 'design', type: 'SS', lagDays: 2 }]`로 관계와 대기일을 설정할 수 있습니다.

| 관계 | 후속 작업의 최소 날짜 |
| --- | --- |
| FS | 선행 종료 다음 날 + 대기일에 시작 |
| SS | 선행 시작일 + 대기일에 시작 |
| FF | 선행 종료일 + 대기일에 종료 |
| SF | 선행 시작일 + 대기일에 종료 |

`lagDays`는 0~3650일의 정수입니다. 업무일 달력에서는 FS의 다음 날과 양수 대기일을 업무일로 계산합니다. SS·FF·SF의 대기 0일은 선행 기준일을 사용하고 실제 조정은 가능한 첫 업무일에 맞춥니다. 여러 관계를 만족하도록 작업을 필요할 때만 뒤로 옮기며 원래 기간을 유지합니다. 명시적으로 `scheduleDependencies()`를 호출하면 전체 조정이 한 번의 실행 취소로 기록됩니다. 기준 일정과 납기는 유지됩니다.

## 기준 일정과 납기 초과 조회

PMS에서 승인한 계획이나 SRM에서 합의한 납품 일정을 작업별 `baseline: { start, end }`으로 보관할 수 있습니다. 현재 일정 전체를 새 기준으로 잡으려면 `captureBaseline()`을 호출하세요. 달라진 기준이 있으면 한 번의 변경으로 기록되고 `undo()`로 복원됩니다.

```js
gantt.updateTask('receipt', { deadline: '2026-12-04' });
const report = gantt.getScheduleStatus({ asOf: '2026-12-07' });
const openLate = report.filter(task => task.overdue);
```

조회 결과에는 작업 ID, 기준 대비 시작·종료 편차, 납기 대비 계획 종료일 편차, `overdue`가 포함됩니다. 편차는 달력 일수이며 양수는 늦음, 음수는 빠름입니다. 기준 또는 납기 입력이 없으면 해당 편차는 `null`입니다. `overdue`는 조회 기준일이 납기를 지나고 진행률이 100% 미만일 때만 참입니다. `asOf`를 생략하면 편차만 계산합니다. 일정 이동과 선행 일정 맞추기는 기존 기준·납기를 보존하고, 납기는 일정 조정의 제약으로 쓰이지 않습니다.

기준과 납기는 `getTasks()` 및 `onChange`의 작업 데이터에 포함됩니다. `updateTask(id, { baseline: null, deadline: null })`로 제거할 수 있습니다. 작업의 완료 진행률에는 호스트의 실제 입고·검수 또는 완료 상태를 연결하세요. 결과를 기존 그리드나 대시보드에서 사용할 수 있습니다.

## 업무 화면별 보기 저장과 복원

`getViewState()`는 일·주·월 단위, 전체/미니 보기, 미니 유형과 표시 옵션, 지정 기간, 접힌 상위 작업 ID를 JSON으로 보관할 수 있게 반환합니다.

```js
const savedView = JSON.stringify(gantt.getViewState());
// 다음에 화면을 열면 같은 프로젝트의 최신 작업을 먼저 넣습니다.
gantt.setViewState(JSON.parse(savedView));
```

새 작업 목록에서는 현재 하위 작업이 있는 ID의 접힘 상태만 복원합니다. `range: null`은 자동 기간을 뜻합니다. 복원 시 일정·업무일 달력·실행 취소 이력은 유지됩니다. 선택한 작업과 스크롤 위치는 화면이 관리합니다. 저장 위치는 사용하는 앱에서 정하며, 잘못된 저장본은 예외로 처리합니다.

## 0.2.0 선행 일정 맞추기

`scheduleDependencies()` 또는 툴바의 선행 일정 맞추기로 작업을 위상 순서로 계산합니다. FS의 기존 사용 방식과 자동 조정 규칙은 위의 선후행 관계 표를 참고하세요.

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

## 0.3.0 업무일 달력

`new Gantt(target,{tasks,workCalendar:{weekendDays:[0,6],holidays:['2026-11-18']}})`로 켭니다. workCalendar를 생략하면 기존 달력일 방식입니다. 빈 객체는 토·일 휴무, weekendDays:[]는 매일 업무일입니다. 요일은 일요일0~토요일6, 최소 하루는 업무일이어야 합니다. 휴일은 프로젝트가 지정한 YYYY-MM-DD 목록(최대10,000개)이며 국가 공휴일을 자동 조회하지 않습니다.

입력·직접 편집·드래그는 날짜를 그대로 보존합니다. **선행 일정 맞추기/scheduleDependencies()를 명시적으로 실행할 때만** 기존 업무일 수(종료일 포함)를 유지하면서 작업을 업무일에 맞춥니다. 업무일이 하나도 없는 작업은 1일로 계산하며, 마일스톤은 같은 날입니다. 부모 기간은 독립 작업으로 처리합니다. 전체 조정은 단일 undo로 기록되며 범위·관계 오류가 있으면 이전 일정을 보존합니다.

전체·미니 4종에서 주말과 휴일을 음영으로 표시합니다. 기본 날짜 눈금과 미니 가중 진행률은 달력 기간을 기준으로 합니다. `--moum-gantt-offday`로 음영 색을 설정하세요. `ganttWorkingDays(start,end,calendar)`, `isGanttWorkday(date,calendar)`와 `new GanttModel(tasks,{workCalendar})`도 독립 사용합니다.
