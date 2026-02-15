// src/services/tokenBarService.ts

import OBR, { buildShape, isShape } from "@owlbear-rodeo/sdk";
import type { Unit } from "@/types";

const BAR_HEIGHT = 8;
const BAR_WIDTH = 100;
const BUBBLE_COUNT = 5;
const SPARK_COUNT = 6;

// Уникальный префикс для всех наших фигур
const META_PREFIX = "cursed-hearts-bar-";

// Глобальные интервалы для анимаций (по unitId)
const animationIntervals = new Map<string, NodeJS.Timeout[]>();

function clearAnimations(unitId: string) {
  const intervals = animationIntervals.get(unitId);
  if (intervals) {
    intervals.forEach(clearInterval);
    animationIntervals.delete(unitId);
  }
}

async function isSceneReady() {
  try {
    return await OBR.scene.isReady();
  } catch {
    return false;
  }
}

export class TokenBarService {
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    // Никаких side effects здесь — только регистрация слушателей, если нужно
    this.initialized = true;
  }

  private async safeUpdateItems(ids: string[], updater: (items: any[]) => void) {
    if (!(await isSceneReady())) return;
    try {
      await OBR.scene.items.updateItems(ids, updater);
    } catch (e) {
      console.warn("Failed to update token bars:", e);
    }
  }

  private async safeAddItems(items: any[]) {
    if (!(await isSceneReady())) return;
    try {
      await OBR.scene.items.addItems(items);
    } catch (e) {
      console.warn("Failed to add token bars:", e);
    }
  }

  private async safeDeleteItems(ids: string[]) {
    if (!(await isSceneReady())) return;
    try {
      await OBR.scene.items.deleteItems(ids);
    } catch (e) {
      console.warn("Failed to delete token bars:", e);
    }
  }

  private getBarIds(unitId: string): string[] {
    const ids = [
      `${unitId}-hp-bg`,
      `${unitId}-hp-fill`,
      `${unitId}-mana-bg`,
      `${unitId}-mana-fill`,
    ];
    for (let i = 1; i <= BUBBLE_COUNT; i++) {
      ids.push(`${unitId}-hp-bubble-${i}`);
    }
    for (let i = 1; i <= SPARK_COUNT; i++) {
      ids.push(`${unitId}-mana-spark-${i}`);
    }
    ids.push(`${unitId}-hp-shine-1`, `${unitId}-hp-shine-2`);
    ids.push(`${unitId}-mana-shimmer`);
    for (let i = 1; i <= 3; i++) {
      ids.push(`${unitId}-hp-drip-${i}`);
    }
    for (let i = 1; i <= 4; i++) {
      ids.push(`${unitId}-hp-crack-${i}`);
    }
    return ids;
  }

  async deleteBars(unitId: string) {
    clearAnimations(unitId);
    const ids = this.getBarIds(unitId);
    await this.safeDeleteItems(ids);
  }

  async createOrUpdateBars(unit: Unit) {
    if (!unit.owlbearTokenId) return;

    const { current: hp, max: hpMax } = unit.health;
    const { current: mana, max: manaMax } = unit.mana;
    const tokenId = unit.owlbearTokenId;

    // Удаляем старые бары, если есть
    await this.deleteBars(unit.id);

    const items = [];
    const dpi = await OBR.scene.grid.getDpi();

    // === HP BG (сосуд) ===
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH)
        .height(BAR_HEIGHT)
        .position({ x: 0, y: 60 }) // над токеном
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(1)
        .name(`${unit.id}-hp-bg`)
        .metadata({ [META_PREFIX]: "hp-bg" })
        .fillColor("#2a0a0a") // тёмно-бордовый
        .strokeColor("#3a1818")
        .strokeWidth(1)
        .build()
    );

    // === HP FILL (кровь) ===
    const hpPercent = hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
    const hpFillWidth = BAR_WIDTH * hpPercent;
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(hpFillWidth)
        .height(BAR_HEIGHT - 2)
        .position({ x: 1, y: 61 })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(2)
        .name(`${unit.id}-hp-fill`)
        .metadata({ [META_PREFIX]: "hp-fill" })
        .fillColor(hp <= 0 ? "#000000" : "#cc2222") // чёрный при смерти
        .strokeColor("transparent")
        .strokeWidth(0)
        .build()
    );

    // === HP SHINES (блики) ===
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(8)
        .height(2)
        .position({ x: 20, y: 62 })
        .rotation(45)
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(3)
        .name(`${unit.id}-hp-shine-1`)
        .metadata({ [META_PREFIX]: "hp-shine" })
        .fillColor("#ffffff")
        .strokeColor("transparent")
        .strokeWidth(0)
        .build(),
      buildShape()
        .shapeType("RECTANGLE")
        .width(6)
        .height(2)
        .position({ x: 70, y: 63 })
        .rotation(-30)
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(3)
        .name(`${unit.id}-hp-shine-2`)
        .metadata({ [META_PREFIX]: "hp-shine" })
        .fillColor("#ffffff")
        .strokeColor("transparent")
        .strokeWidth(0)
        .build()
    );

    // === HP BUBBLES ===
    for (let i = 1; i <= BUBBLE_COUNT; i++) {
      const x = 5 + (i - 1) * 18;
      items.push(
        buildShape()
          .shapeType("CIRCLE")
          .radius(2)
          .position({ x, y: 64 })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(hp > 0 && hpPercent > 0.1), // не показываем при почти пустом
          .zIndex(3)
          .name(`${unit.id}-hp-bubble-${i}`)
          .metadata({ [META_PREFIX]: "hp-bubble" })
          .fillColor("#ff6666")
          .strokeColor("transparent")
          .strokeWidth(0)
          .build()
      );
    }

    // === HP DRIPS (при HP < 25%) ===
    if (hp > 0 && hpPercent < 0.25) {
      for (let i = 1; i <= 3; i++) {
        const x = 10 + i * 25;
        items.push(
          buildShape()
            .shapeType("CIRCLE")
            .radius(1.5)
            .position({ x, y: 69 })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(true)
            .zIndex(1)
            .name(`${unit.id}-hp-drip-${i}`)
            .metadata({ [META_PREFIX]: "hp-drip" })
            .fillColor("#cc2222")
            .strokeColor("transparent")
            .strokeWidth(0)
            .build()
        );
      }
    }

    // === HP CRACKS (при HP <= 0) ===
    if (hp <= 0) {
      const cracks = [
        { x1: 10, y1: 62, x2: 20, y2: 66 },
        { x1: 30, y1: 60, x2: 40, y2: 68 },
        { x1: 50, y1: 63, x2: 60, y2: 61 },
        { x1: 70, y1: 60, x2: 80, y2: 67 },
      ];
      cracks.forEach((crack, i) => {
        items.push(
          buildShape()
            .shapeType("LINE")
            .start({ x: crack.x1, y: crack.y1 })
            .end({ x: crack.x2, y: crack.y2 })
            .attachedTo(tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(true)
            .zIndex(4)
            .name(`${unit.id}-hp-crack-${i + 1}`)
            .metadata({ [META_PREFIX]: "hp-crack" })
            .strokeColor("#ffffff")
            .strokeWidth(1)
            .build()
        );
      });
    }

    // === MANA BG (кристалл-ромб) ===
    // Рисуем ромб как 4 линии
    const manaY = 72;
    const points = [
      { x: 50, y: manaY },     // top
      { x: 100, y: manaY + 6 }, // right
      { x: 50, y: manaY + 12 }, // bottom
      { x: 0, y: manaY + 6 },   // left
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
          .name(`${unit.id}-mana-bg-line-${i}`)
          .metadata({ [META_PREFIX]: "mana-bg" })
          .strokeColor("#2a2a5a")
          .strokeWidth(1)
          .build()
      );
    }

    // === MANA FILL (внутри ромба) ===
    const manaPercent = manaMax > 0 ? Math.max(0, Math.min(1, mana / manaMax)) : 0;
    if (manaPercent > 0) {
      // Заполняем ромб по высоте
      const fillHeight = 12 * manaPercent;
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(80)
          .height(fillHeight)
          .position({ x: 10, y: manaY + 12 - fillHeight })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(2)
          .name(`${unit.id}-mana-fill`)
          .metadata({ [META_PREFIX]: "mana-fill" })
          .fillColor("#4488ff")
          .strokeColor("transparent")
          .strokeWidth(0)
          .build()
      );
    }

    // === MANA SPARKS ===
    for (let i = 1; i <= SPARK_COUNT; i++) {
      const x = 10 + (i - 1) * 15;
      const y = manaY - 3;
      items.push(
        buildShape()
          .shapeType("CIRCLE")
          .radius(1)
          .position({ x, y })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(mana > 0),
          .zIndex(3)
          .name(`${unit.id}-mana-spark-${i}`)
          .metadata({ [META_PREFIX]: "mana-spark" })
          .fillColor("#aaffff")
          .strokeColor("transparent")
          .strokeWidth(0)
          .build()
      );
    }

    // === MANA SHIMMER (бегущий блик) ===
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(6)
        .height(2)
        .position({ x: 30, y: manaY + 2 })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(mana > 0),
        .zIndex(3)
        .name(`${unit.id}-mana-shimmer`)
        .metadata({ [META_PREFIX]: "mana-shimmer" })
        .fillColor("#ffffff")
        .strokeColor("transparent")
        .strokeWidth(0)
        .build()
    );

    await this.safeAddItems(items);

    // === ЗАПУСК АНИМАЦИЙ ===
    if (hp > 0) {
      this.startHpAnimations(unit.id, tokenId, hpPercent);
    }
    if (mana > 0) {
      this.startManaAnimations(unit.id, tokenId);
    }
  }

  private startHpAnimations(unitId: string, tokenId: string, hpPercent: number) {
    const intervals: NodeJS.Timeout[] = [];

    // Анимация пузырьков: подъём вверх и обратно
    if (hpPercent > 0.1) {
      for (let i = 1; i <= BUBBLE_COUNT; i++) {
        const bubbleId = `${unitId}-hp-bubble-${i}`;
        let offset = 0;
        let direction = 1;
        const interval = setInterval(async () => {
          if (!(await isSceneReady())) return;
          offset += direction * 0.3;
          if (offset > 2 || offset < 0) {
            direction *= -1;
            offset = Math.max(0, Math.min(2, offset));
          }
          try {
            await OBR.scene.items.updateItems([bubbleId], (items) => {
              for (const item of items) {
                if (isShape(item)) {
                  item.position.y = 64 - offset;
                }
              }
            });
          } catch (e) {
            clearInterval(interval);
          }
        }, 100);
        intervals.push(interval);
      }
    }

    // Пульсация при HP < 25%
    if (hpPercent < 0.25) {
      const fillId = `${unitId}-hp-fill`;
      let pulse = 0;
      const interval = setInterval(async () => {
        if (!(await isSceneReady())) return;
        pulse = (pulse + 0.1) % (Math.PI * 2);
        const scale = 1 + 0.05 * Math.sin(pulse);
        try {
          await OBR.scene.items.updateItems([fillId], (items) => {
            for (const item of items) {
              if (isShape(item)) {
                item.width = BAR_WIDTH * hpPercent * scale;
              }
            }
          });
        } catch (e) {
          clearInterval(interval);
        }
      }, 100);
      intervals.push(interval);
    }

    animationIntervals.set(unitId, intervals);
  }

  private startManaAnimations(unitId: string, tokenId: string) {
    const intervals: NodeJS.Timeout[] = [];

    // Анимация искр: мерцание
    for (let i = 1; i <= SPARK_COUNT; i++) {
      const sparkId = `${unitId}-mana-spark-${i}`;
      const interval = setInterval(async () => {
        if (!(await isSceneReady())) return;
        const opacity = Math.random() > 0.7 ? 1 : 0.3;
        try {
          await OBR.scene.items.updateItems([sparkId], (items) => {
            for (const item of items) {
              if (isShape(item)) {
                item.style.fillColor = opacity === 1 ? "#aaffff" : "#66aaff";
              }
            }
          });
        } catch (e) {
          clearInterval(interval);
        }
      }, 300 + Math.random() * 400);
      intervals.push(interval);
    }

    // Анимация блика: движение слева направо
    const shimmerId = `${unitId}-mana-shimmer`;
    let shimmerX = 30;
    const interval = setInterval(async () => {
      if (!(await isSceneReady())) return;
      shimmerX += 0.5;
      if (shimmerX > 90) shimmerX = 30;
      try {
        await OBR.scene.items.updateItems([shimmerId], (items) => {
          for (const item of items) {
            if (isShape(item)) {
              item.position.x = shimmerX;
            }
          }
        });
      } catch (e) {
        clearInterval(interval);
      }
    }, 50);
    intervals.push(interval);

    animationIntervals.set(unitId, intervals);
  }

  async updateBars(unit: Unit) {
    if (!unit.owlbearTokenId) return;
    await this.createOrUpdateBars(unit); // Проще пересоздать, чем обновлять все параметры
  }
}

// Экспортируем синглтон
export const tokenBarService = new TokenBarService();
