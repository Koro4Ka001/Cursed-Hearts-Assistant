// src/stores/useGameStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, AppSettings, RollModifier, ElementModifier, RageEffect } from '../types';
import { tokenBarService } from '../services/tokenBarService';
import { docsService } from '../services/docsService';

// ═══════════════════════════════════════════════════════════════
// ГЕНЕРАТОР ID
// ═══════════════════════════════════════════════════════════════

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ═══════════════════════════════════════════════════════════════
// UNDO СИСТЕМА
// ═══════════════════════════════════════════════════════════════

interface UndoEntry {
  id: string;
  timestamp: number;
  description: string;
  type: 'hp' | 'mana' | 'resource' | 'rage';
  unitId: string;
  unitName: string;
  resourceId?: string;
  previousValue: number;
  newValue: number;
}

const MAX_UNDO_HISTORY = 20;

// ═══════════════════════════════════════════════════════════════
// МИГРАЦИЯ ДАННЫХ
// ═══════════════════════════════════════════════════════════════

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
      elementModifiers: unit.elementModifiers ?? [],
      hasRage: unit.hasRage ?? false,
      rage: unit.rage ?? { current: 0, max: 100 },
      rageConfig: unit.rageConfig ?? { onTakeDamage: 5, onArmorBlock: 2, onDealDamage: 4, max: 100 },
      rageEffects: unit.rageEffects ?? [],
      activeRageEffects: unit.activeRageEffects ?? [],
      notes: unit.notes ?? ''
    };
  }
  
  console.log(`[MIGRATION] Migrating unit "${unit.name}"...`);
  
  const modifiers: ElementModifier[] = [...(unit.elementModifiers ?? [])];
  const modifierMap = new Map<string, ElementModifier>();
  for (const mod of modifiers) modifierMap.set(mod.element, mod);
  
  const getOrCreateModifier = (element: string): ElementModifier => {
    if (!modifierMap.has(element)) {
      const newMod: ElementModifier = {
        id: generateId(), element, isActive: true,
        castBonus: 0, damageBonus: 0, damageBonusPercent: 0,
        manaReduction: 0, manaReductionPercent: 0,
        resistance: 0, damageMultiplier: 1, notes: ''
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
      getOrCreateModifier(element).castBonus += bonus;
    }
  }
  
  if (unit.damageMultipliers) {
    const physicalMults: Record<string, number> = {};
    for (const [type, mult] of Object.entries(unit.damageMultipliers)) {
      if (PHYSICAL_TYPES.includes(type)) {
        physicalMults[type] = mult;
      } else {
        getOrCreateModifier(type).damageMultiplier = mult;
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
    magicBonuses: undefined,
    hasRage: unit.hasRage ?? false,
    rage: unit.rage ?? { current: 0, max: 100 },
    rageConfig: unit.rageConfig ?? { onTakeDamage: 5, onArmorBlock: 2, onDealDamage: 4, max: 100 },
    rageEffects: unit.rageEffects ?? [],
    activeRageEffects: unit.activeRageEffects ?? [],
    notes: unit.notes ?? ''
  };
}

// ═══════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════

type TabId = 'combat' | 'magic' | 'actions' | 'rage' | 'notes' | 'settings';

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
  setRage: (unitId: string, value: number) => Promise<void>;
  addRage: (unitId: string, amount: number) => Promise<void>;
  spendRage: (unitId: string, amount: number) => Promise<void>;
  resetRage: (unitId: string) => Promise<void>;
  spendMana: (unitId: string, amount: number) => Promise<void>;
  heal: (unitId: string, amount: number) => Promise<void>;
  takeDamage: (unitId: string, amount: number) => Promise<void>;
  setResource: (unitId: string, resourceId: string, current: number) => Promise<void>;
  spendResource: (unitId: string, resourceId: string, amount: number) => Promise<void>;
  setNotes: (unitId: string, notes: string) => void;
  
  activateRageEffect: (unitId: string, effect: RageEffect) => Promise<void>;
  decrementRageEffects: (unitId: string) => Promise<void>;
  removeActiveRageEffect: (unitId: string, effectId: string) => Promise<void>;
  
  undo: () => Promise<void>;
  clearUndoHistory: () => void;
  
  pullStatsFromDocs: (unitId: string) => Promise<void>;
  pullAllFromDocs: () => Promise<void>;
  
  syncUnitToDocs: (unit: Unit) => Promise<void>;
  
  updateSettings: (updates: Partial<AppSettings>) => void;
  addNotification: (message: string, type?: Notification['type']) => void;
  clearNotification: (id: string) => void;
  addCombatLog: (unitName: string, action: string, details: string) => void;
  triggerEffect: (effect: string) => void;
  setNextRollModifier: (mod: RollModifier) => void;
  setConnection: (type: keyof Omit<Connections, 'lastSyncTime'>, connected: boolean) => void;
  startAutoSync: () => void;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

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

function ensureDocsUrl(settings: AppSettings): boolean {
  if (!settings.googleDocsUrl) return false;
  if (docsService.getUrl() !== settings.googleDocsUrl) {
    docsService.setUrl(settings.googleDocsUrl);
    console.log('[Store] 📄 docsService URL synced from settings');
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT UNIT
// ═══════════════════════════════════════════════════════════════

function createDefaultUnit(): Unit {
  return {
    id: generateId(),
    name: 'Новый персонаж',
    shortName: 'Новый',
    googleDocsHeader: '',
    health: { current: 100, max: 100 },
    mana: { current: 50, max: 50 },
    rage: { current: 0, max: 100 },
    hasRage: false,
    rageConfig: { onTakeDamage: 5, onArmorBlock: 2, onDealDamage: 4, max: 100 },
    rageEffects: [],
    activeRageEffects: [],
    notes: '',
    stats: {
      physicalPower: 0, dexterity: 0, vitality: 0,
      intelligence: 0, charisma: 0, initiative: 0
    },
    proficiencies: {
      swords: 0, axes: 0, hammers: 0,
      polearms: 0, unarmed: 0, bows: 0
    },
    armor: {
      slashing: 0, piercing: 0, bludgeoning: 0,
      chopping: 0, magicBase: 0, undead: 0
    },
    elementModifiers: [],
    weapons: [],
    spells: [],
    resources: [],
    useManaAsHp: false
  };
}

// ═══════════════════════════════════════════════════════════════
// АВТО-СИНХРОНИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════

let autoSyncIntervalId: ReturnType<typeof setInterval> | null = null;

// ═══════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      units: [],
      selectedUnitId: null,
      activeTab: 'combat',
      settings: {
        syncHP: true,
        syncMana: true,
        syncRage: true,
        syncResources: true,
        writeLogs: true,
        showTokenBars: true,
        autoSyncInterval: 5,
        showRokCards: false
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
      
      addUnit: () => {
        const newUnit = createDefaultUnit();
        set(state => ({
          units: [...state.units, newUnit],
          selectedUnitId: newUnit.id
        }));
      },
      
      updateUnit: (id, updates) => {
        console.log('[Store] updateUnit:', id, updates);
        set(state => ({
          units: state.units.map(u => u.id === id ? { ...u, ...updates } : u)
        }));
        
        const { units, settings } = get();
        const unit = units.find(u => u.id === id);
        if (unit && (updates.health || updates.mana || updates.rage)) {
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
      
      setHP: async (unitId, value) => {
        const { units, settings, connections } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        const previousValue = unit.health.current;
        const newHP = Math.max(0, Math.min(value, unit.health.max));
        
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
            u.id === unitId ? { ...u, health: { ...u.health, current: newHP } } : u
          ),
          undoHistory: [undoEntry, ...state.undoHistory].slice(0, MAX_UNDO_HISTORY),
          connections: { ...state.connections, lastSyncTime: Date.now() }
        }));
        
        const updatedUnit = { ...unit, health: { ...unit.health, current: newHP } };
        await updateTokenBars(updatedUnit, settings);
        
        if (connections.docs && settings.syncHP && unit.googleDocsHeader) {
          if (!ensureDocsUrl(settings)) return;
          try {
            const result = await docsService.setHealth(unit.googleDocsHeader, newHP, unit.health.max);
            if (result.success) {
              console.log(`[Store] 📄 Synced HP to Docs: ${unit.shortName} = ${newHP}`);
            }
          } catch (e) {
            console.warn('[Store] Docs sync HP exception:', e);
          }
        }
      },
      
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
            u.id === unitId ? { ...u, mana: { ...u.mana, current: newMana } } : u
          ),
          undoHistory: [undoEntry, ...state.undoHistory].slice(0, MAX_UNDO_HISTORY),
          connections: { ...state.connections, lastSyncTime: Date.now() }
        }));
        
        const updatedUnit = { ...unit, mana: { ...unit.mana, current: newMana } };
        await updateTokenBars(updatedUnit, settings);
        
        if (connections.docs && settings.syncMana && unit.googleDocsHeader) {
          if (!ensureDocsUrl(settings)) return;
          try {
            const result = await docsService.setMana(unit.googleDocsHeader, newMana, unit.mana.max);
            if (result.success) {
              console.log(`[Store] 📄 Synced Mana to Docs: ${unit.shortName} = ${newMana}`);
            }
          } catch (e) {
            console.warn('[Store] Docs sync Mana exception:', e);
          }
        }
      },
      
      spendMana: async (unitId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit) return;
        await get().setMana(unitId, unit.mana.current - amount);
      },
      
      setRage: async (unitId, value) => {
        const { units, settings, connections } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit || !unit.hasRage) return;
        
        const previousValue = unit.rage?.current ?? 0;
        const max = unit.rage?.max ?? unit.rageConfig?.max ?? 100;
        const newRage = Math.max(0, Math.min(value, max));
        
        console.log(`[Store] 🔥 setRage: ${unit.shortName} ${previousValue} → ${newRage}`);
        
        const undoEntry: UndoEntry = {
          id: generateId(),
          timestamp: Date.now(),
          description: `${unit.shortName}: Rage ${previousValue} → ${newRage}`,
          type: 'rage',
          unitId,
          unitName: unit.shortName ?? unit.name,
          resourceId: 'rage',
          previousValue,
          newValue: newRage
        };
        
        set(state => ({
          units: state.units.map(u => 
            u.id === unitId 
              ? { ...u, rage: { ...(u.rage ?? { current: 0, max }), current: newRage } } 
              : u
          ),
          undoHistory: [undoEntry, ...state.undoHistory].slice(0, MAX_UNDO_HISTORY),
          connections: { ...state.connections, lastSyncTime: Date.now() }
        }));
        
        if (connections.docs && settings.syncRage && unit.googleDocsHeader) {
          if (!ensureDocsUrl(settings)) return;
          try {
            const result = await docsService.setRage(unit.googleDocsHeader, newRage, max);
            if (result.success) {
              console.log(`[Store] 🔥 Synced Rage to Docs: ${unit.shortName} = ${newRage}`);
            } else {
              console.warn(`[Store] 🔥 Docs sync Rage failed: ${result.error}`);
              if (result.error?.includes('Unknown POST action')) {
                console.warn('[Store] 🔥 Google Apps Script needs redeploy! Rage sync unavailable until redeployed.');
              }
            }
          } catch (e) {
            console.error('[Store] 🔥 Docs sync Rage exception:', e);
          }
        }
      },
      
      addRage: async (unitId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit || !unit.hasRage) return;
        const current = unit.rage?.current ?? 0;
        const max = unit.rage?.max ?? unit.rageConfig?.max ?? 100;
        await get().setRage(unitId, Math.min(current + amount, max));
      },
      
      spendRage: async (unitId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit || !unit.hasRage) return;
        await get().setRage(unitId, (unit.rage?.current ?? 0) - amount);
      },
      
      resetRage: async (unitId) => {
        await get().setRage(unitId, 0);
      },
      
      activateRageEffect: async (unitId, effect) => {
        const { units } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit || !unit.hasRage) return;
        
        const currentRage = unit.rage?.current ?? 0;
        if (currentRage < effect.cost) {
          get().addNotification(`Недостаточно Rage! Нужно ${effect.cost}`, 'warning');
          return;
        }
        
        await get().spendRage(unitId, effect.cost);
        
        const activeEffect = { ...effect, currentRounds: effect.durationRounds };
        const newActiveEffects = [...(unit.activeRageEffects ?? []), activeEffect];
        
        // Применяем бонусы характеристик от эффекта
        const statsUpdate: Partial<Unit['stats']> = {};
        for (const entry of effect.effects) {
          if (entry.type === 'modify_stat' && entry.statKey && entry.statValue) {
            const currentVal = unit.stats[entry.statKey] ?? 0;
            statsUpdate[entry.statKey] = currentVal + entry.statValue;
          }
        }
        
        console.log('[Store] 🔥 Activating rage effect:', effect.name, 'stat bonuses:', statsUpdate);
        
        set(state => ({
          units: state.units.map(u => 
            u.id === unitId 
              ? { 
                  ...u, 
                  activeRageEffects: newActiveEffects,
                  stats: { ...u.stats, ...statsUpdate }
                } 
              : u
          )
        }));
        
        get().addNotification(`🔥 Активировано: ${effect.name}`, 'success');
      },
      
      decrementRageEffects: async (unitId) => {
        const { units } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        const activeEffects = unit.activeRageEffects ?? [];
        const remainingEffects = activeEffects
          .map(e => ({ ...e, currentRounds: e.currentRounds - 1 }))
          .filter(e => e.currentRounds > 0);
        
        const expiredEffects = activeEffects.filter(e => {
          const decremented = e.currentRounds - 1;
          return decremented <= 0;
        });
        
        // Откатываем бонусы характеристик от истёкших эффектов
        const statsUpdate: Partial<Unit['stats']> = {};
        for (const expired of expiredEffects) {
          for (const entry of expired.effects) {
            if (entry.type === 'modify_stat' && entry.statKey && entry.statValue) {
              const currentVal = unit.stats[entry.statKey] ?? 0;
              statsUpdate[entry.statKey] = currentVal - entry.statValue;
            }
          }
        }
        
        if (expiredEffects.length > 0) {
          get().addNotification('⏳ Эффект Rage закончился', 'info');
        }
        
        set(state => ({
          units: state.units.map(u => 
            u.id === unitId 
              ? { ...u, activeRageEffects: remainingEffects, stats: { ...u.stats, ...statsUpdate } }
              : u
          )
        }));
      },
      
      removeActiveRageEffect: async (unitId, effectId) => {
        const { units } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        
        const removedEffect = (unit.activeRageEffects ?? []).find(e => e.id === effectId);
        
        // Откатываем бонусы характеристик
        const statsUpdate: Partial<Unit['stats']> = {};
        if (removedEffect) {
          for (const entry of removedEffect.effects) {
            if (entry.type === 'modify_stat' && entry.statKey && entry.statValue) {
              const currentVal = unit.stats[entry.statKey] ?? 0;
              statsUpdate[entry.statKey] = currentVal - entry.statValue;
            }
          }
        }
        
        set(state => ({
          units: state.units.map(u => 
            u.id === unitId 
              ? { 
                  ...u, 
                  activeRageEffects: (u.activeRageEffects ?? []).filter(e => e.id !== effectId),
                  stats: { ...u.stats, ...statsUpdate }
                } 
              : u
          )
        }));
      },
      
      setNotes: (unitId, notes) => {
        set(state => ({
          units: state.units.map(u => 
            u.id === unitId ? { ...u, notes } : u
          )
        }));
      },
      
      heal: async (unitId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit) return;
        if (unit.useManaAsHp) {
          await get().setMana(unitId, unit.mana.current + amount);
        } else {
          await get().setHP(unitId, unit.health.current + amount);
        }
      },
      
      takeDamage: async (unitId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit) return;
        if (unit.useManaAsHp) {
          await get().setMana(unitId, unit.mana.current - amount);
        } else {
          await get().setHP(unitId, unit.health.current - amount);
        }
      },
      
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
        
        if (connections.docs && settings.syncResources && unit.googleDocsHeader && resource.syncWithDocs) {
          if (!ensureDocsUrl(settings)) return;
          try {
            await docsService.setResource(unit.googleDocsHeader, resource.name, newValue, resource.max);
          } catch (e) {
            console.warn('[Store] Docs sync Resource failed:', e);
          }
        }
      },
      
      spendResource: async (unitId, resourceId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit) return;
        const resource = unit.resources.find(r => r.id === resourceId);
        if (!resource) return;
        await get().setResource(unitId, resourceId, resource.current - amount);
      },
      
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
          addNotification('Юнит не найден', 'warning');
          return;
        }
        
        ensureDocsUrl(settings);
        
        switch (lastEntry.type) {
          case 'hp': {
            set(state => ({
              units: state.units.map(u => 
                u.id === lastEntry.unitId 
                  ? { ...u, health: { ...u.health, current: lastEntry.previousValue } } : u
              ),
              undoHistory: restHistory
            }));
            await updateTokenBars({ ...unit, health: { ...unit.health, current: lastEntry.previousValue } }, settings);
            if (get().connections.docs && settings.syncHP && unit.googleDocsHeader) {
              try { await docsService.setHealth(unit.googleDocsHeader, lastEntry.previousValue, unit.health.max); } catch {}
            }
            break;
          }
          case 'mana': {
            set(state => ({
              units: state.units.map(u => 
                u.id === lastEntry.unitId 
                  ? { ...u, mana: { ...u.mana, current: lastEntry.previousValue } } : u
              ),
              undoHistory: restHistory
            }));
            await updateTokenBars({ ...unit, mana: { ...unit.mana, current: lastEntry.previousValue } }, settings);
            if (get().connections.docs && settings.syncMana && unit.googleDocsHeader) {
              try { await docsService.setMana(unit.googleDocsHeader, lastEntry.previousValue, unit.mana.max); } catch {}
            }
            break;
          }
          case 'rage': {
            set(state => ({
              units: state.units.map(u => 
                u.id === lastEntry.unitId 
                  ? { ...u, rage: { ...(u.rage ?? { current: 0, max: 100 }), current: lastEntry.previousValue } } : u
              ),
              undoHistory: restHistory
            }));
            if (get().connections.docs && settings.syncRage && unit.googleDocsHeader) {
              try { await docsService.setRage(unit.googleDocsHeader, lastEntry.previousValue, unit.rage?.max ?? 100); } catch {}
            }
            break;
          }
          case 'resource': {
            const resource = unit.resources.find(r => r.id === lastEntry.resourceId);
            set(state => ({
              units: state.units.map(u => {
                if (u.id !== lastEntry.unitId) return u;
                return { ...u, resources: u.resources.map(r => 
                  r.id === lastEntry.resourceId ? { ...r, current: lastEntry.previousValue } : r
                )};
              }),
              undoHistory: restHistory
            }));
            if (get().connections.docs && settings.syncResources && unit.googleDocsHeader && resource?.syncWithDocs) {
              try { await docsService.setResource(unit.googleDocsHeader, resource.name, lastEntry.previousValue, resource.max); } catch {}
            }
            break;
          }
          default:
            set({ undoHistory: restHistory });
        }
        
        addNotification(`↩️ Отменено: ${lastEntry.description}`, 'info');
      },
      
      clearUndoHistory: () => {
        set({ undoHistory: [] });
        get().addNotification('История отмены очищена', 'info');
      },
      
      pullStatsFromDocs: async (unitId: string) => {
        const { units, settings, connections } = get();
        const unit = units.find(u => u.id === unitId);
        if (!unit || !unit.googleDocsHeader || !connections.docs) {
          console.log('[Store] 📥 pullStatsFromDocs skipped:', { 
            hasUnit: !!unit, 
            hasHeader: !!unit?.googleDocsHeader, 
            hasDocs: connections.docs 
          });
          return;
        }
        
        if (!ensureDocsUrl(settings)) return;
        
        try {
          console.log('[Store] 📥 Pulling stats from Docs for:', unit.shortName);
          const stats = await docsService.getStats(unit.googleDocsHeader);
          
          console.log('[Store] 📥 Docs response:', stats);
          
          if (!stats.success) {
            console.warn(`[Store] 📥 Pull failed for ${unit.shortName}: ${stats.error}`);
            return;
          }
          
          const updates: Partial<Unit> = {};
          let changed = false;
          
          if (stats.health && settings.syncHP) {
            if (stats.health.current !== unit.health.current || stats.health.max !== unit.health.max) {
              updates.health = { current: stats.health.current, max: stats.health.max };
              changed = true;
              console.log('[Store] 📥 HP changed:', unit.health.current, '→', stats.health.current);
            }
          }
          
          if (stats.mana && settings.syncMana) {
            if (stats.mana.current !== unit.mana.current || stats.mana.max !== unit.mana.max) {
              updates.mana = { current: stats.mana.current, max: stats.mana.max };
              changed = true;
              console.log('[Store] 📥 Mana changed:', unit.mana.current, '→', stats.mana.current);
            }
          }
          
          if (stats.rage && settings.syncRage && unit.hasRage) {
            console.log('[Store] 📥 Rage from docs:', stats.rage);
            if (stats.rage.current !== (unit.rage?.current ?? 0) || stats.rage.max !== (unit.rage?.max ?? 100)) {
              updates.rage = { current: stats.rage.current, max: stats.rage.max };
              changed = true;
              console.log('[Store] 📥 Rage changed:', unit.rage?.current, '→', stats.rage.current);
            }
          }
          
          if (stats.resources && settings.syncResources) {
            let resourcesChanged = false;
            const updatedResources = unit.resources.map(r => {
              if (r.syncWithDocs && stats.resources?.[r.name]) {
                const docsVal = stats.resources[r.name];
                if (docsVal.current !== r.current || docsVal.max !== r.max) {
                  resourcesChanged = true;
                  return { ...r, current: docsVal.current, max: docsVal.max };
                }
              }
              return r;
            });
            if (resourcesChanged) {
              changed = true;
              updates.resources = updatedResources;
            }
          }
          
          if (changed) {
            console.log('[Store] 📥 Applying updates:', updates);
            set(state => ({
              units: state.units.map(u => u.id === unitId ? { ...u, ...updates } : u),
              connections: { ...state.connections, lastSyncTime: Date.now() }
            }));
            
            const updatedUnit = { ...unit, ...updates } as Unit;
            await updateTokenBars(updatedUnit, settings);
            
            console.log(
              `[Store] 📥 Pulled from Docs: ${unit.shortName}`,
              `HP=${stats.health?.current}/${stats.health?.max}`,
              `Mana=${stats.mana?.current}/${stats.mana?.max}`,
              `Rage=${stats.rage?.current}/${stats.rage?.max}`
            );
          } else {
            console.log('[Store] 📥 No changes needed for:', unit.shortName);
          }
        } catch (e) {
          console.error(`[Store] 📥 Pull failed for ${unit.shortName}:`, e);
        }
      },
      
      pullAllFromDocs: async () => {
        const { units, connections, settings, addNotification } = get();
        if (!connections.docs) {
          console.log('[Store] 📥 Pull skipped: not connected to Docs');
          return;
        }
        
        if (!ensureDocsUrl(settings)) return;
        
        console.log('[Store] 📥 Pulling all stats from Google Docs...');
        
        let pulled = 0;
        for (const unit of units) {
          if (unit.googleDocsHeader) {
            await get().pullStatsFromDocs(unit.id);
            pulled++;
          }
        }
        
        if (pulled > 0) {
          console.log(`[Store] 📥 Pull complete: ${pulled} units synced`);
          addNotification(`📥 Загружено из Docs: ${pulled} персонажей`, 'success');
        }
      },
      
      syncUnitToDocs: async (unit: Unit) => {
        const { settings, connections } = get();
        if (!connections.docs || !unit.googleDocsHeader) return;
        if (!ensureDocsUrl(settings)) return;
        
        try {
          if (settings.syncHP) {
            await docsService.setHealth(unit.googleDocsHeader, unit.health.current, unit.health.max);
          }
          if (settings.syncMana) {
            await docsService.setMana(unit.googleDocsHeader, unit.mana.current, unit.mana.max);
          }
          if (settings.syncRage && unit.hasRage) {
            await docsService.setRage(unit.googleDocsHeader, unit.rage?.current ?? 0, unit.rage?.max ?? 100);
          }
          if (settings.syncResources) {
            for (const resource of unit.resources) {
              if (resource.syncWithDocs) {
                await docsService.setResource(unit.googleDocsHeader, resource.name, resource.current, resource.max);
              }
            }
          }
          console.log(`[Store] 📤 Full sync to Docs: ${unit.shortName}`);
        } catch (e) {
          console.warn('[Store] 📤 Full sync failed:', e);
        }
      },
      
      updateSettings: (updates) => {
        set(state => ({
          settings: { ...state.settings, ...updates }
        }));
        
        if (updates.googleDocsUrl !== undefined) {
          if (updates.googleDocsUrl) {
            docsService.setUrl(updates.googleDocsUrl);
          } else {
            docsService.setUrl('');
            set(state => ({ connections: { ...state.connections, docs: false } }));
          }
        }
        
        if ('showTokenBars' in updates) {
          const { units } = get();
          if (updates.showTokenBars) {
            tokenBarService.syncAllBars(units);
          } else {
            tokenBarService.removeAllBars();
          }
        }
      },
      
      addNotification: (message, type = 'info') => {
        const notification: Notification = {
          id: generateId(), message, type, timestamp: Date.now()
        };
        set(state => ({
          notifications: [...state.notifications, notification].slice(-5)
        }));
        setTimeout(() => { get().clearNotification(notification.id); }, 4000);
      },
      
      clearNotification: (id) => {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }));
      },
      
      addCombatLog: (unitName, action, details) => {
        const { settings, connections } = get();
        
        const entry: CombatLogEntry = {
          id: generateId(), unitName, action, details, timestamp: Date.now()
        };
        
        set(state => ({
          combatLog: [...state.combatLog, entry].slice(-50),
          connections: { ...state.connections, lastSyncTime: Date.now() }
        }));
        
        if (connections.docs && settings.writeLogs) {
          ensureDocsUrl(settings);
          const unit = get().units.find(u => u.shortName === unitName || u.name === unitName);
          if (unit?.googleDocsHeader) {
            docsService.log(unit.googleDocsHeader, `${action}: ${details}`).catch(() => {});
          }
        }
      },
      
      triggerEffect: (effect) => {
        set({ activeEffect: effect });
        setTimeout(() => { set({ activeEffect: null }); }, 500);
      },
      
      setNextRollModifier: (mod) => set({ nextRollModifier: mod }),
      
      setConnection: (type, connected) => {
        set(state => ({
          connections: { ...state.connections, [type]: connected, lastSyncTime: Date.now() }
        }));
      },
      
      startAutoSync: () => {
        const { settings } = get();
        if (!settings.googleDocsUrl) return;
        
        ensureDocsUrl(settings);
        
        const intervalMinutes = settings.autoSyncInterval ?? 5;
        console.log('[Store] 📄 Starting auto-sync, interval:', intervalMinutes, 'min');
        
        if (autoSyncIntervalId !== null) {
          clearInterval(autoSyncIntervalId);
          autoSyncIntervalId = null;
        }
        
        const doSync = () => {
          const { connections } = get();
          if (!connections.docs) return;
          get().pullAllFromDocs();
        };
        
        autoSyncIntervalId = setInterval(doSync, intervalMinutes * 60 * 1000);
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
        console.log('[STORE] Rehydrating state:', state ? 'OK' : 'NULL');
        if (state) {
          console.log('[STORE] Units count:', state.units?.length ?? 0);
          state.units = state.units.map(migrateUnit);
          state.undoHistory = state.undoHistory ?? [];
          
          if (state.settings?.googleDocsUrl) {
            docsService.setUrl(state.settings.googleDocsUrl);
            console.log('[Store] 📄 Restored Docs URL from persisted settings');
          }
        }
      }
    }
  )
);
