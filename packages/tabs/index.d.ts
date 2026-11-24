export interface TabItem { id: string; label: string; content?: string | HTMLElement; disabled?: boolean }
export interface TabsOptions { items: TabItem[]; activeId?: string; label?: string; activation?: 'automatic' | 'manual'; onChange?: (state: { id: string; previousId: string }) => void }
export declare class Tabs {
  constructor(target: string | HTMLElement, options: TabsOptions);
  getActive(): string;
  setActive(id: string): void;
  destroy(): void;
}
export default Tabs;
