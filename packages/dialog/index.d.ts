export interface DialogOptions { title?: string; message?: string; cancelLabel?: string; confirmLabel?: string; showCancel?: boolean; onConfirm?: (context: { signal: AbortSignal }) => void | Promise<void> }
export declare class Dialog {
  constructor(target: string | HTMLElement, options?: DialogOptions);
  open(options?: DialogOptions): Promise<boolean>;
  close(confirmed?: boolean): void;
  destroy(): void;
}
export default Dialog;
