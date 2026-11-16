export type CalendarView = 'month' | 'week' | 'day' | 'agenda';
export interface CalendarRecurrence { frequency: 'daily' | 'weekly'; interval?: number; until: string }
export interface CalendarEvent { id: string | number; title?: string; start: string; end: string; allDay?: boolean; description?: string; recurrence?: CalendarRecurrence | null; exceptions?: string[] }
export interface CalendarOccurrence extends CalendarEvent { occurrenceId: string; seriesId: string }
export interface CalendarOptions { title?: string; view?: CalendarView; date?: string; weekStartsOn?: number; editable?: boolean; events?: CalendarEvent[]; onChange?: (change: { type: string; id?: string; events: CalendarEvent[] }) => void; onSelect?: (event: CalendarOccurrence) => void; onViewChange?: (state: { view: CalendarView; date: string }) => void; onError?: (error: Error) => void }
export interface CalendarRange { start: string; end: string }
export declare const calendarDay: number;
export declare function calendarDate(value: string): number;
export declare function addCalendarDays(value: string, count: number): string;
export declare function calendarStamp(value: string, allDay: boolean): number;
export declare function normalizeEvents(events: CalendarEvent[]): CalendarEvent[];
export declare function calendarRange(date: string, view?: CalendarView, weekStartsOn?: number): CalendarRange;
export declare function expandCalendarEvents(events: CalendarEvent[], range: CalendarRange): CalendarOccurrence[];
export declare function calendarLanes<T extends { start: string; end: string }>(events: T[]): (T & { lane: number; laneCount: number })[];
export declare class CalendarModel {
  constructor(events?: CalendarEvent[]);
  getEvents(): CalendarEvent[];
  setEvents(events: CalendarEvent[]): void;
  addEvent(event: CalendarEvent): void;
  updateEvent(id: string | number, patch: Partial<CalendarEvent>): void;
  removeEvent(id: string | number): void;
  setOccurrenceExcluded(id: string | number, date: string, excluded?: boolean): void;
  getOccurrences(range: CalendarRange): CalendarOccurrence[];
  undo(): boolean;
  redo(): boolean;
}
export declare class Calendar {
  constructor(target: string | HTMLElement, options?: CalendarOptions);
  getEvents(): CalendarEvent[];
  getOccurrences(range?: CalendarRange): CalendarOccurrence[];
  setEvents(events: CalendarEvent[]): void;
  addEvent(event: CalendarEvent): void;
  updateEvent(id: string | number, patch: Partial<CalendarEvent>): void;
  removeEvent(id: string | number): void;
  setOccurrenceExcluded(id: string | number, date: string, excluded?: boolean): void;
  setView(view: CalendarView): void;
  setDate(date: string): void;
  undo(): void;
  redo(): void;
  destroy(): void;
}
export default Calendar;
