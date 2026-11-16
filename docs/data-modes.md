# 표시 방식과 엑셀 다운로드

이 문서는 로컬 데이터의 계약입니다. 0.5.0 서버 연동은 [서버 데이터 API](server-data.md)를 확인하세요.

0.4.0부터 그리드 툴바에서 가상 스크롤·무한 스크롤·페이징을 선택할 수 있습니다. [확장 예제](../examples/advanced/index.html)에서 10만 행 데이터로 전환해 확인하세요. 로컬 JS·CSS·SheetJS를 포함하므로 인터넷 없이도 동작합니다.

```js
const grid = new MoumGrid('#grid', {
  columns, data,
  dataMode: 'pagination', // 기본 virtual; infinite도 가능
  pageSize: 50           // 기본 100, 1~10,000 정수
});
grid.setDataMode('infinite');
grid.loadMore();
grid.setDataMode('pagination');
grid.setPage(2);          // 0부터 시작하는 세 번째 페이지
grid.setPageSize(100);   // 첫 페이지/첫 묶음으로 초기화
grid.getPagingState();
grid.exportXLSX({ scope: 'filtered', fileName: '검색결과.xlsx' });
```

## 표시와 편집

| 방식 | 동작 |
| --- | --- |
| virtual | 전체 검색·정렬 결과를 대상으로 필요한 DOM 셀만 렌더링. 기존 기본 동작 |
| infinite | pageSize만큼 표시하고 하단 2행 근처에서 다음 묶음을 추가. ‘더 불러오기’ 버튼으로도 가능 |
| pagination | pageSize 단위로 분리하고 처음/이전/다음/마지막·페이지 번호 입력으로 이동 |

무한 모드는 **이미 메모리에 있는 로컬 데이터의 순차 표시**입니다. 서버/DB 요청·서버 페이징을 구현한 것은 아닙니다. 모두 불러오면 버튼을 비활성화하며, 화면보다 작은 초기 묶음은 스크롤 가능한 높이까지 자동 추가될 수 있습니다. 불러온 행이 많아지면 기존 가상 렌더링을 함께 사용합니다.

검색·정렬·필터·그룹·트리 펼침 상태가 바뀌면 처음부터 표시합니다. 데이터 교체/가져오기도 초기화합니다. 일반 편집·삭제는 현재 페이지를 유지하되 마지막 페이지가 없어지면 남은 범위로 보정하고, 행 추가는 새 행이 보이는 페이지로 이동합니다. IME 조합 중이거나 유효하지 않은 편집은 방식·페이지·행 수 변경과 다운로드를 막고 입력을 유지합니다.

선택 좌표는 현재 페이지/불러온 범위의 0부터 시작합니다. 화면 행 번호는 전체 검색·정렬 결과의 데이터 순번이며, 변경 기록의 row와 수식 A1은 원본 데이터 기준입니다. 페이지 전환은 선택을 초기화하고 데이터·수식·Undo 이력을 보존합니다. Ctrl+A/C·범위 Delete·붙여넣기는 현재 페이지/불러온 행에만 적용합니다. 페이징·무한 모드에서 범위를 넘는 붙여넣기는 전체 거부하며 다른 페이지를 덮어쓰거나 행을 자동 추가하지 않습니다.

페이지 크기는 **표시 행** 기준으로 그룹 제목·소계도 포함합니다. 그룹이 페이지 경계에서 나뉠 수 있고 제목을 매 페이지 반복하지 않으며 소계는 전체 해당 그룹 기준입니다. 트리는 펼쳐진 표시 순서로 분할합니다.

`getPagingState()`는 `{mode,pageSize,pageIndex,pageCount,total,totalRows,start,end,loaded,hasMore}` 복사본입니다. total은 표시 행, totalRows는 그중 데이터 행 수, start/end는 표시 구간(끝 제외), loaded는 무한 모드에서 노출한 표시 행 수입니다. 빈 결과는 pageCount=0/pageIndex=0입니다. `setPage()`는 잘못된 범위이면 false, `loadMore()`는 끝이거나 편집 중이면 false입니다. 명시적 이동·방식 변경 후 `onPageChange(state)`·`onDataModeChange(state)` 콜백을 지원합니다.

## 엑셀 다운로드

‘다운로드 범위’를 고르고 ‘엑셀 다운로드’를 누르면 실제 .xlsx 파일을 저장합니다. 기본 파일명은 moum-grid.xlsx이며 API로 변경할 수 있습니다. SheetJS 로컬 파일을 먼저 로드해야 합니다. 모듈이 없으면 버튼을 비활성화하고 title로 안내합니다. 읽기 전용 그리드에서도 다운로드할 수 있습니다.

| scope | 포함 범위 |
| --- | --- |
| view (기존 API·UI 기본값) | 현재 페이지 또는 무한 모드에서 불러온 전체 데이터 행. 현재 DOM 셀 수로 제한하지 않음 |
| filtered | 페이지·무한 노출 제한을 제외한 전체 검색·필터·정렬 결과 |
| all | 필터·정렬·접힘과 무관한 원본 전체, 원본 순서 |
| selection | 선택 사각형의 컬럼·데이터 행, 컬럼 제목 포함 |

view/filtered는 접힌 그룹·트리의 숨겨진 자손을 제외하고, 그룹 제목·소계 자체는 XLSX 행으로 출력하지 않습니다. 숨겨진 데이터까지 포함하려면 all을 사용하세요. 선택 병합은 범위 기준으로 좌표를 변환합니다. 빈 결과도 헤더만 있는 유효한 XLSX를 출력하고, 선택할 데이터가 없으면 selection은 거부합니다.

기본값은 계산값 출력입니다. 수식 원문 보존은 기존과 같이 `scope:'all', formulas:true`로 명시합니다. 상세 수식·XLSX 제약은 [확장 API](grid-advanced.md)에 있습니다. RealGrid 이행 계층의 setPaging 메서드는 여전히 미지원이며, 위 자체 API나 그리드 툴바를 사용합니다.
