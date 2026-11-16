# 미저장 데이터 복구 (0.7.0)

`recovery`를 명시하면 편집한 데이터와 입력창의 미확정 값을 IndexedDB에 임시 저장합니다. 새로고침·브라우저 재실행 후에는 **복구/삭제를 직접 선택**합니다. 기본값은 꺼짐입니다. 저장소에는 업무 데이터가 들어가므로 호스트가 사용자·데이터 범위와 보관 정책을 정해야 합니다.

## 시작하기

```js
const grid = new MoumGrid('#grid', {
  columns: [
    { field: 'id', header: '코드', editable: false },
    { field: 'name', header: '품목', required: true },
    { field: 'qty', header: '수량', type: 'number' }
  ],
  data: [{ id: 'A001', name: '노트', qty: 10 }],
  recovery: {
    key: `inventory:${tenantId}:${loggedInUserId}:${documentId}`,
    schemaVersion: '1',
    maxBytes: 2 * 1024 * 1024
  }
});
await grid.recoveryReady;
```

tenantId/loggedInUserId/documentId는 호스트가 가진 값입니다. key를 화면 이름 하나로 공용 지정하지 마세요. 실제 계정이 바뀌면 기존 인스턴스를 제거하고 새 계정의 키로 다시 생성합니다. URL·서버 주소·그리드 이름만으로 자동 계정 구분을 추측하지 않습니다.

| 옵션 | 의미 |
| --- | --- |
| `key` | 필수, 1~500자. 같은 사용자/업무 데이터를 다시 열 때 유지하는 키 |
| `schemaVersion` | 기본 `'1'`. 컬럼 타입·검증·업무 데이터 계약이 바뀌면 호스트가 올림 |
| `maxBytes` | JSON 스냅샷 한도. 기본 2MiB, 1KiB~20MiB. 브라우저 실제 잔여 공간을 보장하지 않음 |

컬럼 field/type/editable/required, 수식 모드, 트리 설정과 서버 키/버전 필드도 스키마에 포함합니다. 다른 스키마의 복구본은 자동 적용하지 않고 내려받기/삭제를 제공합니다. validate 함수의 구현이나 서버 계약 변경은 자동으로 감지할 수 없으므로 schemaVersion을 바꾸세요.

## 저장 시점과 복구 상태

셀 확정·붙여넣기·Delete·행 추가/삭제·Undo/Redo와 입력창의 input 이벤트마다 최신 스냅샷을 기록합니다. 종료 이벤트에만 의존하지 않습니다. 입력 중 비어 있거나 잘못된 값도 입력창 값으로 보관하며, 복구 후 확정할 때 원래 검증을 적용합니다. 동일한 writer의 연속 변경은 마지막 값까지 순서대로 반영합니다.

상태 영역에 확인 중 / 임시 저장 중 / 임시 저장 완료 / 복구본 있음 / 저장 오류가 표시됩니다. **임시 저장 완료는 IndexedDB 트랜잭션 완료 기준**이며 업무 서버 저장 성공을 뜻하지 않습니다. 지원하는 브라우저에서는 strict durability 트랜잭션을 요청합니다.

브라우저를 다시 열면 원래 조회 데이터가 보이고 편집은 잠깁니다. ‘임시 저장 복구’를 누르면 선택한 스냅샷과 입력창을 적용합니다. ‘복구본 삭제’는 선택한 이전 복구본만 삭제합니다. 스키마 불일치/손상 시 기존 기록을 지우지 않고 ‘복구본 내려받기’로 JSON을 받을 수 있습니다. 입력을 복구했다고 서버에 자동 전송하지 않습니다.

각 탭/인스턴스가 고유 레코드에 기록해 서로 덮어쓰지 않습니다. 여러 복구본은 시간과 식별자별로 선택합니다. 하나를 복구하면 나머지 기록은 보존되며 다음 접속에서 다시 선택할 수 있습니다. 복구본 이동/삭제는 읽은 버전과 동일한 레코드에만 적용하므로, 원래 탭이 그사이 갱신한 기록을 지우지 않습니다.

## API

| API | 반환/동작 |
| --- | --- |
| `await recoveryReady` | 초기 저장소 확인 완료. 저장소 접근 오류면 false. 복구본이 있으면 편집을 잠근 채 대기 |
| `getRecoveryState()` | `{enabled,status,candidates,savedAt,error,dirty}` |
| `await flushDraft()` | 현재 데이터/입력창 임시 저장 완료 여부. 실패/복구 선택 대기 시 false |
| `await restoreDraft()` | 현재 선택한 이전 복구본 적용 여부. 선택 ID를 인수로 전달 가능 |
| `await discardDraft()` | 선택한 이전 복구본만 삭제. 현재 편집 데이터를 취소하는 메서드와 구분 |
| `downloadDraft()` | 선택한 이전 복구본 또는 오류 시 현재 스냅샷 JSON 다운로드 |
| `await markSaved()` | 로컬 모드에서 호스트 저장 성공 후 현재 값을 새 기준점으로 확정하고 자신의 복구본 제거 |
| `await discardChanges()` | 로컬 recovery: 기준점 복원. 서버 save: 기준점으로 복원 후 서버 최신 목록 조회 |

status는 disabled/loading/available/writing/saved/idle/error입니다. `savedAt`은 마지막 완료 기록의 시각이고 dirty는 기준점과 현재 값/입력창의 차이입니다. 복구 선택을 기다리는 동안에도 dirty입니다. 입력 데이터가 많거나 저장소가 막혀 기록하지 못하면 오류를 표시하고 이전 완료본을 유지합니다.

```js
// 로컬 데이터를 호스트 API로 저장하는 예
if (grid.finishEdit()) {
  await saveToYourServer(grid.getData()); // 실패하면 markSaved를 호출하지 않음
  await grid.markSaved();
}

// SPA 라우팅 직전, 호스트가 저장/취소/이동 여부를 선택
const recovery = grid.getRecoveryState();
if (recovery.dirty) {
  // 사용자에게 선택 UI를 제공하고 필요하면 await grid.flushDraft()
}
grid.destroy();
```

로컬 recovery를 켜면 dirty 상태의 setData는 false로 거부합니다. 저장 성공 후 markSaved 또는 명시적 discardChanges를 완료하고 새 조회 결과를 넣으세요. 초기/마지막 기준점과 복구 데이터를 다시 덮어쓰는 것을 막기 위한 규칙입니다. React/Vue에서 props의 새 rows를 자동 되먹임하지 않는 원칙도 그대로 적용합니다.

## 서버 저장 요청 복구

`dataSource.save`가 있는 서버 그리드도 같은 recovery 옵션을 사용합니다. 기준 행·버전·조회 조건·페이지 크기/구간과 미확정 저장 요청 전체를 기록합니다. 서버 요청을 보내기 전에 **해당 요청 ID와 변경 묶음의 임시 저장을 완료**합니다. 기록하지 못하면 HTTP 저장 콜백을 실행하지 않습니다.

저장 중 종료되거나 서버 반영 후 응답이 끊기면 복구 후 uncertain 상태로 잠급니다. ‘저장 결과 다시 확인’은 **원래 requestId와 원래 변경 묶음**을 재전송합니다. 서버는 재시작 후에도 같은 요청의 원래 결과를 반환해야 합니다. 브라우저 복구만으로 서버 중복 방지를 구현할 수는 없습니다. [서버 저장 계약](server-editing.md)을 함께 구현하세요.

저장이 확인됐지만 목록 재조회가 실패한 refresh 상태는 확정 행을 보관하며, 복구 후 조회를 다시 시도합니다. 이미 확인된 쓰기를 새 요청으로 전송하지 않습니다. 복구 시 서버의 현재 버전을 무시해 덮어쓰지 않으며, 이전 버전으로 수정하면 서버가 충돌로 거부해야 합니다.

## 보장 범위와 한계

- 같은 브라우저 프로필·같은 origin의 마지막 **임시 저장 완료본**을 복구합니다. 다른 PC·다른 브라우저·다른 프로필로 자동 전송하지 않습니다.
- 브라우저 데이터 삭제/자동 퇴거, 사생활 보호 모드, 접근 차단·용량 초과, 기록 완료 전 강제 종료, 디스크/전원 장애의 무손실은 보장하지 않습니다. [브라우저 저장소 제한](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)을 확인하세요.
- 종료 이벤트는 실행되지 않을 수 있어 변경 시점에 기록합니다. [페이지 수명 주기 안내](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)를 참고하세요.
- 데이터·미확정 입력은 JSON으로 보관합니다. 순환 객체/BigInt 등 JSON으로 표현할 수 없는 데이터에는 사용할 수 없습니다. 큰 데이터는 서버 페이징으로 작업 구간을 줄이세요. 전체 행 스냅샷을 저장하므로 대량 로컬 데이터에서 매 입력의 직렬화 비용이 발생합니다.
- Undo/Redo 이력·열 너비·병합·그룹 접힘·로컬 검색/필터/정렬 등 화면 설정은 복구하지 않습니다. 복구한 데이터는 새 편집 기준으로 표시하며 그 이후 작업부터 Undo를 쌓습니다. 원래 저장 기준점은 보존합니다.
- 편집 가능한 독립 로컬/서버 save 그리드에서 사용합니다. 공유 model 또는 전체 읽기 전용/서버 조회 전용에는 설정하지 않습니다.
- IndexedDB는 암호화 금고가 아닙니다. 같은 origin의 스크립트가 접근할 수 있으므로 민감 데이터·공유 PC·로그아웃 보관 정책을 호스트가 정하세요. 복구 기능은 이 정책을 대신하지 않습니다.

실행 예제: `npm run dev` 후 `/examples/recovery/index.html`, 서버 저장 복구는 `?mode=server`입니다. 실제 검증 결과와 미실행 범위는 [검증 기록](verification.md)에 구분합니다.
