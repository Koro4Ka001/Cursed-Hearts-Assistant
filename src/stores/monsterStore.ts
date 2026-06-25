import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Monster {
  tokenId: string;
  name: string;
  hp: number;
  maxHp: number;
  group: string;
}

interface MonsterStore {
  monsters: Record<string, Monster>;
  add: (tokenId: string, name: string, maxHp: number, group: string) => void;
  remove: (tokenId: string) => void;
  setHp: (tokenId: string, hp: number) => void;
  setMaxHp: (tokenId: string, maxHp: number) => void;
  updateFields: (tokenId: string, fields: Partial<Pick<Monster, 'name' | 'hp' | 'maxHp' | 'group'>>) => void;
  getGroups: () => string[];
  get: (tokenId: string) => Monster | undefined;
}

export const useMonsterStore = create<MonsterStore>()(
  persist(
    (set, get) => ({
      monsters: {},

      add: (tokenId, name, maxHp, group) => set((s) => ({
        monsters: { ...s.monsters, [tokenId]: { tokenId, name, hp: maxHp, maxHp, group } },
      })),

      remove: (tokenId) => set((s) => {
        const { [tokenId]: _, ...rest } = s.monsters;
        return { monsters: rest };
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
    { name: 'ch-monsters' }
  )
);
