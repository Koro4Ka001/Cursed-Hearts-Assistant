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
  BAR_HEIGHT: 8,
  BAR_GAP: 3,
  BAR_OFFSET_FROM_TOKEN: 12,
  MIN_BAR_WIDTH: 50,
  MAX_BAR_WIDTH: 140,
  BAR_WIDTH_RATIO: 0.9,
  
  HP_BG_COLOR: "#1a0808",
  HP_BG_STROKE: "#4a2020",
  HP_FILL_HIGH: "#8b0000",
  HP_FILL_MEDIUM: "#cc4400",
  HP_FILL_LOW: "#ff2200",
  HP_FILL_CRITICAL: "#ff0000",
  
  MANA_BG_COLOR: "#080818",
  MANA_BG_STROKE: "#202050",
  MANA_FILL_COLOR: "#2244aa",
  MANA_FILL_LOW: "#4466cc",
  
  Z_BG: 0,
  Z_FILL: 1,
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

interface TokenInfo {
  width: number;
  height: number;
  visible: boolean;
}

// ============================================================================
// СЕРВИС
// ============================================================================

class TokenBarService {
  private bars: Map<string, BarIds> = new Map();
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;

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
      this.isInitialized = true;
      console.log("[TokenBarService] ✓ Initialized successfully");
    } catch (error) {
      console.error("[TokenBarService] doInit failed:", error);
    }
  }

  // ==========================================================================
  // ВАЛИДАЦИЯ
  // ==========================================================================

  private isValidTokenId(tokenId: unknown): tokenId is string {
    return typeof tokenId === "string" && tokenId.length > 0;
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
    // === ВАЛИДАЦИЯ ===
    if (!this.isValidTokenId(tokenId)) {
      console.warn("[TokenBarService] createBars: Invalid tokenId:", tokenId);
      return;
    }

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        console.warn("[TokenBarService] createBars: Scene not ready");
        return;
      }

      // Удаляем старые бары
      await this.removeBars(tokenId);

      // Получаем информацию о токене
      const tokenInfo = await this.getTokenInfo(tokenId);
      if (!tokenInfo) {
        console.warn(`[TokenBarService] createBars: Token not found on scene: ${tokenId}`);
        return;
      }

      console.log(`[TokenBarService] Creating bars for token ${tokenId.substring(0, 8)}...`);
      console.log(`[TokenBarService] Token size: ${tokenInfo.width}x${tokenInfo.height}, visible: ${tokenInfo.visible}`);

      // Вычисляем размеры
      const barWidth = this.calculateBarWidth(tokenInfo.width);
      
      const hpPercent = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPercent = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      // Позиции относительно ЦЕНТРА токена
      const halfTokenHeight = tokenInfo.height / 2;
      const barX = -barWidth / 2;
      
      const showHpBar = !useManaAsHp;
      let hpBarY = halfTokenHeight + CONFIG.BAR_OFFSET_FROM_TOKEN;
      let manaBarY = hpBarY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP;
      
      if (!showHpBar) {
        manaBarY = hpBarY;
      }

      // Генерируем ID
      const ts = Date.now();
      const ids: BarIds = {
        hpBg: `${BAR_PREFIX}/hp-bg/${tokenId}/${ts}`,
        hpFill: `${BAR_PREFIX}/hp-fill/${tokenId}/${ts}`,
        manaBg: `${BAR_PREFIX}/mana-bg/${tokenId}/${ts}`,
        manaFill: `${BAR_PREFIX}/mana-fill/${tokenId}/${ts}`,
      };

      const shapes: Shape[] = [];

      // === HP BAR ===
      if (showHpBar) {
        shapes.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(barWidth)
            .height(CONFIG.BAR_HEIGHT)
            .position({ x: barX, y: hpBarY })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(tokenInfo.visible)
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
              .position({ x: barX + 1, y: hpBarY + 1 })
              .attachedTo(tokenId)
              .layer("ATTACHMENT")
              .locked(true)
              .disableHit(true)
              .visible(tokenInfo.visible)
              .fillColor(this.getHpColor(hpPercent))
              .strokeWidth(0)
              .zIndex(CONFIG.Z_FILL)
              .id(ids.hpFill)
              .metadata({ [METADATA_KEY]: { type: "hp-fill", tokenId } })
              .build()
          );
        }
      }

      // === MANA BAR ===
      shapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: barX, y: manaBarY })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(tokenInfo.visible)
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
            .position({ x: barX + 1, y: manaBarY + 1 })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(tokenInfo.visible)
            .fillColor(fillColor)
            .strokeWidth(0)
            .zIndex(CONFIG.Z_FILL)
            .id(ids.manaFill)
            .metadata({ [METADATA_KEY]: { type: "mana-fill", tokenId } })
            .build()
        );
      }

      // Добавляем все элементы
      if (shapes.length > 0) {
        await OBR.scene.items.addItems(shapes);
        this.bars.set(tokenId, ids);
        console.log(`[TokenBarService] ✓ Created ${shapes.length} bar elements for token ${tokenId.substring(0, 8)}`);
      }
    } catch (error) {
      console.error(`[TokenBarService] createBars failed for ${tokenId}:`, error);
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
    if (!this.isValidTokenId(tokenId)) {
      console.warn("[TokenBarService] updateBars: Invalid tokenId:", tokenId);
      return;
    }

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      const ids = this.bars.get(tokenId);
      
      if (!ids) {
        await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
        return;
      }

      const tokenInfo = await this.getTokenInfo(tokenId);
      if (!tokenInfo) {
        await this.removeBars(tokenId);
        return;
      }

      const barWidth = this.calculateBarWidth(tokenInfo.width);
      const hpPercent = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPercent = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      const halfTokenHeight = tokenInfo.height / 2;
      const barX = -barWidth / 2;
      
      const showHpBar = !useManaAsHp;
      let hpBarY = halfTokenHeight + CONFIG.BAR_OFFSET_FROM_TOKEN;
      let manaBarY = hpBarY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP;
      
      if (!showHpBar) {
        manaBarY = hpBarY;
      }

      const hpFillWidth = Math.max(0, (barWidth - 2) * hpPercent);
      const manaFillWidth = Math.max(0, (barWidth - 2) * manaPercent);

      const allIds = [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill];
      const items = await OBR.scene.items.getItems(allIds);
      const existingIds = new Set(items.map(i => i.id));

      // Обновляем существующие
      if (items.length > 0) {
        await OBR.scene.items.updateItems(
          items.filter(i => isShape(i)).map(i => i.id),
          (updateItems) => {
            for (const item of updateItems) {
              if (!isShape(item)) continue;

              if (item.id === ids.hpBg) {
                item.width = barWidth;
                item.position = { x: barX, y: hpBarY };
                item.visible = tokenInfo.visible && showHpBar;
              } 
              else if (item.id === ids.hpFill) {
                item.width = hpFillWidth;
                item.position = { x: barX + 1, y: hpBarY + 1 };
                item.style.fillColor = this.getHpColor(hpPercent);
                item.visible = tokenInfo.visible && showHpBar && hpFillWidth > 0;
              }
              else if (item.id === ids.manaBg) {
                item.width = barWidth;
                item.position = { x: barX, y: manaBarY };
                item.visible = tokenInfo.visible;
                item.style.fillColor = useManaAsHp ? CONFIG.HP_BG_COLOR : CONFIG.MANA_BG_COLOR;
                item.style.strokeColor = useManaAsHp ? CONFIG.HP_BG_STROKE : CONFIG.MANA_BG_STROKE;
              }
              else if (item.id === ids.manaFill) {
                item.width = manaFillWidth;
                item.position = { x: barX + 1, y: manaBarY + 1 };
                const fillColor = useManaAsHp 
                  ? this.getHpColor(manaPercent)
                  : (manaPercent < 0.25 ? CONFIG.MANA_FILL_LOW : CONFIG.MANA_FILL_COLOR);
                item.style.fillColor = fillColor;
                item.visible = tokenInfo.visible && manaFillWidth > 0;
              }
            }
          }
        );
      }

      // Создаём недостающие fill элементы
      const shapesToAdd: Shape[] = [];

      if (!existingIds.has(ids.hpFill) && hpFillWidth > 0 && showHpBar) {
        shapesToAdd.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(hpFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position({ x: barX + 1, y: hpBarY + 1 })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(tokenInfo.visible)
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
          : (manaPercent < 0.25 ? CONFIG.MANA_FILL_LOW : CONFIG.MANA_FILL_COLOR);
        
        shapesToAdd.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(manaFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position({ x: barX + 1, y: manaBarY + 1 })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(tokenInfo.visible)
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
  // УДАЛЕНИЕ БАРОВ
  // ==========================================================================

  async removeBars(tokenId: string): Promise<void> {
    if (!this.isValidTokenId(tokenId)) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      const ids = this.bars.get(tokenId);
      if (!ids) return;

      const allIds = [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill];
      const items = await OBR.scene.items.getItems(allIds);
      const existingIds = items.map(i => i.id);

      if (existingIds.length > 0) {
        await OBR.scene.items.deleteItems(existingIds);
      }

      this.bars.delete(tokenId);
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
      if (!ready) {
        console.warn("[TokenBarService] syncAllBars: Scene not ready");
        return;
      }

      const validTokenIds = new Set<string>();
      let createdCount = 0;

      for (const unit of units) {
        // Проверяем что tokenId валидный
        if (!this.isValidTokenId(unit.owlbearTokenId)) {
          continue;
        }

        validTokenIds.add(unit.owlbearTokenId);
        
        await this.createBars(
          unit.owlbearTokenId,
          unit.health?.current ?? 0,
          unit.health?.max ?? 100,
          unit.mana?.current ?? 0,
          unit.mana?.max ?? 50,
          unit.useManaAsHp ?? false
        );
        createdCount++;
      }

      // Удаляем бары для токенов которых больше нет
      for (const tokenId of this.bars.keys()) {
        if (!validTokenIds.has(tokenId)) {
          await this.removeBars(tokenId);
        }
      }

      console.log(`[TokenBarService] Synced ${createdCount} bars (${units.length} units total)`);
    } catch (error) {
      console.error("[TokenBarService] syncAllBars failed:", error);
    }
  }

  // ==========================================================================
  // DEBUG: Тест с выбранным токеном
  // ==========================================================================

  async testWithSelectedToken(): Promise<void> {
    try {
      const selection = await OBR.player.getSelection();
      if (!selection || selection.length === 0) {
        console.warn("[TokenBarService] TEST: No token selected! Select a token first.");
        return;
      }

      const tokenId = selection[0];
      console.log(`[TokenBarService] TEST: Creating bars for selected token: ${tokenId}`);
      
      await this.createBars(tokenId, 75, 100, 40, 50, false);
      console.log("[TokenBarService] TEST: Done!");
    } catch (error) {
      console.error("[TokenBarService] TEST failed:", error);
    }
  }

  // ==========================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ==========================================================================

  private async getTokenInfo(tokenId: string): Promise<TokenInfo | null> {
    try {
      const items = await OBR.scene.items.getItems([tokenId]);
      if (items.length === 0) return null;

      const token = items[0];
      if (!isImage(token)) return null;

      return {
        width: token.image.width * token.scale.x,
        height: token.image.height * token.scale.y,
        visible: token.visible,
      };
    } catch {
      return null;
    }
  }

  private calculateBarWidth(tokenWidth: number): number {
    return Math.min(
      CONFIG.MAX_BAR_WIDTH,
      Math.max(CONFIG.MIN_BAR_WIDTH, tokenWidth * CONFIG.BAR_WIDTH_RATIO)
    );
  }

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

        const barIds = [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill];
        const barItems = items.filter(i => barIds.includes(i.id));

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
      // Молча игнорируем
    }
  }

  async destroy(): Promise<void> {
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
// ЭКСПОРТ
// ============================================================================

export const tokenBarService = new TokenBarService();

// Для отладки в консоли браузера
(window as any).tokenBarService = tokenBarService;
