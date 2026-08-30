import OBR, {
  buildShape,
  buildText,
  isImage,
  isShape,
  type Image,
  type Shape,
  type Text,
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
  // 🔧 Rage: огненный оранжево-красный — сильно контрастирует и с синей маной,
  // и с красным HP. При >50% — раскалённо-золотой + пульсация (см. tickPulse)
  RAGE: "#ff3300",
  RAGE_BRIGHT: "#ffd700",
  RAGE_PULSE: "#fff050",
  DEAD: "#333333",
} as const;

interface Layout {
  barW: number;
  barH: number;
  barX: number;
  hpY: number;
  manaY: number;
  rageY: number;
}

interface Ids {
  hpBg?: string;
  hpFill?: string;
  manaBg?: string;
  manaFill?: string;
  rageBg?: string;
  rageFill?: string;
  crack1?: string;
  crack2?: string;
  crack3?: string;
  nameLabel?: string;
}

interface State {
  id: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  rage: number;
  maxRage: number;
  hasRage: boolean;
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

  private calcLayout(tok: Image, useManaAsHp: boolean, hasRage: boolean): Layout {
    const sx = Math.abs(Number(tok.scale?.x) || 1);
    const sy = Math.abs(Number(tok.scale?.y) || 1);
    const imgW = Number(tok.image?.width) || 150;
    const imgH = Number(tok.image?.height) || 150;
    const dpi = Number(tok.grid?.dpi) || 150;
    const grid = 150;

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
    const rageY = hasRage ? (useManaAsHp ? hpY + bh + gap : manaY + bh + gap) : manaY;

    return { barW: bw, barH: bh, barX, hpY, manaY, rageY };
  }

  async createBars(
    tokenId: string,
    hpIn: number, maxHpIn: number,
    manaIn: number, maxManaIn: number,
    useManaAsHp = false,
    name?: string,
    rageIn = 0, maxRageIn = 100, hasRage = false
  ): Promise<void> {
    if (!tokenId) return;
    try {
      if (!(await OBR.scene.isReady())) return;

      const hp = Number(hpIn) || 0;
      const maxHp = Number(maxHpIn) || 1;
      const mana = Number(manaIn) || 0;
      const maxMana = Number(maxManaIn);
      const rage = Number(rageIn) || 0;
      const maxRage = Number(maxRageIn) || 100;

      await this.removeBars(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length) return;
      const tok = items[0];
      if (!isImage(tok)) return;

      const lay = this.calcLayout(tok as Image, useManaAsHp, hasRage);
      const dead = hp <= 0;
      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const ragePct = maxRage > 0 ? Math.max(0, Math.min(1, rage / maxRage)) : 0;
      // 🔧 При useManaAsHp: мана-бар рисуется на позиции HP (это и есть жизнь)
      const showHp = !useManaAsHp || (manaIn > 0 || maxManaIn > 0);

      const shapes: (Shape | Text)[] = [];
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

      // Name label above HP bar
      if (name && name.trim()) {
        const labelY = lay.hpY - 14;
        const label = buildText()
          .position({ x: lay.barX, y: labelY })
          .plainText(name)
          .fontSize(10)
          .fontFamily("Arial")
          .fillColor("#FFFFFF")
          .strokeColor("#000000")
          .strokeWidth(0.5)
          .textType("PLAIN")
          .layer("ATTACHMENT")
          .locked(true).disableHit(true)
          .visible(!dead)
          .attachedTo(tokenId)
          .metadata({ [META]: { type: "label", role: "nameLabel", tokenId } })
          .build();
        shapes.push(label);
        ids.nameLabel = label.id;
      }

      // HP-бар (или мана-бар на позиции HP при useManaAsHp)
      if (showHp && !dead) {
        const isManaAsHpBar = useManaAsHp;
        const pct = isManaAsHpBar ? manaPct : hpPct;
        const barColor = isManaAsHpBar ? CFG.MANA : this.hpColor(hp, maxHp);
        rect("hpBg", lay.barX, lay.hpY, lay.barW, lay.barH, CFG.BG, 10, true);
        if (pct > 0) {
          rect("hpFill", lay.barX, lay.hpY,
            Math.round(Math.max(1, lay.barW * pct)), lay.barH,
            barColor, 11, true, true);
        }
      }

      const hasMana = (manaIn > 0 || maxManaIn > 0) && !useManaAsHp;
      if (!dead && hasMana) {
        rect("manaBg", lay.barX, lay.manaY, lay.barW, lay.barH, CFG.BG, 10, true);
        if (manaPct > 0) {
          rect("manaFill", lay.barX, lay.manaY,
            Math.round(Math.max(1, lay.barW * manaPct)), lay.barH,
            CFG.MANA, 11, true, true);
        }
      }

      if (!dead && hasRage) {
        const rageColor = ragePct > 0.5 ? CFG.RAGE_BRIGHT : CFG.RAGE;
        rect("rageBg", lay.barX, lay.rageY, lay.barW, lay.barH, CFG.BG, 10, true);
        if (ragePct > 0) {
          rect("rageFill", lay.barX, lay.rageY,
            Math.round(Math.max(1, lay.barW * ragePct)), lay.barH,
            rageColor, 11, true, true);
        }
      }

      if (shapes.length > 0) await OBR.scene.items.addItems(shapes);

      this.states.set(tokenId, {
        id: tokenId,
        hp, maxHp, mana, maxMana, useManaAsHp,
        rage, maxRage, hasRage,
        tx: tok.position.x, ty: tok.position.y,
        bw: lay.barW, bh: lay.barH,
        dead, ids,
      });

      // 🔧 Трещины смерти — для всех мёртвых (включая useManaAsHp-существ,
      // у которых смерть = мана <= 0), не только для классического HP
      if (dead && this.mode === "quality") {
        await this.addDeathX(tokenId, lay);
      }
    } catch (e) {
      console.error("[Bars] createBars failed:", e);
    }
  }

  async updateBars(
    tokenId: string,
    hpIn: number, maxHpIn: number,
    manaIn: number, maxManaIn: number,
    useManaAsHp = false,
    rageIn = 0, maxRageIn = 100, hasRage = false
  ): Promise<void> {
    const st = this.states.get(tokenId);
    const hp = Number(hpIn) || 0;
    const maxHp = Number(maxHpIn) || 1;
    const mana = Number(manaIn) || 0;
    const maxMana = Number(maxManaIn);
    const rage = Number(rageIn) || 0;
    const maxRage = Number(maxRageIn) || 100;

    if (!st) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp, undefined, rage, maxRage, hasRage);
      return;
    }

    const dead = hp <= 0;
    const ids = st.ids;
    const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
    const ragePct = maxRage > 0 ? Math.max(0, Math.min(1, rage / maxRage)) : 0;

    const hasMana = (manaIn > 0 || maxManaIn > 0) && !useManaAsHp;
    const needRebuild =
      dead !== st.dead ||
      st.useManaAsHp !== useManaAsHp ||
      st.hasRage !== hasRage ||
      // 🔧 useManaAsHp: hpFill существует (синий мана-бар), проверяем manaPct
      (!dead && !ids.hpFill && (useManaAsHp ? manaPct > 0 : hpPct > 0)) ||
      (hasMana && !ids.manaFill && manaPct > 0) ||
      (hasRage && !ids.rageFill && ragePct > 0) ||
      (!dead && !ids.hpBg) ||
      (hasMana && !ids.manaBg) ||
      (hasRage && !ids.rageBg);

    if (needRebuild) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp, undefined, rage, maxRage, hasRage);
      return;
    }

    st.hp = hp; st.maxHp = maxHp;
    st.mana = mana; st.maxMana = maxMana;
    st.rage = rage; st.maxRage = maxRage; st.hasRage = hasRage;
    st.dead = dead; st.useManaAsHp = useManaAsHp;

    const toUpdate = [ids.hpFill, ids.hpBg, ids.manaFill, ids.manaBg, ids.rageFill, ids.rageBg].filter(
      Boolean
    ) as string[];
    if (toUpdate.length === 0) return;

    const bw = st.bw;
    try {
      await OBR.scene.items.updateItems(toUpdate, (sceneItems) => {
        for (const item of sceneItems) {
          if (!isShape(item)) continue;
          if (item.id === ids.hpFill) {
            // 🔧 useManaAsHp: мана-бар на позиции HP
            const isManaAsHpBar = useManaAsHp;
            const pct = isManaAsHpBar ? manaPct : hpPct;
            const barColor = isManaAsHpBar ? CFG.MANA : this.hpColor(hp, maxHp);
            item.width = Math.round(Math.max(0, bw * pct));
            item.style.fillColor = barColor;
            item.visible = !dead && pct > 0;
          } else if (item.id === ids.hpBg) {
            item.visible = !dead;
          } else if (item.id === ids.manaFill) {
            item.width = Math.round(Math.max(0, bw * manaPct));
            item.visible = !dead && !useManaAsHp && manaPct > 0;
          } else if (item.id === ids.manaBg) {
            item.visible = !dead && !useManaAsHp;
          } else if (item.id === ids.rageFill) {
            item.width = Math.round(Math.max(0, bw * ragePct));
            item.style.fillColor = ragePct > 0.5 ? CFG.RAGE_BRIGHT : CFG.RAGE;
            item.visible = !dead && ragePct > 0;
          } else if (item.id === ids.rageBg) {
            item.visible = !dead;
          }
        }
      });
    } catch {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp, undefined, rage, maxRage, hasRage);
    }
  }

  async removeBars(tokenId: string): Promise<void> {
    try {
      const st = this.states.get(tokenId);
      const ids = st?.ids;
      // Remove known bar shapes and labels first (most reliable)
      const knownIds = ids
        ? [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill, ids.rageBg, ids.rageFill, ids.crack1, ids.crack2, ids.crack3, ids.nameLabel].filter(Boolean) as string[]
        : [];
      if (knownIds.length > 0) {
        try { await OBR.scene.items.deleteItems(knownIds); } catch { /* some may not exist */ }
      }
      // Fallback: remove any ATTACHMENT item with our metadata attached to this token
      const items = await OBR.scene.items.getItems();
      const toDel = items.filter((i) => {
        if (i.attachedTo !== tokenId || i.layer !== "ATTACHMENT") return false;
        if (knownIds.includes(i.id)) return false;
        // Check if item belongs to us via metadata
        const meta = (i.metadata as Record<string, unknown>)?.[META];
        return meta !== undefined;
      });
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
      const hasRage = u.hasRage ?? false;
      await this.createBars(
        u.owlbearTokenId,
        u.useManaAsHp ? u.mana.current : u.health.current,
        u.useManaAsHp ? u.mana.max : u.health.max,
        u.mana.current, u.mana.max, u.useManaAsHp,
        undefined, // 🔧 Имя-лейбл не рисуем: у юнитов (игроков) оно не нужно.
        // removeBars внутри createBars удаляет старые лейблы, оставшиеся на сцене.
        hasRage ? (u.rage?.current ?? 0) : 0,
        hasRage ? (u.rage?.max ?? u.rageConfig?.max ?? 100) : 100,
        hasRage
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

      // 🔧 Rage >50%: пульсация между золотым и ярко-пламенным — бар «горит»
      if (st.hasRage && st.ids.rageFill && !st.dead) {
        const ragePct = st.maxRage > 0 ? st.rage / st.maxRage : 0;
        if (ragePct > 0.5) {
          const t2 = (Math.sin(this.frame * 0.6 * 0.05) + 1) / 2;
          const rageColor = this.lerp(CFG.RAGE_BRIGHT, CFG.RAGE_PULSE, t2);
          const rKey = `${st.id}:rage`;
          if (this.lastColor.get(rKey) !== rageColor) {
            this.lastColor.set(rKey, rageColor);
            OBR.scene.items
              .updateItems([st.ids.rageFill], (items) => {
                for (const i of items)
                  if (isShape(i)) i.style.fillColor = rageColor;
              })
              .catch(() => {});
          }
        }
      }
    }
  }

  /**
   * 🔧 «Разбит» — минимально: маленькая трещинка-зигзаг в центре бара.
   * Без подложки и без крестика: заливка HP остаётся видимой (тёмно-серой),
   * поверх неё — 3 коротких тёмных сегмента со сдвигом, имитирующих трещину.
   */
  private async addDeathX(id: string, lay: Layout): Promise<void> {
    const st = this.states.get(id);
    if (!st || st.ids.crack1) return;
    try {
      const cx = lay.barX + lay.barW * 0.5;
      const by = lay.hpY;
      const bh = Math.max(lay.barH, 4);
      const shapes: (Shape | Text)[] = [];
      const mk = (role: keyof Ids, x: number, y: number, w: number, h: number): void => {
        const s = buildShape()
          .shapeType("RECTANGLE")
          .width(w).height(h)
          .position({ x, y })
          .fillColor("#0a0505")
          .strokeColor("#0a0505")
          .strokeWidth(0)
          .attachedTo(id).layer("ATTACHMENT")
          .locked(true).disableHit(true)
          .zIndex(12)
          .metadata({ [META]: { type: "crack", role, tokenId: id } })
          .build();
        shapes.push(s);
        st.ids[role] = s.id;
      };
      // Зигзаг: три смещённых сегмента — простой и аккуратный намёк на трещину
      mk("crack1", cx - 1, by, 1.5, bh * 0.5);
      mk("crack2", cx + 1.5, by + bh * 0.3, 1.5, bh * 0.45);
      mk("crack3", cx - 2.5, by + bh * 0.55, 1.5, bh * 0.45);
      await OBR.scene.items.addItems(shapes);
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
