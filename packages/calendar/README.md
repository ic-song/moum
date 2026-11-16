# @moum/calendar 0.1.0

월·주·일·목록, 종일/시간 일정, 반복과 편집을 제공하는 MIT 독립 캘린더. 런타임 의존성 없음.

```html
<link rel="stylesheet" href="./moum-calendar.css">
<div id="calendar"></div>
<script src="./moum-calendar.js"></script>
<script>
const calendar = new MoumCalendar('#calendar', {
  date:'2026-11-16',view:'month',weekStartsOn:1,
  events:[{id:'meeting',title:'설계 검토',start:'2026-11-16T09:00',end:'2026-11-16T10:30'}],
  onChange: change => console.log(change.events)
});
</script>
```

JS/CSS/LICENSE 복사 또는 `npm pack ./packages/calendar`로 tgz 설치. npm 등록 전입니다. ESM: `import Calendar from '@moum/calendar'`, CSS: `@moum/calendar/style.css`, CommonJS: `const {Calendar}=require('@moum/calendar')`. 빈 컨테이너에 생성하고 제거 시 destroy하세요.

## 날짜·반복 계약

- **종료일/시간은 포함하지 않습니다.** 16일 하루 종일은 `{start:'2026-11-16',end:'2026-11-17',allDay:true}`. 간트의 종료일 포함 정책과 다릅니다.
- 시간 일정은 YYYY-MM-DDTHH:mm, 종일은 YYYY-MM-DD입니다. **시간대 없는 현지 벽시계 시간**을 쓰며 Z/UTC 오프셋은 거절합니다. 지역 간 변환과 DST 해석은 호스트에서 수행하세요.
- id는 고유한 문자열/숫자입니다. title/description은 일반 텍스트입니다.
- `recurrence:{frequency:'daily'|'weekly',interval:1,until:'2026-12-31'}`. until은 필수이며 마지막 발생 시작일을 포함합니다. `exceptions:['2026-11-23']`로 발생 시작일을 제외합니다.
- 편집기는 반복 **전체 시리즈**를 변경/삭제하고 반복 일정 드래그는 끕니다. 개별 발생 수정은 호스트에서 exceptions 추가와 별도 일정 생성으로 처리하세요. 월간/RRULE/다중 요일 반복은 지원하지 않습니다.

## API

`getEvents()`, `setEvents(events)`, `getOccurrences({start,end})`, `addEvent(event)`, `updateEvent(id,patch)`, `removeEvent(id)`, `setView('month'|'week'|'day'|'agenda')`, `setDate(date)`, `undo()`, `redo()`, `destroy()`.

getEvents는 원본 시리즈 복사본, getOccurrences는 조회 기간 발생 목록이며 조회 종료일도 포함하지 않습니다. 변경은 원자적으로 검증합니다. setEvents는 이력을 초기화하며 다른 편집은 최근 50건 되돌리기를 지원합니다.

`onChange({type,id,events})`, `onSelect(occurrence)`, `onViewChange({view,date})`, `onError(error)`. 저장/실패/충돌 처리는 호스트가 연결합니다. editable:false는 UI만 읽기 전용입니다. 입력 편집기는 드래그의 키보드 대안이며 주/일 보기에서 시간이 겹치면 열을 나눕니다.

최대 원본 10,000개·일정 기간 366일·반복 10년·조회 370일/발생 20,000개. 성능 보증 한도가 아니므로 밀집 데이터는 호스트가 기간별로 조회하세요. 자원 예약·ICS·시간대 변환·자동 서버 연동은 포함하지 않습니다. CSS: `.moum-calendar`, `--moum-calendar-ink/line/action/paper`. [오프라인 예제](../../examples/calendar/index.html).
