/*! MOUM popup v0.1.0 | MIT License | See LICENSE */
let moumDialogSequence = 0;

export class Dialog {
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

let moumPopoverSequence = 0;

export class Popover {
  constructor(target, { trigger, placement = 'bottom', onChange } = {}) {
    const panel = typeof target === 'string' ? document.querySelector(target) : target;
    const button = typeof trigger === 'string' ? document.querySelector(trigger) : trigger;
    if (!(panel instanceof HTMLElement) || !(button instanceof HTMLButtonElement) || button.type !== 'button'
        || !panel.isConnected || !button.isConnected || panel.getRootNode() !== button.getRootNode() || panel.contains(button) || button.contains(panel)) {
      throw new TypeError('같은 문서에 연결된 패널과 type="button" 버튼이 필요합니다.');
    }
    if (typeof panel.showPopover !== 'function') throw new Error('Popover API를 지원하는 브라우저가 필요합니다.');
    if (!['top', 'bottom'].includes(placement)) throw new TypeError('placement는 top 또는 bottom입니다.');
    if (panel.hasAttribute('popover') || button.popoverTargetElement || button.hasAttribute('popovertarget')) throw new Error('이미 팝오버에 연결된 요소입니다.');
    this.panel = panel;
    this.button = button;
    this.placement = placement;
    this.onChange = onChange;
    this.previousId = panel.getAttribute('id');
    this.hadClass = panel.classList.contains('moum-popover');
    this.previousAction = button.getAttribute('popovertargetaction');
    this.previousStyles = ['--moum-popover-x', '--moum-popover-y', '--moum-popover-height', '--moum-popover-width'].map(property =>
      [property, panel.style.getPropertyValue(property), panel.style.getPropertyPriority(property)]);
    const tree = panel.getRootNode();
    if (!panel.id || tree.getElementById(panel.id) !== panel) {
      let id;
      do { id = `moum-popover-${++moumPopoverSequence}`; } while (tree.getElementById(id));
      panel.id = id;
    }
    panel.classList.add('moum-popover');
    panel.setAttribute('popover', 'auto');
    button.setAttribute('popovertarget', panel.id);
    button.setAttribute('popovertargetaction', 'toggle');
    this.events = new AbortController();
    panel.addEventListener('toggle', () => {
      if (this.isOpen()) {
        this.watchPosition();
        this.updatePosition();
        this.onChange?.(true);
      } else {
        this.stopPosition();
        this.onChange?.(false);
      }
    }, { signal: this.events.signal });
  }

  isOpen() { return !this.destroyed && this.panel.matches(':popover-open'); }

  open() {
    if (this.destroyed) throw new Error('이미 제거된 팝오버입니다.');
    if (!this.isOpen()) this.panel.showPopover({ source: this.button });
    this.updatePosition();
  }

  close() { if (this.isOpen()) this.panel.hidePopover(); }

  toggle() { if (this.isOpen()) this.close(); else this.open(); }

  watchPosition() {
    if (this.positionEvents) return;
    this.positionEvents = new AbortController();
    const { signal } = this.positionEvents;
    const resize = () => {
      if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.updatePosition(); });
    };
    window.addEventListener('resize', resize, { signal });
    window.addEventListener('scroll', resize, { capture: true, signal });
    window.visualViewport?.addEventListener('resize', resize, { signal });
    window.visualViewport?.addEventListener('scroll', resize, { signal });
    this.observer = new ResizeObserver(resize);
    this.observer.observe(this.panel);
    this.observer.observe(this.button);
  }

  stopPosition() {
    this.positionEvents?.abort();
    this.positionEvents = null;
    this.observer?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  updatePosition() {
    if (!this.isOpen()) return;
    if (!this.button.getClientRects().length) { this.close(); return; }
    const viewport = window.visualViewport, doc = document.documentElement;
    const margin = 8, gap = 8;
    const left = (viewport?.offsetLeft ?? 0) + margin, top = (viewport?.offsetTop ?? 0) + margin;
    const right = left + (viewport?.width ?? doc.clientWidth) - 2 * margin;
    const bottom = top + (viewport?.height ?? doc.clientHeight) - 2 * margin;
    const anchor = this.button.getBoundingClientRect(), panel = this.panel;
    panel.style.setProperty('--moum-popover-width', `${Math.max(0, right - left)}px`);
    const belowTop = Math.max(top, Math.min(bottom, anchor.bottom + gap));
    const aboveBottom = Math.max(top, Math.min(bottom, anchor.top - gap));
    const below = bottom - belowTop, above = aboveBottom - top;
    const desired = panel.scrollHeight + panel.offsetHeight - panel.clientHeight;
    const preferTop = this.placement === 'top';
    const placeTop = preferTop ? above >= desired || above >= below : below < desired && above > below;
    panel.style.setProperty('--moum-popover-height', `${Math.max(0, placeTop ? above : below)}px`);
    const box = panel.getBoundingClientRect();
    const rtl = getComputedStyle(this.button).direction === 'rtl';
    const x = Math.max(left, Math.min(right - box.width, rtl ? anchor.right - box.width : anchor.left));
    const y = Math.max(top, placeTop ? aboveBottom - box.height : belowTop);
    panel.style.setProperty('--moum-popover-x', `${x}px`);
    panel.style.setProperty('--moum-popover-y', `${y}px`);
  }

  destroy() {
    if (this.destroyed) return;
    this.close();
    this.destroyed = true;
    this.events.abort();
    this.stopPosition();
    this.panel.removeAttribute('popover');
    this.button.removeAttribute('popovertarget');
    if (this.previousAction === null) this.button.removeAttribute('popovertargetaction');
    else this.button.setAttribute('popovertargetaction', this.previousAction);
    if (this.previousId === null) this.panel.removeAttribute('id');
    else this.panel.setAttribute('id', this.previousId);
    if (!this.hadClass) this.panel.classList.remove('moum-popover');
    for (const [property, value, priority] of this.previousStyles) this.panel.style.setProperty(property, value, priority);
  }
}

export default Popup;
