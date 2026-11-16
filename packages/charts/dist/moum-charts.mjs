/*! MOUM charts v0.2.0 | MIT License | See LICENSE */
export const chartTypes = Object.freeze(['bar', 'horizontalBar', 'stackedBar', 'stackedHorizontalBar', 'line', 'area', 'pie', 'donut', 'scatter']);

export function chartStacks(datasets, count) {
  const positive = Array(count).fill(0), negative = Array(count).fill(0);
  const segments = datasets.map(series => series.data.map((value, i) => {
    if (value == null) return null;
    const totals = value >= 0 ? positive : negative, start = totals[i]; totals[i] += value;
    return { start, end: totals[i] };
  }));
  return { segments, extent: chartExtent([...positive, ...negative]) };
}

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


const chartPalette = ['#17664f', '#315b9b', '#a95715', '#794893', '#a13e54', '#437076', '#696414', '#555a75'];
const chartMetrics = { width: 900, height: 360, left: 76, right: 24, top: 24, bottom: 64, radius: 132 };
function chartEl(tag, text, className) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; }
function chartSvg(tag, attrs = {}, text) { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); if (text != null) el.textContent = text; return el; }

export class Charts {
  constructor(target, options = {}) {
    this.target = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.target || this.target.childNodes.length) throw new Error('비어 있는 차트 컨테이너가 필요합니다.');
    this.options = { type: 'bar', title: '차트', ...options };
    this.data = normalizeChart(options.data || { labels: [], datasets: [] }, this.options.type);
    this.hidden = new Set(); this.hiddenPoints = new Set(); this.destroyed = false;
    this.root = chartEl('section', null, 'moum-charts'); this.target.append(this.root); this.render();
    this.observer = new ResizeObserver(() => { if (this.destroyed || this.resizeFrame) return; this.resizeFrame = requestAnimationFrame(() => { this.resizeFrame = null; if (!this.destroyed && this.plotWidth !== this.measureWidth()) this.render(); }); }); this.observer.observe(this.root);
  }
  setData(data) { this.assertActive(); const next = normalizeChart(data, this.options.type); this.data = next; this.hidden.clear(); this.hiddenPoints.clear(); this.render(); }
  getData() { return structuredClone(this.data); }
  setType(type) { this.assertActive(); normalizeChart(this.data, type); this.options.type = type; this.hiddenPoints.clear(); this.render(); }
  setOptions(options) { this.assertActive(); const next = { ...this.options, ...options }; const data = normalizeChart(options.data || this.data, next.type); this.options = next; this.data = data; this.hidden.clear(); this.hiddenPoints.clear(); this.render(); }
  assertActive() { if (this.destroyed) throw new Error('이미 제거된 차트입니다.'); }
  measureWidth() { return Math.max(240, Math.min(chartMetrics.width, this.root.clientWidth - 32)); }
  selectPoint(seriesIndex, pointIndex) {
    this.assertActive();
    if (!Number.isInteger(seriesIndex) || !Number.isInteger(pointIndex) || !this.data.datasets[seriesIndex] || pointIndex < 0 || pointIndex >= this.data.datasets[seriesIndex].data.length) throw new RangeError('차트 항목을 찾을 수 없습니다.');
    const series = this.data.datasets[seriesIndex], value = series?.data[pointIndex];
    this.status.textContent = `${series?.label || ''} · ${this.data.labels[pointIndex] ?? pointIndex + 1}: ${value && typeof value === 'object' ? `${value.x}, ${value.y}` : value ?? '값 없음'}`;
    this.options.onSelect?.({ seriesIndex, pointIndex, label: this.data.labels[pointIndex], value: structuredClone(value) });
  }
  render() {
    this.tableOpen = this.root.querySelector('details')?.open ?? this.tableOpen ?? false;
    this.plotWidth = this.measureWidth(); this.metrics = { ...chartMetrics, width: this.plotWidth };
    this.root.replaceChildren();
    this.root.append(chartEl('h3', this.options.title));
    this.status = chartEl('p', '항목을 선택하면 값을 확인할 수 있습니다.', 'moum-charts-status'); this.status.setAttribute('aria-live', 'polite');
    const legend = chartEl('div', null, 'moum-charts-legend');
    const circular = ['pie', 'donut'].includes(this.options.type);
    const items = circular ? this.data.labels : this.data.datasets.map(s => s.label);
    items.forEach((label, index) => {
      const hidden = circular ? this.hiddenPoints : this.hidden;
      const button = chartEl('button', label); button.type = 'button'; button.setAttribute('aria-pressed', String(!hidden.has(index)));
      const swatch = chartEl('span', null, 'moum-charts-swatch'); swatch.style.backgroundColor = circular ? chartPalette[index % chartPalette.length] : this.data.datasets[index].color || chartPalette[index % chartPalette.length]; swatch.setAttribute('aria-hidden', 'true'); button.prepend(swatch);
      button.addEventListener('click', () => { if (hidden.has(index)) hidden.delete(index); else hidden.add(index); this.render(); this.root.querySelectorAll('.moum-charts-legend button')[index]?.focus(); }); legend.append(button);
    });
    this.root.append(legend);
    const svg = chartSvg('svg', { viewBox: `0 0 ${this.metrics.width} ${this.metrics.height}`, role: 'group', 'aria-label': this.options.title, class: 'moum-charts-plot' });
    svg.append(chartSvg('title', {}, this.options.title));
    this.svg = svg;
    const hasValues = this.data.datasets.some((s, i) => !this.hidden.has(i) && s.data.some((v, p) => v != null && (!circular || (!this.hiddenPoints.has(p) && v > 0))));
    if (!hasValues) svg.append(chartSvg('text', { x: this.metrics.width / 2, y: 180, 'text-anchor': 'middle', fill: 'currentColor' }, '표시할 데이터가 없습니다.'));
    else if (circular) this.drawPie(svg); else this.drawCartesian(svg);
    this.root.append(svg, this.status, this.renderTable());
  }
  mark(svg, tag, attrs, series, point) {
    const el = chartSvg(tag, { ...attrs, tabindex: 0, role: 'button', 'aria-label': `${this.data.datasets[series].label}, ${this.data.labels[point] ?? point + 1}: ${typeof this.data.datasets[series].data[point] === 'object' ? JSON.stringify(this.data.datasets[series].data[point]) : this.data.datasets[series].data[point]}` });
    el.append(chartSvg('title', {}, el.getAttribute('aria-label')));
    el.addEventListener('click', () => this.selectPoint(series, point));
    el.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.selectPoint(series, point); } });
    svg.append(el); return el;
  }
  drawCartesian(svg) {
    const m = this.metrics, w = m.width - m.left - m.right, h = m.height - m.top - m.bottom;
    const visible = this.data.datasets.map((s, i) => ({ ...s, index: i })).filter(s => !this.hidden.has(s.index));
    const scatter = this.options.type === 'scatter', horizontal = ['horizontalBar','stackedHorizontalBar'].includes(this.options.type), stacked = this.options.type.startsWith('stacked');
    const stacks = stacked ? chartStacks(visible, this.data.labels.length) : null;
    const values = visible.flatMap(s => s.data.filter(v => v != null).map(v => scatter ? v.y : v));
    const [min, max] = stacks ? stacks.extent : chartExtent(values), y = value => m.top + h - (value - min) / (max - min) * h;
    const [xmin, xmax] = scatter ? chartExtent(visible.flatMap(s => s.data.filter(Boolean).map(v => v.x)), false) : [0, 1];
    const n = this.data.labels.length, step = (horizontal ? h : w) / Math.max(1, n);
    for (let tick = 0; tick <= 4; tick++) {
      const value = min + (max - min) * tick / 4, pos = horizontal ? m.left + w * tick / 4 : y(value);
      svg.append(chartSvg('line', horizontal ? { x1: pos, x2: pos, y1: m.top, y2: m.top + h, class: 'moum-charts-grid' } : { x1: m.left, x2: m.left + w, y1: pos, y2: pos, class: 'moum-charts-grid' }));
      svg.append(chartSvg('text', horizontal ? { x: pos, y: m.top + h + 25, 'text-anchor': 'middle', class: 'moum-charts-label' } : { x: m.left - 10, y: pos + 4, 'text-anchor': 'end', class: 'moum-charts-label' }, new Intl.NumberFormat(this.options.locale || 'ko-KR', { maximumFractionDigits: 2, notation: Math.abs(value) >= 100000 ? 'compact' : 'standard' }).format(value)));
    }
    if (!scatter) this.data.labels.forEach((label, i) => {
      const maxLabels = horizontal ? 9 : Math.max(2, Math.floor(w / 65));
      const stride = Math.max(1, Math.ceil(n / maxLabels)); if (i % stride) return;
      const limit = horizontal ? 6 : 10, short = label.length > limit ? label.slice(0, limit - 1) + '…' : label;
      const text = chartSvg('text', horizontal ? { x: m.left - 8, y: m.top + step * (i + .5) + 4, 'text-anchor': 'end', class: 'moum-charts-label' } : { x: m.left + step * (i + .5), y: m.top + h + 25, 'text-anchor': 'middle', class: 'moum-charts-label' }, short); text.append(chartSvg('title', {}, label)); svg.append(text);
    });
    if (scatter) for (let t = 0; t <= 4; t++) svg.append(chartSvg('text', { x: m.left + w * t / 4, y: m.top + h + 25, 'text-anchor': 'middle', class: 'moum-charts-label' }, Number((xmin + (xmax - xmin) * t / 4).toPrecision(5))));
    visible.forEach((series, si) => {
      const color = series.color || chartPalette[series.index % chartPalette.length];
      const segments = []; let segment = [];
      series.data.forEach((value, index) => {
        if (value == null) { if (segment.length) segments.push(segment); segment = []; return; }
        const px = scatter ? m.left + (value.x - xmin) / (xmax - xmin) * w : m.left + step * (index + .5), py = y(scatter ? value.y : value);
        if (['bar', 'horizontalBar','stackedBar','stackedHorizontalBar'].includes(this.options.type)) {
          const thickness = step * .8 / (stacked ? 1 : Math.max(1, visible.length)), offset = step * .1 + (stacked ? 0 : si * thickness);
          const start = stacked ? stacks.segments[si][index].start : 0, end = stacked ? stacks.segments[si][index].end : value;
          const a = m.left + (end - min) / (max - min) * w, zero = m.left + (start - min) / (max - min) * w;
          this.mark(svg, 'rect', horizontal ? { x: Math.min(a, zero), y: m.top + index * step + offset, width: Math.max(1, Math.abs(a - zero)), height: thickness, fill: color } : { x: m.left + index * step + offset, y: Math.min(y(end), y(start)), width: thickness, height: Math.max(1, Math.abs(y(start) - y(end))), fill: color }, series.index, index);
        } else segment.push({ x: px, y: py, index });
      });
      if (segment.length) segments.push(segment);
      segments.forEach(points => {
        const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
        if (this.options.type === 'area') svg.append(chartSvg('path', { d: `${d} L${points.at(-1).x},${y(0)} L${points[0].x},${y(0)} Z`, fill: color, 'fill-opacity': .15 }));
        if (!scatter) svg.append(chartSvg('path', { d, fill: 'none', stroke: color, 'stroke-width': 2 }));
        points.forEach(p => this.mark(svg, 'circle', { cx: p.x, cy: p.y, r: scatter ? 5 : 4, fill: color }, series.index, p.index));
      });
    });
  }
  drawPie(svg) {
    const values = this.data.datasets[0]?.data || [], total = values.reduce((sum, v, i) => sum + (this.hiddenPoints.has(i) ? 0 : v || 0), 0);
    let angle = -Math.PI / 2; const cx = this.metrics.width / 2, cy = 175, radius = Math.min(chartMetrics.radius, this.metrics.width * .42);
    values.forEach((value, i) => {
      if (!value || this.hiddenPoints.has(i)) return;
      const end = angle + value / total * Math.PI * 2, x1 = cx + radius * Math.cos(angle), y1 = cy + radius * Math.sin(angle), x2 = cx + radius * Math.cos(end), y2 = cy + radius * Math.sin(end);
      if (value === total) this.mark(svg, 'circle', { cx, cy, r: radius, fill: chartPalette[i % chartPalette.length] }, 0, i);
      else this.mark(svg, 'path', { d: `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${end - angle > Math.PI ? 1 : 0} 1 ${x2},${y2} Z`, fill: chartPalette[i % chartPalette.length], stroke: 'white', 'stroke-width': 2 }, 0, i);
      angle = end;
    });
    if (this.options.type === 'donut') { svg.append(chartSvg('circle', { cx, cy, r: radius * .6, fill: 'var(--moum-chart-surface, white)', 'pointer-events': 'none' })); svg.append(chartSvg('text', { x: cx, y: cy + 6, 'text-anchor': 'middle', class: 'moum-charts-total' }, total.toLocaleString(this.options.locale || 'ko-KR'))); }
  }
  renderTable() {
    const details = chartEl('details'); details.open = this.tableOpen; details.append(chartEl('summary', '데이터 표 보기'));
    const scroll = chartEl('div', null, 'moum-charts-table-scroll'), table = chartEl('table'); table.append(chartEl('caption', `${this.options.title} 원본 데이터`));
    const head = chartEl('thead'), hr = chartEl('tr'); ['항목', ...this.data.datasets.map(s => s.label)].forEach(label => { const th = chartEl('th', label); th.scope = 'col'; hr.append(th); }); head.append(hr); table.append(head);
    const body = chartEl('tbody'), count = this.options.type === 'scatter' ? Math.max(0, ...this.data.datasets.map(s => s.data.length)) : this.data.labels.length;
    for (let i = 0; i < count; i++) { const row = chartEl('tr'); const th = chartEl('th', this.data.labels[i] ?? i + 1); th.scope = 'row'; row.append(th); this.data.datasets.forEach(s => { const value = s.data[i]; row.append(chartEl('td', value && typeof value === 'object' ? `${value.x}, ${value.y}` : value ?? '—')); }); body.append(row); } table.append(body); scroll.append(table); details.append(scroll); return details;
  }
  toSVG() { this.assertActive(); const copy = this.svg.cloneNode(true); copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('color', '#233d35'); copy.querySelectorAll('.moum-charts-grid').forEach(n => n.setAttribute('stroke', '#d6dfda')); copy.querySelectorAll('text').forEach(n => { n.setAttribute('fill', '#233d35'); n.setAttribute('font-family', 'sans-serif'); n.setAttribute('font-size', '13'); }); copy.querySelectorAll('[fill^="var("]').forEach(n => n.setAttribute('fill', 'white')); return new XMLSerializer().serializeToString(copy); }
  destroy() { if (this.destroyed) return; this.destroyed = true; this.observer.disconnect(); if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame); this.root.remove(); }
}

export default Charts;
