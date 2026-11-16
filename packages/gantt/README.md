# @moum/gantt 0.1.0

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

dependencies는 선행 id 배열, parentId는 표시 계층입니다. 누락/순환 관계를 거절합니다. 부모 날짜/진행률은 별도 값이며 자동 집계하지 않습니다. 연결은 finish-to-start이며 날짜 충돌은 `getWarnings()`와 화면에 알립니다. 다른 작업 날짜를 자동 변경하거나 편집을 강제 차단하지 않습니다.

## API와 편집

`getTasks()`, `setTasks(tasks)`, `addTask(task)`, `updateTask(id,patch)`, `removeTask(id)`, `getWarnings()`, `setScale('day'|'week'|'month')`, `selectTask(id)`, `undo()`, `redo()`, `destroy()`.

변경은 원자적으로 검증하며 오류 시 기존 값을 유지합니다. 부모 삭제는 자식부터, 작업 삭제는 해당 선행 참조도 정리합니다. getTasks는 복사본이고 setTasks는 이력을 초기화합니다. 편집 이력 최근 50건을 보관합니다.

막대 드래그: 기간 유지 이동. 오른쪽 핸들: 종료일 변경. ←/→: 하루 이동. Alt+←/→: 종료일 변경. 선택 후 날짜/진행률 입력창으로도 편집합니다. editable:false는 UI만 읽기 전용이며 호스트 API 갱신은 허용합니다.

`onChange({type,id,tasks,warnings})`, `onSelect(task)`, `onError(error)`. 서버 저장은 호스트가 연결합니다. onChange는 저장 성공이 아니므로 실패/충돌/재조회 정책을 별도 구현하세요.

최대 작업 3,000·전체 기간 10년. 행 가상화·자원 배정·업무일 달력·임계 경로·자동 일정 계산·SS/FF/SF 연결은 포함하지 않습니다. CSS: `.moum-gantt`, `--moum-gantt-ink/line/action/paper`. [오프라인 예제](../../examples/gantt/index.html).
