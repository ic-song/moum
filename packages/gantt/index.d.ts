export interface GanttTask { id: string | number; name?: string; start: string; end: string; progress?: number; dependencies?: (string | number)[]; parentId?: string | number | null; type?: 'task' | 'milestone' }
export interface GanttWarning { taskId: string; predecessorId: string; message: string }
export interface GanttChange { type: string; id?: string; tasks: GanttTask[]; warnings: GanttWarning[] }
export interface GanttRange { start: string; end: string }
export type MiniGanttType = 'bars' | 'compact' | 'summary' | 'milestones';
export interface GanttSummary extends GanttRange {progress:number;taskCount:number;milestoneCount:number}
export interface GanttOptions { title?: string; tasks?: GanttTask[]; scale?: 'day' | 'week' | 'month'; view?: 'full' | 'mini'; range?: GanttRange | null; mini?: {type?:MiniGanttType;header?:boolean;labels?:boolean;status?:boolean}; editable?: boolean; onChange?: (change: GanttChange) => void; onSelect?: (task: GanttTask) => void; onError?: (error: Error) => void }
export declare const ganttDay: number;
export declare function ganttDate(value: string): number;
export declare function shiftGanttDate(value: string, days: number): string;
export declare function normalizeTasks(tasks: GanttTask[]): GanttTask[];
export declare function ganttSummary(tasks: GanttTask[]): GanttSummary | null;
export declare class GanttModel {
  constructor(tasks?: GanttTask[]);
  getTasks(): GanttTask[];
  setTasks(tasks: GanttTask[]): void;
  updateTask(id: string | number, patch: Partial<GanttTask>): GanttTask[];
  addTask(task: GanttTask): GanttTask[];
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
  scheduleDependencies(): void;
  removeTask(id: string | number): void;
  setScale(scale: 'day' | 'week' | 'month'): void;
  setView(view: 'full' | 'mini'): void;
  setMiniType(type: MiniGanttType): void;
  getSummary(): GanttSummary | null;
  setRange(range: GanttRange | null): void;
  getRange(): GanttRange | null;
  selectTask(id: string): void;
  undo(): void;
  redo(): void;
  destroy(): void;
}
export default Gantt;
