# 서버 데이터 편집·추가·삭제·저장 (0.6.0)

`dataSource.save`를 연결하면 서버 pagination/infinite에서도 셀 편집, Excel 셀 붙여넣기, 행 추가·삭제, 저장 전 Undo/Redo를 사용할 수 있습니다. save가 없는 기존 서버 그리드와 `editable: false` 그리드는 조회 전용을 유지합니다. 코어는 네트워크 주소나 인증을 지정하지 않습니다.

## 실행

`node scripts/serve.mjs` 실행 후 `/examples/server-edit/index.html`을 엽니다. `/api/grid-edit`는 조회, `/api/grid-edit/save`는 저장입니다. 예제 소스는 [demo.js](../examples/server-edit/demo.js), 서버는 [edit-api.mjs](../scripts/edit-api.mjs), 저장소는 [edit-store.mjs](../scripts/edit-store.mjs)입니다.

행과 요청별 저장 결과는 무시되는 `output/server-data/store.json`에 함께 기록합니다. 재시작 후에도 데이터와 중복 방지 정보가 유지됩니다. 임시 파일 쓰기·sync·동일 디렉터리 rename 후에만 메모리 상태를 바꿉니다. 파일이 손상되면 초기 데이터로 덮어쓰지 않고 오류를 반환합니다. 예제 서버는 단일 프로세스/로컬 개발용이며, 사용자 인증·권한·운영 DB는 포함하지 않습니다. 여러 프로세스나 운영 서비스에는 DB 트랜잭션과 영속적인 요청 ID 저장소를 사용하세요. JSON 저장 파일은 정적 HTTP 경로에서 제공하지 않습니다.

## 연결 예

```js
const grid = new MoumGrid('#grid', {
  columns: [
    { field: 'id', header: '코드' },
    { field: 'name', header: '품목', required: true, defaultValue: '신규 품목' },
    { field: 'qty', header: '수량', type: 'number', defaultValue: 1 }
  ],
  dataMode: 'pagination', // infinite도 동일한 저장 계약
  pageSize: 50,
  dataSource: {
    rowKey: 'id', versionField: '_version', timeoutMs: 30000,
    load: async ({ signal, ...query }) => post('/items/query', query, signal),
    save: async ({ signal, ...batch }) => post('/items/save', batch, signal)
  }
});
async function post(url, body, signal) {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || '서버 오류'), {
    code: result.code, committed: result.committed
  });
  return result;
}
```

조회 행에는 고유 `rowKey`와 양의 안전한 정수 버전이 필요합니다. 기본 버전 필드는 `_version`입니다. 버전을 컬럼으로 보여주려면 `type: 'number'`를 지정하세요. 키와 버전 컬럼은 자동으로 읽기 전용이 됩니다. 신규 행의 키는 저장 전 빈 값이며, 서버가 키·버전을 배정합니다. `__moumClientId`는 신규 행의 Undo/Redo를 위한 예약 필드로 서버 조회 결과/컬럼에 사용하지 마세요. 신규 행은 컬럼 기본값을 사용하므로 필수 값은 기본값 또는 직접 입력으로 채워야 합니다.

## 저장 묶음과 응답

```js
// save 요청: 현재 불러온 행과 기준 데이터의 차이만 보냄
{
  requestId: '동일한 변경/재시도에 사용하는 고유 문자열',
  created: [{ clientId: '신규행토큰', values: { name: '새 품목', qty: 2 } }],
  updated: [{ key: 'R00001', version: 3, values: { qty: 10 } }],
  deleted: [{ key: 'R00002', version: 1 }],
  signal // AbortSignal, HTTP 본문에서는 제외
}
// 성공 응답: 전체 원자적 저장이 완료된 뒤 반환
{
  requestId: '요청과 같은 문자열',
  created: [{ clientId: '신규행토큰', row: { id: 'R00124', _version: 1, name: '새 품목', qty: 2 } }],
  updated: [{ id: 'R00001', _version: 4, name: '기존 품목', qty: 10 }],
  deleted: ['R00002']
}
```

created.values에는 편집 가능한 컬럼을 보내고 updated.values에는 바뀐 편집 필드만 보냅니다. 응답의 created.row/updated는 모든 표시 필드를 포함한 서버 확정 행이어야 합니다. 수정 버전은 이전보다 커야 하고, 요청/응답의 키·신규 토큰·행 수가 정확하게 일치해야 합니다. 중복 키나 잘못된 응답을 부분 적용하지 않습니다. 수정 후 삭제는 삭제 한 건, 신규 후 삭제는 변경 없음으로 합쳐집니다. Undo/Redo로 원상 복구하면 저장 대상에서도 빠집니다.

서버는 전체 요청에 대해 다음을 보장해야 합니다.

1. 사용자 권한·허용 필드·타입·필수 값을 검증하고 수정/삭제의 원래 버전을 확인합니다.
2. 한 행이라도 충돌/오류이면 **전체 묶음을 적용하지 않습니다**. 버전 조건 UPDATE/DELETE와 행 추가, 요청 결과 기록을 같은 트랜잭션에서 수행합니다.
3. 같은 requestId와 같은 내용이 다시 오면 저장된 원래 결과를 반환합니다. 내용이 다르면 거부합니다. 재시작/여러 서버 인스턴스에서도 이 규칙을 유지해야 합니다.
4. 확실히 아무것도 반영하지 않은 오류만 `{committed:false}`로 알려줍니다. 예제는 버전 충돌 HTTP 409, 입력 오류 422를 사용합니다. HTTP 상태만으로 클라이언트가 미반영을 추측하지 않습니다.

예제 요청 ID 기록에는 만료가 없습니다. 운영에서는 재시도 가능 기간과 요청 기록 보존 정책을 정하고, 기록 만료로 오래된 재시도가 새 등록으로 처리되지 않도록 하세요. 클라이언트의 요청 취소가 서버 트랜잭션 취소를 보장하지는 않습니다.

## 상태와 API

| API | 동작 |
|---|---|
| `getChanges()` | `{created,updated,deleted}` 복사본. 현재 불러온 구간의 저장 대상 |
| `getSaveState()` | `{status,error,dirty,requestId}`. status는 idle/error/saving/uncertain/refresh 또는 readonly |
| `await saveChanges()` | 저장 성공이 확인되면 true. 중복 호출은 같은 Promise. 실패·변경 없음은 false |
| `await discardChanges()` | 미저장 변경·이력을 버리고 서버 최신 목록 재조회. 재조회 성공 여부 반환 |
| `reload()` / `retryLoad()` | 일반 재조회 또는 저장 확인 후 실패한 목록 갱신 재시도 |

저장 중에는 데이터 변경을 잠급니다. 성공 응답 검증 후 서버 확정 행을 적용하고 이력을 비운 뒤, 현재 서버 페이지(무한 모드는 첫 구간)를 재조회해 검색·정렬·행 수를 맞춥니다. 저장 성공 후 재조회 실패 시 `saveChanges()`는 true지만 status는 refresh이며 추가 편집을 잠급니다. 다시 불러오면 해제됩니다. discard의 재조회 실패도 같은 잠금 상태를 사용합니다.

`committed:false` 오류는 error로 표시하고 입력·이력을 유지합니다. 사용자는 수정 후 저장하거나 취소할 수 있습니다. 충돌 시 자동 덮어쓰기를 하지 않습니다. 변경 취소로 최신 버전을 다시 읽어야 합니다.

시간 초과·네트워크 단절·잘못된 저장 응답은 **uncertain(결과 불명)**입니다. 입력·취소·조회 이동을 잠그고 ‘저장 결과 다시 확인’으로 같은 요청 ID와 정확히 같은 변경 묶음을 보냅니다. 서버가 이전 결과를 반환해야 중복 등록을 막을 수 있습니다. uncertain에서도 미반영 오류를 확정해서 반환하려면 해당 요청이 앞서 반영되지 않았음을 서버가 보장해야 합니다.

## 편집 중 화면 동작과 제한

- 미저장 변경이 있으면 검색·정렬·필터·페이지/표시 방식/행 수 변경·추가 조회를 차단합니다. 저장 또는 취소 후 이동하세요. 무한 스크롤 자동 로딩도 멈춥니다. 현재 페이지에 추가한 초안은 서버 조회 조건을 유지한 채 화면 끝에 표시됩니다.
- 행 번호의 `+`/`*`와 상태 영역의 추가·수정·삭제 건수로 미저장 변경을 알립니다. 서버 전체 개수는 저장 전까지 확정 데이터 기준입니다. 편집 중 화면 행 수는 별도로 표시하며 ARIA 전체 행 수는 미확정(-1)으로 둡니다.
- Ctrl+C와 현재 화면/선택 영역 Excel·CSV에는 미저장 값도 포함됩니다. 전체/검색 결과 Excel은 저장/취소 후 사용합니다. 저장 진행·결과 불명 상태에서는 다운로드를 차단합니다.
- 서버 XLSX 파일 전체 교체, 붙여넣기의 자동 행 확장, A1 수식·트리·그룹·수동 병합은 지원하지 않습니다. 행 추가 후 셀 붙여넣기를 사용하세요. 필수 값이 있는 셀 Delete는 기존 원자적 검증 규칙에 따라 거부합니다.
- 창 이탈 시 브라우저 기본 경고를 요청합니다. 0.7.0부터 선택적 [recovery 설정](recovery.md)으로 초안/미확정 요청을 IndexedDB에 보관하고 재접속 때 명시적으로 복구할 수 있습니다. 기본값은 꺼짐입니다. SPA 라우팅/컴포넌트 해제는 호스트가 `getSaveState()`/`getRecoveryState()`로 이탈을 제어해야 합니다.
- 이는 MOUM의 자체 API입니다. RealGrid 저장/행 상태 API의 교체 호환을 뜻하지 않습니다.

검증 재현: `npm run check`, 서버 실행 후 `node scripts/browser-edit-check.mjs`. 단위 검사는 파일 재개방 후 중복 방지·원자성·동시 버전 충돌을, 브라우저 검사는 실제 HTTP 저장과 응답 끊김 복구를 포함합니다. 브라우저 검사는 로컬 예제의 첫 행을 일시 수정한 뒤 복구하므로 운영 API에 실행하지 마세요.
