# RealGrid2 공개 API 일부 이행

기준 프로젝트가 없다는 사용자 답변에 따라 RealGrid2의 [LocalDataProvider](https://docs.realgrid.com/refs/Class/LocalDataProvider), [DataProviderBase](https://docs.realgrid.com/refs/Class/DataProviderBase), [GridBase](https://docs.realgrid.com/refs/Class/GridBase)의 공개 메서드를 참고했습니다. **기존 RealGrid를 그대로 대체하는 라이브러리가 아닙니다.** 아래 메서드와 인수만 연결하는 독립 이행 계층입니다. 유료 실행본·내부 소스·라이선스·브랜드 리소스는 포함하지 않습니다.

## 로딩

브라우저에서는 `moum-grid.css`와 `moum-realgrid.js`를 로컬로 사용합니다. 브라우저 이행 번들은 자체 코어를 포함하므로 `moum-grid.js`를 별도로 로드할 필요가 없습니다. `RealGrid` 전역을 덮어쓰지 않습니다. 필요하면 호스트 코드에서 `const RealGrid = MoumRealGrid`로 명시적으로 별칭을 설정하세요.

```html
<link rel="stylesheet" href="./moum-grid.css">
<div id="grid"></div>
<script src="./moum-realgrid.js"></script>
<script>
  const { LocalDataProvider, GridView } = MoumRealGrid;
  const provider = new LocalDataProvider(true);
  provider.setFields([{ fieldName: 'name', dataType: 'text' }, { fieldName: 'qty', dataType: 'number' }]);
  const gridView = new GridView('grid');
  gridView.setDataSource(provider);
  gridView.setColumns([
    { name: '품목', fieldName: 'name', header: { text: '품목' }, width: 200 },
    { name: '수량', fieldName: 'qty', header: { text: '수량' } }
  ]);
  provider.setRows([{ name: '키보드', qty: 5 }]);
</script>
```

ESM은 `dist/moum-realgrid.mjs`, CommonJS는 `dist/moum-realgrid.cjs`, 패키지 경로는 `@moum/grid/realgrid-compat`입니다. ESM/CJS는 옆의 코어 배포 파일도 함께 배포합니다. 두 GridView가 같은 provider를 공유할 수 있습니다. 데이터·이력은 하나이며 각 화면의 검색·정렬·선택·읽기 전용 설정은 독립적입니다.

## 지원 메서드·인수

아래는 **지원하는 인수의 계약**이며 원제품 모든 기본값·이벤트 순서와의 일치를 의미하지 않습니다.

| LocalDataProvider | 지원 범위 |
| --- | --- |
| `new LocalDataProvider(undoable=false)` | boolean. true일 때 셀·행 트랜잭션 이력 |
| `setFields(fields)` | 문자열 또는 `{fieldName,dataType,defaultValue}` 배열. text/number/boolean. 데이터·연결된 화면이 없어야 재설정 가능 |
| `getFields()`, `getFieldCount()` | 필드 설정 복사본·수 |
| `getFieldName(index)`, `getFieldNames()` | 대문자 이름. 이름으로 조회할 때 대소문자 무시 |
| `getOrgFieldName(index)`, `getOrgFieldNames()`, `getFieldIndex(name)` | 원래 이름·인덱스, 미발견 -1 |
| `setRows(rows,start=0,count=-1)` | 객체 또는 배열 행. 원본 배열 일부를 데이터 전체로 교체하고 이력 초기화 |
| `clearRows()`, `getRowCount()`, `rowCount` | 초기화·행 수 |
| `getJsonRow(row)`, `getJsonRows(start=0,end=-1)` | 원래 fieldName을 키로 하는 얕은 복사. end 포함, -1은 끝 |
| `getRows(start=0,end=-1)` | 필드 순서의 2차원 배열 |
| `getValue(row,field)`, `getFieldValues(field,start=0,end=-1)` | field는 이름 또는 인덱스 |
| `setValue(row,field,value)`, `updateRow(row,values)` | 타입 검증·원자 반영. updateRow의 생략/undefined는 유지. strict=true 미지원 |
| `addRow(values)`, `insertRow(row,values)` | 삽입 데이터 인덱스 반환 |
| `addRows(rows,start=0,count=-1)` | 한 트랜잭션으로 여러 행 추가. rowEvents=true 미지원 |
| `removeRow(row)`, `removeRows(indices)` | 물리 삭제·한 번의 Undo. soft delete 미지원 |
| `undo()`, `redo()` | 성공 여부 boolean |
| `clearCommandStack()`, `destroy()` | 이력 제거·구독 해제. destroy 전에 연결된 화면 해제 |

| GridView | 지원 범위 |
| --- | --- |
| `new GridView(idOrElement)` | 비어 있는 DOM 컨테이너 |
| `setDataSource(provider)`, `getDataSource()` | MOUM LocalDataProvider만 지원 |
| `setColumns(columns)`, `getColumns()` | `{name,fieldName,header:{text},width,editable}`. 한 필드당 한 컬럼 |
| `setEditOptions({editable})`, `getEditOptions()` | 해당 화면의 편집·붙여넣기·행 CRUD·가져오기 보호. provider 직접 수정은 가능 |
| `setFixedOptions({colCount})`, `getFixedOptions()` | 왼쪽 고정 열만. 화면 너비 초과는 오류 |
| `getItemCount()`, `getDataRow(itemIndex)`, `getItemIndex(dataRow)` | 표시·원본 좌표 변환. 미발견 -1 |
| `getCurrent()`, `setCurrent(index)` | itemIndex 또는 dataRow, column 또는 fieldName/fieldIndex. getCurrent는 이 다섯 속성을 반환 |
| `getSelection()`, `setSelection(selection,eventFire=true)` | block 사각형의 startItem/endItem/startColumn/endColumn. column은 name |
| `getValue(itemIndex,field)`, `setValue(itemIndex,field,value)` | 표시 행 기준. provider는 원본 행 기준 |
| `orderBy(fields,directions)` | 문자열 또는 배열, ascending/descending. textCases 미지원 |
| `commit()`, `cancel()` | 현재 **셀** 편집을 반영·취소. 행 단위 편집 버퍼와 force 옵션 없음 |
| `undo()`, `redo()`, `refresh()`, `destroy()` | 공유 provider 이력·새로고침·해제 |

지원 콜백은 provider의 `onValueChanged(provider,row,fieldIndex)`와 view의 `onCurrentChanged(view,index)`입니다. 변경 후 호출되며 원제품 전체 이벤트 순서·취소 가능한 이벤트를 재현하지 않습니다. 셀별 변경 알림은 셀 트랜잭션에서 발생하며 행 교체/삽입/삭제에 개별 셀 알림을 만들지 않습니다. 행 구조 변경 후 외부에서 저장한 인덱스는 다시 조회해야 합니다.

## 명시적 미지원·차이

`setOptions`, `setDisplayOptions`, `setColumnLayout`, `setColumnFilters`, 체크바·상태바, 검증식 문자열, 페이징, 행 상태·savePoint/rollback, groupBy, exportGrid, fillJson/XML/CSVData 등의 대표 미지원 진입점은 `UnsupportedFeatureError`를 던집니다. 지원 메서드에 알 수 없는 옵션을 넣어도 오류입니다. 아직 정의하지 않은 메서드는 JavaScript의 미정의 메서드 오류가 발생합니다. 문서에 없는 옵션을 조용히 성공 처리하지 않습니다.

알 수 없는 이벤트 속성에 함수를 할당해도 구현이 생기지는 않습니다. 위 두 콜백 외의 이벤트는 지원하지 않습니다. 필드·컬럼 객체는 실제 RealGrid 클래스 인스턴스가 아니며 getFields의 객체 구조·getJsonRows의 이름/빈 값/Date 정책은 다를 수 있습니다. 숫자/boolean 변환과 null·빈 문자열은 MOUM 모델 정책을 따릅니다. 날짜·object 필드·lookup·renderer·editor·layout·styles는 이행 계층 대상이 아닙니다.

직접 provider 변경은 연결된 유휴 화면에 반영됩니다. 입력 중인 화면은 DOM과 원문을 보존하고 revision이 다른 commit을 거부합니다. Esc로 취소한 뒤 다시 편집하세요. 이행 계층의 셀 커밋·범위 원자성·공유 Undo 규칙은 MOUM의 계약이며 RealGrid의 행 편집 상태와 같지 않습니다.

기준 프로젝트가 생기면 실제 사용하는 메서드·인수·콜백 목록을 확보하고, 같은 데이터와 조작을 양쪽에서 비교해 범위를 확장합니다. 현재 검증은 MOUM 모델·Chromium에서의 이행 시나리오이며 RealGrid 실행본과의 대조 시험은 아닙니다.
