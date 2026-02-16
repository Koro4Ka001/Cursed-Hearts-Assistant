// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  private barIds: string[] = [];
  private currentTokenId: string | null = null;

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

      // ПОЗИЦИЯ ПОД ТОКЕНОМ
      const barX = token.position.x - 50; // Центрируем по ширине 100px
      const barY = token.position.y + (token.height || 100) / 2 + 5; // Под токеном

      const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      const hpBar = buildShape()
        .shapeType("RECTANGLE")
        .width(100 * hpRatio)
        .height(8)
        .position({ x: barX, y: barY })
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
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
            .position({ x: barX, y: barY + 10 }) // Под HP баром
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(true)
            .zIndex(999)
            .fillColor("#4499dd")
            .strokeColor("#1a3a5a")
            .strokeWidth(1)
            .build();
          createdItems.push(manaBar);
        }
      }

      const newItems = await OBR.scene.items.addItems(createdItems);
      this.barIds = newItems.map(item => item.id);
      
      console.log("Bars created under token!");
      
      // Запускаем отслеживание движения токена
      this.startTracking();
      
    } catch (error) {
      console.error("Failed to create bars:", error);
    }
  }

  private startTracking() {
    // Обновляем позицию баров каждые 300ms
    const interval = setInterval(async () => {
      if (!this.currentTokenId) {
        clearInterval(interval);
        return;
      }
      
      try {
        const items = await OBR.scene.items.getItems();
        const token = items.find(item => item.id === this.currentTokenId);
        
        if (!token) {
          // Токен удалён
          await this.removeAllBars();
          clearInterval(interval);
          return;
        }
        
        // Обновляем позицию баров
        const barX = token.position.x - 50;
        const barY = token.position.y + (token.height || 100) / 2 + 5;
        
        await OBR.scene.items.updateItems(this.barIds, (items) => {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (i === 0) {
              // HP бар
              item.position.x = barX;
              item.position.y = barY;
            } else if (i === 1) {
              // Mana бар
              item.position.x = barX;
              item.position.y = barY + 10;
            }
          }
        });
        
      } catch (error) {
        console.warn("Tracking error:", error);
      }
    }, 300);
  }

  async updateBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    await this.createBars(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
  }

  async removeAllBars() {
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
