import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, Settings, ConnectionStatus, Notification, CombatLogEntry, Resource } from '../types';
import { docsService } from '../services/docsService';
import { updateTokenHp } from '../services/hpTrackerService';
import { generateId } from '../utils/dice';

// Дефолтный юнит для примера
const createDefaultUnit = (): Unit => ({
  id: generateId(),
  name: 'Новый персонаж',
  shortName: 'Новый',
  googleDocsHeader: '',
  owlbearTokenId: undefined,
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
  magicBonuses: {},
  armor: {
    slashing: 0,
    piercing: 0,
    bludgeoning: 0,
    chopping: 0,
    magicBase: 0,
    magicOverrides: {},
    undead: 0
  },
  damageMultipliers: {},
  weapons: [],
  spells: [],
  resources: [],
  customActions: [],
  hasRokCards: false,
  rokDeckResourceId: undefined,
  hasDoubleShot: false,
  doubleShotThreshold: 18,
  notes: ''
});

// Максимум уведомлений одновременно
const MAX_NOTIFICATIONS = 3;

interface GameState {
  // === PERSISTED ===
  units: Unit[];
  selectedUnitId: string | null;
  settings: Settings;
  
  // === TRANSIENT ===
  activeTab: string;
  connections: ConnectionStatus;
  notifications: Notification[];
  combatLog: CombatLogEntry[];
  isSyncing: boolean;
  autoSyncIntervalId: number | null;
  
  // === ACTIONS: Units ===
  addUnit: (unit?: Partial<Unit>) => void;
  updateUnit: (id: string, partial: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  selectUnit: (id: string) => void;
  getSelectedUnit: () => Unit | undefined;
  
  // === ACTIONS: HP ===
  setHP: (unitId: string, hp: number) => Promise<void>;
  takeDamage: (unitId: string, damage: number) => Promise<void>;
  heal: (unitId: string, amount: number) => Promise<void>;
  
  // === ACTIONS: Mana ===
  setMana: (unitId: string, mana: number) => Promise<void>;
  spendMana: (unitId: string, amount: number) => Promise<boolean>;
  restoreMana: (unitId: string, amount: number) => Promise<void>;
  
  // === ACTIONS: Resources ===
  setResource: (unitId: string, resourceId: string, current: number) => Promise<void>;
  spendResource: (unitId: string, resourceId: string, amount: number) => Promise<boolean>;
  
  // === ACTIONS: Notes ===
  setNotes: (unitId: string, notes: string) => void;
  
  // === ACTIONS: Sync ===
  syncFromDocs: (unitId: string, showNotifications?: boolean) => Promise<void>;
  syncAllFromDocs: (silent?: boolean) => Promise<void>;
  startAutoSync: () => void;
  stopAutoSync: () => void;
  
  // === ACTIONS: Settings ===
  updateSettings: (partial: Partial<Settings>) => void;
  
  // === ACTIONS: UI ===
  setActiveTab: (tab: string) => void;
  addNotification: (message: string, type: Notification['type']) => void;
  clearNotification: (id: string) => void;
  addCombatLog: (unitName: string, action: string, details: string) => void;
  setConnection: (key: keyof ConnectionStatus, value: boolean | number | string) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // === INITIAL STATE ===
      units: [],
      selectedUnitId: null,
      settings: {
        googleDocsUrl: '',
        syncHP: true,
        syncMana: true,
        syncResources: true,
        autoSyncInterval: 5,
        writeLogs: true
      },
      
      // Transient state
      activeTab: 'combat',
      connections: { owlbear: false, docs: false, dice: 'local' },
      notifications: [],
      combatLog: [],
      isSyncing: false,
      autoSyncIntervalId: null,
      
      // === UNITS ===
      addUnit: (partial) => {
        const newUnit = { ...createDefaultUnit(), ...partial };
        set((state) => ({
          units: [...state.units, newUnit],
          selectedUnitId: state.selectedUnitId ?? newUnit.id
        }));
      },
      
      updateUnit: (id, partial) => {
        set((state) => ({
          units: state.units.map(u => u.id === id ? { ...u, ...partial } : u)
        }));
      },
      
      deleteUnit: (id) => {
        set((state) => {
          const newUnits = state.units.filter(u => u.id !== id);
          const newSelectedId = state.selectedUnitId === id 
            ? (newUnits[0]?.id ?? null)
            : state.selectedUnitId;
          return { units: newUnits, selectedUnitId: newSelectedId };
        });
      },
      
      selectUnit: (id) => {
        set({ selectedUnitId: id });
      },
      
      getSelectedUnit: () => {
        const state = get();
        return state.units.find(u => u.id === state.selectedUnitId);
      },
      
      // === HP ===
      setHP: async (unitId, hp) => {
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        if (!unit) return;
        
        // Обновляем локально
        set((s) => ({
          units: s.units.map(u => 
            u.id === unitId 
              ? { ...u, health: { ...u.health, current: hp } }
              : u
          )
        }));
        
        // Синхронизируем с Google Docs (только если URL настроен)
        if (state.settings.syncHP && unit.googleDocsHeader && state.settings.googleDocsUrl) {
          try {
            await docsService.setHealth(unit.googleDocsHeader, hp, unit.health.max);
          } catch (error) {
            console.error('Failed to sync HP to Docs:', error);
          }
        }
        
        // Синхронизируем с HP Tracker
        if (unit.owlbearTokenId) {
          try {
            await updateTokenHp(unit.owlbearTokenId, hp, unit.health.max);
          } catch (error) {
            console.error('Failed to sync HP to HP Tracker:', error);
          }
        }
        
        // Добавляем в лог
        get().addCombatLog(unit.shortName, 'HP изменено', `${hp}/${unit.health.max}`);
      },
      
      takeDamage: async (unitId, damage) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit) return;
        
        const newHP = unit.health.current - damage;
        await get().setHP(unitId, newHP);
        
        get().addCombatLog(unit.shortName, 'Получен урон', `-${damage} HP`);
      },
      
      heal: async (unitId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit) return;
        
        const newHP = Math.min(unit.health.max, unit.health.current + amount);
        await get().setHP(unitId, newHP);
        
        get().addCombatLog(unit.shortName, 'Исцеление', `+${amount} HP`);
      },
      
      // === MANA ===
      setMana: async (unitId, mana) => {
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        if (!unit) return;
        
        // Обновляем локально
        set((s) => ({
          units: s.units.map(u => 
            u.id === unitId 
              ? { ...u, mana: { ...u.mana, current: mana } }
              : u
          )
        }));
        
        // Синхронизируем с Google Docs (только если URL настроен)
        if (state.settings.syncMana && unit.googleDocsHeader && state.settings.googleDocsUrl) {
          try {
            await docsService.setMana(unit.googleDocsHeader, mana, unit.mana.max);
          } catch (error) {
            console.error('Failed to sync Mana to Docs:', error);
          }
        }
      },
      
      spendMana: async (unitId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit) return false;
        
        if (unit.mana.current < amount) {
          get().addNotification(`Недостаточно маны! Нужно ${amount}, есть ${unit.mana.current}`, 'warning');
          return false;
        }
        
        const newMana = unit.mana.current - amount;
        await get().setMana(unitId, newMana);
        
        get().addCombatLog(unit.shortName, 'Мана потрачена', `-${amount} маны`);
        return true;
      },
      
      restoreMana: async (unitId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit) return;
        
        const newMana = Math.min(unit.mana.max, unit.mana.current + amount);
        await get().setMana(unitId, newMana);
        
        get().addCombatLog(unit.shortName, 'Мана восстановлена', `+${amount} маны`);
      },
      
      // === RESOURCES ===
      setResource: async (unitId, resourceId, current) => {
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        if (!unit) return;
        
        const resource = unit.resources.find(r => r.id === resourceId);
        if (!resource) return;
        
        // Обновляем локально
        set((s) => ({
          units: s.units.map(u => {
            if (u.id !== unitId) return u;
            return {
              ...u,
              resources: u.resources.map(r => 
                r.id === resourceId ? { ...r, current } : r
              )
            };
          })
        }));
        
        // Синхронизируем с Google Docs если включено
        if (resource.syncWithDocs && state.settings.syncResources && state.settings.googleDocsUrl && unit.googleDocsHeader) {
          try {
            await docsService.setResource(unit.googleDocsHeader, resource.name, current, resource.max);
          } catch (error) {
            console.error('Failed to sync resource to Docs:', error);
          }
        }
      },
      
      spendResource: async (unitId, resourceId, amount) => {
        const unit = get().units.find(u => u.id === unitId);
        if (!unit) return false;
        
        const resource = unit.resources.find(r => r.id === resourceId);
        if (!resource || resource.current < amount) {
          get().addNotification(`Недостаточно ${resource?.name ?? 'ресурса'}!`, 'warning');
          return false;
        }
        
        await get().setResource(unitId, resourceId, resource.current - amount);
        return true;
      },
      
      // === NOTES ===
      setNotes: (unitId, notes) => {
        set((state) => ({
          units: state.units.map(u => 
            u.id === unitId ? { ...u, notes } : u
          )
        }));
      },
      
      // === SYNC ===
      // showNotifications = true для ручной синхронизации, false для автоматической
      syncFromDocs: async (unitId, showNotifications = true) => {
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        
        // Проверяем наличие юнита и его googleDocsHeader
        if (!unit || !unit.googleDocsHeader) {
          if (showNotifications) {
            get().addNotification('Персонаж не привязан к Google Docs', 'info');
          }
          return;
        }
        
        // ВАЖНО: Проверяем URL — если не настроен, молча выходим (или показываем уведомление если ручная синхр)
        if (!state.settings.googleDocsUrl) {
          if (showNotifications) {
            get().addNotification('Настройте URL Google Docs в настройках', 'info');
          }
          // Для автоматической синхронизации — просто молча выходим
          return;
        }
        
        set({ isSyncing: true });
        
        try {
          const result = await docsService.getStats(unit.googleDocsHeader);
          
          if (result.success) {
            const updates: Partial<Unit> = {};
            
            if (result.health) {
              updates.health = result.health;
            }
            if (result.mana) {
              updates.mana = result.mana;
            }
            
            // Обновляем ресурсы из Docs если есть
            if (result.resources && unit.resources.length > 0) {
              const updatedResources: Resource[] = unit.resources.map(r => {
                if (r.syncWithDocs && result.resources?.[r.name]) {
                  return { ...r, current: result.resources[r.name]!.current };
                }
                return r;
              });
              updates.resources = updatedResources;
            }
            
            get().updateUnit(unitId, updates);
            
            // Обновляем HP Tracker
            if (unit.owlbearTokenId && result.health) {
              await updateTokenHp(unit.owlbearTokenId, result.health.current, result.health.max);
            }
            
            set((s) => ({ 
              connections: { ...s.connections, docs: true, lastSyncTime: Date.now() }
            }));
            
            if (showNotifications) {
              get().addNotification(`${unit.shortName}: синхронизировано!`, 'success');
            }
          } else {
            if (showNotifications) {
              get().addNotification(`Ошибка синхронизации: ${result.error ?? 'неизвестная ошибка'}`, 'error');
            }
          }
        } catch (error) {
          console.error('Sync error:', error);
          if (showNotifications) {
            get().addNotification('Ошибка подключения к Google Docs', 'error');
          }
        } finally {
          set({ isSyncing: false });
        }
      },
      
      // silent = true для автоматической синхронизации (без уведомлений)
      syncAllFromDocs: async (silent = false) => {
        const state = get();
        
        // ВАЖНО: Если URL не настроен — молча выходим, БЕЗ уведомлений
        if (!state.settings.googleDocsUrl) {
          return;
        }
        
        const units = state.units.filter(u => u.googleDocsHeader);
        
        // Если нет юнитов для синхронизации — молча выходим
        if (units.length === 0) {
          return;
        }
        
        for (const unit of units) {
          // Для автоматической синхронизации не показываем уведомления
          await get().syncFromDocs(unit.id, !silent);
        }
        
        // Обновляем время последней синхронизации
        if (units.length > 0) {
          set((s) => ({ 
            connections: { ...s.connections, lastSyncTime: Date.now() }
          }));
        }
      },
      
      startAutoSync: () => {
        const state = get();
        
        // Останавливаем предыдущий
        if (state.autoSyncIntervalId) {
          clearInterval(state.autoSyncIntervalId);
        }
        
        const intervalMs = state.settings.autoSyncInterval * 60 * 1000;
        
        const intervalId = window.setInterval(() => {
          // silent = true — автоматическая синхронизация без уведомлений
          get().syncAllFromDocs(true);
        }, intervalMs);
        
        set({ autoSyncIntervalId: intervalId });
      },
      
      stopAutoSync: () => {
        const state = get();
        if (state.autoSyncIntervalId) {
          clearInterval(state.autoSyncIntervalId);
          set({ autoSyncIntervalId: null });
        }
      },
      
      // === SETTINGS ===
      updateSettings: (partial) => {
        set((state) => ({
          settings: { ...state.settings, ...partial }
        }));
        
        // Обновляем URL в сервисе
        if (partial.googleDocsUrl !== undefined) {
          docsService.setUrl(partial.googleDocsUrl);
        }
        
        // Перезапускаем auto-sync если изменился интервал
        if (partial.autoSyncInterval !== undefined) {
          get().stopAutoSync();
          get().startAutoSync();
        }
      },
      
      // === UI ===
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      addNotification: (message, type) => {
        const state = get();
        
        // ЗАЩИТА ОТ ДУБЛЕЙ: Проверяем, нет ли уже такого же сообщения
        const isDuplicate = state.notifications.some(n => n.message === message);
        if (isDuplicate) {
          return; // Не добавляем дублирующее уведомление
        }
        
        const notification: Notification = {
          id: generateId(),
          message,
          type,
          timestamp: Date.now()
        };
        
        set((s) => {
          // ОГРАНИЧЕНИЕ: Максимум MAX_NOTIFICATIONS уведомлений, новые вытесняют старые
          const newNotifications = [...s.notifications, notification];
          if (newNotifications.length > MAX_NOTIFICATIONS) {
            return { notifications: newNotifications.slice(-MAX_NOTIFICATIONS) };
          }
          return { notifications: newNotifications };
        });
        
        // Авто-удаление через 5 сек
        setTimeout(() => {
          get().clearNotification(notification.id);
        }, 5000);
      },
      
      clearNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }));
      },
      
      addCombatLog: (unitName, action, details) => {
        const entry: CombatLogEntry = {
          timestamp: Date.now(),
          unitName,
          action,
          details
        };
        
        set((state) => ({
          combatLog: [...state.combatLog, entry].slice(-100)
        }));
        
        // Логирование в Google Docs (только если URL настроен)
        const settings = get().settings;
        if (settings.writeLogs && settings.googleDocsUrl) {
          const unit = get().units.find(u => u.shortName === unitName);
          if (unit?.googleDocsHeader) {
            docsService.log(unit.googleDocsHeader, `${action}: ${details}`).catch(console.error);
          }
        }
      },
      
      setConnection: (key, value) => {
        set((state) => ({
          connections: { ...state.connections, [key]: value }
        }));
      }
    }),
    {
      name: 'cursed-hearts-storage',
      partialize: (state) => ({
        units: state.units,
        selectedUnitId: state.selectedUnitId,
        settings: state.settings
      })
    }
  )
);

// Инициализация при загрузке
const initStore = () => {
  const state = useGameStore.getState();
  
  // Устанавливаем URL в сервис (только если он не пустой)
  if (state.settings.googleDocsUrl) {
    docsService.setUrl(state.settings.googleDocsUrl);
  }
  
  // НЕ запускаем авто-синхронизацию при инициализации — 
  // она будет запущена в App.tsx после инициализации OBR
};

initStore();
