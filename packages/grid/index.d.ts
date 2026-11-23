/** Public grid API. Row describes the host's raw data, including nulls/formula strings when used. */
export type Field<Row extends object> = Extract<keyof Row, string>;
export type DataMode = 'virtual' | 'infinite' | 'pagination';
export interface Cell { row: number; col: number }
export interface Selection { top: number; bottom: number; left: number; right: number }
export interface ColumnLayout<Row extends object = Record<string, unknown>> {
  field: Field<Row>;
  width?: number;
  visible?: boolean;
}
export interface Column<Row extends object = Record<string, unknown>> {
  field: Field<Row>;
  header?: string;
  type?: 'text' | 'number' | 'boolean';
  width?: number;
  editable?: boolean;
  searchable?: boolean;
  required?: boolean;
  formulas?: boolean;
  defaultValue?: Row[Field<Row>] | ((index: number) => Row[Field<Row>]);
  validate?: (value: unknown) => string | boolean | null | undefined | void;
}
export interface ModelOptions<Row extends object = Record<string, unknown>> {
  editable?: boolean; historyLimit?: number; formulas?: boolean;
  validateRow?: (values: Readonly<Partial<Record<Field<Row>, unknown>>>, row: number) => string | void;
}
export interface ValidationError<Row extends object = Record<string, unknown>> {
  /** Index in the loaded model, not the sorted/filtered display. */
  row: number;
  field: Field<Row> | null;
  value: unknown;
  message: string;
}
export interface ValidationResult<Row extends object = Record<string, unknown>> {
  valid: boolean;
  errors: ValidationError<Row>[];
}
export interface CellInput<Row extends object> { row: number; field: Field<Row>; value: unknown }
export interface CellChange<Row extends object> extends CellInput<Row> { kind?: never; previous: unknown }
export interface RowsChange<Row extends object> { kind: 'rows'; row: -1; field: null; previous: Row[]; value: Row[] }
export type Change<Row extends object> = CellChange<Row> | RowsChange<Row>;
export interface Sort<Row extends object> { field: Field<Row>; direction: 1 | -1 | 'asc' | 'desc' | 'ascending' | 'descending' }
export interface Filter<Row extends object> {
  field: Field<Row>;
  operator: 'contains' | 'startsWith' | 'equals' | 'notEquals' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'empty' | 'notEmpty';
  value?: unknown;
  value2?: unknown;
}
export interface TreeOptions<Row extends object> { idField: Field<Row>; parentField: Field<Row>; labelField: Field<Row> }
export interface PagingState {
  mode: DataMode; pageSize: number; pageIndex: number; pageCount: number;
  total: number; totalRows: number; start: number; end: number; loaded: number; hasMore: boolean;
  draftRows?: number; loading?: boolean; error?: string | null;
}
export interface SelectionStats { count: number; numericCount: number; sum: number; average: number | null; min: number | null; max: number | null }
export interface Criteria<Row extends object> { query: string; sorts: Sort<Row>[]; filters: Filter<Row>[]; filterLogic: 'and' | 'or' }
export interface LoadRequest<Row extends object> extends Criteria<Row> { offset: number; limit: number; pageIndex: number; signal: AbortSignal }
export type RowKey = string | number;
export interface ChangeSet<Row extends object> {
  created: { clientId: string; values: Partial<Row> }[];
  updated: { key: RowKey; version: number; values: Partial<Row> }[];
  deleted: { key: RowKey; version: number }[];
}
export interface SaveRequest<Row extends object> extends ChangeSet<Row> { requestId: string; signal: AbortSignal }
export interface SaveReceipt<Row extends object> {
  requestId: string; created: { clientId: string; row: Row }[]; updated: Row[]; deleted: RowKey[];
}
export interface DataSource<Row extends object> {
  rowKey?: Field<Row>;
  versionField?: Field<Row>;
  timeoutMs?: number;
  load: (request: LoadRequest<Row>) => { rows: Row[]; total: number } | Promise<{ rows: Row[]; total: number }>;
  save?: (request: SaveRequest<Row>) => SaveReceipt<Row> | Promise<SaveReceipt<Row>>;
  exportRows?: (request: Criteria<Row> & { scope: 'all' | 'filtered'; signal: AbortSignal }) => Row[] | Promise<Row[]>;
}
export interface SaveState { status: 'readonly' | 'idle' | 'saving' | 'error' | 'uncertain' | 'refresh'; dirty: boolean; error: string | null; requestId: string | null }
export interface RecoveryOptions { key: string; schemaVersion?: string; maxBytes?: number }
export interface RecoveryState {
  enabled: boolean; dirty: boolean;
  status: 'disabled' | 'loading' | 'available' | 'error' | 'writing' | 'saved' | 'idle';
  candidates?: number; savedAt?: number | null; error?: string | null;
}
export interface GridOptions<Row extends object = Record<string, unknown>> extends ModelOptions<Row> {
  columns: Column<Row>[]; data?: Row[]; model?: GridModel<Row>; dataSource?: DataSource<Row>;
  label?: string; virtual?: boolean; dataMode?: DataMode; pageSize?: number;
  sortLocale?: string | string[];
  pasteAppend?: boolean; frozenColumns?: number; groupBy?: Field<Row>[]; tree?: TreeOptions<Row>;
  selectionSummary?: boolean; recovery?: RecoveryOptions;
  /** Optional local SheetJS object. MOUM does not bundle its types. */
  xlsx?: object;
  onChange?: (event: { reason: string; changes: Change<Row>[]; data: Row[] }) => void;
  onSelectionChange?: (selection: Selection) => void;
  onColumnResize?: (event: { field: Field<Row>; width: number }) => void;
  onDataModeChange?: (state: PagingState) => void;
  onPageChange?: (state: PagingState) => void;
}
export interface ImportOptions { sheetName?: string; header?: boolean }
export interface ExportOptions { fileName?: string; sheetName?: string; scope?: 'view' | 'filtered' | 'all' | 'selection'; formulas?: boolean }
export class Grid<Row extends object = Record<string, unknown>> {
  constructor(target: string | HTMLElement, options: GridOptions<Row>);
  readonly model: GridModel<Row>;
  readonly editable: boolean;
  readonly ready?: Promise<boolean>;
  readonly recoveryReady: Promise<boolean>;
  getData(options?: { raw?: boolean }): Row[];
  setData(rows: Row[]): boolean;
  /** Validates committed loaded rows; call finishEdit() first to include the active editor. */
  validate(): ValidationResult<Row>;
  finishEdit(): boolean;
  getSelection(): Selection;
  getSelectionStats(): SelectionStats;
  select(cell: Cell, extend?: boolean, focus?: boolean): void;
  copySelection(): string;
  paste(value: string | unknown[][]): boolean;
  clearSelection(): void;
  addRow(values?: Partial<Row>): boolean;
  deleteSelectedRows(): boolean;
  undo(): void;
  redo(): void;
  setSearch(text: string): boolean;
  setSorts(sorts: Sort<Row>[]): boolean;
  setFilters(filters: Filter<Row>[], options?: { logic?: 'and' | 'or' }): boolean;
  setColumnWidth(field: Field<Row>, width: number): void;
  getColumnLayout(): Required<ColumnLayout<Row>>[];
  setColumnLayout(layout: readonly ColumnLayout<Row>[]): boolean;
  setFrozenColumns(count: number): boolean;
  setGroupBy(fields: Field<Row>[]): boolean;
  setTree(tree: TreeOptions<Row> | null): boolean;
  toggleNode(id: RowKey): boolean | void;
  mergeSelection(): boolean;
  unmergeSelection(): void;
  setDataMode(mode: DataMode): boolean | Promise<boolean>;
  setPageSize(size: number): boolean | Promise<boolean>;
  setPage(index: number): boolean | Promise<boolean>;
  loadMore(): boolean | Promise<boolean>;
  getPagingState(): PagingState;
  reload(): Promise<boolean>;
  retryLoad(): Promise<boolean>;
  getChanges(): ChangeSet<Row>;
  getSaveState(): SaveState;
  saveChanges(): Promise<boolean>;
  discardChanges(): Promise<boolean>;
  getRecoveryState(): RecoveryState;
  flushDraft(): Promise<boolean>;
  markSaved(): Promise<boolean>;
  restoreDraft(id?: string): Promise<boolean>;
  discardDraft(id?: string): Promise<boolean>;
  downloadDraft(id?: string): boolean;
  importXLSX(file: Blob | ArrayBuffer | ArrayBufferView, options?: ImportOptions): Promise<boolean>;
  exportXLSX(options?: ExportOptions): boolean | Promise<boolean>;
  downloadCSV(): false | void;
  destroy(): void;
}
export class GridModel<Row extends object = Record<string, unknown>> {
  constructor(columns: Column<Row>[], rows?: Row[], options?: ModelOptions<Row>);
  readonly columns: Column<Row>[];
  readonly rows: Row[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly revision: number;
  editable: boolean;
  getData(): Row[];
  getComputedData(): Row[];
  setData(rows: Row[]): void;
  validate(): ValidationResult<Row>;
  apply(changes: CellInput<Row>[], reason?: string): Change<Row>[];
  replaceRows(rows: Row[], reason?: string, validate?: boolean): Change<Row>[];
  insertRows(index: number, rows: Row[]): Change<Row>[];
  removeRows(indices: number[]): Change<Row>[];
  undo(): Change<Row>[];
  redo(): Change<Row>[];
  subscribe(listener: (event: { reason: string; changes: (CellChange<Row> | { kind: 'rows' })[]; revision: number }) => void): () => boolean;
}
export function parseTSV(text: string): string[][];
export function toTSV(rows: unknown[][]): string;
export function isFormula(value: unknown): value is `=${string}`;
export function columnName(index: number): string;
export function translateFormula(expression: string, rowDelta: number, colDelta: number, options?: { absolute?: boolean }): string;
export class FormulaSheet<Row extends object = Record<string, unknown>> {
  constructor(rows: Row[], columns: Column<Row>[]);
  cell(row: number, col: number): { value: unknown; error: string | null };
  getData(): Row[];
}
export function virtualWindow(count: number, scrollTop: number, height: number, rowHeight?: number, overscan?: number): { start: number; end: number; before: number; after: number };
export function columnWindow(columns: { width?: number }[], scrollLeft: number, width: number, frozen?: number, virtual?: boolean): { slots: ({ col: number; width: number } | { gap: true; width: number })[]; offsets: number[]; total: number };
export function readXLSX<Row extends object>(bytes: ArrayBuffer | ArrayBufferView, library: object, columns: Column<Row>[], options?: ImportOptions & { formulas?: boolean }): Row[];
export function writeXLSX<Row extends object>(rows: Row[], library: object, columns: Column<Row>[], options?: { sheetName?: string; formulas?: boolean; merges?: { row: number; col: number; rowSpan: number; colSpan: number }[] }): ArrayBuffer;
export class RemoteData<Row extends object = Record<string, unknown>> {
  constructor(source: DataSource<Row>, options?: { onChange?: () => void; convertRow?: (row: Row) => Row });
  readonly rows: Row[];
  readonly total: number | null;
  readonly loading: boolean;
  readonly error: string | null;
  configure(criteria: Criteria<Row>, mode: 'pagination' | 'infinite', pageSize: number): Promise<boolean>;
  page(index: number): Promise<boolean>;
  more(): Promise<boolean>;
  retry(): Promise<boolean>;
  reload(): Promise<boolean>;
  dispose(): void;
}
export default Grid;
