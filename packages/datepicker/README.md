# @moum/datepicker 0.2.0

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

방향키: 일/주 이동, Home/End: 주 시작/끝, Page Up/Down: 이전/다음 달. Enter/Space: 선택. 제외일도 탐색할 수 있지만 선택할 수 없습니다. 날짜 입력창과 적용 버튼도 제공합니다. `name` 지정 시 단일 입력은 name, 기간 입력은 name.start/name.end로 폼 전송됩니다. 폼 제출 전 end:null 여부와 업무상 필수 여부는 호스트에서 검사하세요. 시간 선택·다른 달력 체계는 포함하지 않습니다.

현재 npm 미게시. `npm pack ./packages/datepicker` 후 tgz를 설치하거나 dist JS/CSS와 LICENSE를 복사합니다. 브라우저 전역은 `MoumDatePicker`, CommonJS는 `{DatePicker}`. React effect/Vue unmount에서 destroy하세요. [예제](../../examples/datepicker/index.html) · [공통 테마](../../docs/components.md).

## 0.2.0 입력 필드 팝업

`DatePicker.attach(input, options)`는 text/search HTMLInputElement 또는 선택자에 연결합니다. 기존 생성자는 인라인입니다. `open()`/`close(restoreFocus=true)`로 열고 닫으며 클릭·ArrowDown으로 열기, Escape·외부 클릭·포커스 이탈로 닫기를 지원합니다. 비모달 달력이며 Tab을 가두지 않습니다. 단일 날짜/기간 완료 시 입력으로 포커스를 돌립니다. disabled 입력에서는 열리지 않습니다.

```js
const picker = DatePicker.attach('#due', {title:'납기일',mode:'single',onChange:value=>console.log(value)});
// <label>납기일 <input id="due" type="text" name="due" placeholder="YYYY-MM-DD"></label>
```

단일 값은 YYYY-MM-DD, 기간 표시/직접 입력은 YYYY-MM-DD ~ YYYY-MM-DD입니다. 기간의 부분 선택은 시작일만 표시합니다. 폼용 외부 입력 name은 호스트가 지정합니다. 잘못된 직접 입력은 모델을 변경하지 않으며 입력 옆 오류와 aria-invalid, onError로 전달하므로 폼 제출 시 getValue()와 입력 유효성을 검사하세요. 명시한 value가 없으면 기존 입력값을 단일/기간 초기값으로 검증합니다.

팝업은 body에 포털로 생성되며 화면 안에서 위치를 조정하고 내부 스크롤합니다. 테마는 body의 공통 토큰 또는 .moum-datepicker-popup에 지정하세요. z-index는 --moum-datepicker-z-index(기본1000)로 조절합니다. setDisabled(true)는 연결 입력도 읽기 전용으로 잠그고 팝업을 닫습니다. 호스트의 setValue API는 계속 사용할 수 있습니다. destroy는 이벤트·포털을 제거하고 입력의 기존 ARIA/role/readonly를 복구합니다. 월 입력으로 월/연도 이동, 오늘, 기간의 이번 달 버튼을 제공합니다. 프리셋도 min/max·제외일 검사를 거치므로 제외일이 있는 이번 달 선택은 오류를 표시합니다.
