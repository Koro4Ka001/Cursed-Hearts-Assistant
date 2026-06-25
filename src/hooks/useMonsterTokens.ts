import { useEffect, useState, useCallback } from 'react';
import OBR, { isImage } from '@owlbear-rodeo/sdk';
import { useMonsterStore, type Monster } from '../stores/monsterStore';
import { tokenBarService } from '../services/tokenBarService';

export function useMonsterTokens() {
  const [ready, setReady] = useState(false);
  const monsters = useMonsterStore((s) => Object.values(s.monsters));

  useEffect(() => { OBR.onReady(() => setReady(true)); }, []);

  const registerSelected = useCallback(async () => {
    if (!(await OBR.scene.isReady())) return;
    const sel = await OBR.player.getSelection();
    if (!sel?.length) return;
    const items = await OBR.scene.items.getItems(sel);
    for (const item of items) {
      if (!isImage(item)) continue;
      if (useMonsterStore.getState().get(item.id)) continue;
      const name = item.name || 'Monster';
      const maxHp = 50;
      useMonsterStore.getState().add(item.id, name, maxHp);
      await tokenBarService.createBars(item.id, maxHp, maxHp, 0, 0, false);
    }
  }, []);

  const updateHp = useCallback(async (tokenId: string, hp: number) => {
    const m = useMonsterStore.getState().get(tokenId);
    if (!m) return;
    const safe = Math.max(0, Math.min(hp, m.maxHp));
    useMonsterStore.getState().setHp(tokenId, safe);
    await tokenBarService.updateBars(tokenId, safe, m.maxHp, 0, 0, false);
  }, []);

  const updateMaxHp = useCallback(async (tokenId: string, maxHp: number) => {
    const m = useMonsterStore.getState().get(tokenId);
    if (!m) return;
    useMonsterStore.getState().setMaxHp(tokenId, maxHp);
    const fresh = useMonsterStore.getState().get(tokenId);
    if (fresh) await tokenBarService.updateBars(tokenId, fresh.hp, fresh.maxHp, 0, 0, false);
  }, []);

  const unregister = useCallback(async (tokenId: string) => {
    useMonsterStore.getState().remove(tokenId);
    await tokenBarService.removeBars(tokenId);
  }, []);

  return { monsters, ready, registerSelected, updateHp, updateMaxHp, unregister };
}
