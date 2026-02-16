// src/services/tokenBarService.ts

import OBR, { 
  buildShape, 
  Item, 
  isImage, 
  isShape,
  Shape
} from "@owlbear-rodeo/sdk";
import type { Unit } from "../types";

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

const METADATA_KEY = "cursed-hearts-assistant";
const BAR_PREFIX = `${METADATA_KEY}/bar`;

const CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════
  // 📐 КАЛИБРОВКА ПОЗИЦИИ — МЕНЯЙ ЗДЕСЬ!
  // ═══════════════════════════════════════════════════════════════════════
  BAR_HEIGHT: 8,
  BAR_GAP: 3,
  BAR_OFFSET_FROM_TOKEN: 2,  // <-- ОТРИЦАТЕЛЬНОЕ = ближе к токену / на токене
  MIN_BAR_WIDTH: 50,
  MAX_BAR_WIDTH: 140,
  BAR_WIDTH_RATIO: 0.9,
  
  // Цвета HP
  HP_BG_COLOR: "#1a0808",
  HP_BG_STROKE: "#4a2020",
  HP_FILL_HIGH: "#8b0000",
  HP_FILL_MEDIUM: "#cc4400",
  HP_FILL_LOW: "#ff2200",
  HP_FILL_CRITICAL: "#ff0000",
  HP_GLOW_LOW: "#ff4444",
  HP_GLOW_CRITICAL: "#ff0000",
  
  // Цвета Mana
  MANA_BG_COLOR: "#080818",
  MANA_BG_STROKE: "#202050",
  MANA_FILL_COLOR: "#2244aa",
  MANA_FILL_BRIGHT: "#4488ff",
  MANA_FILL_LOW: "#4466cc",
  
  // Z-индексы
  Z_BG: 0,
  Z_FILL: 1,
  Z_CRACK: 2,
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎬 АНИМАЦИИ
  // ═══════════════════════════════════════════════════════════════════════
  ANIMATION_INTERVAL: 150,  // ms между кадрами
  SHAKE_INTENSITY_LOW: 1,   // пиксели дрожания при HP < 50%
  SHAKE_INTENSITY_HIGH: 2,  // пиксели дрожания при HP < 25%
  SHAKE_INTENSITY_CRIT: 3,  // пиксели дрожания при HP < 10%
} as const;

// ============================================================================
// ТИПЫ
// ============================================================================

interface BarIds {
  hpBg: string;
  hpFill: string;
  manaBg: string;
  manaFill: string;
  // Для эффекта "трещин" при смерти
  crack1?: string;
  crack2?: string;
  crack3?: string;
}

interface TokenData {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  visible: boolean;
}

interface BarState {
  tokenId: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  useManaAsHp: boolean;
  basePositions: {
    hpBgPos: { x: number; y: number };
    hpFillPos: { x: number; y: number };
    manaBgPos: { x: number; y: number };
    manaFillPos: { x: number; y: number };
  };
  barWidth: number;
}

// ============================================================================
// СЕРВИС
// ============================================================================

class TokenBarService {
  private bars: Map<string, BarIds> = new Map();
  private barStates: Map<string, BarState> = new Map();
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;
  
  // Анимация
  private animationInterval: number | null = null;
  private animationFrame = 0;

  // ==========================================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("[TokenBarService] Already initialized");
      return;
    }

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        console.log("[TokenBarService] Scene not ready, subscribing...");
        OBR.scene.onReadyChange(async (isReady) => {
          if (isReady && !this.isInitialized) {
            await this.doInit();
          }
        });
        return;
      }

      await this.doInit();
    } catch (error) {
      console.error("[TokenBarService] Initialize failed:", error);
    }
  }

  private async doInit(): Promise<void> {
    try {
      await this.cleanupOldBars();
      this.unsubscribe = OBR.scene.items.onChange(this.onItemsChange.bind(this));
      
      // Запускаем анимационный цикл
      this.startAnimationLoop();
      
      this.isInitialized = true;
      console.log("[TokenBarService] ✓ Initialized with animations");
    } catch (error) {
      console.error("[TokenBarService] doInit failed:", error);
    }
  }

  // ==========================================================================
  // АНИМАЦИОННЫЙ ЦИКЛ
  // ==========================================================================

  private startAnimationLoop(): void {
    if (this.animationInterval) return;
    
    this.animationInterval = window.setInterval(() => {
      this.animationFrame++;
      this.updateAnimations();
    }, CONFIG.ANIMATION_INTERVAL);
    
    console.log("[TokenBarService] 🎬 Animation loop started");
  }

  private stopAnimationLoop(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  private async updateAnimations(): Promise<void> {
    try {
      const ready = await OBR.scene.isReady();
      if (!ready || this.barStates.size === 0) return;

      for (const [tokenId, state] of this.barStates.entries()) {
        const ids = this.bars.get(tokenId);
        if (!ids) continue;

        const hpPercent = state.maxHp > 0 ? state.hp / state.maxHp : 0;
        const manaPercent = state.maxMana > 0 ? state.mana / state.maxMana : 0;
        const showHpBar = !state.useManaAsHp;

        // Собираем ID для обновления
        const idsToUpdate: string[] = [];
        if (showHpBar) {
          idsToUpdate.push(ids.hpBg, ids.hpFill);
        }
        idsToUpdate.push(ids.manaBg, ids.manaFill);

        const items = await OBR.scene.items.getItems(idsToUpdate);
        if (items.length === 0) continue;

        await OBR.scene.items.updateItems(
          items.filter(i => isShape(i)).map(i => i.id),
          (updateItems) => {
            for (const item of updateItems) {
              if (!isShape(item)) continue;

              // ═══════════════════════════════════════════════════════════
              // 🩸 HP АНИМАЦИИ
              // ═══════════════════════════════════════════════════════════
              if (item.id === ids.hpFill || item.id === ids.hpBg) {
                const isHpFill = item.id === ids.hpFill;
                const basePos = isHpFill ? state.basePositions.hpFillPos : state.basePositions.hpBgPos;
                
                // Дрожание при низком HP
                if (hpPercent > 0 && hpPercent < 0.5) {
                  let intensity = CONFIG.SHAKE_INTENSITY_LOW;
                  if (hpPercent < 0.1) {
                    intensity = CONFIG.SHAKE_INTENSITY_CRIT;
                  } else if (hpPercent < 0.25) {
                    intensity = CONFIG.SHAKE_INTENSITY_HIGH;
                  }
                  
                  // Случайное смещение
                  const shakeX = (Math.random() - 0.5) * intensity * 2;
                  const shakeY = (Math.random() - 0.5) * intensity;
                  
                  item.position = {
                    x: basePos.x + shakeX,
                    y: basePos.y + shakeY,
                  };
                } else {
                  // Возвращаем в базовую позицию
                  item.position = basePos;
                }
                
                // Пульсация цвета при низком HP (только для fill)
                if (isHpFill && hpPercent > 0 && hpPercent < 0.25) {
                  const pulse = Math.sin(this.animationFrame * 0.5) * 0.5 + 0.5;
                  item.style.fillColor = this.lerpColor(
                    CONFIG.HP_FILL_LOW,
                    CONFIG.HP_GLOW_CRITICAL,
                    pulse
                  );
                }
              }

              // ═══════════════════════════════════════════════════════════
              // 💎 MANA АНИМАЦИИ
              // ═══════════════════════════════════════════════════════════
              if (item.id === ids.manaFill) {
                // Мерцание когда мана высокая (> 75%)
                if (manaPercent > 0.75) {
                  const shimmer = Math.sin(this.animationFrame * 0.3) * 0.3 + 0.7;
                  item.style.fillColor = this.lerpColor(
                    CONFIG.MANA_FILL_COLOR,
                    CONFIG.MANA_FILL_BRIGHT,
                    shimmer
                  );
                }
                
                // "Бултыхание" - лёгкое вертикальное движение
                if (manaPercent > 0.5) {
                  const wave = Math.sin(this.animationFrame * 0.2) * 0.5;
                  item.position = {
                    x: state.basePositions.manaFillPos.x,
                    y: state.basePositions.manaFillPos.y + wave,
                  };
                }
              }
            }
          }
        );

        // ═══════════════════════════════════════════════════════════════
        // 💀 ЭФФЕКТ СМЕРТИ (HP <= 0) - ТРЕЩИНЫ
        // ═══════════════════════════════════════════════════════════════
        if (showHpBar && hpPercent <= 0 && !ids.crack1) {
          await this.createDeathCracks(tokenId, state);
        } else if (hpPercent > 0 && ids.crack1) {
          await this.removeDeathCracks(tokenId);
        }
      }
    } catch (error) {
      // Молча игнорируем ошибки анимации
    }
  }

  // ==========================================================================
  // ЭФФЕКТ СМЕРТИ - ТРЕЩИНЫ
  // ==========================================================================

  private async createDeathCracks(tokenId: string, state: BarState): Promise<void> {
    const ids = this.bars.get(tokenId);
    if (!ids || ids.crack1) return;

    try {
      const ts = Date.now();
      const crackIds = {
        crack1: `${BAR_PREFIX}/crack1/${tokenId}/${ts}`,
        crack2: `${BAR_PREFIX}/crack2/${tokenId}/${ts}`,
        crack3: `${BAR_PREFIX}/crack3/${tokenId}/${ts}`,
      };

      const { hpBgPos } = state.basePositions;
      const barWidth = state.barWidth;
      
      // Создаём "осколки" бара
      const crackShapes: Shape[] = [];
      
      // Осколок 1 (левый)
      crackShapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth * 0.3)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: hpBgPos.x - 3, y: hpBgPos.y + 2 })
          .rotation(-15)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .fillColor("#2a0a0a")
          .strokeColor("#5a1515")
          .strokeWidth(1)
          .zIndex(CONFIG.Z_CRACK)
          .id(crackIds.crack1)
          .metadata({ [METADATA_KEY]: { type: "crack", tokenId } })
          .build()
      );

      // Осколок 2 (центральный)
      crackShapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth * 0.35)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: hpBgPos.x + barWidth * 0.32, y: hpBgPos.y - 1 })
          .rotation(5)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .fillColor("#3a0a0a")
          .strokeColor("#6a1515")
          .strokeWidth(1)
          .zIndex(CONFIG.Z_CRACK)
          .id(crackIds.crack2)
          .metadata({ [METADATA_KEY]: { type: "crack", tokenId } })
          .build()
      );

      // Осколок 3 (правый)
      crackShapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth * 0.25)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: hpBgPos.x + barWidth * 0.72, y: hpBgPos.y + 3 })
          .rotation(20)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .fillColor("#1a0505")
          .strokeColor("#4a1010")
          .strokeWidth(1)
          .zIndex(CONFIG.Z_CRACK)
          .id(crackIds.crack3)
          .metadata({ [METADATA_KEY]: { type: "crack", tokenId } })
          .build()
      );

      await OBR.scene.items.addItems(crackShapes);
      
      // Скрываем оригинальный HP бар
      await OBR.scene.items.updateItems([ids.hpBg, ids.hpFill], (items) => {
        for (const item of items) {
          item.visible = false;
        }
      });

      // Сохраняем ID трещин
      ids.crack1 = crackIds.crack1;
      ids.crack2 = crackIds.crack2;
      ids.crack3 = crackIds.crack3;

      console.log(`[TokenBarService] 💀 Created death cracks for ${tokenId.substring(0, 8)}`);
    } catch (error) {
      console.error("[TokenBarService] createDeathCracks failed:", error);
    }
  }

  private async removeDeathCracks(tokenId: string): Promise<void> {
    const ids = this.bars.get(tokenId);
    if (!ids || !ids.crack1) return;

    try {
      const crackIds = [ids.crack1, ids.crack2, ids.crack3].filter(Boolean) as string[];
      
      if (crackIds.length > 0) {
        await OBR.scene.items.deleteItems(crackIds);
      }

      // Показываем оригинальный HP бар
      await OBR.scene.items.updateItems([ids.hpBg, ids.hpFill], (items) => {
        for (const item of items) {
          item.visible = true;
        }
      });

      delete ids.crack1;
      delete ids.crack2;
      delete ids.crack3;

      console.log(`[TokenBarService] ✨ Removed death cracks for ${tokenId.substring(0, 8)}`);
    } catch (error) {
      console.error("[TokenBarService] removeDeathCracks failed:", error);
    }
  }

  // ==========================================================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ==========================================================================

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

  // ==========================================================================
  // ПОЛУЧЕНИЕ ДАННЫХ ТОКЕНА
  // ==========================================================================

  private async getTokenData(tokenId: string): Promise<TokenData | null> {
    try {
      const items = await OBR.scene.items.getItems([tokenId]);
      if (items.length === 0) return null;

      const token = items[0];
      if (!isImage(token)) return null;

      return {
        id: token.id,
        position: token.position,
        width: token.image.width * token.scale.x,
        height: token.image.height * token.scale.y,
        visible: token.visible,
      };
    } catch {
      return null;
    }
  }

  private calculateBarPositions(
    token: TokenData,
    barWidth: number,
    showHpBar: boolean
  ) {
    const centerX = token.position.x;
    const centerY = token.position.y;
    const bottomY = centerY + token.height / 2 + CONFIG.BAR_OFFSET_FROM_TOKEN;
    const leftX = centerX - barWidth / 2;
    
    const hpBarY = bottomY;
    const manaBarY = showHpBar 
      ? bottomY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP 
      : bottomY;

    return {
      hpBgPos: { x: leftX, y: hpBarY },
      hpFillPos: { x: leftX + 1, y: hpBarY + 1 },
      manaBgPos: { x: leftX, y: manaBarY },
      manaFillPos: { x: leftX + 1, y: manaBarY + 1 },
    };
  }

  // ==========================================================================
  // СОЗДАНИЕ БАРОВ
  // ==========================================================================

  async createBars(
    tokenId: string,
    hp: number,
    maxHp: number,
    mana: number,
    maxMana: number,
    useManaAsHp: boolean = false
  ): Promise<void> {
    if (!tokenId || typeof tokenId !== 'string') return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      await this.removeBars(tokenId);

      const token = await this.getTokenData(tokenId);
      if (!token) return;

      const barWidth = Math.min(
        CONFIG.MAX_BAR_WIDTH,
        Math.max(CONFIG.MIN_BAR_WIDTH, token.width * CONFIG.BAR_WIDTH_RATIO)
      );

      const hpPercent = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPercent = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const showHpBar = !useManaAsHp;

      const positions = this.calculateBarPositions(token, barWidth, showHpBar);

      const ts = Date.now();
      const ids: BarIds = {
        hpBg: `${BAR_PREFIX}/hp-bg/${tokenId}/${ts}`,
        hpFill: `${BAR_PREFIX}/hp-fill/${tokenId}/${ts}`,
        manaBg: `${BAR_PREFIX}/mana-bg/${tokenId}/${ts}`,
        manaFill: `${BAR_PREFIX}/mana-fill/${tokenId}/${ts}`,
      };

      const shapes: Shape[] = [];

      // HP BAR
      if (showHpBar) {
        shapes.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(barWidth)
            .height(CONFIG.BAR_HEIGHT)
            .position(positions.hpBgPos)
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(CONFIG.HP_BG_COLOR)
            .strokeColor(CONFIG.HP_BG_STROKE)
            .strokeWidth(1)
            .zIndex(CONFIG.Z_BG)
            .id(ids.hpBg)
            .metadata({ [METADATA_KEY]: { type: "hp-bg", tokenId } })
            .build()
        );

        const hpFillWidth = Math.max(0, (barWidth - 2) * hpPercent);
        if (hpFillWidth > 0) {
          shapes.push(
            buildShape()
              .shapeType("RECTANGLE")
              .width(hpFillWidth)
              .height(CONFIG.BAR_HEIGHT - 2)
              .position(positions.hpFillPos)
              .attachedTo(tokenId)
              .layer("ATTACHMENT")
              .locked(true)
              .disableHit(true)
              .visible(token.visible)
              .fillColor(this.getHpColor(hpPercent))
              .strokeWidth(0)
              .zIndex(CONFIG.Z_FILL)
              .id(ids.hpFill)
              .metadata({ [METADATA_KEY]: { type: "hp-fill", tokenId } })
              .build()
          );
        }
      }

      // MANA BAR
      shapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth)
          .height(CONFIG.BAR_HEIGHT)
          .position(positions.manaBgPos)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(token.visible)
          .fillColor(useManaAsHp ? CONFIG.HP_BG_COLOR : CONFIG.MANA_BG_COLOR)
          .strokeColor(useManaAsHp ? CONFIG.HP_BG_STROKE : CONFIG.MANA_BG_STROKE)
          .strokeWidth(1)
          .zIndex(CONFIG.Z_BG)
          .id(ids.manaBg)
          .metadata({ [METADATA_KEY]: { type: "mana-bg", tokenId } })
          .build()
      );

      const manaFillWidth = Math.max(0, (barWidth - 2) * manaPercent);
      if (manaFillWidth > 0) {
        const fillColor = useManaAsHp 
          ? this.getHpColor(manaPercent)
          : (manaPercent < 0.25 ? CONFIG.MANA_FILL_LOW : CONFIG.MANA_FILL_COLOR);
        
        shapes.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(manaFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position(positions.manaFillPos)
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(fillColor)
            .strokeWidth(0)
            .zIndex(CONFIG.Z_FILL)
            .id(ids.manaFill)
            .metadata({ [METADATA_KEY]: { type: "mana-fill", tokenId } })
            .build()
        );
      }

      if (shapes.length > 0) {
        await OBR.scene.items.addItems(shapes);
        this.bars.set(tokenId, ids);
        
        // Сохраняем состояние для анимаций
        this.barStates.set(tokenId, {
          tokenId,
          hp,
          maxHp,
          mana,
          maxMana,
          useManaAsHp,
          basePositions: positions,
          barWidth,
        });
        
        console.log(`[TokenBarService] ✓ Created bars with animations for ${tokenId.substring(0, 8)}`);
      }
    } catch (error) {
      console.error(`[TokenBarService] createBars failed:`, error);
    }
  }

  // ==========================================================================
  // ОБНОВЛЕНИЕ БАРОВ
  // ==========================================================================

  async updateBars(
    tokenId: string,
    hp: number,
    maxHp: number,
    mana: number,
    maxMana: number,
    useManaAsHp: boolean = false
  ): Promise<void> {
    if (!tokenId) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      const ids = this.bars.get(tokenId);
      
      if (!ids) {
        await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
        return;
      }

      const token = await this.getTokenData(tokenId);
      if (!token) {
        await this.removeBars(tokenId);
        return;
      }

      const barWidth = Math.min(
        CONFIG.MAX_BAR_WIDTH,
        Math.max(CONFIG.MIN_BAR_WIDTH, token.width * CONFIG.BAR_WIDTH_RATIO)
      );

      const hpPercent = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPercent = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const showHpBar = !useManaAsHp;

      const positions = this.calculateBarPositions(token, barWidth, showHpBar);

      // Обновляем состояние для анимаций
      this.barStates.set(tokenId, {
        tokenId,
        hp,
        maxHp,
        mana,
        maxMana,
        useManaAsHp,
        basePositions: positions,
        barWidth,
      });

      const hpFillWidth = Math.max(0, (barWidth - 2) * hpPercent);
      const manaFillWidth = Math.max(0, (barWidth - 2) * manaPercent);

      const allIds = [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill];
      const items = await OBR.scene.items.getItems(allIds);
      const existingIds = new Set(items.map(i => i.id));

      if (items.length > 0) {
        await OBR.scene.items.updateItems(
          items.filter(i => isShape(i)).map(i => i.id),
          (updateItems) => {
            for (const item of updateItems) {
              if (!isShape(item)) continue;

              if (item.id === ids.hpBg) {
                item.width = barWidth;
                item.position = positions.hpBgPos;
                item.visible = token.visible && showHpBar && hpPercent > 0;
              } 
              else if (item.id === ids.hpFill) {
                item.width = hpFillWidth;
                item.position = positions.hpFillPos;
                item.style.fillColor = this.getHpColor(hpPercent);
                item.visible = token.visible && showHpBar && hpFillWidth > 0;
              }
              else if (item.id === ids.manaBg) {
                item.width = barWidth;
                item.position = positions.manaBgPos;
                item.visible = token.visible;
              }
              else if (item.id === ids.manaFill) {
                item.width = manaFillWidth;
                item.position = positions.manaFillPos;
                item.visible = token.visible && manaFillWidth > 0;
              }
            }
          }
        );
      }

      // Создаём недостающие fill
      const shapesToAdd: Shape[] = [];

      if (!existingIds.has(ids.hpFill) && hpFillWidth > 0 && showHpBar) {
        shapesToAdd.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(hpFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position(positions.hpFillPos)
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(this.getHpColor(hpPercent))
            .strokeWidth(0)
            .zIndex(CONFIG.Z_FILL)
            .id(ids.hpFill)
            .metadata({ [METADATA_KEY]: { type: "hp-fill", tokenId } })
            .build()
        );
      }

      if (!existingIds.has(ids.manaFill) && manaFillWidth > 0) {
        const fillColor = useManaAsHp 
          ? this.getHpColor(manaPercent)
          : CONFIG.MANA_FILL_COLOR;
        
        shapesToAdd.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(manaFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position(positions.manaFillPos)
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(fillColor)
            .strokeWidth(0)
            .zIndex(CONFIG.Z_FILL)
            .id(ids.manaFill)
            .metadata({ [METADATA_KEY]: { type: "mana-fill", tokenId } })
            .build()
        );
      }

      if (shapesToAdd.length > 0) {
        await OBR.scene.items.addItems(shapesToAdd);
      }
    } catch (error) {
      console.error(`[TokenBarService] updateBars failed:`, error);
    }
  }

  // ==========================================================================
  // УДАЛЕНИЕ
  // ==========================================================================

  async removeBars(tokenId: string): Promise<void> {
    if (!tokenId) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      const ids = this.bars.get(tokenId);
      if (!ids) return;

      // Удаляем и трещины тоже
      const allIds = [
        ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill,
        ids.crack1, ids.crack2, ids.crack3
      ].filter(Boolean) as string[];
      
      const items = await OBR.scene.items.getItems(allIds);
      const existingIds = items.map(i => i.id);

      if (existingIds.length > 0) {
        await OBR.scene.items.deleteItems(existingIds);
      }

      this.bars.delete(tokenId);
      this.barStates.delete(tokenId);
      console.log(`[TokenBarService] Removed bars for ${tokenId.substring(0, 8)}`);
    } catch (error) {
      console.error(`[TokenBarService] removeBars failed:`, error);
    }
  }

  async removeAllBars(): Promise<void> {
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      for (const tokenId of this.bars.keys()) {
        await this.removeBars(tokenId);
      }

      await this.cleanupOldBars();
      console.log("[TokenBarService] Removed all bars");
    } catch (error) {
      console.error("[TokenBarService] removeAllBars failed:", error);
    }
  }

  // ==========================================================================
  // СИНХРОНИЗАЦИЯ
  // ==========================================================================

  async syncAllBars(units: Unit[]): Promise<void> {
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      const validTokenIds = new Set<string>();

      for (const unit of units) {
        if (unit.owlbearTokenId) {
          validTokenIds.add(unit.owlbearTokenId);
          
          await this.createBars(
            unit.owlbearTokenId,
            unit.health?.current ?? 0,
            unit.health?.max ?? 100,
            unit.mana?.current ?? 0,
            unit.mana?.max ?? 50,
            unit.useManaAsHp ?? false
          );
        }
      }

      for (const tokenId of this.bars.keys()) {
        if (!validTokenIds.has(tokenId)) {
          await this.removeBars(tokenId);
        }
      }

      console.log(`[TokenBarService] Synced ${validTokenIds.size} bars`);
    } catch (error) {
      console.error("[TokenBarService] syncAllBars failed:", error);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private getHpColor(percent: number): string {
    if (percent < 0.1) return CONFIG.HP_FILL_CRITICAL;
    if (percent < 0.25) return CONFIG.HP_FILL_LOW;
    if (percent < 0.5) return CONFIG.HP_FILL_MEDIUM;
    return CONFIG.HP_FILL_HIGH;
  }

  private async cleanupOldBars(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const ourBars = items.filter(item => 
        item.id.startsWith(BAR_PREFIX) || 
        (item.metadata?.[METADATA_KEY] as any)?.type
      );

      if (ourBars.length > 0) {
        await OBR.scene.items.deleteItems(ourBars.map(i => i.id));
        console.log(`[TokenBarService] Cleaned up ${ourBars.length} old bars`);
      }
    } catch (error) {
      console.error("[TokenBarService] cleanupOldBars failed:", error);
    }
  }

  private async onItemsChange(items: Item[]): Promise<void> {
    try {
      for (const [tokenId, ids] of this.bars.entries()) {
        const token = items.find(i => i.id === tokenId);
        if (!token) continue;

        const allBarIds = [
          ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill,
          ids.crack1, ids.crack2, ids.crack3
        ].filter(Boolean) as string[];
        
        const barItems = items.filter(i => allBarIds.includes(i.id));

        for (const bar of barItems) {
          if (bar.visible !== token.visible) {
            await OBR.scene.items.updateItems([bar.id], (updateItems) => {
              for (const item of updateItems) {
                item.visible = token.visible;
              }
            });
          }
        }
      }
    } catch {
      // Молча
    }
  }

  async destroy(): Promise<void> {
    this.stopAnimationLoop();
    
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    await this.removeAllBars();
    this.isInitialized = false;
    console.log("[TokenBarService] Destroyed");
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const tokenBarService = new TokenBarService();
(window as any).tokenBarService = tokenBarService;
