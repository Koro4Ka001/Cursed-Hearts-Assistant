import { useEffect, useState, useRef, Component, type ReactNode } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { useGameStore } from './stores/useGameStore';
import { initOBR } from './services/obrService';
import { docsService } from './services/docsService';
import { diceService, DICE_BROADCAST_CHANNEL } from './services/diceService';
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

// === ERROR BOUNDARY ===

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
    console.error(`[ErrorBoundary] Ошибка в ${this.props.tabName ?? 'компоненте'}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="heading text-blood-bright mb-2">Произошла ошибка</h3>
          <p className="text-faded text-sm text-center mb-4 max-w-xs">
            {this.state.error?.message ?? 'Неизвестная ошибка'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn btn-gold px-4 py-2 text-sm"
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// === TABS ===

type TabId = 'combat' | 'magic' | 'cards' | 'actions' | 'notes' | 'settings';

interface Tab {
  id: TabId;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'combat', icon: '⚔️' },
  { id: 'magic', icon: '✨' },
  { id: 'cards', icon: '🃏' },
  { id: 'actions', icon: '⚡' },
  { id: 'notes', icon: '📝' },
  { id: 'settings', icon: '⚙️' }
];

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const initRef = useRef(false);

  const {
    activeTab,
    setActiveTab,
    notifications,
    clearNotification,
    connections,
    setConnection,
    settings,
    startAutoSync,
    activeEffect
  } = useGameStore();

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        await initOBR();
        setConnection('owlbear', true);

        await diceService.initialize();
        setConnection('dice', diceService.getStatus());

        OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, (event) => {
          const data = event.data as { message?: string } | undefined;
          const message = data?.message;
          if (message && typeof message === 'string') {
            OBR.notification.show(message);
          }
        });

        if (settings.googleDocsUrl) {
          docsService.setUrl(settings.googleDocsUrl);
          try {
            const test = await docsService.testConnection();
            setConnection('docs', test.success);
          } catch {
            setConnection('docs', false);
          }
          startAutoSync();
        }
      } catch (error) {
        console.error('Initialization error:', error);
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

  // Маппинг эффектов → CSS классы
  const effectClass = activeEffect
    ? ({
        shake: 'screen-shake',
        heal: 'screen-heal-glow',
        'crit-gold': 'screen-flash-gold',
        'crit-fail': 'screen-flash-blood'
      } as Record<string, string>)[activeEffect] ?? ''
    : '';

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-abyss relative">
        {/* Декоративный фон даже при загрузке */}
        <div className="absolute inset-0 bg-runes pointer-events-none">
          <span className="bg-rune">ᚱ</span>
          <span className="bg-rune">ᛟ</span>
          <span className="bg-rune">ᚺ</span>
        </div>
        <LoadingSpinner className="mb-4" />
        <div className="text-gold font-cinzel tracking-[4px] uppercase text-sm">
          Загрузка
        </div>
        <div className="text-dim font-garamond text-xs mt-2 tracking-wider">
          Гримуар пробуждается...
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'h-screen flex flex-col bg-abyss text-bone overflow-hidden app-frame',
      effectClass
    )}>
      {/* ═══ ДЕКОРАТИВНЫЙ ФОН ═══ */}

      {/* Руны — медленно мерцают */}
      <div className="bg-runes">
        <span className="bg-rune">ᚱ</span>
        <span className="bg-rune">ᛟ</span>
        <span className="bg-rune">ᚺ</span>
        <span className="bg-rune">ᛉ</span>
        <span className="bg-rune">ᚦ</span>
        <span className="bg-rune">ᛊ</span>
      </div>

      {/* Тлеющие угольки */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="ember ember-1" />
        <div className="ember ember-2" />
        <div className="ember ember-3" />
      </div>

      {/* Виньетка */}
      <div className="app-vignette" />

      {/* ═══ CONTENT (z-index выше декораций) ═══ */}
      <div className="relative z-10 flex flex-col h-full">

        {/* HEADER */}
        <UnitSelector />

        {/* STAT BARS */}
        <StatBars />

        {/* TABS */}
        <div className="flex border-b border-edge-bone bg-obsidian shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-2 text-lg transition-all min-w-0 flex items-center justify-center tab-rune',
                activeTab === tab.id ? 'tab-active' : 'tab-inactive'
              )}
              title={tab.id}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {/* TAB CONTENT — fade-in при смене */}
        <div className="flex-1 overflow-hidden" key={activeTab}>
          <div className="tab-content-enter h-full">
            {activeTab === 'combat' && (
              <ErrorBoundary tabName="Бой"><CombatTab /></ErrorBoundary>
            )}
            {activeTab === 'magic' && (
              <ErrorBoundary tabName="Магия"><MagicTab /></ErrorBoundary>
            )}
            {activeTab === 'cards' && (
              <ErrorBoundary tabName="Карты Рока"><CardsTab /></ErrorBoundary>
            )}
            {activeTab === 'actions' && (
              <ErrorBoundary tabName="Действия"><ActionsTab /></ErrorBoundary>
            )}
            {activeTab === 'notes' && (
              <ErrorBoundary tabName="Заметки"><NotesTab /></ErrorBoundary>
            )}
            {activeTab === 'settings' && (
              <ErrorBoundary tabName="Настройки"><SettingsTab /></ErrorBoundary>
            )}
          </div>
        </div>

        {/* STATUS BAR */}
        <div className="h-6 flex items-center justify-between px-3 bg-obsidian border-t border-edge-bone text-[9px] shrink-0 font-cinzel tracking-wider uppercase">
          <div className="flex items-center gap-3">
            <span className={connections.owlbear ? 'text-green-500' : 'text-blood'}>
              OBR {connections.owlbear ? '●' : '○'}
            </span>
            <span className={connections.docs ? 'text-green-500' : 'text-faded'}>
              Docs {connections.docs ? '●' : (settings.googleDocsUrl ? '○' : '—')}
            </span>
            <span className="text-faded">
              Dice ●
            </span>
          </div>
          <div className="text-dim">
            ⟐ {formatLastSync()}
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS */}
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
