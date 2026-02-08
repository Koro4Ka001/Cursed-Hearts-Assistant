import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, TabType, ConnectionStatus, AppNotification, LogEntry, SyncSettings } from '@/types';
import { googleDocsService } from '@/services/googleDocsService';

interface GameState {
  units: Unit[];
  selectedUnitId: string | null;
  activeTab: TabType;
  settings: SyncSettings;
  connections: {
    owlbear: ConnectionStatus;
    docs: ConnectionStatus;
    grimoire: ConnectionStatus;
    dice: ConnectionStatus;
  };
  notifications: AppNotification[];
  combatLog: LogEntry[];
  isSyncing: boolean;

  // Unit actions
  addUnit: (unit: Unit) => void;
  updateUnit: (id: string, updates: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  selectUnit: (id: string | null) => void;
  getSelectedUnit: () => Unit | undefined;

  // Tab
  setActiveTab: (tab: TabType) => void;

  // HP/Mana with optional sync
  setHP: (unitId: string, current: number, max?: number) => void;
  setMana: (unitId: string, current: number, max?: number) => void;

  // Resources
  setResource: (unitId: string, resourceId: string, current: number) => void;

  // Sync
  syncFromDocs: () => Promise<void>;
  syncHPToDocs: (unitId: string) => Promise<void>;
  syncManaToDocs: (unitId: string) => Promise<void>;
  syncResourceToDocs: (unitId: string, resourceName: string, current: number) => Promise<void>;
  logToDocs: (message: string) => Promise<void>;

  // Notifications
  addNotification: (notification: Omit<AppNotification, 'id'>) => void;
  removeNotification: (id: string) => void;

  // Log
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;

  // Settings
  updateSettings: (settings: Partial<SyncSettings>) => void;

  // Connections
  setConnection: (key: keyof GameState['connections'], status: ConnectionStatus) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      units: [],
      selectedUnitId: null,
      activeTab: 'combat',
      settings: {
        googleDocsUrl: '',
        syncHP: true,
        syncMana: true,
        syncResources: true,
        writeLogs: true,
      },
      connections: {
        owlbear: 'disconnected',
        docs: 'not_configured',
        grimoire: 'disconnected',
        dice: 'disconnected',
      },
      notifications: [],
      combatLog: [],
      isSyncing: false,

      addUnit: (unit) => set((s) => ({
        units: [...s.units, unit],
        selectedUnitId: s.selectedUnitId || unit.id,
      })),

      updateUnit: (id, updates) => set((s) => ({
        units: s.units.map((u) => (u.id === id ? { ...u, ...updates } : u)),
      })),

      deleteUnit: (id) => set((s) => {
        const newUnits = s.units.filter((u) => u.id !== id);
        return {
          units: newUnits,
          selectedUnitId: s.selectedUnitId === id ? (newUnits[0]?.id || null) : s.selectedUnitId,
        };
      }),

      selectUnit: (id) => set({ selectedUnitId: id }),

      getSelectedUnit: () => {
        const s = get();
        return s.units.find((u) => u.id === s.selectedUnitId);
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      setHP: (unitId, current, max?) => {
        set((s) => ({
          units: s.units.map((u) => {
            if (u.id !== unitId) return u;
            const newMax = max ?? u.health.max;
            return { ...u, health: { current: Math.max(0, Math.min(current, newMax)), max: newMax } };
          }),
        }));
        // Async sync to docs
        const state = get();
        if (state.settings.syncHP && state.settings.googleDocsUrl) {
          get().syncHPToDocs(unitId);
        }
      },

      setMana: (unitId, current, max?) => {
        set((s) => ({
          units: s.units.map((u) => {
            if (u.id !== unitId) return u;
            const newMax = max ?? u.mana.max;
            return { ...u, mana: { current: Math.max(0, Math.min(current, newMax)), max: newMax } };
          }),
        }));
        const state = get();
        if (state.settings.syncMana && state.settings.googleDocsUrl) {
          get().syncManaToDocs(unitId);
        }
      },

      setResource: (unitId, resourceId, current) => {
        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId
              ? {
                  ...u,
                  resources: u.resources.map((r) =>
                    r.id === resourceId ? { ...r, current: Math.max(0, Math.min(current, r.max)) } : r
                  ),
                }
              : u
          ),
        }));
        // Sync resource to docs
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        const resource = unit?.resources.find(r => r.id === resourceId);
        if (state.settings.syncResources && state.settings.googleDocsUrl && resource?.syncWithDocs) {
          get().syncResourceToDocs(unitId, resource.name, Math.max(0, Math.min(current, resource.max)));
        }
      },

      syncFromDocs: async () => {
        const state = get();
        const unit = state.getSelectedUnit();
        if (!unit || !state.settings.googleDocsUrl) return;

        set({ isSyncing: true });
        googleDocsService.setConfig(state.settings.googleDocsUrl, unit.googleDocsHeader);

        try {
          const stats = await googleDocsService.getStats();
          if (stats) {
            set((s) => ({
              units: s.units.map((u) =>
                u.id === unit.id
                  ? { ...u, health: stats.health, mana: stats.mana }
                  : u
              ),
            }));
            get().addNotification({
              type: 'success',
              title: 'Синхронизировано',
              message: `HP ${stats.health.current}/${stats.health.max} | MP ${stats.mana.current}/${stats.mana.max}`,
            });
          } else {
            get().addNotification({
              type: 'error',
              title: 'Ошибка синхронизации',
              message: 'Не удалось получить данные из Google Docs',
            });
          }
        } catch (error) {
          get().addNotification({
            type: 'error',
            title: 'Ошибка',
            message: `Синхронизация: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
        set({ isSyncing: false });
      },

      syncHPToDocs: async (unitId) => {
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        if (!unit || !state.settings.googleDocsUrl || !unit.googleDocsHeader) return;
        googleDocsService.setConfig(state.settings.googleDocsUrl, unit.googleDocsHeader);
        await googleDocsService.setHealth(unit.health.current, unit.health.max);
      },

      syncManaToDocs: async (unitId) => {
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        if (!unit || !state.settings.googleDocsUrl || !unit.googleDocsHeader) return;
        googleDocsService.setConfig(state.settings.googleDocsUrl, unit.googleDocsHeader);
        await googleDocsService.setMana(unit.mana.current, unit.mana.max);
      },

      syncResourceToDocs: async (unitId, resourceName, current) => {
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        if (!unit || !state.settings.googleDocsUrl || !unit.googleDocsHeader) return;
        googleDocsService.setConfig(state.settings.googleDocsUrl, unit.googleDocsHeader);
        await googleDocsService.setResource(resourceName, current);
      },

      logToDocs: async (message) => {
        const state = get();
        const unit = state.getSelectedUnit();
        if (!state.settings.writeLogs || !state.settings.googleDocsUrl || !unit?.googleDocsHeader) return;
        googleDocsService.setConfig(state.settings.googleDocsUrl, unit.googleDocsHeader);
        await googleDocsService.log(message);
      },

      addNotification: (notification) => {
        const id = crypto.randomUUID();
        set((s) => ({
          notifications: [...s.notifications, { ...notification, id }],
        }));
        const duration = notification.duration ?? 4000;
        setTimeout(() => {
          set((s) => ({
            notifications: s.notifications.filter((n) => n.id !== id),
          }));
        }, duration);
      },

      removeNotification: (id) => set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id),
      })),

      addLog: (entry) => set((s) => ({
        combatLog: [
          { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
          ...s.combatLog.slice(0, 99),
        ],
      })),

      clearLogs: () => set({ combatLog: [] }),

      updateSettings: (settings) => set((s) => ({
        settings: { ...s.settings, ...settings },
      })),

      setConnection: (key, status) => set((s) => ({
        connections: { ...s.connections, [key]: status },
      })),
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
