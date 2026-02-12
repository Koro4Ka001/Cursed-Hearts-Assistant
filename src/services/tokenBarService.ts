/**
 * TokenBarService — HP/Mana бары НА КАРТЕ, привязанные к токенам.
 * ВИДНЫ ВСЕМ ИГРОКАМ — даже тем, у кого нет расширения.
 *
 * Создаёт 4 Shape items на каждый токен:
 * - HP background + HP fill
 * - Mana background + Mana fill
 *
 * Все items привязаны к токену через attachedTo → следуют за ним.
 */

import OBR, { buildShape, isShape, isImage } from "@owlbear-rodeo/sdk";

// ============================================================
// Constants
// ============================================================

const META_TYPE  = "com.cursed-hearts/bar-type";
const META_TOKEN = "com.cursed-hearts/bar-token";

const HP_H      = 8;
const MANA_H    = 6;
const GAP       = 2;
const BOTTOM    = 6;

const C = {
  hpBg:     "#120505",
  hpStr:    "#3a1818",
  hpHigh:   "#cc2222",
  hpMid:    "#cc6600",
  hpLow:    "#990000",
  manaBg:   "#060e1a",
  manaStr:  "#18254a",
  mana:     "#2266bb",
  manaFull: "#3388dd",
};

type BarType = "hp-bg" | "hp-fill" | "mana-bg" | "mana-fill";

interface BarIds {
  hpBg: string;
  hpFill: string;
  manaBg: string;
  manaFill: string;
}

// ============================================================
// Service
// ============================================================

class TokenBarService {
  private reg   = new Map<string, BarIds>();
  private ready = false;
  private dpi   = 150;

  // ── Initialise ────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.ready) return;
    try {
      this.dpi = await OBR.scene.grid.getDpi();
      await this.restore();
      this.ready = true;
      console.log("[TokenBars] Ready  dpi:", this.dpi, " tokens:", this.reg.size);
    } catch (e) {
      console.warn("[TokenBars] Init failed:", e);
    }
  }

  /** Scan scene for our existing bars and rebuild registry */
  private async restore(): Promise<void> {
    try {
      const all  = await OBR.scene.items.getItems();
      const ours = all.filter(
        i => (i.metadata as Record<string, unknown>)[META_TYPE] !== undefined
      );

      const map = new Map<string, Partial<BarIds>>();

      for (const item of ours) {
        const m     = item.metadata as Record<string, unknown>;
        const token = m[META_TOKEN] as string;
        const type  = m[META_TYPE]  as BarType;
        if (!token || !type) continue;

        if (!map.has(token)) map.set(token, {});
        const e = map.get(token)!;
        if (type === "hp-bg")     e.hpBg     = item.id;
        if (type === "hp-fill")   e.hpFill   = item.id;
        if (type === "mana-bg")   e.manaBg   = item.id;
        if (type === "mana-fill") e.manaFill = item.id;
      }

      for (const [tok, ids] of map) {
        if (ids.hpBg && ids.hpFill && ids.manaBg && ids.manaFill) {
          this.reg.set(tok, ids as BarIds);
        }
      }
    } catch (e) {
      console.warn("[TokenBars] Restore failed:", e);
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private barW(): number {
    return Math.round(this.dpi * 0.85);
  }

  private hpCol(p: number): string {
    if (p > 0.5)  return C.hpHigh;
    if (p > 0.25) return C.hpMid;
    return C.hpLow;
  }

  private manaCol(p: number): string {
    return p > 0.8 ? C.manaFull : C.mana;
  }

  private async bottomY(tokenId: string): Promise<number> {
    try {
      const items = await OBR.scene.items.getItems([tokenId]);
      const item  = items[0];
      if (item && isImage(item)) {
        const s = this.dpi / item.grid.dpi;
        return (item.image.height * item.scale.y * s) / 2;
      }
    } catch { /* ignore */ }
    return this.dpi / 2;
  }

  private meta(type: BarType, tokenId: string) {
    return { [META_TYPE]: type, [META_TOKEN]: tokenId };
  }

  // ── Create ────────────────────────────────────────────────

  async createBars(
    tokenId: string,
    hp: number, maxHp: number,
    mana: number, maxMana: number,
    hideHp: boolean
  ): Promise<void> {
    if (!this.ready) return;

    // Already exists → update
    if (this.reg.has(tokenId)) {
      return this.updateBars(tokenId, hp, maxHp, mana, maxMana, hideHp);
    }

    try {
      const w   = this.barW();
      const bot = await this.bottomY(tokenId);
      const x   = -w / 2;
      const hpY = bot + BOTTOM;
      const mnY = hideHp ? hpY : hpY + HP_H + GAP;

      const hpP = maxHp   > 0 ? Math.max(0, Math.min(1, hp   / maxHp))   : 0;
      const mnP = maxMana  > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      const hpBg = buildShape()
        .shapeType("RECTANGLE").width(w).height(HP_H)
        .position({ x, y: hpY })
        .attachedTo(tokenId).layer("ATTACHMENT")
        .locked(true).disableHit(true).visible(!hideHp)
        .disableAutoZIndex(true).zIndex(1)
        .name("ch-hp-bg")
        .metadata(this.meta("hp-bg", tokenId))
        .style({
          fillColor: C.hpBg, fillOpacity: 0.9,
          strokeColor: C.hpStr, strokeWidth: 1
        })
        .build();

      const hpFill = buildShape()
        .shapeType("RECTANGLE")
        .width(Math.max(1, hpP * (w - 2)))
        .height(HP_H - 2)
        .position({ x: x + 1, y: hpY + 1 })
        .attachedTo(tokenId).layer("ATTACHMENT")
        .locked(true).disableHit(true).visible(!hideHp)
        .disableAutoZIndex(true).zIndex(2)
        .name("ch-hp-fill")
        .metadata(this.meta("hp-fill", tokenId))
        .style({
          fillColor: this.hpCol(hpP), fillOpacity: 1,
          strokeColor: C.hpBg, strokeWidth: 0
        })
        .build();

      const manaBg = buildShape()
        .shapeType("RECTANGLE").width(w).height(MANA_H)
        .position({ x, y: mnY })
        .attachedTo(tokenId).layer("ATTACHMENT")
        .locked(true).disableHit(true).visible(true)
        .disableAutoZIndex(true).zIndex(3)
        .name("ch-mana-bg")
        .metadata(this.meta("mana-bg", tokenId))
        .style({
          fillColor: C.manaBg, fillOpacity: 0.9,
          strokeColor: C.manaStr, strokeWidth: 1
        })
        .build();

      const manaFill = buildShape()
        .shapeType("RECTANGLE")
        .width(Math.max(1, mnP * (w - 2)))
        .height(MANA_H - 2)
        .position({ x: x + 1, y: mnY + 1 })
        .attachedTo(tokenId).layer("ATTACHMENT")
        .locked(true).disableHit(true).visible(true)
        .disableAutoZIndex(true).zIndex(4)
        .name("ch-mana-fill")
        .metadata(this.meta("mana-fill", tokenId))
        .style({
          fillColor: this.manaCol(mnP), fillOpacity: 1,
          strokeColor: C.manaBg, strokeWidth: 0
        })
        .build();

      await OBR.scene.items.addItems([hpBg, hpFill, manaBg, manaFill]);

      this.reg.set(tokenId, {
        hpBg:     hpBg.id,
        hpFill:   hpFill.id,
        manaBg:   manaBg.id,
        manaFill: manaFill.id,
      });

      console.log("[TokenBars] Created for", tokenId);
    } catch (e) {
      console.warn("[TokenBars] Create failed:", e);
    }
  }

  // ── Update ────────────────────────────────────────────────

  async updateBars(
    tokenId: string,
    hp: number, maxHp: number,
    mana: number, maxMana: number,
    hideHp: boolean
  ): Promise<void> {
    if (!this.ready) return;

    const ids = this.reg.get(tokenId);
    if (!ids) return this.createBars(tokenId, hp, maxHp, mana, maxMana, hideHp);

    try {
      const w   = this.barW();
      const hpP = maxHp  > 0 ? Math.max(0, Math.min(1, hp   / maxHp))   : 0;
      const mnP = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      await OBR.scene.items.updateItems(
        [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill],
        (items) => {
          for (const item of items) {
            if (!isShape(item)) continue;
            const type = (item.metadata as Record<string, unknown>)[META_TYPE] as BarType;

            switch (type) {
              case "hp-bg":
                item.visible = !hideHp;
                break;

              case "hp-fill":
                item.visible = !hideHp;
                item.width = Math.max(1, hpP * (w - 2));
                item.style.fillColor = this.hpCol(hpP);
                break;

              case "mana-fill":
                item.width = Math.max(1, mnP * (w - 2));
                item.style.fillColor = this.manaCol(mnP);
                break;

              // mana-bg — ничего не меняем
            }
          }
        }
      );
    } catch (e) {
      console.warn("[TokenBars] Update failed:", e);
      this.reg.delete(tokenId);
    }
  }

  // ── Remove ────────────────────────────────────────────────

  async removeBars(tokenId: string): Promise<void> {
    if (!this.ready) return;
    const ids = this.reg.get(tokenId);
    if (!ids) return;

    try {
      await OBR.scene.items.deleteItems([
        ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill
      ]);
    } catch (e) {
      console.warn("[TokenBars] Remove failed:", e);
    }
    this.reg.delete(tokenId);
  }

  async removeAllBars(): Promise<void> {
    if (!this.ready) return;
    try {
      const all  = await OBR.scene.items.getItems();
      const ours = all.filter(
        i => (i.metadata as Record<string, unknown>)[META_TYPE] !== undefined
      );
      if (ours.length > 0) {
        await OBR.scene.items.deleteItems(ours.map(i => i.id));
      }
    } catch (e) {
      console.warn("[TokenBars] RemoveAll failed:", e);
    }
    this.reg.clear();
  }

  // ── Bulk sync ─────────────────────────────────────────────

  async syncAllBars(
    units: Array<{
      owlbearTokenId?: string;
      health: { current: number; max: number };
      mana:   { current: number; max: number };
      useManaAsHp: boolean;
    }>
  ): Promise<void> {
    for (const u of units) {
      if (u.owlbearTokenId) {
        await this.updateBars(
          u.owlbearTokenId,
          u.health.current, u.health.max,
          u.mana.current,   u.mana.max,
          u.useManaAsHp
        );
      }
    }
  }
}

export const tokenBarService = new TokenBarService();
