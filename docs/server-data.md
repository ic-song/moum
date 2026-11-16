# 서버 페이징·무한 스크롤

0.5.0은 `dataSource`를 지정하면 서버에서 필요한 구간만 조회합니다. 네트워크 주소·인증·요청 형식은 호스트의 콜백이 결정하며, 지정하지 않은 그리드는 기존 로컬/폐쇄망 동작을 유지합니다. JSP/Servlet·Spring·Node 등 서버 종류와 무관하게 같은 응답 계약을 사용할 수 있습니다.

0.6.0에서는 `dataSource.save`를 선택적으로 연결해 서버 편집·추가·삭제·저장도 지원합니다. [저장 API 계약과 실행 가능한 편집 예제](server-editing.md)를 참고하세요. 아래 예제는 기존 조회 전용 계약입니다.

## 실행 가능한 HTTP 예제

```sh
node scripts/serve.mjs
```

브라우저에서 `http://127.0.0.1:4173/examples/server/index.html`을 엽니다. [예제 소스](../examples/server/demo.js)는 실제 `fetch`로 루프백 서버 `/api/grid`에 POST합니다. 서버는 [demo-api.mjs](../scripts/demo-api.mjs)의 예시 데이터 1,023행을 검색·필터·정렬한 뒤 요청 범위를 반환합니다. 응답 지연·한 번 실패시키기 버튼으로 상태를 확인할 수 있습니다. 운영 서버·DB·사용자 인증에 연결한 예제가 아닙니다.

서버 예제는 `file://`에서 실행하지 않습니다. 폐쇄망에서는 JS·CSS·선택 SheetJS와 API를 내부 HTTP 서버에 배포하세요. 기존 로컬 예제는 계속 서버 없이 실행할 수 있습니다.

## 연결

```js
const grid = new MoumGrid('#grid', {
  columns: [
    { field: 'id', header: '코드' },
    { field: 'name', header: '이름' },
    { field: 'quantity', header: '수량', type: 'number' }
  ],
  dataMode: 'pagination', // 또는 infinite. dataSource가 있으면 기본 pagination
  pageSize: 50,
  dataSource: {
    rowKey: 'id',
    timeoutMs: 30000,
    async load({ signal, ...request }) {
      const response = await fetch('/internal-api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal
      });
      if (!response.ok) throw new Error(`조회 실패: HTTP ${response.status}`);
      return response.json();
    }
  }
});
await grid.ready;              // true: 성공 / false: 취소·실패. 실패 상세는 UI/상태에 표시
await grid.setPage(1);         // 두 번째 페이지
await grid.setPageSize(100);
await grid.setDataMode('infinite');
await grid.loadMore();
await grid.retryLoad();        // 실패했던 구간만 재시도
await grid.reload();           // 페이지: 현재 구간 / 무한: 처음부터 새로 조회
```

`load`의 요청은 `{offset,limit,pageIndex,query,sorts,filters,filterLogic,signal}`입니다. offset/pageIndex는 0부터 시작합니다. 검색 입력은 200ms 후 요청하며 `setSearch` API는 바로 요청합니다. 정렬·필터 설정 API는 로컬 그리드와 같지만 계산은 서버에서 전체 결과에 적용해야 합니다. `sorts`는 `[{field,direction:1|-1}]`, `filters`는 `[{field,operator,value,value2}]`, filterLogic은 and/or입니다. [필터 연산자](../packages/grid/src/data-view.js)는 기존 로컬 모델과 같습니다. UI를 통한 설정 후 필요하면 `await grid.ready`로 해당 요청을 기다립니다.

응답 예:

```json
{
  "rows": [
    { "id": "A001", "name": "품목", "quantity": 10 }
  ],
  "total": 1
}
```

total은 검색·필터 적용 후 **전체** 건수이며 0 이상의 안전한 정수입니다. rows는 해당 offset/limit의 구간이고 길이는 `max(0,min(limit,total-offset))`와 같아야 합니다. 빈 배열을 임시 결과로 반환하지 말고 통신/검증 오류는 예외로 알리세요. 커서 전용 API는 호스트에서 이 offset/total 계약으로 변환해야 하며, total 미확정 응답은 아직 지원하지 않습니다.

모든 행에는 고유 rowKey(기본 id)가 필요하며 값은 빈 문자열이 아닌 string 또는 유한 number입니다. 컬럼 타입 변환 후에도 중복되면 거부하고 문자열로 비교하므로 1과 "1"은 같은 키입니다. 큰 정수 ID와 앞자리 0 코드는 text/string으로 전달하세요. 서버는 정렬 값이 같을 때도 ID 등으로 순서를 안정적으로 고정해야 합니다. offset 기반 조회 도중 목록이 바뀌면 중복 키는 감지하지만 모든 누락을 자동 감지할 수는 없으므로 일관된 스냅샷/정렬은 서버가 제공해야 합니다.

## 요청·상태와 편집 범위

- 같은 무한 구간의 동시 요청은 하나로 합칩니다. 실패하면 이전에 읽은 행과 선택을 보존하고 자동 재요청을 멈춥니다. 다시 시도는 실패한 구간만 읽습니다.
- 검색·정렬·필터·모드·페이지 크기를 바꾸면 첫 구간부터 다시 읽고 이전 요청을 취소합니다. 이전 응답은 콜백이 취소를 무시해도 반영하지 않습니다. 검색 조건이 바뀌면 이전 결과를 비웁니다.
- 페이지 이동·추가 요청 중에는 직전 성공 결과를 보존합니다. 실패 시 그 결과와 페이지 번호를 유지하고 실패/재시도를 안내합니다. 페이지 이동이 성공하면 선택을 초기화하고, 무한 모드의 추가 성공은 기존 선택을 유지합니다.
- 서버 total 감소로 마지막 페이지가 사라지면 남은 마지막 페이지로 한 번 이동합니다. 재조회 중에도 계속 줄면 오류로 알리고 다시 시도할 수 있습니다.
- timeoutMs는 기본 30초, 1~300,000ms입니다. 조회·전체 Excel 요청 모두 시간 초과 시 요청을 취소하고 UI를 복구합니다. destroy는 대기 요청·검색 타이머·다운로드 준비를 취소합니다.
- `getPagingState()`는 기존 필드에 loading/error를 추가합니다. total은 서버 전체 결과, start/end는 해당 구간, loaded는 메모리에 읽어온 데이터 행 수입니다. 페이지/모드/행 수/추가/재시도/새로고침 메서드는 서버 모드에서 `Promise<boolean>`을 반환합니다. 같은 메서드의 로컬 동작은 기존 동기 반환을 유지합니다.

서버 모드는 **조회 전용**입니다. 셀/행 편집·Delete·붙여넣기·XLSX 가져오기를 막고 선택·복사·다운로드는 허용합니다. 서버 저장·트랜잭션·수정 충돌 해결을 구현한 것으로 표시하지 않습니다. `getData()`는 현재 페이지 또는 읽어온 무한 구간의 복사본이며 서버 전체 데이터가 아닙니다. `setData()` 대신 reload를 사용하세요.

서버 모드는 pagination/infinite를 선택하며 필요한 행·열의 DOM 가상화를 함께 사용합니다. 로컬 전체 결과용 virtual 모드는 선택하지 않습니다. 공유 model·초기 data·자유 A1 수식·그룹/소계·트리·수동 병합은 함께 사용하지 않습니다. 부분 결과를 완전한 데이터로 오인해 계산하지 않도록 제한합니다. 서버에서 계산한 일반 필드 값은 표시할 수 있습니다. RealGrid 이행 계층의 setPaging API와는 별도 자체 API입니다.

## 서버 전체 Excel

view는 현재 페이지/읽어온 행, selection은 현재 선택 범위를 로컬 XLSX로 만듭니다. all/filtered는 읽어온 행만 전체로 잘못 내보내지 않도록 `dataSource.exportRows`가 있을 때만 활성화합니다.

```js
dataSource: {
  load: loadRows,
  rowKey: 'id',
  async exportRows({ scope, signal, ...criteria }) {
    const response = await fetch('/internal-api/items/export-rows', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, ...criteria }), signal
    });
    if (!response.ok) throw new Error('전체 다운로드 조회 실패');
    return response.json(); // 요청 범위의 전체 행 객체 배열 (rowKey 포함)
  }
}
```

filtered는 현재 검색/정렬/필터의 스냅샷을 전달하고, all은 query/sorts/filters를 비운 전체 범위를 전달합니다. 호스트의 기본 조회 범위·인증은 동일하게 적용해야 합니다. 이 콜백은 페이지 제한 없이 요청 범위의 모든 행을 반환해야 합니다. 페이지를 모음 내보내는 것은 호스트 콜백에서 구현하세요. 최대 100만 셀을 클라이언트에서 XLSX로 만들며, 그보다 큰 파일은 서버에서 직접 생성하는 방식을 사용합니다.

전체 다운로드 중 검색 조건 변경이나 destroy가 발생하면 파일을 저장하지 않습니다. 서버 모드 전체 다운로드의 반환은 Promise<boolean>입니다. 수식 원문 보존은 지원하지 않으며 서버 계산값을 출력합니다. SheetJS는 기존과 같이 로컬 선택 모듈입니다.

## 검증 범위

[검증 기록](verification.md)에 단위·실제 HTTP·Chromium/Firefox/WebKit·Excel·반응형·자동 WCAG 결과를 정리했습니다. 자동 검사는 실제 스크린리더·네이티브 Windows 한글 IME 수용시험을 대체하지 않습니다. [W3C 그리드 속성 안내](https://www.w3.org/WAI/ARIA/apg/practices/grid-and-table-properties/)에 맞춰 서버 전체 행 수와 페이지 행 위치를 ARIA로 제공합니다.
