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
  BAR_HEIGHT: 6,
  BAR_GAP: 2,
  BAR_OFFSET_FROM_TOKEN: 4,
  MIN_BAR_WIDTH: 40,
  MAX_BAR_WIDTH: 120,
  BAR_WIDTH_RATIO: 0.85,
  
  HP_BG_COLOR: "#1a0808",
  HP_BG_STROKE: "#4a2020",
  HP_FILL_HIGH: "#8b0000",
  HP_FILL_MEDIUM: "#cc4400",
  HP_FILL_LOW: "#ff2200",
  HP_FILL_CRITICAL: "#ff0000",
  
  MANA_BG_COLOR: "#080818",
  MANA_BG_STROKE: "#202050",
  MANA_FILL_COLOR: "#2244aa",
  MANA_FILL_BRIGHT: "#4488ff",
  
  ANIMATION_INTERVAL: 150,
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
}

// ============================================================================
// СЕРВИС
// ============================================================================

class TokenBarService {
  private bars: Map<string, BarIds> = new Map();
  private barStates: Map<string, BarState> = new Map();
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;
  private animationInterval: number | null = null;
  private animationFrame = 0;

  // ==========================================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
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
      
      // Подписка на изменения — для синхронизации позиций!
      this.unsubscribe = OBR.scene.items.onChange(async (items) => {
        await this.syncBarPositions(items);
      });
      
      this.startAnimationLoop();
      this.isInitialized = true;
      console.log("[TokenBarService] ✓ Initialized");
    } catch (error) {
      console.error("[TokenBarService] doInit failed:", error);
    }
  }

  // ==========================================================================
  // СИНХРОНИЗАЦИЯ ПОЗИЦИЙ (когда токен двигается)
  // ==========================================================================

  private async syncBarPositions(items: Item[]): Promise<void> {
    try {
      for (const [tokenId, ids] of this.bars.entries()) {
        const token = items.find(i => i.id === tokenId);
        if (!token || !isImage(token)) continue;

        const state = this.barStates.get(tokenId);
        if (!state) continue;

        // Вычисляем новые позиции
        const positions = this.calculateAbsolutePositions(token, state.useManaAsHp);
        if (!positions) continue;

        // Обновляем позиции баров
        const barIds = [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill].filter(Boolean);
        const barItems = items.filter(i => barIds.includes(i.id));

        if (barItems.length > 0) {
          await OBR.scene.items.updateItems(barIds, (updateItems) => {
            for (const item of updateItems) {
              if (!isShape(item)) continue;

              if (item.id === ids.hpBg) {
                item.position = positions.hpBgPos;
                item.visible = token.visible;
              } else if (item.id === ids.hpFill) {
                item.position = positions.hpFillPos;
                item.visible = token.visible;
              } else if (item.id === ids.manaBg) {
                item.position = positions.manaBgPos;
                item.visible = token.visible;
              } else if (item.id === ids.manaFill) {
                item.position = positions.manaFillPos;
                item.visible = token.visible;
              }
            }
          });
        }
      }
    } catch {
      // Молча
    }
  }

  // ==========================================================================
  // ВЫЧИСЛЕНИЕ АБСОЛЮТНЫХ ПОЗИЦИЙ
  // ==========================================================================

  private calculateAbsolutePositions(token: Image, useManaAsHp: boolean) {
    const tokenWidth = token.image.width * token.scale.x;
    const tokenHeight = token.image.height * token.scale.y;
    
    const barWidth = Math.min(
      CONFIG.MAX_BAR_WIDTH,
      Math.max(CONFIG.MIN_BAR_WIDTH, tokenWidth * CONFIG.BAR_WIDTH_RATIO)
    );

    // АБСОЛЮТНЫЕ мировые координаты
    const centerX = token.position.x;
    const centerY = token.position.y;
    
    // Нижний край токена
    const bottomY = centerY + tokenHeight / 2;
    
    // Левый край бара (центрируем)
    const leftX = centerX - barWidth / 2;
    
    const showHpBar = !useManaAsHp;
    const hpBarY = bottomY + CONFIG.BAR_OFFSET_FROM_TOKEN;
    const manaBarY = showHpBar 
      ? hpBarY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP 
      : hpBarY;

    return {
      barWidth,
      tokenWidth,
      tokenHeight,
      showHpBar,
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
    if (!tokenId) return;

    console.log(`[TokenBarService] 🔨 Creating bars for ${tokenId.substring(0, 8)}...`);

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      await this.removeBars(tokenId);

      // Получаем токен
      const items = await OBR.scene.items.getItems([tokenId]);
      if (items.length === 0) {
        console.warn(`[TokenBarService] Token not found: ${tokenId}`);
        return;
      }

      const token = items[0];
      if (!isImage(token)) {
        console.warn(`[TokenBarService] Not an image: ${tokenId}`);
        return;
      }

      // Вычисляем позиции
      const positions = this.calculateAbsolutePositions(token, useManaAsHp);
      if (!positions) return;

      const { barWidth, showHpBar, hpBgPos, hpFillPos, manaBgPos, manaFillPos } = positions;

      console.log(`[TokenBarService] 📐 Token at (${token.position.x.toFixed(0)}, ${token.position.y.toFixed(0)})`);
      console.log(`[TokenBarService] 📐 HP bar at (${hpBgPos.x.toFixed(0)}, ${hpBgPos.y.toFixed(0)})`);

      const hpPercent = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPercent = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      const ts = Date.now();
      const ids: BarIds = {
        hpBg: `${BAR_PREFIX}/hp-bg/${tokenId}/${ts}`,
        hpFill: `${BAR_PREFIX}/hp-fill/${tokenId}/${ts}`,
        manaBg: `${BAR_PREFIX}/mana-bg/${tokenId}/${ts}`,
        manaFill: `${BAR_PREFIX}/mana-fill/${tokenId}/${ts}`,
      };

      const shapes: Shape[] = [];

      // HP BAR (БЕЗ attachedTo!)
      if (showHpBar) {
        shapes.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(barWidth)
            .height(CONFIG.BAR_HEIGHT)
            .position(hpBgPos)
            .layer("DRAWING")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(CONFIG.HP_BG_COLOR)
            .strokeColor(CONFIG.HP_BG_STROKE)
            .strokeWidth(1)
            .zIndex(9998)
            .id(ids.hpBg)
            .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
            .build()
        );

        const hpFillWidth = Math.max(1, (barWidth - 2) * hpPercent);
        shapes.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(hpFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position(hpFillPos)
            .layer("DRAWING")
            .locked(true)
            .disableHit(true)
            .visible(token.visible && hpPercent > 0)
            .fillColor(this.getHpColor(hpPercent))
            .strokeWidth(0)
            .zIndex(9999)
            .id(ids.hpFill)
            .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
            .build()
        );
      }

      // MANA BAR
      shapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth)
          .height(CONFIG.BAR_HEIGHT)
          .position(manaBgPos)
          .layer("DRAWING")
          .locked(true)
          .disableHit(true)
          .visible(token.visible)
          .fillColor(useManaAsHp ? CONFIG.HP_BG_COLOR : CONFIG.MANA_BG_COLOR)
          .strokeColor(useManaAsHp ? CONFIG.HP_BG_STROKE : CONFIG.MANA_BG_STROKE)
          .strokeWidth(1)
          .zIndex(9998)
          .id(ids.manaBg)
          .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
          .build()
      );

      const manaFillWidth = Math.max(1, (barWidth - 2) * manaPercent);
      shapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(manaFillWidth)
          .height(CONFIG.BAR_HEIGHT - 2)
          .position(manaFillPos)
          .layer("DRAWING")
          .locked(true)
          .disableHit(true)
          .visible(token.visible && manaPercent > 0)
          .fillColor(useManaAsHp ? this.getHpColor(manaPercent) : CONFIG.MANA_FILL_COLOR)
          .strokeWidth(0)
          .zIndex(9999)
          .id(ids.manaFill)
          .metadata({ [METADATA_KEY]: { type: "bar", tokenId } })
          .build()
      );

      await OBR.scene.items.addItems(shapes);
      this.bars.set(tokenId, ids);
      this.barStates.set(tokenId, { tokenId, hp, maxHp, mana, maxMana, useManaAsHp });
      
      console.log(`[TokenBarService] ✓ Created ${shapes.length} shapes`);
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

    const ids = this.bars.get(tokenId);
    if (!ids) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      // Получаем токен
      const items = await OBR.scene.items.getItems([tokenId]);
      if (items.length === 0) {
        await this.removeBars(tokenId);
        return;
      }

      const token = items[0];
      if (!isImage(token)) return;

      const positions = this.calculateAbsolutePositions(token, useManaAsHp);
      if (!positions) return;

      const { barWidth, showHpBar } = positions;

      // Обновляем состояние
      this.barStates.set(tokenId, { tokenId, hp, maxHp, mana, maxMana, useManaAsHp });

      const hpPercent = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPercent = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      const hpFillWidth = Math.max(1, (barWidth - 2) * hpPercent);
      const manaFillWidth = Math.max(1, (barWidth - 2) * manaPercent);

      const allIds = [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill];

      await OBR.scene.items.updateItems(allIds, (updateItems) => {
        for (const item of updateItems) {
          if (!isShape(item)) continue;

          if (item.id === ids.hpBg) {
            item.width = barWidth;
            item.position = positions.hpBgPos;
            item.visible = token.visible && showHpBar;
          } else if (item.id === ids.hpFill) {
            item.width = hpFillWidth;
            item.position = positions.hpFillPos;
            item.style.fillColor = this.getHpColor(hpPercent);
            item.visible = token.visible && showHpBar && hpPercent > 0;
          } else if (item.id === ids.manaBg) {
            item.width = barWidth;
            item.position = positions.manaBgPos;
            item.visible = token.visible;
          } else if (item.id === ids.manaFill) {
            item.width = manaFillWidth;
            item.position = positions.manaFillPos;
            item.visible = token.visible && manaPercent > 0;
          }
        }
      });
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
      const ids = this.bars.get(tokenId);
      if (!ids) return;

      const allIds = [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill];
      
      try {
        await OBR.scene.items.deleteItems(allIds);
      } catch {
        // Элементы могли быть уже удалены
      }

      this.bars.delete(tokenId);
      this.barStates.delete(tokenId);
    } catch (error) {
      console.error(`[TokenBarService] removeBars failed:`, error);
    }
  }

  async removeAllBars(): Promise<void> {
    for (const tokenId of this.bars.keys()) {
      await this.removeBars(tokenId);
    }
    await this.cleanupOldBars();
    console.log("[TokenBarService] Removed all bars");
  }

  // ==========================================================================
  // СИНХРОНИЗАЦИЯ
  // ==========================================================================

  async syncAllBars(units: Unit[]): Promise<void> {
    console.log(`[TokenBarService] 🔄 Syncing ${units.length} units...`);
    
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

      console.log(`[TokenBarService] ✓ Synced ${validTokenIds.size} bars`);
    } catch (error) {
      console.error("[TokenBarService] syncAllBars failed:", error);
    }
  }

  async forceRefresh(): Promise<void> {
    console.log("[TokenBarService] 🔄 Force refresh...");
    const states = new Map(this.barStates);
    await this.removeAllBars();
    
    for (const [tokenId, state] of states) {
      await this.createBars(tokenId, state.hp, state.maxHp, state.mana, state.maxMana, state.useManaAsHp);
    }
    console.log("[TokenBarService] ✓ Done");
  }

  // ==========================================================================
  // АНИМАЦИИ
  // ==========================================================================

  private startAnimationLoop(): void {
    if (this.animationInterval) return;
    
    this.animationInterval = window.setInterval(async () => {
      this.animationFrame++;
      await this.runAnimations();
    }, CONFIG.ANIMATION_INTERVAL);
  }

  private async runAnimations(): Promise<void> {
    if (this.barStates.size === 0) return;

    try {
      for (const [tokenId, state] of this.barStates.entries()) {
        const ids = this.bars.get(tokenId);
        if (!ids) continue;

        const hpPercent = state.maxHp > 0 ? state.hp / state.maxHp : 0;
        const manaPercent = state.maxMana > 0 ? state.mana / state.maxMana : 0;

        // HP пульсация при низком здоровье
        if (hpPercent > 0 && hpPercent < 0.5 && ids.hpFill) {
          const pulse = Math.sin(this.animationFrame * 0.4) * 0.5 + 0.5;
          let color: string;
          
          if (hpPercent < 0.1) {
            color = pulse > 0.5 ? "#ff0000" : "#880000";
          } else if (hpPercent < 0.25) {
            color = pulse > 0.5 ? "#ff2200" : "#aa0000";
          } else {
            color = pulse > 0.5 ? "#cc4400" : "#992200";
          }

          try {
            await OBR.scene.items.updateItems([ids.hpFill], (items) => {
              for (const item of items) {
                if (isShape(item)) {
                  item.style.fillColor = color;
                }
              }
            });
          } catch {
            // Молча
          }
        }

        // Mana мерцание при высокой мане
        if (manaPercent > 0.5 && ids.manaFill) {
          const shimmer = Math.sin(this.animationFrame * 0.2) * 0.5 + 0.5;
          const color = manaPercent > 0.75
            ? (shimmer > 0.5 ? "#4488ff" : "#2255cc")
            : (shimmer > 0.5 ? "#3366dd" : "#2244aa");

          try {
            await OBR.scene.items.updateItems([ids.manaFill], (items) => {
              for (const item of items) {
                if (isShape(item)) {
                  item.style.fillColor = color;
                }
              }
            });
          } catch {
            // Молча
          }
        }
      }
    } catch {
      // Молча
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
        (item.metadata?.[METADATA_KEY] as any)?.type === "bar"
      );

      if (ourBars.length > 0) {
        await OBR.scene.items.deleteItems(ourBars.map(i => i.id));
        console.log(`[TokenBarService] Cleaned ${ourBars.length} old bars`);
      }
    } catch {
      // Молча
    }
  }

  async destroy(): Promise<void> {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    await this.removeAllBars();
    this.isInitialized = false;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const tokenBarService = new TokenBarService();
(window as any).tokenBarService = tokenBarService;
