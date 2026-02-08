// Game Master's Grimoire Integration Service
// Syncs HP to token metadata on the map

let _obr: any = null;

export function setOBR(obr: any) {
  _obr = obr;
}

class GrimoireService {
  private namespace: string | null = null;
  private initialized = false;

  async initialize(): Promise<boolean> {
    if (!_obr || this.initialized) return this.initialized;

    try {
      await this.findGrimoireNamespace();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Grimoire init error:', error);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.initialized && !!this.namespace;
  }

  private async findGrimoireNamespace(): Promise<void> {
    if (!_obr) return;

    try {
      const items = await _obr.scene.items.getItems();

      for (const item of items) {
        if (!item.metadata) continue;

        for (const key of Object.keys(item.metadata)) {
          const lowerKey = key.toLowerCase();
          if (
            lowerKey.includes('grimoire') ||
            lowerKey.includes('health') ||
            lowerKey.includes('battle')
          ) {
            const parts = key.split('/');
            if (parts.length >= 2) {
              this.namespace = parts[0];
              console.log(`Grimoire namespace found: ${this.namespace}`);
              return;
            }
          }
        }
      }

      // Default namespace
      this.namespace = 'com.owlbear.grimoire';
      console.log(`Using default Grimoire namespace: ${this.namespace}`);
    } catch (error) {
      console.error('Error finding Grimoire namespace:', error);
      this.namespace = 'com.owlbear.grimoire';
    }
  }

  /**
   * Update token HP on the map
   */
  async updateTokenHealth(tokenId: string, currentHp: number, maxHp: number): Promise<boolean> {
    if (!tokenId || !_obr) return false;

    if (!this.namespace) {
      await this.findGrimoireNamespace();
    }

    try {
      await _obr.scene.items.updateItems([tokenId], (items: any[]) => {
        for (const item of items) {
          if (!item.metadata) item.metadata = {};

          // Format 1: namespace/hp
          item.metadata[`${this.namespace}/hp`] = currentHp;
          item.metadata[`${this.namespace}/maxHp`] = maxHp;

          // Format 2: namespace/health object
          item.metadata[`${this.namespace}/health`] = { current: currentHp, max: maxHp };

          // Format 3: direct
          item.metadata['hp'] = currentHp;
          item.metadata['maxHp'] = maxHp;
        }
      });

      console.log(`Updated token ${tokenId} HP: ${currentHp}/${maxHp}`);
      return true;
    } catch (error) {
      console.error('Error updating token health:', error);
      return false;
    }
  }

  /**
   * Get token HP from map
   */
  async getTokenHealth(tokenId: string): Promise<{ current: number; max: number } | null> {
    if (!tokenId || !_obr) return null;

    try {
      const items = await _obr.scene.items.getItems([tokenId]);
      if (items.length === 0) return null;

      const meta = items[0].metadata || {};

      if (meta[`${this.namespace}/hp`] !== undefined) {
        return {
          current: meta[`${this.namespace}/hp`] as number,
          max: (meta[`${this.namespace}/maxHp`] as number) || 100,
        };
      }

      if (meta[`${this.namespace}/health`]) {
        const health = meta[`${this.namespace}/health`] as { current: number; max: number };
        return { current: health.current || 0, max: health.max || 100 };
      }

      if (meta['hp'] !== undefined) {
        return { current: meta['hp'] as number, max: (meta['maxHp'] as number) || 100 };
      }

      return null;
    } catch (error) {
      console.error('Error getting token health:', error);
      return null;
    }
  }

  /**
   * Let user select a token on the map
   */
  async selectToken(): Promise<string | null> {
    if (!_obr) return null;

    return new Promise((resolve) => {
      _obr.notification.show('Кликните на токен для привязки', 'INFO');

      const unsubscribe = _obr.player.onChange(async (player: any) => {
        if (player.selection && player.selection.length > 0) {
          const tokenId = player.selection[0];
          unsubscribe();
          resolve(tokenId);
        }
      });

      // Timeout 30s
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 30000);
    });
  }
}

export const grimoireService = new GrimoireService();
