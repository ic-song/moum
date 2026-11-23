# MOUM

[![Check](https://github.com/ic-song/moum/actions/workflows/check.yml/badge.svg)](https://github.com/ic-song/moum/actions/workflows/check.yml) [![Browser](https://github.com/ic-song/moum/actions/workflows/browser.yml/badge.svg)](https://github.com/ic-song/moum/actions/workflows/browser.yml) [MIT License](LICENSE)

**개발에 필요한 것들의 모음, MOUM.** 개인 도구, 교육·연구, 커뮤니티, 기업 시스템에서 필요한 기능을 골라 쓰는 범용 JavaScript 라이브러리입니다. 그리드·차트·간트·업로더·캘린더·날짜 선택·페이지네이션·무한 스크롤을 독립 패키지로 제공하며 오프라인에서도 사용할 수 있습니다.

한글 이름은 **모음**, 영문 브랜드는 **MOUM**입니다. 기존 Moa JS의 그리드 0.7.0과 독립 라이브러리 작업을 통합한 새 저장소입니다. [이름 전환 안내](docs/moum-migration.md)와 [검증 기록](docs/moum-verification.md)을 참고하세요.

| 패키지 | 버전 | 용도 | 예제 | API |
| --- | --- | --- | --- | --- |
| `@moum/grid` | 0.8.0 | 표 조회·편집·서버 연결·전체 검증·타입 | [그리드](examples/grid/index.html) | [문서](packages/grid/README.md) |
| `@moum/charts` | 0.4.0 | SVG 차트 10종·이중 축·보기 저장/복원·PNG | [차트](examples/charts/index.html) | [문서](packages/charts/README.md) |
| `@moum/gantt` | 0.6.0 | 일정·작업 계층·선후행·계획 대비 편차·미니 보기 | [간트](examples/gantt/index.html) | [문서](packages/gantt/README.md) |
| `@moum/uploader` | 0.4.0 | 파일 큐·용량/중복 정책·Worker 파싱·전송 | [업로더](examples/uploader/index.html) | [문서](packages/uploader/README.md) |
| `@moum/calendar` | 0.4.0 | 월/주/일/목록·반복·자원·보기 복원 | [캘린더](examples/calendar/index.html) | [문서](packages/calendar/README.md) |
| `@moum/datepicker` | 0.2.0 | 인라인/팝업·단일 날짜·기간·프리셋 | [날짜 선택](examples/datepicker/index.html) | [문서](packages/datepicker/README.md) |
| `@moum/pagination` | 0.2.0 | 페이지 직접 이동·URL/뒤로가기·서버 조회 | [페이지](examples/pagination/index.html) | [문서](packages/pagination/README.md) |
| `@moum/infinite-scroll` | 0.2.0 | 가상 목록·커서·위치 복원·세션 캐시 | [무한 스크롤](examples/infinite-scroll/index.html) | [문서](packages/infinite-scroll/README.md) |

[미니 간트 4종 예제](examples/gantt-mini/index.html) · [8개 컴포넌트 현황·고도화 범위·공통 UI/UX](docs/components.md)를 확인하세요.

DatePicker 팝업·복합/이중 축 차트·업무일 간트·Worker 파싱의 [고도화 검증 기록](docs/business-components-verification.md)을 제공합니다.

캘린더 회차 수정·기간 조회, 페이지 URL 복원, 가상 목록·위치/캐시는 [목록 탐색 고도화 검증](docs/navigation-components-verification.md)을 확인하세요.

각 패키지는 browser JS·ESM·CommonJS·CSS·라이선스를 포함하며 여덟 패키지 모두 TypeScript 선언을 제공합니다. 서로 런타임 의존성이 없고 npm 등록 전이므로 `npm pack ./packages/<이름>` 또는 파일 복사로 사용합니다. 각 패키지는 API 문서에 명시한 범위로 제공하며 서버 저장·인증은 호스트가 연결합니다.

코어는 외부 런타임 의존성·CDN·웹폰트·온라인 인증·텔레메트리 없이 실행합니다. XLSX 파일 기능에는 로컬 동봉한 SheetJS Community Edition을 선택적으로 사용합니다. 프레임워크와 분리된 JS·CSS 파일을 제공하며 MOUM 자체 코드는 상업적 사용과 수정·재배포가 가능한 MIT 라이선스입니다. 동봉 라이브러리는 [별도 Apache-2.0 라이선스](packages/grid/THIRD_PARTY_NOTICES.md)를 유지합니다.

그리드는 현재 **0.8.0**으로 미저장 작업 복구와 로컬/서버 페이징·무한 스크롤, 서버 편집·추가·삭제·저장과 Excel 범위 다운로드를 제공합니다. A1 수식·그룹/트리·공개 API 일부 이행 계층도 포함합니다. RealGrid 공식 기능을 참고해 자체 구현하며 원본 코드·리소스를 포함하지 않습니다. RealGrid 전체 기능·API와의 호환성을 보장하지 않습니다. npm에는 아직 등록하지 않았습니다. 새 패키지 간 연결은 [모듈 연결 안내](docs/suite-integration.md)를 참고하세요.

## 다른 프로젝트에서 시작하기

폐쇄망에는 8개 tgz, 브라우저 파일, 예제, 라이선스를 묶은 배포본 하나를 가져가면 됩니다. `npm run pack:offline`으로 생성하거나 GitHub Actions의 **Package** 작업에서 받으세요. [오프라인 배포본 사용법](docs/offline-kit.md)

MOUM Grid는 표 조회·편집·입력 검증·Excel 교환에 사용할 수 있습니다. `getColumnLayout()`과 `setColumnLayout()`으로 화면별 열 순서·표시 여부·너비를 저장하고 복원할 수 있습니다. [그리드 API](packages/grid/README.md) · [입력 검증과 TypeScript](docs/grid-validation-types.md)

`packages/grid/dist/moum-grid.js`와 `moum-grid.css`를 복사하고 비어 있는 요소에 생성합니다.

```html
<link rel="stylesheet" href="./moum-grid.css">
<div id="grid"></div>
<script src="./moum-grid.js"></script>
<script>
  const grid = new MoumGrid('#grid', {
    columns: [
      { field: 'name', header: '품목' },
      { field: 'qty', header: '수량', type: 'number' }
    ],
    data: [{ name: '노트', qty: 10 }]
  });
</script>
```

| 사용할 환경 | 안내 |
| --- | --- |
| HTML·JSP / 파일 복사 | [빠른 시작](docs/getting-started.md) · [최소 실행 예제](examples/quick-start/index.html) |
| React·Vue / 로컬 tgz 설치 | [프레임워크 연결](docs/frameworks.md) · [React 컴포넌트](examples/react/ProductGrid.jsx) · [Vue 컴포넌트](examples/vue/ProductGrid.vue) |
| 서버 API·페이지·변경 저장 | [조회 계약](docs/server-data.md) · [저장 계약](docs/server-editing.md) |
| 새로고침·종료 후 미저장 복구 | [복구 설정과 보장 범위](docs/recovery.md) · [복구 예제](examples/recovery/index.html) |
| 전체 옵션과 목적별 예제 | [API](packages/grid/README.md) · [예제 목록](examples/README.md) |

다운로드한 배포 파일은 빌드 없이 사용합니다. LICENSE도 함께 배포하세요. Excel 셀 복사·붙여넣기에는 별도 모듈이 필요 없으며 `.xlsx` 파일 기능만 로컬 SheetJS를 선택적으로 추가합니다. 공개 npm 등록 전이므로 설치형 프로젝트에는 `npm pack ./packages/grid`로 만든 tgz를 사용합니다.

## 0.7.0에 추가한 기능

- 선택적으로 켜는 IndexedDB 임시 저장: 확정 데이터와 입력창의 미확정 값 복구
- 탭별 복구본·사용자/데이터 키·스키마 구분, 저장 오류 표시와 복구본 내려받기
- 서버 저장 요청 ID를 브라우저에 기록한 뒤 전송, 종료 후 원래 요청으로 결과 재확인
- 실제 Chrome 프로세스 종료/재실행, 2,000회 편집·25회 생성/제거 반복 검사
- [기여 가이드](CONTRIBUTING.md), [변경 기록](CHANGELOG.md), [보안](SECURITY.md)/[지원](SUPPORT.md), 이슈/PR 템플릿과 CI/수동 패키지 워크플로우

복구는 기본 비활성화이며 `recovery: {key: '사용자:업무:데이터', schemaVersion: '1'}`로 켭니다. 마지막 임시 저장 완료본을 복구하며 브라우저 데이터 삭제·기록 완료 전 종료·전원 장애의 무손실을 보장하지 않습니다. [전체 계약](docs/recovery.md)을 확인하세요.

## 0.6.0에 추가한 기능

- `dataSource.save` 연결 시 서버 셀 편집·Excel 붙여넣기·행 추가/삭제와 저장 전 Ctrl+Z/Y
- 추가·수정·삭제 묶음 저장, 변경 취소, 미저장 변경의 페이지/검색 이동 보호
- 서버 행 버전 충돌 검사, 요청 ID로 중복 저장 방지, 응답 단절 후 같은 요청으로 결과 재확인
- 재시작 후에도 행·저장 결과를 유지하는 [HTTP 편집 예제](examples/server-edit/index.html)
- [저장 계약과 연결 방법](docs/server-editing.md), 3개 브라우저 엔진의 실제 HTTP CRUD·오류 복구 검증

`node scripts/serve.mjs` 실행 후 `http://127.0.0.1:4173/examples/server-edit/index.html`에서 사용합니다. 예제는 로컬 JSON 파일에 저장하며, 실제 서비스의 인증·권한·DB 트랜잭션은 호스트 서버에 연결합니다.

## 0.5.0에 추가한 기능

- **서버 연동**: dataSource.load 콜백, offset/limit/total 기반 서버 페이징·무한 스크롤
- 서버 검색·정렬·필터, 요청 취소·최신 응답 보호, 중복 요청/키 검증·시간 초과·실패 재시도
- 읽어온/선택한 행 다운로드와 별도 exportRows를 이용한 서버 전체·필터 결과 Excel
- 실행 가능한 [HTTP 예제](examples/server/index.html)와 [서버 API 계약](docs/server-data.md)
- Chromium·Firefox·WebKit 서버 시나리오·자동 WCAG 검사, Firefox 한글 편집 Enter 처리 보완

서버 조회 예제는 저장소에서 `node scripts/serve.mjs`를 실행한 뒤 `http://127.0.0.1:4173/examples/server/index.html`에서 사용합니다. 이 예제는 조회 전용이며, 0.6.0의 별도 서버 편집 예제에서 변경 저장을 제공합니다. 운영 DB 연결은 아닙니다.

## 0.4.0에 추가한 기능

- **엑셀 다운로드**: 현재 페이지/불러온 행·검색정렬 결과·전체 데이터·선택 영역을 XLSX로 저장
- **표시 방식 선택**: 가상 스크롤 / 무한 스크롤 / 페이징을 툴바와 API로 전환
- **무한 스크롤**: 로컬 데이터를 하단에서 추가 표시, 더보기 버튼·종료 상태
- **페이징**: 행 수·처음/이전/다음/마지막·페이지 번호 이동, 검색/정렬 후 초기화
- 데이터·수식·Undo/Redo를 유지하며 전환. [사용 API와 범위](docs/data-modes.md)

## 0.3.0에 추가한 기능

- 행·열 가상 스크롤: 10만 행·200열 시나리오와 화면 밖 범위 조작 검증
- opt-in A1 수식: 참조·범위·13개 함수·계산 오류·Undo/Redo·XLSX 원문 보존
- `MoumRealGrid.LocalDataProvider`·`GridView` 공개 API 일부 이행과 공유 데이터/이력
- IME 조합 중 입력 DOM 유지·Enter/Tab 처리, 외부 데이터 변경 시 오래된 편집 방지
- [확장 예제](examples/advanced/index.html), [확장 API](docs/grid-advanced.md), [이행 지원표](docs/realgrid-api-subset.md)

## 앞서 추가한 Excel·고급 기능

- Excel 셀의 HTML+TSV 복사·붙여넣기: 쉼표 숫자·소수·한글·셀 내부 탭·줄바꿈
- 일반 모드에서 빈 표·마지막 행 이후 붙여넣기의 자동 행 확장과 한 번의 Undo/Redo
- 행 추가·선택 행 삭제·파일 교체 이력, AND/OR 조건 필터와 다중 컬럼 정렬
- 왼쪽 열 고정, 마우스·키보드 열 너비 조절
- 다단 행 그룹과 숫자 소계, ID·부모 ID 기반 트리와 자손 삭제
- 사각형 셀 병합·해제, 원본 값 보존과 병합 영역 Delete/Undo
- 로컬 XLSX 가져오기·내보내기와 가져오기 전체 Undo/Redo

범위와 차이는 [RealGrid 비교표](docs/realgrid-comparison.md), API는 [Grid README](packages/grid/README.md)에 정리했습니다.

## 바로 실행

저장소 ZIP을 받아 압축을 풀고 [examples/grid/index.html](examples/grid/index.html)을 브라우저에서 여세요. Node·npm·웹서버·인터넷 연결 없이 예제를 실행할 수 있습니다. 조직 브라우저 정책이 로컬 스크립트를 제한하면 같은 파일을 내부 웹서버에서 제공합니다.

기존 JSP·HTML 프로젝트에는 아래 두 파일을 복사합니다.

```html
<link rel="stylesheet" href="./moum-grid.css">
<div id="grid"></div>
<script src="./moum-grid.js"></script>
<script>
  const grid = new MoumGrid('#grid', {
    columns: [
      { field: 'code', header: '코드', editable: false },
      { field: 'name', header: '이름' },
      { field: 'quantity', header: '수량', type: 'number' }
    ],
    data: [{ code: 'A001', name: '품목', quantity: 10 }],
    onChange: ({ reason, changes, data }) => {
      // 로컬 모드의 변경 알림입니다. 필요한 저장 처리는 호스트에서 연결합니다.
      console.log(reason, changes);
    }
  });
</script>
```

배포 파일 위치: [packages/grid/dist](packages/grid/dist). ESM과 CommonJS도 제공합니다. XLSX 파일 기능을 쓰려면 [vendor/sheetjs](packages/grid/vendor/sheetjs)의 로컬 JS를 그리드보다 먼저 로드하세요. 복사·붙여넣기만 사용할 때는 이 선택 모듈이 필요하지 않습니다. 배포 파일 해시는 [SHA256SUMS.txt](packages/grid/SHA256SUMS.txt)에 있습니다.

## 셀 조작

| 조작 | 동작 |
| --- | --- |
| 드래그 / Shift+방향키 | 사각형 범위 선택·확장·축소 |
| Ctrl+C | 선택 영역을 엑셀과 교환 가능한 TSV로 복사 |
| Ctrl+V | 여러 셀 붙여넣기, 한 번에 검증·반영 |
| Delete / Backspace | 선택한 셀 값 지우기, 행은 보존 |
| Ctrl+Z | 붙여넣기·지우기·셀 편집을 작업 단위로 되돌리기 |
| Ctrl+Y / Ctrl+Shift+Z | 다시 실행 |
| F2 / 더블클릭 | 셀 편집, Enter 확정, Esc 취소 |
| Tab / Shift+Tab | 다음·이전 셀; 표의 첫·마지막 경계에서는 밖으로 이동 |

macOS는 Ctrl 대신 ⌘를 사용합니다. 셀 안에서 텍스트를 편집 중이면 복사·붙여넣기·실행 취소는 기본 입력창 동작을 유지합니다. 읽기 전용 컬럼은 보호하며, 잘못된 값·범위 초과가 있으면 붙여넣기 전체를 적용하지 않습니다. 자세한 정책은 [셀 조작 계약](docs/grid-interaction-contract.md)에 있습니다.

일반 모드에서는 행만 부족한 경우 자동으로 추가합니다. 그룹·트리·검색·조건 필터 상태의 행 범위 초과는 거부합니다. XLSX 가져오기는 헤더로 매핑한 데이터 전체 교체이며 Ctrl+Z/Y로 복원할 수 있습니다. 한글 composition 파이프라인과 Chromium·Firefox·WebKit의 핵심 조작을 검사했으며, 네이티브 IME·실제 스크린리더 수용시험은 남아 있습니다.

## 구현 대상과 개발 순서

- [기능 카탈로그](docs/feature-catalog.md): 공식 근거·구현 단계·상태·완료 판정이 있는 1차 기능 후보 목록
- [로드맵](docs/roadmap.md): 핵심 조작 → 업무 적용 → 고급 그리드 → 독립 모듈 확장
- [기계 판독 원본](docs/features.json): 기능 ID별 개발·검증 추적
- [검증 기록](docs/verification.md): 실행한 검사와 남은 제약

## 인터넷 없이 빌드·모델 테스트

Node.js 22 이상이 준비되어 있으면 코어 검사·빌드는 외부 패키지 설치 없이 실행합니다.

```sh
npm test
npm run build
npm run catalog -- --check
```

`npm run build`는 소스에서 브라우저 JS·ESM·CommonJS·CSS를 생성합니다. `npm run catalog`는 JSON 원본에서 기능 문서를 갱신합니다. 배포물은 저장소에 포함하므로 사용자가 빌드할 필요는 없습니다.

개발 도구는 `npm ci`로 설치하고 `npx playwright install chromium firefox webkit`으로 브라우저를 준비합니다. `npm run dev` 실행 후 별도 터미널에서 `npm run test:browser`, `npm run test:recovery`, `npm run test:resilience`, `npm run test:usage`를 사용합니다. 개발 의존성은 런타임 패키지에 포함하지 않습니다. 폐쇄망에서는 캐시/사내 레지스트리 또는 배포 파일을 반입하세요. [기여·검증 절차](CONTRIBUTING.md)와 [검증 기록](docs/verification.md)에 자세한 범위를 적었습니다.

## 현재 한계

로컬 변경의 업무 서버 저장은 호스트가 구현합니다. 복구를 켜면 브라우저에 임시 보관하며 업무 서버 저장과 구분합니다. 서버 변경 저장은 `dataSource.save`와 호스트의 원자적 저장·버전·중복 방지 계약이 필요합니다. 예제 서버의 JSON 저장은 운영 DB/인증을 대체하지 않습니다. 자동 같은 값 병합·피벗·전체 Excel 수식은 후속 구현 대상입니다. 그룹과 트리는 별도 모드이며 수동 병합은 가상 스크롤이 꺼진 일반 모드에서 사용합니다. 전체 브라우저·네이티브 한글 IME·실제 스크린리더 호환성을 인증한 단계는 아닙니다.

RealGrid는 기능 참고 대상의 제품명이며 이 프로젝트는 해당 제품과 제휴하지 않습니다. [MIT License](LICENSE)는 이 저장소의 자체 작성물에 적용됩니다.
