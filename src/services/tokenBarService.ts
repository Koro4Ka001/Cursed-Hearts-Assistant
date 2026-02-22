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

const METADATA_KEY = "cursed-hearts-assistant";
const BAR_PREFIX = `${METADATA_KEY}/bar`;

const CONFIG = {
  BAR_HEIGHT: 6,
  BAR_GAP: 2,
  BAR_OFFSET: 1,  // ✅ ИСПРАВЛЕНО: положительное = ПОД токеном
  MIN_BAR_WIDTH: 40,
  MAX_BAR_WIDTH: 120,
  BAR_WIDTH_RATIO: 0.8,
  
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
  
  ANIM_INTERVAL: 100,
} as const;

interface BarIds {
  hpBg: string;
  hpFill: string;
  manaBg: string;
  manaFill: string;
  crack1?: string;
  crack2?: string;
  crack3?: string;
}

interface BarState {
  tokenId: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  useManaAsHp: boolean;
  tokenX: number;
  tokenY: number;
  tokenH: number;
  barW: number;
  isDead: boolean;
}

class TokenBarService {
  private bars = new Map<string, BarIds>();
  private states = new Map<string, BarState>();
  private initialized = false;
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
      console.error("[Bars] Init error:", e);
    }
  }

  private async doInit(): Promise<void> {
    await this.cleanup();
    this.startAnim();
    this.initialized = true;
    console.log("[Bars] ✓ Ready");
  }

  // ==========================================================================
  // ПРОВЕРКА СМЕРТИ
  // ==========================================================================

  private isDead(hp: number): boolean {
    return hp <= 0;
  }

  // ==========================================================================
  // ВЫЧИСЛЕНИЕ ПОЗИЦИИ БАРОВ
  // ==========================================================================

  private calculateBarPositions(token: Image, barW: number, showHp: boolean) {
    const tokenH = token.image.height * token.scale.y;
    const tokenX = token.position.x;
    const tokenY = token.position.y;
    
    // Бары располагаются ПОД токеном
    // position в OBR - это центр токена, поэтому:
    // низ токена = tokenY + tokenH/2
    // бар HP начинается ниже на BAR_OFFSET
    const barX = tokenX - barW / 2;
    const hpBarY = tokenY + tokenH / 2 + CONFIG.BAR_OFFSET;
    const manaBarY = showHp 
      ? hpBarY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP 
      : hpBarY;
    
    console.log(`[Bars] Position calc: tokenY=${tokenY}, tokenH=${tokenH}, barY=${hpBarY}`);
    
    return { barX, hpBarY, manaBarY, tokenX, tokenY, tokenH };
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
    if (!tokenId) {
      console.warn("[Bars] createBars called without tokenId");
      return;
    }

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        console.warn("[Bars] Scene not ready");
        return;
      }

      await this.removeBars(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length || !isImage(items[0])) {
        console.warn("[Bars] Token not found or not an image:", tokenId);
        return;
      }

      const token = items[0] as Image;
      const tokenW = token.image.width * token.scale.x;
      const barW = Math.min(CONFIG.MAX_BAR_WIDTH, Math.max(CONFIG.MIN_BAR_WIDTH, tokenW * CONFIG.BAR_WIDTH_RATIO));
      const showHp = !useManaAsHp;

      const { barX, hpBarY, manaBarY, tokenX, tokenY, tokenH } = 
        this.calculateBarPositions(token, barW, showHp);

      const dead = this.isDead(hp);
      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      console.log(`[Bars] Creating for ${tokenId}: HP=${hp}/${maxHp} (${Math.round(hpPct*100)}%), dead=${dead}, pos=(${barX}, ${hpBarY})`);

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
            .position({ x: barX, y: hpBarY })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible && !dead)
            .fillColor(CONFIG.HP_BG)
            .strokeColor(CONFIG.HP_STROKE)
            .strokeWidth(1)
            .zIndex(1)
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
            .position({ x: barX + 1, y: hpBarY + 1 })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible && !dead && hpPct > 0)
            .fillColor(this.hpColor(hpPct))
            .strokeWidth(0)
            .zIndex(2)
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
          .position({ x: barX, y: manaBarY })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(token.visible)
          .fillColor(useManaAsHp ? CONFIG.HP_BG : CONFIG.MANA_BG)
          .strokeColor(useManaAsHp ? CONFIG.HP_STROKE : CONFIG.MANA_STROKE)
          .strokeWidth(1)
          .zIndex(1)
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
          .position({ x: barX + 1, y: manaBarY + 1 })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(token.visible && manaPct > 0)
          .fillColor(useManaAsHp ? this.hpColor(manaPct) : CONFIG.MANA_FILL)
          .strokeWidth(0)
          .zIndex(2)
          .id(ids.manaFill)
          .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
          .build()
      );

      await OBR.scene.items.addItems(shapes);
      this.bars.set(tokenId, ids);
      this.states.set(tokenId, { 
        tokenId, hp, maxHp, mana, maxMana, useManaAsHp,
        tokenX, tokenY, tokenH, barW,
        isDead: dead
      });

      console.log(`[Bars] ✓ Created ${shapes.length} shapes for ${tokenId}`);

      // Если мёртв — создаём трещины
      if (showHp && dead) {
        console.log("[Bars] 💀 Creating death effect on create");
        await this.createDeathEffect(tokenId);
      }
    } catch (e) {
      console.error("[Bars] Create error:", e);
    }
  }

  // ==========================================================================
  // DEATH EFFECT
  // ==========================================================================

  private async createDeathEffect(tokenId: string): Promise<void> {
    const ids = this.bars.get(tokenId);
    const state = this.states.get(tokenId);
    if (!ids || !state) return;

    if (ids.crack1) {
      console.log("[Bars] Cracks already exist, skipping");
      return;
    }

    try {
      const barX = state.tokenX - state.barW / 2;
      const hpBarY = state.tokenY + state.tokenH / 2 + CONFIG.BAR_OFFSET;
      const barW = state.barW;

      const ts = Date.now();
      const crackShapes: Shape[] = [];

      // Осколок 1 (левый)
      const crack1Id = `${BAR_PREFIX}/crack1/${tokenId}/${ts}`;
      crackShapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barW * 0.32)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: barX - 3, y: hpBarY + 2 })
          .rotation(-18)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .fillColor("#2a0a0a")
          .strokeColor("#5a1818")
          .strokeWidth(1)
          .zIndex(3)
          .id(crack1Id)
          .metadata({ [METADATA_KEY]: { type: "crack", tokenId } })
          .build()
      );

      // Осколок 2 (центр)
      const crack2Id = `${BAR_PREFIX}/crack2/${tokenId}/${ts}`;
      crackShapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barW * 0.36)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: barX + barW * 0.28, y: hpBarY - 1 })
          .rotation(6)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .fillColor("#3a0808")
          .strokeColor("#6a2020")
          .strokeWidth(1)
          .zIndex(3)
          .id(crack2Id)
          .metadata({ [METADATA_KEY]: { type: "crack", tokenId } })
          .build()
      );

      // Осколок 3 (правый)
      const crack3Id = `${BAR_PREFIX}/crack3/${tokenId}/${ts}`;
      crackShapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barW * 0.28)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: barX + barW * 0.68, y: hpBarY + 3 })
          .rotation(22)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .fillColor("#1a0505")
          .strokeColor("#4a1212")
          .strokeWidth(1)
          .zIndex(3)
          .id(crack3Id)
          .metadata({ [METADATA_KEY]: { type: "crack", tokenId } })
          .build()
      );

      await OBR.scene.items.addItems(crackShapes);
      
      ids.crack1 = crack1Id;
      ids.crack2 = crack2Id;
      ids.crack3 = crack3Id;

      console.log("[Bars] 💀 Death cracks created");
    } catch (e) {
      console.error("[Bars] Death effect error:", e);
    }
  }

  private async removeDeathEffect(tokenId: string): Promise<void> {
    const ids = this.bars.get(tokenId);
    if (!ids) return;

    if (!ids.crack1) {
      return;
    }

    try {
      const crackIds = [ids.crack1, ids.crack2, ids.crack3].filter(Boolean) as string[];
      
      if (crackIds.length > 0) {
        await OBR.scene.items.deleteItems(crackIds);
        console.log(`[Bars] ✨ Removed ${crackIds.length} cracks`);
      }

      delete ids.crack1;
      delete ids.crack2;
      delete ids.crack3;
    } catch (e) {
      console.error("[Bars] Remove death effect error:", e);
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
      const tokenW = token.image.width * token.scale.x;
      const barW = Math.min(CONFIG.MAX_BAR_WIDTH, Math.max(CONFIG.MIN_BAR_WIDTH, tokenW * CONFIG.BAR_WIDTH_RATIO));

      const oldState = this.states.get(tokenId);
      const wasDead = oldState?.isDead ?? false;
      const nowDead = this.isDead(hp);

      const showHp = !useManaAsHp;
      const { barX, hpBarY, manaBarY, tokenX, tokenY, tokenH } = 
        this.calculateBarPositions(token, barW, showHp);

      console.log(`[Bars] Update ${tokenId}: HP=${hp}/${maxHp}, wasDead=${wasDead}, nowDead=${nowDead}`);

      // Обновляем состояние
      this.states.set(tokenId, { 
        tokenId, hp, maxHp, mana, maxMana, useManaAsHp,
        tokenX, tokenY, tokenH, barW,
        isDead: nowDead
      });

      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const hpW = Math.max(1, (barW - 2) * hpPct);
      const manaW = Math.max(1, (barW - 2) * manaPct);

      // Проверяем переходы жизнь<->смерть
      if (showHp) {
        if (nowDead && !wasDead) {
          console.log("[Bars] 💀 Character died!");
          await this.createDeathEffect(tokenId);
        } else if (!nowDead && wasDead) {
          console.log("[Bars] ✨ Character resurrected!");
          await this.removeDeathEffect(tokenId);
        }
      }

      // Обновляем визуал баров
      const barIds = [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill].filter(Boolean);
      
      await OBR.scene.items.updateItems(barIds, (upd) => {
        for (const item of upd) {
          if (!isShape(item)) continue;

          if (item.id === ids.hpBg) {
            item.position = { x: barX, y: hpBarY };
            item.width = barW;
            item.visible = token.visible && showHp && !nowDead;
          } else if (item.id === ids.hpFill) {
            item.position = { x: barX + 1, y: hpBarY + 1 };
            item.width = hpW;
            item.style.fillColor = this.hpColor(hpPct);
            item.visible = token.visible && showHp && !nowDead && hpPct > 0;
          } else if (item.id === ids.manaBg) {
            item.position = { x: barX, y: manaBarY };
            item.width = barW;
            item.visible = token.visible;
          } else if (item.id === ids.manaFill) {
            item.position = { x: barX + 1, y: manaBarY + 1 };
            item.width = manaW;
            item.visible = token.visible && manaPct > 0;
          }
        }
      });
    } catch (e) {
      console.error("[Bars] Update error:", e);
    }
  }

  // ==========================================================================
  // REMOVE
  // ==========================================================================

  async removeBars(tokenId: string): Promise<void> {
    const ids = this.bars.get(tokenId);
    if (!ids) return;
    
    try {
      const allIds = [
        ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill,
        ids.crack1, ids.crack2, ids.crack3
      ].filter(Boolean) as string[];
      
      if (allIds.length > 0) {
        await OBR.scene.items.deleteItems(allIds);
        console.log(`[Bars] Removed ${allIds.length} items for ${tokenId}`);
      }
    } catch (e) {
      console.error("[Bars] Remove error:", e);
    }
    
    this.bars.delete(tokenId);
    this.states.delete(tokenId);
  }

  async removeAllBars(): Promise<void> {
    for (const id of this.bars.keys()) {
      await this.removeBars(id);
    }
    await this.cleanup();
  }

  // ==========================================================================
  // SYNC
  // ==========================================================================

  async syncAllBars(units: Unit[]): Promise<void> {
    console.log(`[Bars] Syncing ${units.length} units`);
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

      const hpPct = state.maxHp > 0 ? Math.max(0, state.hp / state.maxHp) : 0;
      const manaPct = state.maxMana > 0 ? state.mana / state.maxMana : 0;
      const showHp = !state.useManaAsHp;

      // HP анимации (только если жив)
      if (showHp && !state.isDead && hpPct > 0 && hpPct < 0.5) {
        try {
          const speed = hpPct < 0.1 ? 0.8 : hpPct < 0.25 ? 0.5 : 0.3;
          const pulse = (Math.sin(this.frame * speed) + 1) / 2;
          
          let colorA: string, colorB: string;
          
          if (hpPct < 0.1) {
            colorA = "#ff0000";
            colorB = "#660000";
          } else if (hpPct < 0.25) {
            colorA = "#ff2200";
            colorB = "#881100";
          } else {
            colorA = "#cc4400";
            colorB = "#882200";
          }
          
          const color = this.lerpColor(colorB, colorA, pulse);
          
          await OBR.scene.items.updateItems([ids.hpFill], (items) => {
            for (const i of items) {
              if (isShape(i)) i.style.fillColor = color;
            }
          });

          // Дрожание при критическом HP
          if (hpPct < 0.25 && ids.hpBg) {
            const shakeX = (Math.random() - 0.5) * (hpPct < 0.1 ? 2 : 1);
            const baseX = state.tokenX - state.barW / 2;
            const baseY = state.tokenY + state.tokenH / 2 + CONFIG.BAR_OFFSET;
            
            await OBR.scene.items.updateItems([ids.hpBg], (items) => {
              for (const i of items) {
                if (isShape(i)) {
                  i.position = { x: baseX + shakeX, y: baseY };
                  i.style.strokeColor = pulse > 0.5 ? "#6a2020" : "#4a1515";
                }
              }
            });
          }
        } catch {}
      }

      // Анимация трещин (при смерти)
      if (showHp && state.isDead && ids.crack1) {
        try {
          const flicker = (Math.sin(this.frame * 0.3) + 1) / 2;
          const crackColor1 = this.lerpColor("#1a0505", "#2a0a0a", flicker);
          const crackColor2 = this.lerpColor("#2a0808", "#3a1010", flicker);
          
          const crackIds = [ids.crack1, ids.crack2, ids.crack3].filter(Boolean) as string[];
          
          await OBR.scene.items.updateItems(crackIds, (items) => {
            for (const i of items) {
              if (isShape(i)) {
                if (i.id === ids.crack1) i.style.fillColor = crackColor1;
                if (i.id === ids.crack2) i.style.fillColor = crackColor2;
                if (i.id === ids.crack3) i.style.fillColor = crackColor1;
              }
            }
          });
        } catch {}
      }

      // Mana анимации
      if (manaPct > 0) {
        try {
          let color: string;
          
          if (manaPct > 0.75) {
            const shimmer = (Math.sin(this.frame * 0.25) + 1) / 2;
            color = this.lerpColor("#2255cc", "#55aaff", shimmer);
          } else if (manaPct > 0.5) {
            const shimmer = (Math.sin(this.frame * 0.15) + 1) / 2;
            color = this.lerpColor("#2244aa", "#3366cc", shimmer);
          } else if (manaPct > 0.25) {
            color = "#2244aa";
          } else {
            const dim = (Math.sin(this.frame * 0.4) + 1) / 2;
            color = this.lerpColor("#1a2255", "#223377", dim);
          }
          
          await OBR.scene.items.updateItems([ids.manaFill], (items) => {
            for (const i of items) {
              if (isShape(i)) i.style.fillColor = color;
            }
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

  private lerpColor(color1: string, color2: string, t: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
  }

  private async cleanup(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const ours = items.filter(i => i.id.startsWith(BAR_PREFIX));
      if (ours.length) {
        await OBR.scene.items.deleteItems(ours.map(i => i.id));
        console.log(`[Bars] Cleanup: removed ${ours.length} orphan bars`);
      }
    } catch {}
  }

  async destroy(): Promise<void> {
    if (this.animInterval) clearInterval(this.animInterval);
    await this.removeAllBars();
    this.initialized = false;
    console.log("[Bars] Destroyed");
  }
}

export const tokenBarService = new TokenBarService();
