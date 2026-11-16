# MOUM Grid 빠른 시작

JS·CSS를 넣고 `new MoumGrid(컨테이너, 옵션)`으로 생성합니다. 이 문서는 **0.7.0** 기준입니다. 코어에는 인터넷·Node·npm·빌드가 필요하지 않습니다. 서버 조회/저장은 사용하는 프로젝트의 API를 연결합니다.

## 1. 파일 가져오기

[저장소](https://github.com/ic-song/moum)의 Code → Download ZIP으로 받거나 Git으로 내려받습니다. 다음 파일을 프로젝트에 복사하세요.

```text
my-project/
  index.html
  vendor/moum-grid/
    moum-grid.js       ← packages/grid/dist/moum-grid.js
    moum-grid.css      ← packages/grid/dist/moum-grid.css
    LICENSE          ← packages/grid/LICENSE
```

배포 파일은 이미 빌드돼 있습니다. 라이브러리 수정 없이 사용할 때는 `npm install`이나 빌드를 실행하지 않아도 됩니다. 자체 작성 코드는 MIT이며 복사·재배포 시 LICENSE도 포함합니다. 파일 무결성은 `packages/grid/SHA256SUMS.txt`로 확인할 수 있습니다. 원래 목록의 경로를 유지한 패키지 디렉터리에서 해시를 비교하세요.

## 2. HTML에서 만들기

위 구조의 `index.html`에 아래 코드를 넣고 브라우저에서 엽니다.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>품목 목록</title>
  <link rel="stylesheet" href="./vendor/moum-grid/moum-grid.css">
</head>
<body>
  <div id="grid"></div>
  <script src="./vendor/moum-grid/moum-grid.js"></script>
  <script>
    const grid = new MoumGrid('#grid', {
      label: '품목 목록',
      columns: [
        { field: 'code', header: '코드', editable: false },
        { field: 'name', header: '품목', defaultValue: '신규 품목' },
        { field: 'qty', header: '수량', type: 'number', defaultValue: 0 }
      ],
      data: [
        { code: 'A001', name: '노트', qty: 10 },
        { code: 'A002', name: '볼펜', qty: 20 }
      ],
      onChange: ({ reason, data }) => {
        console.log(reason, data);
      }
    });
  </script>
</body>
</html>
```

컨테이너는 생성 시 비어 있어야 하며, 스크립트는 컨테이너 뒤에 두세요. `field`는 데이터 객체의 키, `header`는 화면 제목입니다. 코드·사번·앞자리 0을 유지할 값은 텍스트로 두고, 계산할 수량/금액에는 `type:'number'`를 지정합니다. 기본값을 지정하면 ‘행 추가’에서도 사용할 수 있습니다.

저장소 안에서 바로 열 수 있는 [최소 실행 예제](../examples/quick-start/index.html)는 위 코드에 ‘현재 데이터 확인’과 ‘다른 데이터 불러오기’를 추가한 버전입니다. 그 파일을 프로젝트로 옮길 때는 두 배포 파일 경로를 위처럼 바꾸세요.

## 3. 데이터 읽기·바꾸기·화면 설정

```js
// 입력창에서 편집 중인 값까지 확정한 뒤 읽습니다. 검증 실패 시 입력창을 유지합니다.
if (grid.finishEdit()) {
  const rows = grid.getData();
  console.log(rows);
}

grid.addRow({ code: 'A003', name: '파일', qty: 3 });
grid.setData([{ code: 'B001', name: '새 조회 결과', qty: 5 }]);
grid.setSorts([{ field: 'qty', direction: 'desc' }]);
grid.setFilters([{ field: 'qty', operator: 'gte', value: 5 }]);
grid.setFilters([]);
grid.setDataMode('pagination'); // virtual | infinite | pagination
grid.setPageSize(50);

// SPA에서 화면을 제거할 때 호출합니다.
grid.destroy();
```

`setData()`는 데이터·선택·편집 이력을 교체합니다. `getData()`는 로컬 모드의 전체 행, 서버 모드에서는 **현재 읽어온 행만** 반환합니다. `onChange`의 셀 `changes[].row`는 정렬 전 원본 데이터 인덱스입니다. 그리드의 변경 데이터는 메모리에 있으며, `onChange`가 발생했다고 서버에 저장된 것은 아닙니다.

| 조작 | 동작 |
| --- | --- |
| 드래그 / Shift+방향키 | 여러 셀 선택 |
| Ctrl+C / Ctrl+V | Excel과 값 복사·붙여넣기 |
| Delete | 선택 셀 지우기. 행 삭제는 툴바의 ‘선택 행 삭제’ |
| Ctrl+Z / Ctrl+Y | 변경을 작업 단위로 되돌리기·다시 실행 |
| F2 / 더블클릭 | 편집 시작. Enter 확정, Esc 취소 |

`editable:false` 컬럼은 셀 변경을 막습니다. `required:true`는 빈 값을 거부합니다. `validate(value)`는 정상일 때 `null` 등 falsy, 잘못됐을 때 오류 메시지를 반환합니다. 예: `validate: n => n >= 0 ? null : '0 이상을 입력하세요.'`. 붙여넣기 중 한 셀이 잘못되면 전체 작업을 거부합니다. 단축키의 세부 범위는 [셀 조작 계약](grid-interaction-contract.md)을 확인하세요.

## 4. JSP에서 사용하기

예를 들어 배포 파일을 `src/main/webapp/resources/moum-grid/`에 두면 다음처럼 컨텍스트 경로를 붙입니다. 실제 정적 파일 경로는 프로젝트 설정에 맞추세요.

```jsp
<%@ page contentType="text/html; charset=UTF-8" %>
<link rel="stylesheet" href="${pageContext.request.contextPath}/resources/moum-grid/moum-grid.css">
<div id="grid"></div>
<script src="${pageContext.request.contextPath}/resources/moum-grid/moum-grid.js"></script>
<script>
  const grid = new MoumGrid('#grid', {
    columns: [{ field: 'name', header: '품목' }],
    data: [{ name: '노트' }]
  });
</script>
```

서버 데이터를 JSP 문자열로 직접 이어 붙이기보다는 JSON API로 조회해 `setData()` 또는 `dataSource.load`로 전달하세요. [서버 조회 계약](server-data.md)과 [서버 저장 계약](server-editing.md)에 요청/응답 예제가 있습니다.

## 5. React·Vue / 로컬 npm 패키지

아직 공개 npm 레지스트리에 등록하지 않았으므로 `npm install @moum/grid`로 설치하는 단계는 아닙니다. 저장소에서 로컬 패키지를 만들 수 있습니다.

```sh
# 저장소 루트. 패키지 안에 코어 JS/CSS·선택 SheetJS·라이선스가 들어갑니다.
npm pack ./packages/grid
# 생성: moum-grid-0.7.0.tgz

# 이 파일을 사용할 프로젝트로 복사한 뒤 해당 프로젝트에서 실행
npm install --offline --no-audit --no-fund ./moum-grid-0.7.0.tgz
```

그리드 자체에는 외부 패키지 의존성이 없습니다. 기존 프로젝트의 다른 의존성 설치에는 해당 프로젝트의 캐시/사내 레지스트리가 필요할 수 있습니다. 폐쇄망에는 tgz 또는 배포 파일을 반입합니다. 사용하는 React/Vue 및 빌드 도구는 기존 프로젝트에서 준비하세요.

```js
import Grid from '@moum/grid';
import '@moum/grid/style.css';
// 브라우저의 비어 있는 실제 DOM 요소에 생성
const grid = new Grid(element, { columns, data });
```

브라우저 ESM 파일을 직접 쓸 때는 `dist/moum-grid.mjs`를 `import Grid from './moum-grid.mjs'`로 가져옵니다. ESM 예제는 HTTP 서버에서 제공하세요. CommonJS의 `GridModel`은 Node에서도 사용할 수 있지만 화면 그리드 생성에는 브라우저 DOM이 필요합니다. [React·Vue 컴포넌트와 사용 예](frameworks.md)는 생성·데이터 교체·해제를 포함합니다.

## 6. Excel 파일 다운로드

복사·붙여넣기는 코어만으로 동작합니다. `.xlsx` 파일 가져오기/다운로드를 사용할 때만 동봉한 SheetJS를 **먼저** 로드하세요.

```html
<script src="./vendor/sheetjs/xlsx.full.min.js"></script>
<script src="./vendor/moum-grid/moum-grid.js"></script>
```

`vendor/sheetjs/`에는 `packages/grid/vendor/sheetjs`의 JS와 LICENSE를 복사하고, `packages/grid/THIRD_PARTY_NOTICES.md`도 배포하세요. SheetJS는 Apache-2.0입니다. npm/ESM 프로젝트에서 별도의 로컬 XLSX 모듈 객체를 쓰는 경우 생성 옵션 `xlsx: XLSX`로 전달합니다. CSS 및 라이선스 경로는 사용하는 프로젝트에 맞춥니다.

tgz로 설치했다면 같은 파일은 `node_modules/@moum/grid/vendor/sheetjs/`와 패키지의 `THIRD_PARTY_NOTICES.md`에 있습니다. 이를 앱의 public/정적 파일 디렉터리로 복사해 script로 제공할 수 있습니다. package exports에 없는 vendor 하위 경로를 bare import로 가져오는 방식은 제공하지 않습니다.

```js
grid.exportXLSX({ fileName: 'items.xlsx', scope: 'all' });
// view: 현재 페이지/읽어온 행, filtered: 검색 결과, all: 전체, selection: 선택 영역
```

서버 모드의 all/filtered에는 별도 `dataSource.exportRows`가 필요하며 미저장 변경이 있으면 차단합니다. [다운로드 범위](data-modes.md)와 [서버 전체 다운로드](server-data.md)를 확인하세요.

## 7. 서버와 연결하기

`data` 대신 `dataSource.load`를 사용하면 서버 페이징/무한 스크롤입니다. `dataSource.save`를 추가하면 편집·추가·삭제 묶음을 저장할 수 있습니다. 서버는 원자적 저장, 행 버전 충돌 검사, 요청 ID 중복 방지를 구현해야 합니다.

```sh
# 저장소 루트에서 실제 HTTP 예제 실행
node scripts/serve.mjs
```

- 조회: `http://127.0.0.1:4173/examples/server/index.html`
- 편집·저장: `http://127.0.0.1:4173/examples/server-edit/index.html`
- 연결 코드: [조회 콜백](../examples/server/demo.js), [저장 콜백](../examples/server-edit/demo.js)

서버 예제는 로컬 JSON 파일/예시 데이터로 동작합니다. 운영 DB·인증은 포함하지 않습니다. 일반 로컬 그리드의 `getData()` 전체 저장 방식과 서버 모드의 `saveChanges()` 변경 묶음 저장 방식을 구분하세요.

## 새로고침·종료 후 복구

생성 옵션에 `recovery: { key: "로그인사용자:업무:문서", schemaVersion: "1" }`를 추가하면 마지막 임시 저장 완료본을 복구할 수 있습니다. 계정/데이터별 키, 저장 완료 표시, 서버 요청 재확인과 한계는 [복구 가이드](recovery.md)를 확인하세요. 기본값은 꺼짐입니다.

## 자주 만나는 문제

| 증상 | 확인할 내용 |
| --- | --- |
| `MoumGrid is not defined` | JS 경로, HTTP 404, script 실행 순서. 일반 script의 전역 이름은 MoumGrid, ESM의 기본 import 이름은 자유 |
| 컨테이너 오류 | DOM 생성 뒤 실행했는지, 컨테이너가 비었는지, 같은 요소에 중복 생성했는지 확인 |
| 스타일이 없음 | CSS 경로 확인. 라이브러리 CSS를 앱에 한 번 로드 |
| Excel 버튼 비활성 | SheetJS를 생성 전에 로드하거나 `xlsx` 옵션 전달. 서버 전체 범위에는 exportRows 필요 |
| React/Vue에서 Undo가 초기화 | 새 배열을 매 렌더/셀 변경마다 rows로 보내는지 확인. setData는 이력을 초기화 |
| 서버 저장이 안 됨 | save 콜백·행 키/버전·성공 응답 구조 확인. 조회 콜백만 있으면 읽기 전용 |
| 모달·SPA 화면 재진입 오류 | 제거 시 destroy 호출, 재진입 시 빈 컨테이너에 재생성 |

더 많은 옵션/메서드는 [API 문서](../packages/grid/README.md), 목적별 실행 파일은 [예제 목록](../examples/README.md)에 있습니다. 현재 라이브러리는 초기 구현이며 [지원 범위와 검증 한계](verification.md)를 함께 확인하세요.
