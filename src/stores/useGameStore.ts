// src/stores/useGameStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, AppSettings, RollModifier, ElementModifier, ElementAffinity } from '../types';
import { tokenBarService } from '../services/tokenBarService';
import { docsService } from '../services/docsService';

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
    (unit.armor?.magicOverrides && Object.keys(unit.armor.magicOverrides).length > 0) ||
    (unit.damageMultipliers && Object.keys(unit.damageMultipliers).some(k => !PHYSICAL_TYPES.includes(k)))
  );
  
  if (!hasOldData) {
    // Просто убеждаемся что elementModifiers есть
    return {
      ...unit,
      elementModifiers: unit.elementModifiers ?? []
    };
  }
  
  console.log(`[MIGRATION] Migrating unit "${unit.name}" to new ElementModifier system...`);
  
  const modifiers: ElementModifier[] = [...(unit.elementModifiers ?? [])];
  const modifierMap = new Map<string, ElementModifier>();
  
  // Индексируем существующие
  for (const mod of modifiers) {
    modifierMap.set(mod.element, mod);
  }
  
  // Хелпер: получить или создать модификатор
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
  
  // 1. Миграция из elementAffinities
  if (unit.elementAffinities) {
    for (const aff of unit.elementAffinities) {
      const mod = getOrCreateModifier(aff.element);
      switch (aff.bonusType) {
        case 'castHit':
          mod.castBonus += aff.value;
          break;
        case 'damage':
          mod.damageBonus += aff.value;
          break;
        case 'manaCost':
          mod.manaReduction += aff.value;
          break;
      }
    }
  }
  
  // 2. Миграция из magicBonuses (добавляем к castBonus)
  if (unit.magicBonuses) {
    for (const [element, bonus] of Object.entries(unit.magicBonuses)) {
      const mod = getOrCreateModifier(element);
      mod.castBonus += bonus;
    }
  }
  
  // 3. Миграция из armor.magicOverrides
  if (unit.armor?.magicOverrides) {
    for (const [element, value] of Object.entries(unit.armor.magicOverrides)) {
      const mod = getOrCreateModifier(element);
      mod.resistance = value;
    }
  }
  
  // 4. Миграция из damageMultipliers (только магические)
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
    
    // Физические множители сохраняем отдельно
    if (Object.keys(physicalMults).length > 0) {
      unit.physicalMultipliers = physicalMults;
    }
  }
  
  console.log(`[MIGRATION] Created ${modifiers.length} element modifiers for "${unit.name}"`);
  
  // Убираем старые поля (но TypeScript их оставит для совместимости)
  const migratedUnit: Unit = {
    ...unit,
    elementModifiers: modifiers,
    // Очищаем старые данные
    elementAffinities: undefined,
    magicBonuses: undefined,
    damageMultipliers: unit.physicalMultipliers ? undefined : unit.damageMultipliers,
    armor: {
      ...unit.armor,
      magicOverrides: undefined
    }
  };
  
  return migratedUnit;
}

// ═══════════════════════════════════════════════════════════════════════════
// ИНТЕРФЕЙС STORE
// ═══════════════════════════════════════════════════════════════════════════

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
  result: string;
  timestamp: number;
}

interface GameState {
  // Юниты
  units: Unit[];
  selectedUnitId: string | null;
  
  // Настройки
  settings: AppSettings;
  
  // UI состояние
  notifications: Notification[];
  combatLog: CombatLogEntry[];
  activeEffect: string | null;
  nextRollModifier: RollModifier;
  
  // Соединения
  connections: {
    docs: boolean;
    owlbear: boolean;
  };
  
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
  addCombatLog: (unitName: string, action: string, result: string) => void;
  triggerEffect: (effect: string) => void;
  setNextRollModifier: (mod: RollModifier) => void;
  
  // Соединения
  setConnection: (type: 'docs' | 'owlbear', connected: boolean) => void;
  startAutoSync: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// СОЗДАНИЕ STORE
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

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // ═══ СОСТОЯНИЕ ═══
      units: [],
      selectedUnitId: null,
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
        owlbear: false
      },
      
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
      
      selectUnit: (id) => {
        set({ selectedUnitId: id });
      },
      
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
        
        // Обновляем бары на сцене
        if (settings.showTokenBars && unit.owlbearTokenId) {
          await tokenBarService.updateBars(unit.owlbearTokenId, {
            hp: { current: newHP, max: unit.health.max },
            mana: unit.useManaAsHp ? undefined : { current: unit.mana.current, max: unit.mana.max }
          });
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
        
        // Обновляем бары
        if (settings.showTokenBars && unit.owlbearTokenId) {
          await tokenBarService.updateBars(unit.owlbearTokenId, {
            hp: unit.useManaAsHp ? { current: newMana, max: unit.mana.max } : { current: unit.health.current, max: unit.health.max },
            mana: unit.useManaAsHp ? undefined : { current: newMana, max: unit.mana.max }
          });
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
        
        // Автоудаление через 4 сек
        setTimeout(() => {
          get().clearNotification(notification.id);
        }, 4000);
      },
      
      clearNotification: (id) => {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }));
      },
      
      addCombatLog: (unitName, action, result) => {
        const entry: CombatLogEntry = {
          id: generateId(),
          unitName,
          action,
          result,
          timestamp: Date.now()
        };
        set(state => ({
          combatLog: [...state.combatLog, entry].slice(-50)
        }));
      },
      
      triggerEffect: (effect) => {
        set({ activeEffect: effect });
        setTimeout(() => {
          set({ activeEffect: null });
        }, 500);
      },
      
      setNextRollModifier: (mod) => {
        set({ nextRollModifier: mod });
      },
      
      // ═══ СОЕДИНЕНИЯ ═══
      
      setConnection: (type, connected) => {
        set(state => ({
          connections: { ...state.connections, [type]: connected }
        }));
      },
      
      startAutoSync: () => {
        const { settings } = get();
        if (!settings.googleDocsUrl) return;
        
        // TODO: Implement auto-sync
        console.log('Auto-sync started with interval:', settings.autoSyncInterval);
      }
    }),
    {
      name: 'cursed-hearts-storage',
      version: 2, // Увеличиваем версию для миграции
      
      // Миграция при загрузке
      migrate: (persistedState: unknown, version: number) => {
        console.log(`[STORE] Migrating from version ${version} to 2`);
        
        const state = persistedState as GameState;
        
        if (version < 2) {
          // Мигрируем все юниты
          const migratedUnits = state.units.map(migrateUnit);
          return {
            ...state,
            units: migratedUnits
          };
        }
        
        return state;
      },
      
      // После загрузки тоже проверяем миграцию (на всякий случай)
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.units = state.units.map(migrateUnit);
        }
      }
    }
  )
);
