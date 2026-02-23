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

// Настройки
const CONFIG = {
  BAR_HEIGHT: 8,          // Чуть толще, чтобы было видно на больших зумах
  BAR_WIDTH_RATIO: 0.8,   // Бар занимает 80% ширины токена
  BAR_OFFSET: -65,        // Смещение вверх от центра (подгони под свои токены)
  
  // Цвета
  HP_BG: "#1a0808",
  HP_STROKE: "#000000",
  
  HP_HIGH: "#00ff00",     // Ярко-зеленый
  HP_MED: "#ffaa00",      // Оранжевый
  HP_LOW: "#ff0000",      // Красный
  HP_CRIT: "#550000",     // Темно-бордовый
  
  MANA_BG: "#080818",
  MANA_STROKE: "#000000",
  MANA_FILL: "#2244aa",
  
  ANIM_INTERVAL: 100,     // Частота обновления анимации (только для quality режима)
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
  tokenW: number;
  tokenH: number;
  barW: number;
  isDead: boolean;
}

export type BarPerformanceMode = 'quality' | 'performance';

class TokenBarService {
  private bars = new Map<string, BarIds>();
  private states = new Map<string, BarState>();
  private initialized = false;
  private animInterval: number | null = null;
  private frame = 0;
  
  private mode: BarPerformanceMode = 'quality';

  // ==========================================================================
  // INIT & CONFIG
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
    console.log("[Bars] Ready");
  }

  public setPerformanceMode(mode: BarPerformanceMode) {
    this.mode = mode;
    console.log(`[Bars] Performance mode set to: ${mode}`);
    if (mode === 'performance' && this.animInterval) {
      clearInterval(this.animInterval);
      this.animInterval = null;
    } 
    else if (mode === 'quality' && !this.animInterval) {
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
    if (max === 0) return CONFIG.HP_LOW;
    const pct = current / max;
    if (pct <= 0) return "#333333"; 
    if (pct < 0.25) return CONFIG.HP_LOW;
    if (pct < 0.5) return CONFIG.HP_MED;
    return CONFIG.HP_HIGH;
  }

  private calculateBarPositions(token: Image, barW: number, showHp: boolean) {
    const tokenX = token.position.x;
    const tokenY = token.position.y;
    
    // Защита от undefined
    const scaleX = token.scale?.x ?? 1;
    const scaleY = token.scale?.y ?? 1;
    const width = token.image?.width ?? 100;
    const height = token.image?.height ?? 100;

    const tokenW = width * scaleX;
    const tokenH = height * scaleY;
    
    const barX = tokenX - barW / 2;
    
    // Позиционирование:
    // OBR origin = center (обычно).
    // Y центра = tokenY.
    // Низ токена = tokenY + tokenH/2.
    // Смещение BAR_OFFSET от низа (или центра, зависит от оффсета).
    // При offset -65 бар поднимется вверх.
    const hpBarY = (tokenY + tokenH / 2) + CONFIG.BAR_OFFSET;
    
    const manaBarY = showHp 
      ? hpBarY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP 
      : hpBarY;
    
    return { barX, hpBarY, manaBarY, tokenX, tokenY, tokenW, tokenH };
  }

  // ==========================================================================
  // CORE OPERATIONS
  // ==========================================================================

  private async removeExistingBarsFromScene(tokenId: string): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const toDelete = items.filter(i => 
        i.attachedTo === tokenId && 
        (i.id.startsWith(BAR_PREFIX) || i.metadata?.[METADATA_KEY])
      );
      if (toDelete.length > 0) {
        await OBR.scene.items.deleteItems(toDelete.map(i => i.id));
      }
    } catch (e) {
      console.warn("[Bars] Clean error", e);
    }
  }

  async createBars(
    tokenId: string,
    hp: number,
    maxHp: number,
    mana: number,
    maxMana: number,
    useManaAsHp = false
  ): Promise<void> {
    if (!tokenId) {
      console.warn("[Bars] createBars: No tokenId");
      return;
    }

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        console.warn("[Bars] createBars: Scene not ready");
        return;
      }

      // 1. Очистка старого
      await this.removeExistingBarsFromScene(tokenId);
      this.bars.delete(tokenId);
      this.states.delete(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length) {
        console.warn(`[Bars] Token ${tokenId} not found`);
        return;
      }

      const token = items[0];
      if (!isImage(token)) {
        console.warn(`[Bars] Token ${tokenId} is not an Image (type: ${token.type})`);
        return;
      }

      // Расчет
      const imgToken = token as Image;
      const scaleX = imgToken.scale?.x ?? 1;
      const width = imgToken.image?.width ?? 100;
      const tokenRealWidth = width * scaleX;
      
      const barW = Math.max(CONFIG.MIN_BAR_WIDTH, tokenRealWidth * CONFIG.BAR_WIDTH_RATIO);

      const showHp = !useManaAsHp;
      const { barX, hpBarY, manaBarY, tokenX, tokenY, tokenW, tokenH } = 
        this.calculateBarPositions(imgToken, barW, showHp);

      const dead = this.isDead(hp);
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

      // Helper для создания шейпа
      const makeBar = (id: string, w: number, h: number, x: number, y: number, color: string, z: number, visible: boolean, stroke?: string) => {
        const builder = buildShape()
          .shapeType("RECTANGLE")
          .width(w)
          .height(h)
          .position({ x, y })
          .attachedTo(tokenId)
          .layer("ATTACHMENT") // Если здесь падает, попробуй DRAWING
          .locked(true)
          .disableHit(true)
          .visible(visible)
          .fillColor(color)
          .zIndex(z)
          .id(id)
          .metadata({ [METADATA_KEY]: { type: "bar", tokenId } });
        
        if (stroke) {
          builder.strokeColor(stroke).strokeWidth(1);
        } else {
          builder.strokeWidth(0);
        }
        
        return builder.build();
      };

      // HP BAR
      if (showHp) {
        shapes.push(
          makeBar(ids.hpBg, barW, CONFIG.BAR_HEIGHT, barX, hpBarY, CONFIG.HP_BG, 1, token.visible && !dead, CONFIG.HP_STROKE)
        );
        
        const hpFillW = Math.max(0, (barW - 2) * hpPct);
        shapes.push(
          makeBar(ids.hpFill, hpFillW, CONFIG.BAR_HEIGHT - 2, barX + 1, hpBarY + 1, this.getHpColor(hp, maxHp), 2, token.visible && !dead && hpPct > 0)
        );
      }

      // MANA BAR
      if (!dead) {
        shapes.push(
          makeBar(ids.manaBg, barW, CONFIG.BAR_HEIGHT, barX, manaBarY, useManaAsHp ? CONFIG.HP_BG : CONFIG.MANA_BG, 1, token.visible, useManaAsHp ? CONFIG.HP_STROKE : CONFIG.MANA_STROKE)
        );

        const manaFillW = Math.max(0, (barW - 2) * manaPct);
        shapes.push(
          makeBar(ids.manaFill, manaFillW, CONFIG.BAR_HEIGHT - 2, barX + 1, manaBarY + 1, useManaAsHp ? this.getHpColor(mana, maxMana) : CONFIG.MANA_FILL, 2, token.visible && manaPct > 0)
        );
      }

      await OBR.scene.items.addItems(shapes);
      
      this.bars.set(tokenId, ids);
      this.states.set(tokenId, { 
        tokenId, hp, maxHp, mana, maxMana, useManaAsHp,
        tokenX, tokenY, tokenW, tokenH, barW,
        isDead: dead
      });

      if (showHp && dead && this.mode === 'quality') {
        await this.createDeathEffect(tokenId);
      }

    } catch (e: any) {
      console.error("[Bars] Create failed with details:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
    }
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  async updateBars(tokenId: string, hp: number, maxHp: number, mana: number, maxMana: number, useManaAsHp = false): Promise<void> {
    const state = this.states.get(tokenId);
    const ids = this.bars.get(tokenId);
    
    if (!state || !ids) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    try {
      const dead = this.isDead(hp);
      const wasDead = state.isDead;
      
      state.hp = hp; state.maxHp = maxHp; state.mana = mana; state.maxMana = maxMana;
      state.isDead = dead;

      const items = await OBR.scene.items.getItems([state.ids?.hpFill ?? '', state.ids?.manaFill ?? '', state.ids?.hpBg ?? '']);
      // Если баров на сцене нет — создаем заново
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

      await OBR.scene.items.updateItems(itemsToUpdate, (items) => {
        for (const item of items) {
          if (!isShape(item)) continue;

          if (item.id === ids.hpFill) {
            item.width = Math.max(0, (barW - 2) * hpPct);
            item.style.fillColor = this.getHpColor(hp, maxHp);
            item.visible = !dead && !useManaAsHp && hpPct > 0;
          } else if (item.id === ids.hpBg) {
            item.visible = !dead && !useManaAsHp;
          } else if (item.id === ids.manaFill) {
            item.width = Math.max(0, (barW - 2) * manaPct);
            item.visible = !dead && manaPct > 0;
          }
        }
      });

      if (!useManaAsHp && this.mode === 'quality') {
        if (dead && !wasDead) await this.createDeathEffect(tokenId);
        else if (!dead && wasDead) await this.removeDeathEffect(tokenId);
      }

    } catch (e: any) {
      console.warn("[Bars] Update fail, recreating...", e?.message);
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
    }
  }

  // ==========================================================================
  // DEATH EFFECT
  // ==========================================================================

  private async createDeathEffect(tokenId: string): Promise<void> {
    const ids = this.bars.get(tokenId);
    const state = this.states.get(tokenId);
    if (!ids || !state) return;
    if (ids.crack1) return; 

    try {
      const centerX = state.tokenX; 
      const centerY = (state.tokenY + state.tokenH / 2) + CONFIG.BAR_OFFSET + (CONFIG.BAR_HEIGHT / 2);
      
      const size = Math.min(state.barW * 0.5, 30);
      const ts = Date.now();
      const c1Id = `${BAR_PREFIX}/c1/${tokenId}/${ts}`;
      const c2Id = `${BAR_PREFIX}/c2/${tokenId}/${ts}`;

      const crossParts = [
        buildShape().shapeType("RECTANGLE").width(size).height(4)
          .position({ x: centerX - size/2, y: centerY - 2 }).rotation(45)
          .fillColor("#000000").strokeColor("#ff0000").strokeWidth(1)
          .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true)
          .id(c1Id).metadata({ [METADATA_KEY]: { type: "crack" } }).build(),
          
        buildShape().shapeType("RECTANGLE").width(size).height(4)
          .position({ x: centerX - size/2, y: centerY - 2 }).rotation(-45)
          .fillColor("#000000").strokeColor("#ff0000").strokeWidth(1)
          .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true)
          .id(c2Id).metadata({ [METADATA_KEY]: { type: "crack" } }).build()
      ];

      await OBR.scene.items.addItems(crossParts);
      ids.crack1 = c1Id;
      ids.crack2 = c2Id;
    } catch (e) { console.error(e); }
  }

  private async removeDeathEffect(tokenId: string): Promise<void> {
    const ids = this.bars.get(tokenId);
    if (!ids) return;
    
    const toDel = [ids.crack1, ids.crack2].filter(Boolean) as string[];
    if (toDel.length) await OBR.scene.items.deleteItems(toDel);
    
    delete ids.crack1;
    delete ids.crack2;
  }

  // ==========================================================================
  // UTILS
  // ==========================================================================

  async removeBars(tokenId: string): Promise<void> {
    await this.removeExistingBarsFromScene(tokenId);
    this.bars.delete(tokenId);
    this.states.delete(tokenId);
  }

  async removeAllBars(): Promise<void> {
    await this.cleanup();
    this.bars.clear();
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
    
    for (const [tokenId] of this.bars) {
      if (!validTokens.has(tokenId)) {
        await this.removeBars(tokenId);
      }
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const orphans = items.filter(i => 
        (i.id.startsWith(BAR_PREFIX) || i.metadata?.[METADATA_KEY]?.type === "crack") && 
        (!i.attachedTo)
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
      const ids = this.bars.get(tokenId);
      if (!ids || state.isDead) continue;

      const hpPct = state.maxHp > 0 ? state.hp / state.maxHp : 0;
      
      if (hpPct > 0 && hpPct < 0.25) {
        try {
          const speed = hpPct < 0.1 ? 0.8 : 0.4;
          const pulse = (Math.sin(this.frame * speed) + 1) / 2;
          const color = this.lerpColor(CONFIG.HP_LOW, "#550000", pulse);
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
