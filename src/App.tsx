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

interface EBProps { children: ReactNode; fallback?: ReactNode; tabName?: string; }
interface EBState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error(`[EB] ${this.props.tabName}:`, error, info); }
  render() {
    if (this.state.hasError) return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="heading text-blood-bright mb-2">Ошибка</h3>
        <p className="text-faded text-sm text-center mb-4 max-w-xs">{this.state.error?.message ?? '?'}</p>
        <button onClick={() => this.setState({ hasError: false, error: null })} className="btn btn-gold px-4 py-2 text-sm">Повторить</button>
      </div>
    );
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════
// TYPES & TABS
// ═══════════════════════════════════════════════════════════════

type ViewMode = 'compact' | 'medium' | 'large';
type TabId = 'combat' | 'magic' | 'cards' | 'actions' | 'notes' | 'settings';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'combat', icon: '⚔️', label: 'Бой' },
  { id: 'magic', icon: '✨', label: 'Магия' },
  { id: 'cards', icon: '🃏', label: 'Карты' },
  { id: 'actions', icon: '⚡', label: 'Действия' },
  { id: 'notes', icon: '📝', label: 'Заметки' },
  { id: 'settings', icon: '⚙️', label: 'Настройки' }
];

// Размеры окна OBR для каждого режима
const VIEW_SIZES: Record<ViewMode, { width: number; height: number }> = {
  compact: { width: 300, height: 120 },
  medium: { width: 400, height: 700 },
  large: { width: 800, height: 900 }
};

// ═══════════════════════════════════════════════════════════════
// COMPACT VIEW — Только HP/Mana
// ═══════════════════════════════════════════════════════════════

function CompactView({ onChangeMode }: { onChangeMode: (m: ViewMode) => void }) {
  const units = useGameStore(s => s.units);
  const selectedUnitId = useGameStore(s => s.selectedUnitId);
  const selectUnit = useGameStore(s => s.selectUnit);
  const setHP = useGameStore(s => s.setHP);
  const setMana = useGameStore(s => s.setMana);
  const triggerEffect = useGameStore(s => s.triggerEffect);

  const unit = units.find(u => u.id === selectedUnitId);

  if (!unit) {
    return (
      <div className="compact-frame">
        <div className="compact-header">
          <span className="text-gold font-cinzel text-[10px] tracking-wider">☠️ CURSED HEARTS</span>
          <div className="flex gap-1">
            <button onClick={() => onChangeMode('medium')} className="compact-mode-btn" title="Средний">▣</button>
            <button onClick={() => onChangeMode('large')} className="compact-mode-btn" title="Большой">⤢</button>
          </div>
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

  // Переключение юнитов
  const unitIdx = units.findIndex(u => u.id === selectedUnitId);
  const prevUnit = () => { if (unitIdx > 0) selectUnit(units[unitIdx - 1]!.id); };
  const nextUnit = () => { if (unitIdx < units.length - 1) selectUnit(units[unitIdx + 1]!.id); };

  return (
    <div className={cn('compact-frame', hpLow && 'compact-frame-danger')}>
      <div className="compact-header">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {units.length > 1 && (
            <button onClick={prevUnit} className="compact-nav-btn" disabled={unitIdx === 0}>◂</button>
          )}
          <span className="text-gold font-cinzel text-[10px] tracking-wider truncate flex-1 text-center">
            {unit.shortName || unit.name}
          </span>
          {units.length > 1 && (
            <button onClick={nextUnit} className="compact-nav-btn" disabled={unitIdx === units.length - 1}>▸</button>
          )}
        </div>
        <div className="flex gap-1 ml-2">
          <button onClick={() => onChangeMode('medium')} className="compact-mode-btn" title="Средний">▣</button>
          <button onClick={() => onChangeMode('large')} className="compact-mode-btn" title="Большой">⤢</button>
        </div>
      </div>

      {!unit.useManaAsHp && (
        <div className="compact-bar">
          <div className="compact-bar-bg compact-bar-hp-bg" />
          <div className="compact-bar-fill compact-bar-hp-fill" style={{ width: `${hpPct}%` }} />
          <span className="compact-bar-text">❤ {hp}/{maxHp}</span>
        </div>
      )}

      <div className="compact-bar">
        <div className="compact-bar-bg compact-bar-mana-bg" />
        <div className="compact-bar-fill compact-bar-mana-fill" style={{ width: `${manaPct}%` }} />
        <span className="compact-bar-text">💠 {mana}/{maxMana}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LARGE VIEW — Полноэкранный режим
// ═══════════════════════════════════════════════════════════════

function LargeView({ onChangeMode }: { onChangeMode: (m: ViewMode) => void }) {
  const activeTab = useGameStore(s => s.activeTab);
  const setActiveTab = useGameStore(s => s.setActiveTab);
  const connections = useGameStore(s => s.connections);
  const googleDocsUrl = useGameStore(s => s.settings.googleDocsUrl);
  const combatLog = useGameStore(s => s.combatLog);

  return (
    <div className="large-frame">
      {/* Шапка */}
      <div className="large-header">
        <div className="flex items-center gap-3">
          <span className="text-gold-bright font-cinzel-decorative text-sm tracking-[4px] uppercase text-glow-gold">
            ☠️ Cursed Hearts
          </span>
          <div className="flex items-center gap-2 ml-4">
            <span className={cn('status-dot text-[9px]', connections.owlbear ? 'status-online' : 'status-offline')}>
              OBR {connections.owlbear ? '●' : '○'}
            </span>
            <span className={cn('status-dot text-[9px]', connections.docs ? 'status-online' : 'status-dim')}>
              Docs {connections.docs ? '●' : (googleDocsUrl ? '○' : '—')}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onChangeMode('compact')} className="compact-mode-btn" title="Мини">⤡</button>
          <button onClick={() => onChangeMode('medium')} className="compact-mode-btn" title="Средний">▣</button>
        </div>
      </div>

      {/* Основной контент: 2 колонки */}
      <div className="large-body">
        {/* Левая колонка — персонаж + статы */}
        <div className="large-sidebar">
          <UnitSelector />
          <StatBars />

          {/* Мини-лог */}
          <div className="large-log">
            <div className="large-log-header">
              <span className="text-gold font-cinzel text-[10px] uppercase tracking-wider">Хроника</span>
            </div>
            <div className="large-log-body">
              {combatLog.length === 0 ? (
                <div className="text-dim text-xs text-center py-4 font-garamond italic">Тишина...</div>
              ) : (
                combatLog.slice(-15).map((entry, i) => (
                  <div key={i} className="large-log-entry">
                    <span className="text-gold-dark font-cinzel text-[9px]">{entry.unitName}</span>
                    <span className="text-faded text-[10px] ml-1">{entry.action}: {entry.details}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Правая колонка — вкладки */}
        <div className="large-main">
          {/* Вкладки */}
          <div className="large-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'large-tab',
                  activeTab === tab.id ? 'large-tab-active' : 'large-tab-inactive'
                )}
              >
                <span className="text-base">{tab.icon}</span>
                <span className="text-[10px] font-cinzel uppercase tracking-wider">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Контент вкладки */}
          <div className="large-tab-content" key={activeTab}>
            <div className="tab-content-enter h-full">
              {activeTab === 'combat' && <ErrorBoundary tabName="Бой"><CombatTab /></ErrorBoundary>}
              {activeTab === 'magic' && <ErrorBoundary tabName="Магия"><MagicTab /></ErrorBoundary>}
              {activeTab === 'cards' && <ErrorBoundary tabName="Карты"><CardsTab /></ErrorBoundary>}
              {activeTab === 'actions' && <ErrorBoundary tabName="Действия"><ActionsTab /></ErrorBoundary>}
              {activeTab === 'notes' && <ErrorBoundary tabName="Заметки"><NotesTab /></ErrorBoundary>}
              {activeTab === 'settings' && <ErrorBoundary tabName="Настройки"><SettingsTab /></ErrorBoundary>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MEDIUM VIEW — Текущий стандартный
// ═══════════════════════════════════════════════════════════════

function MediumView({ onChangeMode }: { onChangeMode: (m: ViewMode) => void }) {
  const activeTab = useGameStore(s => s.activeTab);
  const setActiveTab = useGameStore(s => s.setActiveTab);
  const connections = useGameStore(s => s.connections);
  const googleDocsUrl = useGameStore(s => s.settings.googleDocsUrl);
  const activeEffect = useGameStore(s => s.activeEffect);

  const effectClass = activeEffect
    ? ({ shake: 'screen-shake', heal: 'screen-heal-glow', 'crit-gold': 'screen-flash-gold', 'crit-fail': 'screen-flash-blood' } as Record<string, string>)[activeEffect] ?? ''
    : '';

  const formatLastSync = () => {
    const t = connections.lastSyncTime;
    if (!t) return '—';
    const d = Date.now() - t;
    const m = Math.floor(d / 60000);
    const s = Math.floor((d % 60000) / 1000);
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('h-full flex flex-col bg-abyss text-bone overflow-hidden app-frame', effectClass)}>
      {/* Фон */}
      <div className="bg-runes">
        {['ᚱ','ᛟ','ᚺ','ᛉ','ᚦ','ᛊ','ᛏ','ᚹ'].map((r, i) => <span key={i} className="bg-rune">{r}</span>)}
      </div>
      <div className="absolute inset-0 pointer-events-none z-0">
        {[1,2,3,4,5].map(i => <div key={i} className={`ember ember-${i}`} />)}
      </div>
      <div className="app-vignette" />
      <div className="gold-dust" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Кнопки режимов */}
        <div className="mode-switcher">
          <button onClick={() => onChangeMode('compact')} className="compact-mode-btn" title="Мини">⤡</button>
          <button onClick={() => onChangeMode('large')} className="compact-mode-btn" title="Большой">⤢</button>
        </div>

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
              {tab.icon}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden" key={activeTab}>
          <div className="tab-content-enter h-full">
            {activeTab === 'combat' && <ErrorBoundary tabName="Бой"><CombatTab /></ErrorBoundary>}
            {activeTab === 'magic' && <ErrorBoundary tabName="Магия"><MagicTab /></ErrorBoundary>}
            {activeTab === 'cards' && <ErrorBoundary tabName="Карты"><CardsTab /></ErrorBoundary>}
            {activeTab === 'actions' && <ErrorBoundary tabName="Действия"><ActionsTab /></ErrorBoundary>}
            {activeTab === 'notes' && <ErrorBoundary tabName="Заметки"><NotesTab /></ErrorBoundary>}
            {activeTab === 'settings' && <ErrorBoundary tabName="Настройки"><SettingsTab /></ErrorBoundary>}
          </div>
        </div>

        <div className="status-bar">
          <div className="flex items-center gap-3">
            <span className={cn('status-dot', connections.owlbear ? 'status-online' : 'status-offline')}>OBR {connections.owlbear ? '●' : '○'}</span>
            <span className={cn('status-dot', connections.docs ? 'status-online' : 'status-dim')}>Docs {connections.docs ? '●' : (googleDocsUrl ? '○' : '—')}</span>
            <span className="status-dot status-dim">Dice ●</span>
          </div>
          <div className="text-dim font-medieval">⟐ {formatLastSync()}</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('medium');
  const initRef = useRef(false);

  const notifications = useGameStore(s => s.notifications);
  const clearNotification = useGameStore(s => s.clearNotification);
  const setConnection = useGameStore(s => s.setConnection);
  const startAutoSync = useGameStore(s => s.startAutoSync);

  // Изменение размера OBR окна
  const changeMode = (mode: ViewMode) => {
    setViewMode(mode);
    const size = VIEW_SIZES[mode];
    try {
      OBR.action.setHeight(size.height);
      OBR.action.setWidth(size.width);
    } catch {
      // OBR может не поддерживать — игнорируем
    }
  };

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        await initOBR();
        setConnection('owlbear', true);

        await diceService.initialize();
        setConnection('dice', diceService.getStatus());

        try {
          OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, (event) => {
            const data = event.data as { message?: string } | undefined;
            if (data?.message && typeof data.message === 'string') {
              OBR.notification.show(data.message);
            }
          });
        } catch {}

        try {
          await tokenBarService.initialize();
          const state = useGameStore.getState();
          if (state.settings.showTokenBars ?? true) {
            await tokenBarService.syncAllBars(state.units);
          }
        } catch {}

        const url = useGameStore.getState().settings.googleDocsUrl;
        if (url) {
          docsService.setUrl(url);
          try { const t = await docsService.testConnection(); setConnection('docs', t.success); } catch { setConnection('docs', false); }
          startAutoSync();
        }
      } catch (e) {
        console.error('[App] Init:', e);
      } finally {
        setIsLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-abyss relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {['ᚱ','ᛟ','ᚺ','ᛉ','ᚦ'].map((r, i) => (
            <span key={i} className="loading-rune" style={{ top: `${15 + i * 15}%`, left: `${10 + i * 18}%`, animationDelay: `${i * 0.5}s` }}>{r}</span>
          ))}
        </div>
        <div className="absolute inset-0 pointer-events-none">
          {[1,2,3].map(i => <div key={i} className={`ember ember-${i}`} />)}
        </div>
        <LoadingSpinner className="mb-6" size="lg" />
        <div className="text-gold font-cinzel-decorative tracking-[6px] uppercase text-sm text-glow-gold">Загрузка</div>
        <div className="text-dim font-garamond text-xs mt-3 tracking-[3px] italic">Гримуар пробуждается...</div>
        <div className="mt-6 w-32 h-[1px] bg-gradient-to-r from-transparent via-gold-dark to-transparent" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-abyss text-bone overflow-hidden">
      {/* Контент по режиму */}
      {viewMode === 'compact' && <CompactView onChangeMode={changeMode} />}
      {viewMode === 'medium' && <MediumView onChangeMode={changeMode} />}
      {viewMode === 'large' && <LargeView onChangeMode={changeMode} />}

      {/* Уведомления (всегда видны) */}
      <div className="fixed top-2 right-2 z-[200] space-y-2 max-w-xs pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="pointer-events-auto">
            <NotificationToast message={n.message} type={n.type} onClose={() => clearNotification(n.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
