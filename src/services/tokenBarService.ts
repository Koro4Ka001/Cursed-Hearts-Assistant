// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";

export class TokenBarService {
  async createBars(tokenId: string, hpCurrent: number, hpMax: number, manaCurrent: number, manaMax: number, useManaAsHp?: boolean) {
    try {
      // Создаём ОДНУ фигуру без привязки
      const bar = buildShape()
        .shapeType("RECTANGLE")
        .width(100)
        .height(20)
        .position({ x: 500, y: 500 }) // Фиксированная позиция в центре сцены
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(999)
        .fillColor("#ff0000") // Ярко-красный
        .strokeColor("#ffffff")
        .strokeWidth(2)
        .build();

      await OBR.scene.items.addItems([bar]);
      console.log("RED BAR CREATED AT (500, 500)!");
    } catch (error) {
      console.error("FAILED TO CREATE BAR:", error);
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
