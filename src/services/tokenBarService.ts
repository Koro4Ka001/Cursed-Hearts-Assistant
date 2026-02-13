// src/services/tokenBarService.ts
// ═══════════════════════════════════════════════════════════════
// Token Bar Service — рисует HP/Mana бары на токенах в OBR
// 
// БЕЗОПАСНОСТЬ:
// - Конструктор БЕЗ side effects (безопасен для top-level import)
// - Все OBR вызовы в async методах, обёрнуты в try/catch
// - Если сцена не готова — молча return, без краша
// - Используются ТОЛЬКО документированные методы buildShape:
//   .fillColor(), .strokeColor(), .strokeWidth(), .zIndex()
//   НЕ используются: .style(), .fillOpacity(), .disableAutoZIndex()
// ═══════════════════════════════════════════════════════════════

import OBR, { buildShape, isShape } from "@owlbear-rodeo/sdk";

// ── Константы ──────────────────────────────────────────────────

const EXTENSION_ID = "cursed-hearts-assistant";
const META_KEY = `${EXTENSION_ID}/token-bar`;

const BAR_W = 100;
const BAR_H = 8;
const HP_Y = 55;
const MANA_Y = 67;

// ── Типы ───────────────────────────────────────────────────────

interface BarMeta {
  tokenId: string;
  barType: "hp" | "mana";
  role: "bg" | "fill";
}

/** Минимальный интерфейс юнита — чтобы не импортировать весь Unit */
interface UnitLike {
  owlbearTokenId?: string;
  health: { current: number; max: number };
  mana: { current: number; max: number };
  useManaAsHp?: boolean;
}

// ── Утилиты ────────────────────────────────────────────────────

function hpColor(ratio: number): string {
  if (ratio > 0.5) return "#22cc44";
  if (ratio > 0.25) return "#ccaa22";
  return "#cc2222";
}

// ════════════════════════════════════════════════════════════════
// КЛАСС
// ════════════════════════════════════════════════════════════════

class TokenBarService {
  private ready = false;

  // ✅ Конструктор ПУСТОЙ — никаких OBR вызовов, никаких side effects
  constructor() {}

  // ── Инициализация (вызывать ПОСЛЕ OBR.onReady) ───────────────

  async initialize(): Promise<void> {
    if (this.ready) return;
    try {
      const sceneReady = await OBR.scene.isReady();
      if (sceneReady) {
        this.ready = true;
        console.log("[TokenBarService] Initialized");
      } else {
        console.log("[TokenBarService] Scene not ready, skipping init");
      }
    } catch (e) {
      console.warn("[TokenBarService] Init failed (non-fatal):", e);
    }
  }

  // ── Проверка готовности ──────────────────────────────────────

  private async ensureReady(): Promise<boolean> {
    if (this.ready) return true;
    try {
      const sceneReady = await OBR.scene.isReady();
      if (sceneReady) {
        this.ready = true;
        return true;
      }
    } catch {
      // молча
    }
    return false;
  }

  // ── Чтение метаданных из item ────────────────────────────────

  private getBarMeta(item: { metadata?: Record<string, unknown> }): BarMeta | null {
    try {
      const raw = item.metadata?.[META_KEY];
      if (
        raw &&
        typeof raw === "object" &&
        raw !== null &&
        "tokenId" in raw &&
        "barType" in raw &&
        "role" in raw
      ) {
        return raw as BarMeta;
      }
    } catch {
      // metadata corrupted — ignore
    }
    return null;
  }

  // ── Поиск существующих баров ─────────────────────────────────

  private async findAllBarIds(tokenId: string): Promise<string[]> {
    try {
      const items = await OBR.scene.items.getItems();
      return items
        .filter((item) => {
          const m = this.getBarMeta(item);
          return m !== null && m.tokenId === tokenId;
        })
        .map((item) => item.id);
    } catch {
      return [];
    }
  }

  private async findFillItemId(
    tokenId: string,
    barType: "hp" | "mana"
  ): Promise<string | null> {
    try {
      const items = await OBR.scene.items.getItems();
      const found = items.find((item) => {
        const m = this.getBarMeta(item);
        return (
          m !== null &&
          m.tokenId === tokenId &&
          m.barType === barType &&
          m.role === "fill"
        );
      });
      return found?.id ?? null;
    } catch {
      return null;
    }
  }

  // ── Построение пары shape'ов (bg + fill) ─────────────────────

  private buildBarPair(
    tokenId: string,
    barType: "hp" | "mana",
    current: number,
    max: number,
    yOffset: number
  ) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

    const bgColor = barType === "hp" ? "#3a1818" : "#1a2a3a";
    const borderColor = barType === "hp" ? "#661111" : "#224466";
    const fillColor = barType === "hp" ? hpColor(ratio) : "#4488cc";

    const bg = buildShape()
      .shapeType("RECTANGLE")
      .width(BAR_W)
      .height(BAR_H)
      .position({ x: -BAR_W / 2, y: yOffset })
      .attachedTo(tokenId)
      .layer("ATTACHMENT")
      .locked(true)
      .disableHit(true)
      .visible(true)
      .zIndex(2)
      .name(`${EXTENSION_ID}-${barType}-bg`)
      .fillColor(bgColor)
      .strokeColor(borderColor)
      .strokeWidth(1)
      .metadata({
        [META_KEY]: { tokenId, barType, role: "bg" } as BarMeta,
      })
      .build();

    const fill = buildShape()
      .shapeType("RECTANGLE")
      .width(Math.max(1, BAR_W * ratio))
      .height(BAR_H)
      .position({ x: -BAR_W / 2, y: yOffset })
      .attachedTo(tokenId)
      .layer("ATTACHMENT")
      .locked(true)
      .disableHit(true)
      .visible(true)
      .zIndex(3)
      .name(`${EXTENSION_ID}-${barType}-fill`)
      .fillColor(fillColor)
      .strokeColor(borderColor)
      .strokeWidth(0)
      .metadata({
        [META_KEY]: { tokenId, barType, role: "fill" } as BarMeta,
      })
      .build();

    return [bg, fill];
  }

  // ════════════════════════════════════════════════════════════════
  // ПУБЛИЧНЫЕ МЕТОДЫ (API для store и App)
  // ════════════════════════════════════════════════════════════════

  /**
   * Создать бары с нуля для токена
   */
  async createBars(
    tokenId: string,
    hpCur: number,
    hpMax: number,
    manaCur: number,
    manaMax: number,
    _useManaAsHp?: boolean
  ): Promise<void> {
    if (!(await this.ensureReady())) return;

    try {
      // Сначала удалить старые (если есть)
      await this.removeBars(tokenId);

      const shapes = [
        ...this.buildBarPair(tokenId, "hp", hpCur, hpMax, HP_Y),
        ...this.buildBarPair(tokenId, "mana", manaCur, manaMax, MANA_Y),
      ];

      await OBR.scene.items.addItems(shapes);
    } catch (e) {
      console.warn("[TokenBarService] createBars failed:", e);
    }
  }

  /**
   * Обновить бары (или создать если не существуют)
   */
  async updateBars(
    tokenId: string,
    hpCur: number,
    hpMax: number,
    manaCur: number,
    manaMax: number,
    useManaAsHp?: boolean
  ): Promise<void> {
    if (!(await this.ensureReady())) return;

    try {
      // Проверяем существуют ли бары
      const existingIds = await this.findAllBarIds(tokenId);

      if (existingIds.length >= 4) {
        // Бары существуют — обновляем только fill'ы
        await this.updateSingleFill(tokenId, "hp", hpCur, hpMax);
        await this.updateSingleFill(tokenId, "mana", manaCur, manaMax);
      } else {
        // Баров нет или неполный набор — пересоздаём
        await this.createBars(tokenId, hpCur, hpMax, manaCur, manaMax, useManaAsHp);
      }
    } catch (e) {
      console.warn("[TokenBarService] updateBars failed:", e);
    }
  }

  /**
   * Обновить один fill-бар
   */
  private async updateSingleFill(
    tokenId: string,
    barType: "hp" | "mana",
    current: number,
    max: number
  ): Promise<void> {
    const fillId = await this.findFillItemId(tokenId, barType);
    if (!fillId) return;

    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    const color = barType === "hp" ? hpColor(ratio) : "#4488cc";

    await OBR.scene.items.updateItems([fillId], (items) => {
      for (const item of items) {
        if (isShape(item)) {
          item.width = Math.max(1, BAR_W * ratio);
          item.style.fillColor = color;
        }
      }
    });
  }

  /**
   * Удалить все бары конкретного токена
   */
  async removeBars(tokenId: string): Promise<void> {
    if (!(await this.ensureReady())) return;

    try {
      const ids = await this.findAllBarIds(tokenId);
      if (ids.length > 0) {
        await OBR.scene.items.deleteItems(ids);
      }
    } catch (e) {
      console.warn("[TokenBarService] removeBars failed:", e);
    }
  }

  /**
   * Удалить ВСЕ бары расширения со сцены
   */
  async removeAllBars(): Promise<void> {
    if (!(await this.ensureReady())) return;

    try {
      const items = await OBR.scene.items.getItems();
      const ids = items
        .filter((item) => this.getBarMeta(item) !== null)
        .map((item) => item.id);

      if (ids.length > 0) {
        await OBR.scene.items.deleteItems(ids);
        console.log(`[TokenBarService] Removed ${ids.length} bar shapes`);
      }
    } catch (e) {
      console.warn("[TokenBarService] removeAllBars failed:", e);
    }
  }

  /**
   * Синхронизировать бары для всех юнитов
   */
  async syncAllBars(units: UnitLike[]): Promise<void> {
    for (const unit of units) {
      if (!unit.owlbearTokenId) continue;
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

// ═══════════════════════════════════════════════════════════════
// NAMED EXPORT — синглтон, конструктор без side effects
// ═══════════════════════════════════════════════════════════════
export const tokenBarService = new TokenBarService();
