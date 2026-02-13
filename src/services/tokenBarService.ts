import OBR, { buildShape, isShape } from "@owlbear-rodeo/sdk";

const EXT = "cursed-hearts-assistant";
const META = `${EXT}/bar`;

const W = 100;
const H_HP = 8;
const H_MANA = 6;
const Y_HP = 55;
const Y_MANA = 67;

interface BarMeta { tokenId: string; barType: "hp" | "mana"; role: "bg" | "fill"; }

interface UnitLike {
  owlbearTokenId?: string;
  health: { current: number; max: number };
  mana: { current: number; max: number };
  useManaAsHp?: boolean;
}

function hpColor(r: number): string {
  if (r > 0.5) return "#22cc44";
  if (r > 0.25) return "#ccaa22";
  return "#cc2222";
}

class TokenBarService {
  private ready = false;

  constructor() {}

  async initialize(): Promise<void> {
    if (this.ready) return;
    try {
      if (await OBR.scene.isReady()) {
        this.ready = true;
        console.log("[TokenBars] Ready");
      }
    } catch (e) {
      console.warn("[TokenBars] Init:", e);
    }
  }

  private async ok(): Promise<boolean> {
    if (this.ready) return true;
    try {
      if (await OBR.scene.isReady()) { this.ready = true; return true; }
    } catch {}
    return false;
  }

  private meta(item: { metadata?: Record<string, unknown> }): BarMeta | null {
    try {
      const m = item.metadata?.[META];
      if (m && typeof m === "object" && m !== null && "tokenId" in m && "barType" in m && "role" in m) {
        return m as BarMeta;
      }
    } catch {}
    return null;
  }

  private async findIds(tokenId: string): Promise<string[]> {
    try {
      const items = await OBR.scene.items.getItems();
      return items.filter(i => { const m = this.meta(i); return m?.tokenId === tokenId; }).map(i => i.id);
    } catch { return []; }
  }

  private async findFill(tokenId: string, barType: "hp" | "mana"): Promise<string | null> {
    try {
      const items = await OBR.scene.items.getItems();
      return items.find(i => { const m = this.meta(i); return m?.tokenId === tokenId && m.barType === barType && m.role === "fill"; })?.id ?? null;
    } catch { return null; }
  }

  private pair(tokenId: string, barType: "hp" | "mana", cur: number, max: number) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    const y = barType === "hp" ? Y_HP : Y_MANA;
    const h = barType === "hp" ? H_HP : H_MANA;
    const bgC = barType === "hp" ? "#2a0e0e" : "#0e1a28";
    const brC = barType === "hp" ? "#4a1515" : "#1a3a5a";
    const flC = barType === "hp" ? hpColor(ratio) : "#4499dd";

    const bg = buildShape()
      .shapeType("RECTANGLE").width(W).height(h)
      .position({ x: -W / 2, y })
      .attachedTo(tokenId).layer("ATTACHMENT")
      .locked(true).disableHit(true).visible(true).zIndex(2)
      .name(`${EXT}-${barType}-bg`)
      .fillColor(bgC).strokeColor(brC).strokeWidth(1)
      .metadata({ [META]: { tokenId, barType, role: "bg" } as BarMeta })
      .build();

    const fill = buildShape()
      .shapeType("RECTANGLE").width(Math.max(1, W * ratio)).height(h)
      .position({ x: -W / 2, y })
      .attachedTo(tokenId).layer("ATTACHMENT")
      .locked(true).disableHit(true).visible(true).zIndex(3)
      .name(`${EXT}-${barType}-fill`)
      .fillColor(flC).strokeColor(brC).strokeWidth(0)
      .metadata({ [META]: { tokenId, barType, role: "fill" } as BarMeta })
      .build();

    return [bg, fill];
  }

  async createBars(tokenId: string, hpC: number, hpM: number, mC: number, mM: number, _u?: boolean): Promise<void> {
    if (!(await this.ok())) return;
    try {
      await this.removeBars(tokenId);
      const shapes = [...this.pair(tokenId, "hp", hpC, hpM), ...this.pair(tokenId, "mana", mC, mM)];
      await OBR.scene.items.addItems(shapes);
    } catch (e) { console.warn("[TokenBars] create:", e); }
  }

  async updateBars(tokenId: string, hpC: number, hpM: number, mC: number, mM: number, _u?: boolean): Promise<void> {
    if (!(await this.ok())) return;
    try {
      const ids = await this.findIds(tokenId);
      if (ids.length >= 4) {
        await this.updateFill(tokenId, "hp", hpC, hpM);
        await this.updateFill(tokenId, "mana", mC, mM);
      } else {
        await this.createBars(tokenId, hpC, hpM, mC, mM);
      }
    } catch (e) { console.warn("[TokenBars] update:", e); }
  }

  private async updateFill(tokenId: string, barType: "hp" | "mana", cur: number, max: number): Promise<void> {
    const id = await this.findFill(tokenId, barType);
    if (!id) return;
    const ratio = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    const color = barType === "hp" ? hpColor(ratio) : "#4499dd";
    await OBR.scene.items.updateItems([id], (items) => {
      for (const item of items) {
        if (isShape(item)) {
          item.width = Math.max(1, W * ratio);
          item.style.fillColor = color;
        }
      }
    });
  }

  async removeBars(tokenId: string): Promise<void> {
    if (!(await this.ok())) return;
    try {
      const ids = await this.findIds(tokenId);
      if (ids.length) await OBR.scene.items.deleteItems(ids);
    } catch (e) { console.warn("[TokenBars] remove:", e); }
  }

  async removeAllBars(): Promise<void> {
    if (!(await this.ok())) return;
    try {
      const items = await OBR.scene.items.getItems();
      const ids = items.filter(i => this.meta(i) !== null).map(i => i.id);
      if (ids.length) {
        await OBR.scene.items.deleteItems(ids);
        console.log(`[TokenBars] Removed ${ids.length} shapes`);
      }
    } catch (e) { console.warn("[TokenBars] removeAll:", e); }
  }

  async syncAllBars(units: UnitLike[]): Promise<void> {
    for (const u of units) {
      if (!u.owlbearTokenId) continue;
      await this.updateBars(u.owlbearTokenId, u.health.current, u.health.max, u.mana.current, u.mana.max, u.useManaAsHp);
    }
  }
}

export const tokenBarService = new TokenBarService();
