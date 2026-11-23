import moum = require('@moum/grid');
import compat = require('@moum/grid/realgrid-compat');
interface Item { name: string; qty: number }
const model = new moum.GridModel<Item>([{ field: 'qty', type: 'number' }], [{ name: 'A', qty: 1 }]);
const valid: boolean = model.validate().valid;
const name: string = model.getData()[0].name;
const grid = new moum.Grid<Item>('#grid', { columns: [{ field: 'name' }] });
new compat.LocalDataProvider(true).setFields(['name']);
console.log(valid, name, grid.validate());
// @ts-expect-error CommonJS has no default export
new moum.default('#grid', { columns: [{ field: 'name' }] });
// @ts-expect-error generic field validation in CommonJS
model.apply([{ row: 0, field: 'missing', value: 2 }]);
