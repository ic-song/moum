# @moum/calendar 0.4.0

월·주·일·목록, 종일/시간 일정, 반복과 편집을 제공하는 MIT 독립 캘린더. 런타임 의존성 없음.

## 보기 저장과 복원

개인 일정, 수업 시간표, 모임·시설 예약에 같은 API를 사용합니다. `getViewState()`는 기준 날짜, 월·주·일·목록 보기, 주 시작 요일, 현재 자원 필터를 JSON에 저장할 수 있게 반환합니다.

```js
const savedView = JSON.stringify(calendar.getViewState());
// 같은 자원 목록으로 캘린더를 만든 뒤 적용합니다.
calendar.setViewState(JSON.parse(savedView));
```

`weekStartsOn`은 일요일 0부터 토요일 6까지, 전체 자원은 `resourceId: null`입니다. 여러 설정을 함께 복원하면 범위 조회는 한 번만 요청하며 이미 진행 중인 조회는 취소합니다. 같은 상태를 다시 적용하면 추가 요청이 없습니다. 잘못된 날짜나 자원이 들어간 저장본은 예외로 처리합니다. 로컬 모드는 일정과 실행 취소 이력을 보존합니다. 서버 모드는 기존 조회 정책에 따라 성공한 응답으로 일정 목록을 교체합니다.

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

최대 원본 10,000개·일정 기간 366일·반복 10년·조회 370일/발생 20,000개. 성능 보증 한도가 아니므로 밀집 데이터는 호스트가 기간별로 조회하세요. 자원별 동시 예약 제한·ICS·시간대 변환은 포함하지 않습니다. CSS: `.moum-calendar`, `--moum-calendar-ink/line/action/paper`. [오프라인 예제](../../examples/calendar/index.html).

## 0.2.0 반복 회차 제외·복원

`setOccurrenceExcluded(id, '2026-11-23', true)`는 해당 날짜에 시작하는 반복 회차만 제외합니다. false로 복원합니다. 실제 반복 시작일인지 검증하며 원본 반복 시리즈의 시간·제목·다른 회차는 유지합니다. 변경은 undo/redo 대상입니다. 반복 일정 클릭 시 편집기에 해당 회차만 제외 버튼이 나타나며 전체 수정·전체 삭제와 구별됩니다. 복원은 API 또는 undo로 수행합니다.

## 0.3.0 한 회차 수정과 자원

반복 일정을 선택하면 수정 범위에서 전체/이번 회차만을 고를 수 있습니다. `updateOccurrence(id,originalDate,patch)`로도 title/start/end/allDay/description/resourceId를 변경합니다. originalDate는 **변경 전 반복 시작 날짜**입니다. 옮긴 회차가 원래 조회 기간 밖으로 이동해도 새 조회 기간에서 나오며 occurrenceId와 originalDate는 유지합니다. `restoreOccurrence(id,originalDate)`/편집기의 ‘이 회차 원래대로’는 분리 수정과 제외를 함께 원복합니다. 제외만 다시 표시할 때는 기존 setOccurrenceExcluded(...,false)를 쓰면 분리 수정 내용이 유지됩니다. 모두 단일 undo/redo입니다.

원본 이벤트의 `overrides:{'2026-11-23':{title:'변경',start:'2026-11-24T13:00',end:'2026-11-24T14:00'}}`를 저장·재조회하면 수정 회차를 보존합니다(시리즈당 최대1,000회). 실제 반복 날짜만 허용하며 제외가 우선입니다. 시리즈 시작/종료 규칙을 바꿔 기존 override가 유효하지 않으면 전체 변경을 거절합니다. 규칙을 바꾸기 전에 해당 회차를 원복하거나 overrides:{}를 명시하세요. 회차 종일/시간 유형을 바꾸면 그 유형에 맞는 start/end를 함께 전달합니다. 리소스를 해제하려면 resourceId:null입니다.

`resources:[{id:'room-a',title:'회의실 A'},{id:'room-b',title:'회의실 B'}]`와 이벤트 resourceId로 모든 보기에서 자원 이름과 필터·편집기를 사용합니다. 자원은 최대200개이며 id는 고유합니다. `setResource(id|null)`/`getResource()`, onResourceChange(id)를 제공합니다. null은 전체 자원입니다. getOccurrences()는 필터 전 발생 목록을 반환합니다. 전용 자원 열/예약 충돌 방지는 제공하지 않으므로 서버가 검증하세요.

## 기간별 서버 조회

```js
const calendar=new Calendar('#calendar',{
 date:'2026-11-16',resources:[{id:'room-a',title:'회의실 A'}],
 load:async ({start,end,view,resourceId,signal})=>{
  const query=new URLSearchParams({start,end,view});if(resourceId)query.set('resource',resourceId);
  const response=await fetch('/api/events?'+query,{signal});
  if(!response.ok)throw new Error('일정을 조회하지 못했습니다.');
  return response.json(); // CalendarEvent[]: 반복 원본과 exceptions/overrides 포함
 },onChange:({events})=>saveEvents(events)
});
```

load는 선택 사항이며 설정하면 생성/날짜·보기·자원 변경 때 조회합니다. 범위 종료일은 제외이고 월간은 화면42일 전체를 요청합니다. 서버는 기간에 걸치는 일정과 이동된 회차가 포함된 **시리즈 원본**을 반환해야 합니다. 발생 회차를 같은 id의 개별 레코드로 중복 반환하지 마세요. 읽기와 저장은 분리되며 서버 인증·저장/충돌 처리는 호스트가 맡습니다.

reload()는 성공 true/실패·취소 false Promise, cancelLoad()는 중단, getLoadState()는 loading/error/마지막 성공 range입니다. requestTimeout은 기본30초, 최대600초입니다. 늦은 응답은 무시하고 오류 시 기존 이벤트를 유지합니다. 조회 완료 시 이벤트/undo 이력을 교체하므로 저장 전 reload 정책은 호스트에서 결정하세요. 로컬 편집/원복/setEvents/destroy는 진행 중 읽기를 중단해 편집값을 보호합니다. onLoad({events,range,resourceId})는 성공 조회 알림입니다. 예제의 기간별 조회 모드는 로컬 지연·실패 재현이며 실서비스 서버 검증을 뜻하지 않습니다.
