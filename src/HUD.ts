import { Inventory, HOTBAR_SIZE } from "./inventory.js";
import { ItemStack, getItem } from "./items.js";
import { matchCrafting } from "./crafting.js";

function itemIcon(stack: ItemStack): string {
  const def = getItem(stack.id);
  if (!def) return "";
  const color = "#" + def.color.toString(16).padStart(6, "0");
  const label = def.kind === "tool"
    ? ({ pickaxe: "⛏", axe: "🪓", shovel: "🥄", sword: "🗡" } as Record<string, string>)[def.toolType!] ?? ""
    : def.kind === "food"
      ? "🍎"
      : def.kind === "material"
        ? stack.id === "stick" ? "/" : stack.id === "coal" ? "●" : stack.id === "egg" ? "○" : stack.id === "feather" ? "≈" : "•"
        : "";
  return `<div style="width:80%;height:80%;background:${color};border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:inset 0 -4px 0 rgba(0,0,0,0.25),inset 0 2px 0 rgba(255,255,255,0.2)">${label}</div>`;
}

function slotStyle(extra = ""): string {
  return `width:44px;height:44px;background:rgba(120,120,120,0.55);border:2px solid rgba(40,40,40,0.8);border-radius:3px;position:relative;display:flex;align-items:center;justify-content:center;${extra}`;
}

function fillSlot(el: HTMLElement, stack: ItemStack | null) {
  el.innerHTML = stack ? itemIcon(stack) : "";
  if (stack && stack.count > 1) {
    const c = document.createElement("div");
    c.textContent = String(stack.count);
    c.style.cssText = "position:absolute;right:2px;bottom:0px;font-size:13px;font-weight:700;color:#fff;text-shadow:1px 1px 0 #000,1px 0 0 #000,0 1px 0 #000;font-family:monospace";
    el.appendChild(c);
  }
}

export class HUD {
  private root: HTMLElement;
  private inv: Inventory;
  private crosshair: HTMLElement;
  private overlay: HTMLElement;
  private coords: HTMLElement;
  private hotbarEl: HTMLElement;
  private hotbarSlots: HTMLElement[] = [];
  private heartsEl: HTMLElement;
  private hungerEl: HTMLElement;

  inventoryOpen = false;
  private craftingSize: 2 | 3 = 2;
  private craftGrid: (ItemStack | null)[] = new Array(9).fill(null);
  private heldStack: ItemStack | null = null;
  private heldEl: HTMLElement;
  private invPanel: HTMLElement;
  private invSlotEls: HTMLElement[] = [];
  private craftSlotEls: HTMLElement[] = [];
  private resultEl!: HTMLElement;

  onCraftingTableOpen?: () => void;

  constructor(root: HTMLElement, inv: Inventory) {
    this.root = root;
    this.inv = inv;
    this.inv.onChange = () => this.refreshHotbar();

    // Start overlay
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:rgba(0,0,0,0.55);color:#fff;font-family:system-ui,sans-serif;text-align:center;z-index:20;`;
    this.overlay.innerHTML = `<div style="font-size:42px;font-weight:800;letter-spacing:2px;">VOXELCRAFT</div>
      <div style="font-size:15px;opacity:.92;max-width:560px;line-height:1.7">
        <b>点击屏幕</b> 进入 · <b>ESC</b> 释放鼠标<br>
        <b>WASD</b> 移动 · <b>空格</b> 跳 · <b>Shift</b> 冲刺 · <b>F</b> 飞行<br>
        <b>左键</b> 破坏/攻击 · <b>右键</b> 放置/使用<br>
        <b>1-9/滚轮</b> 选栏 · <b>E</b> 背包/合成 · <b>右键工作台</b> 3×3合成<br>
        吃食物:手持食物<b>右键</b>长按
      </div>`;
    root.appendChild(this.overlay);

    this.crosshair = document.createElement("div");
    this.crosshair.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:22px;height:22px;pointer-events:none;background:linear-gradient(#fff,#fff) center/2px 100% no-repeat,linear-gradient(#fff,#fff) center/100% 2px no-repeat;mix-blend-mode:difference;`;
    root.appendChild(this.crosshair);

    // Hearts + hunger
    this.heartsEl = document.createElement("div");
    this.heartsEl.style.cssText = `position:absolute;left:50%;bottom:74px;transform:translateX(-50%);display:flex;gap:2px;font-size:18px;`;
    root.appendChild(this.heartsEl);
    this.hungerEl = document.createElement("div");
    this.hungerEl.style.cssText = `position:absolute;left:50%;bottom:74px;transform:translateX(190px);display:flex;gap:2px;font-size:18px;`;
    root.appendChild(this.hungerEl);

    // Hotbar
    this.hotbarEl = document.createElement("div");
    this.hotbarEl.style.cssText = `position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:4px;padding:4px;background:rgba(0,0,0,0.45);border-radius:6px;border:2px solid rgba(255,255,255,0.2);`;
    root.appendChild(this.hotbarEl);
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const s = document.createElement("div");
      s.style.cssText = slotStyle();
      this.hotbarEl.appendChild(s);
      this.hotbarSlots.push(s);
    }

    this.coords = document.createElement("div");
    this.coords.style.cssText = `position:absolute;left:10px;top:10px;color:#fff;font-family:ui-monospace,monospace;font-size:12px;opacity:.9;text-shadow:0 1px 2px #000;white-space:pre;`;
    root.appendChild(this.coords);

    // Held stack (follows cursor)
    this.heldEl = document.createElement("div");
    this.heldEl.style.cssText = `position:absolute;width:44px;height:44px;pointer-events:none;z-index:50;display:none;`;
    root.appendChild(this.heldEl);

    // Inventory panel
    this.invPanel = document.createElement("div");
    this.invPanel.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;background:#c6c6c6;border:4px solid #555;border-radius:6px;padding:14px;font-family:system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,0.5);z-index:30;`;
    root.appendChild(this.invPanel);

    document.addEventListener("mousemove", (e) => {
      if (this.inventoryOpen) {
        this.heldEl.style.left = e.clientX - 22 + "px";
        this.heldEl.style.top = e.clientY - 22 + "px";
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyE") {
        e.preventDefault();
        if (this.inventoryOpen) this.closeInventory();
        else if (!document.pointerLockElement) this.openInventory(2);
      }
      if (e.code.startsWith("Digit")) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= HOTBAR_SIZE && !this.inventoryOpen) {
          this.inv.setSelected(n - 1);
          this.refreshHotbar();
        }
      }
    });
    window.addEventListener("wheel", (e) => {
      if (this.inventoryOpen) return;
      const dir = Math.sign(e.deltaY);
      this.inv.setSelected(this.inv.selected + dir);
      this.refreshHotbar();
    });

    this.refreshHotbar();
    this.updateStatus(20, 20);
  }

  get selectedStack(): ItemStack | null {
    return this.inv.getSelected();
  }

  refreshHotbar() {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = this.hotbarSlots[i];
      el.style.borderColor = i === this.inv.selected ? "#fff" : "rgba(40,40,40,0.8)";
      el.style.outline = i === this.inv.selected ? "2px solid #fff" : "none";
      fillSlot(el, this.inv.slots[i]);
    }
  }

  updateStatus(health: number, hunger: number) {
    const hearts = Math.ceil(health / 2);
    let h = "";
    for (let i = 0; i < 10; i++) {
      h += i < hearts ? "❤️" : "🖤";
    }
    this.heartsEl.textContent = h;
    const drums = Math.ceil(hunger / 2);
    let g = "";
    for (let i = 0; i < 10; i++) {
      g += i < drums ? "🍗" : "🦴";
    }
    this.hungerEl.textContent = g;
  }

  updateCoords(x: number, y: number, z: number, fps: number, mode: string, time: string) {
    this.coords.textContent = `XYZ: ${x.toFixed(1)} / ${y.toFixed(1)} / ${z.toFixed(1)}\nFPS: ${fps.toFixed(0)}  ${mode}\n时间: ${time}`;
  }

  setLocked(locked: boolean) {
    this.overlay.style.display = locked ? "none" : "flex";
  }

  openInventory(size: 2 | 3) {
    this.inventoryOpen = true;
    this.craftingSize = size;
    this.craftGrid = new Array(9).fill(null);
    this.buildInvPanel();
    this.invPanel.style.display = "block";
    if (document.pointerLockElement) document.exitPointerLock();
    this.crosshair.style.display = "none";
  }

  closeInventory() {
    if (!this.inventoryOpen) return;
    this.inventoryOpen = false;
    this.invPanel.style.display = "none";
    // Return held + crafting grid items to inventory
    if (this.heldStack) {
      this.inv.addItem(this.heldStack);
      this.heldStack = null;
    }
    for (const s of this.craftGrid) if (s) this.inv.addItem(s);
    this.craftGrid = new Array(9).fill(null);
    this.heldEl.style.display = "none";
    this.crosshair.style.display = "block";
    this.refreshHotbar();
  }

  private buildInvPanel() {
    const size = this.craftingSize;
    this.invPanel.innerHTML = "";
    this.invSlotEls = [];
    this.craftSlotEls = [];

    const title = document.createElement("div");
    title.textContent = size === 3 ? "合成台 (3×3)" : "背包 (2×2)";
    title.style.cssText = "font-size:15px;font-weight:700;color:#333;margin-bottom:10px;text-align:center;";
    this.invPanel.appendChild(title);

    // Crafting area
    const craftWrap = document.createElement("div");
    craftWrap.style.cssText = "display:flex;align-items:center;gap:14px;justify-content:center;margin-bottom:16px;";
    const grid = document.createElement("div");
    grid.style.cssText = `display:grid;grid-template-columns:repeat(${size},44px);gap:2px;`;
    for (let i = 0; i < 9; i++) {
      const el = document.createElement("div");
      el.style.cssText = slotStyle();
      if (i >= size * size) el.style.visibility = "hidden";
      const idx = i;
      el.addEventListener("mousedown", (e) => { e.preventDefault(); this.clickCraft(idx, e.button); });
      grid.appendChild(el);
      this.craftSlotEls.push(el);
    }
    craftWrap.appendChild(grid);
    const arrow = document.createElement("div");
    arrow.textContent = "→";
    arrow.style.cssText = "font-size:24px;color:#555;";
    craftWrap.appendChild(arrow);
    this.resultEl = document.createElement("div");
    this.resultEl.style.cssText = slotStyle("background:rgba(80,160,80,0.4);");
    this.resultEl.addEventListener("mousedown", (e) => { e.preventDefault(); this.clickResult(e.button); });
    craftWrap.appendChild(this.resultEl);
    this.invPanel.appendChild(craftWrap);

    // Storage 27
    const storage = document.createElement("div");
    storage.style.cssText = "display:grid;grid-template-columns:repeat(9,44px);gap:2px;margin-bottom:8px;";
    for (let i = HOTBAR_SIZE; i < this.inv.slots.length; i++) {
      const el = document.createElement("div");
      el.style.cssText = slotStyle();
      const idx = i;
      el.addEventListener("mousedown", (e) => { e.preventDefault(); this.clickInv(idx, e.button); });
      storage.appendChild(el);
      this.invSlotEls.push(el);
    }
    this.invPanel.appendChild(storage);

    // Hotbar 9
    const hb = document.createElement("div");
    hb.style.cssText = "display:grid;grid-template-columns:repeat(9,44px);gap:2px;";
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = document.createElement("div");
      el.style.cssText = slotStyle();
      const idx = i;
      el.addEventListener("mousedown", (e) => { e.preventDefault(); this.clickInv(idx, e.button); });
      hb.appendChild(el);
      this.invSlotEls.push(el);
    }
    this.invPanel.appendChild(hb);

    this.refreshInvSlots();
    this.recomputeCraft();
  }

  private refreshInvSlots() {
    for (let i = 0; i < this.invSlotEls.length; i++) {
      fillSlot(this.invSlotEls[i], this.inv.slots[i]);
    }
    for (let i = 0; i < 9; i++) {
      if (i < this.craftingSize * this.craftingSize) fillSlot(this.craftSlotEls[i], this.craftGrid[i]);
    }
    this.refreshHeld();
  }

  private refreshHeld() {
    if (this.heldStack) {
      this.heldEl.style.display = "block";
      this.heldEl.innerHTML = itemIcon(this.heldStack);
      if (this.heldStack.count > 1) {
        const c = document.createElement("div");
        c.textContent = String(this.heldStack.count);
        c.style.cssText = "position:absolute;right:2px;bottom:0px;font-size:13px;font-weight:700;color:#fff;text-shadow:1px 1px 0 #000;font-family:monospace";
        this.heldEl.appendChild(c);
      }
    } else {
      this.heldEl.style.display = "none";
    }
  }

  private recomputeCraft() {
    const grid: (string | null)[][] = [];
    const size = this.craftingSize;
    for (let r = 0; r < size; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < size; c++) row.push(this.craftGrid[r * size + c]?.id ?? null);
      grid.push(row);
    }
    const result = matchCrafting(grid, size);
    const wasResult = this.craftGridResult;
    this.craftGridResult = result;
    fillSlot(this.resultEl, result);
    void wasResult;
  }
  private craftGridResult: ItemStack | null = null;

  private clickInv(idx: number, button: number) {
    const slot = this.inv.slots[idx];
    this.handleSlotSwap(slot, button, (newStack) => { this.inv.slots[idx] = newStack; });
    this.refreshInvSlots();
  }

  private clickCraft(idx: number, button: number) {
    if (idx >= this.craftingSize * this.craftingSize) return;
    const slot = this.craftGrid[idx];
    this.handleSlotSwap(slot, button, (newStack) => { this.craftGrid[idx] = newStack; });
    this.refreshInvSlots();
    this.recomputeCraft();
  }

  private clickResult(button: number) {
    if (button !== 0) return;
    const result = this.craftGridResult;
    if (!result) return;
    if (!this.heldStack) {
      this.heldStack = { ...result };
    } else if (this.heldStack.id === result.id && this.heldStack.count + result.count <= (getItem(result.id)?.maxStack ?? 64)) {
      this.heldStack.count += result.count;
    } else {
      return;
    }
    // Consume one from each craft slot
    for (let i = 0; i < this.craftGrid.length; i++) {
      if (this.craftGrid[i]) {
        this.craftGrid[i]!.count -= 1;
        if (this.craftGrid[i]!.count <= 0) this.craftGrid[i] = null;
      }
    }
    this.refreshInvSlots();
    this.recomputeCraft();
  }

  // Shared pick/place/swap logic. getter returns current slot stack; setter writes new stack.
  private handleSlotSwap(slot: ItemStack | null, button: number, set: (s: ItemStack | null) => void) {
    const max = (id: string) => getItem(id)?.maxStack ?? 64;
    if (button === 0) {
      if (!this.heldStack) {
        if (slot) { set(null); this.heldStack = { ...slot }; }
      } else if (!slot) {
        set({ ...this.heldStack }); this.heldStack = null;
      } else if (slot.id === this.heldStack.id) {
        const room = max(slot.id) - slot.count;
        const move = Math.min(room, this.heldStack.count);
        if (move > 0) {
          slot.count += move;
          this.heldStack.count -= move;
          if (this.heldStack.count <= 0) this.heldStack = null;
          set({ ...slot });
        } else {
          // swap
          set({ ...this.heldStack }); this.heldStack = { ...slot };
        }
      } else {
        set({ ...this.heldStack }); this.heldStack = { ...slot };
      }
    } else if (button === 2) {
      if (!this.heldStack) {
        if (slot && slot.count > 0) {
          const half = Math.ceil(slot.count / 2);
          this.heldStack = { id: slot.id, count: half };
          slot.count -= half;
          if (slot.count <= 0) set(null); else set({ ...slot });
        }
      } else {
        if (!slot) {
          set({ id: this.heldStack.id, count: 1 });
          this.heldStack.count -= 1;
          if (this.heldStack.count <= 0) this.heldStack = null;
        } else if (slot.id === this.heldStack.id && slot.count < max(slot.id)) {
          slot.count += 1;
          this.heldStack.count -= 1;
          if (this.heldStack.count <= 0) this.heldStack = null;
          set({ ...slot });
        }
      }
    }
    this.refreshHeld();
  }
}
