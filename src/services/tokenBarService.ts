// src/services/tokenBarService.ts
// ═══════════════════════════════════════════════════════════════
// Token Bar Service — рисует HP/Mana бары прямо на токенах в OBR
// Использует ТОЛЬКО документированные методы buildShape API
// ═══════════════════════════════════════════════════════════════

import OBR, { buildShape, isShape, Item } from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "cursed-hearts-assistant";
const META_KEY = `${EXTENSION_ID}/token-bar`;

/** Метаданные, зашитые в каждый bar-shape */
interface TokenBarMeta {
  tokenId: string;
  barType: "hp" | "mana";
  role: "bg" | "fill";
}

// ── Константы визуала ──────────────────────────────────────────
const BAR_WIDTH = 100;
const BAR_HEIGHT = 8;
const HP_Y_OFFSET = 55;
const MANA_Y_OFFSET = 67;

const HP_COLORS = {
  high: "#22cc44",
  mid: "#ccaa22",
  low: "#cc2222",
  bg: "#3a1818",
  border: "#661111",
};

const MANA_COLORS = {
  fill: "#4488cc",
  bg: "#1a2a3a",
  border: "#224466",
};

// ════════════════════════════════════════════════════════════════
class TokenBarService {
  private initialized = false;
  private enabled = true;

  // ✅ Конструктор БЕЗ side effects — безопасно для top-level import
  constructor() {}

  // ── Инициализация (вызывать ТОЛЬКО после OBR.onReady) ────────
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        console.log("[TokenBarService] Scene not ready yet, skipping init");
        return;
      }
      this.initialized = true;
      console.log("[TokenBarService] Initialized successfully");
    } catch (e) {
      console.warn("[TokenBarService] Init error (non-fatal):", e);
    }
  }

  // ── Включение/выключение ─────────────────────────────────────
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.removeAllBars().catch(() => {});
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ── Проверка готовности сцены ────────────────────────────────
  private async ensureReady(): Promise<boolean> {
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return false;
      if (!this.initialized) {
        await this.initialize();
      }
      return this.initialized;
    } catch {
      return false;
    }
  }

  // ── Чтение метаданных из item ────────────────────────────────
  private getBarMeta(item: Item): TokenBarMeta | null {
    try {
      const meta = item.metadata?.[META_KEY];
      if (
        meta &&
        typeof meta === "object" &&
        "tokenId" in (meta as object) &&
        "barType" in (meta as object) &&
        "role" in (meta as object)
      ) {
        return meta as TokenBarMeta;
      }
    } catch {
      // metadata corrupted — ignore
    }
    return null;
  }

  // ── Поиск существующих баров для токена ──────────────────────
  private async findBars(
    tokenId: string,
    barType: "hp" | "mana"
  ): Promise<{ bgItem: Item | null; fillItem: Item | null }> {
    const items = await OBR.scene.items.getItems();
    let bgItem: Item | null = null;
    let fillItem: Item | null = null;

    for (const item of items) {
      const meta = this.getBarMeta(item);
      if (!meta) continue;
      if (meta.tokenId !== tokenId || meta.barType !== barType) continue;
      if (meta.role === "bg") bgItem = item;
      if (meta.role === "fill") fillItem = item;
    }

    return { bgItem, fillItem };
  }

  // ── Цвет HP в зависимости от процента ────────────────────────
  private getHpColor(ratio: number): string {
    if (ratio > 0.5) return HP_COLORS.high;
    if (ratio > 0.25) return HP_COLORS.mid;
    return HP_COLORS.low;
  }

  // ════════════════════════════════════════════════════════════════
  // ОСНОВНЫЕ ПУБЛИЧНЫЕ МЕТОДЫ
  // ════════════════════════════════════════════════════════════════

  /** Обновить (или создать) один бар на токене */
  async updateBar(
    tokenId: string,
    current: number,
    max: number,
    barType: "hp" | "mana"
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      if (!(await this.ensureReady())) return;

      const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
      const yOffset = barType === "hp" ? HP_Y_OFFSET : MANA_Y_OFFSET;

      const fillColor =
        barType === "hp" ? this.getHpColor(ratio) : MANA_COLORS.fill;
      const bgColor = barType === "hp" ? HP_COLORS.bg : MANA_COLORS.bg;
      const borderColor =
        barType === "hp" ? HP_COLORS.border : MANA_COLORS.border;

      const { bgItem, fillItem } = await this.findBars(tokenId, barType);

      if (bgItem && fillItem) {
        // ── Оба бара существуют → обновляем fill ──────────────
        await OBR.scene.items.updateItems([fillItem.id], (items) => {
          for (const item of items) {
            if (isShape(item)) {
              item.width = Math.max(1, BAR_WIDTH * ratio);
              item.style.fillColor = fillColor;
            }
          }
        });
      } else {
        // ── Нет баров (или частичные) → пересоздаём оба ───────
        const toDelete: string[] = [];
        if (bgItem) toDelete.push(bgItem.id);
        if (fillItem) toDelete.push(fillItem.id);
        if (toDelete.length > 0) {
          await OBR.scene.items.deleteItems(toDelete);
        }

        // Фон бара
        const bgShape = buildShape()
          .shapeType("RECTANGLE")
          .width(BAR_WIDTH)
          .height(BAR_HEIGHT)
          .position({ x: -BAR_WIDTH / 2, y: yOffset })
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
            [META_KEY]: {
              tokenId,
              barType,
              role: "bg",
            } satisfies TokenBarMeta,
          })
          .build();

        // Заполнение бара
        const fillShape = buildShape()
          .shapeType("RECTANGLE")
          .width(Math.max(1, BAR_WIDTH * ratio))
          .height(BAR_HEIGHT)
          .position({ x: -BAR_WIDTH / 2, y: yOffset })
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
            [META_KEY]: {
              tokenId,
              barType,
              role: "fill",
            } satisfies TokenBarMeta,
          })
          .build();

        await OBR.scene.items.addItems([bgShape, fillShape]);
      }
    } catch (e) {
      // Ошибка НЕ должна крашить приложение
      console.warn(`[TokenBarService] updateBar(${barType}) failed:`, e);
    }
  }

  /** Обновить HP + Mana бары для юнита */
  async updateUnitBars(unit: {
    owlbearTokenId?: string;
    health: { current: number; max: number };
    mana: { current: number; max: number };
  }): Promise<void> {
    if (!unit.owlbearTokenId) return;

    await this.updateBar(
      unit.owlbearTokenId,
      unit.health.current,
      unit.health.max,
      "hp"
    );
    await this.updateBar(
      unit.owlbearTokenId,
      unit.mana.current,
      unit.mana.max,
      "mana"
    );
  }

  /** Удалить все бары конкретного токена */
  async removeBarsForToken(tokenId: string): Promise<void> {
    try {
      if (!(await this.ensureReady())) return;

      const items = await OBR.scene.items.getItems();
      const toDelete = items
        .filter((item) => {
          const meta = this.getBarMeta(item);
          return meta !== null && meta.tokenId === tokenId;
        })
        .map((i) => i.id);

      if (toDelete.length > 0) {
        await OBR.scene.items.deleteItems(toDelete);
      }
    } catch (e) {
      console.warn("[TokenBarService] removeBarsForToken failed:", e);
    }
  }

  /** Удалить ВСЕ бары расширения со сцены */
  async removeAllBars(): Promise<void> {
    try {
      if (!(await this.ensureReady())) return;

      const items = await OBR.scene.items.getItems();
      const toDelete = items
        .filter((item) => this.getBarMeta(item) !== null)
        .map((i) => i.id);

      if (toDelete.length > 0) {
        await OBR.scene.items.deleteItems(toDelete);
        console.log(`[TokenBarService] Removed ${toDelete.length} bar shapes`);
      }
    } catch (e) {
      console.warn("[TokenBarService] removeAllBars failed:", e);
    }
  }

  /** Обновить бары для ВСЕХ юнитов из массива */
  async refreshAllUnits(
    units: Array<{
      owlbearTokenId?: string;
      health: { current: number; max: number };
      mana: { current: number; max: number };
    }>
  ): Promise<void> {
    for (const unit of units) {
      await this.updateUnitBars(unit);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Синглтон — конструктор БЕЗ side effects, безопасен для импорта
// ═══════════════════════════════════════════════════════════════
const tokenBarService = new TokenBarService();
export default tokenBarService;
