import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DamageType, SpellV2 } from '../types';

export interface MonsterWeapon {
  id: string;
  name: string;
  damageFormula: string;
  damageType: DamageType;
  hitBonus: number;
}

export interface Monster {
  tokenId: string;
  name: string;
  hp: number;
  maxHp: number;
  group: string;
  armor: number;
  armorByType: Partial<Record<DamageType, number>>;
  stats: {
    physicalPower: number;
    dexterity: number;
    vitality: number;
    intelligence: number;
    charisma: number;
    initiative: number;
  };
  weapons: MonsterWeapon[];
  spells: SpellV2[];
  elementResistances: Partial<Record<DamageType, number>>;
}

function defaultStats() {
  return { physicalPower: 0, dexterity: 0, vitality: 0, intelligence: 0, charisma: 0, initiative: 0 };
}

function migrateMonster(raw: Record<string, unknown>): Monster {
  return {
    tokenId: raw.tokenId as string,
    name: raw.name as string,
    hp: raw.hp as number,
    maxHp: raw.maxHp as number,
    group: (raw.group as string) || '',
    armor: (raw.armor as number) || 0,
    armorByType: (raw.armorByType as Partial<Record<DamageType, number>>) || {},
    stats: raw.stats ? { ...defaultStats(), ...(raw.stats as Record<string, number>) } : defaultStats(),
    weapons: (raw.weapons as MonsterWeapon[]) || [],
    spells: (raw.spells as SpellV2[]) || [],
    elementResistances: (raw.elementResistances as Partial<Record<DamageType, number>>) || {},
  };
}

interface MonsterStore {
  monsters: Record<string, Monster>;
  add: (tokenId: string, name: string, maxHp: number, group: string) => void;
  remove: (tokenId: string) => void;
  duplicate: (sourceTokenId: string, newTokenId: string) => void;
  setHp: (tokenId: string, hp: number) => void;
  setMaxHp: (tokenId: string, maxHp: number) => void;
  updateFields: (tokenId: string, fields: Partial<Pick<Monster, 'name' | 'hp' | 'maxHp' | 'group' | 'armor'>>) => void;
  setArmorByType: (tokenId: string, type: DamageType, value: number) => void;
  setStats: (tokenId: string, stats: Partial<Monster['stats']>) => void;
  addWeapon: (tokenId: string, weapon: MonsterWeapon) => void;
  removeWeapon: (tokenId: string, weaponId: string) => void;
  updateWeapon: (tokenId: string, weaponId: string, fields: Partial<MonsterWeapon>) => void;
  addSpell: (tokenId: string, spell: SpellV2) => void;
  removeSpell: (tokenId: string, spellId: string) => void;
  setElementResistance: (tokenId: string, element: DamageType, multiplier: number) => void;
  getGroups: () => string[];
  get: (tokenId: string) => Monster | undefined;
}

export const useMonsterStore = create<MonsterStore>()(
  persist(
    (set, get) => ({
      monsters: {},

      add: (tokenId, name, maxHp, group) => set((s) => ({
        monsters: {
          ...s.monsters,
          [tokenId]: {
            tokenId, name, hp: maxHp, maxHp, group,
            armor: 0, armorByType: {},
            stats: defaultStats(),
            weapons: [],
            spells: [],
            elementResistances: {},
          },
        },
      })),

      remove: (tokenId) => set((s) => {
        const { [tokenId]: _, ...rest } = s.monsters;
        return { monsters: rest };
      }),

      duplicate: (sourceTokenId, newTokenId) => set((s) => {
        const source = s.monsters[sourceTokenId];
        if (!source) return s;
        const copy = { ...source, tokenId: newTokenId, hp: source.maxHp };
        return { monsters: { ...s.monsters, [newTokenId]: copy } };
      }),

      setHp: (tokenId, hp) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        return { monsters: { ...s.monsters, [tokenId]: { ...m, hp: Math.max(0, Math.min(hp, m.maxHp)) } } };
      }),

      setMaxHp: (tokenId, maxHp) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        const safe = Math.max(1, maxHp);
        return { monsters: { ...s.monsters, [tokenId]: { ...m, maxHp: safe, hp: Math.min(m.hp, safe) } } };
      }),

      updateFields: (tokenId, fields) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        const updated = { ...m, ...fields };
        if (fields.maxHp !== undefined) {
          updated.maxHp = Math.max(1, fields.maxHp);
          updated.hp = Math.min(m.hp, updated.maxHp);
        }
        if (fields.hp !== undefined) {
          updated.hp = Math.max(0, Math.min(fields.hp, updated.maxHp));
        }
        return { monsters: { ...s.monsters, [tokenId]: updated } };
      }),

      setArmorByType: (tokenId, type, value) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        return {
          monsters: {
            ...s.monsters,
            [tokenId]: {
              ...m,
              armorByType: { ...m.armorByType, [type]: Math.max(0, value) },
            },
          },
        };
      }),

      setStats: (tokenId, stats) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        return {
          monsters: {
            ...s.monsters,
            [tokenId]: { ...m, stats: { ...m.stats, ...stats } },
          },
        };
      }),

      addWeapon: (tokenId, weapon) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        return {
          monsters: {
            ...s.monsters,
            [tokenId]: { ...m, weapons: [...m.weapons, weapon] },
          },
        };
      }),

      removeWeapon: (tokenId, weaponId) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        return {
          monsters: {
            ...s.monsters,
            [tokenId]: { ...m, weapons: m.weapons.filter(w => w.id !== weaponId) },
          },
        };
      }),

      updateWeapon: (tokenId, weaponId, fields) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        return {
          monsters: {
            ...s.monsters,
            [tokenId]: {
              ...m,
              weapons: m.weapons.map(w => w.id === weaponId ? { ...w, ...fields } : w),
            },
          },
        };
      }),

      addSpell: (tokenId, spell) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        return {
          monsters: {
            ...s.monsters,
            [tokenId]: { ...m, spells: [...m.spells, spell] },
          },
        };
      }),

      removeSpell: (tokenId, spellId) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        return {
          monsters: {
            ...s.monsters,
            [tokenId]: { ...m, spells: m.spells.filter(sp => sp.id !== spellId) },
          },
        };
      }),

      setElementResistance: (tokenId, element, multiplier) => set((s) => {
        const m = s.monsters[tokenId];
        if (!m) return s;
        const resistances = { ...m.elementResistances };
        if (multiplier === 1) delete resistances[element];
        else resistances[element] = Math.max(0, Math.min(2, multiplier));
        return {
          monsters: {
            ...s.monsters,
            [tokenId]: { ...m, elementResistances: resistances },
          },
        };
      }),

      getGroups: () => {
        const monsters = Object.values(get().monsters);
        const groups = new Set<string>();
        for (const m of monsters) {
          if (m.group) groups.add(m.group);
        }
        return Array.from(groups).sort();
      },

      get: (tokenId) => get().monsters[tokenId],
    }),
    {
      name: 'ch-monsters',
      merge: (persisted, current) => {
        const data = (persisted as Record<string, unknown>)?.monsters;
        if (!data || typeof data !== 'object') return current;
        const monsters: Record<string, Monster> = {};
        for (const [key, val] of Object.entries(data)) {
          monsters[key] = migrateMonster(val as Record<string, unknown>);
        }
        return { ...current, monsters } as MonsterStore;
      },
    }
  )
);
