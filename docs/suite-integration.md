# 모음 독립 패키지 연결

각 모듈은 그리드 없이도 실행합니다. 파일 복사는 dist의 JS/CSS와 LICENSE, ESM은 패키지 기본 import와 `style.css`를 사용합니다. 공개 npm 등록 전이므로 저장소에서 `npm pack ./packages/<이름>`으로 만든 tgz를 설치하세요. 아래 API와 서버 경계는 각 패키지 README가 기준입니다.

## 업로더 → 그리드

```js
const ids = await uploader.addFiles(input.files);
const id = ids[0];
if (id && uploader.getErrors(id).length === 0) {
  grid.setData(uploader.getData(id));
}
```

업로더 schema의 field와 그리드 columns의 field를 맞춥니다. `getData`는 변환된 레코드 복사본입니다. 업로더에서 수정한 셀은 전송 JSON에 포함되고 원본 파일은 그대로입니다. 그리드에 전달한 뒤 그리드에서 수정한 값은 업로더에 역으로 동기화되지 않습니다. 최종 편집/저장의 소유자를 한쪽으로 정하세요. 실제 동작은 [업로더 예제](../examples/uploader/index.html)의 ‘모음 그리드에 표시’에서 확인할 수 있습니다.

## 그리드 → 차트

```js
function refreshChart() {
  const rows = grid.getData();
  chart.setData({
    labels: rows.map(row => row.name),
    datasets: [{ label: '수량', data: rows.map(row => row.qty ?? null) }]
  });
}
```

그리드 onChange에서 호출하거나 조회 성공 후 호출합니다. 차트는 원본 데이터를 바꾸지 않습니다. 계열 표시/숨김은 시각 상태이며 원본 데이터 필터가 아닙니다.

## 간트 → 캘린더

간트는 종료일을 포함하고 캘린더는 종료일을 제외합니다. 반드시 하루를 더해 변환합니다.

```js
import { shiftGanttDate } from '@moum/gantt';
calendar.setEvents(gantt.getTasks().map(task => ({
  id: task.id, title: task.name, allDay: true,
  start: task.start, end: shiftGanttDate(task.end, 1)
})));
```

캘린더 시간 값은 시간대가 없는 현지 벽시계 시간입니다. 서버 UTC 값을 그대로 넣지 말고 애플리케이션의 업무 시간대로 변환하세요. 간트 부모 날짜/진행률은 자동 집계하지 않습니다. 양방향 연동은 호스트에서 공통 데이터 모델을 소유하도록 구현하세요.

## 수명 주기·서버 저장

React/Vue 등에서는 비어 있는 DOM을 ref로 전달하고 컴포넌트를 제거할 때 destroy합니다. 그리드 내부 DOM과 프레임워크 렌더링이 같은 자식을 동시에 소유하지 않게 하세요. onChange는 메모리 변경 통지이며 서버 저장 성공 통지가 아닙니다. 저장 실패/충돌/재시도/재조회는 앱에서 처리합니다.

업로더는 `url` 또는 `onUpload`를 명시할 때만 전송합니다. 진행률/취소/타임아웃/재시도를 지원하며 취소는 서버 롤백을 의미하지 않습니다. 서버 권한·파일 검사·레코드 재검증·멱등성은 애플리케이션 책임입니다.

## 실행과 검증

```text
npm run check
node scripts/browser-suite-check.mjs
npm pack ./packages/charts ./packages/gantt ./packages/uploader ./packages/calendar --pack-destination output/packages
node scripts/package-suite-check.mjs
```

브라우저 검증은 선택적 개발 도구 Playwright/axe-core와 Chromium/Firefox/WebKit 설치가 필요합니다. 제품 런타임·빌드·Node 모델 테스트에는 추가 의존성이 없습니다. package-suite-check는 tar 실행 파일과 위에서 만든 tgz를 사용해 격리된 소비자 프로젝트에서 export/라이선스/해시/타입 파일을 검증합니다. 예제는 file://로 바로 열 수 있고 별도 서버가 필요하면 `node scripts/serve.mjs`를 사용합니다.
