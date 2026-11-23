export type ChartType = 'bar' | 'horizontalBar' | 'stackedBar' | 'stackedHorizontalBar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'mixed';
export interface ChartData { labels: string[]; datasets: { label?: string; color?: string; type?: 'bar'|'line'; axis?: 'left'|'right'; data: (number | null | { x: number; y: number })[] }[] }
export interface ChartSelection { seriesIndex: number; pointIndex: number; label?: string; value: number | null | { x: number; y: number } }
export interface ChartViewState { version: 1; type: ChartType; labels: string[]; hidden: number[]; tableOpen: boolean }
export interface ChartOptions { type?: ChartType; title?: string; locale?: string; data?: ChartData; axes?: {left?: {title?: string;unit?:string};right?: {title?:string;unit?:string}}; onSelect?: (point: ChartSelection) => void }
export declare const chartTypes: readonly ChartType[];
export declare function normalizeChart(data: ChartData, type?: ChartType): ChartData;
export declare function chartExtent(values: number[], includeZero?: boolean): [number, number];
export declare function chartStacks(datasets: ChartData['datasets'], count: number): {segments: ({start:number;end:number}|null)[][];extent:[number,number]};
export declare class Charts {
  constructor(target: string | HTMLElement, options?: ChartOptions);
  setData(data: ChartData): void;
  getData(): ChartData;
  setType(type: ChartType): void;
  setOptions(options: ChartOptions): void;
  getViewState(): ChartViewState;
  setViewState(state: ChartViewState): void;
  selectPoint(seriesIndex: number, pointIndex: number): void;
  toSVG(): string;
  toPNG(options?: {scale?: number}): Promise<Blob>;
  destroy(): void;
}
export default Charts;
