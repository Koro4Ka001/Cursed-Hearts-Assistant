import type { GoogleDocsResponse } from '@/types';

let webAppUrl = '';

export function setWebAppUrl(url: string): void {
  webAppUrl = url;
}

export function getWebAppUrl(): string {
  return webAppUrl;
}

// Получить статы персонажа
export async function getStats(characterHeader: string): Promise<GoogleDocsResponse> {
  if (!webAppUrl) {
    return { success: false, error: 'Google Web App URL не настроен' };
  }
  
  try {
    const url = new URL(webAppUrl);
    url.searchParams.set('action', 'stats');
    url.searchParams.set('character', characterHeader);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    return data as GoogleDocsResponse;
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка соединения' 
    };
  }
}

// Нанести урон
export async function applyDamage(
  characterHeader: string,
  damage: number,
  damageType: string,
  damageCategory: string,
  isUndead: boolean = false
): Promise<GoogleDocsResponse> {
  if (!webAppUrl) {
    return { success: false, error: 'Google Web App URL не настроен' };
  }
  
  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'damage',
        character: characterHeader,
        damage,
        damageType,
        damageCategory,
        isUndead,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error applying damage:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка соединения' 
    };
  }
}

// Исцелить
export async function heal(
  characterHeader: string,
  amount: number
): Promise<GoogleDocsResponse> {
  if (!webAppUrl) {
    return { success: false, error: 'Google Web App URL не настроен' };
  }
  
  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'heal',
        character: characterHeader,
        amount,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error healing:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка соединения' 
    };
  }
}

// Изменить ману
export async function modifyMana(
  characterHeader: string,
  delta: number
): Promise<GoogleDocsResponse> {
  if (!webAppUrl) {
    return { success: false, error: 'Google Web App URL не настроен' };
  }
  
  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'mana',
        character: characterHeader,
        delta,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error modifying mana:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка соединения' 
    };
  }
}

// Записать в лог
export async function writeLog(
  characterHeader: string,
  characterShortName: string,
  action: string
): Promise<{ success: boolean; error?: string }> {
  if (!webAppUrl) {
    return { success: false, error: 'Google Web App URL не настроен' };
  }
  
  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'log',
        character: characterHeader,
        shortName: characterShortName,
        logEntry: action,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error writing log:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка соединения' 
    };
  }
}

// Синхронизировать все данные юнита
export async function syncUnit(characterHeader: string): Promise<GoogleDocsResponse> {
  return getStats(characterHeader);
}
