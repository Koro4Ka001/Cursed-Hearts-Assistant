import { useEffect, useState, useRef, Component, type ReactNode } from 'react';
import { useGameStore } from './stores/useGameStore';
import { initOBR } from './services/obrService';
import { docsService } from './services/docsService';
import { diceService } from './services/diceService';
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

// 6 вкладок — ТОЛЬКО ИКОНКИ
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
    startAutoSync
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
        
        // Инициализируем Google Docs сервис (только если URL настроен)
        if (settings.googleDocsUrl) {
          docsService.setUrl(settings.googleDocsUrl);
          try {
            const test = await docsService.testConnection();
            setConnection('docs', test.success);
          } catch {
            // Ошибка подключения — не показываем уведомление при запуске
            setConnection('docs', false);
          }
          
          // Запускаем авто-синхронизацию ТОЛЬКО если URL настроен
          startAutoSync();
        }
        // Если URL не настроен — НЕ запускаем авто-синхронизацию, НЕ показываем ошибки
        
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
  
  // Получение иконки статуса Dice — теперь используем broadcast для всех
  const getDiceStatusIcon = () => '🟢';
  const getDiceStatusLabel = () => 'Broadcast';
  
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-abyss">
        <LoadingSpinner className="mb-4" />
        <div className="text-gold font-cinzel">Загрузка...</div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-abyss text-bone overflow-hidden">
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
            title={tab.id}
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
      <div className="h-6 flex items-center justify-between px-2 bg-obsidian border-t border-edge-bone text-[10px] shrink-0">
        <div className="flex items-center gap-2">
          <span className={connections.owlbear ? 'text-green-500' : 'text-blood'}>
            OBR:{connections.owlbear ? '🟢' : '🔴'}
          </span>
          <span className={connections.docs ? 'text-green-500' : 'text-faded'}>
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
