// src/services/tokenBarService.ts

import OBR, { buildShape, isShape, Item, Shape, Metadata } from "@owlbear-rodeo/sdk";

// ============================================================================
// ТИПЫ И КОНСТАНТЫ
// ============================================================================

interface TokenBarData {
  tokenId: string;
  barIds: string[];       // Все ID элементов баров
  lastHp: number;
  lastMaxHp: number;
  lastMana: number;
  lastMaxMana: number;
}

// Метаданные для идентификации наших элементов
const METADATA_KEY = "cursed-hearts/bar-data";
const EXTENSION_ID = "cursed-hearts-assistant";

// Хранилище данных о барах (in-memory)
const tokenBarsMap = new Map<string, TokenBarData>();

// Состояние сервиса
let isInitialized = false;
let unsubscribeItems: (() => void) | null = null;
let unsubscribeReady: (() => void) | null = null;

// Анимации пульсации
const pulseIntervals = new Map<string, ReturnType<typeof setInterval>>();

// ============================================================================
// ЦВЕТА ТЕМНОГО ФЭНТЕЗИ
// ============================================================================

const COLORS = {
  // HP бар - кровавые тона
  hpBackground: "#0d0404",
  hpFillHealthy: "#6b1515",
  hpFillDamaged: "#8b2020",
  hpFillCritical: "#b81c1c",
  hpFillDead: "#1a1a1a",
  hpBorder: "#2a1010",
  
  // Мана бар - магические тона
  manaBackground: "#040408",
  manaFill: "#1a2a4a",
  manaFillHigh: "#2a3a6a",
  manaBorder: "#101020",
  
  // Эффекты
  pulseLight: "#ff4444",
  pulseDark: "#991111",
};

// ============================================================================
// КОНФИГУРАЦИЯ РАЗМЕРОВ
// ============================================================================

const BAR_CONFIG = {
  hpHeight: 10,
  manaHeight: 6,
  spacing: 3,
  offsetY: 12,           // Отступ от нижнего края токена
  borderWidth: 2,
  widthRatio: 0.85,      // Ширина бара как % от ширины токена
  minWidth: 50,
  maxWidth: 180,
  cornerRadius: 0,       // RECTANGLE не поддерживает радиус
};

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Создаёт уникальный ID для элемента бара
 */
function makeBarId(tokenId: string, barType: string): string {
  return `${EXTENSION_ID}-${tokenId}-${barType}-${Date.now()}`;
}

/**
 * Получает цвет HP в зависимости от процента
 */
function getHpFillColor(percent: number): string {
  if (percent <= 0) return COLORS.hpFillDead;
  if (percent < 25) return COLORS.hpFillCritical;
  if (percent < 50) return COLORS.hpFillDamaged;
  return COLORS.hpFillHealthy;
}

/**
 * Вычисляет размеры и позиции баров на основе размера токена
 */
function calculateBarLayout(tokenWidth: number, tokenHeight: number) {
  const barWidth = Math.min(
    BAR_CONFIG.maxWidth,
    Math.max(BAR_CONFIG.minWidth, tokenWidth * BAR_CONFIG.widthRatio)
  );

  // Y координата: от центра токена вниз
  const baseY = (tokenHeight / 2) + BAR_CONFIG.offsetY;

  return {
    barWidth,
    hpY: baseY,
    manaY: baseY + BAR_CONFIG.hpHeight + BAR_CONFIG.spacing,
  };
}

/**
 * Вычисляет X позицию для fill бара (выравнивание слева)
 */
function calculateFillX(totalWidth: number, fillWidth: number): number {
  // Центр fill бара должен быть смещён так, чтобы левый край совпадал с левым краем фона
  // Левый край фона находится в -totalWidth/2
  // Левый край fill должен быть там же + небольшой отступ
  const leftEdge = -totalWidth / 2 + 1;
  return leftEdge + fillWidth / 2;
}

/**
 * Безопасно получает размеры токена
 */
function getTokenDimensions(token: Item): { width: number; height: number } {
  // Пробуем разные свойства в зависимости от типа токена
  const image = token as any;
  
  let width = 150;  // default
  let height = 150;
  
  if (image.image?.width) {
    width = image.image.width;
    height = image.image.height || width;
  } else if (image.width) {
    width = image.width;
    height = image.height || width;
  } else if (image.grid?.dpi) {
    width = image.grid.dpi;
    height = image.grid.dpi;
  }
  
  // Учитываем scale если есть
  if (image.scale) {
    width *= Math.abs(image.scale.x || 1);
    height *= Math.abs(image.scale.y || 1);
  }
  
  return { width, height };
}

// ============================================================================
// СОЗДАНИЕ БАРОВ
// ============================================================================

/**
 * Создаёт HP и Mana бары для указанного токена
 */
export async function createBars(
  tokenId: string,
  hp: number,
  maxHp: number,
  mana: number,
  maxMana: number
): Promise<void> {
  try {
    // Проверяем готовность сцены
    const ready = await OBR.scene.isReady();
    if (!ready) {
      console.warn("[TokenBars] Scene not ready");
      return;
    }

    // Получаем токен
    const tokens = await OBR.scene.items.getItems([tokenId]);
    if (tokens.length === 0) {
      console.warn(`[TokenBars] Token ${tokenId} not found`);
      return;
    }
    const token = tokens[0];

    // Удаляем старые бары если есть
    await removeBars(tokenId);

    // Вычисляем размеры
    const { width: tokenWidth, height: tokenHeight } = getTokenDimensions(token);
    const layout = calculateBarLayout(tokenWidth, tokenHeight);

    // Вычисляем проценты и ширину заполнения
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
    const manaPercent = maxMana > 0 ? Math.max(0, Math.min(100, (mana / maxMana) * 100)) : 0;

    const hpFillWidth = Math.max(1, (layout.barWidth - 2) * (hpPercent / 100));
    const manaFillWidth = Math.max(1, (layout.barWidth - 2) * (manaPercent / 100));

    // Видимость токена
    const isVisible = token.visible !== false;

    // Создаём элементы баров
    const shapesToCreate: Shape[] = [];
    const barIds: string[] = [];

    // ----- HP Background -----
    const hpBgId = makeBarId(tokenId, "hp-bg");
    barIds.push(hpBgId);
    shapesToCreate.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(layout.barWidth)
        .height(BAR_CONFIG.hpHeight)
        .position({ x: 0, y: layout.hpY })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(isVisible)
        .zIndex(10)
        .fillColor(COLORS.hpBackground)
        .strokeColor(COLORS.hpBorder)
        .strokeWidth(BAR_CONFIG.borderWidth)
        .name(`HP Bar BG [${tokenId.slice(-6)}]`)
        .metadata({ [METADATA_KEY]: { tokenId, type: "hp-bg" } })
        .build()
    );

    // ----- HP Fill -----
    if (hpPercent > 0) {
      const hpFillId = makeBarId(tokenId, "hp-fill");
      barIds.push(hpFillId);
      shapesToCreate.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(hpFillWidth)
          .height(BAR_CONFIG.hpHeight - 4)
          .position({ 
            x: calculateFillX(layout.barWidth, hpFillWidth), 
            y: layout.hpY 
          })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(isVisible)
          .zIndex(11)
          .fillColor(getHpFillColor(hpPercent))
          .strokeWidth(0)
          .name(`HP Bar Fill [${tokenId.slice(-6)}]`)
          .metadata({ [METADATA_KEY]: { tokenId, type: "hp-fill" } })
          .build()
      );
    }

    // ----- Mana Background -----
    const manaBgId = makeBarId(tokenId, "mana-bg");
    barIds.push(manaBgId);
    shapesToCreate.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(layout.barWidth)
        .height(BAR_CONFIG.manaHeight)
        .position({ x: 0, y: layout.manaY })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(isVisible)
        .zIndex(10)
        .fillColor(COLORS.manaBackground)
        .strokeColor(COLORS.manaBorder)
        .strokeWidth(1)
        .name(`Mana Bar BG [${tokenId.slice(-6)}]`)
        .metadata({ [METADATA_KEY]: { tokenId, type: "mana-bg" } })
        .build()
    );

    // ----- Mana Fill -----
    if (manaPercent > 0) {
      const manaFillId = makeBarId(tokenId, "mana-fill");
      barIds.push(manaFillId);
      shapesToCreate.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(manaFillWidth)
          .height(BAR_CONFIG.manaHeight - 2)
          .position({ 
            x: calculateFillX(layout.barWidth, manaFillWidth), 
            y: layout.manaY 
          })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(isVisible)
          .zIndex(11)
          .fillColor(manaPercent > 75 ? COLORS.manaFillHigh : COLORS.manaFill)
          .strokeWidth(0)
          .name(`Mana Bar Fill [${tokenId.slice(-6)}]`)
          .metadata({ [METADATA_KEY]: { tokenId, type: "mana-fill" } })
          .build()
      );
    }

    // Добавляем на сцену
    await OBR.scene.items.addItems(shapesToCreate);

    // Сохраняем в память
    tokenBarsMap.set(tokenId, {
      tokenId,
      barIds,
      lastHp: hp,
      lastMaxHp: maxHp,
      lastMana: mana,
      lastMaxMana: maxMana,
    });

    // Запускаем пульсацию при критическом HP
    if (hpPercent > 0 && hpPercent < 25) {
      startPulseAnimation(tokenId);
    }

    console.log(`[TokenBars] ✓ Created bars for token ${tokenId.slice(-8)}`);

  } catch (error) {
    console.error("[TokenBars] Error creating bars:", error);
  }
}

// ============================================================================
// ОБНОВЛЕНИЕ БАРОВ
// ============================================================================

/**
 * Обновляет HP и Mana бары для указанного токена
 */
export async function updateBars(
  tokenId: string,
  hp: number,
  maxHp: number,
  mana: number,
  maxMana: number
): Promise<void> {
  try {
    const ready = await OBR.scene.isReady();
    if (!ready) return;

    const barData = tokenBarsMap.get(tokenId);
    
    // Если баров нет - создаём
    if (!barData) {
      await createBars(tokenId, hp, maxHp, mana, maxMana);
      return;
    }

    // Проверяем, изменились ли значения
    if (
      barData.lastHp === hp &&
      barData.lastMaxHp === maxHp &&
      barData.lastMana === mana &&
      barData.lastMaxMana === maxMana
    ) {
      return; // Ничего не изменилось
    }

    // Пересоздаём бары (проще и надёжнее чем частичное обновление)
    await createBars(tokenId, hp, maxHp, mana, maxMana);

  } catch (error) {
    console.error("[TokenBars] Error updating bars:", error);
  }
}

// ============================================================================
// УДАЛЕНИЕ БАРОВ
// ============================================================================

/**
 * Удаляет бары для указанного токена
 */
export async function removeBars(tokenId: string): Promise<void> {
  try {
    const ready = await OBR.scene.isReady();
    if (!ready) return;

    // Останавливаем анимации
    stopPulseAnimation(tokenId);

    // Получаем все элементы сцены с нашими метаданными
    const allItems = await OBR.scene.items.getItems();
    const idsToDelete = allItems
      .filter(item => {
        const meta = item.metadata?.[METADATA_KEY] as any;
        return meta?.tokenId === tokenId;
      })
      .map(item => item.id);

    if (idsToDelete.length > 0) {
      await OBR.scene.items.deleteItems(idsToDelete);
    }

    // Очищаем память
    tokenBarsMap.delete(tokenId);

    console.log(`[TokenBars] ✓ Removed bars for token ${tokenId.slice(-8)}`);

  } catch (error) {
    console.error("[TokenBars] Error removing bars:", error);
  }
}

/**
 * Удаляет ВСЕ бары с расширения
 */
export async function removeAllBars(): Promise<void> {
  try {
    const ready = await OBR.scene.isReady();
    if (!ready) return;

    // Останавливаем все анимации
    for (const tokenId of pulseIntervals.keys()) {
      stopPulseAnimation(tokenId);
    }

    // Находим все наши элементы по метаданным
    const allItems = await OBR.scene.items.getItems();
    const idsToDelete = allItems
      .filter(item => item.metadata?.[METADATA_KEY] !== undefined)
      .map(item => item.id);

    if (idsToDelete.length > 0) {
      await OBR.scene.items.deleteItems(idsToDelete);
      console.log(`[TokenBars] ✓ Removed ${idsToDelete.length} bar elements`);
    }

    // Очищаем память
    tokenBarsMap.clear();

  } catch (error) {
    console.error("[TokenBars] Error removing all bars:", error);
  }
}

// ============================================================================
// СИНХРОНИЗАЦИЯ
// ============================================================================

/**
 * Синхронизирует бары со списком персонажей
 */
export async function syncAllBars(
  characters: Array<{
    id: string;
    tokenId?: string;
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
  }>,
  showBars: boolean
): Promise<void> {
  try {
    const ready = await OBR.scene.isReady();
    if (!ready) return;

    // Если бары отключены - удаляем все
    if (!showBars) {
      await removeAllBars();
      return;
    }

    // Собираем активные tokenId
    const activeTokenIds = new Set<string>();
    for (const char of characters) {
      if (char.tokenId) {
        activeTokenIds.add(char.tokenId);
      }
    }

    // Удаляем бары для неактивных токенов
    for (const tokenId of tokenBarsMap.keys()) {
      if (!activeTokenIds.has(tokenId)) {
        await removeBars(tokenId);
      }
    }

    // Создаём/обновляем бары для активных персонажей
    for (const char of characters) {
      if (!char.tokenId) continue;
      
      await updateBars(
        char.tokenId,
        char.hp,
        char.maxHp,
        char.mana,
        char.maxMana
      );
    }

    console.log(`[TokenBars] ✓ Synced bars for ${activeTokenIds.size} characters`);

  } catch (error) {
    console.error("[TokenBars] Error syncing bars:", error);
  }
}

// ============================================================================
// АНИМАЦИИ
// ============================================================================

/**
 * Запускает анимацию пульсации при критическом HP
 */
function startPulseAnimation(tokenId: string): void {
  // Не запускаем повторно
  if (pulseIntervals.has(tokenId)) return;

  let toggle = false;

  const interval = setInterval(async () => {
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        stopPulseAnimation(tokenId);
        return;
      }

      toggle = !toggle;

      // Находим fill элемент HP
      const allItems = await OBR.scene.items.getItems();
      const hpFill = allItems.find(item => {
        const meta = item.metadata?.[METADATA_KEY] as any;
        return meta?.tokenId === tokenId && meta?.type === "hp-fill";
      });

      if (hpFill && isShape(hpFill)) {
        await OBR.scene.items.updateItems([hpFill.id], (items) => {
          for (const item of items) {
            if (isShape(item)) {
              item.style.fillColor = toggle ? COLORS.pulseLight : COLORS.pulseDark;
            }
          }
        });
      }
    } catch {
      stopPulseAnimation(tokenId);
    }
  }, 600);

  pulseIntervals.set(tokenId, interval);
}

/**
 * Останавливает анимацию пульсации
 */
function stopPulseAnimation(tokenId: string): void {
  const interval = pulseIntervals.get(tokenId);
  if (interval) {
    clearInterval(interval);
    pulseIntervals.delete(tokenId);
  }
}

// ============================================================================
// ОБРАБОТКА ИЗМЕНЕНИЙ СЦЕНЫ
// ============================================================================

/**
 * Обработчик изменений элементов на сцене
 */
async function handleSceneItemsChange(items: Item[]): Promise<void> {
  try {
    // Собираем ID всех существующих элементов
    const existingIds = new Set(items.map(item => item.id));

    // Проверяем удалённые токены
    for (const tokenId of tokenBarsMap.keys()) {
      if (!existingIds.has(tokenId)) {
        // Токен был удалён - удаляем бары
        console.log(`[TokenBars] Token ${tokenId.slice(-8)} was deleted, removing bars`);
        await removeBars(tokenId);
      }
    }

    // Обновляем видимость баров при изменении видимости токена
    for (const item of items) {
      if (!tokenBarsMap.has(item.id)) continue;

      const barItems = items.filter(i => {
        const meta = i.metadata?.[METADATA_KEY] as any;
        return meta?.tokenId === item.id;
      });

      if (barItems.length > 0) {
        const barIds = barItems.map(b => b.id);
        const shouldBeVisible = item.visible !== false;

        await OBR.scene.items.updateItems(barIds, (updateItems) => {
          for (const barItem of updateItems) {
            barItem.visible = shouldBeVisible;
          }
        });
      }
    }

  } catch (error) {
    console.error("[TokenBars] Error handling scene change:", error);
  }
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ И ОЧИСТКА
// ============================================================================

/**
 * Инициализирует сервис токен-баров
 */
export async function initialize(): Promise<void> {
  try {
    if (isInitialized) {
      console.log("[TokenBars] Already initialized");
      return;
    }

    const ready = await OBR.scene.isReady();
    
    if (!ready) {
      console.log("[TokenBars] Scene not ready, waiting...");
      
      // Подписываемся на готовность сцены
      unsubscribeReady = OBR.scene.onReadyChange(async (isReady) => {
        if (isReady && !isInitialized) {
          console.log("[TokenBars] Scene became ready, initializing...");
          await doInitialize();
        }
      });
      return;
    }

    await doInitialize();

  } catch (error) {
    console.error("[TokenBars] Initialization error:", error);
  }
}

/**
 * Внутренняя инициализация (когда сцена готова)
 */
async function doInitialize(): Promise<void> {
  // Подписываемся на изменения элементов сцены
  unsubscribeItems = OBR.scene.items.onChange(handleSceneItemsChange);
  
  isInitialized = true;
  console.log("[TokenBars] ✓ Initialized successfully");
}

/**
 * Очищает сервис (вызывать при размонтировании)
 */
export function cleanup(): void {
  // Отписываемся от событий
  if (unsubscribeItems) {
    unsubscribeItems();
    unsubscribeItems = null;
  }
  if (unsubscribeReady) {
    unsubscribeReady();
    unsubscribeReady = null;
  }

  // Останавливаем все анимации
  for (const tokenId of pulseIntervals.keys()) {
    stopPulseAnimation(tokenId);
  }

  // Очищаем память (бары на сцене остаются!)
  tokenBarsMap.clear();
  
  isInitialized = false;
  console.log("[TokenBars] ✓ Cleaned up");
}

// ============================================================================
// ЭКСПОРТ
// ============================================================================

export const tokenBarService = {
  initialize,
  cleanup,
  createBars,
  updateBars,
  removeBars,
  removeAllBars,
  syncAllBars,
};

export default tokenBarService;
