import Grid, { GridModel, type GridOptions, type ValidationResult } from '@moum/grid';
import { GridView, LocalDataProvider } from '@moum/grid/realgrid-compat';

interface Product { id: string; name: string; qty: number | null; _version: number }
const options: GridOptions<Product> = {
  columns: [{ field: 'name', required: true }, { field: 'qty', type: 'number', searchable: false }],
  sortLocale: ['ko-KR', 'en-US'],
  validateRow: ({ name, qty }) => name === '노트' && qty === 0 ? '노트의 수량이 0입니다.' : undefined,
  data: [{ id: 'A', name: '노트', qty: 10, _version: 1 }],
  onChange: ({ data, changes }) => { const qty: number | null = data[0].qty; console.log(qty, changes); }
};
const grid = new Grid<Product>('#grid', options);
grid.setColumnLayout(grid.getColumnLayout().reverse());
// @ts-expect-error unknown layout field
grid.setColumnLayout([{ field: 'unknown' }]);
const report: ValidationResult<Product> = grid.validate();
report.errors.forEach(error => { const field: keyof Product | null = error.field; console.log(field, error.message); });
grid.setSorts([{ field: 'qty', direction: 'desc' }]);
grid.setFilters([{ field: 'qty', operator: 'between', value: 1, value2: 10 }]);
grid.getData()[0].name.toUpperCase();
grid.getSelectionStats().average?.toFixed(2);
const model = new GridModel<Product>(options.columns, options.data);
model.validate(); model.apply([{ row: 0, field: 'qty', value: '1,000' }]);
const inferred = new Grid('#inferred', { columns: [{ field: 'qty', type: 'number' }], data: [{ qty: 2 }] });
const inferredQty: number = inferred.getData()[0].qty;
// @ts-expect-error inferred row has no other fields
inferred.setColumnWidth('missing', 100);
console.log(inferredQty);
const remote = new Grid<Product>('#server', {
  columns: options.columns, dataMode: 'pagination',
  dataSource: {
    rowKey: 'id', versionField: '_version',
    load: async ({ signal, offset, filters }) => { console.log(signal.aborted, offset, filters); return { rows: [], total: 0 }; },
    save: async ({ requestId, created, updated, deleted, signal }) => {
      console.log(created[0]?.values.qty, updated[0]?.version, deleted, signal.aborted);
      return { requestId, created: [], updated: [], deleted: [] };
    }
  }
});
await remote.ready;
await grid.setPage(0);
// @ts-expect-error unknown field
grid.setSorts([{ field: 'missing', direction: 'asc' }]);
// @ts-expect-error unsupported operator
grid.setFilters([{ field: 'qty', operator: 'approximately' }]);
// @ts-expect-error bad data type
grid.setData([{ id: 'A', name: 'A', qty: false, _version: 1 }]);
// @ts-expect-error unknown column
new Grid<Product>('#bad', { columns: [{ field: 'typo' }] });
// @ts-expect-error unsupported mode
grid.setDataMode('cursor');
// @ts-expect-error invalid server response
const source: GridOptions<Product> = { columns: options.columns, dataSource: { load: async () => ({ data: [], total: 0 }) } };
const provider = new LocalDataProvider(true);
provider.setFields([{ fieldName: 'name', dataType: 'text' }]);
provider.setRows([{ name: '노트' }]);
const view = new GridView('compat'); view.setDataSource(provider);
view.setColumns([{ name: 'nameColumn', fieldName: 'name', header: { text: '품명' } }]);
view.setCurrent({ column: 'nameColumn', itemIndex: 0 });
// @ts-expect-error unsupported compatibility API
view.setColumnLayout([]);
// @ts-expect-error rowState is unsupported
provider.getJsonRow(0, true);
grid.destroy(); remote.destroy(); view.destroy(); provider.destroy();
