export interface InfiniteScrollState<C = unknown> { count: number; cursor: C | null; hasMore: boolean; loading: boolean; error: string | null; limitReached: boolean }
export interface InfiniteScrollOptions<T = unknown, C = unknown> { title?: string; requestTimeout?: number; auto?: boolean; pageSize?: number; maxItems?: number; initialCursor?: C | null; load: (request: { cursor: C | null; pageSize: number; signal: AbortSignal }) => Promise<{ items: T[]; nextCursor?: C | null; hasMore: boolean }>; renderItem?: (item: T, index: number) => string | HTMLElement; getKey?: (item: T) => string | number; onChange?: (state: InfiniteScrollState<C> & { items: T[] }) => void; onError?: (error: Error) => void }
export declare class InfiniteScroll<T = unknown, C = unknown> {
 constructor(target: string | HTMLElement, options: InfiniteScrollOptions<T, C>);
 getItems(): T[];
 getState(): InfiniteScrollState<C>;
 loadMore(): Promise<boolean>;
 retry(): Promise<boolean>;
 reset(cursor?: C | null): void;
 cancel(): void;
 setAuto(auto: boolean): void;
 destroy(): void;
}
export default InfiniteScroll;
