// src/services/tokenBarService.ts
import OBR, { 
  buildShape, 
  isImage, 
  isShape,
  Shape,
  Image
} from "@owlbear-rodeo/sdk";
import type { Unit } from "../types";

const METADATA_KEY = "cursed-hearts-assistant";

const CONFIG = {
  BAR_HEIGHT: 8,          
  BAR_WIDTH_RATIO: 0.80,  // 🔥 Было 0.9
  MIN_BAR_WIDTH: 30,      // 🔥 Было 40
  MAX_BAR_WIDTH: 250,     // 🔥 Было 300
  BAR_GAP: 2,             
  BAR_OFFSET_Y: 3,        // 🔥 Было -65. Теперь бары НИЖЕ токена
  
  BG_COLOR: "#0a0505",    
  STROKE_COLOR: "#000000",
  
  HP_COLOR_HIGH: "#cc2222", 
  HP_COLOR_MED:  "#aa4400", 
  HP_COLOR_LOW:  "#ff0000", 
  HP_COLOR_CRIT: "#550000", 
  
  MANA_FILL: "#2244aa",     
  
  ANIM_INTERVAL: 100,
  GRID_CELL_SIZE: 150,     // 🔥 OBR стандартный размер ячейки
} as const;

interface BarIds {
  hpBg?: string;
  hpFill?: string;
  manaBg?: string;
  manaFill?: string;
  crack1?: string;
  crack2?: string;
}

interface BarState {
  tokenId: string;
  hp: number; maxHp: number;
  mana: number; maxMana: number;
  useManaAsHp: boolean;
  tokenX: number;
  tokenY: number;
  barW: number;
  isDead: boolean;
  ids: BarIds;
}

export type BarPerformanceMode = 'quality' | 'performance';

class TokenBarService {
  private states = new Map<string, BarState>();
  private initialized = false;
  private animInterval: number | null = null;
  private frame = 0;
  private mode: BarPerformanceMode = 'quality';

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
    try {
      OBR.scene.onReadyChange(async (ready) => {
        if (ready) {
          console.log("[Bars] Scene changed, clearing bar states");
          this.states.clear();
        } else {
          this.states.clear();
        }
      });
    } catch (e) {
      console.warn("[Bars] Could not subscribe to scene changes:", e);
    }
    this.initialized = true;
    console.log("[Bars] Ready");
  }

  public setPerformanceMode(mode: BarPerformanceMode) {
    this.mode = mode;
    if (mode === 'performance' && this.animInterval) {
      clearInterval(this.animInterval);
      this.animInterval = null;
    } else if (mode === 'quality' && !this.animInterval) {
      this.startAnim();
    }
  }

  private isDead(hp: number): boolean { return hp <= 0; }

  private getHpColor(current: number, max: number): string {
    const pct = (Number(current) || 0) / (Number(max) || 1);
    if (pct <= 0) return "#333333"; 
    if (pct < 0.25) return CONFIG.HP_COLOR_LOW;
    if (pct < 0.5) return CONFIG.HP_COLOR_MED;
    return CONFIG.HP_COLOR_HIGH;
  }

  // 🔥 FIX: Правильный расчёт размеров с учётом DPI
  private calculateLayout(token: Image, useManaAsHp: boolean) {
  const scaleX = Math.abs(Number(token.scale?.x) || 1);
  const scaleY = Math.abs(Number(token.scale?.y) || 1);
  
  const imgW = Number(token.image?.width) || 150;
  const imgH = Number(token.image?.height) || 150;
  
  // 🔥 FIX: Учитываем DPI изображения для правильного размера в мировых координатах
  // В OBR: grid.dpi = сколько пикселей изображения = 1 ячейка сетки (150 мировых единиц)
  const dpi = Number(token.grid?.dpi) || 150;
  const GRID_WORLD_SIZE = 150; // OBR: 1 ячейка = 150 мировых единиц
  
  const worldWidth = (imgW / dpi) * GRID_WORLD_SIZE * scaleX;
  const worldHeight = (imgH / dpi) * GRID_WORLD_SIZE * scaleY;
  
  let barW = Math.round(worldWidth * CONFIG.BAR_WIDTH_RATIO);
  barW = Math.max(CONFIG.MIN_BAR_WIDTH, barW);
  barW = Math.min(CONFIG.MAX_BAR_WIDTH, barW);
  
  const barX = Math.round(token.position.x - barW / 2);
  const baseY = Math.round(token.position.y + worldHeight / 2 + CONFIG.BAR_OFFSET_Y);
  
  const hpY = baseY;
  const manaY = useManaAsHp ? baseY : baseY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP;
  
  return { barW, barX, hpY, manaY };
}
  
  private async removeExistingBarsFromScene(tokenId: string): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const toDelete = items.filter(i => 
        i.attachedTo === tokenId && i.metadata?.[METADATA_KEY]
      );
      if (toDelete.length > 0) {
        await OBR.scene.items.deleteItems(toDelete.map(i => i.id));
      }
    } catch (e) {
      console.warn("[Bars] Clean warning:", e);
    }
  }

  async createBars(
    tokenId: string,
    hpInput: number, maxHpInput: number,
    manaInput: number, maxManaInput: number,
    useManaAsHp = false
  ): Promise<void> {
    if (!tokenId) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      const hp = Number(hpInput) || 0;
      const maxHp = Number(maxHpInput) || 1;
      const mana = Number(manaInput) || 0;
      const maxMana = Number(maxManaInput) || 1;

      await this.removeExistingBarsFromScene(tokenId);
      this.states.delete(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length) return;
      const token = items[0];
      if (!isImage(token)) return;

      const { barW, barX, hpY, manaY } = this.calculateLayout(token as Image, useManaAsHp);
      
      const dead = this.isDead(hp);
      const hpPct = Math.max(0, Math.min(1, hp / maxHp));
      const manaPct = Math.max(0, Math.min(1, mana / maxMana));
      const showHp = !useManaAsHp;

      const shapes: Shape[] = [];
      const barIds: BarIds = {};

      const createRect = (
        role: keyof BarIds, 
        x: number, y: number, w: number, h: number, 
        color: string, z: number, visible: boolean,
        noStroke = false
      ): Shape | null => {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
          console.error(`[Bars] Invalid Rect: ${role}`, {x, y, w, h});
          return null;
        }
        const shape = buildShape()
          .shapeType("RECTANGLE")
          .width(w).height(h)
          .position({ x, y })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true).disableHit(true)
          .visible(visible)
          .fillColor(color)
          .strokeColor(CONFIG.STROKE_COLOR)
          .strokeWidth(noStroke ? 0 : 1)
          .zIndex(z)
          .metadata({ [METADATA_KEY]: { type: "bar", role, tokenId } })
          .build();
        shapes.push(shape);
        barIds[role] = shape.id;
        return shape;
      };

      if (showHp && !dead) {
        createRect('hpBg', barX, hpY, barW, CONFIG.BAR_HEIGHT, CONFIG.BG_COLOR, 10, true);
        if (hpPct > 0) {
          createRect('hpFill', barX, hpY, Math.round(Math.max(1, barW * hpPct)), CONFIG.BAR_HEIGHT, this.getHpColor(hp, maxHp), 11, true, true);
        }
      }

      if (!dead) {
        createRect('manaBg', barX, manaY, barW, CONFIG.BAR_HEIGHT, CONFIG.BG_COLOR, 10, true);
        if (manaPct > 0) {
          createRect('manaFill', barX, manaY, Math.round(Math.max(1, barW * manaPct)), CONFIG.BAR_HEIGHT, CONFIG.MANA_FILL, 11, true, true);
        }
      }

      if (shapes.length > 0) await OBR.scene.items.addItems(shapes);
      
      this.states.set(tokenId, { 
        tokenId, hp, maxHp, mana, maxMana, useManaAsHp,
        tokenX: token.position.x, tokenY: token.position.y, barW,
        isDead: dead, ids: barIds
      });

      if (showHp && dead && this.mode === 'quality') {
        await this.createDeathEffect(tokenId, barX, hpY, barW);
      }
    } catch (e: unknown) {
      console.error("[Bars] Create FAIL:", e);
    }
  }

  async updateBars(tokenId: string, hpInput: number, maxHpInput: number, manaInput: number, maxManaInput: number, useManaAsHp = false): Promise<void> {
    const state = this.states.get(tokenId);
    const hp = Number(hpInput) || 0;
    const maxHp = Number(maxHpInput) || 1;
    const mana = Number(manaInput) || 0;
    const maxMana = Number(maxManaInput) || 1;

    if (!state) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    try {
      const dead = this.isDead(hp);
      const ids = state.ids;
      const hpPct = Math.max(0, Math.min(1, hp / maxHp));
      const manaPct = Math.max(0, Math.min(1, mana / maxMana));
      
      const needsRecreation = 
        (dead !== state.isDead) ||
        (state.useManaAsHp !== useManaAsHp) ||
        (!dead && !useManaAsHp && !ids.hpFill && hpPct > 0) ||
        (!dead && !ids.manaFill && manaPct > 0) ||
        (!dead && !useManaAsHp && !ids.hpBg) ||
        (!dead && !ids.manaBg);
      
      if (needsRecreation) {
        await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
        return;
      }
      
      state.hp = hp; state.maxHp = maxHp; 
      state.mana = mana; state.maxMana = maxMana;
      state.isDead = dead; state.useManaAsHp = useManaAsHp;

      const checkId = ids.hpBg ?? ids.manaBg ?? ids.hpFill ?? ids.manaFill;
      if (!checkId) {
        await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
        return;
      }
      
      const existingItems = await OBR.scene.items.getItems([checkId]);
      if (existingItems.length === 0) {
        await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
        return;
      }

      const barW = state.barW;
      const itemsToUpdate: string[] = [];
      if (ids.hpFill) itemsToUpdate.push(ids.hpFill);
      if (ids.hpBg) itemsToUpdate.push(ids.hpBg);
      if (ids.manaFill) itemsToUpdate.push(ids.manaFill);
      if (ids.manaBg) itemsToUpdate.push(ids.manaBg);

      if (itemsToUpdate.length > 0) {
        await OBR.scene.items.updateItems(itemsToUpdate, (items) => {
          for (const item of items) {
            if (!isShape(item)) continue;
            if (item.id === ids.hpFill) {
              item.width = Math.round(Math.max(0, barW * hpPct));
              item.style.fillColor = this.getHpColor(hp, maxHp);
              item.visible = !dead && !useManaAsHp && hpPct > 0;
            } else if (item.id === ids.hpBg) {
              item.visible = !dead && !useManaAsHp;
            } else if (item.id === ids.manaFill) {
              item.width = Math.round(Math.max(0, barW * manaPct));
              item.visible = !dead && manaPct > 0;
            } else if (item.id === ids.manaBg) {
              item.visible = !dead;
            }
          }
        });
      }
    } catch (e: unknown) {
      console.warn("[Bars] Update fail, recreating...", e);
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
    }
  }

  private async createDeathEffect(tokenId: string, barX: number, barY: number, barW: number): Promise<void> {
    const state = this.states.get(tokenId);
    if (!state || state.ids.crack1) return;
    try {
      const size = Math.min(barW, 40);
      const centerX = barX + barW / 2;
      const centerY = barY + CONFIG.BAR_HEIGHT / 2;
      const make = (role: 'crack1' | 'crack2', rot: number) => buildShape()
        .shapeType("RECTANGLE").width(size).height(6)
        .position({ x: centerX - size/2, y: centerY - 3 })
        .rotation(rot).fillColor("#000000").strokeColor("#ff0000").strokeWidth(2)
        .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true)
        .metadata({ [METADATA_KEY]: { type: "crack", role, tokenId } }).build();
      const c1 = make('crack1', 45);
      const c2 = make('crack2', -45);
      await OBR.scene.items.addItems([c1, c2]);
      state.ids.crack1 = c1.id;
      state.ids.crack2 = c2.id;
    } catch (e) { console.error("[Bars] Death FX error:", e); }
  }

  private async removeDeathEffect(tokenId: string): Promise<void> {
    const state = this.states.get(tokenId);
    if (!state) return;
    const toDel = [state.ids.crack1, state.ids.crack2].filter(Boolean) as string[];
    if (toDel.length) { try { await OBR.scene.items.deleteItems(toDel); } catch {} }
    delete state.ids.crack1;
    delete state.ids.crack2;
  }

  async removeBars(tokenId: string): Promise<void> {
    await this.removeExistingBarsFromScene(tokenId);
    this.states.delete(tokenId);
  }

  async removeAllBars(): Promise<void> {
    await this.cleanup();
    this.states.clear();
  }

  async syncAllBars(units: Unit[]): Promise<void> {
    const validTokens = new Set<string>();
    for (const u of units) {
      if (u.owlbearTokenId) {
        validTokens.add(u.owlbearTokenId);
        await this.createBars(
          u.owlbearTokenId,
          u.useManaAsHp ? u.mana.current : u.health.current,
          u.useManaAsHp ? u.mana.max : u.health.max,
          u.mana.current, u.mana.max, u.useManaAsHp
        );
      }
    }
    const toRemove: string[] = [];
    for (const tokenId of this.states.keys()) {
      if (!validTokens.has(tokenId)) toRemove.push(tokenId);
    }
    for (const tokenId of toRemove) await this.removeBars(tokenId);
  }

  private async cleanup(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const ours = items.filter(i => i.metadata?.[METADATA_KEY]);
      if (ours.length) await OBR.scene.items.deleteItems(ours.map(i => i.id));
    } catch {}
  }

  private startAnim(): void {
    if (this.animInterval) return;
    this.animInterval = window.setInterval(() => {
      if (this.mode === 'quality') { this.frame++; this.animateQuality(); }
    }, CONFIG.ANIM_INTERVAL);
  }

  private async animateQuality(): Promise<void> {
    for (const [, state] of this.states) {
      if (!state.ids.hpFill || state.isDead) continue;
      const hpPct = state.maxHp > 0 ? state.hp / state.maxHp : 0;
      if (hpPct > 0 && hpPct < 0.25) {
        try {
          const speed = hpPct < 0.1 ? 0.8 : 0.4;
          const pulse = (Math.sin(this.frame * speed) + 1) / 2;
          const color = this.lerpColor(CONFIG.HP_COLOR_LOW, CONFIG.HP_COLOR_CRIT, pulse);
          await OBR.scene.items.updateItems([state.ids.hpFill], (items) => {
            for (const i of items) { if (isShape(i)) i.style.fillColor = color; }
          });
        } catch {}
      }
    }
  }

  private lerpColor(c1s: string, c2s: string, t: number): string {
    if (!c1s.startsWith('#') || !c2s.startsWith('#')) return c1s;
    const c1 = parseInt(c1s.slice(1), 16);
    const c2 = parseInt(c2s.slice(1), 16);
    const r = Math.round(((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t);
    const g = Math.round(((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t);
    const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
}

export const tokenBarService = new TokenBarService();
