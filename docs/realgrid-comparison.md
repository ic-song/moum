# RealGrid 참고 기능과 현재 구현의 차이

기준: MOUM Grid 0.6.0 / 2026-11-16. **기능 범주와 조작 목적을 맞춘 독립 구현**이며 RealGrid 실행본과의 자동 대조 시험이나 전체 API 호환 인증은 하지 않았습니다. 기존 RealGrid JS 파일만 교체해서 기존 코드를 그대로 실행할 수 있는 상태는 아닙니다.

| 범주 | 현재 MOUM 구현 | 주요 차이·후속 범위 | 공식 참고 |
| --- | --- | --- | --- |
| 선택·이동 | 드래그·Shift+방향키·단일 사각형·Tab·Home/End | 비연속 영역·드래그 자동 스크롤·일부 고급 단축키 미구현 | [키보드·마우스](https://docs.realgrid.com/tutorial/defaultKeyboardAndMouseControll) |
| 복사·붙여넣기 | HTML+TSV, 한글·탭·줄바꿈·숫자, 일반 모드 행 확장 | 모든 copyOptions/pasteOptions를 구현하지 않음. 자체 검증 원자성·보호 규칙 사용 | [복사·붙여넣기](https://docs.realgrid.com/guides/editing/copy-and-paste) |
| Undo/Redo | Ctrl+Z/Y, 다중 셀·행·파일 교체 한 건 단위 | 모델·뷰의 옵션과 이벤트는 자체 API. 뷰 변환은 데이터 이력 밖 | [Undo/Redo](https://docs.realgrid.com/guides/editing/undo) |
| 행 CRUD | 추가·선택 행 삭제·트리 자손 삭제·이력, 서버 변경 묶음 저장·취소·버전 충돌/중복 방지 | 서버 save 모드만 저장 기준점 지원. RealGrid 행 상태 API·soft delete는 후속 | [행 상태](https://docs.realgrid.com/guides/editing/row-states) |
| 정렬 | Shift+헤더 다중 정렬·순위 표시·원본 인덱스 유지 | 이행 계층의 orderBy 기본 인수 지원, textCases 미지원 | [정렬](https://docs.realgrid.com/guides/column/column-sorting) |
| 필터 | 포함·일치·비교·범위·빈 값·전역 AND/OR | RealGrid는 같은 컬럼의 필터 OR·여러 컬럼 간 AND를 사용. 같은 API·논리 구조가 아님 | [필터](https://docs.realgrid.com/guides/column/column-filtering) |
| 고정·너비 | 왼쪽 열 고정·마우스/키보드 너비 조절 | 오른쪽 고정·행 고정·자동 맞춤·열 재배치 미구현 | [열 고정](https://docs.realgrid.com/guides/grid-components/fixed-columns), [너비](https://docs.realgrid.com/guides/column/column-resizing) |
| 그룹·소계 | 다단 그룹·접기/펼치기·숫자 합계 | 그룹 병합·다중 푸터·집계식·고급 이벤트는 후속 | [행 그룹](https://docs.realgrid.com/guides/row-group/row-grouping) |
| 셀 병합 | 일반 모드의 수동 사각형 병합·해제·값 보존 | RealGrid 같은 값 자동 병합·레이아웃 콜백·병합 그룹·병합 일괄 편집과 구분 | [셀 병합](https://docs.realgrid.com/guides/cell-components/cell-merging) |
| 트리 | 평면 ID/부모 ID·지정 expander 컬럼·자손 삭제·형제 정렬 | 중첩 Object/XML·지연 로딩·노드 드래그는 후속. 검색·필터는 상위 경로 보존; RealGrid의 부모 필터 제외 동작과 차이 | [트리](https://docs.realgrid.com/guides/tree/tree-view) |
| XLSX 가져오기 | 로컬 SheetJS·헤더 매핑·전체 검증·데이터 교체 Undo/Redo | UI는 첫 시트, API는 시트 지정 가능. opt-in A1 수식 일부 보존·계산, 동일 컬럼 순서 필요 | [가져오기 예제](https://docs.realgrid.com/guides/tip/excel-import) |
| XLSX 내보내기 | 실제 xlsx·기본 타입·열 너비·표시 수동 병합 | opt-in A1 원문·계산 캐시 지원. 복합 레이아웃·그룹 소계·이미지·보호·정교한 스타일은 후속 | [내보내기](https://docs.realgrid.com/guides/excels/excel-export) |
| 대량 데이터 | 행·열 가상화, 10만 행/200열 검사, 서버 offset/limit 페이징·무한 스크롤 | 고정 48px·수동 병합 제외. 무한 모드는 불러온 행을 메모리에 보관, 캐시 축출·cursor 전용 공급자는 후속 | [대량 데이터](https://docs.realgrid.com/guides/performance/large-data-load-test) |

기능 카탈로그의 **초기 구현**은 MOUM 자체 요구사항의 구현 상태입니다. 특정 기능명이 같다고 해서 RealGrid의 모든 옵션·기본값·메서드·콜백·이벤트 순서가 동일한 것은 아닙니다. 일부 항목은 공식 목차로 존재를 확인한 후보이며 상세 호환 계약을 아직 작성하지 않았습니다.

실제 비교 시험을 추가할 때는 대상 RealGrid 버전과 실제 프로젝트에서 사용하는 API 목록을 먼저 고정하고, 같은 데이터·설정·입력을 양쪽에 적용해 결과를 기록합니다. 현재 자동 검증은 MOUM 자체 모델·브라우저, 실제 Excel 생성 파일·복사 데이터와 로컬 배포물에 한정합니다. 검증한 범위는 [verification.md](verification.md)에 명시합니다.

0.3.0의 [공개 API 일부 이행 지원표](realgrid-api-subset.md)는 지원 메서드·인수와 미지원 오류를 정의합니다. 수식은 [독립 확장 API](grid-advanced.md)이며 RealGrid의 계산 필드/엑셀 수식 설정과 동일한 API가 아닙니다.

0.4.0은 자체 dataMode API로 가상/로컬 무한/로컬 페이징 전환과 Excel 범위 다운로드를 제공합니다. RealGrid setPaging API나 서버 요청을 구현한 것은 아닙니다. [자체 API](data-modes.md)를 확인하세요.

0.5.0의 [dataSource 계약](server-data.md)은 자체 서버 paging/infinite와 전체 Excel을 제공합니다. RealGrid setPaging/행 편집 버퍼/저장 API의 교체 호환을 제공한 것은 아닙니다.

0.6.0은 [자체 서버 저장 계약](server-editing.md)으로 추가/수정/삭제 상태, 저장 기준점 취소, 버전 충돌과 중복 저장 방지를 제공합니다. RealGrid 행 상태 메서드·soft delete·저장 API와의 교체 호환은 제공하지 않습니다.
