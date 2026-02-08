// Сервис для работы с Google Docs через Google Apps Script Web App

interface DocsStatsResponse {
  success: boolean;
  health?: { current: number; max: number };
  mana?: { current: number; max: number };
  characterName?: string;
  error?: string;
}

interface DocsActionResponse {
  success: boolean;
  current?: number;
  max?: number;
  health?: { current: number; max: number };
  mana?: { current: number; max: number };
  error?: string;
}

class DocsService {
  private url: string = '';
  private isConnected: boolean = false;
  
  /**
   * Установить URL Google Apps Script Web App
   */
  setUrl(url: string): void {
    this.url = url;
    this.isConnected = false;
  }
  
  /**
   * Получить текущий URL
   */
  getUrl(): string {
    return this.url;
  }
  
  /**
   * Проверить, установлен ли URL
   */
  hasUrl(): boolean {
    return this.url.length > 0;
  }
  
  /**
   * Проверить подключение
   */
  isDocsConnected(): boolean {
    return this.isConnected && this.hasUrl();
  }
  
  /**
   * POST запрос к Google Apps Script
   * ВАЖНО: Content-Type: text/plain для обхода CORS
   */
  private async post(data: Record<string, unknown>): Promise<DocsActionResponse> {
    if (!this.url) {
      return { success: false, error: 'URL не настроен' };
    }
    
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'text/plain' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json() as DocsActionResponse;
      this.isConnected = true;
      return result;
    } catch (error) {
      this.isConnected = false;
      console.error('Docs POST error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка' 
      };
    }
  }
  
  /**
   * GET запрос к Google Apps Script
   */
  private async get(params: Record<string, string>): Promise<DocsStatsResponse> {
    if (!this.url) {
      return { success: false, error: 'URL не настроен' };
    }
    
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${this.url}?${query}`, { redirect: 'follow' });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json() as DocsStatsResponse;
      this.isConnected = true;
      return result;
    } catch (error) {
      this.isConnected = false;
      console.error('Docs GET error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка' 
      };
    }
  }
  
  /**
   * Получить статы персонажа из Google Docs
   */
  async getStats(character: string): Promise<DocsStatsResponse> {
    return this.get({ action: 'stats', character });
  }
  
  /**
   * Установить HP персонажа
   */
  async setHealth(
    character: string, 
    current: number, 
    max?: number
  ): Promise<DocsActionResponse> {
    const data: Record<string, unknown> = {
      action: 'setHealth',
      character,
      current
    };
    
    if (max !== undefined) {
      data['max'] = max;
    }
    
    return this.post(data);
  }
  
  /**
   * Установить ману персонажа
   */
  async setMana(
    character: string, 
    current: number, 
    max?: number
  ): Promise<DocsActionResponse> {
    const data: Record<string, unknown> = {
      action: 'setMana',
      character,
      current
    };
    
    if (max !== undefined) {
      data['max'] = max;
    }
    
    return this.post(data);
  }
  
  /**
   * Потратить ману
   */
  async spendMana(character: string, amount: number): Promise<DocsActionResponse> {
    return this.post({
      action: 'spendMana',
      character,
      amount
    });
  }
  
  /**
   * Восстановить ману
   */
  async restoreMana(character: string, amount: number): Promise<DocsActionResponse> {
    return this.post({
      action: 'restoreMana',
      character,
      amount
    });
  }
  
  /**
   * Исцелить персонажа
   */
  async heal(character: string, amount: number): Promise<DocsActionResponse> {
    return this.post({
      action: 'heal',
      character,
      amount
    });
  }
  
  /**
   * Записать лог действия
   */
  async log(character: string, message: string): Promise<DocsActionResponse> {
    return this.post({
      action: 'log',
      character,
      message
    });
  }
  
  /**
   * Тестовое подключение
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.url) {
      return { success: false, error: 'URL не настроен' };
    }
    
    try {
      const response = await fetch(`${this.url}?action=ping`, { redirect: 'follow' });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      this.isConnected = true;
      return { success: true };
    } catch (error) {
      this.isConnected = false;
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка' 
      };
    }
  }
}

// Экспортируем синглтон
export const docsService = new DocsService();
