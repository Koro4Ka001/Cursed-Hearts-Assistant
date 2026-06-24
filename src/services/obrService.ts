import OBR from '@owlbear-rodeo/sdk';
import { setOBRConnected } from './hpTrackerService';

/**
 * Инициализация Owlbear Rodeo SDK
 */
export async function initOBR(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Таймаут на случай если OBR не инициализируется
    const timeout = setTimeout(() => {
      reject(new Error('OBR initialization timeout'));
    }, 10000);
    
    OBR.onReady(() => {
      clearTimeout(timeout);
      setOBRConnected(true);
      console.log('[OBR] SDK Ready');
      resolve();
    });
  });
}

/**
 * Получить ID текущей сцены
 */
export async function getSceneId(): Promise<string> {
  const metadata = await OBR.scene.getMetadata();
  return (metadata as Record<string, unknown>)['id'] as string ?? '';
}

/**
 * Привязка токена: пользователь нажимает кнопку, затем кликает по токену на карте
 */
export async function selectToken(): Promise<string | null> {
  return new Promise((resolve) => {
    OBR.notification.show('🎯 Кликните на токен на карте...');
    
    const timeout = setTimeout(() => {
      unsub();
      OBR.notification.show('⏱️ Время вышло');
      resolve(null);
    }, 30000);
    
    const unsub = OBR.player.onChange((player) => {
      // Проверяем selection
      if (player.selection && player.selection.length > 0) {
        clearTimeout(timeout);
        unsub();
        const tokenId = player.selection[0];
        OBR.notification.show(`✅ Токен выбран!`);
        resolve(tokenId ?? null);
      }
    });
  });
}

/**
 * Показать уведомление всем игрокам
 */
export async function showNotification(message: string): Promise<void> {
  await OBR.notification.show(message);
}
