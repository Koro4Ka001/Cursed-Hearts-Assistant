// src/services/tokenBarService.ts

import OBR, { buildShape, buildText } from "@owlbear-rodeo/sdk";
import type { UnitLike } from "@/types";

const EXT = "cursed-hearts-assistant";
const META_PREFIX = `${EXT}/bar`;

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

  private async safeAddItems(items: any[]) {
    if (!this.ready) return;
    try {
      await OBR.scene.items.addItems(items);
    } catch (e) {
      console.warn("[TokenBars] Add error:", e);
    }
  }

  private async safeDeleteItems(ids: string[]) {
    if (!this.ready) return;
    try {
      await OBR.scene.items.deleteItems(ids);
    } catch (e) {
      console.warn("[TokenBars] Delete error:", e);
    }
  }

  private getBarIds(tokenId: string): string[] {
    return [
      `${tokenId}-hp`,
      `${tokenId}-mana`,
    ];
  }

  async removeBars(tokenId: string): Promise<void> {
    const ids = this.getBarIds(tokenId);
    await this.safeDeleteItems(ids);
  }

  async removeAllBars(): Promise<void> {
    if (!this.ready) return;
    try {
      const items = await OBR.scene.items.getItems();
      const barItems = items.filter(item =>
        item.metadata && typeof item.metadata === 'object' &&
        Object.keys(item.metadata).some(key => key.startsWith(META_PREFIX))
      );
      if (barItems.length > 0) {
        await OBR.scene.items.deleteItems(barItems.map(i => i.id));
      }
    } catch (e) {
      console.warn("[TokenBars] Remove all error:", e);
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

    const items = [];
    const isDead = hpCurrent <= 0;

    // === HP BAR ===
    const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
    const hpColor = isDead ? "#000000" : hpRatio > 0.5 ? "#22cc44" : hpRatio > 0.25 ? "#ccaa22" : "#cc2222";
    
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(100)
        .height(10)
        .position({ x: -50, y: 60 })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(1)
        .name(`${tokenId}-hp`)
        .fillColor(hpColor)
        .strokeColor("#7a5a1e")
        .strokeWidth(1)
        .metadata({ [`${META_PREFIX}-hp`]: true })
        .build()
    );

    // === MANA BAR ===
    if (!useManaAsHp) {
      const manaRatio = manaMax > 0 ? Math.max(0, Math.min(1, manaCurrent / manaMax)) : 0;
      
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(100 * manaRatio)
          .height(8)
          .position({ x: -50, y: 72 })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(1)
          .name(`${tokenId}-mana`)
          .fillColor("#4499dd")
          .strokeColor("#1a3a5a")
          .strokeWidth(1)
          .metadata({ [`${META_PREFIX}-mana`]: true })
          .build()
      );
    }

    await this.safeAddItems(items);
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
}

export const tokenBarService = new TokenBarService();
