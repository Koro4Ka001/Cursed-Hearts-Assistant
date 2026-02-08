import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, TabType, ConnectionStatus, AppNotification, LogEntry, SyncSettings } from '@/types';

interface GameState {
  units: Unit[];
  selectedUnitId: string | null;
  activeTab: TabType;
  settings: SyncSettings;
  connections: {
    owlbear: ConnectionStatus;
    docs: ConnectionStatus;
    grimoire: ConnectionStatus;
  };
  notifications: AppNotification[];
  combatLog: LogEntry[];

  // Unit actions
  addUnit: (unit: Unit) => void;
  updateUnit: (id: string, updates: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  selectUnit: (id: string | null) => void;
  getSelectedUnit: () => Unit | undefined;

  // Tab
  setActiveTab: (tab: TabType) => void;

  // HP/Mana
  setHP: (unitId: string, current: number) => void;
  setMana: (unitId: string, current: number) => void;

  // Resources
  setResource: (unitId: string, resourceId: string, current: number) => void;

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
      },
      notifications: [],
      combatLog: [],

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

      setHP: (unitId, current) => set((s) => ({
        units: s.units.map((u) =>
          u.id === unitId ? { ...u, health: { ...u.health, current: Math.max(0, Math.min(current, u.health.max)) } } : u
        ),
      })),

      setMana: (unitId, current) => set((s) => ({
        units: s.units.map((u) =>
          u.id === unitId ? { ...u, mana: { ...u.mana, current: Math.max(0, Math.min(current, u.mana.max)) } } : u
        ),
      })),

      setResource: (unitId, resourceId, current) => set((s) => ({
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
      })),

      addNotification: (notification) => {
        const id = crypto.randomUUID();
        set((s) => ({
          notifications: [...s.notifications, { ...notification, id }],
        }));
        const duration = notification.duration ?? 5000;
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
