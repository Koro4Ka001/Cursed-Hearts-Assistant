// src/services/tokenBarService.ts

import OBR, { 
  buildShape, 
  Item, 
  isImage, 
  isShape,
  Shape,
  Image
} from "@owlbear-rodeo/sdk";

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

const EXTENSION_ID = "cursed-hearts-assistant";
const BAR_TAG = `${EXTENSION_ID}/token-bar`;

// Размеры и отступы баров
const CONFIG = {
  BAR_HEIGHT: 6,
  BAR_GAP: 2,
  BAR_OFFSET_FROM_TOKEN: 8,
  MIN_BAR_WIDTH: 40,
  MAX_BAR_WIDTH: 120,
  BAR_WIDTH_RATIO: 0.85, // 85% от ширины токена
  
  // Цвета HP
  HP_BG_COLOR: "#1a0505",
  HP_BG_STROKE: "#4a1515",
  HP_FILL_NORMAL: "#8b0000",
  HP_FILL_LOW: "#ff0000",
  HP_LOW_THRESHOLD: 0.25,
  
  // Цвета Mana
  MANA_BG_COLOR: "#050510",
  MANA_BG_STROKE: "#151540",
  MANA_FILL_COLOR: "#1e3a8a",
  
  // Z-индексы (чтобы fill был поверх background)
  Z_INDEX_BG: 1,
  Z_INDEX_FILL: 2,
} as const;

// ============================================================================
// ТИПЫ
// ============================================================================

interface BarElements {
  hpBackgroundId: string;
  hpFillId: string;
  manaBackgroundId: string;
  manaFillId: string;
}

interface CharacterBarData {
  characterId: string;
  tokenId: string;
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
}

// ============================================================================
// СЕРВИС
// ============================================================================

class TokenBarService {
  // Карта: characterId -> элементы баров
  private characterBars: Map<string, BarElements> = new Map();
  
  // Отписка от событий OBR
  private unsubscribeItems: (() => void) | null = null;
  
  // Флаг инициализации
  private isInitialized = false;

  // ==========================================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("[TokenBarService] Already initialized");
      return;
    }

    try {
      const isReady = await OBR.scene.isReady();
      if (!isReady) {
        console.log("[TokenBarService] Scene not ready, waiting...");
        // Подписываемся на готовность сцены
        OBR.scene.onReadyChange(async (ready) => {
          if (ready && !this.isInitialized) {
            await this.doInitialize();
          }
        });
        return;
      }

      await this.doInitialize();
    } catch (error) {
      console.error("[TokenBarService] Failed to initialize:", error);
    }
  }

  private async doInitialize(): Promise<void> {
    try {
      // Очищаем старые бары (если остались от прошлой сессии)
      await this.cleanupOrphanedBars();
      
      // Подписываемся на изменения элементов на сцене
      this.unsubscribeItems = OBR.scene.items.onChange(
        this.handleSceneItemsChange.bind(this)
      );
      
      this.isInitialized = true;
      console.log("[TokenBarService] Initialized successfully");
    } catch (error) {
      console.error("[TokenBarService] doInitialize failed:", error);
    }
  }

  // ==========================================================================
  // СОЗДАНИЕ БАРОВ
  // ==========================================================================

  async createBars(data: CharacterBarData): Promise<void> {
    try {
      const isReady = await OBR.scene.isReady();
      if (!isReady) {
        console.warn("[TokenBarService] Cannot create bars - scene not ready");
        return;
      }

      // Удаляем существующие бары для этого персонажа
      await this.removeBars(data.characterId);

      // Получаем токен
      const items = await OBR.scene.items.getItems([data.tokenId]);
      if (items.length === 0) {
        console.warn(`[TokenBarService] Token not found: ${data.tokenId}`);
        return;
      }

      const token = items[0];
      if (!isImage(token)) {
        console.warn(`[TokenBarService] Item is not an image: ${data.tokenId}`);
        return;
      }

      // Вычисляем размеры
      const tokenWidth = token.image.width * token.scale.x;
      const tokenHeight = token.image.height * token.scale.y;
      
      // Ширина бара адаптируется под размер токена
      const barWidth = Math.min(
        CONFIG.MAX_BAR_WIDTH,
        Math.max(CONFIG.MIN_BAR_WIDTH, tokenWidth * CONFIG.BAR_WIDTH_RATIO)
      );

      // Проценты заполнения
      const hpPercent = Math.max(0, Math.min(1, data.hp / Math.max(1, data.maxHp)));
      const manaPercent = Math.max(0, Math.min(1, data.mana / Math.max(1, data.maxMana)));

      // Позиционирование (относительно ЦЕНТРА токена, т.к. используем attachedTo)
      // Бар должен быть ПОД токеном, центрирован по X
      // position - это ВЕРХНИЙ ЛЕВЫЙ угол прямоугольника
      
      const hpBarY = tokenHeight / 2 + CONFIG.BAR_OFFSET_FROM_TOKEN;
      const manaBarY = hpBarY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP;
      
      // X координата - центрируем бар (левый край = -половина ширины)
      const barX = -barWidth / 2;

      // Генерируем уникальные ID
      const timestamp = Date.now();
      const ids: BarElements = {
        hpBackgroundId: `${BAR_TAG}/hp-bg/${data.characterId}/${timestamp}`,
        hpFillId: `${BAR_TAG}/hp-fill/${data.characterId}/${timestamp}`,
        manaBackgroundId: `${BAR_TAG}/mana-bg/${data.characterId}/${timestamp}`,
        manaFillId: `${BAR_TAG}/mana-fill/${data.characterId}/${timestamp}`,
      };

      // Определяем цвет HP (красный при низком HP)
      const hpFillColor = hpPercent <= CONFIG.HP_LOW_THRESHOLD 
        ? CONFIG.HP_FILL_LOW 
        : CONFIG.HP_FILL_NORMAL;

      // Создаём элементы
      const shapesToAdd: Shape[] = [];

      // --- HP Background ---
      shapesToAdd.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: barX, y: hpBarY })
          .attachedTo(data.tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(token.visible)
          .fillColor(CONFIG.HP_BG_COLOR)
          .strokeColor(CONFIG.HP_BG_STROKE)
          .strokeWidth(1)
          .zIndex(CONFIG.Z_INDEX_BG)
          .id(ids.hpBackgroundId)
          .metadata({ [EXTENSION_ID]: { type: "hp-bg", characterId: data.characterId } })
          .build()
      );

      // --- HP Fill ---
      const hpFillWidth = Math.max(0, (barWidth - 2) * hpPercent);
      if (hpFillWidth > 0) {
        shapesToAdd.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(hpFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position({ x: barX + 1, y: hpBarY + 1 })
            .attachedTo(data.tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(hpFillColor)
            .strokeWidth(0)
            .zIndex(CONFIG.Z_INDEX_FILL)
            .id(ids.hpFillId)
            .metadata({ [EXTENSION_ID]: { type: "hp-fill", characterId: data.characterId } })
            .build()
        );
      }

      // --- Mana Background ---
      shapesToAdd.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(barWidth)
          .height(CONFIG.BAR_HEIGHT)
          .position({ x: barX, y: manaBarY })
          .attachedTo(data.tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(token.visible)
          .fillColor(CONFIG.MANA_BG_COLOR)
          .strokeColor(CONFIG.MANA_BG_STROKE)
          .strokeWidth(1)
          .zIndex(CONFIG.Z_INDEX_BG)
          .id(ids.manaBackgroundId)
          .metadata({ [EXTENSION_ID]: { type: "mana-bg", characterId: data.characterId } })
          .build()
      );

      // --- Mana Fill ---
      const manaFillWidth = Math.max(0, (barWidth - 2) * manaPercent);
      if (manaFillWidth > 0) {
        shapesToAdd.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(manaFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position({ x: barX + 1, y: manaBarY + 1 })
            .attachedTo(data.tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(CONFIG.MANA_FILL_COLOR)
            .strokeWidth(0)
            .zIndex(CONFIG.Z_INDEX_FILL)
            .id(ids.manaFillId)
            .metadata({ [EXTENSION_ID]: { type: "mana-fill", characterId: data.characterId } })
            .build()
        );
      }

      // Добавляем все элементы на сцену
      await OBR.scene.items.addItems(shapesToAdd);
      
      // Сохраняем в карту
      this.characterBars.set(data.characterId, ids);
      
      console.log(`[TokenBarService] Created bars for ${data.name} (${data.characterId})`);
    } catch (error) {
      console.error(`[TokenBarService] Failed to create bars for ${data.characterId}:`, error);
    }
  }

  // ==========================================================================
  // ОБНОВЛЕНИЕ БАРОВ
  // ==========================================================================

  async updateBars(data: CharacterBarData): Promise<void> {
    try {
      const isReady = await OBR.scene.isReady();
      if (!isReady) return;

      const barIds = this.characterBars.get(data.characterId);
      
      // Если баров нет - создаём
      if (!barIds) {
        await this.createBars(data);
        return;
      }

      // Получаем токен для проверки размера
      const tokenItems = await OBR.scene.items.getItems([data.tokenId]);
      if (tokenItems.length === 0) {
        // Токен удалён - удаляем бары
        await this.removeBars(data.characterId);
        return;
      }

      const token = tokenItems[0];
      if (!isImage(token)) return;

      // Вычисляем размеры
      const tokenWidth = token.image.width * token.scale.x;
      const tokenHeight = token.image.height * token.scale.y;
      
      const barWidth = Math.min(
        CONFIG.MAX_BAR_WIDTH,
        Math.max(CONFIG.MIN_BAR_WIDTH, tokenWidth * CONFIG.BAR_WIDTH_RATIO)
      );

      // Проценты
      const hpPercent = Math.max(0, Math.min(1, data.hp / Math.max(1, data.maxHp)));
      const manaPercent = Math.max(0, Math.min(1, data.mana / Math.max(1, data.maxMana)));

      // Позиции
      const hpBarY = tokenHeight / 2 + CONFIG.BAR_OFFSET_FROM_TOKEN;
      const manaBarY = hpBarY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP;
      const barX = -barWidth / 2;

      // Цвет HP
      const hpFillColor = hpPercent <= CONFIG.HP_LOW_THRESHOLD 
        ? CONFIG.HP_FILL_LOW 
        : CONFIG.HP_FILL_NORMAL;

      // Ширины заполнения
      const hpFillWidth = Math.max(0, (barWidth - 2) * hpPercent);
      const manaFillWidth = Math.max(0, (barWidth - 2) * manaPercent);

      // Собираем все ID баров
      const allBarIds = [
        barIds.hpBackgroundId,
        barIds.hpFillId,
        barIds.manaBackgroundId,
        barIds.manaFillId,
      ];

      // Получаем существующие элементы
      const existingItems = await OBR.scene.items.getItems(allBarIds);
      const existingIds = new Set(existingItems.map(item => item.id));

      // Элементы для добавления (если fill был удалён, т.к. был 0)
      const itemsToAdd: Shape[] = [];

      // Обновляем существующие элементы
      await OBR.scene.items.updateItems(
        existingItems.filter(item => isShape(item)).map(item => item.id),
        (items) => {
          for (const item of items) {
            if (!isShape(item)) continue;

            // HP Background
            if (item.id === barIds.hpBackgroundId) {
              item.width = barWidth;
              item.position = { x: barX, y: hpBarY };
              item.visible = token.visible;
            }
            // HP Fill
            else if (item.id === barIds.hpFillId) {
              item.width = hpFillWidth;
              item.position = { x: barX + 1, y: hpBarY + 1 };
              item.style.fillColor = hpFillColor;
              item.visible = token.visible && hpFillWidth > 0;
            }
            // Mana Background
            else if (item.id === barIds.manaBackgroundId) {
              item.width = barWidth;
              item.position = { x: barX, y: manaBarY };
              item.visible = token.visible;
            }
            // Mana Fill
            else if (item.id === barIds.manaFillId) {
              item.width = manaFillWidth;
              item.position = { x: barX + 1, y: manaBarY + 1 };
              item.visible = token.visible && manaFillWidth > 0;
            }
          }
        }
      );

      // Если HP Fill не существует, но нужен - создаём
      if (!existingIds.has(barIds.hpFillId) && hpFillWidth > 0) {
        itemsToAdd.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(hpFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position({ x: barX + 1, y: hpBarY + 1 })
            .attachedTo(data.tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(hpFillColor)
            .strokeWidth(0)
            .zIndex(CONFIG.Z_INDEX_FILL)
            .id(barIds.hpFillId)
            .metadata({ [EXTENSION_ID]: { type: "hp-fill", characterId: data.characterId } })
            .build()
        );
      }

      // Если Mana Fill не существует, но нужен - создаём
      if (!existingIds.has(barIds.manaFillId) && manaFillWidth > 0) {
        itemsToAdd.push(
          buildShape()
            .shapeType("RECTANGLE")
            .width(manaFillWidth)
            .height(CONFIG.BAR_HEIGHT - 2)
            .position({ x: barX + 1, y: manaBarY + 1 })
            .attachedTo(data.tokenId)
            .layer("ATTACHMENT")
            .locked(true)
            .disableHit(true)
            .visible(token.visible)
            .fillColor(CONFIG.MANA_FILL_COLOR)
            .strokeWidth(0)
            .zIndex(CONFIG.Z_INDEX_FILL)
            .id(barIds.manaFillId)
            .metadata({ [EXTENSION_ID]: { type: "mana-fill", characterId: data.characterId } })
            .build()
        );
      }

      if (itemsToAdd.length > 0) {
        await OBR.scene.items.addItems(itemsToAdd);
      }

      console.log(`[TokenBarService] Updated bars for ${data.name}`);
    } catch (error) {
      console.error(`[TokenBarService] Failed to update bars:`, error);
    }
  }

  // ==========================================================================
  // УДАЛЕНИЕ БАРОВ
  // ==========================================================================

  async removeBars(characterId: string): Promise<void> {
    try {
      const isReady = await OBR.scene.isReady();
      if (!isReady) return;

      const barIds = this.characterBars.get(characterId);
      if (!barIds) return;

      const idsToDelete = [
        barIds.hpBackgroundId,
        barIds.hpFillId,
        barIds.manaBackgroundId,
        barIds.manaFillId,
      ];

      // Проверяем какие элементы существуют
      const existingItems = await OBR.scene.items.getItems(idsToDelete);
      const existingIds = existingItems.map(item => item.id);

      if (existingIds.length > 0) {
        await OBR.scene.items.deleteItems(existingIds);
      }

      this.characterBars.delete(characterId);
      
      console.log(`[TokenBarService] Removed bars for ${characterId}`);
    } catch (error) {
      console.error(`[TokenBarService] Failed to remove bars:`, error);
    }
  }

  async removeAllBars(): Promise<void> {
    try {
      const isReady = await OBR.scene.isReady();
      if (!isReady) return;

      // Удаляем все бары из нашей карты
      for (const characterId of this.characterBars.keys()) {
        await this.removeBars(characterId);
      }

      // Дополнительно ищем и удаляем любые осиротевшие бары
      await this.cleanupOrphanedBars();
      
      console.log("[TokenBarService] Removed all bars");
    } catch (error) {
      console.error("[TokenBarService] Failed to remove all bars:", error);
    }
  }

  // ==========================================================================
  // СИНХРОНИЗАЦИЯ
  // ==========================================================================

  async syncAllBars(characters: CharacterBarData[], showBars: boolean): Promise<void> {
    try {
      const isReady = await OBR.scene.isReady();
      if (!isReady) return;

      if (!showBars) {
        // Если бары отключены - удаляем все
        await this.removeAllBars();
        return;
      }

      // Создаём/обновляем бары для каждого персонажа с tokenId
      const validCharacterIds = new Set<string>();
      
      for (const char of characters) {
        if (char.tokenId) {
          validCharacterIds.add(char.characterId);
          await this.createBars(char);
        }
      }

      // Удаляем бары для персонажей которых больше нет
      for (const characterId of this.characterBars.keys()) {
        if (!validCharacterIds.has(characterId)) {
          await this.removeBars(characterId);
        }
      }

      console.log(`[TokenBarService] Synced bars for ${validCharacterIds.size} characters`);
    } catch (error) {
      console.error("[TokenBarService] Failed to sync bars:", error);
    }
  }

  // ==========================================================================
  // ОБРАБОТЧИКИ СОБЫТИЙ OBR
  // ==========================================================================

  private async handleSceneItemsChange(items: Item[]): Promise<void> {
    try {
      // Собираем все tokenId которые мы отслеживаем
      // Нам нужно знать связь characterId -> tokenId
      // Это должно приходить извне, пока просто обновляем visibility

      // Проверяем видимость и существование токенов
      for (const [characterId, barIds] of this.characterBars.entries()) {
        const allBarIds = [
          barIds.hpBackgroundId,
          barIds.hpFillId,
          barIds.manaBackgroundId,
          barIds.manaFillId,
        ];

        // Находим бары на сцене
        const barItems = items.filter(item => allBarIds.includes(item.id));
        
        // Если бар привязан к токену, находим токен
        for (const barItem of barItems) {
          if (barItem.attachedTo) {
            const token = items.find(item => item.id === barItem.attachedTo);
            if (token && isShape(barItem)) {
              // Синхронизируем видимость
              if (barItem.visible !== token.visible) {
                await OBR.scene.items.updateItems([barItem.id], (updateItems) => {
                  for (const item of updateItems) {
                    item.visible = token.visible;
                  }
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Молча игнорируем ошибки в обработчике событий
      console.debug("[TokenBarService] handleSceneItemsChange error:", error);
    }
  }

  // ==========================================================================
  // ОЧИСТКА
  // ==========================================================================

  private async cleanupOrphanedBars(): Promise<void> {
    try {
      const isReady = await OBR.scene.isReady();
      if (!isReady) return;

      // Ищем все элементы с нашим тегом
      const allItems = await OBR.scene.items.getItems();
      const ourBars = allItems.filter(item => item.id.startsWith(BAR_TAG));

      if (ourBars.length > 0) {
        const idsToDelete = ourBars.map(item => item.id);
        await OBR.scene.items.deleteItems(idsToDelete);
        console.log(`[TokenBarService] Cleaned up ${idsToDelete.length} orphaned bars`);
      }
    } catch (error) {
      console.error("[TokenBarService] cleanupOrphanedBars failed:", error);
    }
  }

  // ==========================================================================
  // УНИЧТОЖЕНИЕ
  // ==========================================================================

  async destroy(): Promise<void> {
    try {
      // Отписываемся от событий
      if (this.unsubscribeItems) {
        this.unsubscribeItems();
        this.unsubscribeItems = null;
      }

      // Удаляем все бары
      await this.removeAllBars();

      this.isInitialized = false;
      console.log("[TokenBarService] Destroyed");
    } catch (error) {
      console.error("[TokenBarService] destroy failed:", error);
    }
  }
}

// ============================================================================
// ЭКСПОРТ SINGLETON
// ============================================================================

export const tokenBarService = new TokenBarService();

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ИНТЕГРАЦИИ СО STORE
// ============================================================================

export interface TokenBarCharacter {
  id: string;
  tokenId?: string;
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
}

/**
 * Преобразует персонажа из store в формат для tokenBarService
 */
export function characterToBarData(char: TokenBarCharacter): CharacterBarData | null {
  if (!char.tokenId) return null;
  
  return {
    characterId: char.id,
    tokenId: char.tokenId,
    name: char.name,
    hp: char.hp,
    maxHp: char.maxHp,
    mana: char.mana,
    maxMana: char.maxMana,
  };
}

/**
 * Хелпер для обновления бара одного персонажа
 */
export async function updateCharacterBar(char: TokenBarCharacter, showBars: boolean): Promise<void> {
  if (!showBars) return;
  
  const data = characterToBarData(char);
  if (data) {
    await tokenBarService.updateBars(data);
  }
}

/**
 * Хелпер для создания бара одного персонажа
 */
export async function createCharacterBar(char: TokenBarCharacter, showBars: boolean): Promise<void> {
  if (!showBars) return;
  
  const data = characterToBarData(char);
  if (data) {
    await tokenBarService.createBars(data);
  }
}

/**
 * Хелпер для удаления бара одного персонажа
 */
export async function removeCharacterBar(characterId: string): Promise<void> {
  await tokenBarService.removeBars(characterId);
}
