export interface InfiniteScrollState<C = unknown> { count: number; cursor: C | null; hasMore: boolean; loading: boolean; error: string | null; renderError:string|null; cacheError:string|null; restored:boolean; limitReached: boolean }
export interface InfiniteScrollOptions<T = unknown, C = unknown> { virtual?:{itemHeight?:number;overscan?:number;height?:number}; cache?:{key:string;ttl?:number;maxBytes?:number;storage?:Storage}; onCacheError?:(error:Error)=>void; title?: string; requestTimeout?: number; auto?: boolean; pageSize?: number; maxItems?: number; initialCursor?: C | null; load: (request: { cursor: C | null; pageSize: number; signal: AbortSignal }) => Promise<{ items: T[]; nextCursor?: C | null; hasMore: boolean }>; renderItem?: (item: T, index: number) => string | HTMLElement; getKey?: (item: T) => string | number; onChange?: (state: InfiniteScrollState<C> & { items: T[] }) => void; onError?: (error: Error) => void }
export interface InfiniteScrollSnapshot<T=unknown,C=unknown> {version:1;items:T[];cursor:C|null;hasMore:boolean;scrollTop:number}
export declare function infiniteWindow(options:{count:number;itemHeight:number;scrollTop?:number;viewportHeight?:number;overscan?:number}):{start:number;end:number;height:number};
export declare function validateInfiniteSnapshot<T,C>(snapshot:InfiniteScrollSnapshot<T,C>,maxItems?:number,getKey?:(item:T)=>string|number):InfiniteScrollSnapshot<T,C>;
export declare class InfiniteScroll<T = unknown, C = unknown> {
 constructor(target: string | HTMLElement, options: InfiniteScrollOptions<T, C>);
 getItems(): T[];
 getState(): InfiniteScrollState<C>;
 getSnapshot():InfiniteScrollSnapshot<T,C>;
 restoreSnapshot(snapshot:InfiniteScrollSnapshot<T,C>):void;
 restoreCache():boolean;
 saveCache():void;
 clearCache():void;
 loadMore(): Promise<boolean>;
 retry(): Promise<boolean>;
 reset(cursor?: C | null): void;
 cancel(): void;
 setAuto(auto: boolean): void;
 destroy(): void;
}
export default InfiniteScroll;
