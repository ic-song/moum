import { buildDisplay } from '../packages/grid/src/data-view.js';
import { execFileSync } from 'node:child_process';

const columns = [{ field: 'name' }, { field: 'qty', type: 'number' }, { field: 'region' }];
const size = Number(process.argv[3] ?? 100_000);
if (!Number.isSafeInteger(size) || size <= 0) throw Error('Row count must be a positive integer.');
const rows = Array.from({ length: size }, (_, i) => ({
  name: '품목 ' + ((i * 78233) % 100003), qty: i % 500, region: '서울'
}));
const cases = {
  filterAndSearch: { query: '품목', filters: [
    { field: 'qty', operator: 'gte', value: 20 },
    { field: 'qty', operator: 'lt', value: 300 },
    { field: 'region', operator: 'equals', value: '서울' }
  ] },
  sort: { sorts: [{ field: 'name', direction: 1 }] },
  unfiltered: {}
};
console.log(`Node ${process.version} · ${process.platform}/${process.arch} · ${rows.length} rows`);
const baseline = process.argv[2];
if (baseline) {
  const source = execFileSync('git', ['show', `${baseline}:packages/grid/src/data-view.js`]);
  const original = await import('data:text/javascript;base64,' + source.toString('base64'));
  measure(baseline, original.buildDisplay);
}
measure('working tree', buildDisplay);

function measure(label, display) {
  for (const [name, options] of Object.entries(cases)) {
    const configuration = { columns, ...options };
    display(rows, configuration);
    const timings = [];
    let shown = 0;
    for (let run = 0; run < 5; run++) {
      const start = performance.now();
      shown = display(rows, configuration).view.length;
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    console.log(`${label} ${name}: median ${timings[2].toFixed(1)} ms · ${shown} rows`);
  }
}
