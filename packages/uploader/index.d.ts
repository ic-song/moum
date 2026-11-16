export interface UploadLimits { maxFileSize?: number; maxRows?: number; maxColumns?: number; maxExpandedBytes?: number; maxCellLength?: number }
export interface UploadSchemaField { field: string; label?: string; type?: 'string' | 'number' | 'integer' | 'boolean' | 'date'; required?: boolean; trim?: boolean; min?: number; max?: number; validate?: (value: unknown, row: number) => boolean | string | void }
export interface UploadError { row: number | null; field: string; message: string }
export interface UploadSheet { name: string; rows: unknown[][]; rowNumbers: number[]; cellErrors: { row: number; column: number; message: string }[] }
export interface UploadColumn { key: string; label: string; index: number }
export interface UploadTable { columns: UploadColumn[]; rows: unknown[][]; rowNumbers: number[]; cellErrors?: UploadSheet['cellErrors'] }
export interface UploadValidation { data: Record<string, unknown>[]; validData: Record<string, unknown>[]; errors: UploadError[]; valid: boolean; invalidRows: number[] }
export interface UploadFileInfo { id: string; name: string; size: number; type: string; status: 'reading' | 'ready' | 'invalid' | 'uploading' | 'uploaded' | 'error' | 'cancelled'; progress: number; error: string; sheetName: string | null; rowCount: number; errorCount: number }
export interface UploadMetadata { sheetName: string | null; headerRow: number; mapping: Record<string, string>; edited?: boolean }
export interface UploadRequest { file: File; data: Record<string, unknown>[] | null; signal: AbortSignal; onProgress: (percent: number) => void; metadata: UploadMetadata }
export type UploadTransport = (request: UploadRequest) => Promise<unknown>;
export interface XHRTransportOptions { method?: string; fieldName?: string; timeout?: number; withCredentials?: boolean; headers?: Record<string, string> }
export interface UploaderOptions extends UploadLimits { title?: string; editable?: boolean; maxFiles?: number; pageSize?: number; uploadTimeout?: number; accept?: string; schema?: UploadSchemaField[]; encoding?: 'utf-8' | 'euc-kr' | 'utf-16le'; delimiter?: ',' | '\t' | ';' | '|'; excelLibrary?: unknown; url?: string; transportOptions?: XHRTransportOptions; onUpload?: UploadTransport; onChange?: (files: UploadFileInfo[]) => void; onError?: (detail: { id: string; error: Error }) => void; onUploaded?: (detail: { id: string; file: File; result: unknown }) => void }
export declare const uploadLimits: Required<UploadLimits>;
export declare function normalizeUploadLimits(options?: UploadLimits): Required<UploadLimits>;
export declare function parseDelimited(text: string, options?: UploadLimits & { delimiter?: string }): { rows: string[][]; rowNumbers: number[]; delimiter: string };
export declare function checkWorkbookArchive(bytes: ArrayBuffer | Uint8Array, maxExpandedBytes?: number): 'xls' | 'xlsx';
export declare function readWorkbookSheet(workbook: unknown, sheetName: string, library: unknown, options?: UploadLimits): UploadSheet;
export declare function parseUploadFile(file: File, options?: UploaderOptions): Promise<{ kind: 'file' | 'table' | 'workbook'; sheets: UploadSheet[] }>;
export declare function tableFromSheet(sheet: UploadSheet, headerRow?: number): UploadTable;
export declare function normalizeUploadSchema(schema?: UploadSchemaField[]): UploadSchemaField[];
export declare function autoUploadMapping(columns: UploadColumn[], schema: UploadSchemaField[]): Record<string, string>;
export declare function validateUploadTable(table: UploadTable, schema?: UploadSchemaField[], mapping?: Record<string, string>): UploadValidation;
export declare function uploadCSV(rows: unknown[][]): string;
export declare function createXHRTransport(url: string, options?: XHRTransportOptions): UploadTransport;
export declare function performUpload(transport: UploadTransport, request: UploadRequest, timeout?: number): Promise<unknown>;
export declare function downloadUploadFile(content: string | ArrayBuffer, name: string, type?: string): void;
export declare class Uploader {
  constructor(target: string | HTMLElement, options?: UploaderOptions);
  addFiles(files: File[] | FileList): Promise<string[]>;
  getFiles(): UploadFileInfo[];
  getData(id: string, options?: { validOnly?: boolean }): Record<string, unknown>[];
  getErrors(id: string): UploadError[];
  getMapping(id: string): Record<string, string>;
  getSelectedFileId(): string | null;
  selectFile(id: string): void;
  selectSheet(id: string, index: number): void;
  setHeaderRow(id: string, row: number): void;
  setMapping(id: string, mapping: Record<string, string>): void;
  editCell(id: string, sourceRow: number, columnKey: string, value: string | number | boolean | null): void;
  upload(id: string): Promise<unknown>;
  uploadAll(): Promise<void>;
  retry(id: string): Promise<unknown>;
  cancel(id: string): void;
  removeFile(id: string): void;
  clear(): void;
  destroy(): void;
}
export default Uploader;
