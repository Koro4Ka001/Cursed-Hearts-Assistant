// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  private barIds = new Map<string, string>(); // tokenId -> barId

  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    try {
      // Удаляем старый бар
      const oldBarId = this.barIds.get(tokenId);
      if (oldBarId) {
        await OBR.scene.items.deleteItems([oldBarId]);
        this.barIds.delete(tokenId);
      }

      // Создаём бар в любом месте (позиция будет обновлена)
      const bar = buildShape()
        .shapeType("RECTANGLE")
        .width(60)
        .height(5)
        .position({ x: 0, y: 0 })
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(999)
        .fillColor("#cc2222")
        .strokeColor("#ffffff")
        .strokeWidth(1)
        .build();

      const [newBar] = await OBR.scene.items.addItems([bar]);
      this.barIds.set(tokenId, newBar.id);

      // Немедленно обновляем позицию
      await this.updateBarPosition(tokenId, hpCurrent, hpMax);
      
    } catch (error) {
      console.error("BAR ERROR:", error);
    }
  }

  private async updateBarPosition(tokenId: string, hpCurrent: number, hpMax: number) {
    try {
      const barId = this.barIds.get(tokenId);
      if (!barId) return;

      // Получаем позицию токена
      const items = await OBR.scene.items.getItems();
      const token = items.find(item => item.id === tokenId);
      if (!token) return;

      const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      
      // Обновляем позицию и ширину бара
      await OBR.scene.items.updateItems([barId], (items) => {
        for (const item of items) {
          item.position.x = token.position.x - 30;
          item.position.y = token.position.y - (token.height || 100) / 2 - 15;
          item.width = 60 * hpRatio;
          
          // Обновляем цвет
          if (hpCurrent <= 0) {
            item.style.fillColor = "#000000";
          } else if (hpRatio > 0.5) {
            item.style.fillColor = "#22cc44";
          } else {
            item.style.fillColor = "#cc2222";
          }
        }
      });
    } catch (error) {
      console.error("UPDATE POSITION ERROR:", error);
    }
  }

  async updateBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    await this.createBars(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
  }

  async removeAllBars() {
    const barIds = Array.from(this.barIds.values());
    if (barIds.length > 0) {
      await OBR.scene.items.deleteItems(barIds);
    }
    this.barIds.clear();
  }

  async removeBars(tokenId: string) {
    const barId = this.barIds.get(tokenId);
    if (barId) {
      await OBR.scene.items.deleteItems([barId]);
      this.barIds.delete(tokenId);
    }
  }

  async initialize() {}
  async syncAllBars(units: any[]) {}
}

export const tokenBarService = new TokenBarService();
