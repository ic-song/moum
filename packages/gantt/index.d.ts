export type GanttDependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export interface GanttDependency { taskId: string | number; type?: GanttDependencyType; lagDays?: number }
export interface GanttTask { id: string | number; name?: string; start: string; end: string; progress?: number; dependencies?: (string | number | GanttDependency)[]; parentId?: string | number | null; type?: 'task' | 'milestone'; baseline?: GanttRange | null; deadline?: string | null }
export interface DeliveryLine { id: string | number; dueDate: string; quantity: number }
export interface GoodsReceipt { id: string | number; lineId: string | number; date: string; quantity: number }
export interface DeliveryQuantities { planned: number; received: number; open: number; excess: number; overdue: number }
export declare function summarizeDeliveries(
  lines: DeliveryLine[], receipts: GoodsReceipt[], options?: { asOf?: string; precision?: number }
): { lines: ({ id: string; dueDate: string } & DeliveryQuantities)[]; totals: DeliveryQuantities };
export interface GanttWarning { taskId: string; predecessorId: string; message: string }
export interface GanttChange { type: string; id?: string; tasks: GanttTask[]; warnings: GanttWarning[] }
export interface GanttRange { start: string; end: string }
export interface GanttScheduleStatus {
  id: string;
  startVarianceDays: number | null;
  finishVarianceDays: number | null;
  deadlineVarianceDays: number | null;
  overdue: boolean;
}
export interface GanttWorkCalendar {weekendDays?:number[];holidays?:string[]}
export declare function normalizeWorkCalendar(calendar?:GanttWorkCalendar|null): {weekendDays:number[];holidays:string[]} | null;
export declare function isGanttWorkday(date:string,calendar?:GanttWorkCalendar|null):boolean;
export declare function ganttWorkingDays(start:string,end:string,calendar?:GanttWorkCalendar|null):number;
export type MiniGanttType = 'bars' | 'compact' | 'summary' | 'milestones';
export interface GanttViewState {
  version: 1;
  view: 'full' | 'mini';
  scale: 'day' | 'week' | 'month';
  range: GanttRange | null;
  mini: { type: MiniGanttType; header?: boolean; labels?: boolean; status?: boolean };
  collapsedTaskIds: string[];
}
export interface GanttSummary extends GanttRange {progress:number;taskCount:number;milestoneCount:number}
export interface GanttOptions { workCalendar?: GanttWorkCalendar; title?: string; tasks?: GanttTask[]; scale?: 'day' | 'week' | 'month'; view?: 'full' | 'mini'; range?: GanttRange | null; mini?: {type?:MiniGanttType;header?:boolean;labels?:boolean;status?:boolean}; editable?: boolean; onChange?: (change: GanttChange) => void; onSelect?: (task: GanttTask) => void; onError?: (error: Error) => void }
export declare const ganttDay: number;
export declare function ganttDate(value: string): number;
export declare function shiftGanttDate(value: string, days: number): string;
export declare function normalizeTasks(tasks: GanttTask[]): GanttTask[];
export declare function ganttSummary(tasks: GanttTask[]): GanttSummary | null;
export declare class GanttModel {
  constructor(tasks?: GanttTask[], options?: {workCalendar?:GanttWorkCalendar});
  getTasks(): GanttTask[];
  setTasks(tasks: GanttTask[]): void;
  updateTask(id: string | number, patch: Partial<GanttTask>): GanttTask[];
  addTask(task: GanttTask): GanttTask[];
  captureBaseline(): boolean;
  getScheduleStatus(options?: { asOf?: string }): GanttScheduleStatus[];
  scheduleDependencies(): GanttTask[];
  removeTask(id: string | number): GanttTask[];
  undo(): boolean;
  redo(): boolean;
  getWarnings(): GanttWarning[];
}
export declare class Gantt {
  constructor(target: string | HTMLElement, options?: GanttOptions);
  getTasks(): GanttTask[];
  getWarnings(): GanttWarning[];
  setTasks(tasks: GanttTask[]): void;
  updateTask(id: string | number, patch: Partial<GanttTask>): void;
  addTask(task: GanttTask): void;
  captureBaseline(): boolean;
  getScheduleStatus(options?: { asOf?: string }): GanttScheduleStatus[];
  scheduleDependencies(): void;
  removeTask(id: string | number): void;
  setScale(scale: 'day' | 'week' | 'month'): void;
  setView(view: 'full' | 'mini'): void;
  setMiniType(type: MiniGanttType): void;
  getViewState(): GanttViewState;
  setViewState(state: GanttViewState): void;
  getSummary(): GanttSummary | null;
  setRange(range: GanttRange | null): void;
  getRange(): GanttRange | null;
  selectTask(id: string): void;
  undo(): void;
  redo(): void;
  destroy(): void;
}
export default Gantt;
