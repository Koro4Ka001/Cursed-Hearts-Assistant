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
          <div className="text-4xl mb-4 animate-float">⚠️</div>
          <h3 className="heading text-blood-bright mb-2 text-sm">Произошла ошибка</h3>
          <p className="text-faded text-sm text-center mb-4 max-w-xs font-garamond">
            {this.state.error?.message ?? 'Неизвестная ошибка'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn btn-gold px-4 py-2"
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
  title: string;
}

// 6 вкладок — ТОЛЬКО ИКОНКИ
const TABS: Tab[] = [
  { id: 'combat', icon: '⚔️', title: 'Бой' },
  { id: 'magic', icon: '✨', title: 'Магия' },
  { id: 'cards', icon: '🃏', title: 'Карты Рока' },
  { id: 'actions', icon: '⚡', title: 'Действия' },
  { id: 'notes', icon: '📝', title: 'Заметки' },
  { id: 'settings', icon: '⚙️', title: 'Настройки' }
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
    screenEffect
  } = useGameStore();
  
  // Инициализация — выполняется ОДИН РАЗ
  useEffect(() => {
    // Защита от двойного вызова в StrictMode
    if (initRef.current) return;
    initRef.current = true;
    
    const init = async () => {
      try {
        // Инициализируем OBR SDK
        await initOBR();
        setConnection('owlbear', true);
        
        // Инициализируем Dice Service
        await diceService.initialize();
        setConnection('dice', diceService.getStatus());
        
        // Слушаем броски кубиков от ДРУГИХ игроков
        OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, (event) => {
          const data = event.data as { message?: string } | undefined;
          const message = data?.message;
          if (message && typeof message === 'string') {
            OBR.notification.show(message);
          }
        });
        console.log('[App] Broadcast listener для кубиков установлен');
        
        // Инициализируем Google Docs сервис (только если URL настроен)
        if (settings.googleDocsUrl) {
          docsService.setUrl(settings.googleDocsUrl);
          try {
            const test = await docsService.testConnection();
            setConnection('docs', test.success);
          } catch {
            setConnection('docs', false);
          }
          
          // Запускаем авто-синхронизацию ТОЛЬКО если URL настроен
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
  
  // Форматирование времени последней синхронизации
  const formatLastSync = () => {
    if (!connections.lastSyncTime) return '—';
    
    const diff = Date.now() - connections.lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `0:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Статус Dice — теперь всегда broadcast
  const getDiceStatusIcon = () => '🟢';
  const getDiceStatusLabel = () => 'Broadcast';
  
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-abyss">
        <LoadingSpinner className="mb-4" />
        <div className="text-gold font-cinzel text-sm tracking-wider">Загрузка гримуара...</div>
      </div>
    );
  }
  
  return (
    <div className={cn(
      "h-screen flex flex-col bg-abyss text-bone overflow-hidden",
      screenEffect === 'shake' && 'animate-screen-shake'
    )}>
      {/* SCREEN EFFECTS LAYER */}
      <div className="effects-layer">
        {screenEffect === 'crit' && <div className="effect-crit-flash" />}
        {screenEffect === 'fail' && <div className="effect-fail-flash" />}
        {screenEffect === 'heal' && <div className="effect-heal-flash" />}
      </div>
      
      {/* HEADER: Unit Selector + Sync */}
      <UnitSelector />
      
      {/* STAT BARS: HP & Mana */}
      <StatBars />
      
      {/* TABS — 6 вкладок, ТОЛЬКО ИКОНКИ */}
      <div className="flex border-b border-edge-bone bg-obsidian shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 py-2 text-lg transition-all min-w-0 flex items-center justify-center',
              activeTab === tab.id
                ? 'tab-active'
                : 'tab-inactive'
            )}
            title={tab.title}
          >
            {tab.icon}
          </button>
        ))}
      </div>
      
      {/* TAB CONTENT — каждая вкладка обёрнута в ErrorBoundary */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'combat' && (
          <ErrorBoundary tabName="Бой">
            <CombatTab />
          </ErrorBoundary>
        )}
        {activeTab === 'magic' && (
          <ErrorBoundary tabName="Магия">
            <MagicTab />
          </ErrorBoundary>
        )}
        {activeTab === 'cards' && (
          <ErrorBoundary tabName="Карты Рока">
            <CardsTab />
          </ErrorBoundary>
        )}
        {activeTab === 'actions' && (
          <ErrorBoundary tabName="Действия">
            <ActionsTab />
          </ErrorBoundary>
        )}
        {activeTab === 'notes' && (
          <ErrorBoundary tabName="Заметки">
            <NotesTab />
          </ErrorBoundary>
        )}
        {activeTab === 'settings' && (
          <ErrorBoundary tabName="Настройки">
            <SettingsTab />
          </ErrorBoundary>
        )}
      </div>
      
      {/* STATUS BAR */}
      <div className="h-6 flex items-center justify-between px-2 bg-obsidian border-t border-edge-bone text-[10px] shrink-0 font-cinzel tracking-wider">
        <div className="flex items-center gap-2">
          <span className={connections.owlbear ? 'text-heal-bright' : 'text-blood'}>
            OBR:{connections.owlbear ? '🟢' : '🔴'}
          </span>
          <span className={connections.docs ? 'text-heal-bright' : 'text-faded'}>
            Docs:{connections.docs ? '🟢' : (settings.googleDocsUrl ? '🔴' : '⚪')}
          </span>
          <span className="text-faded" title={`Кубики: ${getDiceStatusLabel()}`}>
            Dice:{getDiceStatusIcon()}
          </span>
        </div>
        <div className="text-faded">
          Sync: {formatLastSync()}
        </div>
      </div>
      
      {/* NOTIFICATIONS — макс 3 штуки, фиксированная позиция */}
      <div className="fixed top-2 right-2 z-50 space-y-2 max-w-xs pointer-events-none">
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
