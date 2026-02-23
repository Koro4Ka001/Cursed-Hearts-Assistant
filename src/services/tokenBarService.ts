import OBR, { 
  buildShape, 
  isImage, 
  isShape,
  Shape,
  Image
} from "@owlbear-rodeo/sdk";
import type { Unit } from "../types";

const METADATA_KEY = "cursed-hearts-assistant";

// Настройки
const CONFIG = {
  BAR_HEIGHT: 8,          
  BAR_WIDTH_RATIO: 0.9,   
  MIN_BAR_WIDTH: 40,
  MAX_BAR_WIDTH: 300,
  BAR_GAP: 2,             
  BAR_OFFSET_Y: -65,      
  
  BG_COLOR: "#0a0505",    
  STROKE_COLOR: "#000000",
  
  HP_COLOR_HIGH: "#cc2222", 
  HP_COLOR_MED:  "#aa4400", 
  HP_COLOR_LOW:  "#ff0000", 
  HP_COLOR_CRIT: "#550000", 
  
  MANA_COLOR: "#2244aa",    
  MANA_FILL: "#2244aa",     
  
  ANIM_INTERVAL: 100,
} as const;

interface BarIds {
  hpBg: string;
  hpFill: string;
  manaBg: string;
  manaFill: string;
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
  ids?: BarIds;
}

export type BarPerformanceMode = 'quality' | 'performance';

class TokenBarService {
  private states = new Map<string, BarState>();
  private initialized = false;
  private animInterval: number | null = null;
  private frame = 0;
  
  private mode: BarPerformanceMode = 'quality';

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
    console.log("[Bars] Ready (Drawing Layer Mode)");
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

  // ==========================================================================
  // LOGIC
  // ==========================================================================

  private isDead(hp: number): boolean {
    return hp <= 0;
  }

  private getHpColor(current: number, max: number): string {
    if (max === 0) return CONFIG.HP_COLOR_LOW;
    const pct = current / max;
    if (pct <= 0) return "#333333"; 
    if (pct < 0.25) return CONFIG.HP_COLOR_LOW;
    if (pct < 0.5) return CONFIG.HP_COLOR_MED;
    return CONFIG.HP_COLOR_HIGH;
  }

  private calculateLayout(token: Image) {
    const scaleX = token.scale.x || 1;
    const scaleY = token.scale.y || 1;
    
    const worldWidth = (token.image.width || 100) * scaleX;
    const worldHeight = (token.image.height || 100) * scaleY;

    const barW = Math.min(CONFIG.MAX_BAR_WIDTH, Math.max(CONFIG.MIN_BAR_WIDTH, worldWidth * CONFIG.BAR_WIDTH_RATIO));
    
    const barX = token.position.x - barW / 2;
    const baseY = (token.position.y + worldHeight / 2) + CONFIG.BAR_OFFSET_Y;

    const hpY = baseY;
    const manaY = baseY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP;

    return { barW, barX, hpY, manaY };
  }

  // ==========================================================================
  // CRUD
  // ==========================================================================

  private async removeExistingBarsFromScene(tokenId: string): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const toDelete = items.filter(i => 
        i.attachedTo === tokenId && 
        i.metadata?.[METADATA_KEY]
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
    hp: number, maxHp: number,
    mana: number, maxMana: number,
    useManaAsHp = false
  ): Promise<void> {
    if (!tokenId) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      await this.removeExistingBarsFromScene(tokenId);
      this.states.delete(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length) return;
      
      const token = items[0];
      if (!isImage(token)) return;

      const { barW, barX, hpY, manaY } = this.calculateLayout(token as Image);
      
      // Защита от NaN
      if (!Number.isFinite(barX) || !Number.isFinite(hpY)) {
        console.error("[Bars] Invalid coords:", { barX, hpY });
        return;
      }

      const dead = this.isDead(hp);
      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const showHp = !useManaAsHp;

      const shapes: Shape[] = [];
      const tempIds: Partial<BarIds> = {};

      // Helper: Убрал zIndex, добавил явный DRAWING
      const createRect = (role: keyof BarIds, x: number, y: number, w: number, h: number, color: string, visible: boolean) => {
        const builder = buildShape()
          .shapeType("RECTANGLE")
          .width(w)
          .height(h)
          .position({ x, y })
          .attachedTo(tokenId)
          .layer("DRAWING") // ⚡ Явно указываем слой
          .locked(true)
          .disableHit(true)
          .visible(visible)
          .fillColor(color)
          .strokeColor(CONFIG.STROKE_COLOR)
          .strokeWidth(1)
          .metadata({ 
            [METADATA_KEY]: { type: "bar", role, tokenId } 
          });
          
        const shape = builder.build();
        shapes.push(shape);
        tempIds[role] = shape.id;
        return shape;
      };

      // HP
      if (showHp) {
        if (!dead) createRect('hpBg', barX, hpY, barW, CONFIG.BAR_HEIGHT, CONFIG.BG_COLOR, true);
        
        if (!dead && hpPct > 0) {
            const w = Math.max(0, barW * hpPct);
            const s = createRect('hpFill', barX, hpY, w, CONFIG.BAR_HEIGHT, this.getHpColor(hp, maxHp), true);
            s.strokeWidth = 0;
        }
      }

      // MANA
      if (!dead) {
        createRect('manaBg', barX, manaY, barW, CONFIG.BAR_HEIGHT, CONFIG.BG_COLOR, true);
        
        if (manaPct > 0) {
            const w = Math.max(0, barW * manaPct);
            const s = createRect('manaFill', barX, manaY, w, CONFIG.BAR_HEIGHT, CONFIG.MANA_FILL, true);
            s.strokeWidth = 0;
        }
      }

      await OBR.scene.items.addItems(shapes);
      
      this.states.set(tokenId, { 
        tokenId, hp, maxHp, mana, maxMana, useManaAsHp,
        tokenX: token.position.x, tokenY: token.position.y, barW,
        isDead: dead,
        ids: tempIds as BarIds
      });

      if (showHp && dead && this.mode === 'quality') {
        await this.createDeathEffect(tokenId, barX, hpY, barW);
      }

    } catch (e: any) {
      console.error("[Bars] Create FAIL:", e);
    }
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  async updateBars(tokenId: string, hp: number, maxHp: number, mana: number, maxMana: number, useManaAsHp = false): Promise<void> {
    const state = this.states.get(tokenId);
    
    if (!state || !state.ids) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    try {
      const dead = this.isDead(hp);
      const wasDead = state.isDead;
      
      state.hp = hp; state.maxHp = maxHp; state.mana = mana; state.maxMana = maxMana;
      state.isDead = dead;

      const ids = state.ids;
      const items = await OBR.scene.items.getItems([ids.hpBg || ids.manaBg]);
      if (items.length === 0) {
        await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
        return;
      }

      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const barW = state.barW;

      const itemsToUpdate: string[] = [];
      if (ids.hpFill) itemsToUpdate.push(ids.hpFill);
      if (ids.hpBg) itemsToUpdate.push(ids.hpBg);
      if (ids.manaFill) itemsToUpdate.push(ids.manaFill);
      if (ids.manaBg) itemsToUpdate.push(ids.manaBg);

      await OBR.scene.items.updateItems(itemsToUpdate, (items) => {
        for (const item of items) {
          if (!isShape(item)) continue;

          if (item.id === ids.hpFill) {
            item.width = Math.max(0, barW * hpPct);
            item.style.fillColor = this.getHpColor(hp, maxHp);
            item.visible = !dead && !useManaAsHp && hpPct > 0;
          } else if (item.id === ids.hpBg) {
            item.visible = !dead && !useManaAsHp;
          } else if (item.id === ids.manaFill) {
            item.width = Math.max(0, barW * manaPct);
            item.visible = !dead && manaPct > 0;
          } else if (item.id === ids.manaBg) {
            item.visible = !dead;
          }
        }
      });

      if (!useManaAsHp && this.mode === 'quality') {
        if (dead && !wasDead) {
            await this.createDeathEffect(tokenId, state.tokenX - barW/2, state.tokenY + CONFIG.BAR_OFFSET_Y, barW);
        }
        else if (!dead && wasDead) await this.removeDeathEffect(tokenId);
      }

    } catch (e: any) {
      console.warn("[Bars] Update fail, recreating...", e);
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
    }
  }

  // ==========================================================================
  // DEATH FX
  // ==========================================================================

  private async createDeathEffect(tokenId: string, barX: number, barY: number, barW: number): Promise<void> {
    const state = this.states.get(tokenId);
    if (!state || !state.ids) return;
    if (state.ids.crack1) return;

    try {
      const size = Math.min(barW, 40);
      const centerX = barX + barW / 2;
      const centerY = barY + CONFIG.BAR_HEIGHT / 2;

      const makeCrossPart = (role: 'crack1' | 'crack2', rot: number) => {
        const shape = buildShape()
          .shapeType("RECTANGLE")
          .width(size).height(6)
          .position({ x: centerX - size/2, y: centerY - 3 })
          .rotation(rot)
          .fillColor("#000000")
          .strokeColor("#ff0000").strokeWidth(2)
          .attachedTo(tokenId)
          .layer("DRAWING") // ⚡ И здесь
          .locked(true).disableHit(true)
          .metadata({ [METADATA_KEY]: { type: "crack", role, tokenId } }).build();
        return shape;
      };

      const c1 = makeCrossPart('crack1', 45);
      const c2 = makeCrossPart('crack2', -45);

      await OBR.scene.items.addItems([c1, c2]);

      state.ids.crack1 = c1.id;
      state.ids.crack2 = c2.id;
    } catch (e) { console.error(e); }
  }

  private async removeDeathEffect(tokenId: string): Promise<void> {
    const state = this.states.get(tokenId);
    if (!state || !state.ids) return;
    
    const toDel = [state.ids.crack1, state.ids.crack2].filter(Boolean) as string[];
    if (toDel.length) await OBR.scene.items.deleteItems(toDel);
    
    delete state.ids.crack1;
    delete state.ids.crack2;
  }

  // ==========================================================================
  // UTILS & ANIM
  // ==========================================================================

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
          u.mana.current,
          u.mana.max,
          u.useManaAsHp
        );
      }
    }
    
    for (const [tokenId] of this.states.keys()) {
      if (!validTokens.has(tokenId)) {
        await this.removeBars(tokenId);
      }
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const orphans = items.filter(i => 
        i.metadata?.[METADATA_KEY] && !i.attachedTo
      );
      if (orphans.length) {
        await OBR.scene.items.deleteItems(orphans.map(i => i.id));
      }
    } catch {}
  }

  private startAnim(): void {
    if (this.animInterval) return;
    this.animInterval = window.setInterval(() => {
      if (this.mode === 'quality') {
        this.frame++;
        this.animateQuality();
      }
    }, CONFIG.ANIM_INTERVAL);
  }

  private async animateQuality(): Promise<void> {
    for (const [tokenId, state] of this.states) {
      const ids = state.ids;
      if (!ids || state.isDead) continue;

      const hpPct = state.maxHp > 0 ? state.hp / state.maxHp : 0;
      
      if (hpPct > 0 && hpPct < 0.25) {
        try {
          const speed = hpPct < 0.1 ? 0.8 : 0.4;
          const pulse = (Math.sin(this.frame * speed) + 1) / 2;
          const color = this.lerpColor(CONFIG.HP_COLOR_LOW, CONFIG.HP_COLOR_CRIT, pulse);
          await OBR.scene.items.updateItems([ids.hpFill], (items) => {
            for (const i of items) { if (isShape(i)) i.style.fillColor = color; }
          });
        } catch {}
      }
    }
  }

  private lerpColor(color1: string, color2: string, t: number): string {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    const r = Math.round(((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t);
    const g = Math.round(((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t);
    const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
}

export const tokenBarService = new TokenBarService();
