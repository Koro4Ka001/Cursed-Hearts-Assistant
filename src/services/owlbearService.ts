import OBR from '@owlbear-rodeo/sdk';

let isInitialized = false;
let playerName = 'Player';

// Инициализация Owlbear SDK
export async function initializeOwlbear(): Promise<boolean> {
  try {
    await OBR.onReady(async () => {
      isInitialized = true;
      playerName = await OBR.player.getName();
      console.log('Owlbear SDK initialized for', playerName);
    });
    return true;
  } catch (error) {
    console.warn('Owlbear SDK not available (running outside Owlbear)');
    return false;
  }
}

export function isOwlbearReady(): boolean {
  return isInitialized;
}

export function getPlayerName(): string {
  return playerName;
}

// Отправить уведомление
export async function showNotification(
  message: string, 
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO'
): Promise<void> {
  if (!isInitialized) {
    console.log(`[${type}] ${message}`);
    return;
  }
  
  try {
    await OBR.notification.show(message, type);
  } catch (error) {
    console.log(`[${type}] ${message}`);
  }
}

// Получить список токенов на карте
export async function getTokens(): Promise<{ id: string; name: string }[]> {
  if (!isInitialized) {
    return [];
  }
  
  try {
    const items = await OBR.scene.items.getItems();
    return items
      .filter(item => item.type === 'IMAGE')
      .map(item => ({
        id: item.id,
        name: item.name || 'Unnamed Token',
      }));
  } catch (error) {
    console.error('Error getting tokens:', error);
    return [];
  }
}

// Game Master's Grimoire интеграция
// Grimoire хранит HP в metadata токенов
const GRIMOIRE_METADATA_KEY = 'com.battle-system';

interface GrimoireTokenData {
  health?: number;
  maxHealth?: number;
  tempHealth?: number;
  armorClass?: number;
}

// Обновить HP токена через Grimoire metadata
export async function updateTokenHP(
  tokenId: string, 
  currentHP: number, 
  maxHP: number
): Promise<boolean> {
  if (!isInitialized) {
    console.log(`Would update token ${tokenId} HP to ${currentHP}/${maxHP}`);
    return false;
  }
  
  try {
    await OBR.scene.items.updateItems([tokenId], (items) => {
      for (const item of items) {
        // Обновляем metadata для Grimoire
        const metadata = item.metadata || {};
        const grimoireData: GrimoireTokenData = 
          (metadata[GRIMOIRE_METADATA_KEY] as GrimoireTokenData) || {};
        
        grimoireData.health = currentHP;
        grimoireData.maxHealth = maxHP;
        
        item.metadata = {
          ...metadata,
          [GRIMOIRE_METADATA_KEY]: grimoireData,
        };
      }
    });
    
    console.log(`Updated token ${tokenId} HP to ${currentHP}/${maxHP}`);
    return true;
  } catch (error) {
    console.error('Error updating token HP:', error);
    return false;
  }
}

// Получить HP токена
export async function getTokenHP(tokenId: string): Promise<{ current: number; max: number } | null> {
  if (!isInitialized) {
    return null;
  }
  
  try {
    const items = await OBR.scene.items.getItems([tokenId]);
    if (items.length === 0) return null;
    
    const item = items[0];
    const metadata = item.metadata || {};
    const grimoireData = metadata[GRIMOIRE_METADATA_KEY] as GrimoireTokenData | undefined;
    
    if (grimoireData && grimoireData.health !== undefined) {
      return {
        current: grimoireData.health,
        max: grimoireData.maxHealth || grimoireData.health,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting token HP:', error);
    return null;
  }
}

// Подписаться на изменения выбранного токена
export async function onTokenSelected(
  callback: (tokenId: string | null) => void
): Promise<() => void> {
  if (!isInitialized) {
    return () => {};
  }
  
  try {
    return OBR.player.onChange((player) => {
      const selection = player.selection;
      if (selection && selection.length > 0) {
        callback(selection[0]);
      } else {
        callback(null);
      }
    });
  } catch (error) {
    console.error('Error subscribing to token selection:', error);
    return () => {};
  }
}

// Получить информацию о токене по ID
export async function getTokenInfo(tokenId: string): Promise<{ id: string; name: string } | null> {
  if (!isInitialized) {
    return null;
  }
  
  try {
    const items = await OBR.scene.items.getItems([tokenId]);
    if (items.length === 0) return null;
    
    const item = items[0];
    return {
      id: item.id,
      name: item.name || 'Unnamed Token',
    };
  } catch (error) {
    console.error('Error getting token info:', error);
    return null;
  }
}

// Открыть попап для выбора токена
export async function selectTokenForUnit(unitName: string): Promise<string | null> {
  if (!isInitialized) {
    return null;
  }
  
  try {
    // Показываем уведомление о том, что нужно выбрать токен
    await showNotification(`Выберите токен для ${unitName} на карте`, 'INFO');
    
    // Ждём выбора токена
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 30000); // 30 секунд таймаут
      
      const unsubscribe = OBR.player.onChange((player) => {
        const selection = player.selection;
        if (selection && selection.length > 0) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(selection[0]);
        }
      });
    });
  } catch (error) {
    console.error('Error selecting token:', error);
    return null;
  }
}
