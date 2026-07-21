import { useEffect, useState, useCallback } from 'react';
import OBR, { isImage } from '@owlbear-rodeo/sdk';
import { useMonsterStore, type Monster } from '../stores/monsterStore';
import { tokenBarService } from '../services/tokenBarService';
import { useShallow } from 'zustand/shallow';

export function useMonsterTokens() {
  const [ready, setReady] = useState(false);
  const monsters = useMonsterStore(useShallow((s) => Object.values(s.monsters)));

  useEffect(() => { OBR.onReady(() => setReady(true)); }, []);

  // Sync deleted tokens from OBR map to monster store
  useEffect(() => {
    let unsub: (() => void) | null = null;
    OBR.onReady(() => {
      unsub = OBR.scene.items.onChange(async (items) => {
        const trackedIds = Object.keys(useMonsterStore.getState().monsters);
        if (trackedIds.length === 0) return;
        const itemIds = new Set(items.map(i => i.id));
        for (const id of trackedIds) {
          if (!itemIds.has(id)) {
            useMonsterStore.getState().remove(id);
            await tokenBarService.removeBars(id);
          }
        }
      });
    });
    return () => { unsub?.(); };
  }, []);

  const registerTokens = useCallback(async (tokenIds: string[], name: string, maxHp: number, group: string) => {
    if (!(await OBR.scene.isReady())) return;
    const items = await OBR.scene.items.getItems(tokenIds);
    for (const item of items) {
      if (!isImage(item)) continue;
      if (useMonsterStore.getState().get(item.id)) continue;
      const tokenName = name || item.name || 'Monster';
      useMonsterStore.getState().add(item.id, tokenName, maxHp, group);
      await tokenBarService.createBars(item.id, maxHp, maxHp, 0, 0, false, tokenName);
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

  const updateMonster = useCallback(async (tokenId: string, fields: Partial<Pick<Monster, 'name' | 'hp' | 'maxHp' | 'group' | 'armor'>>) => {
    useMonsterStore.getState().updateFields(tokenId, fields);
    const fresh = useMonsterStore.getState().get(tokenId);
    if (fresh) {
      // Rebuild bars if name changed (to update label on token)
      if (fields.name !== undefined) {
        await tokenBarService.createBars(tokenId, fresh.hp, fresh.maxHp, 0, 0, false, fresh.name);
      } else {
        await tokenBarService.updateBars(tokenId, fresh.hp, fresh.maxHp, 0, 0, false);
      }
    }
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
