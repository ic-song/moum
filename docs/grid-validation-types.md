# 그리드 전체 입력 검증과 TypeScript

Grid 0.8.0은 저장 전 오류를 모으는 `Grid.validate()`와 DOM 없는 `GridModel.validate()`를 제공합니다. 필수값, 숫자/불리언 변환, `column.validate`와 활성화된 수식의 계산 오류·결과 검증을 수행합니다. 읽기 전용 컬럼도 검사합니다.

```js
// 편집창까지 포함하려면 먼저 확정합니다. 실패하면 입력창을 유지합니다.
if (!grid.finishEdit()) return;
const result = grid.validate();
if (!result.valid) {
  console.table(result.errors); // {row, field, value, message}[]
  return;
}
const rows = grid.getData();
// 실제 저장은 호스트에서 처리합니다.
```

검사 자체는 데이터 변환을 반영하거나 편집창·선택·조회 조건·Undo/Redo 이력을 바꾸지 않습니다. `row`는 표시 위치가 아닌 현재 모델의 원본 배열 인덱스(0부터), `field`는 컬럼 이름, `value`는 원래 입력값입니다. 행 순서와 컬럼 순서대로 오류를 반환합니다. 검색·필터로 숨긴 행도 검사하며 빈 모델은 `{valid:true, errors:[]}`입니다.

로컬은 전체 모델, 서버 모드는 현재 불러온 행과 추가한 초안을 검사합니다. 편집창의 미확정 값은 `finishEdit()` 전까지 대상에서 제외됩니다. 행 사이 중복과 업무 서버 제약은 호스트에서 검증하세요.

## 여러 필드의 값 함께 검사

`Grid` 또는 직접 생성한 `GridModel`에 `validateRow`를 지정합니다. 수식 결과와 숫자 변환을 반영한 행 복사본을 받으며, 셀 자체에 오류가 있는 행은 셀 오류를 먼저 반환합니다. 행 규칙에 실패하면 오류 메시지를 반환하세요. 검사 결과에서 해당 오류의 `field`는 `null`입니다.

```js
const grid = new Grid('#grid', {
  columns: [{ field: 'min', type: 'number' }, { field: 'max', type: 'number' }],
  validateRow: ({ min, max }) =>
    typeof min === 'number' && typeof max === 'number' && min > max
      ? '최댓값은 최솟값 이상이어야 합니다.'
      : undefined
});
```

편집과 붙여넣기로 값을 순서대로 바꿀 수 있도록 행 규칙은 `validate()` 시점에 검사합니다. 서버 편집 모드에서 규칙을 지정하면 `saveChanges()`가 새 전송 전에 검사하고 오류가 있는 초안은 수정을 위해 보존합니다. 이미 전송한 요청의 결과를 재확인하는 절차는 기존 요청을 그대로 사용합니다. 콜백은 동기 함수로 작성하세요.

## 로컬 검색·정렬 설정

`sortLocale: 'sv'`처럼 locale을 지정하면 로컬 정렬에 적용합니다. 숫자가 섞인 품목명은 `항목 2`, `항목 10` 순으로 정렬하며 같은 값은 원본 행 순서를 유지합니다. 기본 locale은 `ko`입니다. 컬럼에 `searchable: false`를 지정하면 전체 검색에서 그 컬럼을 제외할 수 있습니다. 조건 필터에는 그대로 사용할 수 있습니다. 서버 조회에서 검색 대상과 정렬 기준은 `dataSource.load`가 결정합니다.

### 10만 행 성능 측정

저장소에서 아래 명령을 실행하면 숫자가 섞인 한글 품목명 정렬, 조건 3개와 전체 검색을 결합한 조회, 조건 없는 표시 데이터 생성을 측정합니다. 각 항목을 한 번 예열한 뒤 다섯 번 측정해 중앙값을 출력합니다.

```sh
node scripts/bench-grid-view.mjs
node scripts/bench-grid-view.mjs 2f303a1
```

두 번째 명령은 변경 전 커밋과 작업 트리를 같은 데이터로 비교합니다. 측정 범위는 로컬 데이터 처리이며 브라우저 렌더링과 서버 요청 시간은 별도입니다.

## TypeScript 사용

```ts
import Grid, { type GridOptions } from '@moum/grid';

interface Product { code: string; name: string; qty: number | null }
const options: GridOptions<Product> = {
  columns: [
    { field: 'code', editable: false },
    { field: 'name', required: true },
    { field: 'qty', type: 'number', validate: value =>
      typeof value === 'number' && value < 0 ? '수량은 0 이상이어야 합니다.' : undefined }
  ],
  data: [{ code: 'A', name: '노트', qty: 10 }],
  onChange: ({ data }) => console.log(data[0].qty)
};
const grid = new Grid<Product>('#grid', options);
grid.setSorts([{ field: 'qty', direction: 'desc' }]);
const errors = grid.validate().errors;
```

`Grid<Row>`·`GridModel<Row>`·옵션·컬럼·필터·정렬·이벤트·서버 조회/저장·복구 상태의 타입을 제공합니다. `Row`를 지정하면 컬럼/정렬/필터의 필드 오타와 데이터 형식을 검사합니다. 생략하면 `Record<string, unknown>`이며 내부 DOM과 비공개 구현 메서드는 공개 타입 계약에 포함하지 않습니다. 컬럼 검증 입력은 `unknown`이므로 필요한 타입을 확인하세요. 빈 숫자/불리언은 `null`, 원시 수식은 문자열이므로 사용하는 데이터 타입에 포함해야 합니다. 타입 선언은 실행 시 외부 데이터의 유효성을 보장하지 않습니다.

CommonJS TypeScript는 `import { Grid } from '@moum/grid'` 또는 `import moum = require('@moum/grid')` 후 `new moum.Grid(...)`를 사용합니다. CommonJS에는 default export가 없습니다. ESM은 기본/이름 export 모두 지원합니다. `moduleResolution: NodeNext`와 `Bundler` 소비자 검사를 제공하며 로컬 tgz 안에 선언을 포함합니다. 단순 파일 복사는 일반 script와 CSS를 사용하세요.

`@moum/grid/realgrid-compat`는 구현한 API 일부만 선언하며 미지원 API를 지원하는 것으로 표시하지 않습니다. TypeScript는 개발 의존성이고 런타임·폐쇄망 사용자에게 추가 설치를 요구하지 않습니다.

## 개발 검증

```sh
npm ci
npm run check
npm run test:grid-types
npm run test:validation-browser
```

`test:grid-types`는 tgz 생성·소비자 폴더 추출·해시·CJS/ESM 실행·NodeNext/Bundler strict 컴파일과 의도한 오류 검출을 검사합니다. `test:validation-browser`는 세 브라우저에서 실제 그리드의 숨긴 행·편집창·서버 초안 검증을 검사합니다. 두 검사 모두 빌드한 dist를 사용합니다.
