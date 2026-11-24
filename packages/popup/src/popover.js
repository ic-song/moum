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
