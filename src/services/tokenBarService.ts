import OBR, {
  buildShape,
  isImage,
  isShape,
  type Image,
  type Shape,
} from "@owlbear-rodeo/sdk";
import type { Unit } from "../types";

const META = "cursed-hearts-assistant";

const CFG = {
  BAR_WIDTH_RATIO: 0.77,
  BAR_HEIGHT_BASE: 8,
  BAR_GAP: 2,
  BAR_OFFSET_Y: 5,
  MIN_BAR_W: 30,
  MIN_BAR_H: 6,
  MAX_BAR_H: 30,
  BG: "#0a0505",
  STROKE: "#000000",
  HP_HIGH: "#cc2222",
  HP_MED: "#aa4400",
  HP_LOW: "#ff0000",
  HP_CRIT: "#550000",
  MANA: "#2244aa",
  DEAD: "#333333",
} as const;

interface Layout {
  barW: number;
  barH: number;
  barX: number;
  hpY: number;
  manaY: number;
}

interface Ids {
  hpBg?: string;
  hpFill?: string;
  manaBg?: string;
  manaFill?: string;
  crack1?: string;
  crack2?: string;
}

interface State {
  id: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  useManaAsHp: boolean;
  tx: number;
  ty: number;
  bw: number;
  bh: number;
  dead: boolean;
  ids: Ids;
}

export type BarMode = "quality" | "performance";

class TokenBarService {
  private states = new Map<string, State>();
  private ready = false;
  private animId: number | null = null;
  private frame = 0;
  private mode: BarMode = "quality";
  private unsubItems: (() => void) | null = null;
  private unsubScene: (() => void) | null = null;
  private lastColor = new Map<string, string>();

  async initialize(): Promise<void> {
    if (this.ready) return;
    try {
      const ok = await OBR.scene.isReady();
      if (!ok) {
        this.unsubScene = OBR.scene.onReadyChange((r) => {
          if (r && !this.ready) this.boot();
        });
        return;
      }
      await this.boot();
    } catch (e) {
      console.error("[Bars] Init failed:", e);
    }
  }

  private async boot(): Promise<void> {
    this.startAnim();
    this.watchItems();
    this.ready = true;
    console.log("[Bars] Ready");
  }

  dispose(): void {
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    this.animId = null;
    this.unsubItems?.();
    this.unsubItems = null;
    this.unsubScene?.();
    this.unsubScene = null;
    this.states.clear();
    this.lastColor.clear();
    this.ready = false;
  }

  private watchItems(): void {
    if (this.unsubItems) return;
    this.unsubItems = OBR.scene.items.onChange((items) => {
      for (const [tokenId, st] of this.states) {
        const tok = items.find((i) => i.id === tokenId);
        if (!tok || !isImage(tok)) continue;
        st.tx = tok.position.x;
        st.ty = tok.position.y;
      }
    });
  }

  private calcLayout(tok: Image, useManaAsHp: boolean): Layout {
    const sx = Math.abs(Number(tok.scale?.x) || 1);
    const sy = Math.abs(Number(tok.scale?.y) || 1);
    const imgW = Number(tok.image?.width) || 150;
    const imgH = Number(tok.image?.height) || 150;
    const dpi = Number(tok.grid?.dpi) || 150;
    const grid = Number(tok.grid?.size) || 150;

    const wW = (imgW / dpi) * grid * sx;
    const wH = (imgH / dpi) * grid * sy;
    const avg = (sx + sy) / 2;

    let bw = Math.round(wW * CFG.BAR_WIDTH_RATIO);
    bw = Math.max(CFG.MIN_BAR_W, bw);

    let bh = Math.round(CFG.BAR_HEIGHT_BASE * Math.max(1, avg * 0.7));
    bh = Math.max(CFG.MIN_BAR_H, Math.min(CFG.MAX_BAR_H, bh));

    const gap = Math.round(CFG.BAR_GAP * Math.max(1, avg * 0.5));
    const offY = Math.round(CFG.BAR_OFFSET_Y * Math.max(1, avg * 0.5));

    const barX = Math.round(tok.position.x - bw / 2);
    const hpY = Math.round(tok.position.y + wH / 2 + offY);
    const manaY = useManaAsHp ? hpY : hpY + bh + gap;

    return { barW: bw, barH: bh, barX, hpY, manaY };
  }

  async createBars(
    tokenId: string,
    hpIn: number, maxHpIn: number,
    manaIn: number, maxManaIn: number,
    useManaAsHp = false
  ): Promise<void> {
    if (!tokenId) return;
    try {
      if (!(await OBR.scene.isReady())) return;

      const hp = Number(hpIn) || 0;
      const maxHp = Number(maxHpIn) || 1;
      const mana = Number(manaIn) || 0;
      const maxMana = Number(maxManaIn) || 1;

      await this.removeBars(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length) return;
      const tok = items[0];
      if (!isImage(tok)) return;

      const lay = this.calcLayout(tok as Image, useManaAsHp);
      const dead = hp <= 0;
      const hpPct = Math.max(0, Math.min(1, hp / maxHp));
      const manaPct = Math.max(0, Math.min(1, mana / maxMana));
      const showHp = !useManaAsHp;

      const shapes: Shape[] = [];
      const ids: Ids = {};

      const rect = (
        role: keyof Ids,
        x: number, y: number, w: number, h: number,
        color: string, z: number, vis: boolean,
        noStroke = false
      ): void => {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return;
        if (w <= 0 || h <= 0) return;
        const s = buildShape()
          .shapeType("RECTANGLE")
          .width(w).height(h)
          .position({ x, y })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true).disableHit(true)
          .visible(vis)
          .fillColor(color)
          .strokeColor(CFG.STROKE)
          .strokeWidth(noStroke ? 0 : 1)
          .zIndex(z)
          .metadata({ [META]: { type: "bar", role, tokenId } })
          .build();
        shapes.push(s);
        ids[role] = s.id;
      };

      if (showHp && !dead) {
        rect("hpBg", lay.barX, lay.hpY, lay.barW, lay.barH, CFG.BG, 10, true);
        if (hpPct > 0) {
          rect("hpFill", lay.barX, lay.hpY,
            Math.round(Math.max(1, lay.barW * hpPct)), lay.barH,
            this.hpColor(hp, maxHp), 11, true, true);
        }
      }

      if (!dead) {
        rect("manaBg", lay.barX, lay.manaY, lay.barW, lay.barH, CFG.BG, 10, true);
        if (manaPct > 0) {
          rect("manaFill", lay.barX, lay.manaY,
            Math.round(Math.max(1, lay.barW * manaPct)), lay.barH,
            CFG.MANA, 11, true, true);
        }
      }

      if (shapes.length > 0) await OBR.scene.items.addItems(shapes);

      this.states.set(tokenId, {
        id: tokenId,
        hp, maxHp, mana, maxMana, useManaAsHp,
        tx: tok.position.x, ty: tok.position.y,
        bw: lay.barW, bh: lay.barH,
        dead, ids,
      });

      if (showHp && dead && this.mode === "quality") {
        this.addDeathX(tokenId, lay);
      }
    } catch (e) {
      console.error("[Bars] createBars failed:", e);
    }
  }

  async updateBars(
    tokenId: string,
    hpIn: number, maxHpIn: number,
    manaIn: number, maxManaIn: number,
    useManaAsHp = false
  ): Promise<void> {
    const st = this.states.get(tokenId);
    const hp = Number(hpIn) || 0;
    const maxHp = Number(maxHpIn) || 1;
    const mana = Number(manaIn) || 0;
    const maxMana = Number(maxManaIn) || 1;

    if (!st) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    const dead = hp <= 0;
    const ids = st.ids;
    const hpPct = Math.max(0, Math.min(1, hp / maxHp));
    const manaPct = Math.max(0, Math.min(1, mana / maxMana));

    const needRebuild =
      dead !== st.dead ||
      st.useManaAsHp !== useManaAsHp ||
      (!dead && !useManaAsHp && !ids.hpFill && hpPct > 0) ||
      (!dead && !ids.manaFill && manaPct > 0) ||
      (!dead && !useManaAsHp && !ids.hpBg) ||
      (!dead && !ids.manaBg);

    if (needRebuild) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    st.hp = hp; st.maxHp = maxHp;
    st.mana = mana; st.maxMana = maxMana;
    st.dead = dead; st.useManaAsHp = useManaAsHp;

    const toUpdate = [ids.hpFill, ids.hpBg, ids.manaFill, ids.manaBg].filter(
      Boolean
    ) as string[];
    if (toUpdate.length === 0) return;

    const bw = st.bw;
    try {
      await OBR.scene.items.updateItems(toUpdate, (sceneItems) => {
        for (const item of sceneItems) {
          if (!isShape(item)) continue;
          if (item.id === ids.hpFill) {
            item.width = Math.round(Math.max(0, bw * hpPct));
            item.style.fillColor = this.hpColor(hp, maxHp);
            item.visible = !dead && !useManaAsHp && hpPct > 0;
          } else if (item.id === ids.hpBg) {
            item.visible = !dead && !useManaAsHp;
          } else if (item.id === ids.manaFill) {
            item.width = Math.round(Math.max(0, bw * manaPct));
            item.visible = !dead && manaPct > 0;
          } else if (item.id === ids.manaBg) {
            item.visible = !dead;
          }
        }
      });
    } catch {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
    }
  }

  async removeBars(tokenId: string): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const toDel = items.filter(
        (i) => i.attachedTo === tokenId && i.layer === "ATTACHMENT" && i.type === "SHAPE"
      );
      if (toDel.length > 0) {
        await OBR.scene.items.deleteItems(toDel.map((i) => i.id));
      }
    } catch (e) {
      console.warn("[Bars] removeBars failed:", e);
    }
    this.states.delete(tokenId);
    this.lastColor.delete(tokenId);
  }

  async removeAllBars(): Promise<void> {
    for (const id of this.states.keys()) {
      await this.removeBars(id);
    }
  }

  async syncAllBars(units: Unit[]): Promise<void> {
    const valid = new Set<string>();
    for (const u of units) {
      if (!u.owlbearTokenId) continue;
      valid.add(u.owlbearTokenId);
      await this.createBars(
        u.owlbearTokenId,
        u.useManaAsHp ? u.mana.current : u.health.current,
        u.useManaAsHp ? u.mana.max : u.health.max,
        u.mana.current, u.mana.max, u.useManaAsHp
      );
    }
    for (const id of this.states.keys()) {
      if (!valid.has(id)) await this.removeBars(id);
    }
  }

  setMode(m: BarMode): void {
    this.mode = m;
    if (m === "performance" && this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    } else if (m === "quality" && this.animId === null) {
      this.startAnim();
    }
  }

  private startAnim(): void {
    if (this.animId !== null) return;
    const tick = () => {
      this.frame++;
      if (this.mode === "quality") this.tickPulse();
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  private tickPulse(): void {
    if (this.frame % 3 !== 0) return;
    for (const [, st] of this.states) {
      if (!st.ids.hpFill || st.dead) continue;
      const pct = st.maxHp > 0 ? st.hp / st.maxHp : 0;
      if (pct <= 0 || pct >= 0.25) continue;

      const speed = pct < 0.1 ? 0.8 : 0.4;
      const t = (Math.sin(this.frame * speed * 0.05) + 1) / 2;
      const color = this.lerp(CFG.HP_LOW, CFG.HP_CRIT, t);
      const key = `${st.id}:hp`;
      if (this.lastColor.get(key) === color) continue;
      this.lastColor.set(key, color);

      OBR.scene.items
        .updateItems([st.ids.hpFill], (items) => {
          for (const i of items)
            if (isShape(i)) i.style.fillColor = color;
        })
        .catch(() => {});
    }
  }

  private async addDeathX(id: string, lay: Layout): Promise<void> {
    const st = this.states.get(id);
    if (!st || st.ids.crack1) return;
    try {
      const sz = Math.min(lay.barW, Math.max(40, lay.barW * 0.3));
      const cx = lay.barX + lay.barW / 2;
      const cy = lay.hpY + lay.barH / 2;
      const ch = Math.max(6, lay.barH);
      const mk = (role: "crack1" | "crack2", rot: number) =>
        buildShape()
          .shapeType("RECTANGLE")
          .width(sz).height(ch)
          .position({ x: cx - sz / 2, y: cy - ch / 2 })
          .rotation(rot)
          .fillColor("#000000").strokeColor("#ff0000").strokeWidth(2)
          .attachedTo(id).layer("ATTACHMENT")
          .locked(true).disableHit(true)
          .metadata({ [META]: { type: "crack", role, tokenId: id } })
          .build();
      const c1 = mk("crack1", 45);
      const c2 = mk("crack2", -45);
      await OBR.scene.items.addItems([c1, c2]);
      st.ids.crack1 = c1.id;
      st.ids.crack2 = c2.id;
    } catch (e) {
      console.error("[Bars] Death FX error:", e);
    }
  }

  private hpColor(cur: number, max: number): string {
    const p = (Number(cur) || 0) / (Number(max) || 1);
    if (p <= 0) return CFG.DEAD;
    if (p < 0.25) return CFG.HP_LOW;
    if (p < 0.5) return CFG.HP_MED;
    return CFG.HP_HIGH;
  }

  private lerp(a: string, b: string, t: number): string {
    if (!a.startsWith("#") || !b.startsWith("#")) return a;
    const ca = parseInt(a.slice(1), 16);
    const cb = parseInt(b.slice(1), 16);
    const r = Math.round(((ca >> 16) & 255) * (1 - t) + ((cb >> 16) & 255) * t);
    const g = Math.round(((ca >> 8) & 255) * (1 - t) + ((cb >> 8) & 255) * t);
    const bl = Math.round((ca & 255) * (1 - t) + (cb & 255) * t);
    return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
  }
}

export const tokenBarService = new TokenBarService();
