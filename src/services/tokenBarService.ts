// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    try {
      // Удаляем все существующие бары
      const items = await OBR.scene.items.getItems();
      const barItems = items.filter(item => item.metadata?.["cursed-hearts-bar"]);
      if (barItems.length > 0) {
        await OBR.scene.items.deleteItems(barItems.map(i => i.id));
      }

      // Создаём бар С ПРАВИЛЬНОЙ ПРИВЯЗКОЙ
      const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      
      const bar = buildShape()
        .shapeType("RECTANGLE")
        .width(80 * hpRatio)
        .height(6)
        .position({ x: -40, y: 25 }) // ← ПОД токеном (y: положительное!)
        .attachedTo(tokenId)         // ← ОБЯЗАТЕЛЬНО!
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(999)
        .fillColor(hpCurrent <= 0 ? "#000000" : hpRatio > 0.5 ? "#22cc44" : "#cc2222")
        .strokeColor("#7a5a1e")
        .strokeWidth(1)
        .metadata({ "cursed-hearts-bar": true })
        .build();

      await OBR.scene.items.addItems([bar]);
      console.log("BAR ATTACHED TO TOKEN!");
    } catch (error) {
      console.error("BAR ERROR:", error);
    }
  }
  
  async updateBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    await this.createBars(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
  }
  
  async removeAllBars() {
    try {
      const items = await OBR.scene.items.getItems();
      const barItems = items.filter(item => item.metadata?.["cursed-hearts-bar"]);
      if (barItems.length > 0) {
        await OBR.scene.items.deleteItems(barItems.map(i => i.id));
      }
    } catch (error) {
      console.warn("REMOVE BARS ERROR:", error);
    }
  }
  
  async removeBars(tokenId: string) {
    await this.removeAllBars();
  }
  
  async initialize() {}
  async syncAllBars(units: any[]) {}
}

export const tokenBarService = new TokenBarService();
