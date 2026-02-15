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

  async removeBars(tokenId: string): Promise<void> {
    if (!this.ready) return;
    try {
      const items = await OBR.scene.items.getItems();
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
      const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
      const manaRatio = manaMax > 0 ? Math.max(0, Math.min(1, manaCurrent / manaMax)) : 0;
      
      const items = [];
      
      // HP BAR - всегда создаём
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(80 * hpRatio)
          .height(6)
          .position({ x: -40, y: 55 })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(10)
          .fillColor(hpCurrent <= 0 ? "#000000" : hpRatio > 0.5 ? "#22cc44" : "#cc2222")
          .strokeColor("#ffffff")
          .strokeWidth(1)
          .metadata({ [META_PREFIX]: tokenId })
          .build()
      );

      // MANA BAR - только если не используется как HP
      if (!useManaAsHp && manaRatio > 0) {
        items.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(80 * manaRatio)
            .height(4)
            .position({ x: -40, y: 63 })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(true)
            .zIndex(10)
            .fillColor("#4499dd")
            .strokeColor("#aaccff")
            .strokeWidth(1)
            .metadata({ [META_PREFIX]: tokenId })
            .build()
        );
      }

      if (items.length > 0) {
        await OBR.scene.items.addItems(items);
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
      const items = await OBR.scene.items.getItems();
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
