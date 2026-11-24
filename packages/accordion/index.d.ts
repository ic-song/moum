export interface AccordionItem { id: string; label: string; content?: string | HTMLElement }
export interface AccordionOptions { items: AccordionItem[]; openIds?: string[]; single?: boolean; onChange?: (openIds: string[]) => void }
export declare class Accordion {
  constructor(target: string | HTMLElement, options: AccordionOptions);
  getOpen(): string[];
  setOpen(ids: string[]): void;
  toggle(id: string): boolean;
  destroy(): void;
}
export default Accordion;
