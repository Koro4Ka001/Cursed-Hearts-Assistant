import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DamageType } from '../types';

export interface UnitDefense {
  tokenId: string;
  flatArmor: number;
  armorByType: Partial<Record<DamageType, number>>;
  multipliers: Partial<Record<DamageType, number>>;
  lastModified: number;
}

function createDefault(tokenId: string): UnitDefense {
  return {
    tokenId,
    flatArmor: 0,
    armorByType: {},
    multipliers: {},
    lastModified: Date.now(),
  };
}

interface DefenseStore {
  units: Record<string, UnitDefense>;
  getDefense: (tokenId: string) => UnitDefense | null;
  setFlatArmor: (tokenId: string, value: number) => void;
  setArmorByType: (tokenId: string, type: DamageType, value: number) => void;
  removeArmorByType: (tokenId: string, type: DamageType) => void;
  setMultiplier: (tokenId: string, type: DamageType, value: number) => void;
  removeMultiplier: (tokenId: string, type: DamageType) => void;
  clearUnit: (tokenId: string) => void;
}

export const useDefenseStore = create<DefenseStore>()(
  persist(
    (set, get) => ({
      units: {},

      getDefense: (tokenId) => get().units[tokenId] || null,

      setFlatArmor: (tokenId, value) => set((state) => {
        const cur = state.units[tokenId] || createDefault(tokenId);
        return {
          units: {
            ...state.units,
            [tokenId]: { ...cur, flatArmor: Math.max(0, value), lastModified: Date.now() },
          },
        };
      }),

      setArmorByType: (tokenId, type, value) => set((state) => {
        const cur = state.units[tokenId] || createDefault(tokenId);
        return {
          units: {
            ...state.units,
            [tokenId]: {
              ...cur,
              armorByType: { ...cur.armorByType, [type]: Math.max(0, value) },
              lastModified: Date.now(),
            },
          },
        };
      }),

      removeArmorByType: (tokenId, type) => set((state) => {
        const cur = state.units[tokenId];
        if (!cur) return state;
        const { [type]: _, ...rest } = cur.armorByType;
        return {
          units: {
            ...state.units,
            [tokenId]: { ...cur, armorByType: rest, lastModified: Date.now() },
          },
        };
      }),

      setMultiplier: (tokenId, type, value) => set((state) => {
        const cur = state.units[tokenId] || createDefault(tokenId);
        const newMult = { ...cur.multipliers };
        if (value === 1) delete newMult[type];
        else newMult[type] = value;
        return {
          units: {
            ...state.units,
            [tokenId]: { ...cur, multipliers: newMult, lastModified: Date.now() },
          },
        };
      }),

      removeMultiplier: (tokenId, type) => set((state) => {
        const cur = state.units[tokenId];
        if (!cur) return state;
        const { [type]: _, ...rest } = cur.multipliers;
        return {
          units: {
            ...state.units,
            [tokenId]: { ...cur, multipliers: rest, lastModified: Date.now() },
          },
        };
      }),

      clearUnit: (tokenId) => set((state) => {
        const { [tokenId]: _, ...rest } = state.units;
        return { units: rest };
      }),
    }),
    { name: 'cursed-hearts-defenses' }
  )
);
