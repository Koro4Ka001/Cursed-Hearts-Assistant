// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  private barIds: string[] = [];
  private currentTokenId: string | null = null;
  private trackingInterval: NodeJS.Timeout | null = null;

  async initialize() {}

  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    // Удаляем старые бары
    await this.removeAllBars();
    this.currentTokenId = tokenId;

    try {
      const items = await OBR.scene.items.getItems();
      const token = items.find(item => item.id === tokenId);
      
      if (!token) {
        console.warn("Token not found:", tokenId);
        return;
      }

      // Создаём бары в начальной позиции
      const bars = await this.createBarsAtPosition(token, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
      this.barIds = bars.map(item => item.id);
      
      console.log("Bars created and tracking started!");
      
      // Запускаем полное отслеживание
      this.startFullTracking();
      
    } catch (error) {
      console.error("Failed to create bars:", error);
    }
  }

  private async createBarsAtPosition(token: any, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    // Позиция ПОД токеном
    const barX = token.position.x - 50;
    const barY = token.position.y + (token.height || 100) / 2 + 5;

    const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
    const hpBar = buildShape()
      .shapeType("RECTANGLE")
      .width(100 * hpRatio)
      .height(8)
      .position({ x: barX, y: barY })
      .layer("ATTACHMENT")
      .locked(true)
      .disableHit(true)
      .visible(token.visible) // Синхронизируем видимость!
      .zIndex(999)
      .fillColor(hpCurrent <= 0 ? "#000000" : hpRatio > 0.5 ? "#22cc44" : "#cc2222")
      .strokeColor("#7a5a1e")
      .strokeWidth(1)
      .build();

    const createdItems = [hpBar];

    if (!useManaAsHp && manaMax > 0) {
      const manaRatio = Math.max(0, Math.min(1, manaCurrent / manaMax));
      if (manaRatio > 0) {
        const manaBar = buildShape()
          .shapeType("RECTANGLE")
          .width(100 * manaRatio)
          .height(6)
          .position({ x: barX, y: barY + 10 })
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(token.visible) // Синхронизируем видимость!
          .zIndex(999)
          .fillColor("#4499dd")
          .strokeColor("#1a3a5a")
          .strokeWidth(1)
          .build();
        createdItems.push(manaBar);
      }
    }

    return await OBR.scene.items.addItems(createdItems);
  }

  private startFullTracking() {
    // Полная синхронизация каждые 200ms
    this.trackingInterval = setInterval(async () => {
      if (!this.currentTokenId) {
        this.stopTracking();
        return;
      }
      
      try {
        const items = await OBR.scene.items.getItems();
        const token = items.find(item => item.id === this.currentTokenId);
        
        if (!token) {
          // Токен удалён
          await this.removeAllBars();
          return;
        }
        
        // Проверяем, изменились ли параметры токена
        const barX = token.position.x - 50;
        const barY = token.position.y + (token.height || 100) / 2 + 5;
        const isVisible = token.visible;
        
        // Обновляем все параметры баров
        await OBR.scene.items.updateItems(this.barIds, (items) => {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            item.position.x = barX;
            item.position.y = barY + (i > 0 ? 10 : 0); // Mana бар ниже HP
            item.visible = isVisible; // Синхронизируем видимость!
            
            // Обновляем цвета и размеры
            if (i === 0) {
              // HP бар - обновляем ширину и цвет
              const hpRatio = token.metadata?.["cursed-hearts-hp-ratio"] || 0.5;
              item.width = 100 * hpRatio;
              // Цвет обновляется в основном коде через recreate
            }
          }
        });
        
      } catch (error) {
        console.warn("Tracking error:", error);
      }
    }, 200);
  }

  private stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  async updateBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    // Для обновления HP/маны пересоздаём бары (проще и надёжнее)
    await this.createBars(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
  }

  async removeAllBars() {
    this.stopTracking();
    
    if (this.barIds.length > 0) {
      try {
        await OBR.scene.items.deleteItems(this.barIds);
        this.barIds = [];
        this.currentTokenId = null;
      } catch (error) {
        console.warn("Failed to remove bars:", error);
      }
    }
  }

  async removeBars(tokenId: string) {
    await this.removeAllBars();
  }

  async syncAllBars(units: any[]) {}
}

export const tokenBarService = new TokenBarService();
