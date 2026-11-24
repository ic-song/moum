/*! MOUM dialog v0.3.0 | MIT License | See LICENSE */
(function () {
'use strict';
let moumDialogSequence = 0;

class Dialog {
  constructor(target, options = {}) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host || host.childNodes.length) throw new Error('비어 있는 대화상자 컨테이너가 필요합니다.');
    this.options = options;
    let prefix;
    do { prefix = `moum-dialog-${++moumDialogSequence}`; } while (document.getElementById(prefix + '-title') || document.getElementById(prefix + '-message'));
    this.root = document.createElement('dialog');
    this.root.className = 'moum-dialog';
    this.title = document.createElement('h2');
    this.title.id = prefix + '-title';
    this.message = document.createElement('p');
    this.message.id = prefix + '-message';
    this.feedback = document.createElement('p');
    this.feedback.className = 'moum-dialog-feedback';
    this.feedback.setAttribute('role', 'status');
    this.feedback.hidden = true;
    this.root.setAttribute('aria-labelledby', this.title.id);
    this.root.setAttribute('aria-describedby', this.message.id);
    const actions = document.createElement('div');
    actions.className = 'moum-dialog-actions';
    this.cancelButton = document.createElement('button');
    this.confirmButton = document.createElement('button');
    this.cancelButton.type = this.confirmButton.type = 'button';
    this.cancelButton.autofocus = true;
    this.confirmButton.className = 'moum-dialog-confirm';
    this.cancelButton.addEventListener('click', () => this.close());
    this.confirmButton.addEventListener('click', () => { void this.confirm(); });
    this.root.addEventListener('cancel', () => this.abortConfirmation());
    this.root.addEventListener('close', () => {
      this.abortConfirmation();
      this.settle(this.root.returnValue === 'confirm');
    });
    actions.append(this.cancelButton, this.confirmButton);
    this.root.append(this.title, this.message, this.feedback, actions);
    host.append(this.root);
  }

  async open(options = {}) {
    if (this.destroyed) throw new Error('이미 제거된 대화상자입니다.');
    if (this.resolve) throw new Error('대화상자가 이미 열렸습니다.');
    const { title = '확인', message = '', cancelLabel = '취소', confirmLabel = '확인', onConfirm, showCancel = true } = { ...this.options, ...options };
    if (![title, cancelLabel, confirmLabel].every(text => typeof text === 'string' && text.trim()) || typeof message !== 'string') throw new TypeError('제목과 버튼 이름은 비어 있지 않은 문자열이어야 합니다.');
    if (onConfirm !== undefined && typeof onConfirm !== 'function') throw new TypeError('onConfirm은 함수여야 합니다.');
    if (typeof showCancel !== 'boolean') throw new TypeError('showCancel은 boolean입니다.');
    this.onConfirm = onConfirm;
    this.title.textContent = title;
    this.message.textContent = message;
    this.cancelButton.textContent = cancelLabel;
    this.confirmButton.textContent = confirmLabel;
    this.cancelButton.hidden = !showCancel;
    this.cancelButton.autofocus = showCancel;
    this.confirmButton.autofocus = !showCancel;
    this.setFeedback('');
    this.root.returnValue = '';
    const result = new Promise(resolve => { this.resolve = resolve; });
    try { this.root.showModal(); }
    catch (error) { this.settle(false); throw error; }
    return result;
  }

  setFeedback(message) {
    this.feedback.hidden = !message;
    this.feedback.textContent = message;
  }

  async confirm() {
    if (this.confirmation || !this.root.open) return;
    if (!this.onConfirm) { this.close(true); return; }
    const controller = new AbortController();
    this.confirmation = controller;
    this.confirmButton.setAttribute('aria-disabled', 'true');
    this.setFeedback('처리 중입니다.');
    try {
      await this.onConfirm({ signal: controller.signal });
      if (this.confirmation === controller && this.root.open) {
        this.confirmation = null;
        this.confirmButton.removeAttribute('aria-disabled');
        this.close(true);
      }
    } catch (error) {
      if (this.confirmation === controller && this.root.open) {
        this.confirmation = null;
        this.confirmButton.removeAttribute('aria-disabled');
        this.setFeedback(error instanceof Error && error.message ? error.message : '처리하지 못했습니다. 다시 시도하세요.');
      }
    }
  }

  abortConfirmation() {
    const controller = this.confirmation;
    this.confirmation = null;
    this.confirmButton.removeAttribute('aria-disabled');
    controller?.abort();
  }

  close(confirmed = false) {
    if (!this.root.open) return;
    if (confirmed === true && this.confirmation) return;
    this.root.close(confirmed === true ? 'confirm' : '');
    this.abortConfirmation();
  }

  settle(confirmed) {
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.(confirmed);
  }

  destroy() {
    this.destroyed = true;
    this.close();
    this.abortConfirmation();
    this.settle(false);
    this.root.remove();
  }
}

globalThis.MoumDialog = Dialog;
Object.assign(globalThis.MoumDialog, {  });
})();
