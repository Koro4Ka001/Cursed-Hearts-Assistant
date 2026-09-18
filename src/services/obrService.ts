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
