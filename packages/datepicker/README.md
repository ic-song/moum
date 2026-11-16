# @moum/datepicker 0.1.0

**MoumDatePicker** — 단일 날짜·기간 선택 UI 컴포넌트. 기존 Calendar는 일정 관리, DatePicker는 폼의 날짜 입력을 담당합니다. 외부 런타임 의존성 없음, MIT.

```js
import DatePicker from '@moum/datepicker';
import '@moum/datepicker/style.css';
const picker = new DatePicker('#period', {
  title: '조회 기간', mode: 'range', min: '2026-01-01', max: '2027-12-31',
  disabledWeekdays: [0, 6], name: 'period', onChange: value => console.log(value)
});
// 제거 시 picker.destroy()
```

비어 있는 요소에 생성합니다. `mode`: single(기본) 또는 range. 값은 `YYYY-MM-DD` 또는 `{start, end: string|null}` 또는 null입니다. 종료일 포함, 달력 날짜이며 시간대 변환을 하지 않습니다. `value`는 초기 값, `date`는 최초 표시 달입니다. `min/max`, `disabledWeekdays`, `isDateDisabled(date)`로 선택을 제한합니다. 기간 내부의 제외일도 검사하며 최대 3,660일입니다. 부분 선택은 end:null입니다. 반환 값은 복사본이며 잘못된 API 입력은 예외를 던지고 기존 선택을 보존합니다.

`getValue()`, `setValue(value)`(이벤트 없음), `clear()`(onChange), `setDisabled(boolean)`, `destroy()`(반복 호출 가능). UI 변경은 onChange, UI 검증 오류는 onError와 상태 영역으로 전달합니다. disabled는 UI만 잠그며 호스트 API 갱신은 허용합니다.

방향키: 일/주 이동, Home/End: 주 시작/끝, Page Up/Down: 이전/다음 달. Enter/Space: 선택. 제외일도 탐색할 수 있지만 선택할 수 없습니다. 날짜 입력창과 적용 버튼도 제공합니다. `name` 지정 시 단일 입력은 name, 기간 입력은 name.start/name.end로 폼 전송됩니다. 폼 제출 전 end:null 여부와 업무상 필수 여부는 호스트에서 검사하세요. 팝업·시간 선택·다른 달력 체계는 포함하지 않습니다.

현재 npm 미게시. `npm pack ./packages/datepicker` 후 tgz를 설치하거나 dist JS/CSS와 LICENSE를 복사합니다. 브라우저 전역은 `MoumDatePicker`, CommonJS는 `{DatePicker}`. React effect/Vue unmount에서 destroy하세요. [예제](../../examples/datepicker/index.html) · [공통 테마](../../docs/components.md).
