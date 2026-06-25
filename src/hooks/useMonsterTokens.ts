import { useEffect, useState, useCallback } from 'react';
import OBR, { isImage } from '@owlbear-rodeo/sdk';
import { useMonsterStore, type Monster } from '../stores/monsterStore';
import { tokenBarService } from '../services/tokenBarService';
import { useShallow } from 'zustand/shallow';

export function useMonsterTokens() {
  const [ready, setReady] = useState(false);
  const monsters = useMonsterStore(useShallow((s) => Object.values(s.monsters)));

  useEffect(() => { OBR.onReady(() => setReady(true)); }, []);

  const registerTokens = useCallback(async (tokenIds: string[], name: string, maxHp: number, group: string) => {
    if (!(await OBR.scene.isReady())) return;
    const items = await OBR.scene.items.getItems(tokenIds);
    for (const item of items) {
      if (!isImage(item)) continue;
      if (useMonsterStore.getState().get(item.id)) continue;
      const tokenName = name || item.name || 'Monster';
      useMonsterStore.getState().add(item.id, tokenName, maxHp, group);
      await tokenBarService.createBars(item.id, maxHp, maxHp, 0, 0, true);
    }
  }, []);

  const updateHp = useCallback(async (tokenId: string, hp: number) => {
    const m = useMonsterStore.getState().get(tokenId);
    if (!m) return;
    const safe = Math.max(0, Math.min(hp, m.maxHp));
    useMonsterStore.getState().setHp(tokenId, safe);
    await tokenBarService.updateBars(tokenId, safe, m.maxHp, 0, 0, true);
  }, []);

  const updateMaxHp = useCallback(async (tokenId: string, maxHp: number) => {
    const m = useMonsterStore.getState().get(tokenId);
    if (!m) return;
    useMonsterStore.getState().setMaxHp(tokenId, maxHp);
    const fresh = useMonsterStore.getState().get(tokenId);
    if (fresh) await tokenBarService.updateBars(tokenId, fresh.hp, fresh.maxHp, 0, 0, true);
  }, []);

  const updateMonster = useCallback(async (tokenId: string, fields: Partial<Pick<Monster, 'name' | 'hp' | 'maxHp' | 'group'>>) => {
    useMonsterStore.getState().updateFields(tokenId, fields);
    const fresh = useMonsterStore.getState().get(tokenId);
    if (fresh) await tokenBarService.updateBars(tokenId, fresh.hp, fresh.maxHp, 0, 0, true);
  }, []);

  const unregister = useCallback(async (tokenId: string) => {
    useMonsterStore.getState().remove(tokenId);
    await tokenBarService.removeBars(tokenId);
  }, []);

  const getSelection = useCallback(async (): Promise<string[]> => {
    if (!(await OBR.scene.isReady())) return [];
    const sel = await OBR.player.getSelection();
    if (!sel?.length) return [];
    const items = await OBR.scene.items.getItems(sel);
    return items.filter(isImage).map(i => i.id);
  }, []);

  const getGroups = useCallback(() => {
    return useMonsterStore.getState().getGroups();
  }, []);

  return { monsters, ready, registerTokens, updateHp, updateMaxHp, updateMonster, unregister, getSelection, getGroups };
}
