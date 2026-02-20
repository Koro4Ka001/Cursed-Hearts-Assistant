// src/stores/useGameStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, AppSettings, RollModifier, ElementModifier } from '../types';
import { tokenBarService } from '../services/tokenBarService';

// ═══════════════════════════════════════════════════════════════════════════
// ГЕНЕРАТОР ID
// ═══════════════════════════════════════════════════════════════════════════

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ═══════════════════════════════════════════════════════════════════════════
// МИГРАЦИЯ ДАННЫХ
// ═══════════════════════════════════════════════════════════════════════════

const PHYSICAL_TYPES = ['slashing', 'piercing', 'bludgeoning', 'chopping', 'pure'];

function migrateUnit(unit: Unit): Unit {
  // Если уже есть elementModifiers и нет старых данных — ничего не делаем
  const hasOldData = (
    (unit.elementAffinities && unit.elementAffinities.length > 0) ||
    (unit.magicBonuses && Object.keys(unit.magicBonuses).length > 0) ||
    (unit.damageMultipliers && Object.keys(unit.damageMultipliers).some(k => !PHYSICAL_TYPES.includes(k)))
  );
  
  if (!hasOldData) {
    return {
      ...unit,
      elementModifiers: unit.elementModifiers ?? []
    };
  }
  
  console.log(`[MIGRATION] Migrating unit "${unit.name}" to new ElementModifier system...`);
  
  const modifiers: ElementModifier[] = [...(unit.elementModifiers ?? [])];
  const modifierMap = new Map<string, ElementModifier>();
  
  for (const mod of modifiers) {
    modifierMap.set(mod.element, mod);
  }
  
  const getOrCreateModifier = (element: string): ElementModifier => {
    if (!modifierMap.has(element)) {
      const newMod: ElementModifier = {
        id: generateId(),
        element,
        isActive: true,
        castBonus: 0,
        damageBonus: 0,
        damageBonusPercent: 0,
        manaReduction: 0,
        manaReductionPercent: 0,
        resistance: 0,
        damageMultiplier: 1,
        notes: ''
      };
      modifierMap.set(element, newMod);
      modifiers.push(newMod);
    }
    return modifierMap.get(element)!;
  };
  
  // Миграция из elementAffinities
  if (unit.elementAffinities) {
    for (const aff of unit.elementAffinities) {
      const mod = getOrCreateModifier(aff.element);
      switch (aff.bonusType) {
        case 'castHit': mod.castBonus += aff.value; break;
        case 'damage': mod.damageBonus += aff.value; break;
        case 'manaCost': mod.manaReduction += aff.value; break;
      }
    }
  }
  
  // Миграция из magicBonuses
  if (unit.magicBonuses) {
    for (const [element, bonus] of Object.entries(unit.magicBonuses)) {
      const mod = getOrCreateModifier(element);
      mod.castBonus += bonus;
    }
  }
  
  // Миграция из damageMultipliers (только магические)
  if (unit.damageMultipliers) {
    const physicalMults: Record<string, number> = {};
    for (const [type, mult] of Object.entries(unit.damageMultipliers)) {
      if (PHYSICAL_TYPES.includes(type)) {
        physicalMults[type] = mult;
      } else {
        const mod = getOrCreateModifier(type);
        mod.damageMultiplier = mult;
      }
    }
    if (Object.keys(physicalMults).length > 0) {
      unit.physicalMultipliers = physicalMults;
    }
  }
  
  console.log(`[MIGRATION] Created ${modifiers.length} element modifiers for "${unit.name}"`);
  
  return {
    ...unit,
    elementModifiers: modifiers,
    elementAffinities: undefined,
    magicBonuses: undefined
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

type TabId = 'combat' | 'magic' | 'cards' | 'actions' | 'notes' | 'settings';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

interface CombatLogEntry {
  id: string;
  unitName: string;
  action: string;
  details: string;  // ← App.tsx использует details, не result!
  timestamp: number;
}

interface Connections {
  docs: boolean;
  owlbear: boolean;
  dice: boolean;
  lastSyncTime?: number;
}

interface GameState {
  // Юниты
  units: Unit[];
  selectedUnitId: string | null;
  
  // UI - ВАЖНО! Эти поля используются в App.tsx
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  
  // Настройки
  settings: AppSettings;
  
  // UI состояние
  notifications: Notification[];
  combatLog: CombatLogEntry[];
  activeEffect: string | null;
  nextRollModifier: RollModifier;
  
  // Соединения
  connections: Connections;
  
  // Экшены — юниты
  addUnit: () => void;
  updateUnit: (id: string, updates: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  selectUnit: (id: string | null) => void;
  
  // Экшены — HP/Mana
  setHP: (unitId: string, value: number) => Promise<void>;
  setMana: (unitId: string, value: number) => Promise<void>;
  spendMana: (unitId: string, amount: number) => Promise<void>;
  healUnit: (unitId: string, amount: number) => Promise<void>;
  damageUnit: (unitId: string, amount: number) => Promise<void>;
  
  // Экшены — ресурсы
  updateResource: (unitId: string, resourceId: string, current: number) => void;
  
  // Экшены — настройки
  updateSettings: (updates: Partial<AppSettings>) => void;
  
  // Экшены — UI
  addNotification: (message: string, type?: Notification['type']) => void;
  clearNotification: (id: string) => void;
  addCombatLog: (unitName: string, action: string, details: string) => void;
  triggerEffect: (effect: string) => void;
  setNextRollModifier: (mod: RollModifier) => void;
  
  // Соединения
  setConnection: (type: keyof Omit<Connections, 'lastSyncTime'>, connected: boolean) => void;
  startAutoSync: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT UNIT
// ═══════════════════════════════════════════════════════════════════════════

function createDefaultUnit(): Unit {
  return {
    id: generateId(),
    name: 'Новый персонаж',
    shortName: 'Новый',
    googleDocsHeader: '',
    health: { current: 100, max: 100 },
    mana: { current: 50, max: 50 },
    stats: {
      physicalPower: 0,
      dexterity: 0,
      vitality: 0,
      intelligence: 0,
      charisma: 0,
      initiative: 0
    },
    proficiencies: {
      swords: 0,
      axes: 0,
      hammers: 0,
      polearms: 0,
      unarmed: 0,
      bows: 0
    },
    armor: {
      slashing: 0,
      piercing: 0,
      bludgeoning: 0,
      chopping: 0,
      magicBase: 0,
      undead: 0
    },
    elementModifiers: [],
    weapons: [],
    spells: [],
    resources: [],
    useManaAsHp: false
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // ═══ СОСТОЯНИЕ ═══
      units: [],
      selectedUnitId: null,
      activeTab: 'combat',  // ← ДОБАВЛЕНО
      settings: {
        syncHP: true,
        syncMana: true,
        syncResources: true,
        writeLogs: true,
        showTokenBars: true,
        autoSyncInterval: 5
      },
      notifications: [],
      combatLog: [],
      activeEffect: null,
      nextRollModifier: 'normal',
      connections: {
        docs: false,
        owlbear: false,
        dice: false,
        lastSyncTime: undefined
      },
      
      // ═══ TAB ═══
      setActiveTab: (tab) => set({ activeTab: tab }),  // ← ДОБАВЛЕНО
      
      // ═══ ЮНИТЫ ═══
      addUnit: () => {
        const newUnit = createDefaultUnit();
        set(state => ({
          units: [...state.units, newUnit],
          selectedUnitId: newUnit.id
        }));
      },
      
      updateUnit: (id, updates) => {
        set(state => ({
          units: state.units.map(u => u.id === id ? { ...u, ...updates } : u)
        }));
      },
      
      deleteUnit: (id) => {
        set(state => ({
          units: state.units.filter(u => u.id !== id),
          selectedUnitId: state.selectedUnitId === id ? null : state.selectedUnitId
        }));
      },
      
      selectUnit: (id) => set({ selectedUnitId: id }),
      
      // ═══ HP/MANA ═══
      setHP: async (unitId, value) => {
        const { units, settings } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        const newHP = Math.max(0, Math.min(value, unit.health.max));
        
        set(state => ({
          units: state.units.map(u => 
            u.id === unitId 
              ? { ...u, health: { ...u.health, current: newHP } }
              : u
          )
        }));
        
        if (settings.showTokenBars && unit.owlbearTokenId) {
          try {
            await tokenBarService.updateBars(unit.owlbearTokenId, {
              hp: { current: newHP, max: unit.health.max },
              mana: unit.useManaAsHp ? undefined : { current: unit.mana.current, max: unit.mana.max }
            });
          } catch (e) {
            console.warn('[Store] Failed to update token bars:', e);
          }
        }
      },
      
      setMana: async (unitId, value) => {
        const { units, settings } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        const newMana = Math.max(0, Math.min(value, unit.mana.max));
        
        set(state => ({
          units: state.units.map(u => 
            u.id === unitId 
              ? { ...u, mana: { ...u.mana, current: newMana } }
              : u
          )
        }));
        
        if (settings.showTokenBars && unit.owlbearTokenId) {
          try {
            await tokenBarService.updateBars(unit.owlbearTokenId, {
              hp: unit.useManaAsHp 
                ? { current: newMana, max: unit.mana.max } 
                : { current: unit.health.current, max: unit.health.max },
              mana: unit.useManaAsHp ? undefined : { current: newMana, max: unit.mana.max }
            });
          } catch (e) {
            console.warn('[Store] Failed to update token bars:', e);
          }
        }
      },
      
      spendMana: async (unitId, amount) => {
        const { units } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        const newMana = Math.max(0, unit.mana.current - amount);
        await get().setMana(unitId, newMana);
      },
      
      healUnit: async (unitId, amount) => {
        const { units } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        if (unit.useManaAsHp) {
          await get().setMana(unitId, unit.mana.current + amount);
        } else {
          await get().setHP(unitId, unit.health.current + amount);
        }
      },
      
      damageUnit: async (unitId, amount) => {
        const { units } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        if (unit.useManaAsHp) {
          await get().setMana(unitId, unit.mana.current - amount);
        } else {
          await get().setHP(unitId, unit.health.current - amount);
        }
      },
      
      // ═══ РЕСУРСЫ ═══
      updateResource: (unitId, resourceId, current) => {
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return {
              ...u,
              resources: u.resources.map(r => 
                r.id === resourceId ? { ...r, current } : r
              )
            };
          })
        }));
      },
      
      // ═══ НАСТРОЙКИ ═══
      updateSettings: (updates) => {
        set(state => ({
          settings: { ...state.settings, ...updates }
        }));
      },
      
      // ═══ UI ═══
      addNotification: (message, type = 'info') => {
        const notification: Notification = {
          id: generateId(),
          message,
          type,
          timestamp: Date.now()
        };
        set(state => ({
          notifications: [...state.notifications, notification].slice(-5)
        }));
        setTimeout(() => {
          get().clearNotification(notification.id);
        }, 4000);
      },
      
      clearNotification: (id) => {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }));
      },
      
      addCombatLog: (unitName, action, details) => {  // ← details вместо result
        const entry: CombatLogEntry = {
          id: generateId(),
          unitName,
          action,
          details,  // ← details
          timestamp: Date.now()
        };
        set(state => ({
          combatLog: [...state.combatLog, entry].slice(-50),
          connections: {
            ...state.connections,
            lastSyncTime: Date.now()
          }
        }));
      },
      
      triggerEffect: (effect) => {
        set({ activeEffect: effect });
        setTimeout(() => {
          set({ activeEffect: null });
        }, 500);
      },
      
      setNextRollModifier: (mod) => set({ nextRollModifier: mod }),
      
      // ═══ СОЕДИНЕНИЯ ═══
      setConnection: (type, connected) => {
        set(state => ({
          connections: { 
            ...state.connections, 
            [type]: connected,
            lastSyncTime: Date.now()
          }
        }));
      },
      
      startAutoSync: () => {
        const { settings } = get();
        if (!settings.googleDocsUrl) return;
        console.log('Auto-sync started with interval:', settings.autoSyncInterval);
      }
    }),
    {
      name: 'cursed-hearts-storage',
      version: 2,
      
      migrate: (persistedState: unknown, version: number) => {
        console.log(`[STORE] Migrating from version ${version} to 2`);
        const state = persistedState as GameState;
        
        if (version < 2) {
          const migratedUnits = state.units?.map(migrateUnit) ?? [];
          return {
            ...state,
            units: migratedUnits,
            activeTab: state.activeTab ?? 'combat',
            connections: {
              docs: state.connections?.docs ?? false,
              owlbear: state.connections?.owlbear ?? false,
              dice: false,
              lastSyncTime: undefined
            }
          };
        }
        return state;
      },
      
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.units = state.units.map(migrateUnit);
        }
      }
    }
  )
);
