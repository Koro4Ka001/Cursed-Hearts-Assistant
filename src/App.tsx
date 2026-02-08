import { useGameStore } from './stores/useGameStore';
import { ProgressBar } from './components/ui';
import { CombatTab } from './components/tabs/CombatTab';
import { MagicTab } from './components/tabs/MagicTab';
import { ResourcesTab } from './components/tabs/ResourcesTab';
import { ActionsTab } from './components/tabs/ActionsTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { cn } from './utils/cn';
import type { TabId } from './types';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'combat', icon: '⚔️', label: 'Бой' },
  { id: 'magic', icon: '✨', label: 'Магия' },
  { id: 'resources', icon: '📦', label: 'Ресурс' },
  { id: 'actions', icon: '🎯', label: 'Действ' },
  { id: 'settings', icon: '⚙️', label: 'Настр' },
];

export function App() {
  const units = useGameStore(s => s.units);
  const activeUnitId = useGameStore(s => s.activeUnitId);
  const activeTab = useGameStore(s => s.activeTab);
  const setActiveUnit = useGameStore(s => s.setActiveUnit);
  const setActiveTab = useGameStore(s => s.setActiveTab);
  const modifyHealth = useGameStore(s => s.modifyHealth);
  const modifyMana = useGameStore(s => s.modifyMana);
  const unit = useGameStore(s => s.getActiveUnit());

  const renderTab = () => {
    switch (activeTab) {
      case 'combat': return <CombatTab />;
      case 'magic': return <MagicTab />;
      case 'resources': return <ResourcesTab />;
      case 'actions': return <ActionsTab />;
      case 'settings': return <SettingsTab />;
    }
  };

  return (
    <div className="w-full max-w-[400px] min-h-screen mx-auto flex flex-col bg-abyss text-bone">
      {/* Header */}
      <header className="text-center py-2.5 border-b border-border-bone bg-dark relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold-dark/5 to-transparent" />
        <div className="relative">
          <div className="text-gold-bright text-xs tracking-[0.3em] font-bold">
            ☠ CURSED HEARTS ☠
          </div>
          <div className="text-dim text-[9px] tracking-[0.2em] mt-0.5">
            PLAYER ASSISTANT
          </div>
        </div>
      </header>

      {/* Unit Selector */}
      <div className="flex gap-2 px-2 py-1.5 bg-dark border-b border-border-bone">
        <select
          value={activeUnitId || ''}
          onChange={e => setActiveUnit(e.target.value)}
          className={cn(
            'flex-1 bg-input border border-border-bone text-sm rounded-lg px-3 py-1.5',
            'focus:outline-none focus:border-gold-dark focus:ring-1 focus:ring-gold-dark/30',
            'cursor-pointer transition-colors',
            units.length > 0 ? 'text-gold' : 'text-dim'
          )}
        >
          {units.length === 0 ? (
            <option value="">— Добавьте юнита в ⚙️ —</option>
          ) : (
            units.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))
          )}
        </select>
      </div>

      {/* Stat Bars */}
      {unit && (
        <div className="px-2 py-1.5 bg-dark/80 space-y-1 border-b border-border-bone">
          <ProgressBar
            current={unit.health.current}
            max={unit.health.max}
            color="blood"
            label="🩸 HP"
            onDecrement={() => modifyHealth(unit.id, -1)}
            onIncrement={() => modifyHealth(unit.id, 1)}
          />
          <ProgressBar
            current={unit.mana.current}
            max={unit.mana.max}
            color="mana"
            label="💎 Мана"
            onDecrement={() => modifyMana(unit.id, -1)}
            onIncrement={() => modifyMana(unit.id, 1)}
          />
        </div>
      )}

      {/* Tab Bar */}
      <nav className="flex bg-dark border-b border-border-bone">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 py-2 text-center transition-all border-b-2 cursor-pointer',
              activeTab === tab.id
                ? 'border-gold text-gold-bright bg-panel/50'
                : 'border-transparent text-dim hover:text-faded hover:bg-hover/30'
            )}
          >
            <div className="text-sm leading-none">{tab.icon}</div>
            <div className="text-[8px] mt-0.5 font-medium tracking-wider">{tab.label}</div>
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="flex-1 overflow-y-auto p-2">
        {renderTab()}
      </main>

      {/* Status Bar */}
      <footer className="px-2 py-1 text-center text-[9px] text-dim border-t border-border-bone bg-dark/50">
        Cursed Hearts v1.0 • {units.length} юнит(ов) загружено
      </footer>
    </div>
  );
}
