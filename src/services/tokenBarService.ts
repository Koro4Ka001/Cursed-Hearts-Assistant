// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    try {
      // Удаляем старые бары этого токена
      const existingItems = await OBR.scene.items.getItems();
      const oldBars = existingItems.filter(item => 
        item.metadata?.["cursed-hearts-token-id"] === tokenId
      );
      if (oldBars.length > 0) {
        await OBR.scene.items.deleteItems(oldBars.map(i => i.id));
      }

      const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      
      // Создаём ОДИН бар с правильной привязкой
      const bar = buildShape()
        .shapeType("RECTANGLE")
        .width(60 * hpRatio)
        .height(5)
        .position({ x: -30, y: -20 }) // ← Относительно центра токена
        .attachedTo(tokenId)           // ← КЛЮЧЕВОЕ: привязка к токену
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(999)
        .fillColor(hpCurrent <= 0 ? "#000000" : hpRatio > 0.5 ? "#22cc44" : "#cc2222")
        .strokeColor("#ffffff")
        .strokeWidth(1)
        .metadata({ "cursed-hearts-token-id": tokenId }) // Для удаления
        .build();

      await OBR.scene.items.addItems([bar]);
      console.log("BAR ATTACHED TO TOKEN:", tokenId);
    } catch (error) {
      console.error("BAR ERROR:", error);
    }
  }
  
  async updateBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    await this.createBars(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
  }
  
  async syncAllBars(units: any[]) {}
  async removeAllBars() {}
  async removeBars(tokenId: string) {}
  async initialize() {}
}

export const tokenBarService = new TokenBarService();
