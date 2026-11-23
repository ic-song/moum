/** Only the implemented RealGrid public API subset is declared. */
export interface ProviderField { fieldName: string; dataType?: 'text' | 'number' | 'boolean'; defaultValue?: unknown }
export interface CompatColumn { name: string; fieldName: string; header?: { text?: string }; width?: number; editable?: boolean }
export interface Current { itemIndex: number; dataRow: number; column: string | null; fieldIndex: number; fieldName: string | null }
export interface BlockSelection { style: 'block'; startItem: number; endItem: number; startColumn: string; endColumn: string }
export class UnsupportedFeatureError extends Error { constructor(feature: string) }
export class LocalDataProvider {
  constructor(undoable?: boolean);
  onValueChanged?: (provider: LocalDataProvider, row: number, field: number) => void;
  readonly rowCount: number;
  setFields(fields: (string | ProviderField)[]): void;
  getFields(): ProviderField[];
  getFieldCount(): number;
  getFieldNames(): string[];
  getOrgFieldNames(): string[];
  getFieldIndex(name: string): number;
  getFieldName(index: number): string | undefined;
  getOrgFieldName(index: number): string | undefined;
  setRows(rows: (Record<string, unknown> | unknown[])[], start?: number, count?: number): void;
  clearRows(): void;
  getRowCount(): number;
  getJsonRow(row: number, rowState?: false): Record<string, unknown>;
  getJsonRows(startRow?: number, endRow?: number, rowState?: false): Record<string, unknown>[];
  getRows(startRow?: number, endRow?: number): unknown[][];
  getValue(row: number, field: string | number): unknown;
  getFieldValues(field: string | number, startRow?: number, endRow?: number): unknown[];
  setValue(row: number, field: string | number, value: unknown): void;
  updateRow(row: number, values: Record<string, unknown> | unknown[], strict?: false): void;
  addRow(values: Record<string, unknown> | unknown[]): number;
  addRows(rows: (Record<string, unknown> | unknown[])[], start?: number, count?: number, rowEvents?: false): void;
  insertRow(row: number, values: Record<string, unknown> | unknown[]): number;
  removeRow(row: number): void;
  removeRows(rows: number[], rowEvents?: false): void;
  undo(): boolean;
  redo(): boolean;
  clearCommandStack(): void;
  destroy(): void;
}
export class GridView {
  constructor(container: string | HTMLElement);
  onCurrentChanged?: (grid: GridView, current: Current) => void;
  setDataSource(provider: LocalDataProvider): void;
  getDataSource(): LocalDataProvider | null;
  setColumns(columns: CompatColumn[]): void;
  getColumns(): CompatColumn[];
  setEditOptions(options: { editable?: boolean }): void;
  getEditOptions(): { editable: boolean };
  setFixedOptions(options: { colCount?: number }): void;
  getFixedOptions(): { colCount: number };
  getItemCount(): number;
  getDataRow(itemIndex: number): number;
  getItemIndex(dataRow: number): number;
  getCurrent(): Current;
  setCurrent(current: Partial<{ itemIndex: number; dataRow: number; column: string; fieldName: string; fieldIndex: number }>): void;
  getSelection(): BlockSelection;
  setSelection(selection: Partial<BlockSelection>, eventFire?: boolean): void;
  getValue(itemIndex: number, field: string | number): unknown;
  setValue(itemIndex: number, field: string | number, value: unknown): void;
  orderBy(fields?: string | (string | number)[], directions?: 'ascending' | 'descending' | ('ascending' | 'descending')[]): void;
  commit(force?: false): boolean;
  cancel(): void;
  undo(): boolean;
  redo(): boolean;
  refresh(): void;
  destroy(): void;
}
export const compatibility: Readonly<{ version: string; baseline: string; fullCompatibility: false }>;
