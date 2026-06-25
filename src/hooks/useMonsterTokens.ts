import { useEffect, useState, useCallback } from 'react';
import OBR, { isImage } from '@owlbear-rodeo/sdk';
import { useDefenseStore } from '../stores/defenseStore';
import type { DamageType } from '../types';

const HP_TRACKER_KEY = 'com.bitperfect-software.hp-tracker/data';
const CUSTOM_HP_KEY = 'cursed-hearts-assistant';

export interface MonsterToken {
  tokenId: string;
  name: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  armor: number;
  flatArmor: number;
  armorByType: Partial<Record<DamageType, number>>;
  multipliers: Partial<Record<DamageType, number>>;
  hasData: boolean;
}

function readHpFromMetadata(metadata: Record<string, unknown>): { hp: number; maxHp: number; name: string } | null {
  const hpTracker = metadata[HP_TRACKER_KEY];
  if (hpTracker && typeof hpTracker === 'object') {
    const obj = hpTracker as Record<string, unknown>;
    if (obj.hp !== undefined) {
      return {
        hp: Number(obj.hp),
        maxHp: Number(obj.maxHp ?? obj.hp),
        name: String(obj.name ?? ''),
      };
    }
  }
  return null;
}

export function useMonsterTokens() {
  const [monsters, setMonsters] = useState<MonsterToken[]>([]);
  const [isReady, setIsReady] = useState(false);
  const defenseUnits = useDefenseStore((s) => s.units);

  const loadMonsters = useCallback(async () => {
    try {
      if (!(await OBR.scene.isReady())) return;
      const items = await OBR.scene.items.getItems();
      const imageItems = items.filter((i) => isImage(i));

      const result: MonsterToken[] = [];
      for (const item of imageItems) {
        const meta = item.metadata as Record<string, unknown>;
        const hpData = readHpFromMetadata(meta);
        if (!hpData) continue;

        const defense = defenseUnits[item.id];
        result.push({
          tokenId: item.id,
          name: hpData.name || item.name || 'Monster',
          hp: hpData.hp,
          maxHp: hpData.maxHp,
          tempHp: 0,
          armor: 0,
          flatArmor: defense?.flatArmor ?? 0,
          armorByType: defense?.armorByType ?? {},
          multipliers: defense?.multipliers ?? {},
          hasData: true,
        });
      }

      setMonsters(result);
    } catch (e) {
      console.error('[useMonsterTokens] Error:', e);
    }
  }, [defenseUnits]);

  useEffect(() => {
    let mounted = true;
    OBR.onReady(async () => {
      if (!mounted) return;
      setIsReady(true);
      await loadMonsters();

      const unsubPlayer = OBR.player.onChange(() => loadMonsters());
      const unsubItems = OBR.scene.items.onChange(() => loadMonsters());

      return () => {
        unsubPlayer();
        unsubItems();
      };
    });
    return () => { mounted = false; };
  }, [loadMonsters]);

  const updateHp = useCallback(async (tokenId: string, newHp: number) => {
    try {
      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length) return;
      const token = items[0];
      const meta = token.metadata as Record<string, unknown>;
      const hpData = meta[HP_TRACKER_KEY] as Record<string, unknown> | undefined;
      if (!hpData) return;

      const maxHp = Number(hpData.maxHp ?? hpData.hp ?? 100);
      const safe = Math.max(0, Math.min(newHp, maxHp));

      await OBR.scene.items.updateItems([tokenId], (sceneItems) => {
        for (const item of sceneItems) {
          const m = item.metadata as Record<string, unknown>;
          const data = m[HP_TRACKER_KEY] as Record<string, unknown> | undefined;
          if (data) data.hp = safe;
        }
      });

      setMonsters((prev) =>
        prev.map((m) => (m.tokenId === tokenId ? { ...m, hp: safe } : m))
      );
    } catch (e) {
      console.error('[useMonsterTokens] updateHp failed:', e);
    }
  }, []);

  const setMaxHp = useCallback(async (tokenId: string, newMaxHp: number) => {
    try {
      const safe = Math.max(1, newMaxHp);
      await OBR.scene.items.updateItems([tokenId], (sceneItems) => {
        for (const item of sceneItems) {
          const m = item.metadata as Record<string, unknown>;
          const data = m[HP_TRACKER_KEY] as Record<string, unknown> | undefined;
          if (data) data.maxHp = safe;
        }
      });
      setMonsters((prev) =>
        prev.map((m) => (m.tokenId === tokenId ? { ...m, maxHp: safe } : m))
      );
    } catch (e) {
      console.error('[useMonsterTokens] setMaxHp failed:', e);
    }
  }, []);

  return { monsters, isReady, loadMonsters, updateHp, setMaxHp };
}
