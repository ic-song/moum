# @moum/charts 0.2.0

외부 런타임 의존성 없는 MIT SVG 차트. Chart.js 호환 API가 아닌 독립 라이브러리입니다.

```html
<link rel="stylesheet" href="./moum-charts.css">
<div id="chart"></div>
<script src="./moum-charts.js"></script>
<script>
const chart = new MoumCharts('#chart', {
  type:'bar', title:'월별 실적',
  data:{labels:['10월','11월'],datasets:[{label:'계획',data:[50,70]},{label:'실적',data:[48,75]}]},
  onSelect: point => console.log(point)
});
</script>
```

설치: dist의 JS/CSS와 LICENSE를 복사하거나 `npm pack ./packages/charts`로 tgz를 만들어 설치합니다. npm에는 등록하지 않았습니다. ESM은 `import Charts from '@moum/charts'`, CSS는 `@moum/charts/style.css`, CommonJS는 `const {Charts}=require('@moum/charts')`. 비어 있는 요소에 생성하고 React effect cleanup/Vue onBeforeUnmount에서 `destroy()`하세요.

## 데이터와 API

- type: `bar`, `horizontalBar`, `line`, `area`, `pie`, `donut`, `scatter`.
- data: `{labels:string[],datasets:[{label,data,color?}]}`. 일반 차트는 항목과 데이터 길이가 같아야 합니다. null은 값 없음이며 선/영역은 해당 구간을 연결하지 않습니다. 값은 유한한 숫자입니다.
- 원형/도넛은 하나의 계열과 0 이상 값을 사용합니다. 전체 0은 빈 상태입니다. 산점도는 `{x,y}` 배열이며 계열별 점 개수가 달라도 됩니다.
- `setData(data)`, `setType(type)`, `setOptions(options)`: 검증 후 갱신. 잘못된 입력은 예외를 던지고 기존 화면을 유지합니다. 데이터 형태가 바뀌는 타입 전환은 `setOptions({type,data})`를 사용하세요.
- `getData()`는 복사본, `onSelect({seriesIndex,pointIndex,label,value})`는 항목 선택 이벤트입니다.
- `toSVG()`는 독립 SVG 문자열입니다. Blob으로 파일 저장할 수 있습니다. `destroy()`는 제거합니다.

범례로 계열/조각을 켜고 끄며 원본은 보존합니다. 항목은 Enter/Space로 선택할 수 있고 데이터 표는 전체 값을 제공합니다. CSS는 `.moum-charts`와 `--moum-chart-ink/line/action/surface` 변수로 제한됩니다.

최대 항목 2,000·계열 50개, 숫자 절댓값 10^15 이하입니다. 상한은 성능 보증이 아니며 대규모 데이터는 호스트에서 집계하세요. 복합·줌/팬·이중/로그 축·PNG/PDF 출력은 포함하지 않습니다. 현대 브라우저의 SVG·ResizeObserver·structuredClone·CSS OKLCH를 사용합니다. [오프라인 예제](../../examples/charts/index.html).

## 0.2.0 누적 막대

`stackedBar`, `stackedHorizontalBar`를 type에 지정합니다. 항목별 양수와 음수는 0에서 각각 누적하며 null은 건너뜁니다. 범례로 숨긴 계열은 누적값·축 범위에서 제외하고 원본 표는 보존합니다. 기본 7종을 포함해 총9종입니다.
