import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, TabType, ConnectionStatus, AppNotification, LogEntry, SyncSettings } from '@/types';
import { googleDocsService } from '@/services/googleDocsService';
import { grimoireService } from '@/services/grimoireService';

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

  addUnit: (unit: Unit) => void;
  updateUnit: (id: string, updates: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  selectUnit: (id: string | null) => void;
  getSelectedUnit: () => Unit | undefined;
  setActiveTab: (tab: TabType) => void;
  setHP: (unitId: string, current: number, max?: number) => void;
  setMana: (unitId: string, current: number, max?: number) => void;
  setResource: (unitId: string, resourceId: string, current: number) => void;
  modifyResourceAmount: (unitId: string, resourceId: string, delta: number) => void;
  syncFromDocs: () => Promise<void>;
  syncHPToDocs: (unitId: string) => Promise<void>;
  syncManaToDocs: (unitId: string) => Promise<void>;
  syncResourceToDocs: (unitId: string, resourceName: string, current: number) => Promise<void>;
  logToDocs: (message: string) => Promise<void>;
  addNotification: (notification: Omit<AppNotification, 'id'>) => void;
  removeNotification: (id: string) => void;
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  updateSettings: (settings: Partial<SyncSettings>) => void;
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
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        if (!unit) return;

        const newMax = max ?? unit.health.max;
        const clamped = Math.max(0, Math.min(current, newMax));

        set((s) => ({
          units: s.units.map((u) =>
            u.id === unitId ? { ...u, health: { current: clamped, max: newMax } } : u
          ),
        }));

        // Sync to Google Docs
        if (state.settings.syncHP && state.settings.googleDocsUrl) {
          get().syncHPToDocs(unitId);
        }

        // Sync to Grimoire (token on map)
        if (unit.owlbearTokenId) {
          grimoireService.updateTokenHealth(unit.owlbearTokenId, clamped, newMax).catch(console.error);
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
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        const resource = unit?.resources.find(r => r.id === resourceId);
        if (state.settings.syncResources && state.settings.googleDocsUrl && resource?.syncWithDocs) {
          get().syncResourceToDocs(unitId, resource.name, Math.max(0, Math.min(current, resource.max)));
        }
      },

      modifyResourceAmount: (unitId, resourceId, delta) => {
        const state = get();
        const unit = state.units.find(u => u.id === unitId);
        const resource = unit?.resources.find(r => r.id === resourceId);
        if (!resource) return;
        const newCurrent = Math.max(0, Math.min(resource.current + delta, resource.max));
        get().setResource(unitId, resourceId, newCurrent);
      },

      syncFromDocs: async () => {
        const state = get();
        const unit = state.getSelectedUnit();
        if (!unit || !state.settings.googleDocsUrl) {
          get().addNotification({ type: 'error', title: 'Ошибка', message: 'Настройте URL Google Docs и выберите юнита' });
          return;
        }

        set({ isSyncing: true });
        googleDocsService.setConfig(state.settings.googleDocsUrl, unit.googleDocsHeader);

        try {
          const stats = await googleDocsService.getStats();
          if (stats) {
            set((s) => ({
              units: s.units.map((u) =>
                u.id === unit.id ? { ...u, health: stats.health, mana: stats.mana } : u
              ),
            }));
            get().addNotification({
              type: 'success',
              title: 'Синхронизировано',
              message: `HP ${stats.health.current}/${stats.health.max} | MP ${stats.mana.current}/${stats.mana.max}`,
            });
            get().setConnection('docs', 'connected');
          } else {
            get().addNotification({ type: 'error', title: 'Ошибка', message: 'Не удалось получить данные' });
          }
        } catch (error) {
          get().addNotification({ type: 'error', title: 'Ошибка', message: String(error) });
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
        set((s) => ({ notifications: [...s.notifications, { ...notification, id }] }));
        setTimeout(() => {
          set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
        }, notification.duration ?? 4000);
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
      updateSettings: (settings) => set((s) => ({ settings: { ...s.settings, ...settings } })),
      setConnection: (key, status) => set((s) => ({ connections: { ...s.connections, [key]: status } })),
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
