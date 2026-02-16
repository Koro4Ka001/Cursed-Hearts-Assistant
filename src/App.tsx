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
  // 📐 КАЛИБРОВКА ПОЗИЦИИ
  // ═══════════════════════════════════════════════════════════════════════
  BAR_HEIGHT: 6,
  BAR_GAP: 2,
  BAR_OFFSET_FROM_TOKEN: 4,  // Пикселей от нижнего края токена
  MIN_BAR_WIDTH: 40,
  MAX_BAR_WIDTH: 120,
  BAR_WIDTH_RATIO: 0.85,
  
  // Цвета HP
  HP_BG_COLOR: "#1a0808",
  HP_BG_STROKE: "#4a2020",
  HP_FILL_HIGH: "#8b0000",
  HP_FILL_MEDIUM: "#cc4400",
  HP_FILL_LOW: "#ff2200",
  HP_FILL_CRITICAL: "#ff0000",
  
  // Цвета Mana
  MANA_BG_COLOR: "#080818",
  MANA_BG_STROKE: "#202050",
  MANA_FILL_COLOR: "#2244aa",
  MANA_FILL_BRIGHT: "#4488ff",
  
  // Z-индексы
  Z_BG: 0,
  Z_FILL: 1,
  Z_CRACK: 2,
  
  // Анимации
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
  crack1?: string;
  crack2?: string;
  crack3?: string;
}

interface TokenData {
  id: string;
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
  barWidth: number;
  tokenHeight: number;
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
  private isAnimating = false;

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
      this.startAnimationLoop();
      this.isInitialized = true;
      console.log("[TokenBarService] ✓ Initialized");
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
      if (!this.isAnimating) {
        this.runAnimationFrame();
      }
    }, CONFIG.ANIMATION_INTERVAL);
    
    console.log("[TokenBarService] 🎬 Animation loop started");
  }

  private async runAnimationFrame(): Promise<void> {
    if (this.isAnimating || this.barStates.size === 0) return;
    
    this.isAnimating = true;
    this.animationFrame++;
    
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      for (const [tokenId, state] of this.barStates.entries()) {
        const ids = this.bars.get(tokenId);
        if (!ids) continue;

        await this.animateBar(tokenId, state, ids);
      }
    } catch (error) {
      // Молча
    } finally {
      this.isAnimating = false;
    }
  }

  private async animateBar(tokenId: string, state: BarState, ids: BarIds): Promise<void> {
    const hpPercent = state.maxHp > 0 ? state.hp / state.maxHp : 0;
    const manaPercent = state.maxMana > 0 ? state.mana / state.maxMana : 0;
    const showHpBar = !state.useManaAsHp;

    const idsToUpdate: string[] = [];
    if (showHpBar && ids.hpFill) idsToUpdate.push(ids.hpFill);
    if (showHpBar && ids.hpBg) idsToUpdate.push(ids.hpBg);
    if (ids.manaFill) idsToUpdate.push(ids.manaFill);

    if (idsToUpdate.length === 0) return;

    try {
      // Вычисляем базовые позиции для сброса
      const positions = this.calculateRelativePositions(state.tokenHeight, state.barWidth, showHpBar);

      await OBR.scene.items.updateItems(idsToUpdate, (items) => {
        for (const item of items) {
          if (!isShape(item)) continue;

          // 🩸 HP АНИМАЦИИ
          if (item.id === ids.hpFill && showHpBar && hpPercent > 0) {
            // Пульсация цвета
            const pulse = Math.sin(this.animationFrame * 0.4) * 0.5 + 0.5;
            
            if (hpPercent < 0.1) {
              // Критический - быстрая яркая пульсация + дрожание
              item.style.fillColor = pulse > 0.5 ? "#ff0000" : "#880000";
              const shake = (Math.random() - 0.5) * 3;
              item.position = { 
                x: positions.hpFillPos.x + shake, 
                y: positions.hpFillPos.y + (Math.random() - 0.5) * 2 
              };
            } else if (hpPercent < 0.25) {
              // Низкий HP - пульсация + лёгкое дрожание
              item.style.fillColor = pulse > 0.5 ? "#ff2200" : "#aa0000";
              const shake = (Math.random() - 0.5) * 2;
              item.position = { 
                x: positions.hpFillPos.x + shake, 
                y: positions.hpFillPos.y 
              };
            } else if (hpPercent < 0.5) {
              // Средний HP - только пульсация
              item.style.fillColor = pulse > 0.6 ? "#cc4400" : "#992200";
            }
          }

          // HP Background тоже дрожит при низком HP
          if (item.id === ids.hpBg && showHpBar && hpPercent > 0 && hpPercent < 0.25) {
            const shake = (Math.random() - 0.5) * (hpPercent < 0.1 ? 3 : 2);
            item.position = { 
              x: positions.hpBgPos.x + shake, 
              y: positions.hpBgPos.y + (Math.random() - 0.5) 
            };
          }

          // 💎 MANA АНИМАЦИИ
          if (item.id === ids.manaFill) {
            const wave = Math.sin(this.animationFrame * 0.15);
            
            if (manaPercent > 0.75) {
              // Высокая мана - яркое мерцание
              const shimmer = wave * 0.5 + 0.5;
              item.style.fillColor = shimmer > 0.5 ? "#4488ff" : "#2255cc";
            } else if (manaPercent > 0.5) {
              // Средняя мана - лёгкое мерцание
              const shimmer = wave * 0.3 + 0.7;
              item.style.fillColor = shimmer > 0.5 ? "#3366dd" : "#2244aa";
            } else if (manaPercent < 0.2 && manaPercent > 0) {
              // Низкая мана - тусклая пульсация
              const dim = wave * 0.2 + 0.8;
              item.style.fillColor = dim > 0.5 ? "#334488" : "#223366";
            }
          }
        }
      });

      // 💀 ТРЕЩИНЫ ПРИ СМЕРТИ
      if (showHpBar && hpPercent <= 0 && !ids.crack1) {
        console.log(`[TokenBarService] 💀 HP <= 0, creating death cracks`);
        await this.createDeathCracks(tokenId, state);
      } else if (hpPercent > 0 && ids.crack1) {
        console.log(`[TokenBarService] ✨ HP > 0, removing death cracks`);
        await this.removeDeathCracks(tokenId);
      }
    } catch (error) {
      // Молча
    }
  }

  // ==========================================================================
  // ВЫЧИСЛЕНИЕ ОТНОСИТЕЛЬНЫХ ПОЗИЦИЙ (относительно центра токена!)
  // ==========================================================================

  private calculateRelativePositions(tokenHeight: number, barWidth: number, showHpBar: boolean) {
    // ОТНОСИТЕЛЬНО ЦЕНТРА ТОКЕНА!
    // x = 0 — это центр по горизонтали
    // y = tokenHeight/2 — это нижний край токена
    
    const halfTokenHeight = tokenHeight / 2;
    const barX = -barWidth / 2;  // Центрируем бар
    
    const hpBarY = halfTokenHeight + CONFIG.BAR_OFFSET_FROM_TOKEN;
    const manaBarY = showHpBar 
      ? hpBarY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP 
      : hpBarY;

    return {
      hpBgPos: { x: barX, y: hpBarY },
      hpFillPos: { x: barX + 1, y: hpBarY + 1 },
      manaBgPos: { x: barX, y: manaBarY },
      manaFillPos: { x: barX + 1, y: manaBarY + 1 },
    };
  }

  // ==========================================================================
  // ЭФФЕКТ СМЕРТИ
  // ==========================================================================

  private async createDeathCracks(tokenId: string, state: BarState): Promise<void> {
    const ids = this.bars.get(tokenId);
    if (!ids || ids.crack1) return;

    try {
      const positions = this.calculateRelativePositions(state.tokenHeight, state.barWidth, true);
      const { hpBgPos } = positions;
      const barWidth = state.barWidth;

      const ts = Date.now();
      const crackShapes: Shape[] = [];

      // Осколок 1 (левый)
      crackShapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth * 0.3)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: hpBgPos.x - 4, y: hpBgPos.y + 3 })
          .rotation(-20)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .fillColor("#2a0a0a")
          .strokeColor("#5a1515")
          .strokeWidth(1)
          .zIndex(CONFIG.Z_CRACK)
          .id(`${BAR_PREFIX}/crack1/${tokenId}/${ts}`)
          .metadata({ [METADATA_KEY]: { type: "crack", tokenId } })
          .build()
      );

      // Осколок 2 (центральный)
      crackShapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth * 0.35)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: hpBgPos.x + barWidth * 0.3, y: hpBgPos.y - 2 })
          .rotation(8)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .fillColor("#3a0a0a")
          .strokeColor("#6a1515")
          .strokeWidth(1)
          .zIndex(CONFIG.Z_CRACK)
          .id(`${BAR_PREFIX}/crack2/${tokenId}/${ts}`)
          .metadata({ [METADATA_KEY]: { type: "crack", tokenId } })
          .build()
      );

      // Осколок 3 (правый)
      crackShapes.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth * 0.28)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: hpBgPos.x + barWidth * 0.68, y: hpBgPos.y + 4 })
          .rotation(25)
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .fillColor("#1a0505")
          .strokeColor("#4a1010")
          .strokeWidth(1)
          .zIndex(CONFIG.Z_CRACK)
          .id(`${BAR_PREFIX}/crack3/${tokenId}/${ts}`)
          .metadata({ [METADATA_KEY]: { type: "crack", tokenId } })
          .build()
      );

      await OBR.scene.items.addItems(crackShapes);

      // Скрываем HP бар
      const hpIds = [ids.hpBg, ids.hpFill].filter(Boolean);
      if (hpIds.length > 0) {
        await OBR.scene.items.updateItems(hpIds, (items) => {
          for (const item of items) {
            item.visible = false;
          }
        });
      }

      ids.crack1 = crackShapes[0].id;
      ids.crack2 = crackShapes[1].id;
      ids.crack3 = crackShapes[2].id;

      console.log(`[TokenBarService] 💀 Death cracks created`);
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

      const hpIds = [ids.hpBg, ids.hpFill].filter(Boolean);
      if (hpIds.length > 0) {
        await OBR.scene.items.updateItems(hpIds, (items) => {
          for (const item of items) {
            item.visible = true;
          }
        });
      }

      delete ids.crack1;
      delete ids.crack2;
      delete ids.crack3;

      console.log(`[TokenBarService] ✨ Death cracks removed`);
    } catch (error) {
      console.error("[TokenBarService] removeDeathCracks failed:", error);
    }
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
        width: token.image.width * token.scale.x,
        height: token.image.height * token.scale.y,
        visible: token.visible,
      };
    } catch {
      return null;
    }
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

    console.log(`[TokenBarService] 🔨 Creating bars for ${tokenId.substring(0, 8)}...`);
    console.log(`[TokenBarService]    HP: ${hp}/${maxHp}, Mana: ${mana}/${maxMana}`);

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        console.warn("[TokenBarService] Scene not ready!");
        return;
      }

      await this.removeBars(tokenId);

      const token = await this.getTokenData(tokenId);
      if (!token) {
        console.warn(`[TokenBarService] Token not found: ${tokenId}`);
        return;
      }

      const barWidth = Math.min(
        CONFIG.MAX_BAR_WIDTH,
        Math.max(CONFIG.MIN_BAR_WIDTH, token.width * CONFIG.BAR_WIDTH_RATIO)
      );

      const hpPercent = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPercent = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const showHpBar = !useManaAsHp;

      // ОТНОСИТЕЛЬНЫЕ позиции!
      const positions = this.calculateRelativePositions(token.height, barWidth, showHpBar);

      console.log(`[TokenBarService] 📐 Token size: ${token.width.toFixed(0)}x${token.height.toFixed(0)}`);
      console.log(`[TokenBarService] 📐 HP bar relative pos: (${positions.hpBgPos.x.toFixed(0)}, ${positions.hpBgPos.y.toFixed(0)})`);

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
            .position(positions.hpBgPos)  // ОТНОСИТЕЛЬНАЯ позиция!
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
            .fillColor(useManaAsHp ? this.getHpColor(manaPercent) : CONFIG.MANA_FILL_COLOR)
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
        
        this.barStates.set(tokenId, {
          tokenId,
          hp,
          maxHp,
          mana,
          maxMana,
          useManaAsHp,
          barWidth,
          tokenHeight: token.height,
        });
        
        console.log(`[TokenBarService] ✓ Created ${shapes.length} shapes`);
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

    const ids = this.bars.get(tokenId);
    
    if (!ids) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

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

      const positions = this.calculateRelativePositions(token.height, barWidth, showHpBar);

      // Обновляем состояние
      this.barStates.set(tokenId, {
        tokenId,
        hp,
        maxHp,
        mana,
        maxMana,
        useManaAsHp,
        barWidth,
        tokenHeight: token.height,
      });

      const hpFillWidth = Math.max(0, (barWidth - 2) * hpPercent);
      const manaFillWidth = Math.max(0, (barWidth - 2) * manaPercent);

      const allIds = [ids.hpBg, ids.hpFill, ids.manaBg, ids.manaFill].filter(Boolean);
      const items = await OBR.scene.items.getItems(allIds);

      if (items.length > 0) {
        await OBR.scene.items.updateItems(
          items.filter(i => isShape(i)).map(i => i.id),
          (updateItems) => {
            for (const item of updateItems) {
              if (!isShape(item)) continue;

              if (item.id === ids.hpBg) {
                item.width = barWidth;
                item.position = positions.hpBgPos;
                item.visible = token.visible && showHpBar && hp > 0;
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
    } catch (error) {
      console.error(`[TokenBarService] removeBars failed:`, error);
    }
  }

  async removeAllBars(): Promise<void> {
    try {
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
    console.log(`[TokenBarService] 🔄 Syncing bars for ${units.length} units...`);
    
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

  // ==========================================================================
  // ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ
  // ==========================================================================

  async forceRefresh(): Promise<void> {
    console.log("[TokenBarService] 🔄 Force refreshing all bars...");
    
    const states = new Map(this.barStates);
    await this.removeAllBars();
    
    for (const [tokenId, state] of states) {
      await this.createBars(
        tokenId,
        state.hp,
        state.maxHp,
        state.mana,
        state.maxMana,
        state.useManaAsHp
      );
    }
    
    console.log("[TokenBarService] ✓ Force refresh complete");
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

  private stopAnimationLoop(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
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
