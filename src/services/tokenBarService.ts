// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    try {
      // Удаляем старые бары
      const items = await OBR.scene.items.getItems();
      const oldBars = items.filter(item => item.metadata?.["cursed-hearts-bar"] === tokenId);
      if (oldBars.length > 0) {
        await OBR.scene.items.deleteItems(oldBars.map(i => i.id));
      }

      // Создаём бар ПОД токеном с правильной привязкой
      const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      
      const bar = buildShape()
        .shapeType("RECTANGLE")
        .width(80 * hpRatio)
        .height(6)
        .position({ x: -40, y: 30 }) // ← ПОД токеном: y = положительное!
        .attachedTo(tokenId)         // ← КЛЮЧЕВОЕ: привязка к токену
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(999)
        .fillColor(hpCurrent <= 0 ? "#000000" : hpRatio > 0.5 ? "#22cc44" : "#cc2222")
        .strokeColor("#7a5a1e")
        .strokeWidth(1)
        .metadata({ "cursed-hearts-bar": tokenId })
        .build();

      await OBR.scene.items.addItems([bar]);
      console.log("BAR CREATED UNDER TOKEN!");
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
    try {
      const items = await OBR.scene.items.getItems();
      const barItems = items.filter(item => item.metadata?.["cursed-hearts-bar"] === tokenId);
      if (barItems.length > 0) {
        await OBR.scene.items.deleteItems(barItems.map(i => i.id));
      }
    } catch (error) {
      console.warn("REMOVE BAR ERROR:", error);
    }
  }
  
  async initialize() {}
  async syncAllBars(units: any[]) {}
}

export const tokenBarService = new TokenBarService();
