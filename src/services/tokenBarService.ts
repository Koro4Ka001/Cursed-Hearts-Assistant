// src/services/tokenBarService.ts

import OBR, { buildShape, buildText, isShape } from "@owlbear-rodeo/sdk";
import type { UnitLike } from "@/types";

const EXT = "cursed-hearts-assistant";
const META_PREFIX = `${EXT}/bar`;

// Размеры
const BAR_WIDTH = 100;
const HP_HEIGHT = 10;
const MANA_HEIGHT = 8;
const Y_OFFSET_HP = 60;
const Y_OFFSET_MANA = 75;

// Глобальные интервалы для анимаций
const animationIntervals = new Map<string, NodeJS.Timeout[]>();

function clearAnimations(tokenId: string) {
  const intervals = animationIntervals.get(tokenId);
  if (intervals) {
    intervals.forEach(clearInterval);
    animationIntervals.delete(tokenId);
  }
}

async function isSceneReady(): Promise<boolean> {
  try {
    return await OBR.scene.isReady();
  } catch {
    return false;
  }
}

export class TokenBarService {
  private ready = false;

  async initialize(): Promise<void> {
    if (this.ready) return;
    this.ready = await isSceneReady();
  }

  private async safeUpdateItems(ids: string[], updater: (items: any[]) => void) {
    if (!(await isSceneReady())) return;
    try {
      await OBR.scene.items.updateItems(ids, updater);
    } catch (e) {
      console.warn("[TokenBars] Update error:", e);
    }
  }

  private async safeAddItems(items: any[]) {
    if (!(await isSceneReady())) return;
    try {
      await OBR.scene.items.addItems(items);
    } catch (e) {
      console.warn("[TokenBars] Add error:", e);
    }
  }

  private async safeDeleteItems(ids: string[]) {
    if (!(await isSceneReady())) return;
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
      `${tokenId}-mana-bg-top`,
      `${tokenId}-mana-bg-right`,
      `${tokenId}-mana-bg-bottom`,
      `${tokenId}-mana-bg-left`,
      `${tokenId}-mana-fill`,
      `${tokenId}-mana-text`,
    ];
  }

  async removeBars(tokenId: string): Promise<void> {
    clearAnimations(tokenId);
    const ids = this.getBarIds(tokenId);
    await this.safeDeleteItems(ids);
  }

  async removeAllBars(): Promise<void> {
    if (!(await isSceneReady())) return;
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
    if (!(await isSceneReady())) return;

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
        .width(hpFillWidth)
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
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
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

    // === MANA BG (ромб) ===
    const points = [
      { x: 0, y: Y_OFFSET_MANA },
      { x: BAR_WIDTH / 2, y: Y_OFFSET_MANA + MANA_HEIGHT / 2 },
      { x: 0, y: Y_OFFSET_MANA + MANA_HEIGHT },
      { x: -BAR_WIDTH / 2, y: Y_OFFSET_MANA + MANA_HEIGHT / 2 },
    ];
    for (let i = 0; i < 4; i++) {
      items.push(
        buildShape()
          .shapeType("LINE")
          .start(points[i])
          .end(points[(i + 1) % 4])
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(1)
          .name(`${tokenId}-mana-bg-${['top','right','bottom','left'][i]}`)
          .strokeColor("#1a3a5a")
          .strokeWidth(1)
          .metadata({ [`${META_PREFIX}-mana-bg`]: true })
          .build()
      );
    }

    // === MANA FILL ===
    if (manaRatio > 0) {
      const fillHeight = MANA_HEIGHT * manaRatio;
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(BAR_WIDTH - 10)
          .height(fillHeight)
          .position({ x: -BAR_WIDTH / 2 + 5, y: Y_OFFSET_MANA + MANA_HEIGHT - fillHeight })
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
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
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
    // Проще пересоздать бары
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
