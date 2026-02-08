import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Unit, AppSettings, CombatState, Weapon, Spell, Resource, QuickAction } from '../types';

interface GameState {
  units: Unit[];
  activeUnitId: string | null;
  settings: AppSettings;
  combatState: CombatState;
  logs: string[];

  setActiveUnit: (id: string) => void;
  getActiveUnit: () => Unit | null;
  
  addUnit: (unit: Omit<Unit, 'id'>) => void;
  updateUnit: (id: string, updates: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  
  setHealth: (unitId: string, current: number, max?: number) => void;
  setMana: (unitId: string, current: number, max?: number) => void;
  
  addWeapon: (unitId: string, weapon: Omit<Weapon, 'id'>) => void;
  updateWeapon: (unitId: string, weaponId: string, updates: Partial<Weapon>) => void;
  deleteWeapon: (unitId: string, weaponId: string) => void;
  
  addSpell: (unitId: string, spell: Omit<Spell, 'id'>) => void;
  updateSpell: (unitId: string, spellId: string, updates: Partial<Spell>) => void;
  deleteSpell: (unitId: string, spellId: string) => void;
  
  addResource: (unitId: string, resource: Omit<Resource, 'id'>) => void;
  updateResource: (unitId: string, resourceId: string, updates: Partial<Resource>) => void;
  deleteResource: (unitId: string, resourceId: string) => void;
  modifyResource: (unitId: string, resourceId: string, delta: number) => void;
  
  addQuickAction: (unitId: string, action: Omit<QuickAction, 'id'>) => void;
  deleteQuickAction: (unitId: string, actionId: string) => void;
  
  setCombatState: (state: Partial<CombatState>) => void;
  resetCombat: () => void;
  
  addLog: (message: string) => void;
  clearLogs: () => void;
  
  updateSettings: (updates: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  webAppUrl: '',
  syncOnHpChange: true,
  syncOnManaChange: true,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      units: [],
      activeUnitId: null,
      settings: defaultSettings,
      combatState: { phase: 'idle' },
      logs: [],

      setActiveUnit: (id) => set({ activeUnitId: id }),
      
      getActiveUnit: () => {
        const { units, activeUnitId } = get();
        return units.find((u) => u.id === activeUnitId) || null;
      },

      addUnit: (unitData) => {
        const newUnit: Unit = { ...unitData, id: uuidv4() };
        set((s) => ({
          units: [...s.units, newUnit],
          activeUnitId: s.activeUnitId || newUnit.id,
        }));
      },

      updateUnit: (id, updates) => {
        set((s) => ({
          units: s.units.map((u) => (u.id === id ? { ...u, ...updates } : u)),
        }));
      },

      deleteUnit: (id) => {
        set((s) => {
          const newUnits = s.units.filter((u) => u.id !== id);
          return {
            units: newUnits,
            activeUnitId: s.activeUnitId === id ? (newUnits[0]?.id || null) : s.activeUnitId,
          };
        });
      },

      setHealth: (unitId, current, max) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, health: { current, max: max ?? u.health.max } } : u
          ),
        }));
      },

      setMana: (unitId, current, max) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, mana: { current, max: max ?? u.mana.max } } : u
          ),
        }));
      },

      addWeapon: (unitId, weapon) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, weapons: [...u.weapons, { ...weapon, id: uuidv4() }] } : u
          ),
        }));
      },

      updateWeapon: (unitId, weaponId, updates) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId
              ? { ...u, weapons: u.weapons.map((w) => (w.id === weaponId ? { ...w, ...updates } : w)) }
              : u
          ),
        }));
      },

      deleteWeapon: (unitId, weaponId) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, weapons: u.weapons.filter((w) => w.id !== weaponId) } : u
          ),
        }));
      },

      addSpell: (unitId, spell) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, spells: [...u.spells, { ...spell, id: uuidv4() }] } : u
          ),
        }));
      },

      updateSpell: (unitId, spellId, updates) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId
              ? { ...u, spells: u.spells.map((sp) => (sp.id === spellId ? { ...sp, ...updates } : sp)) }
              : u
          ),
        }));
      },

      deleteSpell: (unitId, spellId) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, spells: u.spells.filter((sp) => sp.id !== spellId) } : u
          ),
        }));
      },

      addResource: (unitId, resource) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, resources: [...u.resources, { ...resource, id: uuidv4() }] } : u
          ),
        }));
      },

      updateResource: (unitId, resourceId, updates) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId
              ? { ...u, resources: u.resources.map((r) => (r.id === resourceId ? { ...r, ...updates } : r)) }
              : u
          ),
        }));
      },

      deleteResource: (unitId, resourceId) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, resources: u.resources.filter((r) => r.id !== resourceId) } : u
          ),
        }));
      },

      modifyResource: (unitId, resourceId, delta) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId
              ? {
                  ...u,
                  resources: u.resources.map((r) =>
                    r.id === resourceId
                      ? { ...r, current: Math.max(0, Math.min(r.max, r.current + delta)) }
                      : r
                  ),
                }
              : u
          ),
        }));
      },

      addQuickAction: (unitId, action) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, quickActions: [...u.quickActions, { ...action, id: uuidv4() }] } : u
          ),
        }));
      },

      deleteQuickAction: (unitId, actionId) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, quickActions: u.quickActions.filter((a) => a.id !== actionId) } : u
          ),
        }));
      },

      setCombatState: (state) => {
        set((s) => ({ combatState: { ...s.combatState, ...state } }));
      },

      resetCombat: () => {
        set({ combatState: { phase: 'idle' } });
      },

      addLog: (message) => {
        const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        set((s) => ({ logs: [`[${time}] ${message}`, ...s.logs].slice(0, 100) }));
      },

      clearLogs: () => set({ logs: [] }),

      updateSettings: (updates) => {
        set((s) => ({ settings: { ...s.settings, ...updates } }));
      },
    }),
    { name: 'cursed-hearts-v2' }
  )
);
