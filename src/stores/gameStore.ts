import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Unit, Weapon, Spell, Resource, QuickAction, PluginSettings, ActionLog } from '@/types';

interface GameState {
  // Юниты
  units: Unit[];
  selectedUnitId: string | null;
  
  // Настройки
  settings: PluginSettings;
  
  // Логи
  logs: ActionLog[];
  
  // UI состояние
  activeTab: 'combat' | 'magic' | 'resources' | 'actions' | 'settings';
  isLoading: boolean;
  notification: { type: 'success' | 'error' | 'info'; message: string } | null;
  
  // Методы юнитов
  addUnit: (unit: Omit<Unit, 'id'>) => string;
  updateUnit: (id: string, updates: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  selectUnit: (id: string | null) => void;
  getSelectedUnit: () => Unit | null;
  
  // Методы оружия
  addWeapon: (unitId: string, weapon: Omit<Weapon, 'id'>) => void;
  updateWeapon: (unitId: string, weaponId: string, updates: Partial<Weapon>) => void;
  deleteWeapon: (unitId: string, weaponId: string) => void;
  
  // Методы заклинаний
  addSpell: (unitId: string, spell: Omit<Spell, 'id'>) => void;
  updateSpell: (unitId: string, spellId: string, updates: Partial<Spell>) => void;
  deleteSpell: (unitId: string, spellId: string) => void;
  
  // Методы ресурсов
  addResource: (unitId: string, resource: Omit<Resource, 'id'>) => void;
  updateResource: (unitId: string, resourceId: string, updates: Partial<Resource>) => void;
  deleteResource: (unitId: string, resourceId: string) => void;
  modifyResourceAmount: (unitId: string, resourceId: string, delta: number) => void;
  
  // Методы быстрых действий
  addQuickAction: (unitId: string, action: Omit<QuickAction, 'id'>) => void;
  updateQuickAction: (unitId: string, actionId: string, updates: Partial<QuickAction>) => void;
  deleteQuickAction: (unitId: string, actionId: string) => void;
  
  // HP и Mana
  setHealth: (unitId: string, current: number, max?: number) => void;
  setMana: (unitId: string, current: number, max?: number) => void;
  modifyHealth: (unitId: string, delta: number) => void;
  modifyMana: (unitId: string, delta: number) => void;
  
  // Настройки
  updateSettings: (updates: Partial<PluginSettings>) => void;
  
  // Логи
  addLog: (log: Omit<ActionLog, 'timestamp'>) => void;
  clearLogs: () => void;
  
  // UI
  setActiveTab: (tab: GameState['activeTab']) => void;
  setLoading: (loading: boolean) => void;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  clearNotification: () => void;
}

const createDefaultUnit = (): Omit<Unit, 'id'> => ({
  name: 'Новый персонаж',
  shortName: 'Персонаж',
  googleDocsHeader: '',
  health: { current: 100, max: 100 },
  mana: { current: 50, max: 50 },
  stats: {
    physicalPower: 0,
    dexterity: 0,
    intelligence: 0,
    vitality: 0,
    charisma: 0,
    initiative: 0,
  },
  weaponProficiencies: {
    swords: 0,
    axes: 0,
    hammers: 0,
    polearms: 0,
    unarmed: 0,
    bows: 0,
  },
  magicBonuses: {},
  weapons: [],
  spells: [],
  resources: [],
  quickActions: [],
});

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Начальное состояние
      units: [],
      selectedUnitId: null,
      settings: {
        googleWebAppUrl: '',
        autoSync: true,
        syncInterval: 30000,
      },
      logs: [],
      activeTab: 'combat',
      isLoading: false,
      notification: null,

      // Методы юнитов
      addUnit: (unitData) => {
        const id = uuidv4();
        const unit: Unit = { ...createDefaultUnit(), ...unitData, id };
        set((state) => ({ 
          units: [...state.units, unit],
          selectedUnitId: state.selectedUnitId || id,
        }));
        return id;
      },

      updateUnit: (id, updates) => {
        set((state) => ({
          units: state.units.map((u) => (u.id === id ? { ...u, ...updates } : u)),
        }));
      },

      deleteUnit: (id) => {
        set((state) => ({
          units: state.units.filter((u) => u.id !== id),
          selectedUnitId: state.selectedUnitId === id 
            ? (state.units.find(u => u.id !== id)?.id || null)
            : state.selectedUnitId,
        }));
      },

      selectUnit: (id) => set({ selectedUnitId: id }),

      getSelectedUnit: () => {
        const state = get();
        return state.units.find((u) => u.id === state.selectedUnitId) || null;
      },

      // Методы оружия
      addWeapon: (unitId, weapon) => {
        const newWeapon: Weapon = { ...weapon, id: uuidv4() };
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId ? { ...u, weapons: [...u.weapons, newWeapon] } : u
          ),
        }));
      },

      updateWeapon: (unitId, weaponId, updates) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? {
                  ...u,
                  weapons: u.weapons.map((w) =>
                    w.id === weaponId ? { ...w, ...updates } : w
                  ),
                }
              : u
          ),
        }));
      },

      deleteWeapon: (unitId, weaponId) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? { ...u, weapons: u.weapons.filter((w) => w.id !== weaponId) }
              : u
          ),
        }));
      },

      // Методы заклинаний
      addSpell: (unitId, spell) => {
        const newSpell: Spell = { ...spell, id: uuidv4() };
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId ? { ...u, spells: [...u.spells, newSpell] } : u
          ),
        }));
      },

      updateSpell: (unitId, spellId, updates) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? {
                  ...u,
                  spells: u.spells.map((s) =>
                    s.id === spellId ? { ...s, ...updates } : s
                  ),
                }
              : u
          ),
        }));
      },

      deleteSpell: (unitId, spellId) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? { ...u, spells: u.spells.filter((s) => s.id !== spellId) }
              : u
          ),
        }));
      },

      // Методы ресурсов
      addResource: (unitId, resource) => {
        const newResource: Resource = { ...resource, id: uuidv4() };
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId ? { ...u, resources: [...u.resources, newResource] } : u
          ),
        }));
      },

      updateResource: (unitId, resourceId, updates) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? {
                  ...u,
                  resources: u.resources.map((r) =>
                    r.id === resourceId ? { ...r, ...updates } : r
                  ),
                }
              : u
          ),
        }));
      },

      deleteResource: (unitId, resourceId) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? { ...u, resources: u.resources.filter((r) => r.id !== resourceId) }
              : u
          ),
        }));
      },

      modifyResourceAmount: (unitId, resourceId, delta) => {
        set((state) => ({
          units: state.units.map((u) =>
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

      // Методы быстрых действий
      addQuickAction: (unitId, action) => {
        const newAction: QuickAction = { ...action, id: uuidv4() };
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId ? { ...u, quickActions: [...u.quickActions, newAction] } : u
          ),
        }));
      },

      updateQuickAction: (unitId, actionId, updates) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? {
                  ...u,
                  quickActions: u.quickActions.map((a) =>
                    a.id === actionId ? { ...a, ...updates } : a
                  ),
                }
              : u
          ),
        }));
      },

      deleteQuickAction: (unitId, actionId) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? { ...u, quickActions: u.quickActions.filter((a) => a.id !== actionId) }
              : u
          ),
        }));
      },

      // HP и Mana
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

      modifyHealth: (unitId, delta) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? {
                  ...u,
                  health: {
                    ...u.health,
                    current: Math.max(0, Math.min(u.health.max, u.health.current + delta)),
                  },
                }
              : u
          ),
        }));
      },

      modifyMana: (unitId, delta) => {
        set((state) => ({
          units: state.units.map((u) =>
            u.id === unitId
              ? {
                  ...u,
                  mana: {
                    ...u.mana,
                    current: Math.max(0, Math.min(u.mana.max, u.mana.current + delta)),
                  },
                }
              : u
          ),
        }));
      },

      // Настройки
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      // Логи
      addLog: (log) => {
        set((state) => ({
          logs: [{ ...log, timestamp: new Date() }, ...state.logs].slice(0, 100),
        }));
      },

      clearLogs: () => set({ logs: [] }),

      // UI
      setActiveTab: (tab) => set({ activeTab: tab }),
      setLoading: (loading) => set({ isLoading: loading }),
      showNotification: (type, message) => set({ notification: { type, message } }),
      clearNotification: () => set({ notification: null }),
    }),
    {
      name: 'cursed-hearts-storage',
      partialize: (state) => ({
        units: state.units,
        selectedUnitId: state.selectedUnitId,
        settings: state.settings,
      }),
    }
  )
);
