import { cn } from '@/utils/cn';
import { useGameStore } from '@/stores/gameStore';

const tabs = [
  { id: 'combat' as const, icon: '⚔️', label: 'Бой' },
  { id: 'magic' as const, icon: '✨', label: 'Магия' },
  { id: 'resources' as const, icon: '📦', label: 'Рес' },
  { id: 'actions' as const, icon: '🎯', label: 'Действ' },
  { id: 'settings' as const, icon: '⚙️', label: 'Настр' },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useGameStore();
  
  return (
    <div className="flex border-b border-gray-700 bg-gray-900">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            'flex-1 py-2 px-1 text-xs font-medium transition-all duration-200',
            'flex flex-col items-center gap-0.5',
            'border-b-2',
            activeTab === tab.id
              ? 'text-amber-400 border-amber-400 bg-gray-800/50'
              : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
          )}
        >
          <span className="text-base">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
