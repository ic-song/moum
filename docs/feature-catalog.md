# RealGrid 참고 기능 카탈로그

확인일: 2026-11-16 · 참고 릴리스: RealGrid2 2.10.2 (2026-10-22) · 총 171개 후보

공식 가이드 기반 1차 기능 후보 목록. 모든 API·옵션·버전 차이의 완전한 조사 또는 호환성 인증이 아님.

무료·폐쇄망용 독립 구현의 개발 후보다. 완료 판정은 **MOUM가 채택한 요구사항**이며 RealGrid의 모든 동작을 보증하는 문장이 아니다. 초기 구현은 소스 존재 상태로, 전체 브라우저·IME·스크린리더 검증 완료를 의미하지 않는다.

근거 구분: **본문 검토**는 주요 설명을 확인한 항목, **목차 확인**은 공식 기능 항목의 존재를 확인한 1차 후보, **자체 요구**는 사용자 요구 또는 MOUM 설계 제안이다. 목차 확인 항목은 착수 시 상세 API·제한사항을 추가 검토한다.

우선순위와 단계는 개발 제안이며 일정 약속이 아니다. 관련 제품 연동 후보는 Grid 기능 완성도 계산에서 제외한다.

| 단계 | 의미 | 항목 수 |
| --- | --- | ---: |
| M0 | 핵심 셀 조작 | 34 |
| M1 | 업무 적용 | 46 |
| M2 | 고급 그리드 | 51 |
| M3 | 특수 기능 | 34 |
| LATER | 독립 확장 후보 | 6 |

| 상태 | 항목 수 |
| --- | ---: |
| 초기 구현 | 51 |
| 일부 구현 | 21 |
| 계획 | 99 |

중요한 구분과 구현 순서는 [로드맵](roadmap.md), 사용자 지정 단축키는 [셀 조작 계약](grid-interaction-contract.md)을 참고한다.

## 기본 구성과 데이터

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| BASE-001 | 컬럼·필드 정의 | M0 | 초기 구현 | 중복 field 거부 및 읽기 전용 컬럼 설정 | [목차 확인](https://docs.realgrid.com/guides/column/set-column) |
| BASE-002 | 독립 데이터 모델 | M0 | 초기 구현 | UI와 분리된 모델에서 셀 변경과 이력 관리; 다중 뷰 공유는 후속 | [목차 확인](https://docs.realgrid.com/guides/fill-data/provider-sharing) |
| BASE-003 | JSON 객체 배열 입력 | M0 | 초기 구현 | 입력 배열을 직접 변경하지 않고 행 컨테이너 복사 | [목차 확인](https://docs.realgrid.com/guides/fill-data/load-json-data) |
| BASE-004 | 문자·숫자·불린 타입 | M0 | 초기 구현 | 편집 값의 타입 변환과 잘못된 입력 거부 | [목차 확인](https://docs.realgrid.com/guides/data-manager/data-type) |
| BASE-005 | 날짜·시간 타입 | M1 | 계획 | 저장 형식과 표시 형식 구분 및 유효 날짜 검사 | [목차 확인](https://docs.realgrid.com/guides/data-manager/datetime-field) |
| BASE-006 | Object 필드 | M2 | 계획 | 객체 값을 표시할 콜백과 복사 정책 정의 | [목차 확인](https://docs.realgrid.com/guides/data-manager/object-type) |
| BASE-007 | 서브타입 | M3 | 계획 | 하위 타입별 변환·검증 계약 작성 | [목차 확인](https://docs.realgrid.com/guides/data-manager/subtypes) |
| BASE-008 | XML 입력 | M3 | 계획 | XML 필드 매핑 및 파싱 오류 표시 | [목차 확인](https://docs.realgrid.com/guides/fill-data/load-xml-data) |
| BASE-009 | 행·셀 값 조회 및 변경 | M0 | 일부 구현 | 전체 조회와 모델 변경 구현; 공개 셀 단위 API 정리 필요 | [목차 확인](https://docs.realgrid.com/guides/crud/get-values) |
| BASE-010 | 행 추가·삽입 | M1 | 초기 구현 | 행 기본값과 추가·삽입을 지원하고 한 번의 Undo/Redo로 복원 | [목차 확인](https://docs.realgrid.com/guides/crud/insert) |
| BASE-011 | 행 삭제 | M1 | 초기 구현 | 표시 좌표를 원본 행으로 매핑하여 삭제; 트리 부모는 자손까지 한 번에 처리 | [목차 확인](https://docs.realgrid.com/guides/crud/delete) |
| BASE-012 | 행 단위 수정 | M1 | 계획 | 한 행의 여러 필드를 하나의 트랜잭션으로 변경 | [목차 확인](https://docs.realgrid.com/guides/crud/update) |
| BASE-013 | 행 변경 상태 | M1 | 일부 구현 | 서버 save 모드의 추가·수정·삭제 차이와 저장 후 기준점 재설정; RealGrid 행 상태 API·soft delete는 후속 | [본문 검토](https://docs.realgrid.com/guides/editing/row-states) |
| BASE-014 | 원본 롤백 | M1 | 초기 구현 | 로컬 recovery와 서버 save 모드에서 마지막 저장 기준점으로 취소. Undo와 별도 API 사용; RealGrid 교체 호환은 아님 | [목차 확인](https://docs.realgrid.com/guides/data-manager/data-rollback) |
| BASE-015 | 계산 필드 | M2 | 계획 | 콜백 기반 파생값 재계산 및 읽기 전용 처리 | [본문 검토](https://docs.realgrid.com/guides/data-manager/calc-field) |
| BASE-016 | Provider 공유 | M2 | 계획 | 두 그리드가 같은 모델을 구독하고 해제 후 누수 없음 | [목차 확인](https://docs.realgrid.com/guides/fill-data/provider-sharing) |
| BASE-017 | 마스터·디테일 | M2 | 계획 | 상위 선택으로 상세 데이터 교체; 미확정 편집 처리 | [목차 확인](https://docs.realgrid.com/guides/fill-data/master-detail) |
| BASE-018 | Lazy Loading 연동 | M2 | 계획 | 사용자 데이터 공급 콜백으로 다음 구간 로드 | [목차 확인](https://docs.realgrid.com/guides/fill-data/lazy-loading) |

## 포커스·선택·엑셀 조작

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| SELECT-001 | 마우스 드래그 범위 선택 | M0 | 초기 구현 | 사각형 범위를 표시하고 현재 셀과 선택 기준점 분리 | [목차 확인](https://docs.realgrid.com/guides/grid-components/selecting) |
| SELECT-002 | Shift+방향키 범위 확장 | M0 | 초기 구현 | 선택 기준점을 유지하며 확장·축소 | [본문 검토](https://docs.realgrid.com/tutorial/defaultKeyboardAndMouseControll) |
| SELECT-003 | 방향키·Tab 셀 이동 | M0 | 초기 구현 | 셀 이동 및 표 경계에서 Tab으로 빠져나가기 | [본문 검토](https://docs.realgrid.com/tutorial/defaultKeyboardAndMouseControll) |
| SELECT-004 | Home·End 이동 | M0 | 초기 구현 | 행 시작·끝 및 Ctrl 조합으로 데이터 시작·끝 이동 | [본문 검토](https://docs.realgrid.com/tutorial/defaultKeyboardAndMouseControll) |
| SELECT-005 | 현재 셀 포커스 표시 | M0 | 초기 구현 | 활성 셀 한 곳만 tabIndex 0 유지 | [목차 확인](https://docs.realgrid.com/guides/grid-components/focused) |
| SELECT-006 | 전체 선택 | M0 | 초기 구현 | 그리드 내부 Ctrl+A로 표시된 데이터 선택 | [목차 확인](https://docs.realgrid.com/guides/grid-components/selecting) |
| SELECT-007 | 여러 독립 영역 선택 | M2 | 계획 | Ctrl 선택 영역의 복사·삭제 순서 명세화 | [목차 확인](https://docs.realgrid.com/guides/grid-components/multi-selection) |
| SELECT-008 | 행 체크바 | M1 | 계획 | 셀 범위 선택과 독립된 행 체크 상태 관리 | [목차 확인](https://docs.realgrid.com/guides/grid-components/check-bar) |
| SELECT-009 | 체크바·필드 연결 | M2 | 계획 | 체크 상태와 데이터 필드 양방향 동기화 | [목차 확인](https://docs.realgrid.com/guides/grid-components/check-bar-link-field) |
| SELECT-010 | 행 번호 표시 | M0 | 초기 구현 | 정렬·검색 후 화면 순서 기준 번호 표시 | [목차 확인](https://docs.realgrid.com/guides/grid-components/indicator) |
| SELECT-011 | 행 상태 표시바 | M1 | 계획 | 추가·수정·삭제 표시와 텍스트 대체 정보 | [목차 확인](https://docs.realgrid.com/guides/grid-components/state-bar) |
| SELECT-012 | 범위 복사 Ctrl+C | M0 | 초기 구현 | 선택 사각형을 탭·줄바꿈 형식으로 복사 | [본문 검토](https://docs.realgrid.com/guides/editing/copy-and-paste) |
| SELECT-013 | 범위 붙여넣기 Ctrl+V | M0 | 초기 구현 | 등록·편집 그리드에서 직사각형 데이터를 한 작업으로 적용 | [본문 검토](https://docs.realgrid.com/guides/editing/copy-and-paste) |
| SELECT-014 | 선택 영역 Delete | M0 | 초기 구현 | 선택 셀 값만 비우고 행과 읽기 전용 값 보존 | [목차 확인](https://docs.realgrid.com/refs/Class/GridBase) |
| SELECT-015 | 붙여넣기·삭제 Undo | M0 | 초기 구현 | Ctrl+Z 한 번으로 다중 셀 작업 전체 복원 | [본문 검토](https://docs.realgrid.com/guides/editing/undo) |
| SELECT-016 | Redo Ctrl+Y | M0 | 초기 구현 | Undo된 작업 전체 재적용; 새 편집 시 재실행 이력 제거 | [본문 검토](https://docs.realgrid.com/guides/editing/undo) |
| SELECT-017 | 엑셀 TSV 특수문자 | M0 | 초기 구현 | 한글·따옴표·셀 내부 줄바꿈·탭·빈 셀 왕복 보존 | [본문 검토](https://docs.realgrid.com/guides/editing/copy-and-paste) |
| SELECT-018 | 드래그 행 재배치 | M2 | 계획 | 정렬·필터 상태에서 원본 행 순서 정책 명시 | [목차 확인](https://docs.realgrid.com/guides/drag-and-drop/row-drag-and-drop) |
| SELECT-019 | 그리드 간 이동·복사 | M3 | 계획 | 필드 매핑과 이동 취소를 정의 | [목차 확인](https://docs.realgrid.com/guides/drag-and-drop/grid-to-grid) |
| SELECT-020 | 외부 영역으로 드래그 | M3 | 계획 | 사용자 drop 콜백과 데이터 계약 제공 | [목차 확인](https://docs.realgrid.com/guides/drag-and-drop/grid-to-div) |

## 편집기와 검증

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| EDIT-001 | 텍스트 편집 | M0 | 초기 구현 | F2·더블클릭·문자 입력으로 진입; Enter 확정·Esc 취소 | [목차 확인](https://docs.realgrid.com/guides/editor/text-editor) |
| EDIT-002 | 숫자 편집 | M0 | 초기 구현 | 숫자 변환과 비유한 값 거부; 정교한 표시 마스크는 후속 | [목차 확인](https://docs.realgrid.com/guides/editor/number-editor) |
| EDIT-003 | 읽기 전용 그리드·컬럼 | M0 | 초기 구현 | Delete·붙여넣기·직접 편집 모두 같은 보호 규칙 사용 | [목차 확인](https://docs.realgrid.com/guides/column/column-properties) |
| EDIT-004 | 멀티라인 편집기 | M1 | 계획 | 셀 내부 줄바꿈 입력과 편집 확정 단축키 분리 | [목차 확인](https://docs.realgrid.com/guides/editor/multiline-editor) |
| EDIT-005 | 드롭다운 편집기 | M1 | 계획 | 코드·레이블 분리 및 키보드 선택 | [목차 확인](https://docs.realgrid.com/guides/editor/dropdown-editor) |
| EDIT-006 | 다중선택 드롭다운 | M2 | 계획 | 여러 선택값의 저장·표시·복사 형식 정의 | [목차 확인](https://docs.realgrid.com/guides/editor/dropdown-multi-selection) |
| EDIT-007 | 날짜 편집기 | M1 | 계획 | 로컬 달력과 키보드 입력; 외부 요청 없음 | [목차 확인](https://docs.realgrid.com/guides/editor/date-editor) |
| EDIT-008 | 마스크 편집기 | M2 | 계획 | 입력 패턴과 빈 자리 처리 | [목차 확인](https://docs.realgrid.com/guides/editor/mask-editor) |
| EDIT-009 | 입력 문자 제한 | M1 | 계획 | 붙여넣기와 IME 조합 완료 시 동일한 제한 적용 | [목차 확인](https://docs.realgrid.com/guides/editor/line-cell-editor) |
| EDIT-010 | 동적 목록 편집기 | M2 | 계획 | 행 값에 따라 선택 목록 갱신 | [목차 확인](https://docs.realgrid.com/guides/editor/list-callback) |
| EDIT-011 | 동적 편집기 전환 | M2 | 계획 | 셀별 편집기 결정 및 생성·해제 수명 관리 | [목차 확인](https://docs.realgrid.com/guides/tip/dynamic-editor) |
| EDIT-012 | 컬럼 사용자 검증 | M0 | 초기 구현 | 검증 오류 시 값 반영 차단 및 오류 안내 | [본문 검토](https://docs.realgrid.com/guides/validation/custom-column-validation) |
| EDIT-013 | 행 사용자 검증 | M1 | 일부 구현 | 여러 필드 조합을 검증한 뒤 확정 | [목차 확인](https://docs.realgrid.com/guides/validation/custom-row-validation) |
| EDIT-014 | 전체 데이터 검증 | M1 | 일부 구현 | 오류 셀 목록과 첫 오류 위치 이동 제공 | [목차 확인](https://docs.realgrid.com/guides/validation/check-validation) |
| EDIT-015 | 오류·경고 확정 수준 | M2 | 계획 | 경고 허용과 오류 차단 규칙 분리 | [목차 확인](https://docs.realgrid.com/guides/validation/commit-level-validation) |
| EDIT-016 | 병합 셀 일괄 편집 | M3 | 계획 | 병합된 실제 대상 행 전체를 한 작업으로 수정 | [목차 확인](https://docs.realgrid.com/guides/editing/edit-merge) |

## 컬럼·레이아웃·병합

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| COLUMN-001 | 컬럼 표시·편집 속성 변경 | M1 | 계획 | 실행 중 숨김·읽기 전용 변경 후 선택 유효성 보장 | [목차 확인](https://docs.realgrid.com/guides/column/column-properties) |
| COLUMN-002 | 컬럼 너비 변경 | M1 | 초기 구현 | 마우스 및 키보드로 64~1000px 열 너비 조절 | [목차 확인](https://docs.realgrid.com/guides/column/column-resizing) |
| COLUMN-003 | 컬럼 너비 자동 맞춤 | M1 | 계획 | 헤더·표본 데이터 기반 너비 산정 | [목차 확인](https://docs.realgrid.com/guides/column/grid-fitting) |
| COLUMN-004 | 컬럼 순서 변경 | M1 | 계획 | 화면 순서 변경 후 원본 필드와 클립보드 대응 유지 | [목차 확인](https://docs.realgrid.com/guides/column/column-moving) |
| COLUMN-005 | 열 고정 | M1 | 일부 구현 | 왼쪽 열 고정 구현; 오른쪽 열·고정 영역별 권한 설정은 후속 | [목차 확인](https://docs.realgrid.com/guides/grid-components/fixed-columns) |
| COLUMN-006 | 행 고정 | M2 | 계획 | 세로 스크롤·편집·집계와 고정 행 정합성 | [목차 확인](https://docs.realgrid.com/guides/grid-components/fixed-rows) |
| COLUMN-007 | 그룹 헤더 | M1 | 계획 | 다단 헤더의 열 범위와 읽기 순서 보장 | [본문 검토](https://docs.realgrid.com/guides/column/layout) |
| COLUMN-008 | 한 레코드 다중행 레이아웃 | M3 | 계획 | 세로 레이아웃에서 이동·복사 좌표 계약 정의 | [본문 검토](https://docs.realgrid.com/guides/column/layout) |
| COLUMN-009 | 레이아웃 동적 변경 | M2 | 계획 | 잘못된 레이아웃 거부 시 이전 레이아웃 유지 | [목차 확인](https://docs.realgrid.com/guides/column/layout-properties) |
| COLUMN-010 | 그룹 컬럼 접기·펼치기 | M2 | 계획 | 접기 후 활성 셀과 너비 재계산 | [목차 확인](https://docs.realgrid.com/guides/column/layout-expand) |
| COLUMN-011 | 레이아웃 추가·제거 | M3 | 계획 | 필드 데이터 보존하며 표현만 변경 | [목차 확인](https://docs.realgrid.com/guides/column/layout-add-remove) |
| COLUMN-012 | 상수 컬럼 | M2 | 계획 | 필드 없이 고정 텍스트 표시 | [목차 확인](https://docs.realgrid.com/guides/column/literal-column) |
| COLUMN-013 | 같은 값 세로 병합 | M2 | 계획 | 정렬·필터 후 병합 범위 다시 계산 | [목차 확인](https://docs.realgrid.com/guides/cell-components/cell-merging) |
| COLUMN-014 | 가로 병합 | M3 | 계획 | 병합 범위의 선택·편집·복사 정책 고정 | [목차 확인](https://docs.realgrid.com/guides/column/layout-span-callback) |
| COLUMN-015 | 같은 값 반복 표시 생략 | M2 | 계획 | 원본 값과 표시 생략 구분 | [목차 확인](https://docs.realgrid.com/guides/cell-components/blank-cell) |
| COLUMN-016 | 병합 조건 콜백 | M3 | 계획 | 셀 값 외 조건으로 병합 가능 | [목차 확인](https://docs.realgrid.com/guides/tip/merge-callback) |

## 정렬·필터·검색·페이지

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| QUERY-001 | 단일 컬럼 정렬 | M0 | 초기 구현 | 숫자·문자 정렬과 빈 값 처리; 원본 인덱스 보존 | [목차 확인](https://docs.realgrid.com/guides/column/column-sorting) |
| QUERY-002 | 다중 컬럼 정렬 | M1 | 초기 구현 | Shift+헤더 클릭 및 API로 정렬 우선순위·방향 표시 | [목차 확인](https://docs.realgrid.com/guides/column/column-sorting) |
| QUERY-003 | 고유값 자동 필터 | M1 | 계획 | 필드의 고유값을 목록으로 선택 | [목차 확인](https://docs.realgrid.com/guides/column/column-auto-filtering) |
| QUERY-004 | 조건 필터 | M1 | 초기 구현 | 포함·일치·수치 비교·범위·빈 값 및 전체 조건 AND/OR 연결; RealGrid 컬럼별 논리와 차이 | [본문 검토](https://docs.realgrid.com/guides/column/column-filtering) |
| QUERY-005 | 필터 패널 | M2 | 계획 | 조건 추가·해제·초기화 화면 | [목차 확인](https://docs.realgrid.com/guides/column/column-filter-panel) |
| QUERY-006 | 필터 목록 순서 | M2 | 계획 | 표시 순서와 빈 값 위치 제어 | [목차 확인](https://docs.realgrid.com/guides/column/filter-selector-data-order) |
| QUERY-007 | 전체 문자열 검색 | M0 | 초기 구현 | 현재 구현은 전체 열 포함 검색; RealGrid 검색 API와는 별도 | [목차 확인](https://docs.realgrid.com/guides/data-manager/search-item) |
| QUERY-008 | 셀 검색·다음 결과 이동 | M1 | 계획 | 대소문자·부분일치·역방향·순환 검색 | [목차 확인](https://docs.realgrid.com/guides/data-manager/search-item) |
| QUERY-009 | 로컬 페이징 | M1 | 초기 구현 | 로컬 표시행 페이징·페이지 크기/번호 이동·원본 매핑·마지막 페이지 삭제 보정·선택/Undo 검증 | [목차 확인](https://docs.realgrid.com/guides/paging/paging1) |
| QUERY-010 | 서버 페이징 연동 | M2 | 초기 구현 | 조회전용 서버 offset/limit/total·검색/정렬/필터·취소/최신응답·재시도·시간초과·페이지보정, 실제HTTP 검증 | [목차 확인](https://docs.realgrid.com/guides/paging/paging3) |

## 헤더·푸터·그룹·집계

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| SUMMARY-001 | 헤더 높이·다중행 | M1 | 계획 | 긴 헤더와 행 높이 변경에도 본문 정렬 유지 | [목차 확인](https://docs.realgrid.com/guides/header-and-footer/header-height) |
| SUMMARY-002 | 헤더 전체 체크 | M1 | 계획 | 전체·일부·해제 상태와 필터 대상 정책 | [목차 확인](https://docs.realgrid.com/guides/header-and-footer/header-checkbox) |
| SUMMARY-003 | 컬럼 푸터 집계 | M1 | 계획 | 합계·평균·개수·최솟값·최댓값 제공 | [목차 확인](https://docs.realgrid.com/guides/header-and-footer/column-footer) |
| SUMMARY-004 | 푸터 병합 | M2 | 계획 | 병합 경계와 집계 위치 일치 | [목차 확인](https://docs.realgrid.com/guides/header-and-footer/footer-user-spans) |
| SUMMARY-005 | 상단 요약 | M2 | 계획 | 필터·편집 후 재계산 | [목차 확인](https://docs.realgrid.com/guides/header-and-footer/header-summary) |
| SUMMARY-006 | 헤더·푸터 템플릿 | M3 | 계획 | 직접 DOM 렌더 콜백과 키보드·수명 계약 | [목차 확인](https://docs.realgrid.com/guides/header-and-footer/header-template) |
| SUMMARY-007 | 다단 행 그룹 | M2 | 초기 구현 | 복수 필드 계층 그룹과 접기·펼치기 | [본문 검토](https://docs.realgrid.com/guides/row-group/row-grouping) |
| SUMMARY-008 | 그룹 API·이벤트 | M2 | 일부 구현 | 그룹 설정 API와 UI 접기·펼치기 구현; 취소·전후 이벤트 계약은 후속 | [목차 확인](https://docs.realgrid.com/guides/row-group/grouping-api) |
| SUMMARY-009 | 그룹별 소계·다중 푸터 | M2 | 일부 구현 | 그룹별 숫자 합계 구현; 다중 푸터와 사용자 집계는 후속 | [본문 검토](https://docs.realgrid.com/guides/row-group/row-grouping) |
| SUMMARY-010 | 행 병합 그룹 | M3 | 계획 | 계층 그룹과 다른 병합 표시 모드 | [목차 확인](https://docs.realgrid.com/guides/row-group/merged-row-grouping) |
| SUMMARY-011 | 행 높이 조절·자동 높이 | M2 | 계획 | 줄바꿈과 사용자 크기 변경 후 스크롤 오차 없음 | [목차 확인](https://docs.realgrid.com/guides/row-group/row-height) |
| SUMMARY-012 | 데이터에 맞는 그리드 높이 | M2 | 계획 | 최대 높이와 내부 스크롤 경계 제어 | [목차 확인](https://docs.realgrid.com/guides/row-group/sync-grid-height) |

## 셀 렌더러와 표시

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| RENDER-001 | 안전한 텍스트 렌더 | M0 | 초기 구현 | 데이터를 HTML로 해석하지 않고 문자로 표시 | [목차 확인](https://docs.realgrid.com/guides/renderer/text-renderer) |
| RENDER-002 | 체크박스 렌더 | M1 | 계획 | 불린 값의 키보드 전환과 Undo 연동 | [목차 확인](https://docs.realgrid.com/guides/renderer/check-renderer) |
| RENDER-003 | 다중 체크 렌더 | M2 | 계획 | 개별 체크 상태와 편집 계약 | [목차 확인](https://docs.realgrid.com/guides/renderer/multicheck-renderer) |
| RENDER-004 | 바 렌더 | M2 | 계획 | 최솟값·최댓값과 텍스트 대체 정보 | [목차 확인](https://docs.realgrid.com/guides/renderer/bar-renderer) |
| RENDER-005 | 이미지 렌더 | M2 | 계획 | 로컬 리소스와 로딩 실패 대체 표시 | [목차 확인](https://docs.realgrid.com/guides/renderer/image-renderer) |
| RENDER-006 | 아이콘 렌더 | M2 | 계획 | 사용자 로컬 아이콘과 레이블 매핑 | [목차 확인](https://docs.realgrid.com/guides/renderer/icon-renderer) |
| RENDER-007 | 도형·시그널 렌더 | M3 | 계획 | 의미 있는 대체 텍스트 제공 | [목차 확인](https://docs.realgrid.com/guides/renderer/shape-renderer) |
| RENDER-008 | 링크 렌더 | M2 | 계획 | 허용 프로토콜과 키보드 활성화 | [목차 확인](https://docs.realgrid.com/guides/renderer/link-renderer) |
| RENDER-009 | 성과·목표 렌더 | M3 | 계획 | 목표 대비 실적 표현과 수치 제공 | [목차 확인](https://docs.realgrid.com/guides/renderer/actual-target-renderer) |
| RENDER-010 | HTML·커스텀 렌더 | M2 | 계획 | DOM 생성 콜백·갱신·해제 수명 계약 | [목차 확인](https://docs.realgrid.com/guides/renderer/class-custom-renderer) |
| RENDER-011 | 바코드 렌더 | M3 | 계획 | 지원 규격별 인코딩과 로컬 출력 | [목차 확인](https://docs.realgrid.com/guides/renderer/barcode-renderer) |
| RENDER-012 | 시리즈·스파크 컬럼 | M3 | 계획 | 셀 안의 시계열과 데이터 대체 텍스트 | [목차 확인](https://docs.realgrid.com/guides/series/spark-column) |
| RENDER-013 | Lookup 코드·표시값 | M1 | 계획 | 저장은 코드·화면은 레이블; 붙여넣기 변환 명세 | [목차 확인](https://docs.realgrid.com/guides/cell-components/lookup-column) |
| RENDER-014 | Lookup 트리 | M3 | 계획 | 계층 코드 목록 탐색과 선택 | [목차 확인](https://docs.realgrid.com/guides/cell-components/lookup-tree) |
| RENDER-015 | 표시값 콜백·포맷 | M1 | 계획 | 원본·화면·복사·내보내기 값 구분 | [목차 확인](https://docs.realgrid.com/guides/cell-components/display-value) |
| RENDER-016 | 셀·그룹 헤더 툴팁 | M1 | 계획 | 포커스와 마우스 모두로 내용 접근 | [목차 확인](https://docs.realgrid.com/guides/cell-components/tooltip) |
| RENDER-017 | 셀 버튼·팝업 버튼 | M2 | 계획 | 키보드 실행과 클릭 이벤트 분리 | [목차 확인](https://docs.realgrid.com/guides/cell-components/cell-button) |
| RENDER-018 | Placeholder | M2 | 계획 | 빈 값 안내가 실제 데이터에 저장되지 않음 | [목차 확인](https://docs.realgrid.com/guides/cell-components/place-holder) |

## 트리 그리드

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| TREE-001 | 트리 데이터 모델·뷰 | M2 | 초기 구현 | ID·부모 ID 기반 트리와 셀 편집 | [본문 검토](https://docs.realgrid.com/guides/tree/tree-view) |
| TREE-002 | 배열·객체 트리 입력 | M2 | 일부 구현 | 부모 키가 있는 평면 배열 입력 구현; 중첩 Object 입력은 후속 | [목차 확인](https://docs.realgrid.com/guides/tree/tree-array-data) |
| TREE-003 | XML 트리 입력 | M3 | 계획 | XML 노드 매핑과 중복 키 검사 | [목차 확인](https://docs.realgrid.com/guides/tree/tree-xml-data) |
| TREE-004 | 노드 추가·삭제·펼침 | M2 | 초기 구현 | 노드 추가·자손 포함 삭제·접기·펼치기 및 데이터 Undo | [목차 확인](https://docs.realgrid.com/guides/tree/tree-node-control) |
| TREE-005 | 트리 아이콘·템플릿 | M3 | 계획 | 접힘·펼침·리프의 로컬 시각 표시 | [목차 확인](https://docs.realgrid.com/guides/tree/tree-template) |
| TREE-006 | 트리 이벤트·노드 조회 | M2 | 일부 구현 | ID·부모·자식 모델과 공통 변경 콜백 제공; 전용 취소 이벤트는 후속 | [목차 확인](https://docs.realgrid.com/guides/tree/tree-event) |
| TREE-007 | 트리 지연 로드 | M3 | 계획 | 펼칠 때 호스트가 자식 데이터 공급 | [목차 확인](https://docs.realgrid.com/guides/tree/tree-lazy-loading) |
| TREE-008 | 노드 이동 | M3 | 계획 | 자기 하위 이동 방지와 부모 변경 | [목차 확인](https://docs.realgrid.com/guides/tree/tree-node-move) |
| TREE-009 | 하위 노드 집계 | M3 | 계획 | 자손 합계의 편집 후 갱신 | [목차 확인](https://docs.realgrid.com/guides/tree/tree-subnode-calculation) |
| TREE-010 | Expander 컬럼 | M3 | 초기 구현 | labelField로 트리 expander를 표시할 컬럼 지정 | [목차 확인](https://docs.realgrid.com/guides/tree/tree-expander-column) |
| TREE-011 | 부모·자식 체크 연동 | M3 | 계획 | 부분 체크와 비활성 노드 정책 | [목차 확인](https://docs.realgrid.com/guides/tip/tree-check-bar) |
| TREE-012 | 계층 정렬·필터 | M3 | 초기 구현 | 형제 정렬·계층 유지; 검색·필터 시 상위 경로 보존은 RealGrid 기본 동작과 차이 | [본문 검토](https://docs.realgrid.com/guides/tree/tree-view) |

## 엑셀·파일 교환

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| EXPORT-001 | XLSX 내보내기 | M1 | 초기 구현 | 로컬 XLSX 다운로드: 현재 페이지/불러온 행·검색정렬 결과·전체·선택 범위, 숫자/한글/빈 결과·오프라인 검증 | [본문 검토](https://docs.realgrid.com/guides/excels/excel-export) |
| EXPORT-002 | XLSX 가져오기 | M1 | 초기 구현 | 로컬 파일 첫 시트 또는 지정 시트, 헤더 매핑·타입·검증·전체 Undo/Redo | [본문 검토](https://docs.realgrid.com/guides/tip/excel-import) |
| EXPORT-003 | 그룹·소계 내보내기 | M2 | 계획 | 그룹 구조와 집계값 보존 | [목차 확인](https://docs.realgrid.com/guides/excels/row-group-export) |
| EXPORT-004 | 복합 레이아웃 내보내기 | M3 | 계획 | 다단 헤더·병합 범위 보존 | [목차 확인](https://docs.realgrid.com/guides/excels/layout-export) |
| EXPORT-005 | 여러 그리드·시트 내보내기 | M2 | 계획 | 시트명 검증과 데이터 구간 구분 | [목차 확인](https://docs.realgrid.com/guides/excels/multi-export) |
| EXPORT-006 | 문서 제목·사용자 셀 | M2 | 계획 | 제목·주석 데이터와 표 시작 위치 지정 | [목차 확인](https://docs.realgrid.com/guides/excels/document-title-export) |
| EXPORT-007 | 엑셀 서식 | M2 | 계획 | 숫자·날짜·색상·테두리와 표시값 구분 | [목차 확인](https://docs.realgrid.com/guides/excels/export-style) |
| EXPORT-008 | 이미지·도형 내보내기 | M3 | 계획 | 로컬 이미지 포함과 위치·크기 보존 | [목차 확인](https://docs.realgrid.com/guides/excels/image-export) |
| EXPORT-009 | 시트 보호 | M3 | 계획 | 셀 잠금과 시트 옵션; 암호화와 구분 | [목차 확인](https://docs.realgrid.com/guides/excels/sheet-protection) |
| EXPORT-010 | 셀 메모 내보내기 | M3 | 계획 | 메모 본문과 셀 위치 보존 | [목차 확인](https://docs.realgrid.com/guides/excels/excel-memo) |
| EXPORT-011 | 수식 내보내기 | M3 | 일부 구현 | opt-in A1 수식·계산 캐시 XLSX 출력, 헤더 참조 변환·동일 컬럼 순서 가져오기; 전체 Excel 문법·스타일 미지원 | [목차 확인](https://docs.realgrid.com/guides/excels/excel-formula) |

## 개인화·이벤트·테마

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| STYLE-001 | 컨텍스트 메뉴 | M1 | 계획 | 키보드 열기·닫기와 비활성 항목 | [목차 확인](https://docs.realgrid.com/guides/grid-components/context-menu) |
| STYLE-002 | 알림·로딩 표시 | M1 | 일부 구현 | 현재 상태·오류 안내 구현; 비동기 로딩 API는 후속 | [목차 확인](https://docs.realgrid.com/guides/grid-components/toast-view) |
| STYLE-003 | 로케일 | M1 | 계획 | 문구·날짜·숫자 형식을 호스트에서 지정 | [목차 확인](https://docs.realgrid.com/guides/setting/locale) |
| STYLE-004 | CSS 테마 | M0 | 일부 구현 | 현재 CSS 변수 테마 구현; 여러 테마·전환은 후속 | [목차 확인](https://docs.realgrid.com/guides/grid-style/themes) |
| STYLE-005 | 행·셀 동적 스타일 | M1 | 계획 | 값·행 상태별 클래스 지정 | [목차 확인](https://docs.realgrid.com/guides/grid-style/cell-dynamic-style) |
| STYLE-006 | 영역별 스타일 | M1 | 일부 구현 | 기본 CSS 분리 완료; 공개 스타일 계약 정리 필요 | [목차 확인](https://docs.realgrid.com/guides/grid-style/realgrid-2-custom-styles-0-intro) |
| STYLE-007 | 개인화 저장·복원 | M2 | 일부 구현 | 컬럼·정렬·필터 상태 직렬화와 버전 처리 | [목차 확인](https://docs.realgrid.com/guides/personal/personal) |
| STYLE-008 | 이벤트 순서 | M1 | 일부 구현 | 현재 onChange·onSelectionChange 제공; 취소·사전 이벤트 정리 필요 | [목차 확인](https://docs.realgrid.com/guides/events/event-order) |
| STYLE-009 | 클릭·렌더 완료 이벤트 | M1 | 계획 | 데이터 좌표와 화면 좌표 구분 | [목차 확인](https://docs.realgrid.com/guides/events/click-event) |
| STYLE-010 | 복수 그리드 스크롤 동기화 | M3 | 계획 | 재귀 이벤트와 서로 다른 행 높이 처리 | [목차 확인](https://docs.realgrid.com/guides/events/scroll-event) |
| STYLE-011 | 접근성 | M0 | 일부 구현 | 키보드·ARIA·상태 안내, 3엔진 서버화면 자동WCAG검사; 네이티브 IME·실제스크린리더 추가수용시험 | [본문 검토](https://docs.realgrid.com/tutorial/realgrid-webaccessbility) |
| STYLE-012 | 대량 데이터 성능 | M2 | 일부 구현 | 10만 행×12열 및 1천 행×200열 Chromium 실측·가상 DOM 수 검사; 전체 메모리·다른 엔진·서버 공급 후속 | [본문 검토](https://docs.realgrid.com/guides/performance/large-data-load-test) |
| STYLE-013 | React 연동 | M2 | 계획 | 마운트·갱신·언마운트와 StrictMode 해제 계약 | [목차 확인](https://docs.realgrid.com/tutorial/react-tutorial/on-initialized) |
| STYLE-014 | Vue 연동 | M2 | 계획 | 반응형 데이터 갱신과 언마운트 해제 계약 | [목차 확인](https://docs.realgrid.com/tutorial/vue-tutorial/on-initialized) |
| STYLE-015 | RealGrid API 이행 어댑터 | M3 | 일부 구현 | 공개 API 일부 이행 계층·지원 인수 문서·공유 provider 회귀 검사; 전체 RealGrid 대조 시험·API 호환 아님 | [본문 검토](https://docs.realgrid.com/refs/Class/GridBase) |

## MOUM 추가 요구사항·확장 제안

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| EXT-001 | 폐쇄망 무통신 실행 | M0 | 초기 구현 | 기본 JS·CSS·예제에 CDN·외부 폰트·인증·텔레메트리 요청 없음 | 자체 요구 |
| EXT-002 | 오프라인 빌드·모델 테스트 | M0 | 초기 구현 | Node 내장 기능만으로 build와 test 실행; npm install 불필요 | 자체 요구 |
| EXT-003 | 전체 붙여넣기 원자성 | M0 | 초기 구현 | 잘못된 값·범위 초과가 하나라도 있으면 전체 반영 취소 | 자체 요구 |
| EXT-004 | 실행 취소 가능한 범위 지우기 | M0 | 초기 구현 | 읽기 전용 보호; 필수값 오류 시 전체 삭제 취소 | 자체 요구 |
| EXT-005 | CSV 내보내기 | M0 | 초기 구현 | UTF-8 BOM·따옴표·줄바꿈·수식 문자열 완화 처리 | 자체 요구 |
| EXT-006 | 가상 스크롤 | M2 | 초기 구현 | 200행/30열 초과 시 행·열 가상 렌더링, 고정 열·키보드·화면 밖 범위 조작; 고정 48px·수동 병합 제외 | 자체 요구 |
| EXT-007 | 선택 영역 채우기 핸들 | M3 | 계획 | 동일 값 복제와 연속값 채우기를 구분 | 자체 요구 |
| EXT-008 | 엑셀식 수식 엔진 | M3 | 일부 구현 | opt-in A1/$ 참조·범위·산술·비교·13개 함수·오류·Undo/Redo·XLSX; 주소 구조 자동 재작성·전체 Excel 문법 제외 | 자체 요구 |
| EXT-009 | TypeScript 타입 선언 | M1 | 초기 구현 | 공개 옵션·이벤트·좌표·변경 레코드의 타입 계약 | 자체 요구 |
| EXT-010 | 오프라인 배포 검증 | M1 | 초기 구현 | 배포 파일 SHA256SUMS·선택 의존성 라이선스·로컬 동봉·망 차단 검증 | 자체 요구 |
| EXT-011 | 성능·호환 회귀 스위트 | M1 | 일부 구현 | 단위·기존Chromium·실제Excel·서버HTTP 3엔진·자동WCAG검사; 전체기능 타엔진·네이티브IME·스크린리더는 후속 | 자체 요구 |
| EXT-012 | 패키지별 배포·독립 사용 | M0 | 일부 구현 | 현재 grid JS·CSS 독립 제공; npm 등록과 향후 모듈은 미실행 | 자체 요구 |
| EXT-013 | 폼·트리·다이얼로그 독립 모듈 | M3 | 계획 | 그리드 공통 코드의 실제 재사용 근거가 생길 때 패키지 분리 | 자체 요구 |
| EXT-014 | 붙여넣기 자동 행 확장 | M0 | 초기 구현 | 일반 무필터 모드에서 빈 표·마지막 행 이후 붙여넣기를 한 번에 적용·Undo/Redo | 자체 요구 |
| EXT-015 | 행·파일 단위 변경 이력 | M1 | 초기 구현 | 행 추가·삭제·XLSX 데이터 교체를 단일 트랜잭션으로 되돌리기·다시 실행 | 자체 요구 |
| EXT-016 | 수동 사각형 셀 병합 | M2 | 초기 구현 | 일반 모드에서 가로·세로 병합·해제; 숨겨진 데이터 보존과 붙여넣기 차단 | 자체 요구 |
| EXT-017 | 무한 스크롤·표시 방식 선택 | M1 | 초기 구현 | 로컬/서버 무한 스크롤·하단/더보기·중복요청/행키 보호·재시도/종료·가상화·표시방식 전환; 서버 저장 별도 | 자체 요구 |

## 별도 제품·연동 후보

| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |
| --- | --- | --- | --- | --- | --- |
| RELATED-001 | 피벗 분석 모듈 | LATER | 계획 | 별도 라이브러리 후보; Grid 기본 제공 기능으로 집계하지 않음 | [목차 확인](https://docs.realgrid.com/pivotguides/pivot-tutorial) |
| RELATED-002 | 차트 데이터 연동 | LATER | 계획 | 별도 chart 어댑터 후보; RealChart 코드를 포함하지 않음 | [목차 확인](https://docs.realgrid.com/guides/interface3/column-selecting) |
| RELATED-003 | 리포트 출력 연동 | LATER | 계획 | 별도 report 모듈 후보 | [목차 확인](https://docs.realgrid.com/guides/interface4/realgrid-realreport) |
| RELATED-004 | 지도 데이터 연동 | LATER | 계획 | 별도 map 어댑터 후보 | [목차 확인](https://docs.realgrid.com/guides/interface5/realgrid-realmap) |
| RELATED-005 | 색상 선택 편집 연동 | LATER | 계획 | 독립 color-picker 후보 | [목차 확인](https://docs.realgrid.com/guides/tip/color-picker) |
| RELATED-006 | 파일·이미지 드롭 | LATER | 계획 | 호스트의 파일 처리와 그리드 데이터 변경 분리 | [목차 확인](https://docs.realgrid.com/guides/tip/drag-and-drop) |

## 원본 자료와 유지 방법

- [공식 가이드](https://docs.realgrid.com/)와 각 행의 직접 링크를 기준으로 분류했다. 예전 [RealGridJS 데모](https://demo.realgrid.com/)는 별도 버전 자료이므로 현재 기능의 증거로 혼용하지 않았다.
- [공식 버전 기록](https://docs.realgrid.com/changelog/releases)을 확인했다. 사용자의 실제 적용 버전과 빌드는 아직 확인되지 않았다.
- `docs/features.json`이 원본이다. 수정 후 `npm run catalog`로 이 문서를 갱신한다. `npm run catalog -- --check`로 ID·분류·근거와 생성 문서의 일치 여부를 확인한다.
- 공식 구현 코드·라이선스 파일·상표 리소스를 복사하지 않았다. 이 카탈로그의 라이선스는 참조 제품의 코드나 문서에 권리를 부여하지 않는다.
