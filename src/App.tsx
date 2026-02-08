import { useEffect, useState, useRef } from 'react';
import { useGameStore } from './stores/useGameStore';
import { initOBR } from './services/obrService';
import { docsService } from './services/docsService';
import { UnitSelector } from './components/UnitSelector';
import { StatBars } from './components/StatBars';
import { CombatTab } from './components/tabs/CombatTab';
import { MagicTab } from './components/tabs/MagicTab';
import { CardsTab } from './components/tabs/CardsTab';
import { ActionsTab } from './components/tabs/ActionsTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { NotificationToast, LoadingSpinner } from './components/ui';
import { cn } from './utils/cn';

type TabId = 'combat' | 'magic' | 'cards' | 'actions' | 'settings';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'combat', label: 'Бой', icon: '⚔️' },
  { id: 'magic', label: 'Маг', icon: '✨' },
  { id: 'cards', label: 'Рок', icon: '🃏' },
  { id: 'actions', label: 'Дейст', icon: '⚡' },
  { id: 'settings', label: 'Настр', icon: '⚙️' }
];

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [, setObrReady] = useState(false);
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
        setObrReady(true);
        setConnection('owlbear', true);
        
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
      
      {/* TABS */}
      <div className="flex border-b border-edge-bone bg-obsidian">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 py-2 text-xs font-cinzel uppercase tracking-wide transition-all',
              activeTab === tab.id
                ? 'tab-active'
                : 'tab-inactive'
            )}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* TAB CONTENT */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'combat' && <CombatTab />}
        {activeTab === 'magic' && <MagicTab />}
        {activeTab === 'cards' && <CardsTab />}
        {activeTab === 'actions' && <ActionsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
      
      {/* STATUS BAR */}
      <div className="h-6 flex items-center justify-between px-3 bg-obsidian border-t border-edge-bone text-xs">
        <div className="flex items-center gap-3">
          <span className={connections.owlbear ? 'text-green-500' : 'text-blood'}>
            OBR: {connections.owlbear ? '🟢' : '🔴'}
          </span>
          <span className={connections.docs ? 'text-green-500' : 'text-faded'}>
            Docs: {connections.docs ? '🟢' : (settings.googleDocsUrl ? '🔴' : '⚪')}
          </span>
        </div>
        <div className="text-faded">
          Sync: {formatLastSync()}
        </div>
      </div>
      
      {/* NOTIFICATIONS — макс 3 штуки */}
      <div className="fixed top-2 right-2 z-50 space-y-2 max-w-xs">
        {notifications.map(notification => (
          <NotificationToast
            key={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={() => clearNotification(notification.id)}
          />
        ))}
      </div>
    </div>
  );
}
