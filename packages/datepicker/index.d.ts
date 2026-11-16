export type DatePickerValue = string | { start: string; end: string | null } | null;
export interface DatePickerOptions { title?: string; locale?: string; mode?: 'single' | 'range'; value?: DatePickerValue; date?: string; min?: string; max?: string; weekStartsOn?: number; disabled?: boolean; disabledWeekdays?: number[]; isDateDisabled?: (date: string) => boolean; name?: string; onChange?: (value: DatePickerValue) => void; onError?: (error: Error) => void }
export declare function dateValue(value: string): number;
export declare class DatePickerModel {
 constructor(options?: DatePickerOptions);
 getValue(): DatePickerValue;
 setValue(value: DatePickerValue): void;
 select(date: string): DatePickerValue;
 isDisabled(date: string): boolean;
}
export declare class DatePicker {
 static attach(input: string | HTMLInputElement, options?: DatePickerOptions): DatePicker;
 open(): void;
 close(restoreFocus?: boolean): void;
 constructor(target: string | HTMLElement, options?: DatePickerOptions);
 getValue(): DatePickerValue;
 setValue(value: DatePickerValue): void;
 setDisabled(disabled: boolean): void;
 clear(): void;
 destroy(): void;
}
export default DatePicker;
