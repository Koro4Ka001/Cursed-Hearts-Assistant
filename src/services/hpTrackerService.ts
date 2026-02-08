import OBR, { isShape, isText, Item } from '@owlbear-rodeo/sdk';

// Ключ метаданных HP Tracker (Game Master's Grimoire)
const HP_TRACKER_KEY = 'com.bitperfect-software.hp-tracker/data';
const HP_BAR_MAX_WIDTH = 146;

// Флаг подключения
let obrConnected = false;

export function setOBRConnected(connected: boolean): void {
  obrConnected = connected;
}

export function isOBRConnected(): boolean {
  return obrConnected;
}

interface HPTrackerData {
  hp: number;
  maxHp: number;
  tempHp?: number;
}

/**
 * Обновляет HP бар на карте для привязанного токена
 */
export async function updateTokenHp(
  tokenId: string,
  newHp: number,
  maxHp?: number
): Promise<boolean> {
  if (!obrConnected) {
    console.warn('OBR not connected, skipping HP Tracker update');
    return false;
  }
  
  try {
    // Получаем все items на сцене
    const items = await OBR.scene.items.getItems();
    
    // Ищем токен по ID
    const token = items.find(item => item.id === tokenId);
    if (!token) {
      console.warn(`Token ${tokenId} not found`);
      return false;
    }
    
    // Читаем текущие данные HP Tracker
    const metadata = token.metadata as Record<string, unknown>;
    const hpData = metadata[HP_TRACKER_KEY] as HPTrackerData | undefined;
    
    if (!hpData) {
      console.warn(`Token ${tokenId} has no HP Tracker data`);
      return false;
    }
    
    // Определяем maxHP
    const actualMaxHp = maxHp ?? hpData.maxHp;
    
    // Обновляем метаданные токена
    await OBR.scene.items.updateItems([tokenId], (items) => {
      for (const item of items) {
        const itemMetadata = item.metadata as Record<string, unknown>;
        const itemHpData = itemMetadata[HP_TRACKER_KEY] as HPTrackerData | undefined;
        if (itemHpData) {
          itemHpData.hp = newHp;
          if (maxHp !== undefined) {
            itemHpData.maxHp = maxHp;
          }
        }
      }
    });
    
    // Ищем attachments с HP баром
    const attachments = items.filter(item => item.attachedTo === tokenId);
    
    // Находим HP бар (shape с именем "hp") и текст (text с именем "hp-text")
    const hpBar = attachments.find(item => item.name === 'hp' && isShape(item));
    const hpText = attachments.find(item => item.name === 'hp-text' && isText(item));
    
    const itemsToUpdate: string[] = [];
    if (hpBar) itemsToUpdate.push(hpBar.id);
    if (hpText) itemsToUpdate.push(hpText.id);
    
    if (itemsToUpdate.length > 0) {
      await OBR.scene.items.updateItems(itemsToUpdate, (updateItems: Item[]) => {
        for (const item of updateItems) {
          if (item.name === 'hp' && isShape(item)) {
            // Обновляем ширину бара
            const hpPercent = Math.max(0, Math.min(1, newHp / actualMaxHp));
            const newWidth = Math.max(1, hpPercent * HP_BAR_MAX_WIDTH);
            item.width = newWidth;
          } else if (item.name === 'hp-text' && isText(item)) {
            // Обновляем текст
            const plainText = item.text.plainText ?? '';
            // Текст обычно в формате "HP: X/Y" или просто "X/Y"
            if (plainText.includes('/')) {
              const prefix = plainText.split('/')[0]?.split(':')[0] ?? '';
              if (prefix.toLowerCase().includes('hp')) {
                item.text.plainText = `HP: ${newHp}/${actualMaxHp}`;
              } else {
                item.text.plainText = `${newHp}/${actualMaxHp}`;
              }
            }
          }
        }
      });
    }
    
    console.log(`Updated HP Tracker for token ${tokenId}: ${newHp}/${actualMaxHp}`);
    return true;
  } catch (error) {
    console.error('Failed to update HP Tracker:', error);
    return false;
  }
}

/**
 * Читает текущий HP из токена
 */
export async function getTokenHp(
  tokenId: string
): Promise<{ hp: number; maxHp: number } | null> {
  if (!obrConnected) {
    return null;
  }
  
  try {
    const items = await OBR.scene.items.getItems([tokenId]);
    const token = items[0];
    
    if (!token) {
      return null;
    }
    
    const metadata = token.metadata as Record<string, unknown>;
    const hpData = metadata[HP_TRACKER_KEY] as HPTrackerData | undefined;
    
    if (!hpData) {
      return null;
    }
    
    return {
      hp: hpData.hp,
      maxHp: hpData.maxHp
    };
  } catch (error) {
    console.error('Failed to get token HP:', error);
    return null;
  }
}

/**
 * Проверяет, есть ли у токена HP Tracker данные
 */
export async function hasHpTracker(tokenId: string): Promise<boolean> {
  const hp = await getTokenHp(tokenId);
  return hp !== null;
}

/**
 * Получает имя токена
 */
export async function getTokenName(tokenId: string): Promise<string | null> {
  if (!obrConnected) {
    return null;
  }
  
  try {
    const items = await OBR.scene.items.getItems([tokenId]);
    const token = items[0];
    
    if (!token) {
      return null;
    }
    
    return token.name;
  } catch (error) {
    console.error('Failed to get token name:', error);
    return null;
  }
}
