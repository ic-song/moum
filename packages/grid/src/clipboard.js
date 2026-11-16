import { parseTSV } from './model.js';

export function parseClipboardData(plain, html, numericColumns = new Set()) {
  const rich = parseClipboardHTML(html, numericColumns);
  const matrix = plain !== '' ? parseTSV(plain) : null;
  if (!rich) return matrix || [['']];
  if (!matrix || matrix.length !== rich.length || Math.max(...matrix.map(row => row.length)) !== rich[0].length) return rich;
  // Excel plain text preserves literal tabs/spaces better; rich numeric cells can carry raw precision.
  return matrix.map((row, y) => rich[y].map((value, x) => numericColumns.has(x) ? value : row[x] ?? ''));
}

export function parseClipboardHTML(html, numericColumns = new Set()) {
  if (!html || !/<table[\s>]/i.test(html)) return null;
  // Read in an inert template: never attach pasted HTML or load its resources.
  const template = document.createElement('template'); template.innerHTML = html;
  const table = template.content.querySelector('table'); if (!table) return null;
  const output = [];
  const text = element => {
    if (element.nodeType === 3) return element.nodeValue;
    if (element.nodeType !== 1 || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) return '';
    if (element.tagName === 'BR') return '\n';
    return [...element.childNodes].map(text).join('');
  };
  for (const [y, row] of [...table.rows].entries()) {
    if (!output[y]) output[y] = [];
    let x = 0;
    for (const cell of row.cells) {
      while (output[y][x] !== undefined) x++;
      const height = Math.max(1, cell.rowSpan), width = Math.max(1, cell.colSpan);
      if ((y + height) * (x + width) > 100000 || height > 10000 || width > 1000) throw new Error('복사된 표가 너무 큽니다. 영역을 나누어 붙여넣으세요.');
      const rawNumber = cell.getAttribute('x:num');
      const displayed = text(cell).replace(/\r\n/g, '\n');
      const value = numericColumns.has(x) && rawNumber != null && rawNumber !== '' ? rawNumber : displayed === '\u00a0' ? '' : displayed;
      for (let dy = 0; dy < height; dy++) {
        if (!output[y + dy]) output[y + dy] = [];
        for (let dx = 0; dx < width; dx++) output[y + dy][x + dx] = dy === 0 && dx === 0 ? value : '';
      }
      x += width;
    }
  }
  const width = Math.max(0, ...output.map(row => row.length));
  return width ? output.map(row => Array.from({ length: width }, (_, col) => row[col] ?? '')) : null;
}
