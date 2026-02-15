// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    try {
      const ratio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      const width = 80 * ratio;
      
      // Позиция НАД токеном
      const bar = buildShape()
        .shapeType("RECTANGLE")
        .width(width)
        .height(6)
        .position({ x: -40, y: -30 }) // ← КЛЮЧЕВОЕ ИЗМЕНЕНИЕ!
        .attachedTo(tokenId)
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
      console.log("BAR CREATED ABOVE TOKEN!");
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
