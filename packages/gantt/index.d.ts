export interface GanttTask { id: string | number; name?: string; start: string; end: string; progress?: number; dependencies?: (string | number)[]; parentId?: string | number | null; type?: 'task' | 'milestone' }
export interface GanttWarning { taskId: string; predecessorId: string; message: string }
export interface GanttChange { type: string; id?: string; tasks: GanttTask[]; warnings: GanttWarning[] }
export interface GanttOptions { title?: string; tasks?: GanttTask[]; scale?: 'day' | 'week' | 'month'; editable?: boolean; onChange?: (change: GanttChange) => void; onSelect?: (task: GanttTask) => void; onError?: (error: Error) => void }
export declare const ganttDay: number;
export declare function ganttDate(value: string): number;
export declare function shiftGanttDate(value: string, days: number): string;
export declare function normalizeTasks(tasks: GanttTask[]): GanttTask[];
export declare class GanttModel {
  constructor(tasks?: GanttTask[]);
  getTasks(): GanttTask[];
  setTasks(tasks: GanttTask[]): void;
  updateTask(id: string | number, patch: Partial<GanttTask>): GanttTask[];
  addTask(task: GanttTask): GanttTask[];
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
  removeTask(id: string | number): void;
  setScale(scale: 'day' | 'week' | 'month'): void;
  selectTask(id: string): void;
  undo(): void;
  redo(): void;
  destroy(): void;
}
export default Gantt;
