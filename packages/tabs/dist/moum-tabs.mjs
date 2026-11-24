/*! MOUM tabs v0.2.0 | MIT License | See LICENSE */
let moumTabSequence = 0;

export class Tabs {
  constructor(target, { items, activeId, label = '탭', activation = 'automatic', onChange } = {}) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host || host.childNodes.length) throw new Error('비어 있는 탭 컨테이너가 필요합니다.');
    if (!Array.isArray(items) || !items.length) throw new TypeError('탭 목록이 필요합니다.');
    if (!['automatic', 'manual'].includes(activation)) throw new TypeError('activation은 automatic 또는 manual입니다.');
    const ids = new Set(), nodes = new Set();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.label !== 'string' || !item.label.trim()) {
        throw new TypeError('탭에는 고유한 ID와 이름이 필요합니다.');
      }
      ids.add(item.id);
      const { content } = item;
      if (content != null && typeof content !== 'string') {
        if (!(content instanceof HTMLElement) || content.contains(host) || nodes.has(content)) throw new TypeError('탭마다 다른 콘텐츠 요소가 필요합니다.');
        nodes.add(content);
      }
    }
    const enabled = items.filter(item => !item.disabled);
    const initial = activeId ?? enabled[0]?.id;
    if (!enabled.some(item => item.id === initial)) throw new RangeError('사용 가능한 초기 탭이 필요합니다.');
    this.onChange = onChange;
    this.activation = activation;
    this.records = new Map();
    this.enabled = enabled.map(item => item.id);
    this.root = document.createElement('div');
    this.root.className = 'moum-tabs';
    const list = document.createElement('div');
    list.className = 'moum-tabs-list';
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', label);
    list.addEventListener('focusout', event => {
      if (!list.contains(event.relatedTarget)) this.setTabStop(this.activeId);
    });
    this.root.append(list);
    for (const { id, label, disabled, content } of items) {
      let prefix;
      do { prefix = `moum-tab-${++moumTabSequence}`; } while (document.getElementById(prefix) || document.getElementById(prefix + '-panel'));
      const button = document.createElement('button');
      button.type = 'button';
      button.id = prefix;
      button.disabled = Boolean(disabled);
      button.textContent = label;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', prefix + '-panel');
      const panel = document.createElement('div');
      panel.id = prefix + '-panel';
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', prefix);
      panel.tabIndex = 0;
      panel.append(content ?? '');
      button.addEventListener('click', () => this.setActive(id));
      button.addEventListener('keydown', event => this.moveFocus(event, id));
      list.append(button);
      this.root.append(panel);
      this.records.set(id, { button, panel });
    }
    this.renderActive(initial);
    host.append(this.root);
  }

  moveFocus(event, id) {
    const { enabled } = this, index = enabled.indexOf(id);
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const step = ((event.key === 'ArrowRight') !== rtl) ? 1 : -1;
      next = (index + step + enabled.length) % enabled.length;
    } else return;
    event.preventDefault();
    const nextId = enabled[next];
    this.setTabStop(nextId);
    this.records.get(nextId).button.focus();
    if (this.activation === 'automatic') this.setActive(nextId);
  }

  renderActive(id) {
    this.activeId = id;
    for (const [key, { button, panel }] of this.records) {
      button.setAttribute('aria-selected', String(key === id));
      panel.hidden = key !== id;
    }
    this.setTabStop(id);
  }

  setTabStop(id) {
    for (const [key, { button }] of this.records) button.tabIndex = key === id ? 0 : -1;
  }
  getActive() { return this.activeId; }

  setActive(id) {
    if (this.destroyed) throw new Error('이미 제거된 탭입니다.');
    const record = this.records.get(id);
    if (!record || record.button.disabled) throw new RangeError('사용 가능한 탭을 지정하세요.');
    if (id === this.activeId) return;
    const previous = this.records.get(this.activeId);
    if (previous.panel.contains(document.activeElement) || previous.button === document.activeElement) record.button.focus();
    const previousId = this.activeId;
    this.renderActive(id);
    this.onChange?.({ id, previousId });
  }

  destroy() {
    this.destroyed = true;
    this.root.remove();
  }
}

export default Tabs;
