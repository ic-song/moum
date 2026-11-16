/*! MOUM Grid v0.7.1 | MIT License | See LICENSE */
const { Grid, GridModel } = require('./moum-grid.cjs');

class UnsupportedFeatureError extends Error {
  constructor(feature) { super(`MOUM RealGrid 이행 계층에서 지원하지 않는 기능: ${feature}`); this.name = 'UnsupportedFeatureError'; }
}
function compatKeys(value, allowed, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${context}: 객체가 필요합니다.`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new UnsupportedFeatureError(`${context}.${key}`);
}
function compatRange(length, start = 0, end = -1) {
  if (!Number.isInteger(start) || start < 0 || !Number.isInteger(end) || end < -1) throw new RangeError('행 범위가 올바르지 않습니다.');
  return [Math.min(start, length), end === -1 ? length : Math.min(end + 1, length)];
}
function compatSlice(rows, start = 0, count = -1) {
  if (!Array.isArray(rows) || !Number.isInteger(start) || start < 0 || !Number.isInteger(count) || count < -1) throw new TypeError('행 배열, 시작 위치, 건수가 올바르지 않습니다.');
  return rows.slice(start, count === -1 ? undefined : start + count);
}

class LocalDataProvider {
  constructor(undoable = false) {
    if (typeof undoable !== 'boolean') throw new UnsupportedFeatureError('LocalDataProvider constructor: boolean only');
    this.undoable = undoable; this.views = new Set(); this.fields = []; this.model = null; this.disposed = false;
  }
  ready() { if (this.disposed || !this.model) throw new Error('유효한 provider에 setFields를 먼저 호출하세요.'); return this.model; }
  setFields(fields) {
    if (this.disposed || this.views.size || this.model?.rows.length) throw new Error('필드는 데이터와 연결된 화면이 없을 때 설정하세요.');
    if (!Array.isArray(fields) || !fields.length) throw new Error('필드 배열이 필요합니다.');
    const prepared = fields.map(field => {
      if (typeof field === 'string') field = { fieldName: field };
      compatKeys(field, ['fieldName', 'dataType', 'defaultValue'], 'field');
      if (!['text', 'number', 'boolean', undefined].includes(field.dataType)) throw new UnsupportedFeatureError(`field.dataType:${field.dataType}`);
      return { ...field, dataType: field.dataType || 'text' };
    });
    const model = new GridModel(prepared.map(field => ({ field: field.fieldName, type: field.dataType === 'text' ? 'text' : field.dataType, defaultValue: field.defaultValue })));
    if (new Set(prepared.map(field => field.fieldName.toUpperCase())).size !== prepared.length) throw new Error('대소문자가 다른 중복 필드는 지원하지 않습니다.');
    this.unsubscribe?.(); this.fields = prepared; this.model = model;
    this.unsubscribe = model.subscribe(({ changes }) => {
      if (!this.undoable) { model.past = []; model.future = []; }
      for (const change of changes) if (change.field != null) this.onValueChanged?.(this, change.row, this.getFieldIndex(change.field));
    });
  }
  getFields() { return this.fields.map(field => ({ ...field })); }
  getFieldCount() { return this.fields.length; }
  getFieldNames() { return this.fields.map(field => field.fieldName.toUpperCase()); }
  getOrgFieldNames() { return this.fields.map(field => field.fieldName); }
  getFieldIndex(name) { return typeof name === 'string' ? this.fields.findIndex(field => field.fieldName.toUpperCase() === name.toUpperCase()) : -1; }
  getFieldName(index) { return this.fields[index]?.fieldName.toUpperCase(); }
  getOrgFieldName(index) { return this.fields[index]?.fieldName; }
  fieldName(field) { const index = typeof field === 'number' ? field : this.getFieldIndex(field); const name = Number.isInteger(index) ? this.getOrgFieldName(index) : undefined; if (!name) throw new RangeError('필드를 찾을 수 없습니다.'); return name; }
  rowObject(values, partial = false) {
    if (!values || typeof values !== 'object') throw new TypeError('행은 배열 또는 객체여야 합니다.');
    if (!Array.isArray(values)) {
      const normalized = {}; for (const key of Object.keys(values)) { const name = this.fieldName(key); if (Object.hasOwn(normalized, name)) throw new Error('중복 필드 값입니다.'); normalized[name] = values[key]; } values = normalized;
    }
    const row = {};
    this.ready().columns.forEach((column, index) => {
      const value = Array.isArray(values) ? values[index] : values[column.field];
      if (partial && value === undefined) return;
      row[column.field] = this.model.convert(column, value === undefined ? this.fields[index].defaultValue : value);
    });
    return row;
  }
  setRows(rows, start = 0, count = -1) { const model = this.ready(), prepared = compatSlice(rows, start, count).map(row => this.rowObject(row)); model.setData(prepared); }
  clearRows() { this.ready().setData([]); }
  getRowCount() { return this.ready().rows.length; }
  get rowCount() { return this.getRowCount(); }
  getJsonRow(row, rowState = false) { if (rowState) throw new UnsupportedFeatureError('rowState'); const item = this.ready().rows[row]; if (!Number.isInteger(row) || !item) throw new RangeError('행을 찾을 수 없습니다.'); return { ...item }; }
  getJsonRows(startRow = 0, endRow = -1, rowState = false) { if (rowState) throw new UnsupportedFeatureError('rowState'); const model = this.ready(), [start, end] = compatRange(model.rows.length, startRow, endRow); return model.rows.slice(start, end).map(row => ({ ...row })); }
  getRows(startRow = 0, endRow = -1) { return this.getJsonRows(startRow, endRow).map(row => this.getOrgFieldNames().map(field => row[field])); }
  getValue(row, field) { return this.getJsonRow(row)[this.fieldName(field)]; }
  getFieldValues(field, startRow = 0, endRow = -1) { const name = this.fieldName(field); return this.getJsonRows(startRow, endRow).map(row => row[name]); }
  setValue(row, field, value) { this.ready().apply([{ row, field: this.fieldName(field), value }]); }
  updateRow(row, values, strict = false) { if (strict !== false) throw new UnsupportedFeatureError('updateRow.strict'); this.ready().apply(Object.entries(this.rowObject(values, true)).map(([field, value]) => ({ row, field, value }))); }
  addRow(values) { const index = this.getRowCount(); this.ready().insertRows(index, [this.rowObject(values)]); return index; }
  addRows(rows, start = 0, count = -1, rowEvents = false) { if (rowEvents) throw new UnsupportedFeatureError('rowEvents'); const prepared = compatSlice(rows, start, count).map(row => this.rowObject(row)); this.ready().insertRows(this.getRowCount(), prepared); }
  insertRow(row, values) { this.ready().insertRows(row, [this.rowObject(values)]); return row; }
  removeRow(row) { this.ready().removeRows([row]); }
  removeRows(rows, rowEvents = false) { if (rowEvents) throw new UnsupportedFeatureError('rowEvents'); if (!Array.isArray(rows)) throw new TypeError('행 인덱스 배열이 필요합니다.'); this.ready().removeRows(rows); }
  undo() { return this.undoable && this.ready().undo().length > 0; }
  redo() { return this.undoable && this.ready().redo().length > 0; }
  clearCommandStack() { const model = this.ready(); model.past = []; model.future = []; }
  destroy() { if (this.views.size) throw new Error('연결된 GridView를 먼저 destroy하세요.'); this.unsubscribe?.(); this.model = null; this.disposed = true; }
}

class GridView {
  constructor(container) {
    this.host = typeof container === 'string' ? document.getElementById(container) : container;
    if (!this.host || this.host.childNodes.length) throw new Error('빈 컨테이너가 필요합니다.');
    this.provider = null; this.definitions = []; this.editOptions = { editable: true }; this.fixedOptions = { colCount: 0 }; this.destroyed = false;
  }
  ready() { if (!this.grid || this.destroyed) throw new Error('setDataSource와 setColumns가 필요합니다.'); return this.grid; }
  setDataSource(provider) {
    if (!(provider instanceof LocalDataProvider)) throw new TypeError('MOUM LocalDataProvider가 필요합니다.');
    provider.ready(); this.definitions.forEach(column => provider.fieldName(column.fieldName));
    this.grid?.destroy(); this.grid = null; this.provider?.views.delete(this); this.provider = provider; provider.views.add(this); this.mount();
  }
  getDataSource() { return this.provider; }
  setColumns(columns) {
    if (!Array.isArray(columns) || !columns.length) throw new Error('컬럼 배열이 필요합니다.');
    const prepared = columns.map(column => {
      compatKeys(column, ['name', 'fieldName', 'header', 'width', 'editable'], 'column');
      if (!column.name || !column.fieldName) throw new Error('column.name과 fieldName이 필요합니다.');
      if (column.header) compatKeys(column.header, ['text'], 'column.header');
      return { ...column, header: column.header ? { ...column.header } : undefined };
    });
    if (new Set(prepared.map(column => column.name)).size !== prepared.length || new Set(prepared.map(column => column.fieldName)).size !== prepared.length) throw new Error('컬럼 name과 fieldName은 중복될 수 없습니다.');
    if (this.provider) prepared.forEach(column => this.provider.fieldName(column.fieldName));
    this.grid?.destroy(); this.grid = null; this.definitions = prepared; this.mount();
  }
  mount() {
    if (!this.provider || !this.definitions.length) return;
    if (this.destroyed) throw new Error('destroy된 GridView입니다.');
    const columns = this.definitions.map(column => ({ ...this.provider.ready().columns[this.provider.getFieldIndex(column.fieldName)], field: this.provider.fieldName(column.fieldName), header: column.header?.text || column.name, width: column.width, editable: this.editOptions.editable && column.editable !== false }));
    this.grid = new Grid(this.host, { model: this.provider.ready(), columns, editable: this.editOptions.editable, frozenColumns: this.fixedOptions.colCount, onSelectionChange: () => { if (!this.silent) this.onCurrentChanged?.(this, this.getCurrent()); } });
  }
  getColumns() { return this.definitions.map(column => ({ ...column, header: column.header ? { ...column.header } : undefined })); }
  setEditOptions(options) {
    compatKeys(options, ['editable'], 'editOptions');
    if ('editable' in options && typeof options.editable !== 'boolean') throw new TypeError('editable은 boolean입니다.');
    if (this.grid?.editor && !this.grid.finishEdit()) throw new Error('편집을 먼저 완료하세요.');
    this.editOptions = { ...this.editOptions, ...options };
    if (this.grid) { this.grid.options.editable = this.editOptions.editable; this.grid.columns.forEach((column, index) => { column.editable = this.editOptions.editable && this.definitions[index].editable !== false; }); this.grid.render(); }
  }
  getEditOptions() { return { ...this.editOptions }; }
  setFixedOptions(options) { compatKeys(options, ['colCount'], 'fixedOptions'); const count = options.colCount ?? this.fixedOptions.colCount; if (!Number.isInteger(count) || count < 0) throw new RangeError('colCount가 올바르지 않습니다.'); if (this.grid && !this.grid.setFrozenColumns(count)) throw new Error('고정 열을 설정할 수 없습니다.'); this.fixedOptions = { colCount: count }; }
  getFixedOptions() { return { ...this.fixedOptions }; }
  getItemCount() { return this.ready().view.length; }
  getDataRow(itemIndex) { return this.ready().view[itemIndex]?.index ?? -1; }
  getItemIndex(dataRow) { return this.ready().view.findIndex(item => item.index === dataRow); }
  columnIndex(name) { const index = this.definitions.findIndex(column => column.name === name); if (index < 0) throw new RangeError('컬럼을 찾을 수 없습니다.'); return index; }
  getCurrent() {
    const grid = this.ready(); if (!grid.view.length) return { itemIndex: -1, dataRow: -1, column: null, fieldIndex: -1, fieldName: null };
    const column = this.definitions[grid.current.col]; return { itemIndex: grid.current.row, dataRow: this.getDataRow(grid.current.row), column: column.name, fieldIndex: this.provider.getFieldIndex(column.fieldName), fieldName: column.fieldName };
  }
  setCurrent(index) {
    compatKeys(index, ['itemIndex', 'dataRow', 'column', 'fieldName', 'fieldIndex'], 'current');
    const grid = this.ready(), row = index.itemIndex ?? (index.dataRow == null ? grid.current.row : this.getItemIndex(index.dataRow));
    const col = index.column != null ? this.columnIndex(index.column) : index.fieldName != null || index.fieldIndex != null ? this.definitions.findIndex(column => this.provider.fieldName(column.fieldName) === this.provider.fieldName(index.fieldName ?? index.fieldIndex)) : grid.current.col;
    if (!Number.isInteger(row) || row < 0 || row >= grid.view.length || col < 0) throw new RangeError('현재 셀 좌표가 올바르지 않습니다.'); grid.select({ row, col });
  }
  getSelection() { const range = this.ready().getSelection(); return { style: 'block', startItem: range.top, endItem: range.bottom, startColumn: this.definitions[range.left].name, endColumn: this.definitions[range.right].name }; }
  setSelection(selection, eventFire = true) {
    compatKeys(selection, ['style', 'startItem', 'endItem', 'startColumn', 'endColumn'], 'selection'); if (selection.style && selection.style !== 'block') throw new UnsupportedFeatureError('selection.style');
    const grid = this.ready(), a = { row: selection.startItem ?? grid.current.row, col: selection.startColumn == null ? grid.current.col : this.columnIndex(selection.startColumn) }, b = { row: selection.endItem ?? a.row, col: selection.endColumn == null ? a.col : this.columnIndex(selection.endColumn) };
    if ([a.row, b.row].some(row => !Number.isInteger(row) || row < 0 || row >= grid.view.length)) throw new RangeError('선택 행 범위가 올바르지 않습니다.');
    this.silent = !eventFire; try { grid.select(a); grid.select(b, true); } finally { this.silent = false; }
  }
  getValue(itemIndex, field) { return this.provider.getValue(this.getDataRow(itemIndex), field); }
  setValue(itemIndex, field, value) { this.provider.setValue(this.getDataRow(itemIndex), field, value); }
  orderBy(fields = [], directions = [], textCases) {
    if (textCases != null) throw new UnsupportedFeatureError('orderBy.textCases');
    fields = typeof fields === 'string' ? [fields] : fields; directions = typeof directions === 'string' ? [directions] : directions;
    if (!Array.isArray(fields) || !Array.isArray(directions) || directions.some(value => !['ascending', 'descending'].includes(value))) throw new Error('정렬 인수가 올바르지 않습니다.');
    this.ready().setSorts(fields.map((field, index) => ({ field: this.provider.fieldName(field), direction: directions[index] === 'descending' ? -1 : 1 })));
  }
  commit(force = false) { if (force) throw new UnsupportedFeatureError('commit.force'); return this.ready().finishEdit(); }
  cancel() { if (this.ready().editor) this.grid.cancelEdit(); }
  undo() { this.cancel(); return this.provider.undo(); }
  redo() { this.cancel(); return this.provider.redo(); }
  refresh() { if (this.ready().editor && !this.grid.finishEdit()) return; this.grid.render(); }
  destroy() { this.grid?.destroy(); this.grid = null; this.provider?.views.delete(this); this.provider = null; this.destroyed = true; }
}

const compatibility = Object.freeze({ version: '0.5.0', baseline: 'RealGrid2 public API subset', fullCompatibility: false });

// Common unsupported entry points fail by name instead of pretending to apply them.
for (const method of ['setOptions', 'setDisplayOptions', 'setCheckBar', 'setStateBar', 'setColumnLayout', 'setColumnFilters', 'setValidations', 'setPaging', 'groupBy', 'exportGrid']) GridView.prototype[method] = function () { throw new UnsupportedFeatureError(method); };
for (const method of ['getRowState', 'setRowState', 'getAllStateRows', 'clearRowStates', 'setOptions', 'savePoint', 'rollback', 'updateRows', 'fillJsonData', 'fillXmlData', 'fillCsvData']) LocalDataProvider.prototype[method] = function () { throw new UnsupportedFeatureError(method); };

module.exports = { LocalDataProvider, GridView, UnsupportedFeatureError, compatibility };
