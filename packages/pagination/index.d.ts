export interface PageState { total: number; pageSize: number; page: number; pageCount: number; offset: number; from: number; to: number }
export interface PaginationState extends PageState { loading: boolean; error: string | null; historyError:string|null }
export interface PaginationOptions<T = unknown> { history?:{pageKey?:string;sizeKey?:string;mode?:'push'|'replace'}; jump?:boolean; title?: string; requestTimeout?: number; total?: number; pageSize?: number; page?: number; pageSizes?: number[]; disabled?: boolean; load?: (request: PageState & { signal: AbortSignal }) => Promise<{ total: number; data: T }>; onChange?: (state: PaginationState & { data: T | null }) => void; onError?: (error: Error) => void }
export declare function paginationState(options?: { total?: number; pageSize?: number; page?: number }): PageState;
export declare function paginationURLState(url:string,defaults?:{page?:number;pageSize?:number},options?:{pageKey?:string;sizeKey?:string}):{page:number;pageSize:number};
export declare class Pagination<T = unknown> {
 constructor(target: string | HTMLElement, options?: PaginationOptions<T>);
 getState(): PaginationState;
 getData(): T | null;
 goTo(page: number): Promise<boolean>;
 setPageSize(pageSize: number): Promise<boolean>;
 setTotal(total: number): void;
 setDisabled(disabled:boolean):void;
 reload(): Promise<boolean>;
 retry(): Promise<boolean>;
 cancel(): void;
 destroy(): void;
}
export default Pagination;
