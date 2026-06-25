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
  addMonster: (tokenId: string, name: string, maxHp: number) => void;
  removeMonster: (tokenId: string) => void;
  setHp: (tokenId: string, hp: number) => void;
  setMaxHp: (tokenId: string, maxHp: number) => void;
  getMonster: (tokenId: string) => Monster | null;
}

export const useMonsterStore = create<MonsterStore>()(
  persist(
    (set, get) => ({
      monsters: {},

      addMonster: (tokenId, name, maxHp) => set((state) => ({
        monsters: {
          ...state.monsters,
          [tokenId]: { tokenId, name, hp: maxHp, maxHp },
        },
      })),

      removeMonster: (tokenId) => set((state) => {
        const { [tokenId]: _, ...rest } = state.monsters;
        return { monsters: rest };
      }),

      setHp: (tokenId, hp) => set((state) => {
        const m = state.monsters[tokenId];
        if (!m) return state;
        return {
          monsters: {
            ...state.monsters,
            [tokenId]: { ...m, hp: Math.max(0, Math.min(hp, m.maxHp)) },
          },
        };
      }),

      setMaxHp: (tokenId, maxHp) => set((state) => {
        const m = state.monsters[tokenId];
        if (!m) return state;
        return {
          monsters: {
            ...state.monsters,
            [tokenId]: { ...m, maxHp: Math.max(1, maxHp), hp: Math.min(m.hp, maxHp) },
          },
        };
      }),

      getMonster: (tokenId) => get().monsters[tokenId] || null,
    }),
    { name: 'cursed-hearts-monsters' }
  )
);
