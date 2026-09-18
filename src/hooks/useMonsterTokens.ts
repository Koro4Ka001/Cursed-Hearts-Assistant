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
    let unsubItems: (() => void) | null = null;
    let unsubScene: (() => void) | null = null;
    let mounted = true;
    // 🔧 КРИТИЧНО: при смене сцены Owlbear отдаёт items НОВОЙ сцены — токены
    // предыдущей «исчезают», и прежняя логика стирала ВСЕХ зарегистрированных
    // монстров. Теперь удаляем монстра только если его токен был виден
    // в текущем потоке items (т.е. реально существует в ЭТОЙ сцене) и пропал.
    // При смене сцены поток сбрасывается — старые токены не «увидены» заново.
    const seenTokens = new Set<string>();
    // OBR.onReady не возвращает функцию отписки, поэтому используем флаг:
    // если колбэк сработает после размонтирования — подписка не создаётся
    OBR.onReady(() => {
      if (!mounted) return;
      // Смена сцены проходит через not-ready: сбрасываем «увиденное»,
      // чтобы токены прошлой сцены не считались существующими
      unsubScene = OBR.scene.onReadyChange((ready) => {
        if (!ready) seenTokens.clear();
      });
      unsubItems = OBR.scene.items.onChange(async (items) => {
        try {
          for (const item of items) seenTokens.add(item.id);

          const trackedIds = Object.keys(useMonsterStore.getState().monsters);
          if (trackedIds.length === 0) return;
          const itemIds = new Set(items.map(i => i.id));
          for (const id of trackedIds) {
            // Токен существовал в текущей сцене (был в потоке items) и удалён
            if (!itemIds.has(id) && seenTokens.has(id)) {
              seenTokens.delete(id);
              useMonsterStore.getState().remove(id);
              await tokenBarService.removeBars(id);
            }
          }
        } catch (e) {
          console.warn('[MonsterTokens] sync deleted tokens failed:', e);
        }
      });
    });
    return () => {
      mounted = false;
      unsubItems?.();
      unsubScene?.();
    };
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
    // 🔧 Нижний кламп убран: HP монстра может уходить в минус.
    const safe = Math.min(hp, m.maxHp);
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

  const updateMonster = useCallback(async (tokenId: string, fields: Partial<Pick<Monster, 'name' | 'hp' | 'maxHp' | 'group' | 'armor' | 'notes'>>) => {
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
