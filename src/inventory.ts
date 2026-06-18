import { ItemStack, getItem } from "./items.js";

export const INV_SIZE = 36;
export const HOTBAR_SIZE = 9;

export class Inventory {
  slots: (ItemStack | null)[] = new Array(INV_SIZE).fill(null);
  selected = 0;
  onChange: (() => void) | null = null;

  private notify() {
    this.onChange?.();
  }

  getSelected(): ItemStack | null {
    return this.slots[this.selected];
  }

  setSelected(i: number) {
    this.selected = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.notify();
  }

  // Add a stack; returns leftover count that didn't fit.
  addItem(stack: ItemStack): number {
    const def = getItem(stack.id);
    const max = def?.maxStack ?? 64;
    let remaining = stack.count;

    // First fill existing stacks of same id (hotbar then main)
    const order = [...Array.from({ length: HOTBAR_SIZE }, (_, i) => i), ...Array.from({ length: INV_SIZE - HOTBAR_SIZE }, (_, i) => i + HOTBAR_SIZE)];
    for (const i of order) {
      if (remaining <= 0) break;
      const s = this.slots[i];
      if (s && s.id === stack.id && s.count < max) {
        const add = Math.min(max - s.count, remaining);
        s.count += add;
        remaining -= add;
      }
    }
    // Then empty slots
    for (const i of order) {
      if (remaining <= 0) break;
      if (!this.slots[i]) {
        const add = Math.min(max, remaining);
        this.slots[i] = { id: stack.id, count: add };
        remaining -= add;
      }
    }
    this.notify();
    return remaining;
  }

  // Remove count of given id; returns true if fully removed.
  removeItem(id: string, count: number): boolean {
    let need = count;
    for (let i = 0; i < INV_SIZE; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, need);
        s.count -= take;
        need -= take;
        if (s.count <= 0) this.slots[i] = null;
        if (need <= 0) break;
      }
    }
    this.notify();
    return need <= 0;
  }

  // Consume one item from selected hotbar slot (for placing blocks / eating).
  consumeSelected(): ItemStack | null {
    const s = this.slots[this.selected];
    if (!s) return null;
    const copy = { ...s };
    s.count -= 1;
    if (s.count <= 0) this.slots[this.selected] = null;
    this.notify();
    return copy;
  }

  swap(a: number, b: number) {
    const tmp = this.slots[a];
    this.slots[a] = this.slots[b];
    this.slots[b] = tmp;
    this.notify();
  }

  setSlot(i: number, stack: ItemStack | null) {
    this.slots[i] = stack;
    this.notify();
  }

  has(id: string, count = 1): boolean {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n >= count;
  }
}
