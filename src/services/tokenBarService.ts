// src/services/tokenBarService.ts

import OBR, { buildShape, isShape } from "@owlbear-rodeo/sdk";
import type { UnitLike } from "@/types";

const META_PREFIX = "cursed-hearts-bar";
const BAR_WIDTH = 80;
const HP_HEIGHT = 6;
const MANA_HEIGHT = 4;

// Глобальные интервалы для анимаций
const animationIntervals = new Map<string, NodeJS.Timeout[]>();

function clearAnimations(tokenId: string) {
  const intervals = animationIntervals.get(tokenId);
  if (intervals) {
    intervals.forEach(clearInterval);
    animationIntervals.delete(tokenId);
  }
}

export class TokenBarService {
  private barIds = new Map<string, string[]>(); // tokenId -> [hpBarId, manaBarId, ...]
  private ready = false;

  async initialize(): Promise<void> {
    if (this.ready) return;
    try {
      this.ready = await OBR.scene.isReady();
    } catch {
      this.ready = false;
    }
  }

  private async safeUpdateItems(ids: string[], updater: (items: any[]) => void) {
    if (!this.ready) return;
    try {
      await OBR.scene.items.updateItems(ids, updater);
    } catch (e) {
      console.warn("[TokenBars] Update error:", e);
    }
  }

  private async safeAddItems(items: any[]) {
    if (!this.ready) return;
    try {
      return await OBR.scene.items.addItems(items);
    } catch (e) {
      console.warn("[TokenBars] Add error:", e);
      return [];
    }
  }

  private async safeDeleteItems(ids: string[]) {
    if (!this.ready || ids.length === 0) return;
    try {
      await OBR.scene.items.deleteItems(ids);
    } catch (e) {
      console.warn("[TokenBars] Delete error:", e);
    }
  }

  async removeBars(tokenId: string): Promise<void> {
    clearAnimations(tokenId);
    
    const ids = this.barIds.get(tokenId) || [];
    await this.safeDeleteItems(ids);
    this.barIds.delete(tokenId);
  }

  async removeAllBars(): Promise<void> {
    // Очищаем все анимации
    for (const tokenId of animationIntervals.keys()) {
      clearAnimations(tokenId);
    }
    animationIntervals.clear();
    
    // Удаляем все бары по метаданным
    if (!this.ready) return;
    try {
      const items = await OBR.scene.items.getItems();
      const barItems = items.filter(item =>
        item.metadata && typeof item.metadata === 'object' &&
        Object.keys(item.metadata).some(key => key.startsWith(META_PREFIX))
      );
      if (barItems.length > 0) {
        await OBR.scene.items.deleteItems(barItems.map(i => i.id));
      }
    } catch (e) {
      console.warn("[TokenBars] Remove all error:", e);
    }
    this.barIds.clear();
  }

  async createBars(
    tokenId: string,
    hpCurrent: number,
    hpMax: number,
    manaCurrent: number,
    manaMax: number,
    useManaAsHp?: boolean
  ): Promise<void> {
    if (!this.ready) return;

    // Удаляем старые бары
    await this.removeBars(tokenId);

    try {
      // Получаем позицию токена для начального размещения
      const sceneItems = await OBR.scene.items.getItems();
      const token = sceneItems.find(item => item.id === tokenId);
      
      if (!token) {
        console.warn("[TokenBars] Token not found:", tokenId);
        return;
      }

      const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      const manaRatio = manaMax > 0 ? Math.max(0, Math.min(1, manaCurrent / manaMax)) : 0;
      const isDead = hpCurrent <= 0;
      const isLowHP = hpRatio < 0.25 && !isDead;

      const items = [];
      const createdItems = [];

      // === HP BAR ===
      const hpBar = buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH * hpRatio)
        .height(HP_HEIGHT)
        .position({ x: token.position.x - BAR_WIDTH / 2, y: token.position.y - (token.height || 100) / 2 - 15 })
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(999)
        .fillColor(isDead ? "#000000" : hpRatio > 0.5 ? "#22cc44" : hpRatio > 0.25 ? "#ccaa22" : "#cc2222")
        .strokeColor("#7a5a1e")
        .strokeWidth(isDead ? 2 : 1)
        .metadata({ [`${META_PREFIX}-hp`]: tokenId })
        .build();
      
      const [hpBarItem] = await this.safeAddItems([hpBar]);
      if (hpBarItem) {
        createdItems.push(hpBarItem.id);
      }

      // === MANA BAR ===
      if (!useManaAsHp && manaRatio > 0) {
        const manaBar = buildShape()
          .shapeType("RECTANGLE")
          .width(BAR_WIDTH * manaRatio)
          .height(MANA_HEIGHT)
          .position({ x: token.position.x - BAR_WIDTH / 2, y: token.position.y - (token.height || 100) / 2 - 8 })
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(999)
          .fillColor("#4499dd")
          .strokeColor("#1a3a5a")
          .strokeWidth(1)
          .metadata({ [`${META_PREFIX}-mana`]: tokenId })
          .build();
        
        const [manaBarItem] = await this.safeAddItems([manaBar]);
        if (manaBarItem) {
          createdItems.push(manaBarItem.id);
        }
      }

      if (createdItems.length > 0) {
        this.barIds.set(tokenId, createdItems);
        
        // Запускаем обновление позиции при движении токена
        this.startPositionTracking(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
        
        // Запускаем анимации
        if (!isDead && hpRatio > 0.1) {
          this.startHpAnimations(tokenId, hpRatio);
        }
        if (manaRatio > 0) {
          this.startManaAnimations(tokenId);
        }
      }
    } catch (e) {
      console.error("[TokenBars] Create error:", e);
    }
  }

  private startPositionTracking(
    tokenId: string,
    hpCurrent: number,
    hpMax: number,
    manaCurrent: number,
    manaMax: number,
    useManaAsHp?: boolean
  ) {
    let lastTokenPos: { x: number; y: number } | null = null;
    let lastTokenSize: number | null = null;

    const updatePosition = async () => {
      try {
        const items = await OBR.scene.items.getItems();
        const token = items.find(item => item.id === tokenId);
        
        if (!token) {
          // Токен удалён - удаляем бары
          await this.removeBars(tokenId);
          return;
        }

        // Проверяем, изменилась ли позиция или размер
        const currentPos = { x: token.position.x, y: token.position.y };
        const currentSize = token.height || 100;
        
        const posChanged = !lastTokenPos || 
          Math.abs(lastTokenPos.x - currentPos.x) > 1 || 
          Math.abs(lastTokenPos.y - currentPos.y) > 1;
        const sizeChanged = !lastTokenSize || Math.abs(lastTokenSize - currentSize) > 1;

        if (posChanged || sizeChanged) {
          lastTokenPos = currentPos;
          lastTokenSize = currentSize;

          const barIds = this.barIds.get(tokenId);
          if (!barIds || barIds.length === 0) return;

          const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
          const manaRatio = manaMax > 0 ? Math.max(0, Math.min(1, manaCurrent / manaMax)) : 0;
          const isDead = hpCurrent <= 0;

          await this.safeUpdateItems(barIds, (items) => {
            for (const item of items) {
              if (isShape(item)) {
                const isHpBar = item.metadata?.[`${META_PREFIX}-hp`] === tokenId;
                const isManaBar = item.metadata?.[`${META_PREFIX}-mana`] === tokenId;
                
                if (isHpBar) {
                  item.position.x = token.position.x - BAR_WIDTH / 2;
                  item.position.y = token.position.y - (token.height || 100) / 2 - 15;
                  item.width = BAR_WIDTH * hpRatio;
                  item.style.fillColor = isDead ? "#000000" : 
                    hpRatio > 0.5 ? "#22cc44" : 
                    hpRatio > 0.25 ? "#ccaa22" : "#cc2222";
                  item.style.strokeWidth = isDead ? 2 : 1;
                } else if (isManaBar) {
                  item.position.x = token.position.x - BAR_WIDTH / 2;
                  item.position.y = token.position.y - (token.height || 100) / 2 - 8;
                  item.width = BAR_WIDTH * manaRatio;
                  item.style.fillColor = "#4499dd";
                }
              }
            }
          });
        }
      } catch (e) {
        console.warn("[TokenBars] Position update error:", e);
      }
    };

    // Обновляем позицию каждые 500ms
    const interval = setInterval(updatePosition, 500);
    const intervals = animationIntervals.get(tokenId) || [];
    intervals.push(interval);
    animationIntervals.set(tokenId, intervals);
  }

  private startHpAnimations(tokenId: string, hpRatio: number) {
    // Пока без сложных анимаций - сначала сделаем базовое позиционирование рабочим
  }

  private startManaAnimations(tokenId: string) {
    // Пока без сложных анимаций
  }

  async updateBars(
    tokenId: string,
    hpCurrent: number,
    hpMax: number,
    manaCurrent: number,
    manaMax: number,
    useManaAsHp?: boolean
  ): Promise<void> {
    await this.createBars(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
  }

  async syncAllBars(units: UnitLike[]): Promise<void> {
    for (const unit of units) {
      if (unit.owlbearTokenId) {
        await this.updateBars(
          unit.owlbearTokenId,
          unit.health.current,
          unit.health.max,
          unit.mana.current,
          unit.mana.max,
          unit.useManaAsHp
        );
      }
    }
  }
}

export const tokenBarService = new TokenBarService();
