// src/services/tokenBarService.ts

import OBR, { buildShape } from "@owlbear-rodeo/sdk";
import type { UnitLike } from "@/types";

const META_PREFIX = "cursed-hearts-bar";

export class TokenBarService {
  private ready = false;

  async initialize(): Promise<void> {
    if (this.ready) return;
    try {
      this.ready = await OBR.scene.isReady();
    } catch {
      this.ready = false;
    }
  }

  private async getSceneItems() {
    if (!this.ready) return [];
    try {
      return await OBR.scene.items.getItems();
    } catch {
      return [];
    }
  }

  async removeBars(tokenId: string): Promise<void> {
    if (!this.ready) return;
    try {
      const items = await this.getSceneItems();
      const barItems = items.filter(item => 
        item.metadata?.[META_PREFIX] === tokenId
      );
      if (barItems.length > 0) {
        await OBR.scene.items.deleteItems(barItems.map(i => i.id));
      }
    } catch (e) {
      console.warn("[TokenBars] Remove error:", e);
    }
  }

  async createBars(
    tokenId: string,
    hpCurrent: number,
    hpMax: number,
    manaCurrent: number,
    manaMax: number,
    useManaAsHp?: boolean
  ): Promise<void> {
    if (!this.ready) return;

    // Удаляем старые бары
    await this.removeBars(tokenId);

    try {
      const items = await this.getSceneItems();
      const token = items.find(item => item.id === tokenId);
      
      if (!token) {
        console.warn("[TokenBars] Token not found:", tokenId);
        return;
      }

      const bars = [];
      const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      const manaRatio = manaMax > 0 ? Math.max(0, Math.min(1, manaCurrent / manaMax)) : 0;
      
      // Позиция HP бара: над токеном
      const hpBarX = token.position.x - 50; // Центрируем по ширине 100px
      const hpBarY = token.position.y - (token.height || 100) / 2 - 15;
      
      // HP BAR
      bars.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(100 * hpRatio)
          .height(8)
          .position({ x: hpBarX, y: hpBarY })
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(999)
          .fillColor(hpCurrent <= 0 ? "#000000" : hpRatio > 0.5 ? "#22cc44" : "#cc2222")
          .strokeColor("#7a5a1e")
          .strokeWidth(1)
          .metadata({ [META_PREFIX]: tokenId })
          .build()
      );

      // MANA BAR (если не используется как HP)
      if (!useManaAsHp && manaRatio > 0) {
        const manaBarY = hpBarY + 10;
        bars.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(100 * manaRatio)
            .height(6)
            .position({ x: hpBarX, y: manaBarY })
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(true)
            .zIndex(999)
            .fillColor("#4499dd")
            .strokeColor("#1a3a5a")
            .strokeWidth(1)
            .metadata({ [META_PREFIX]: tokenId })
            .build()
        );
      }

      if (bars.length > 0) {
        await OBR.scene.items.addItems(bars);
        console.log("[TokenBars] Bars created for token:", tokenId);
      }
    } catch (e) {
      console.error("[TokenBars] Create error:", e);
    }
  }

  async updateBars(
    tokenId: string,
    hpCurrent: number,
    hpMax: number,
    manaCurrent: number,
    manaMax: number,
    useManaAsHp?: boolean
  ): Promise<void> {
    await this.createBars(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
  }

  async syncAllBars(units: UnitLike[]): Promise<void> {
    for (const unit of units) {
      if (unit.owlbearTokenId) {
        await this.updateBars(
          unit.owlbearTokenId,
          unit.health.current,
          unit.health.max,
          unit.mana.current,
          unit.mana.max,
          unit.useManaAsHp
        );
      }
    }
  }

  async removeAllBars(): Promise<void> {
    if (!this.ready) return;
    try {
      const items = await this.getSceneItems();
      const barItems = items.filter(item => item.metadata?.[META_PREFIX]);
      if (barItems.length > 0) {
        await OBR.scene.items.deleteItems(barItems.map(i => i.id));
      }
    } catch (e) {
      console.warn("[TokenBars] Remove all error:", e);
    }
  }
}

export const tokenBarService = new TokenBarService();
