export interface AlertOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  onClose?: () => void | Promise<void>;
}
export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: (context: { signal: AbortSignal }) => void | Promise<void>;
  onYes?: () => void | Promise<void>;
  onNo?: () => void | Promise<void>;
}
export interface PopoverOptions {
  trigger: string | HTMLButtonElement;
  placement?: 'top' | 'bottom';
  onChange?: (open: boolean) => void;
}
export declare class Popup {
  constructor(target: string | HTMLElement);
  alert(options?: AlertOptions): Promise<void>;
  confirm(options?: ConfirmOptions): Promise<boolean>;
  destroy(): void;
}
export declare class Popover {
  constructor(target: string | HTMLElement, options: PopoverOptions);
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
  updatePosition(): void;
  destroy(): void;
}
export type DialogOptions = Omit<ConfirmOptions, 'onYes' | 'onNo'> & { showCancel?: boolean };
export declare class Dialog {
  constructor(target: string | HTMLElement, options?: DialogOptions);
  open(options?: DialogOptions): Promise<boolean>;
  close(confirmed?: boolean): void;
  destroy(): void;
}
export default Popup;
