export const chartTypes = Object.freeze(['bar', 'horizontalBar', 'line', 'area', 'pie', 'donut', 'scatter']);

export function normalizeChart(data, type = 'bar') {
  if (!chartTypes.includes(type)) throw new TypeError(`지원하지 않는 차트: ${type}`);
  if (!data || !Array.isArray(data.labels) || !Array.isArray(data.datasets)) throw new TypeError('labels와 datasets 배열이 필요합니다.');
  if (data.labels.length > 2000 || data.datasets.length > 50) throw new RangeError('최대 2,000개 항목, 50개 계열까지 표시합니다.');
  const labels = data.labels.map(String);
  const datasets = data.datasets.map((series, s) => {
    if (!series || !Array.isArray(series.data)) throw new TypeError('계열 data 배열이 필요합니다.');
    if (type !== 'scatter' && series.data.length !== labels.length) throw new RangeError('항목과 계열 데이터 길이가 다릅니다.');
    if (series.data.length > 2000) throw new RangeError('계열당 최대 2,000개 항목까지 표시합니다.');
    const values = series.data.map(value => {
      if (value == null) return null;
      if (type === 'scatter') {
        if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || Math.abs(value.x) > 1e15 || Math.abs(value.y) > 1e15) throw new TypeError('산점도에는 절댓값 10^15 이하의 유한한 x/y 숫자가 필요합니다.');
        return { x: value.x, y: value.y };
      }
      if (!Number.isFinite(value) || Math.abs(value) > 1e15) throw new TypeError('데이터는 절댓값 10^15 이하의 유한한 숫자 또는 null이어야 합니다.');
      if ((type === 'pie' || type === 'donut') && value < 0) throw new RangeError('원형 차트에 음수를 사용할 수 없습니다.');
      return value;
    });
    if (series.color != null && !/^(#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl|oklch)a?\([\d\s.,%/+\-]+\))$/i.test(series.color)) throw new TypeError('유효한 단색 CSS 색상을 지정하세요.');
    return { label: String(series.label ?? `계열 ${s + 1}`), data: values, ...(series.color ? { color: series.color } : {}) };
  });
  if ((type === 'pie' || type === 'donut') && datasets.length > 1) throw new RangeError('원형 차트는 하나의 계열을 사용합니다.');
  return { labels, datasets };
}

export function chartExtent(values, includeZero = true) {
  if (!values.some(Number.isFinite)) return [0, 1];
  let min = includeZero ? 0 : Infinity, max = includeZero ? 0 : -Infinity;
  for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
  if (!Number.isFinite(min)) return [0, 1];
  if (min === max) return [min - (Math.abs(min) * .1 || 1), max + (Math.abs(max) * .1 || 1)];
  return [min, max];
}
