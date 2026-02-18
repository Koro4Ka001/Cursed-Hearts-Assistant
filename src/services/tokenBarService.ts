// src/services/tokenBarService.ts

import OBR, { 
  buildShape, 
  Item, 
  isImage, 
  isShape,
  Shape,
  Image
} from "@owlbear-rodeo/sdk";
import type { Unit } from "../types";

const METADATA_KEY = "cursed-hearts-assistant";
const BAR_PREFIX = `${METADATA_KEY}/bar`;

class TokenBarService {
  private bars = new Map<string, string[]>();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        OBR.scene.onReadyChange(async (r) => {
          if (r && !this.initialized) await this.doInit();
        });
        return;
      }
      await this.doInit();
    } catch (e) {
      console.error("[Bars] Init error:", e);
    }
  }

  private async doInit(): Promise<void> {
    await this.cleanup();
    this.initialized = true;
    console.log("[Bars] ✓ Ready");
  }

  // ==========================================================================
  // ТЕСТОВОЕ СОЗДАНИЕ — пробуем разные варианты!
  // ==========================================================================

  async createBars(
    tokenId: string,
    hp: number,
    maxHp: number,
    mana: number,
    maxMana: number,
    useManaAsHp = false
  ): Promise<void> {
    if (!tokenId) return;

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      await this.removeBars(tokenId);

      // Получаем токен
      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length) {
        console.error("[Bars] ❌ Token not found!");
        return;
      }

      const token = items[0];
      if (!isImage(token)) {
        console.error("[Bars] ❌ Not an image!");
        return;
      }

      // Размеры токена
      const tokenW = token.image.width * token.scale.x;
      const tokenH = token.image.height * token.scale.y;
      const tokenX = token.position.x;
      const tokenY = token.position.y;

      console.log("═══════════════════════════════════════");
      console.log("[Bars] 🎯 TOKEN INFO:");
      console.log(`  ID: ${tokenId}`);
      console.log(`  Position: (${tokenX}, ${tokenY})`);
      console.log(`  Size: ${tokenW} x ${tokenH}`);
      console.log(`  Visible: ${token.visible}`);
      console.log("═══════════════════════════════════════");

      const barWidth = 100;
      const barHeight = 8;
      const ts = Date.now();
      const createdIds: string[] = [];

      // ═══════════════════════════════════════════════════════════════
      // ТЕСТ 1: Абсолютные координаты, БЕЗ attachedTo
      // ═══════════════════════════════════════════════════════════════
      const test1X = tokenX - barWidth / 2;
      const test1Y = tokenY + tokenH / 2 + 5;
      
      console.log(`[Bars] TEST 1: Absolute pos (${test1X.toFixed(0)}, ${test1Y.toFixed(0)}), NO attachedTo`);
      
      const bar1 = buildShape()
        .shapeType("RECTANGLE")
        .width(barWidth)
        .height(barHeight)
        .position({ x: test1X, y: test1Y })
        .layer("DRAWING")
        .fillColor("#ff0000")
        .strokeColor("#ffffff")
        .strokeWidth(2)
        .locked(true)
        .id(`${BAR_PREFIX}/test1/${ts}`)
        .build();

      // ═══════════════════════════════════════════════════════════════
      // ТЕСТ 2: position(0,0) С attachedTo — должен быть в ЦЕНТРЕ токена
      // ═══════════════════════════════════════════════════════════════
      console.log(`[Bars] TEST 2: pos(0, 0) WITH attachedTo — should be at token CENTER`);
      
      const bar2 = buildShape()
        .shapeType("RECTANGLE")
        .width(barWidth)
        .height(barHeight)
        .position({ x: 0, y: 0 })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .fillColor("#00ff00")
        .strokeColor("#ffffff")
        .strokeWidth(2)
        .locked(true)
        .id(`${BAR_PREFIX}/test2/${ts}`)
        .build();

      // ═══════════════════════════════════════════════════════════════
      // ТЕСТ 3: position(0, tokenH/2) С attachedTo — должен быть ВНИЗУ токена
      // ═══════════════════════════════════════════════════════════════
      const test3Y = tokenH / 2 + 10;
      console.log(`[Bars] TEST 3: pos(0, ${test3Y.toFixed(0)}) WITH attachedTo — should be BELOW token`);
      
      const bar3 = buildShape()
        .shapeType("RECTANGLE")
        .width(barWidth)
        .height(barHeight)
        .position({ x: -barWidth / 2, y: test3Y })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .fillColor("#0000ff")
        .strokeColor("#ffffff")
        .strokeWidth(2)
        .locked(true)
        .id(`${BAR_PREFIX}/test3/${ts}`)
        .build();

      // ═══════════════════════════════════════════════════════════════
      // ТЕСТ 4: Абсолютные + attachedTo (гибрид)
      // ═══════════════════════════════════════════════════════════════
      console.log(`[Bars] TEST 4: Absolute (${test1X.toFixed(0)}, ${test1Y.toFixed(0)}) WITH attachedTo`);
      
      const bar4 = buildShape()
        .shapeType("RECTANGLE")
        .width(barWidth)
        .height(barHeight)
        .position({ x: test1X, y: test1Y })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .fillColor("#ffff00")
        .strokeColor("#000000")
        .strokeWidth(2)
        .locked(true)
        .id(`${BAR_PREFIX}/test4/${ts}`)
        .build();

      // Добавляем все тесты
      await OBR.scene.items.addItems([bar1, bar2, bar3, bar4]);
      
      createdIds.push(bar1.id, bar2.id, bar3.id, bar4.id);
      this.bars.set(tokenId, createdIds);

      console.log("═══════════════════════════════════════");
      console.log("[Bars] ✓ Created 4 test bars:");
      console.log("  🔴 RED = Absolute, no attach (should be correct)");
      console.log("  🟢 GREEN = (0,0) + attach (should be at center)");
      console.log("  🔵 BLUE = relative + attach (should be below)");
      console.log("  🟡 YELLOW = absolute + attach (hybrid test)");
      console.log("═══════════════════════════════════════");
      console.log("[Bars] 👀 Look at the scene and tell me where each color appeared!");

    } catch (e) {
      console.error("[Bars] Create error:", e);
    }
  }

  // ==========================================================================
  // UPDATE / REMOVE / SYNC
  // ==========================================================================

  async updateBars(
    tokenId: string,
    hp: number,
    maxHp: number,
    mana: number,
    maxMana: number,
    useManaAsHp = false
  ): Promise<void> {
    await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
  }

  async removeBars(tokenId: string): Promise<void> {
    const ids = this.bars.get(tokenId);
    if (!ids) return;
    
    try {
      await OBR.scene.items.deleteItems(ids);
    } catch {}
    
    this.bars.delete(tokenId);
  }

  async removeAllBars(): Promise<void> {
    for (const id of this.bars.keys()) {
      await this.removeBars(id);
    }
    await this.cleanup();
    console.log("[Bars] All removed");
  }

  async syncAllBars(units: Unit[]): Promise<void> {
    for (const u of units) {
      if (u.owlbearTokenId) {
        await this.createBars(
          u.owlbearTokenId,
          u.health?.current ?? 0,
          u.health?.max ?? 100,
          u.mana?.current ?? 0,
          u.mana?.max ?? 50,
          u.useManaAsHp ?? false
        );
      }
    }
  }

  async forceRefresh(): Promise<void> {
    console.log("[Bars] Force refresh - run CREATE again");
  }

  private async cleanup(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const ours = items.filter(i => i.id.startsWith(BAR_PREFIX));
      if (ours.length) {
        await OBR.scene.items.deleteItems(ours.map(i => i.id));
        console.log(`[Bars] Cleaned ${ours.length}`);
      }
    } catch {}
  }

  async destroy(): Promise<void> {
    await this.removeAllBars();
    this.initialized = false;
  }
}

export const tokenBarService = new TokenBarService();
(window as any).tokenBarService = tokenBarService;
