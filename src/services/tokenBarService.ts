// src/services/tokenBarService.ts

import OBR, { 
  buildShape, 
  Item, 
  isImage, 
  isShape,
  Shape,
  Image
} from "@owlbear-rodeo/sdk";
import type { Unit } from "../types";

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

const METADATA_KEY = "cursed-hearts-assistant";
const BAR_PREFIX = `${METADATA_KEY}/bar`;

const CONFIG = {
  // 📐 КАЛИБРОВКА
  BAR_HEIGHT: 6,
  BAR_GAP: 2,
  BAR_OFFSET: 2,  // Пикселей от нижнего края токена
  MIN_BAR_WIDTH: 40,
  MAX_BAR_WIDTH: 120,
  BAR_WIDTH_RATIO: 0.8,
  
  // Цвета
  HP_BG: "#1a0808",
  HP_STROKE: "#4a2020",
  HP_HIGH: "#8b0000",
  HP_MED: "#cc4400",
  HP_LOW: "#ff2200",
  HP_CRIT: "#ff0000",
  
  MANA_BG: "#080818",
  MANA_STROKE: "#202050",
  MANA_FILL: "#2244aa",
  MANA_BRIGHT: "#4488ff",
  
  ANIM_INTERVAL: 150,
} as const;

// ============================================================================
// ТИПЫ
// ============================================================================

interface BarIds {
  hpBg: string;
  hpFill: string;
  manaBg: string;
  manaFill: string;
}

interface BarState {
  tokenId: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  useManaAsHp: boolean;
  tokenHeight: number;
  barWidth: number;
}

// ============================================================================
// СЕРВИС
// ============================================================================

class TokenBarService {
  private bars = new Map<string, BarIds>();
  private states = new Map<string, BarState>();
  private initialized = false;
  private unsub: (() => void) | null = null;
  private animInterval: number | null = null;
  private frame = 0;

  // ==========================================================================
  // INIT
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        OBR.scene.onReadyChange(async (r) => {
          if (r && !this.initialized) await this.doInit();
        });
        return;
      }
      await this.doInit();
    } catch (e) {
      console.error("[Bars] Init failed:", e);
    }
  }

  private async doInit(): Promise<void> {
    await this.cleanup();
    this.unsub = OBR.scene.items.onChange(() => {});
    this.startAnim();
    this.initialized = true;
    console.log("[Bars] ✓ Ready");
  }

  // ==========================================================================
  // ОТНОСИТЕЛЬНЫЕ ПОЗИЦИИ (ключевое!)
  // ==========================================================================

  private getRelativePositions(tokenHeight: number, barWidth: number, showHp: boolean) {
    // ВСЕ КООРДИНАТЫ ОТНОСИТЕЛЬНО ЦЕНТРА ТОКЕНА!
    // x=0, y=0 = центр токена
    // x=-50 = 50px левее центра
    // y=100 = 100px ниже центра
    
    const halfHeight = tokenHeight / 2;
    const left = -barWidth / 2;  // Центрируем бар по X
    
    const hpY = halfHeight + CONFIG.BAR_OFFSET;
    const manaY = showHp ? hpY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP : hpY;

    return {
      hpBg: { x: left, y: hpY },
      hpFill: { x: left + 1, y: hpY + 1 },
      manaBg: { x: left, y: manaY },
      manaFill: { x: left + 1, y: manaY + 1 },
    };
  }

  // ==========================================================================
  // CREATE
  // ==========================================================================

  async createBars(
    tokenId: string,
    hp: number,
    maxHp: number,
    mana: number,
    maxMana: number,
    useManaAsHp = false
  ): Promise<void> {
    if (!tokenId) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      await this.removeBars(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length || !isImage(items[0])) {
        console.warn("[Bars] Token not found:", tokenId);
        return;
      }

      const token = items[0] as Image;
      const tokenW = token.image.width * token.scale.x;
      const tokenH = token.image.height * token.scale.y;
      const barW = Math.min(CONFIG.MAX_BAR_WIDTH, Math.max(CONFIG.MIN_BAR_WIDTH, tokenW * CONFIG.BAR_WIDTH_RATIO));

      const showHp = !useManaAsHp;
      const pos = this.getRelativePositions(tokenH, barW, showHp);

      console.log(`[Bars] Token ${tokenId.slice(0,8)}: size=${tokenW.toFixed(0)}x${tokenH.toFixed(0)}`);
      console.log(`[Bars] Relative HP pos: (${pos.hpBg.x.toFixed(0)}, ${pos.hpBg.y.toFixed(0)})`);

      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      const ts = Date.now();
      const ids: BarIds = {
        hpBg: `${BAR_PREFIX}/hpbg/${tokenId}/${ts}`,
        hpFill: `${BAR_PREFIX}/hpfill/${tokenId}/${ts}`,
        manaBg: `${BAR_PREFIX}/manabg/${tokenId}/${ts}`,
        manaFill: `${BAR_PREFIX}/manafill/${tokenId}/${ts}`,
      };

      const shapes: Shape[] = [];

      // HP Background
      if (showHp) {
        shapes.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(barW)
            .height(CONFIG.BAR_HEIGHT)
            .position(pos.hpBg)
            .attachedTo(tokenId)
            .disableAttachmentBehavior(["ROTATION", "COPY", "SCALE"])
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(CONFIG.HP_BG)
            .strokeColor(CONFIG.HP_STROKE)
            .strokeWidth(1)
            .id(ids.hpBg)
            .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
            .build()
        );

        // HP Fill
        const hpW = Math.max(1, (barW - 2) * hpPct);
        shapes.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(hpW)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position(pos.hpFill)
            .attachedTo(tokenId)
            .disableAttachmentBehavior(["ROTATION", "COPY", "SCALE"])
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible && hpPct > 0)
            .fillColor(this.hpColor(hpPct))
            .strokeWidth(0)
            .id(ids.hpFill)
            .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
            .build()
        );
      }

      // Mana Background
      shapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barW)
          .height(CONFIG.BAR_HEIGHT)
          .position(pos.manaBg)
          .attachedTo(tokenId)
          .disableAttachmentBehavior(["ROTATION", "COPY", "SCALE"])
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(token.visible)
          .fillColor(useManaAsHp ? CONFIG.HP_BG : CONFIG.MANA_BG)
          .strokeColor(useManaAsHp ? CONFIG.HP_STROKE : CONFIG.MANA_STROKE)
          .strokeWidth(1)
          .id(ids.manaBg)
          .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
          .build()
      );

      // Mana Fill
      const manaW = Math.max(1, (barW - 2) * manaPct);
      shapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(manaW)
          .height(CONFIG.BAR_HEIGHT - 2)
          .position(pos.manaFill)
          .attachedTo(tokenId)
          .disableAttachmentBehavior(["ROTATION", "COPY", "SCALE"])
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(token.visible && manaPct > 0)
          .fillColor(useManaAsHp ? this.hpColor(manaPct) : CONFIG.MANA_FILL)
          .strokeWidth(0)
          .id(ids.manaFill)
          .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
          .build()
      );

      await OBR.scene.items.addItems(shapes);
      this.bars.set(tokenId, ids);
      this.states.set(tokenId, { tokenId, hp, maxHp, mana, maxMana, useManaAsHp, tokenHeight: tokenH, barWidth: barW });

      console.log(`[Bars] ✓ Created ${shapes.length} bars`);
    } catch (e) {
      console.error("[Bars] Create failed:", e);
    }
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  async updateBars(
    tokenId: string,
    hp: number,
    maxHp: number,
    mana: number,
    maxMana: number,
    useManaAsHp = false
  ): Promise<void> {
    if (!tokenId) return;

    const ids = this.bars.get(tokenId);
    if (!ids) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    try {
      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length || !isImage(items[0])) {
        await this.removeBars(tokenId);
        return;
      }

      const token = items[0] as Image;
      const tokenH = token.image.height * token.scale.y;
      const state = this.states.get(tokenId);
      const barW = state?.barWidth ?? 100;
      const showHp = !useManaAsHp;
      const pos = this.getRelativePositions(tokenH, barW, showHp);

      this.states.set(tokenId, { tokenId, hp, maxHp, mana, maxMana, useManaAsHp, tokenHeight: tokenH, barWidth: barW });

      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const hpW = Math.max(1, (barW - 2) * hpPct);
      const manaW = Math.max(1, (barW - 2) * manaPct);

      await OBR.scene.items.updateItems([ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill], (upd) => {
        for (const item of upd) {
          if (!isShape(item)) continue;

          if (item.id === ids.hpBg) {
            item.position = pos.hpBg;
            item.visible = token.visible && showHp;
          } else if (item.id === ids.hpFill) {
            item.width = hpW;
            item.position = pos.hpFill;
            item.style.fillColor = this.hpColor(hpPct);
            item.visible = token.visible && showHp && hpPct > 0;
          } else if (item.id === ids.manaBg) {
            item.position = pos.manaBg;
            item.visible = token.visible;
          } else if (item.id === ids.manaFill) {
            item.width = manaW;
            item.position = pos.manaFill;
            item.visible = token.visible && manaPct > 0;
          }
        }
      });
    } catch (e) {
      console.error("[Bars] Update failed:", e);
    }
  }

  // ==========================================================================
  // REMOVE
  // ==========================================================================

  async removeBars(tokenId: string): Promise<void> {
    const ids = this.bars.get(tokenId);
    if (!ids) return;

    try {
      await OBR.scene.items.deleteItems([ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill]);
    } catch {}

    this.bars.delete(tokenId);
    this.states.delete(tokenId);
  }

  async removeAllBars(): Promise<void> {
    for (const id of this.bars.keys()) {
      await this.removeBars(id);
    }
    await this.cleanup();
    console.log("[Bars] All removed");
  }

  // ==========================================================================
  // SYNC
  // ==========================================================================

  async syncAllBars(units: Unit[]): Promise<void> {
    console.log(`[Bars] Sync ${units.length} units`);
    
    const valid = new Set<string>();

    for (const u of units) {
      if (u.owlbearTokenId) {
        valid.add(u.owlbearTokenId);
        await this.createBars(
          u.owlbearTokenId,
          u.health?.current ?? 0,
          u.health?.max ?? 100,
          u.mana?.current ?? 0,
          u.mana?.max ?? 50,
          u.useManaAsHp ?? false
        );
      }
    }

    for (const id of this.bars.keys()) {
      if (!valid.has(id)) await this.removeBars(id);
    }
  }

  async forceRefresh(): Promise<void> {
    console.log("[Bars] Force refresh");
    const s = new Map(this.states);
    await this.removeAllBars();
    for (const [id, st] of s) {
      await this.createBars(id, st.hp, st.maxHp, st.mana, st.maxMana, st.useManaAsHp);
    }
  }

  // ==========================================================================
  // ANIMATION
  // ==========================================================================

  private startAnim(): void {
    if (this.animInterval) return;
    this.animInterval = window.setInterval(() => {
      this.frame++;
      this.animate();
    }, CONFIG.ANIM_INTERVAL);
  }

  private async animate(): Promise<void> {
    for (const [tokenId, state] of this.states) {
      const ids = this.bars.get(tokenId);
      if (!ids) continue;

      const hpPct = state.maxHp > 0 ? state.hp / state.maxHp : 0;
      const manaPct = state.maxMana > 0 ? state.mana / state.maxMana : 0;

      // HP пульсация
      if (hpPct > 0 && hpPct < 0.5) {
        const pulse = Math.sin(this.frame * 0.4) * 0.5 + 0.5;
        const color = hpPct < 0.1
          ? (pulse > 0.5 ? "#ff0000" : "#880000")
          : hpPct < 0.25
            ? (pulse > 0.5 ? "#ff2200" : "#aa0000")
            : (pulse > 0.5 ? "#cc4400" : "#992200");

        try {
          await OBR.scene.items.updateItems([ids.hpFill], (items) => {
            for (const i of items) if (isShape(i)) i.style.fillColor = color;
          });
        } catch {}
      }

      // Mana мерцание
      if (manaPct > 0.5) {
        const shimmer = Math.sin(this.frame * 0.2) * 0.5 + 0.5;
        const color = manaPct > 0.75
          ? (shimmer > 0.5 ? "#4488ff" : "#2255cc")
          : (shimmer > 0.5 ? "#3366dd" : "#2244aa");

        try {
          await OBR.scene.items.updateItems([ids.manaFill], (items) => {
            for (const i of items) if (isShape(i)) i.style.fillColor = color;
          });
        } catch {}
      }
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private hpColor(pct: number): string {
    if (pct < 0.1) return CONFIG.HP_CRIT;
    if (pct < 0.25) return CONFIG.HP_LOW;
    if (pct < 0.5) return CONFIG.HP_MED;
    return CONFIG.HP_HIGH;
  }

  private async cleanup(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const ours = items.filter(i => 
        i.id.startsWith(BAR_PREFIX) || 
        (i.metadata?.[METADATA_KEY] as any)?.type === "bar"
      );
      if (ours.length) {
        await OBR.scene.items.deleteItems(ours.map(i => i.id));
        console.log(`[Bars] Cleaned ${ours.length}`);
      }
    } catch {}
  }

  async destroy(): Promise<void> {
    if (this.animInterval) clearInterval(this.animInterval);
    if (this.unsub) this.unsub();
    await this.removeAllBars();
    this.initialized = false;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const tokenBarService = new TokenBarService();
(window as any).tokenBarService = tokenBarService;
