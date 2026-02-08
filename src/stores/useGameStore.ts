import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Unit, Weapon, Spell, Resource, QuickAction,
  AppSettings, CombatState, LogEntry, EntityId,
  CharacterStats, WeaponProficiencies, TabId
} from '../types';

interface GameState {
  units: Unit[];
  activeUnitId: EntityId | null;
  activeTab: TabId;
  settings: AppSettings;
  combatState: CombatState;
  logs: LogEntry[];
  isOwlbearReady: boolean;
  isSyncing: boolean;
  lastError: string | null;

  getActiveUnit: () => Unit | null;
  getUnitById: (id: EntityId) => Unit | null;
  setActiveTab: (tab: TabId) => void;
  setActiveUnit: (id: EntityId) => void;
  addUnit: (unit: Omit<Unit, 'id'>) => EntityId;
  updateUnit: (id: EntityId, updates: Partial<Unit>) => void;
  deleteUnit: (id: EntityId) => void;
  setHealth: (unitId: EntityId, current: number, max?: number) => void;
  modifyHealth: (unitId: EntityId, delta: number) => void;
  setMana: (unitId: EntityId, current: number, max?: number) => void;
  modifyMana: (unitId: EntityId, delta: number) => void;
  addWeapon: (unitId: EntityId, weapon: Omit<Weapon, 'id'>) => EntityId;
  updateWeapon: (unitId: EntityId, weaponId: EntityId, updates: Partial<Weapon>) => void;
  deleteWeapon: (unitId: EntityId, weaponId: EntityId) => void;
  addSpell: (unitId: EntityId, spell: Omit<Spell, 'id'>) => EntityId;
  updateSpell: (unitId: EntityId, spellId: EntityId, updates: Partial<Spell>) => void;
  deleteSpell: (unitId: EntityId, spellId: EntityId) => void;
  addResource: (unitId: EntityId, resource: Omit<Resource, 'id'>) => EntityId;
  updateResource: (unitId: EntityId, resourceId: EntityId, updates: Partial<Resource>) => void;
  deleteResource: (unitId: EntityId, resourceId: EntityId) => void;
  modifyResourceAmount: (unitId: EntityId, resourceId: EntityId, delta: number) => void;
  addQuickAction: (unitId: EntityId, action: Omit<QuickAction, 'id'>) => EntityId;
  updateQuickAction: (unitId: EntityId, actionId: EntityId, updates: Partial<QuickAction>) => void;
  deleteQuickAction: (unitId: EntityId, actionId: EntityId) => void;
  setCombatState: (state: Partial<CombatState>) => void;
  resetCombat: () => void;
  addLog: (message: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  setOwlbearReady: (ready: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setError: (error: string | null) => void;
  resetAll: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  webAppUrl: '',
  syncHpOnChange: true,
  syncManaOnChange: true,
  syncResourcesOnChange: true,
};

const DEFAULT_COMBAT_STATE: CombatState = { phase: 'idle' };

const DEFAULT_STATS: CharacterStats = {
  physicalPower: 1, dexterity: 1, intelligence: 1,
  vitality: 1, charisma: 1, initiative: 1,
};

const DEFAULT_PROFICIENCIES: WeaponProficiencies = {
  swords: 0, axes: 0, hammers: 0, polearms: 0, unarmed: 0, bows: 0,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      units: [],
      activeUnitId: null,
      activeTab: 'combat' as TabId,
      settings: DEFAULT_SETTINGS,
      combatState: DEFAULT_COMBAT_STATE,
      logs: [],
      isOwlbearReady: false,
      isSyncing: false,
      lastError: null,

      getActiveUnit: () => {
        const { units, activeUnitId } = get();
        if (!activeUnitId) return null;
        return units.find(u => u.id === activeUnitId) || null;
      },

      getUnitById: (id) => get().units.find(u => u.id === id) || null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      setActiveUnit: (id) => set({ activeUnitId: id, combatState: DEFAULT_COMBAT_STATE }),

      addUnit: (unitData) => {
        const id = uuidv4();
        const newUnit: Unit = {
          ...unitData,
          id,
          stats: unitData.stats || DEFAULT_STATS,
          proficiencies: unitData.proficiencies || DEFAULT_PROFICIENCIES,
          magicBonuses: unitData.magicBonuses || {},
          weapons: unitData.weapons || [],
          spells: unitData.spells || [],
          resources: unitData.resources || [],
          quickActions: unitData.quickActions || [],
        };
        set(state => ({
          units: [...state.units, newUnit],
          activeUnitId: state.activeUnitId || id,
        }));
        return id;
      },

      updateUnit: (id, updates) => {
        set(state => ({
          units: state.units.map(u => u.id === id ? { ...u, ...updates } : u),
        }));
      },

      deleteUnit: (id) => {
        set(state => {
          const newUnits = state.units.filter(u => u.id !== id);
          const newActiveId = state.activeUnitId === id ? (newUnits[0]?.id || null) : state.activeUnitId;
          return { units: newUnits, activeUnitId: newActiveId };
        });
      },

      setHealth: (unitId, current, max) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, health: { current: Math.max(0, Math.min(current, max ?? u.health.max)), max: max ?? u.health.max } };
          }),
        }));
      },

      modifyHealth: (unitId, delta) => {
        const unit = get().getUnitById(unitId);
        if (!unit) return;
        get().setHealth(unitId, unit.health.current + delta);
      },

      setMana: (unitId, current, max) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, mana: { current: Math.max(0, Math.min(current, max ?? u.mana.max)), max: max ?? u.mana.max } };
          }),
        }));
      },

      modifyMana: (unitId, delta) => {
        const unit = get().getUnitById(unitId);
        if (!unit) return;
        get().setMana(unitId, unit.mana.current + delta);
      },

      addWeapon: (unitId, weaponData) => {
        const id = uuidv4();
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, weapons: [...u.weapons, { ...weaponData, id }] };
          }),
        }));
        return id;
      },

      updateWeapon: (unitId, weaponId, updates) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, weapons: u.weapons.map(w => w.id === weaponId ? { ...w, ...updates } : w) };
          }),
        }));
      },

      deleteWeapon: (unitId, weaponId) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, weapons: u.weapons.filter(w => w.id !== weaponId) };
          }),
        }));
      },

      addSpell: (unitId, spellData) => {
        const id = uuidv4();
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, spells: [...u.spells, { ...spellData, id }] };
          }),
        }));
        return id;
      },

      updateSpell: (unitId, spellId, updates) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, spells: u.spells.map(s => s.id === spellId ? { ...s, ...updates } : s) };
          }),
        }));
      },

      deleteSpell: (unitId, spellId) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, spells: u.spells.filter(s => s.id !== spellId) };
          }),
        }));
      },

      addResource: (unitId, resourceData) => {
        const id = uuidv4();
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, resources: [...u.resources, { ...resourceData, id }] };
          }),
        }));
        return id;
      },

      updateResource: (unitId, resourceId, updates) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, resources: u.resources.map(r => r.id === resourceId ? { ...r, ...updates } : r) };
          }),
        }));
      },

      deleteResource: (unitId, resourceId) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, resources: u.resources.filter(r => r.id !== resourceId) };
          }),
        }));
      },

      modifyResourceAmount: (unitId, resourceId, delta) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return {
              ...u,
              resources: u.resources.map(r => {
                if (r.id !== resourceId) return r;
                return { ...r, current: Math.max(0, Math.min(r.max, r.current + delta)) };
              }),
            };
          }),
        }));
      },

      addQuickAction: (unitId, actionData) => {
        const id = uuidv4();
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, quickActions: [...u.quickActions, { ...actionData, id }] };
          }),
        }));
        return id;
      },

      updateQuickAction: (unitId, actionId, updates) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, quickActions: u.quickActions.map(a => a.id === actionId ? { ...a, ...updates } : a) };
          }),
        }));
      },

      deleteQuickAction: (unitId, actionId) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return { ...u, quickActions: u.quickActions.filter(a => a.id !== actionId) };
          }),
        }));
      },

      setCombatState: (newState) => {
        set(prev => ({ combatState: { ...prev.combatState, ...newState } }));
      },

      resetCombat: () => set({ combatState: DEFAULT_COMBAT_STATE }),

      addLog: (message, type = 'action') => {
        const entry: LogEntry = { timestamp: new Date(), message, type };
        set(state => ({ logs: [entry, ...state.logs].slice(0, 100) }));
      },

      clearLogs: () => set({ logs: [] }),

      updateSettings: (updates) => {
        set(state => ({ settings: { ...state.settings, ...updates } }));
      },

      setOwlbearReady: (ready) => set({ isOwlbearReady: ready }),
      setSyncing: (syncing) => set({ isSyncing: syncing }),
      setError: (error) => set({ lastError: error }),

      resetAll: () => {
        set({
          units: [], activeUnitId: null, settings: DEFAULT_SETTINGS,
          combatState: DEFAULT_COMBAT_STATE, logs: [], lastError: null,
        });
      },
    }),
    {
      name: 'cursed-hearts-storage-v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        units: state.units,
        activeUnitId: state.activeUnitId,
        activeTab: state.activeTab,
        settings: state.settings,
        logs: state.logs,
      }),
    }
  )
);
