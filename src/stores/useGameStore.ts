// src/stores/useGameStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Unit, Settings, ConnectionStatus, Notification, CombatLogEntry, RollModifier } from '../types';
import { docsService } from '../services/docsService';
import { updateTokenHp } from '../services/hpTrackerService';
import { tokenBarService } from '../services/tokenBarService';
import { generateId } from '../utils/dice';

const createDefaultUnit = (): Unit => ({
  id: generateId(),
  name: 'Новый персонаж',
  shortName: 'Новый',
  googleDocsHeader: '',
  owlbearTokenId: undefined,
  health: { current: 100, max: 100 },
  mana: { current: 50, max: 50 },
  stats: { physicalPower: 0, dexterity: 0, vitality: 0, intelligence: 0, charisma: 0, initiative: 0 },
  proficiencies: { swords: 0, axes: 0, hammers: 0, polearms: 0, unarmed: 0, bows: 0 },
  magicBonuses: {},
  elementAffinities: [],  // НОВОЕ
  armor: { slashing: 0, piercing: 0, bludgeoning: 0, chopping: 0, magicBase: 0, magicOverrides: {}, undead: 0 },
  damageMultipliers: {},
  weapons: [],
  spells: [],
  resources: [],
  customActions: [],
  hasRokCards: false,
  rokDeckResourceId: undefined,
  hasDoubleShot: false,
  doubleShotThreshold: 18,
  notes: '',
  useManaAsHp: false
});

const MAX_NOTIFICATIONS = 3;

interface GameState {
  units: Unit[];
  selectedUnitId: string | null;
  settings: Settings;
  activeTab: string;
  connections: ConnectionStatus;
  notifications: Notification[];
  combatLog: CombatLogEntry[];
  isSyncing: boolean;
  autoSyncIntervalId: number | null;
  activeEffect: string | null;
  
  // НОВОЕ: модификатор следующего броска
  nextRollModifier: RollModifier;

  // Unit actions
  addUnit: (unit?: Partial<Unit>) => void;
  updateUnit: (id: string, partial: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  selectUnit: (id: string) => void;
  getSelectedUnit: () => Unit | undefined;
  
  // HP/Mana/Resources
  setHP: (unitId: string, hp: number) => Promise<void>;
  takeDamage: (unitId: string, damage: number) => Promise<void>;
  heal: (unitId: string, amount: number) => Promise<void>;
  setMana: (unitId: string, mana: number) => Promise<void>;
  spendMana: (unitId: string, amount: number) => Promise<boolean>;
  restoreMana: (unitId: string, amount: number) => Promise<void>;
  setResource: (unitId: string, resourceId: string, current: number) => Promise<void>;
  spendResource: (unitId: string, resourceId: string, amount: number) => Promise<boolean>;
  setNotes: (unitId: string, notes: string) => void;
  
  // Sync
  syncFromDocs: (unitId: string, showNotifications?: boolean) => Promise<void>;
  syncAllFromDocs: (silent?: boolean) => Promise<void>;
  startAutoSync: () => void;
  stopAutoSync: () => void;
  
  // Settings & UI
  updateSettings: (partial: Partial<Settings>) => void;
  setActiveTab: (tab: string) => void;
  triggerEffect: (effect: string) => void;
  addNotification: (message: string, type: Notification['type']) => void;
  clearNotification: (id: string) => void;
  addCombatLog: (unitName: string, action: string, details: string) => void;
  setConnection: (key: keyof ConnectionStatus, value: boolean | number | string) => void;
  
  // НОВОЕ: управление модификатором броска
  setNextRollModifier: (modifier: RollModifier) => void;
  consumeRollModifier: () => RollModifier; // возвращает текущий и сбрасывает на normal
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      units: [],
      selectedUnitId: null,
      settings: {
        googleDocsUrl: '',
        syncHP: true,
        syncMana: true,
        syncResources: true,
        autoSyncInterval: 5,
        writeLogs: true,
        showTokenBars: true
      },
      activeTab: 'combat',
      connections: { owlbear: false, docs: false, dice: 'local' },
      notifications: [],
      combatLog: [],
      isSyncing: false,
      autoSyncIntervalId: null,
      activeEffect: null,
      nextRollModifier: 'normal',  // НОВОЕ

      // ── Units ──
      addUnit: (partial) => {
        const u = { ...createDefaultUnit(), ...partial };
        set(s => ({ units: [...s.units, u], selectedUnitId: s.selectedUnitId ?? u.id }));
      },

      updateUnit: (id, partial) => {
        const old = get().units.find(u => u.id === id);
        set(s => ({ units: s.units.map(u => u.id === id ? { ...u, ...partial } : u) }));
        const show = get().settings.showTokenBars ?? true;
        if (show && partial.owlbearTokenId !== undefined) {
          if (old?.owlbearTokenId && old.owlbearTokenId !== partial.owlbearTokenId) {
            tokenBarService.removeBars(old.owlbearTokenId).catch(console.warn);
          }
          if (partial.owlbearTokenId) {
            const upd = get().units.find(u => u.id === id);
            if (upd) {
              tokenBarService.createBars(
                partial.owlbearTokenId,
                upd.health.current, upd.health.max,
                upd.mana.current, upd.mana.max,
                upd.useManaAsHp
              ).catch(console.warn);
            }
          }
        }
      },

      deleteUnit: (id) => {
        const u = get().units.find(x => x.id === id);
        if (u?.owlbearTokenId) tokenBarService.removeBars(u.owlbearTokenId).catch(console.warn);
        set(s => {
          const nu = s.units.filter(x => x.id !== id);
          return { units: nu, selectedUnitId: s.selectedUnitId === id ? (nu[0]?.id ?? null) : s.selectedUnitId };
        });
      },

      selectUnit: (id) => set({ selectedUnitId: id }),
      getSelectedUnit: () => {
        const s = get();
        return s.units.find(u => u.id === s.selectedUnitId);
      },

      // ── HP ──
      setHP: async (unitId, hp) => {
        const s = get();
        const u = s.units.find(x => x.id === unitId);
        if (!u) return;
        set(st => ({ units: st.units.map(x => x.id === unitId ? { ...x, health: { ...x.health, current: hp } } : x) }));
        if (s.settings.syncHP && u.googleDocsHeader && s.settings.googleDocsUrl) {
          try { await docsService.setHealth(u.googleDocsHeader, hp, u.health.max); } catch (e) { console.error('HP sync:', e); }
        }
        if (u.owlbearTokenId) {
          try { await updateTokenHp(u.owlbearTokenId, hp, u.health.max); } catch (e) { console.error('HP tracker:', e); }
          if (s.settings.showTokenBars ?? true) {
            tokenBarService.updateBars(u.owlbearTokenId, hp, u.health.max, u.mana.current, u.mana.max, u.useManaAsHp).catch(console.warn);
          }
        }
        get().addCombatLog(u.shortName, 'HP', `${hp}/${u.health.max}`);
      },

      takeDamage: async (unitId, damage) => {
        const u = get().units.find(x => x.id === unitId);
        if (!u) return;
        if (u.useManaAsHp) {
          await get().setMana(unitId, u.mana.current - damage);
          get().addCombatLog(u.shortName, 'Урон', `-${damage} маны`);
        } else {
          await get().setHP(unitId, u.health.current - damage);
          get().addCombatLog(u.shortName, 'Урон', `-${damage} HP`);
        }
      },

      heal: async (unitId, amount) => {
        const u = get().units.find(x => x.id === unitId);
        if (!u) return;
        if (u.useManaAsHp) {
          await get().setMana(unitId, Math.min(u.mana.max, u.mana.current + amount));
        } else {
          await get().setHP(unitId, Math.min(u.health.max, u.health.current + amount));
        }
      },

      // ── Mana ──
      setMana: async (unitId, mana) => {
        const s = get();
        const u = s.units.find(x => x.id === unitId);
        if (!u) return;
        set(st => ({ units: st.units.map(x => x.id === unitId ? { ...x, mana: { ...x.mana, current: mana } } : x) }));
        if (s.settings.syncMana && u.googleDocsHeader && s.settings.googleDocsUrl) {
          try { await docsService.setMana(u.googleDocsHeader, mana, u.mana.max); } catch (e) { console.error('Mana sync:', e); }
        }
        if (u.owlbearTokenId && (s.settings.showTokenBars ?? true)) {
          tokenBarService.updateBars(u.owlbearTokenId, u.health.current, u.health.max, mana, u.mana.max, u.useManaAsHp).catch(console.warn);
        }
      },

      spendMana: async (unitId, amount) => {
        const u = get().units.find(x => x.id === unitId);
        if (!u) return false;
        if (u.mana.current < amount) {
          get().addNotification(`Мана: ${u.mana.current}/${amount}`, 'warning');
          return false;
        }
        await get().setMana(unitId, u.mana.current - amount);
        get().addCombatLog(u.shortName, 'Мана', `-${amount}`);
        return true;
      },

      restoreMana: async (unitId, amount) => {
        const u = get().units.find(x => x.id === unitId);
        if (!u) return;
        await get().setMana(unitId, Math.min(u.mana.max, u.mana.current + amount));
      },

      // ── Resources ──
      setResource: async (unitId, resourceId, current) => {
        const s = get();
        const u = s.units.find(x => x.id === unitId);
        if (!u) return;
        const r = u.resources.find(x => x.id === resourceId);
        if (!r) return;
        set(st => ({
          units: st.units.map(x => x.id !== unitId ? x : {
            ...x,
            resources: x.resources.map(y => y.id === resourceId ? { ...y, current } : y)
          })
        }));
        if (r.syncWithDocs && s.settings.syncResources && s.settings.googleDocsUrl && u.googleDocsHeader) {
          try { await docsService.setResource(u.googleDocsHeader, r.name, current, r.max); } catch (e) { console.error('Res sync:', e); }
        }
      },

      spendResource: async (unitId, resourceId, amount) => {
        const u = get().units.find(x => x.id === unitId);
        if (!u) return false;
        const r = u.resources.find(x => x.id === resourceId);
        if (!r || r.current < amount) {
          get().addNotification(`Мало ${r?.name ?? 'ресурса'}!`, 'warning');
          return false;
        }
        await get().setResource(unitId, resourceId, r.current - amount);
        return true;
      },

      // ── Notes ──
      setNotes: (unitId, notes) => {
        set(s => ({ units: s.units.map(u => u.id === unitId ? { ...u, notes } : u) }));
      },

      // ── Sync ──
      syncFromDocs: async (unitId, showN = true) => {
        const s = get();
        const u = s.units.find(x => x.id === unitId);
        if (!u?.googleDocsHeader) {
          if (showN) get().addNotification('Нет привязки к Docs', 'info');
          return;
        }
        if (!s.settings.googleDocsUrl) {
          if (showN) get().addNotification('Нет URL Docs', 'info');
          return;
        }
        if (s.isSyncing) return;
        set({ isSyncing: true });
        try {
          const res = await docsService.getStats(u.googleDocsHeader);
          if (res.success) {
            const upd: Partial<Unit> = {};
            if (res.health) upd.health = res.health;
            if (res.mana) upd.mana = res.mana;
            if (res.resources && u.resources.length) {
              upd.resources = u.resources.map(r =>
                r.syncWithDocs && res.resources?.[r.name]
                  ? { ...r, current: res.resources[r.name]!.current }
                  : r
              );
            }
            get().updateUnit(unitId, upd);
            if (u.owlbearTokenId && res.health) {
              await updateTokenHp(u.owlbearTokenId, res.health.current, res.health.max);
            }
            const fresh = get().units.find(x => x.id === unitId);
            if (fresh?.owlbearTokenId && (s.settings.showTokenBars ?? true)) {
              tokenBarService.updateBars(
                fresh.owlbearTokenId,
                fresh.health.current, fresh.health.max,
                fresh.mana.current, fresh.mana.max,
                fresh.useManaAsHp
              ).catch(console.warn);
            }
            set(st => ({ connections: { ...st.connections, docs: true, lastSyncTime: Date.now() } }));
            if (showN) get().addNotification(`${u.shortName}: ✓`, 'success');
          } else {
            if (showN) get().addNotification(`Ошибка: ${res.error}`, 'error');
          }
        } catch (e) {
          console.error('Sync:', e);
          set(st => ({ connections: { ...st.connections, docs: false } }));
          if (showN) get().addNotification('Ошибка Docs', 'error');
        } finally {
          set({ isSyncing: false });
        }
      },

      syncAllFromDocs: async (silent = false) => {
        const s = get();
        if (s.isSyncing || !s.settings.googleDocsUrl) return;
        for (const u of s.units.filter(x => x.googleDocsHeader)) {
          await get().syncFromDocs(u.id, !silent);
        }
        set(st => ({ connections: { ...st.connections, lastSyncTime: Date.now() } }));
      },

      startAutoSync: () => {
        const s = get();
        if (s.autoSyncIntervalId) clearInterval(s.autoSyncIntervalId);
        const ms = Math.max(1, s.settings.autoSyncInterval) * 60000;
        const id = window.setInterval(() => {
          const c = get();
          if (!c.settings.googleDocsUrl || c.isSyncing) return;
          get().syncAllFromDocs(true);
        }, ms);
        set({ autoSyncIntervalId: id });
      },

      stopAutoSync: () => {
        const s = get();
        if (s.autoSyncIntervalId) {
          clearInterval(s.autoSyncIntervalId);
          set({ autoSyncIntervalId: null });
        }
      },

      // ── Settings ──
      updateSettings: (partial) => {
        set(s => ({ settings: { ...s.settings, ...partial } }));
        if (partial.googleDocsUrl !== undefined) {
          docsService.setUrl(partial.googleDocsUrl);
        }
        if (partial.autoSyncInterval !== undefined) {
          get().stopAutoSync();
          get().startAutoSync();
        }
        if (partial.showTokenBars !== undefined) {
          if (partial.showTokenBars) {
            tokenBarService.syncAllBars(get().units).catch(console.warn);
          } else {
            tokenBarService.removeAllBars().catch(console.warn);
          }
        }
      },

      // ── UI ──
      setActiveTab: (tab) => set({ activeTab: tab }),

      triggerEffect: (effect) => {
        set({ activeEffect: null });
        requestAnimationFrame(() => {
          set({ activeEffect: effect });
          setTimeout(() => set({ activeEffect: null }), 700);
        });
      },

      addNotification: (message, type) => {
        const s = get();
        if (s.notifications.some(n => n.message === message)) return;
        const n: Notification = { id: generateId(), message, type, timestamp: Date.now() };
        set(st => {
          const a = [...st.notifications, n];
          return { notifications: a.length > MAX_NOTIFICATIONS ? a.slice(-MAX_NOTIFICATIONS) : a };
        });
        setTimeout(() => get().clearNotification(n.id), 5000);
      },

      clearNotification: (id) => {
        set(s => ({ notifications: s.notifications.filter(n => n.id !== id) }));
      },

      addCombatLog: (unitName, action, details) => {
        set(s => ({
          combatLog: [...s.combatLog, { timestamp: Date.now(), unitName, action, details }].slice(-100)
        }));
        const cs = get().settings;
        if (cs.writeLogs && cs.googleDocsUrl) {
          const u = get().units.find(x => x.shortName === unitName);
          if (u?.googleDocsHeader) {
            docsService.log(u.googleDocsHeader, `${action}: ${details}`).catch(console.error);
          }
        }
      },

      setConnection: (key, value) => {
        set(s => ({ connections: { ...s.connections, [key]: value } }));
      },

      // НОВОЕ: управление модификатором броска
      setNextRollModifier: (modifier) => {
        set({ nextRollModifier: modifier });
      },

      consumeRollModifier: () => {
        const current = get().nextRollModifier;
        set({ nextRollModifier: 'normal' });
        return current;
      },
    }),
    {
      name: 'cursed-hearts-storage',
      partialize: (s) => ({
        units: s.units,
        selectedUnitId: s.selectedUnitId,
        settings: s.settings
        // nextRollModifier НЕ персистим — это transient
      })
    }
  )
);

// Init (safe)
try {
  const s = useGameStore.getState();
  if (s.settings.googleDocsUrl) docsService.setUrl(s.settings.googleDocsUrl);
} catch { /* ignore */ }
