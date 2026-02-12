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
    screenEffect,
    activeEffect
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
      <div className="h-screen flex flex-col items-center justify-center bg-abyss relative overflow-hidden">
        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.8) 100%)' }} />
        
        {/* Spinner */}
        <LoadingSpinner className="mb-6" />
        
        {/* Title */}
        <div className="font-cinzel-decorative text-gold text-lg tracking-[4px] uppercase mb-2">
          Cursed Hearts
        </div>
        
        {/* Subtitle */}
        <div className="font-garamond text-faded text-sm italic animate-pulse">
          Открываем гримуар...
        </div>
        
        {/* Decorative line */}
        <div className="mt-6 w-32 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, var(--color-gold-dark), transparent)' }} />
      </div>
    );
  }
  
  // Определяем CSS-класс для экранного эффекта
  const effectClass = activeEffect 
    ? {
        'shake': 'screen-shake',
        'heal': 'screen-heal-glow', 
        'crit': 'screen-flash-gold',
        'crit-gold': 'screen-flash-gold',
        'fail': 'screen-flash-blood',
        'crit-fail': 'screen-flash-blood'
      }[activeEffect] ?? ''
    : '';
  
  return (
    <div className={cn(
      "h-screen flex flex-col bg-abyss text-bone overflow-hidden app-frame",
      screenEffect === 'shake' && 'animate-screen-shake',
      effectClass
    )}>
      {/* GOLDEN FRAME CORNERS */}
      <span className="frame-corner frame-tl" />
      <span className="frame-corner frame-tr" />
      <span className="frame-corner frame-bl" />
      <span className="frame-corner frame-br" />
      
      {/* SCREEN EFFECTS LAYER */}
      <div className="fx-layer">
        {screenEffect === 'crit' && <div className="fx-crit" />}
        {screenEffect === 'fail' && <div className="fx-fail" />}
        {screenEffect === 'heal' && <div className="fx-heal" />}
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
      
      {/* TAB CONTENT — с анимацией перехода */}
      <div className="flex-1 overflow-hidden" key={activeTab}>
        <div className="tab-content-enter h-full">
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
      </div>
      
      {/* STATUS BAR */}
      <div className="status-bar shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center">
            <span className={cn('status-dot', connections.owlbear ? 'status-dot-on' : 'status-dot-off')} />
            OBR
          </span>
          <span className="flex items-center">
            <span className={cn('status-dot', connections.docs ? 'status-dot-on' : (settings.googleDocsUrl ? 'status-dot-off' : 'status-dot-none'))} />
            Docs
          </span>
          <span className="flex items-center" title={`Кубики: ${getDiceStatusLabel()}`}>
            <span className="status-dot status-dot-on" />
            Dice
          </span>
        </div>
        <div className="text-dim">
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
