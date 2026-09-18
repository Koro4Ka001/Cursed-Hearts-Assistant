import OBR from '@owlbear-rodeo/sdk';

// Флаг подключения
let obrConnected = false;

export function setOBRConnected(connected: boolean): void {
  obrConnected = connected;
}

/**
 * Привязка токена: пользователь нажимает кнопку, затем кликает по токену на карте
 * Возвращает ID выбранного токена или null если отменено/таймаут
 */
export async function selectToken(): Promise<string | null> {
  if (!obrConnected) {
    console.warn('OBR not connected');
    return null;
  }
  
  try {
    await OBR.notification.show('Кликните на токен на карте...');
    
    return new Promise<string | null>((resolve) => {
      // Таймаут 30 секунд
      const timeout = setTimeout(() => {
        unsub();
        OBR.notification.show('Время выбора токена истекло');
        resolve(null);
      }, 30000);
      
      // Подписываемся на изменения selection
      const unsub = OBR.player.onChange((player) => {
        const selection = player.selection;
        if (selection && selection.length > 0) {
          clearTimeout(timeout);
          unsub();
          const tokenId = selection[0];
          OBR.notification.show(`Токен выбран: ${tokenId?.slice(0, 8)}...`);
          resolve(tokenId ?? null);
        }
      });
    });
  } catch (error) {
    console.error('Error selecting token:', error);
    return null;
  }
}
