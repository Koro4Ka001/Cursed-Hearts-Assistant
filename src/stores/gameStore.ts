import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, AppSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface GameState {
  units: Unit[];
  activeUnitId: string | null;
  settings: AppSettings;
  
  // Actions
  addUnit: (unit: Omit<Unit, 'id'>) => void;
  updateUnit: (id: string, updates: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  setActiveUnit: (id: string) => void;
  getActiveUnit: () => Unit | null;
  
  updateSettings: (updates: Partial<AppSettings>) => void;
  
  // HP/Mana
  setHealth: (unitId: string, current: number, max?: number) => void;
  setMana: (unitId: string, current: number, max?: number) => void;
}

const defaultSettings: AppSettings = {
  webAppUrl: '',
  syncOnHpChange: true,
  syncOnManaChange: true,
  diceMethod: 'built-in',
  grimoireNamespace: '',
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      units: [],
      activeUnitId: null,
      settings: defaultSettings,
      
      addUnit: (unitData) => {
        const newUnit: Unit = {
          ...unitData,
          id: uuidv4(),
        };
        set((state) => ({
          units: [...state.units, newUnit],
          activeUnitId: state.activeUnitId || newUnit.id,
        }));
      },
      
      updateUnit: (id, updates) => {
        set((state) => ({
          units: state.units.map((u) => 
            u.id === id ? { ...u, ...updates } : u
          ),
        }));
      },
      
      deleteUnit: (id) => {
        set((state) => {
          const newUnits = state.units.filter((u) => u.id !== id);
          const newActiveId = state.activeUnitId === id 
            ? (newUnits[0]?.id || null)
            : state.activeUnitId;
          return { units: newUnits, activeUnitId: newActiveId };
        });
      },
      
      setActiveUnit: (id) => {
        set({ activeUnitId: id });
      },
      
      getActiveUnit: () => {
        const state = get();
        return state.units.find((u) => u.id === state.activeUnitId) || null;
      },
      
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },
      
      setHealth: (unitId, current, max) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? { ...u, health: { current, max: max ?? u.health.max } }
              : u
          ),
        }));
      },
      
      setMana: (unitId, current, max) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? { ...u, mana: { current, max: max ?? u.mana.max } }
              : u
          ),
        }));
      },
    }),
    {
      name: 'cursed-hearts-storage',
    }
  )
);
