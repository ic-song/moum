import { Dialog } from '../../dialog/src/dialog.js';

export class Popup {
  constructor(target) { this.dialog = new Dialog(target); }

  async alert({ onClose, ...options } = {}) {
    if (onClose !== undefined && typeof onClose !== 'function') throw new TypeError('onClose는 함수여야 합니다.');
    await this.dialog.open({ ...options, showCancel: false });
    await onClose?.();
  }

  async confirm({ onYes, onNo, ...options } = {}) {
    if ([onYes, onNo].some(callback => callback !== undefined && typeof callback !== 'function')) {
      throw new TypeError('onYes와 onNo는 함수여야 합니다.');
    }
    const confirmed = await this.dialog.open({ cancelLabel: '아니오', confirmLabel: '예', ...options, showCancel: true });
    const callback = confirmed ? onYes : onNo;
    await callback?.();
    return confirmed;
  }

  destroy() { this.dialog.destroy(); }
}
