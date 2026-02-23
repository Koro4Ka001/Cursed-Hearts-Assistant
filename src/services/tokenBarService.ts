import OBR, { 
  buildShape, 
  isImage, 
  isShape,
  Shape,
  Image
} from "@owlbear-rodeo/sdk";
import type { Unit } from "../types";

const METADATA_KEY = "cursed-hearts-assistant";
const BAR_PREFIX = "cha_bar"; // Упрощенный префикс без спецсимволов

// Настройки визуализации
const CONFIG = {
  // Геометрия
  BAR_HEIGHT: 8,          
  BAR_WIDTH_RATIO: 0.9,   // 90% от ширины клетки
  MIN_BAR_WIDTH: 40,
  MAX_BAR_WIDTH: 150,     // 🔥 ОГРАНИЧЕНИЕ: Бар не шире 1 клетки (стандарт OBR 150px)
  
  BAR_GAP: 2,             // Отступ между HP и Маной
  BAR_OFFSET_Y: -65,      // 🔥 ТВОЙ ЗАПРОС: Смещение вверх
  
  // Цвета (Cursed Style)
  BG_COLOR: "#0a0505",    // Почти черный фон для обоих баров
  STROKE_COLOR: "#000000",
  
  // HP Градиент (Кровь)
  HP_COLOR_HIGH: "#cc2222", // Кроваво-красный (вместо зеленого)
  HP_COLOR_MED:  "#aa4400", // Ржавый
  HP_COLOR_LOW:  "#ff0000", // Ярко-красный (тревога)
  
  // Мана
  MANA_COLOR: "#2244aa",    // Глубокий синий
  
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
  // 1. ИНИЦИАЛИЗАЦИЯ
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
    // Чистим мусор (сиротские бары) при старте
    await this.cleanup(); 
    this.startAnim();     
    this.initialized = true;
    console.log("[Bars] Ready (Fixed Sizing)");
  }

  /**
   * Переключение режима (для GM-калькулятора ставь 'performance')
   */
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
  // 2. ЛОГИКА РАСЧЕТОВ
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

  /**
   * Главный расчет позиции.
   * Учитывает масштаб токена и ограничивает ширину бара.
   */
  private calculateLayout(token: Image) {
    const dpi = token.grid.dpi; // Обычно 150
    const scaleX = token.scale.x;
    const scaleY = token.scale.y;
    
    // Ширина токена в "мировых единицах"
    const worldWidth = token.image.width * scaleX;
    const worldHeight = token.image.height * scaleY;

    // 🔥 ИСПРАВЛЕНИЕ РАЗМЕРА: 
    // Бар не должен быть шире MAX_BAR_WIDTH (150px), но и не уже MIN
    // Мы берем 90% от ширины токена, но зажимаем в рамки
    const barW = Math.min(CONFIG.MAX_BAR_WIDTH, Math.max(CONFIG.MIN_BAR_WIDTH, worldWidth * CONFIG.BAR_WIDTH_RATIO));
    
    // Центрирование по X
    const barX = token.position.x - barW / 2;

    // Позиция Y
    // token.position = центр токена
    // (token.position.y + worldHeight/2) = нижний край токена
    // Добавляем твой офсет (-65)
    const baseY = (token.position.y + worldHeight / 2) + CONFIG.BAR_OFFSET_Y;

    const hpY = baseY;
    const manaY = baseY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP; // Строго под HP

    return { barW, barX, hpY, manaY };
  }

  // ==========================================================================
  // 3. УПРАВЛЕНИЕ БАРАМИ (CRUD)
  // ==========================================================================

  private async removeExistingBarsFromScene(tokenId: string): Promise<void> {
    // Жёсткое удаление всего, что связано с токеном и имеет наш префикс
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
    hp: number, maxHp: number,
    mana: number, maxMana: number,
    useManaAsHp = false
  ): Promise<void> {
    if (!tokenId) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      // 1. Сначала чистим (чтобы не было дублей)
      await this.removeExistingBarsFromScene(tokenId);
      this.bars.delete(tokenId);
      this.states.delete(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length || !isImage(items[0])) return;

      const token = items[0] as Image;
      
      // 2. Расчет геометрии
      const { barW, barX, hpY, manaY } = this.calculateLayout(token);
      
      const dead = this.isDead(hp);
      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const showHp = !useManaAsHp;

      const ts = Date.now();
      // Генерируем уникальные ID без спецсимволов
      const ids: BarIds = {
        hpBg: `${BAR_PREFIX}_hpbg_${tokenId}_${ts}`,
        hpFill: `${BAR_PREFIX}_hpfill_${tokenId}_${ts}`,
        manaBg: `${BAR_PREFIX}_manabg_${tokenId}_${ts}`,
        manaFill: `${BAR_PREFIX}_manafill_${tokenId}_${ts}`,
      };

      const shapes: Shape[] = [];

      // Функция-хелпер для создания полоски
      // Используем слой DRAWING, так как он безопаснее для рендеринга поверх всего
      const createRect = (id: string, x: number, y: number, w: number, h: number, color: string, z: number) => {
        return buildShape()
          .shapeType("RECTANGLE")
          .width(w).height(h)
          .position({ x, y })
          .attachedTo(tokenId)
          .layer("DRAWING") 
          .locked(true).disableHit(true)
          .fillColor(color)
          .strokeColor(CONFIG.STROKE_COLOR).strokeWidth(1) // Добавил обводку для красоты
          .zIndex(z)
          .id(id)
          .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
          .build();
      };

      // --- HP BAR ---
      if (showHp) {
        // Фон
        if (!dead) {
            shapes.push(createRect(ids.hpBg, barX, hpY, barW, CONFIG.BAR_HEIGHT, CONFIG.BG_COLOR, 10));
        }
        // Заливка
        if (!dead && hpPct > 0) {
            const w = Math.max(0, barW * hpPct);
            const fill = createRect(ids.hpFill, barX, hpY, w, CONFIG.BAR_HEIGHT, this.getHpColor(hp, maxHp), 11);
            fill.strokeWidth = 0; // У заливки убираем обводку
            shapes.push(fill);
        }
      }

      // --- MANA BAR ---
      // Рисуем ману, если не мертв
      if (!dead) {
        shapes.push(createRect(ids.manaBg, barX, manaY, barW, CONFIG.BAR_HEIGHT, CONFIG.BG_COLOR, 10));
        
        if (manaPct > 0) {
            const w = Math.max(0, barW * manaPct);
            const fill = createRect(ids.manaFill, barX, manaY, w, CONFIG.BAR_HEIGHT, CONFIG.MANA_FILL, 11);
            fill.strokeWidth = 0;
            shapes.push(fill);
        }
      }

      // Пушим всё разом
      await OBR.scene.items.addItems(shapes);
      
      // Сохраняем состояние
      this.bars.set(tokenId, ids);
      this.states.set(tokenId, { 
        tokenId, hp, maxHp, mana, maxMana, useManaAsHp,
        tokenX: token.position.x, tokenY: token.position.y, barW,
        isDead: dead
      });

      // Эффекты (только в Quality)
      if (showHp && dead && this.mode === 'quality') {
        await this.createDeathEffect(tokenId, barX, hpY, barW);
      }

    } catch (e: any) {
      console.error("[Bars] Create failed:", e);
    }
  }

  // ==========================================================================
  // 4. ОБНОВЛЕНИЕ (OPTIMIZED)
  // ==========================================================================

  async updateBars(tokenId: string, hp: number, maxHp: number, mana: number, maxMana: number, useManaAsHp = false): Promise<void> {
    const state = this.states.get(tokenId);
    const ids = this.bars.get(tokenId);
    
    // Если не нашли — создаем с нуля
    if (!state || !ids) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    try {
      const dead = this.isDead(hp);
      const wasDead = state.isDead;
      
      // Обновляем память
      state.hp = hp; state.maxHp = maxHp; state.mana = mana; state.maxMana = maxMana;
      state.isDead = dead;

      // Получаем текущие бары со сцены
      const items = await OBR.scene.items.getItems([ids.hpFill, ids.manaFill, ids.hpBg, ids.manaBg]);
      if (items.length === 0) {
        await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
        return;
      }

      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const barW = state.barW; // Используем сохраненную ширину, чтобы не дергать токен

      // Групповое обновление
      await OBR.scene.items.updateItems(items.map(i => i.id), (items) => {
        for (const item of items) {
          if (!isShape(item)) continue;

          // HP FILL
          if (item.id === ids.hpFill) {
            item.width = Math.max(0, barW * hpPct);
            item.style.fillColor = this.getHpColor(hp, maxHp);
            item.visible = !dead && !useManaAsHp && hpPct > 0;
          }
          // HP BG
          else if (item.id === ids.hpBg) {
            item.visible = !dead && !useManaAsHp;
          }
          // MANA FILL
          else if (item.id === ids.manaFill) {
            item.width = Math.max(0, barW * manaPct);
            item.visible = !dead && manaPct > 0;
          }
          // MANA BG
          else if (item.id === ids.manaBg) {
            item.visible = !dead;
          }
        }
      });

      // Переключение смерти (Quality only)
      if (!useManaAsHp && this.mode === 'quality') {
        if (dead && !wasDead) {
            // Для эффекта смерти нужны координаты, берем старые из state
            // (немного неточно если токен двигался, но createDeathEffect пересчитает)
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
  // 5. СПЕЦЭФФЕКТЫ (КРЕСТ СМЕРТИ)
  // ==========================================================================

  private async createDeathEffect(tokenId: string, barX: number, barY: number, barW: number): Promise<void> {
    const ids = this.bars.get(tokenId);
    if (!ids || ids.crack1) return;

    try {
      const size = Math.min(barW, 40); // Размер креста
      // Центр креста - примерно там где был HP бар
      const centerX = barX + barW / 2;
      const centerY = barY + CONFIG.BAR_HEIGHT / 2;

      const ts = Date.now();
      const c1Id = `${BAR_PREFIX}_c1_${tokenId}_${ts}`;
      const c2Id = `${BAR_PREFIX}_c2_${tokenId}_${ts}`;

      // Создаем красный крест
      const makeCrossPart = (id: string, rot: number) => 
        buildShape()
          .shapeType("RECTANGLE")
          .width(size).height(6)
          .position({ x: centerX - size/2, y: centerY - 3 })
          .rotation(rot)
          .fillColor("#000000")
          .strokeColor("#ff0000").strokeWidth(2)
          .attachedTo(tokenId).layer("DRAWING").locked(true).disableHit(true)
          .id(id).metadata({ [METADATA_KEY]: { type: "crack" } }).build();

      await OBR.scene.items.addItems([
        makeCrossPart(c1Id, 45),
        makeCrossPart(c2Id, -45)
      ]);

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
  // 6. УТИЛИТЫ И ЧИСТКА
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

  // ==========================================================================
  // 7. АНИМАЦИЯ (PULSE)
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
    for (const [tokenId, state] of this.states) {
      const ids = this.bars.get(tokenId);
      if (!ids || state.isDead) continue;

      const hpPct = state.maxHp > 0 ? state.hp / state.maxHp : 0;
      
      // Пульсация только при низком HP
      if (hpPct > 0 && hpPct < 0.25) {
        try {
          const speed = hpPct < 0.1 ? 0.8 : 0.4;
          const pulse = (Math.sin(this.frame * speed) + 1) / 2;
          const color = this.lerpColor(CONFIG.HP_LOW, "#550000", pulse);
          
          // Оптимизация: меняем только цвет заливки
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
