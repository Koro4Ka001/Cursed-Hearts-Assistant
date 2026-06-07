// src/services/docsService.ts

interface DocsStatsResponse {
  success: boolean;
  health?: { current: number; max: number };
  mana?: { current: number; max: number };
  rage?: { current: number; max: number }; // 🔥
  resources?: Record<string, { current: number; max: number }>;
  characterName?: string;
  error?: string;
}

interface DocsActionResponse {
  success: boolean;
  current?: number;
  max?: number;
  health?: { current: number; max: number };
  mana?: { current: number; max: number };
  rage?: { current: number; max: number }; // 🔥
  error?: string;
}

class DocsService {
  private url: string = '';
  private isConnected: boolean = false;
  
  setUrl(url: string): void {
    this.url = url.trim();
    this.isConnected = false;
  }
  
  getUrl(): string {
    return this.url;
  }
  
  hasUrl(): boolean {
    return this.url.length > 0;
  }
  
  isDocsConnected(): boolean {
    return this.isConnected && this.hasUrl();
  }
  
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      let result: DocsActionResponse;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(`Ответ не JSON: ${text.substring(0, 100)}`);
      }
      
      this.isConnected = true;
      return result;
    } catch (error) {
      this.isConnected = false;
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('Docs POST error:', msg);
      return { success: false, error: msg };
    }
  }
  
  private async get(params: Record<string, string>): Promise<DocsStatsResponse> {
    if (!this.url) {
      return { success: false, error: 'URL не настроен' };
    }
    
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${this.url}?${query}`, { redirect: 'follow' });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      let result: DocsStatsResponse;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(`Ответ не JSON: ${text.substring(0, 100)}`);
      }
      
      this.isConnected = true;
      return result;
    } catch (error) {
      this.isConnected = false;
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('Docs GET error:', msg);
      return { success: false, error: msg };
    }
  }
  
  async getStats(character: string): Promise<DocsStatsResponse> {
    return this.get({ action: 'stats', character });
  }
  
  async setHealth(character: string, current: number, max?: number): Promise<DocsActionResponse> {
    const data: Record<string, unknown> = { action: 'setHealth', character, current };
    if (max !== undefined) data['max'] = max;
    return this.post(data);
  }
  
  async setMana(character: string, current: number, max?: number): Promise<DocsActionResponse> {
    const data: Record<string, unknown> = { action: 'setMana', character, current };
    if (max !== undefined) data['max'] = max;
    return this.post(data);
  }
  
  // 🔥 RAGE
  async setRage(character: string, current: number, max?: number): Promise<DocsActionResponse> {
    const data: Record<string, unknown> = { action: 'setRage', character, current };
    if (max !== undefined) data['max'] = max;
    return this.post(data);
  }
  
  async spendMana(character: string, amount: number): Promise<DocsActionResponse> {
    return this.post({ action: 'spendMana', character, amount });
  }
  
  async restoreMana(character: string, amount: number): Promise<DocsActionResponse> {
    return this.post({ action: 'restoreMana', character, amount });
  }
  
  async heal(character: string, amount: number): Promise<DocsActionResponse> {
    return this.post({ action: 'heal', character, amount });
  }
  
  async setResource(character: string, resourceName: string, current: number, max?: number): Promise<DocsActionResponse> {
    const data: Record<string, unknown> = { action: 'setResource', character, name: resourceName, current };
    if (max !== undefined) data['max'] = max;
    return this.post(data);
  }
  
  async log(character: string, message: string): Promise<DocsActionResponse> {
    return this.post({ action: 'log', character, message });
  }
  
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.url) {
      return { success: false, error: 'URL не настроен' };
    }
    
    try {
      console.log('[Docs] Testing connection to:', this.url.substring(0, 50) + '...');
      
      const response = await fetch(`${this.url}?action=ping`, { redirect: 'follow' });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      console.log('[Docs] Test response:', text.substring(0, 200));
      
      let result: { success?: boolean; message?: string; error?: string };
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(`Ответ не JSON: "${text.substring(0, 100)}"`);
      }
      
      if (result.success) {
        this.isConnected = true;
        console.log('[Docs] Connection test passed ✅');
        return { success: true };
      }
      
      return { success: false, error: result.error ?? 'Сервер вернул success: false' };
    } catch (error) {
      this.isConnected = false;
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('[Docs] Connection test failed:', msg);
      return { success: false, error: msg };
    }
  }
}

export const docsService = new DocsService();
