# @moum/grid 0.7.0

폐쇄망용 데이터 그리드입니다. 코어는 외부 런타임 의존성이 없으며, XLSX 파일 기능만 동봉한 SheetJS Community Edition 0.20.3을 선택적으로 사용합니다. npm에는 아직 등록하지 않았습니다.

처음 사용한다면 [HTML·JSP·로컬 npm 빠른 시작](https://github.com/ic-song/moum/blob/main/docs/getting-started.md), [React·Vue 연결](https://github.com/ic-song/moum/blob/main/docs/frameworks.md), [목적별 예제](https://github.com/ic-song/moum/blob/main/examples/README.md)를 먼저 확인하세요. 파일 복사는 JS/CSS와 LICENSE, 설치형 프로젝트는 저장소에서 `npm pack ./packages/grid`로 만든 tgz를 사용합니다. 아래는 API 참조입니다.

## 배포

| 파일 | 사용 방식 |
| --- | --- |
| `dist/moum-grid.js` | 일반 script로 로드, `new MoumGrid(element, options)` |
| `dist/moum-grid.mjs` | `import Grid, { GridModel, parseTSV, toTSV, readXLSX, writeXLSX } from './moum-grid.mjs'` |
| `dist/moum-grid.cjs` | `const { Grid, GridModel } = require('./moum-grid.cjs')` |
| `dist/moum-grid.css` | `.moum-grid`의 `--moum-*` CSS 변수로 테마 조정 |
| `vendor/sheetjs/xlsx.full.min.js` | XLSX 기능을 사용할 때 그리드보다 먼저 로드하는 로컬 script |
| `SHA256SUMS.txt` | 배포 파일과 라이선스의 SHA-256 |

직접 파일 실행에는 일반 script를 사용합니다. 브라우저 ESM은 내부 웹서버에서 제공합니다. React·Vue 등에서 사용하는 기존 SheetJS 모듈이 있다면 `options.xlsx`로 전달할 수 있습니다. 자동 다운로드·CDN 로딩은 하지 않습니다.

```html
<link rel="stylesheet" href="./dist/moum-grid.css">
<div id="grid"></div>
<script src="./vendor/sheetjs/xlsx.full.min.js"></script>
<script src="./dist/moum-grid.js"></script>
<script>
  const grid = new MoumGrid('#grid', {
    columns: [
      { field: 'code', header: '코드', editable: false },
      { field: 'name', header: '품목명' },
      { field: 'qty', header: '수량', type: 'number' }
    ],
    data: [],
    onChange: ({ reason, changes, data }) => console.log(reason, changes)
  });
</script>
```

## 생성 옵션

`new Grid(target, options)`는 비어 있는 컨테이너 요소 또는 선택자를 받습니다.

| 옵션 | 설명 |
| --- | --- |
| `columns` | 필수 배열. `field`, `header`, `type`, `editable`, `required`, `width`, `validate`, `defaultValue` |
| `data` | 행 객체 배열, 기본값 `[]`. 중첩 객체 셀 편집은 제공하지 않음 |
| `editable` | 전체 편집 여부, 기본값 `true` |
| `historyLimit` | 데이터 트랜잭션 보관 수, 기본값 `100` |
| `pasteAppend` | 일반 무필터 모드에서 부족한 행을 추가, 기본값 `true` |
| `frozenColumns` | 왼쪽부터 고정할 열 수, 기본값 `0` |
| `groupBy` | 행 그룹 필드 배열. 트리와 동시에 사용 불가 |
| `tree` | `{idField, parentField, labelField}`. ID·부모 ID 평면 배열 기반 |
| `xlsx` | 선택 XLSX 라이브러리 객체. 기본값 `globalThis.XLSX` |
| `label` | 그리드 접근성 이름 |
| `dataMode`, `pageSize` | virtual/infinite/pagination, 구간 행 수. 로컬 기본 virtual, 서버 기본 pagination |
| `dataSource` | 선택 서버 load/save/exportRows 콜백, rowKey/versionField/timeoutMs. data와 동시 사용 불가 |
| `recovery` | 선택 `{key,schemaVersion,maxBytes}`. IndexedDB 미저장 복구. 기본 꺼짐, 계정/업무별 key 필요 |
| `onChange` | `{reason, changes, data}`. 데이터 변경 후 호출 |
| `onSelectionChange` | 0 기준 표시 좌표 `{top,bottom,left,right}` |
| `onColumnResize` | `{field,width}`. 너비 변경 시 호출 |

타입은 기본 텍스트, `number`, `boolean` 변환을 지원합니다. 숫자는 쉼표 천 단위 구분과 소수를 처리하며 잘못된 구분은 거부합니다. 코드·긴 식별자·앞자리 0이 필요한 값은 텍스트로 사용하세요. `validate(value)`는 유효하면 falsy, 오류이면 메시지 문자열을 반환합니다. 빈 값은 required 검사 후 숫자·불린에는 `null`, 텍스트에는 빈 문자열로 저장되며 사용자 validate는 비어 있지 않은 값에 호출됩니다. 기본값은 상수 또는 `(newRowIndex) => value`입니다.

## 데이터·선택·이력

| API | 동작 |
| --- | --- |
| `getData({raw=false})` | 로컬 전체/서버 읽어온 행의 얕은 복사. 수식 모드는 기본 계산값, raw:true는 원문 |
| `finishEdit()` | 현재 입력창 값을 검증·확정. 실패/조합 중이면 false이며 입력창 유지. getData 전에 사용 가능 |
| `setData(rows)` | 로컬 데이터 교체·이력·선택 초기화. recovery 사용 시 dirty면 false로 차단; 저장/취소 후 교체 |
| `setSearch(text)` | 전체 열 문자열 검색; 진행 중 편집은 취소 |
| `getSelection()` | 표시 좌표의 선택 범위. 병합과 겹치면 병합 범위까지 확장 |
| `select({row,col}, extend=false)` | 표시 셀 선택·범위 확장 |
| `copySelection()` | TSV 반환. 시스템 복사는 Ctrl+C 사용자 입력으로 처리 |
| `paste(textOrMatrix)` | 선택 왼쪽 위부터 적용. 검증 실패는 전체 거부 |
| `clearSelection()` | 선택 셀 값 지우기. 행을 삭제하지 않음 |
| `addRow(values={})` | 기본값으로 마지막에 행 추가. 검색·필터를 해제하고 새 행 선택 |
| `deleteSelectedRows()` | 선택한 표시 행 삭제. 트리 부모의 자손도 포함 |
| `undo()`, `redo()` | 셀 편집·붙여넣기·Delete·행 추가/삭제·XLSX 교체를 작업 단위로 복원 |
| `destroy()` | DOM·전역 이벤트·ResizeObserver 해제 |

`changes`의 셀 변경은 `{row,field,previous,value}`이고 `row`는 **원본 배열 인덱스**입니다. 행 구조 변경은 `{kind:'rows',row:-1,field:null,previous:oldRows,value:newRows}`입니다. 표시 인덱스와 혼용하면 안 됩니다. 구조 변경 후 이전 외부 인덱스는 다시 조회해야 합니다. `reason`은 `edit`, `paste`, `clear`, `insert`, `delete`, `import`, `undo`, `redo`입니다. `onChange`는 반영 후 호출하므로 콜백 오류·서버 저장 실패는 호스트에서 처리합니다. 서버·파일에 자동 저장하지 않습니다.

## 정렬·필터·열

```js
grid.setSorts([{ field: 'name', direction: 'asc' }, { field: 'qty', direction: 'desc' }]);
grid.setFilters([{ field: 'qty', operator: 'between', value: 10, value2: 100 }], { logic: 'and' });
grid.setColumnWidth('name', 220);
grid.setFrozenColumns(1);
```

헤더 클릭은 오름차순→내림차순→해제, Shift+클릭은 다중 정렬입니다. 필터 연산자는 `contains`, `startsWith`, `equals`, `notEquals`, `gt`, `gte`, `lt`, `lte`, `between`, `empty`, `notEmpty`이며 전역 조건 연결 `and`/`or`를 선택합니다. 텍스트는 대소문자를 구분하지 않습니다. `setFilters([])`는 필터를 해제합니다. RealGrid의 컬럼별 OR·컬럼 간 AND 조합 API와 동일하지 않습니다.

열 너비는 마우스 또는 헤더의 separator에서 방향키로 조절하며 64~1000px 범위입니다. 왼쪽 고정 열을 지원합니다. 오른쪽 고정·행 고정·열 드래그 재배치는 후속 기능입니다.

## 그룹·트리·병합

```js
grid.setGroupBy(['team', 'category']); // 다단 그룹과 숫자 필드 합계
grid.setGroupBy([]);
grid.setTree({ idField: 'id', parentField: 'parentId', labelField: 'name' });
grid.toggleNode('team-1');
grid.setTree(null);
```

그룹과 트리는 별도 모드입니다. 트리 ID는 비어 있거나 중복될 수 없고 부모가 존재해야 하며 순환 관계는 거부합니다. 검색·필터는 일치 노드의 상위 경로도 표시하고 정렬은 형제 사이에서 적용합니다. 트리 모드 설정은 유효하지 않은 이전 데이터로의 Undo를 막기 위해 데이터 이력을 초기화합니다.

`mergeSelection()` / `unmergeSelection()`은 일반 모드에서 사각형을 시각적으로 병합·해제합니다. 가려진 원본 값은 보존하며 직접 편집은 좌상단 셀에 적용합니다. Delete는 병합 범위 전체를 지우고 Undo로 복원합니다. 병합 대상에 붙여넣기는 차단하고 고정 열 경계를 넘는 병합은 거부합니다. 정렬·필터·검색·고정 설정·모드·행 구조 변경 시 병합을 해제합니다. 병합·너비·정렬 같은 뷰 변경은 데이터 Undo 이력에 포함하지 않습니다. 자동 같은 값 병합·그룹 병합은 후속 대상입니다.

## Excel 클립보드와 XLSX

Excel의 text/plain TSV와 HTML 표를 함께 읽습니다. 텍스트의 탭·공백·줄바꿈을 보존하고 숫자 컬럼은 HTML 원시 숫자 값이 있으면 사용합니다. 내부 줄바꿈은 LF로 정규화합니다. 원본 Excel 서식·수식은 실행하거나 재현하지 않으며 셀 값을 가져옵니다.

일반 모드의 무필터 붙여넣기는 부족한 행을 추가합니다. 그룹·트리·검색·조건 필터 상태에서는 표시 행 안에서만 적용합니다. 열 범위 초과·잘못된 값·병합 대상은 전체 거부하고 읽기 전용 셀은 유지합니다. 자동 행 확장을 끄려면 `pasteAppend:false`를 지정하세요.

```js
await grid.importXLSX(file, { sheetName: '데이터', header: true });
grid.exportXLSX({ fileName: 'data.xlsx', scope: 'view', sheetName: '데이터' });
grid.exportXLSX({ fileName: 'all.xlsx', scope: 'all' });
grid.downloadCSV();
```

가져오기는 현재 데이터를 교체하며 Ctrl+Z/Y로 복원합니다. 첫 행의 field·header 이름으로 매핑하고 중복 헤더를 거부합니다. 기본 시트는 첫 번째이며 `header:false`는 컬럼 순서로 읽습니다. 모든 매핑 값의 검증이 성공해야 반영합니다. 파일을 읽는 사이 편집이 발생하면 늦은 가져오기를 거부합니다. 전체 읽기 전용 그리드는 가져오지 않습니다. 일반 컬럼의 읽기 전용 설정은 **셀 편집** 보호이며 전체 파일 교체 시에는 가져온 값을 사용합니다.

XLSX 기본 내보내기는 현재 표시 행만 포함합니다. 접힌 그룹·트리의 자손도 모두 포함하려면 `scope:'all'`을 사용합니다. `view`에는 현재 수동 병합을 포함하며 `all`은 병합 없이 원본 데이터를 출력합니다. 수식 보존은 `formulas:true`와 `scope:all`로 별도 요청합니다. 복잡한 스타일·이미지·시트 보호는 후속 대상입니다. XLSX는 20MB, 시트 영역 100만 셀까지 입력을 제한하고 클립보드는 10만 셀까지 처리합니다. 이 수치는 성능 보장이 아닙니다.

`GridModel`은 DOM 없이 `apply`, `replaceRows`, `insertRows`, `removeRows`, `undo`, `redo`를 사용할 수 있습니다. 구조 변경 이력은 행 스냅샷을 보관하므로 큰 데이터와 많은 이력에서는 메모리를 고려하세요. 자세한 지원 차이는 저장소의 [RealGrid 비교](https://github.com/ic-song/moum/blob/main/docs/realgrid-comparison.md)와 [검증 기록](https://github.com/ic-song/moum/blob/main/docs/verification.md)을 확인하세요.

## 0.3 확장

행·열 가상 스크롤과 A1 수식 설정·제약은 [확장 API](https://github.com/ic-song/moum/blob/main/docs/grid-advanced.md), 선택적인 `MoumRealGrid` 배포물은 [공개 API 일부 이행](https://github.com/ic-song/moum/blob/main/docs/realgrid-api-subset.md)에 정리했습니다. 수식은 기본 비활성화이며 전체 Excel 계산 엔진이나 전체 RealGrid 교체 호환을 제공하지 않습니다.

## 0.4 표시 방식과 다운로드

`dataMode: "virtual" | "infinite" | "pagination"`, `pageSize`와 `setDataMode`, `setPage`, `setPageSize`, `loadMore`, `getPagingState`를 제공합니다. 엑셀 다운로드 scope는 view/filtered/all/selection입니다. [사용 예제·범위·제약](https://github.com/ic-song/moum/blob/main/docs/data-modes.md)을 확인하세요.

## 0.5 서버 데이터

`dataSource: {load,rowKey,timeoutMs,exportRows}`로 서버 pagination/infinite를 연결합니다. `await grid.ready`, `reload()`, `retryLoad()`를 제공하고 페이지/추가 요청은 Promise<boolean>을 반환합니다. 서버 검색·정렬·필터와 실패/취소/재시도를 지원하며 save가 없는 서버 데이터는 조회 전용입니다. [실행 예제·요청/응답·전체 Excel·제약](https://github.com/ic-song/moum/blob/main/docs/server-data.md)을 확인하세요.

## 0.6 서버 편집·저장

`dataSource.save`와 양의 정수 행 버전(`versionField`, 기본 `_version`)을 연결하면 서버 셀 편집·붙여넣기·행 추가/삭제와 Ctrl+Z/Y를 사용할 수 있습니다. `getChanges()`는 추가/수정/삭제 묶음, `getSaveState()`는 저장 상태를 반환합니다. `await saveChanges()`는 저장 확인, `await discardChanges()`는 초안 취소 후 재조회입니다. 미저장 변경의 조회 이동을 차단하고, 응답 불명 시 같은 요청 ID로 재확인합니다. 서버는 원자적 트랜잭션·버전 충돌 검사·영속적 요청 ID 중복 방지를 보장해야 합니다. [전체 계약·실행 예제](https://github.com/ic-song/moum/blob/main/docs/server-editing.md)를 확인하세요.

## 0.7 미저장 복구

`recovery:{key:'계정:업무:문서',schemaVersion:'1'}`을 켜면 입력/변경마다 IndexedDB에 보관합니다. `await recoveryReady`, `getRecoveryState()`, `flushDraft()`, `restoreDraft()`, `discardDraft()`, `downloadDraft()`를 제공합니다. 로컬 저장 완료는 `markSaved()`, 기준점 복원은 `discardChanges()`입니다. 서버 미확정 요청은 원래 ID로 재확인하며 복구 시 자동 전송하지 않습니다. 마지막 임시 저장 완료본만 복구하며 Undo/뷰 설정은 제외합니다. [키/스키마·용량/종료 보장·API](https://github.com/ic-song/moum/blob/main/docs/recovery.md)를 먼저 확인하세요.
