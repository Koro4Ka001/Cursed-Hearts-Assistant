// src/App.tsx
import { useEffect, useState, useRef, Component, type ReactNode } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { useGameStore } from './stores/useGameStore';
import { initOBR } from './services/obrService';
import { docsService } from './services/docsService';
import { diceService, DICE_BROADCAST_CHANNEL } from './services/diceService';
import { tokenBarService } from './services/tokenBarService';
import { UnitSelector } from './components/UnitSelector';
import { StatBars } from './components/StatBars';
import { CombatTab } from './components/tabs/CombatTab';
import { MagicTab } from './components/tabs/MagicTab';
import { CardsTab } from './components/tabs/CardsTab';
import { ActionsTab } from './components/tabs/ActionsTab';
import { NotesTab } from './components/tabs/NotesTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { NotificationToast, LoadingSpinner } from './components/ui';
import { cn } from './utils/cn';

// ═══════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  tabName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.tabName ?? 'component'}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="heading text-blood-bright mb-2">Ошибка</h3>
          <p className="text-faded text-sm text-center mb-4 max-w-xs">
            {this.state.error?.message ?? 'Неизвестная ошибка'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn btn-gold px-4 py-2 text-sm"
          >
            Повторить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════

type TabId = 'combat' | 'magic' | 'cards' | 'actions' | 'notes' | 'settings';

interface Tab {
  id: TabId;
  icon: string;
  label: string;
}

const TABS: Tab[] = [
  { id: 'combat', icon: '⚔️', label: 'Бой' },
  { id: 'magic', icon: '✨', label: 'Магия' },
  { id: 'cards', icon: '🃏', label: 'Карты' },
  { id: 'actions', icon: '⚡', label: 'Действия' },
  { id: 'notes', icon: '📝', label: 'Заметки' },
  { id: 'settings', icon: '⚙️', label: 'Настройки' }
];

// ═══════════════════════════════════════════════════════════════
// COMPACT MODE — Мини-виджет
// ═══════════════════════════════════════════════════════════════

function CompactView({ onExpand }: { onExpand: () => void }) {
  const units = useGameStore((s) => s.units);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const setHP = useGameStore((s) => s.setHP);
  const setMana = useGameStore((s) => s.setMana);
  const triggerEffect = useGameStore((s) => s.triggerEffect);

  const unit = units.find(u => u.id === selectedUnitId);

  if (!unit) {
    return (
      <div className="compact-frame">
        <div className="compact-header">
          <span className="text-gold font-cinzel text-xs tracking-wider">☠️ CURSED HEARTS</span>
          <button onClick={onExpand} className="compact-expand-btn" title="Развернуть">⤢</button>
        </div>
        <div className="p-2 text-center text-faded text-xs">Нет персонажа</div>
      </div>
    );
  }

  const hp = unit.health.current;
  const maxHp = unit.health.max || 1;
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const hpLow = hpPct < 25 && hpPct > 0;

  const mana = unit.mana.current;
  const maxMana = unit.mana.max || 1;
  const manaPct = Math.max(0, Math.min(100, (mana / maxMana) * 100));

  // Быстрые действия
  const quickHeal = async (amount: number) => {
    const newHp = Math.min(maxHp, hp + amount);
    await setHP(unit.id, newHp);
    triggerEffect('heal');
  };

  const quickDamage = async (amount: number) => {
    await setHP(unit.id, hp - amount);
    triggerEffect('shake');
  };

  return (
    <div className={cn('compact-frame', hpLow && 'compact-frame-danger')}>
      {/* Заголовок */}
      <div className="compact-header">
        <span className="text-gold font-cinzel text-[10px] tracking-wider truncate flex-1">
          {unit.shortName || unit.name}
        </span>
        <button onClick={onExpand} className="compact-expand-btn" title="Развернуть">⤢</button>
      </div>

      {/* HP мини-бар */}
      {!unit.useManaAsHp && (
        <div className="compact-bar">
          <div className="compact-bar-bg compact-bar-hp-bg" />
          <div className="compact-bar-fill compact-bar-hp-fill" style={{ width: `${hpPct}%` }} />
          <span className="compact-bar-text">❤ {hp}/{maxHp}</span>
        </div>
      )}

      {/* Mana мини-бар */}
      <div className="compact-bar">
        <div className="compact-bar-bg compact-bar-mana-bg" />
        <div className="compact-bar-fill compact-bar-mana-fill" style={{ width: `${manaPct}%` }} />
        <span className="compact-bar-text">💠 {mana}/{maxMana}</span>
      </div>

      {/* Быстрые кнопки */}
      <div className="compact-actions">
        <button onClick={() => quickDamage(5)} className="compact-btn compact-btn-damage" title="-5 HP">-5</button>
        <button onClick={() => quickDamage(10)} className="compact-btn compact-btn-damage" title="-10 HP">-10</button>
        <button onClick={() => quickDamage(25)} className="compact-btn compact-btn-damage" title="-25 HP">-25</button>
        <div className="compact-divider" />
        <button onClick={() => quickHeal(5)} className="compact-btn compact-btn-heal" title="+5 HP">+5</button>
        <button onClick={() => quickHeal(10)} className="compact-btn compact-btn-heal" title="+10 HP">+10</button>
        <button onClick={() => quickHeal(25)} className="compact-btn compact-btn-heal" title="+25 HP">+25</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const initRef = useRef(false);

  const activeTab = useGameStore((s) => s.activeTab);
  const setActiveTab = useGameStore((s) => s.setActiveTab);
  const notifications = useGameStore((s) => s.notifications);
  const clearNotification = useGameStore((s) => s.clearNotification);
  const connections = useGameStore((s) => s.connections);
  const setConnection = useGameStore((s) => s.setConnection);
  const startAutoSync = useGameStore((s) => s.startAutoSync);
  const activeEffect = useGameStore((s) => s.activeEffect);
  const googleDocsUrl = useGameStore((s) => s.settings.googleDocsUrl);

  // Попытка изменить размер OBR окна при переключении режима
  useEffect(() => {
    try {
      if (isCompact) {
        OBR.action.setHeight(140);
      } else {
        OBR.action.setHeight(700);
      }
    } catch {
      // OBR может не поддерживать setHeight — игнорируем
    }
  }, [isCompact]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        // 1. OBR SDK
        await initOBR();
        setConnection('owlbear', true);
        console.log('[App] OBR Ready');

        // 2. Dice Service
        await diceService.initialize();
        setConnection('dice', diceService.getStatus());

        // 3. Broadcast listener
        try {
          OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, (event) => {
            const data = event.data as { message?: string } | undefined;
            const message = data?.message;
            if (message && typeof message === 'string') {
              OBR.notification.show(message);
            }
          });
        } catch (e) {
          console.warn('[App] Broadcast:', e);
        }

        // 4. Token Bars
        try {
          await tokenBarService.initialize();
          const state = useGameStore.getState();
          if (state.settings.showTokenBars ?? true) {
            await tokenBarService.syncAllBars(state.units);
            console.log('[App] Token bars synced for', state.units.length, 'units');
          }
        } catch (e) {
          console.warn('[App] Token bars:', e);
        }

        // 5. Google Docs
        const currentUrl = useGameStore.getState().settings.googleDocsUrl;
        if (currentUrl) {
          docsService.setUrl(currentUrl);
          try {
            const test = await docsService.testConnection();
            setConnection('docs', test.success);
          } catch {
            setConnection('docs', false);
          }
          startAutoSync();
        }

      } catch (error) {
        console.error('[App] Init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatLastSync = () => {
    if (!connections.lastSyncTime) return '—';
    const diff = Date.now() - connections.lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    return `0:${seconds.toString().padStart(2, '0')}`;
  };

  const effectClass = activeEffect
    ? ({
        shake: 'screen-shake',
        heal: 'screen-heal-glow',
        'crit-gold': 'screen-flash-gold',
        'crit-fail': 'screen-flash-blood'
      } as Record<string, string>)[activeEffect] ?? ''
    : '';

  // ── Loading ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-abyss relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <span className="loading-rune" style={{ top: '15%', left: '10%', animationDelay: '0s' }}>ᚱ</span>
          <span className="loading-rune" style={{ top: '30%', right: '15%', animationDelay: '1s' }}>ᛟ</span>
          <span className="loading-rune" style={{ top: '60%', left: '20%', animationDelay: '2s' }}>ᚺ</span>
          <span className="loading-rune" style={{ top: '75%', right: '25%', animationDelay: '0.5s' }}>ᛉ</span>
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="ember ember-1" />
          <div className="ember ember-2" />
          <div className="ember ember-3" />
        </div>
        <LoadingSpinner className="mb-6" size="lg" />
        <div className="text-gold font-cinzel-decorative tracking-[6px] uppercase text-sm text-glow-gold">
          Загрузка
        </div>
        <div className="text-dim font-garamond text-xs mt-3 tracking-[3px] italic">
          Гримуар пробуждается...
        </div>
        <div className="mt-6 w-32 h-[1px] bg-gradient-to-r from-transparent via-gold-dark to-transparent" />
      </div>
    );
  }

  // ── Compact Mode ─────────────────────────────────────────

  if (isCompact) {
    return (
      <div className={cn('h-screen bg-abyss text-bone overflow-hidden', effectClass)}>
        <CompactView onExpand={() => setIsCompact(false)} />
        {/* Уведомления даже в компактном режиме */}
        <div className="fixed top-1 right-1 z-[200] space-y-1 max-w-[200px] pointer-events-none">
          {notifications.map(notification => (
            <div key={notification.id} className="pointer-events-auto">
              <NotificationToast
                message={notification.message}
                type={notification.type}
                onClose={() => clearNotification(notification.id)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Full Mode ────────────────────────────────────────────

  return (
    <div className={cn(
      'h-screen flex flex-col bg-abyss text-bone overflow-hidden app-frame',
      effectClass
    )}>
      {/* Декоративный фон */}
      <div className="bg-runes">
        <span className="bg-rune">ᚱ</span>
        <span className="bg-rune">ᛟ</span>
        <span className="bg-rune">ᚺ</span>
        <span className="bg-rune">ᛉ</span>
        <span className="bg-rune">ᚦ</span>
        <span className="bg-rune">ᛊ</span>
        <span className="bg-rune">ᛏ</span>
        <span className="bg-rune">ᚹ</span>
      </div>

      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="ember ember-1" />
        <div className="ember ember-2" />
        <div className="ember ember-3" />
        <div className="ember ember-4" />
        <div className="ember ember-5" />
      </div>

      <div className="app-vignette" />
      <div className="gold-dust" />

      {/* Контент */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Кнопка свернуть */}
        <button
          onClick={() => setIsCompact(true)}
          className="compact-toggle-btn"
          title="Свернуть в мини-режим"
        >
          ⤡
        </button>

        <UnitSelector />
        <StatBars />

        {/* Вкладки */}
        <div className="flex border-b border-gold-dark/30 bg-obsidian/80 shrink-0 backdrop-blur-sm">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-2.5 text-lg transition-all min-w-0 flex items-center justify-center tab-rune relative',
                activeTab === tab.id ? 'tab-active' : 'tab-inactive'
              )}
              title={tab.label}
            >
              <span className="relative z-10">{tab.icon}</span>
            </button>
          ))}
        </div>

        {/* Контент вкладки */}
        <div className="flex-1 overflow-hidden" key={activeTab}>
          <div className="tab-content-enter h-full">
            {activeTab === 'combat' && <ErrorBoundary tabName="Бой"><CombatTab /></ErrorBoundary>}
            {activeTab === 'magic' && <ErrorBoundary tabName="Магия"><MagicTab /></ErrorBoundary>}
            {activeTab === 'cards' && <ErrorBoundary tabName="Карты Рока"><CardsTab /></ErrorBoundary>}
            {activeTab === 'actions' && <ErrorBoundary tabName="Действия"><ActionsTab /></ErrorBoundary>}
            {activeTab === 'notes' && <ErrorBoundary tabName="Заметки"><NotesTab /></ErrorBoundary>}
            {activeTab === 'settings' && <ErrorBoundary tabName="Настройки"><SettingsTab /></ErrorBoundary>}
          </div>
        </div>

        {/* Статус бар */}
        <div className="status-bar">
          <div className="flex items-center gap-3">
            <span className={cn('status-dot', connections.owlbear ? 'status-online' : 'status-offline')}>
              OBR {connections.owlbear ? '●' : '○'}
            </span>
            <span className={cn('status-dot', connections.docs ? 'status-online' : 'status-dim')}>
              Docs {connections.docs ? '●' : (googleDocsUrl ? '○' : '—')}
            </span>
            <span className="status-dot status-dim">Dice ●</span>
          </div>
          <div className="text-dim font-medieval">⟐ {formatLastSync()}</div>
        </div>
      </div>

      {/* Уведомления */}
      <div className="fixed top-2 right-2 z-[200] space-y-2 max-w-xs pointer-events-none">
        {notifications.map(notification => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationToast
              message={notification.message}
              type={notification.type}
              onClose={() => clearNotification(notification.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
