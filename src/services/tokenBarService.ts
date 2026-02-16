// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  private barIds: string[] = [];

  async initialize() {
    // Ничего не делаем при инициализации
  }

  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    // Удаляем старые бары
    await this.removeAllBars();

    try {
      // Получаем все items на сцене
      const items = await OBR.scene.items.getItems();
      
      // Находим токен по ID
      const token = items.find(item => item.id === tokenId);
      if (!token) {
        console.warn("Token not found:", tokenId);
        return;
      }

      // Рассчитываем позицию бара НАД токеном
      const barX = token.position.x - 50; // Центрируем по ширине 100px
      const barY = token.position.y - (token.height || 100) / 2 - 15;

      // Создаём HP бар
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

      // Создаём Mana бар если нужно
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
            .visible(true)
            .zIndex(999)
            .fillColor("#4499dd")
            .strokeColor("#1a3a5a")
            .strokeWidth(1)
            .build();
          createdItems.push(manaBar);
        }
      }

      // Добавляем бары на сцену
      const newItems = await OBR.scene.items.addItems(createdItems);
      this.barIds = newItems.map(item => item.id);
      
      console.log("Bars created successfully!");
    } catch (error) {
      console.error("Failed to create bars:", error);
    }
  }

  async updateBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    await this.createBars(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
  }

  async removeAllBars() {
    if (this.barIds.length > 0) {
      try {
        await OBR.scene.items.deleteItems(this.barIds);
        this.barIds = [];
      } catch (error) {
        console.warn("Failed to remove bars:", error);
      }
    }
  }

  async removeBars(tokenId: string) {
    await this.removeAllBars();
  }

  async syncAllBars(units: any[]) {
    // Не используется в этом подходе
  }
}

export const tokenBarService = new TokenBarService();
