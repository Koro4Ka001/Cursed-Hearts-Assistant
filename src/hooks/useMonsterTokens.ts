import { useEffect, useState, useCallback } from 'react';
import OBR, { isImage } from '@owlbear-rodeo/sdk';
import { useMonsterStore } from '../stores/monsterStore';
import { tokenBarService } from '../services/tokenBarService';

export interface MonsterToken {
  tokenId: string;
  name: string;
  hp: number;
  maxHp: number;
}

export function useMonsterTokens() {
  const [isReady, setIsReady] = useState(false);
  const monsters = useMonsterStore((s) => s.monsters);
  const addMonster = useMonsterStore((s) => s.addMonster);
  const removeMonster = useMonsterStore((s) => s.removeMonster);
  const setHp = useMonsterStore((s) => s.setHp);
  const setMaxHp = useMonsterStore((s) => s.setMaxHp);

  useEffect(() => {
    OBR.onReady(() => setIsReady(true));
  }, []);

  const registerFromSelection = useCallback(async () => {
    try {
      if (!(await OBR.scene.isReady())) return;
      const selection = await OBR.player.getSelection();
      if (!selection || selection.length === 0) return;

      const items = await OBR.scene.items.getItems(selection);
      for (const item of items) {
        if (!isImage(item)) continue;
        if (useMonsterStore.getState().monsters[item.id]) continue;

        const name = item.name || 'Monster';
        const maxHp = 50;
        addMonster(item.id, name, maxHp);
        await tokenBarService.createBars(item.id, maxHp, maxHp, 0, 0, true);
      }
    } catch (e) {
      console.error('[useMonsterTokens] registerFromSelection failed:', e);
    }
  }, [addMonster]);

  const updateHp = useCallback(async (tokenId: string, hp: number) => {
    const m = useMonsterStore.getState().monsters[tokenId];
    if (!m) return;
    const safe = Math.max(0, Math.min(hp, m.maxHp));
    setHp(tokenId, safe);
    await tokenBarService.updateBars(tokenId, safe, m.maxHp, 0, 0, true);
  }, [setHp]);

  const updateMaxHp = useCallback(async (tokenId: string, maxHp: number) => {
    const m = useMonsterStore.getState().monsters[tokenId];
    if (!m) return;
    setMaxHp(tokenId, maxHp);
    await tokenBarService.updateBars(tokenId, m.hp, maxHp, 0, 0, true);
  }, [setMaxHp]);

  const unregister = useCallback(async (tokenId: string) => {
    removeMonster(tokenId);
    await tokenBarService.removeBars(tokenId);
  }, [removeMonster]);

  const monsterList: MonsterToken[] = Object.values(monsters);

  return {
    monsters: monsterList,
    isReady,
    registerFromSelection,
    updateHp,
    updateMaxHp,
    unregister,
  };
}
