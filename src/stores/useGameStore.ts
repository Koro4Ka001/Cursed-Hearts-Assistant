// src/stores/useGameStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, AppSettings, RollModifier, ElementModifier } from '../types';
import { tokenBarService } from '../services/tokenBarService';
import { docsService } from '../services/docsService';

// ═══════════════════════════════════════════════════════════════════════════
// ГЕНЕРАТОР ID
// ═══════════════════════════════════════════════════════════════════════════

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ═══════════════════════════════════════════════════════════════════════════
// UNDO СИСТЕМА
// ═══════════════════════════════════════════════════════════════════════════

interface UndoEntry {
  id: string;
  timestamp: number;
  description: string;
  type: 'hp' | 'mana' | 'resource';
  unitId: string;
  unitName: string;
  resourceId?: string;
  previousValue: number;
  newValue: number;
}

const MAX_UNDO_HISTORY = 20;

// ═══════════════════════════════════════════════════════════════════════════
// МИГРАЦИЯ ДАННЫХ
// ═══════════════════════════════════════════════════════════════════════════

const PHYSICAL_TYPES = ['slashing', 'piercing', 'bludgeoning', 'chopping', 'pure'];

function migrateUnit(unit: Unit): Unit {
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
  
  console.log(`[MIGRATION] Migrating unit "${unit.name}"...`);
  
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
  
  if (unit.magicBonuses) {
    for (const [element, bonus] of Object.entries(unit.magicBonuses)) {
      const mod = getOrCreateModifier(element);
      mod.castBonus += bonus;
    }
  }
  
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
  details: string;
  timestamp: number;
}

interface Connections {
  docs: boolean;
  owlbear: boolean;
  dice: boolean;
  lastSyncTime?: number;
}

interface GameState {
  units: Unit[];
  selectedUnitId: string | null;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  settings: AppSettings;
  notifications: Notification[];
  combatLog: CombatLogEntry[];
  activeEffect: string | null;
  nextRollModifier: RollModifier;
  undoHistory: UndoEntry[];
  connections: Connections;
  
  addUnit: () => void;
  updateUnit: (id: string, updates: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  selectUnit: (id: string | null) => void;
  
  setHP: (unitId: string, value: number) => Promise<void>;
  setMana: (unitId: string, value: number) => Promise<void>;
  spendMana: (unitId: string, amount: number) => Promise<void>;
  heal: (unitId: string, amount: number) => Promise<void>;
  takeDamage: (unitId: string, amount: number) => Promise<void>;
  setResource: (unitId: string, resourceId: string, current: number) => Promise<void>;
  spendResource: (unitId: string, resourceId: string, amount: number) => Promise<void>;
  
  undo: () => Promise<void>;
  clearUndoHistory: () => void;
  
  updateSettings: (updates: Partial<AppSettings>) => void;
  addNotification: (message: string, type?: Notification['type']) => void;
  clearNotification: (id: string) => void;
  addCombatLog: (unitName: string, action: string, details: string) => void;
  triggerEffect: (effect: string) => void;
  setNextRollModifier: (mod: RollModifier) => void;
  setConnection: (type: keyof Omit<Connections, 'lastSyncTime'>, connected: boolean) => void;
  startAutoSync: () => void;
  syncUnitToDocs: (unit: Unit) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function updateTokenBars(unit: Unit, settings: AppSettings): Promise<void> {
  if (!settings.showTokenBars || !unit.owlbearTokenId) return;
  
  try {
    await tokenBarService.updateBars(
      unit.owlbearTokenId,
      unit.useManaAsHp ? unit.mana.current : unit.health.current,
      unit.useManaAsHp ? unit.mana.max : unit.health.max,
      unit.mana.current,
      unit.mana.max,
      unit.useManaAsHp
    );
  } catch (e) {
    console.warn('[Store] Failed to update token bars:', e);
  }
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
      units: [],
      selectedUnitId: null,
      activeTab: 'combat',
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
      undoHistory: [],
      connections: {
        docs: false,
        owlbear: false,
        dice: false,
        lastSyncTime: undefined
      },
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
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
        
        const { units, settings } = get();
        const unit = units.find(u => u.id === id);
        if (unit && (updates.health || updates.mana)) {
          updateTokenBars(unit, settings);
        }
      },
      
      deleteUnit: (id) => {
        const unit = get().units.find(u => u.id === id);
        if (unit?.owlbearTokenId) {
          tokenBarService.removeBars(unit.owlbearTokenId);
        }
        
        set(state => ({
          units: state.units.filter(u => u.id !== id),
          selectedUnitId: state.selectedUnitId === id ? null : state.selectedUnitId
        }));
      },
      
      selectUnit: (id) => set({ selectedUnitId: id }),
      
      // ═══ HP ═══
      setHP: async (unitId, value) => {
        const { units, settings, connections } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        const previousValue = unit.health.current;
        const newHP = Math.max(0, Math.min(value, unit.health.max));
        
        // Undo entry
        const undoEntry: UndoEntry = {
          id: generateId(),
          timestamp: Date.now(),
          description: `${unit.shortName}: HP ${previousValue} → ${newHP}`,
          type: 'hp',
          unitId,
          unitName: unit.shortName ?? unit.name,
          previousValue,
          newValue: newHP
        };
        
        set(state => ({
          units: state.units.map(u => 
            u.id === unitId 
              ? { ...u, health: { ...u.health, current: newHP } }
              : u
          ),
          undoHistory: [undoEntry, ...state.undoHistory].slice(0, MAX_UNDO_HISTORY),
          connections: { ...state.connections, lastSyncTime: Date.now() }
        }));
        
        // Token bars
        const updatedUnit = { ...unit, health: { ...unit.health, current: newHP } };
        await updateTokenBars(updatedUnit, settings);
        
        // Google Docs sync
        if (connections.docs && settings.syncHP && unit.googleDocsHeader) {
          try {
            await docsService.setHealth(unit.googleDocsHeader, newHP, unit.health.max);
            console.log(`[Store] 📄 Synced HP to Docs: ${unit.shortName} = ${newHP}`);
          } catch (e) {
            console.warn('[Store] Docs sync HP failed:', e);
          }
        }
      },
      
      // ═══ MANA ═══
      setMana: async (unitId, value) => {
        const { units, settings, connections } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        const previousValue = unit.mana.current;
        const newMana = Math.max(0, Math.min(value, unit.mana.max));
        
        const undoEntry: UndoEntry = {
          id: generateId(),
          timestamp: Date.now(),
          description: `${unit.shortName}: Мана ${previousValue} → ${newMana}`,
          type: 'mana',
          unitId,
          unitName: unit.shortName ?? unit.name,
          previousValue,
          newValue: newMana
        };
        
        set(state => ({
          units: state.units.map(u => 
            u.id === unitId 
              ? { ...u, mana: { ...u.mana, current: newMana } }
              : u
          ),
          undoHistory: [undoEntry, ...state.undoHistory].slice(0, MAX_UNDO_HISTORY),
          connections: { ...state.connections, lastSyncTime: Date.now() }
        }));
        
        const updatedUnit = { ...unit, mana: { ...unit.mana, current: newMana } };
        await updateTokenBars(updatedUnit, settings);
        
        // Google Docs sync
        if (connections.docs && settings.syncMana && unit.googleDocsHeader) {
          try {
            await docsService.setMana(unit.googleDocsHeader, newMana, unit.mana.max);
            console.log(`[Store] 📄 Synced Mana to Docs: ${unit.shortName} = ${newMana}`);
          } catch (e) {
            console.warn('[Store] Docs sync Mana failed:', e);
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
      
      heal: async (unitId, amount) => {
        const { units } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        if (unit.useManaAsHp) {
          await get().setMana(unitId, unit.mana.current + amount);
        } else {
          await get().setHP(unitId, unit.health.current + amount);
        }
      },
      
      takeDamage: async (unitId, amount) => {
        const { units } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        if (unit.useManaAsHp) {
          await get().setMana(unitId, unit.mana.current - amount);
        } else {
          await get().setHP(unitId, unit.health.current - amount);
        }
      },
      
      // ═══ RESOURCES ═══
      setResource: async (unitId, resourceId, current) => {
        const { units, settings, connections } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        const resource = unit.resources.find(r => r.id === resourceId);
        if (!resource) return;
        
        const previousValue = resource.current;
        const newValue = Math.max(0, Math.min(current, resource.max));
        
        const undoEntry: UndoEntry = {
          id: generateId(),
          timestamp: Date.now(),
          description: `${unit.shortName}: ${resource.name} ${previousValue} → ${newValue}`,
          type: 'resource',
          unitId,
          unitName: unit.shortName ?? unit.name,
          resourceId,
          previousValue,
          newValue
        };
        
        set(state => ({
          units: state.units.map(u => {
            if (u.id !== unitId) return u;
            return {
              ...u,
              resources: u.resources.map(r => 
                r.id === resourceId ? { ...r, current: newValue } : r
              )
            };
          }),
          undoHistory: [undoEntry, ...state.undoHistory].slice(0, MAX_UNDO_HISTORY),
          connections: { ...state.connections, lastSyncTime: Date.now() }
        }));
        
        // Google Docs sync
        if (connections.docs && settings.syncResources && unit.googleDocsHeader && resource.syncWithDocs) {
          try {
            await docsService.setResource(unit.googleDocsHeader, resource.name, newValue, resource.max);
            console.log(`[Store] 📄 Synced Resource to Docs: ${resource.name} = ${newValue}`);
          } catch (e) {
            console.warn('[Store] Docs sync Resource failed:', e);
          }
        }
      },
      
      spendResource: async (unitId, resourceId, amount) => {
        const { units } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        const resource = unit.resources.find(r => r.id === resourceId);
        if (!resource) return;
        
        const newValue = Math.max(0, resource.current - amount);
        await get().setResource(unitId, resourceId, newValue);
      },
      
      // ═══ UNDO ═══
      undo: async () => {
        const { undoHistory, units, settings, addNotification } = get();
        
        if (undoHistory.length === 0) {
          addNotification('Нечего отменять', 'warning');
          return;
        }
        
        const [lastEntry, ...restHistory] = undoHistory;
        const unit = units.find(u => u.id === lastEntry.unitId);
        
        if (!unit) {
          set({ undoHistory: restHistory });
          addNotification('Юнит не найден, пропущено', 'warning');
          return;
        }
        
        // Откатываем БЕЗ добавления в undo историю
        switch (lastEntry.type) {
          case 'hp':
            set(state => ({
              units: state.units.map(u => 
                u.id === lastEntry.unitId 
                  ? { ...u, health: { ...u.health, current: lastEntry.previousValue } }
                  : u
              ),
              undoHistory: restHistory
            }));
            
            const updatedUnitHP = { ...unit, health: { ...unit.health, current: lastEntry.previousValue } };
            await updateTokenBars(updatedUnitHP, settings);
            
            // Синхронизируем откат в Docs
            if (get().connections.docs && settings.syncHP && unit.googleDocsHeader) {
              try {
                await docsService.setHealth(unit.googleDocsHeader, lastEntry.previousValue, unit.health.max);
              } catch {}
            }
            break;
            
          case 'mana':
            set(state => ({
              units: state.units.map(u => 
                u.id === lastEntry.unitId 
                  ? { ...u, mana: { ...u.mana, current: lastEntry.previousValue } }
                  : u
              ),
              undoHistory: restHistory
            }));
            
            const updatedUnitMana = { ...unit, mana: { ...unit.mana, current: lastEntry.previousValue } };
            await updateTokenBars(updatedUnitMana, settings);
            
            if (get().connections.docs && settings.syncMana && unit.googleDocsHeader) {
              try {
                await docsService.setMana(unit.googleDocsHeader, lastEntry.previousValue, unit.mana.max);
              } catch {}
            }
            break;
            
          case 'resource':
            const resource = unit.resources.find(r => r.id === lastEntry.resourceId);
            
            set(state => ({
              units: state.units.map(u => {
                if (u.id !== lastEntry.unitId) return u;
                return {
                  ...u,
                  resources: u.resources.map(r => 
                    r.id === lastEntry.resourceId 
                      ? { ...r, current: lastEntry.previousValue } 
                      : r
                  )
                };
              }),
              undoHistory: restHistory
            }));
            
            if (get().connections.docs && settings.syncResources && unit.googleDocsHeader && resource?.syncWithDocs) {
              try {
                await docsService.setResource(unit.googleDocsHeader, resource.name, lastEntry.previousValue, resource.max);
              } catch {}
            }
            break;
            
          default:
            set({ undoHistory: restHistory });
        }
        
        addNotification(`↩️ Отменено: ${lastEntry.description}`, 'info');
      },
      
      clearUndoHistory: () => {
        set({ undoHistory: [] });
        get().addNotification('История отмены очищена', 'info');
      },
      
      // ═══ SYNC UNIT TO DOCS ═══
      syncUnitToDocs: async (unit: Unit) => {
        const { settings, connections } = get();
        
        if (!connections.docs || !unit.googleDocsHeader) return;
        
        try {
          if (settings.syncHP) {
            await docsService.setHealth(unit.googleDocsHeader, unit.health.current, unit.health.max);
          }
          if (settings.syncMana) {
            await docsService.setMana(unit.googleDocsHeader, unit.mana.current, unit.mana.max);
          }
          if (settings.syncResources) {
            for (const resource of unit.resources) {
              if (resource.syncWithDocs) {
                await docsService.setResource(unit.googleDocsHeader, resource.name, resource.current, resource.max);
              }
            }
          }
          console.log(`[Store] 📄 Full sync to Docs: ${unit.shortName}`);
        } catch (e) {
          console.warn('[Store] Full sync failed:', e);
        }
      },
      
      // ═══ SETTINGS ═══
      updateSettings: (updates) => {
        set(state => ({
          settings: { ...state.settings, ...updates }
        }));
        
        if ('showTokenBars' in updates) {
          const { units, settings } = get();
          if (updates.showTokenBars) {
            tokenBarService.syncAllBars(units);
          } else {
            tokenBarService.removeAllBars();
          }
        }
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
      
      addCombatLog: (unitName, action, details) => {
        const { settings, connections } = get();
        
        const entry: CombatLogEntry = {
          id: generateId(),
          unitName,
          action,
          details,
          timestamp: Date.now()
        };
        
        set(state => ({
          combatLog: [...state.combatLog, entry].slice(-50),
          connections: {
            ...state.connections,
            lastSyncTime: Date.now()
          }
        }));
        
        // Логируем в Google Docs
        if (connections.docs && settings.writeLogs) {
          const units = get().units;
          const unit = units.find(u => u.shortName === unitName || u.name === unitName);
          if (unit?.googleDocsHeader) {
            docsService.log(unit.googleDocsHeader, `${action}: ${details}`).catch(() => {});
          }
        }
      },
      
      triggerEffect: (effect) => {
        set({ activeEffect: effect });
        setTimeout(() => {
          set({ activeEffect: null });
        }, 500);
      },
      
      setNextRollModifier: (mod) => set({ nextRollModifier: mod }),
      
      // ═══ CONNECTIONS ═══
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
        
        console.log('[Store] Starting auto-sync with interval:', settings.autoSyncInterval, 'min');
        
        // Синхронизируем сразу
        const { units, connections } = get();
        if (connections.docs) {
          for (const unit of units) {
            if (unit.googleDocsHeader) {
              get().syncUnitToDocs(unit);
            }
          }
        }
      }
    }),
    {
      name: 'cursed-hearts-storage',
      version: 3,
      
      migrate: (persistedState: unknown, version: number) => {
        console.log(`[STORE] Migrating from version ${version} to 3`);
        const state = persistedState as GameState;
        
        if (version < 3) {
          return {
            ...state,
            units: state.units?.map(migrateUnit) ?? [],
            undoHistory: [],
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
          state.undoHistory = state.undoHistory ?? [];
        }
      }
    }
  )
);
