// src/services/tokenBarService.ts

import OBR, { buildShape, buildText } from "@owlbear-rodeo/sdk";
import type { UnitLike } from "@/types";

const EXT = "cursed-hearts-assistant";
const META_PREFIX = `${EXT}/bar`;

// Размеры
const BAR_WIDTH = 100;
const HP_HEIGHT = 10;
const MANA_HEIGHT = 8;
const Y_OFFSET_HP = 60;
const Y_OFFSET_MANA = 75;

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
      `${tokenId}-hp-bg`,
      `${tokenId}-hp-fill`,
      `${tokenId}-hp-border`,
      `${tokenId}-hp-text`,
      `${tokenId}-mana-bg`,
      `${tokenId}-mana-fill`,
      `${tokenId}-mana-text`,
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
    const hpRatio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
    const manaRatio = manaMax > 0 ? Math.max(0, Math.min(1, manaCurrent / manaMax)) : 0;
    const isDead = hpCurrent <= 0;

    // === HP BG ===
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH)
        .height(HP_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: Y_OFFSET_HP })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(1)
        .name(`${tokenId}-hp-bg`)
        .fillColor("#2a0a0a")
        .strokeColor("#3a1818")
        .strokeWidth(1)
        .metadata({ [`${META_PREFIX}-hp-bg`]: true })
        .build()
    );

    // === HP FILL ===
    const hpFillWidth = BAR_WIDTH * hpRatio;
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(Math.max(1, hpFillWidth))
        .height(HP_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: Y_OFFSET_HP })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(2)
        .name(`${tokenId}-hp-fill`)
        .fillColor(isDead ? "#000000" : hpRatio > 0.5 ? "#22cc44" : hpRatio > 0.25 ? "#ccaa22" : "#cc2222")
        .strokeColor("transparent")
        .strokeWidth(0)
        .metadata({ [`${META_PREFIX}-hp-fill`]: true })
        .build()
    );

    // === HP BORDER ===
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH)
        .height(HP_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: Y_OFFSET_HP })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(3)
        .name(`${tokenId}-hp-border`)
        .fillColor("transparent")
        .strokeColor(isDead ? "#880000" : "#7a5a1e")
        .strokeWidth(isDead ? 2 : 1)
        .metadata({ [`${META_PREFIX}-hp-border`]: true })
        .build()
    );

    // === HP TEXT ===
    items.push(
      buildText()
        .position({ x: 0, y: Y_OFFSET_HP + HP_HEIGHT / 2 })
        .attachedTo(tokenId)
        .plainText(`${hpCurrent}/${hpMax}`)
        .fontSize(8)
        .fontFamily("Arial")
        .textAlign("CENTER")  // ← ПРАВИЛЬНО: textAlign, не textAlignHorizontal!
        .fillColor("#ffffff")
        .strokeColor("#000000")
        .strokeWidth(2)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(4)
        .name(`${tokenId}-hp-text`)
        .metadata({ [`${META_PREFIX}-hp-text`]: true })
        .build()
    );

    // === MANA BG ===
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH)
        .height(MANA_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: Y_OFFSET_MANA })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(1)
        .name(`${tokenId}-mana-bg`)
        .fillColor("#0e1a28")
        .strokeColor("#1a3a5a")
        .strokeWidth(1)
        .metadata({ [`${META_PREFIX}-mana-bg`]: true })
        .build()
    );

    // === MANA FILL ===
    if (manaRatio > 0) {
      const fillWidth = BAR_WIDTH * manaRatio;
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(Math.max(1, fillWidth))
          .height(MANA_HEIGHT)
          .position({ x: -BAR_WIDTH / 2, y: Y_OFFSET_MANA })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(2)
          .name(`${tokenId}-mana-fill`)
          .fillColor("#4499dd")
          .strokeColor("transparent")
          .strokeWidth(0)
          .metadata({ [`${META_PREFIX}-mana-fill`]: true })
          .build()
      );
    }

    // === MANA TEXT ===
    items.push(
      buildText()
        .position({ x: 0, y: Y_OFFSET_MANA + MANA_HEIGHT / 2 })
        .attachedTo(tokenId)
        .plainText(`${manaCurrent}/${manaMax}`)
        .fontSize(7)
        .fontFamily("Arial")
        .textAlign("CENTER")  // ← ПРАВИЛЬНО: textAlign, не textAlignHorizontal!
        .fillColor("#aaccff")
        .strokeColor("#000000")
        .strokeWidth(2)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(3)
        .name(`${tokenId}-mana-text`)
        .metadata({ [`${META_PREFIX}-mana-text`]: true })
        .build()
    );

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
