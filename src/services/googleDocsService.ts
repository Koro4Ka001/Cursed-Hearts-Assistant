// Google Docs Sync Service

class GoogleDocsService {
  private webAppUrl: string = '';
  private characterHeader: string = '';

  setConfig(url: string, header: string) {
    this.webAppUrl = url;
    this.characterHeader = header;
  }

  getUrl() { return this.webAppUrl; }
  getHeader() { return this.characterHeader; }

  async testConnection(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.webAppUrl) {
      return { success: false, error: 'URL не настроен' };
    }

    try {
      const url = `${this.webAppUrl}?action=test`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getStats(): Promise<{ health: { current: number; max: number }; mana: { current: number; max: number } } | null> {
    if (!this.webAppUrl || !this.characterHeader) return null;
    try {
      const url = `${this.webAppUrl}?action=stats&character=${encodeURIComponent(this.characterHeader)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        return { health: data.health, mana: data.mana };
      }
      return null;
    } catch (error) {
      console.error('getStats error:', error);
      return null;
    }
  }

  async setHealth(current: number, max?: number): Promise<boolean> {
    if (!this.webAppUrl || !this.characterHeader) return false;
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'setHealth',
          character: this.characterHeader,
          current,
          max,
        }),
      });
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('setHealth error:', error);
      return false;
    }
  }

  async setMana(current: number, max?: number): Promise<boolean> {
    if (!this.webAppUrl || !this.characterHeader) return false;
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'setMana',
          character: this.characterHeader,
          current,
          max,
        }),
      });
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('setMana error:', error);
      return false;
    }
  }

  async setResource(name: string, current: number): Promise<boolean> {
    if (!this.webAppUrl || !this.characterHeader) return false;
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'setResource',
          character: this.characterHeader,
          name,
          current,
        }),
      });
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('setResource error:', error);
      return false;
    }
  }

  async takeDamage(amount: number, category: string, type: string, isUndead: boolean): Promise<{ finalDamage: number; newHealth: number } | null> {
    if (!this.webAppUrl || !this.characterHeader) return null;
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'damage',
          character: this.characterHeader,
          amount,
          category,
          type,
          isUndead,
        }),
      });
      const data = await response.json();
      if (data.success) {
        return { finalDamage: data.finalDamage, newHealth: data.newHealth };
      }
      return null;
    } catch (error) {
      console.error('takeDamage error:', error);
      return null;
    }
  }

  async log(message: string): Promise<boolean> {
    if (!this.webAppUrl || !this.characterHeader) return false;
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'log',
          character: this.characterHeader,
          message,
        }),
      });
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('log error:', error);
      return false;
    }
  }
}

export const googleDocsService = new GoogleDocsService();
