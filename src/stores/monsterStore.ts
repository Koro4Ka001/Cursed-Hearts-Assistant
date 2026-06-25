import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Monster {
  tokenId: string;
  name: string;
  hp: number;
  maxHp: number;
}

interface MonsterStore {
  monsters: Record<string, Monster>;
  add: (tokenId: string, name: string, maxHp: number) => void;
  remove: (tokenId: string) => void;
  setHp: (tokenId: string, hp: number) => void;
  setMaxHp: (tokenId: string, maxHp: number) => void;
  get: (tokenId: string) => Monster | undefined;
}

export const useMonsterStore = create<MonsterStore>()(
  persist(
    (set, get) => ({
      monsters: {},

      add: (tokenId, name, maxHp) => set((s) => ({
        monsters: { ...s.monsters, [tokenId]: { tokenId, name, hp: maxHp, maxHp } },
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

      get: (tokenId) => get().monsters[tokenId],
    }),
    { name: 'ch-monsters' }
  )
);
