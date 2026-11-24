/*! MOUM accordion v0.2.0 | MIT License | See LICENSE */
let moumAccordionSequence = 0;

export class Accordion {
  constructor(target, { items, openIds = [], single = false, onChange } = {}) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host || host.childNodes.length) throw new Error('비어 있는 아코디언 컨테이너가 필요합니다.');
    if (!Array.isArray(items) || !items.length) throw new TypeError('아코디언 목록이 필요합니다.');
    const ids = new Set(), nodes = new Set();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.label !== 'string' || !item.label.trim()) throw new TypeError('각 항목에는 고유한 ID와 이름이 필요합니다.');
      ids.add(item.id);
      const { content } = item;
      if (content != null && typeof content !== 'string') {
        if (!(content instanceof HTMLElement) || content.contains(host) || nodes.has(content)) throw new TypeError('항목마다 다른 콘텐츠 요소가 필요합니다.');
        nodes.add(content);
      }
    }
    this.single = single;
    this.validateOpen(openIds, ids);
    this.onChange = onChange;
    this.items = new Map();
    this.root = document.createElement('div');
    this.root.className = 'moum-accordion';
    let group;
    if (single) {
      do { group = `moum-accordion-${++moumAccordionSequence}`; } while (document.querySelector(`details[name="${group}"]`));
    }
    const initial = new Set(openIds);
    for (const { id, label, content } of items) {
      const details = document.createElement('details'), summary = document.createElement('summary');
      const body = document.createElement('div');
      body.className = 'moum-accordion-body';
      body.append(content ?? '');
      summary.textContent = label;
      if (single) details.setAttribute('name', group);
      details.open = initial.has(id);
      details.append(summary, body);
      details.addEventListener('toggle', () => this.notify());
      this.items.set(id, details);
      this.root.append(details);
    }
    this.lastOpen = this.getOpen();
    host.append(this.root);
  }

  validateOpen(ids, valid = this.items) {
    if (!Array.isArray(ids) || (this.single && ids.length > 1)
        || new Set(ids).size !== ids.length || Array.from(ids).some(id => !valid.has(id))) {
      throw new RangeError('펼칠 항목의 ID를 확인하세요.');
    }
  }

  getOpen() { return [...this.items].filter(([, element]) => element.open).map(([id]) => id); }

  setOpen(ids) {
    if (this.destroyed) throw new Error('이미 제거된 아코디언입니다.');
    this.validateOpen(ids);
    const open = new Set(ids);
    for (const [id, details] of this.items) {
      if (!open.has(id)) {
        const summary = details.firstElementChild;
        if (details.open && details.contains(document.activeElement) && !summary.contains(document.activeElement)) summary.focus();
        details.open = false;
      }
    }
    for (const id of open) this.items.get(id).open = true;
    this.notify();
  }

  toggle(id) {
    if (this.destroyed) throw new Error('이미 제거된 아코디언입니다.');
    if (!this.items.has(id)) throw new RangeError('펼칠 항목의 ID를 확인하세요.');
    const open = this.getOpen();
    const expanded = !open.includes(id);
    this.setOpen(expanded ? (this.single ? [id] : [...open, id]) : open.filter(key => key !== id));
    return expanded;
  }

  notify() {
    if (this.destroyed) return;
    const openIds = this.getOpen();
    if (openIds.length === this.lastOpen.length && openIds.every((id, index) => id === this.lastOpen[index])) return;
    this.lastOpen = openIds;
    this.onChange?.(openIds.slice());
  }

  destroy() {
    this.destroyed = true;
    this.root.remove();
  }
}

export default Accordion;
