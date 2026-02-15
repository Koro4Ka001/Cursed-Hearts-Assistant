// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    try {
      const ratio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      
      const bar = buildShape()
        .shapeType("RECTANGLE")
        .width(60 * ratio)    // Меньше ширина
        .height(4)            // Меньше высота
        .position({ x: -30, y: -25 }) // ← КЛЮЧ: маленькие числа!
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(999)
        .fillColor(hpCurrent <= 0 ? "#000000" : ratio > 0.5 ? "#22cc44" : "#cc2222")
        .strokeColor("#777777")
        .strokeWidth(1)
        .build();
      
      await OBR.scene.items.addItems([bar]);
      console.log("BAR CREATED!");
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
