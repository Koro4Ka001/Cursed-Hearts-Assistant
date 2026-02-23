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
  BAR_OFFSET: -65,        // 🔥 Твой запрос: смещение по Y (от центра или низа)
  
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
  tokenW: number; // Реальная ширина токена (с учетом масштаба)
  tokenH: number; // Реальная высота токена
  barW: number;   // Ширина бара
  isDead: boolean;
}

export type BarPerformanceMode = 'quality' | 'performance';

class TokenBarService {
  private bars = new Map<string, BarIds>();
  private states = new Map<string, BarState>();
  private initialized = false;
  private animInterval: number | null = null;
  private frame = 0;
  
  // Режим производительности. 
  // 'quality' = анимации, пульсации, трещины. 
  // 'performance' = только статика (для 500+ токенов).
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
    await this.cleanup(); // Чистим мусор при старте
    this.startAnim();     // Запускаем луп (будет работать только в quality)
    this.initialized = true;
    console.log("[Bars] Ready");
  }

  /**
   * Переключение режима производительности.
   * Для GM-калькулятора вызывай tokenBarService.setPerformanceMode('performance')
   */
  public setPerformanceMode(mode: BarPerformanceMode) {
    this.mode = mode;
    console.log(`[Bars] Performance mode set to: ${mode}`);
    // Если переключили на перформанс — останавливаем анимацию
    if (mode === 'performance' && this.animInterval) {
      clearInterval(this.animInterval);
      this.animInterval = null;
    } 
    // Если включили качество — запускаем
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
    if (pct <= 0) return "#333333"; // Серый для трупов
    if (pct < 0.25) return CONFIG.HP_LOW;
    if (pct < 0.5) return CONFIG.HP_MED;
    return CONFIG.HP_HIGH;
  }

  /**
   * Расчет координат.
   * Учитывает масштаб токена, чтобы бары не улетали.
   */
  private calculateBarPositions(token: Image, barW: number, showHp: boolean) {
    // В OBR position - это центр токена.
    const tokenX = token.position.x;
    const tokenY = token.position.y;
    
    // Реальные размеры с учетом скейла
    const tokenScaleX = token.scale.x;
    const tokenScaleY = token.scale.y;
    const tokenW = token.image.width * tokenScaleX;
    const tokenH = token.image.height * tokenScaleY;
    
    // Центрируем бар по X
    const barX = tokenX - barW / 2;
    
    // Позиция Y.
    // tokenY (центр) + половина высоты = нижний край токена.
    // + CONFIG.BAR_OFFSET (твои -65).
    // Если offset -65, бар поднимется ВВЕРХ от нижнего края.
    const hpBarY = (tokenY + tokenH / 2) + CONFIG.BAR_OFFSET;
    
    // Мана бар (если нужен) идет под HP баром
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
    if (!tokenId) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      // 1. Сначала удаляем всё старое (защита от дублей)
      await this.removeExistingBarsFromScene(tokenId);
      this.bars.delete(tokenId);
      this.states.delete(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length || !isImage(items[0])) return;

      const token = items[0] as Image;
      
      // Расчет ширины бара.
      // Теперь он зависит от РЕАЛЬНОЙ ширины токена на карте (gridScale).
      // Нет жесткого MAX_WIDTH, чтобы на огромных монстрах бар был соразмерным.
      const tokenRealWidth = token.image.width * token.scale.x;
      const barW = Math.max(CONFIG.MIN_BAR_WIDTH, tokenRealWidth * CONFIG.BAR_WIDTH_RATIO);

      const showHp = !useManaAsHp;
      const { barX, hpBarY, manaBarY, tokenX, tokenY, tokenW, tokenH } = 
        this.calculateBarPositions(token, barW, showHp);

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

      // --- HP BAR ---
      if (showHp) {
        // Фон
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
            .zIndex(1) // Поверх токена? Или под? Обычно бары поверх.
            .id(ids.hpBg)
            .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
            .build()
        );

        // Заливка
        const hpFillW = Math.max(0, (barW - 2) * hpPct);
        shapes.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(hpFillW)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position({ x: barX + 1, y: hpBarY + 1 })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible && !dead && hpPct > 0)
            .fillColor(this.getHpColor(hp, maxHp))
            .strokeWidth(0)
            .zIndex(2)
            .id(ids.hpFill)
            .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
            .build()
        );
      }

      // --- MANA BAR ---
      if (!dead) { // Ману тоже скрываем если мертв? Или оставляем? Пусть будет видна.
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

        const manaFillW = Math.max(0, (barW - 2) * manaPct);
        shapes.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(manaFillW)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position({ x: barX + 1, y: manaBarY + 1 })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible && manaPct > 0)
            .fillColor(useManaAsHp ? this.getHpColor(mana, maxMana) : CONFIG.MANA_FILL)
            .strokeWidth(0)
            .zIndex(2)
            .id(ids.manaFill)
            .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
            .build()
        );
      }

      await OBR.scene.items.addItems(shapes);
      this.bars.set(tokenId, ids);
      this.states.set(tokenId, { 
        tokenId, hp, maxHp, mana, maxMana, useManaAsHp,
        tokenX, tokenY, tokenW, tokenH, barW,
        isDead: dead
      });

      // Эффект смерти (ТОЛЬКО В QUALITY РЕЖИМЕ)
      if (showHp && dead && this.mode === 'quality') {
        await this.createDeathEffect(tokenId);
      }

    } catch (e) {
      console.error("[Bars] Create error:", e);
    }
  }

  async updateBars(tokenId: string, hp: number, maxHp: number, mana: number, maxMana: number, useManaAsHp = false): Promise<void> {
    // Если бара нет в памяти — создаем
    const state = this.states.get(tokenId);
    const ids = this.bars.get(tokenId);
    if (!state || !ids) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    try {
      const dead = this.isDead(hp);
      const wasDead = state.isDead;
      
      // Обновляем состояние
      state.hp = hp; state.maxHp = maxHp; state.mana = mana; state.maxMana = maxMana;
      state.isDead = dead;

      // Если режим производительности — просто обновляем и выходим, без проверок сцены
      // Это супер-быстро для 500 токенов
      
      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const barW = state.barW; // Используем сохраненную ширину, чтобы не читать токен каждый раз

      const itemsToUpdate: string[] = [];
      if (ids.hpFill) itemsToUpdate.push(ids.hpFill);
      if (ids.hpBg) itemsToUpdate.push(ids.hpBg);
      if (ids.manaFill) itemsToUpdate.push(ids.manaFill);

      await OBR.scene.items.updateItems(itemsToUpdate, (items) => {
        for (const item of items) {
          if (!isShape(item)) continue;

          // HP FILL
          if (item.id === ids.hpFill) {
            item.width = Math.max(0, (barW - 2) * hpPct);
            item.style.fillColor = this.getHpColor(hp, maxHp);
            item.visible = !dead && !useManaAsHp && hpPct > 0;
          }
          // HP BG
          else if (item.id === ids.hpBg) {
            item.visible = !dead && !useManaAsHp;
          }
          // MANA FILL
          else if (item.id === ids.manaFill) {
            item.width = Math.max(0, (barW - 2) * manaPct);
            item.visible = !dead && manaPct > 0; // Скрываем и ману если мертв?
          }
        }
      });

      // Эффекты смерти — только в Quality
      if (!useManaAsHp && this.mode === 'quality') {
        if (dead && !wasDead) await this.createDeathEffect(tokenId);
        else if (!dead && wasDead) await this.removeDeathEffect(tokenId);
      }

    } catch (e) {
      // Если update упал (например, токен удалили) — пробуем пересоздать (или забить)
      console.warn("[Bars] Update fail, recreating...", e);
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
    }
  }

  // ==========================================================================
  // DEATH EFFECT (Анимация креста/осколков)
  // ==========================================================================

  private async createDeathEffect(tokenId: string): Promise<void> {
    const ids = this.bars.get(tokenId);
    const state = this.states.get(tokenId);
    if (!ids || !state) return;
    if (ids.crack1) return; // Уже есть

    try {
      // Позиция креста — по центру бара HP
      const centerX = state.tokenX; 
      const centerY = (state.tokenY + state.tokenH / 2) + CONFIG.BAR_OFFSET + (CONFIG.BAR_HEIGHT / 2);
      
      const size = Math.min(state.barW * 0.5, 30); // Размер креста зависит от бара

      const ts = Date.now();
      const c1Id = `${BAR_PREFIX}/c1/${tokenId}/${ts}`;
      const c2Id = `${BAR_PREFIX}/c2/${tokenId}/${ts}`;

      const crossParts = [
        buildShape()
          .shapeType("RECTANGLE")
          .width(size).height(4)
          .position({ x: centerX - size/2, y: centerY - 2 })
          .rotation(45)
          .fillColor("#000000")
          .strokeColor("#ff0000")
          .strokeWidth(1)
          .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true)
          .id(c1Id).metadata({ [METADATA_KEY]: { type: "crack" } }).build(),
          
        buildShape()
          .shapeType("RECTANGLE")
          .width(size).height(4)
          .position({ x: centerX - size/2, y: centerY - 2 })
          .rotation(-45)
          .fillColor("#000000")
          .strokeColor("#ff0000")
          .strokeWidth(1)
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

  // Сихронизация массива юнитов (вызывать при старте или изменении настроек)
  async syncAllBars(units: Unit[]): Promise<void> {
    const validTokens = new Set<string>();
    
    // Пакетное создание (по одному, но подряд)
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
    
    // Очистка тех, кого больше нет в списке
    for (const [tokenId] of this.bars) {
      if (!validTokens.has(tokenId)) {
        await this.removeBars(tokenId);
      }
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      // Удаляем "сирот" — наши бары, которые не привязаны ни к чему
      const orphans = items.filter(i => 
        (i.id.startsWith(BAR_PREFIX) || i.metadata?.[METADATA_KEY]?.type === "crack") && 
        (!i.attachedTo)
      );
      if (orphans.length) {
        await OBR.scene.items.deleteItems(orphans.map(i => i.id));
      }
    } catch {}
  }

  // ==========================================================================
  // ANIMATION LOOP (Только для Quality Mode)
  // ==========================================================================

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
    // Здесь только визуальные украшательства: пульсация цвета при низком HP
    // Не меняем позицию или размер, только цвет
    
    for (const [tokenId, state] of this.states) {
      const ids = this.bars.get(tokenId);
      if (!ids || state.isDead) continue;

      const hpPct = state.maxHp > 0 ? state.hp / state.maxHp : 0;
      
      // Пульсация при низком HP (< 25%)
      if (hpPct > 0 && hpPct < 0.25) {
        try {
          const speed = hpPct < 0.1 ? 0.8 : 0.4;
          const pulse = (Math.sin(this.frame * speed) + 1) / 2;
          
          // Интерполяция цвета от Красного к Темно-бордовому
          const color = this.lerpColor(CONFIG.HP_LOW, "#550000", pulse);
          
          await OBR.scene.items.updateItems([ids.hpFill], (items) => {
            for (const i of items) { 
              if (isShape(i)) i.style.fillColor = color; 
            }
          });
        } catch {}
      }
    }
  }

  private lerpColor(color1: string, color2: string, t: number): string {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    
    const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
    const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
    
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
}

export const tokenBarService = new TokenBarService();
