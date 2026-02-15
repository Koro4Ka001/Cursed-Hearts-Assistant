// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    try {
      // Получаем позицию токена
      const items = await OBR.scene.items.getItems();
      const token = items.find(item => item.id === tokenId);
      
      if (!token) {
        console.warn("Token not found:", tokenId);
        return;
      }
      
      const ratio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      const width = 80 * ratio;
      
      // Абсолютная позиция НАД токеном
      const barX = token.position.x - 40; // Центрируем по ширине
      const barY = token.position.y - (token.height || 100) / 2 - 10; // Над токеном
      
      const bar = buildShape()
        .shapeType("RECTANGLE")
        .width(width)
        .height(6)
        .position({ x: barX, y: barY })
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(999)
        .fillColor(hpCurrent <= 0 ? "#000000" : ratio > 0.5 ? "#22cc44" : "#cc2222")
        .strokeColor("#ffffff")
        .strokeWidth(1)
        .build();
      
      await OBR.scene.items.addItems([bar]);
      console.log("BAR CREATED AT ABSOLUTE POSITION!");
    } catch (error) {
      console.error("BAR FAILED:", error);
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
