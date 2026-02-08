import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { ProgressBar, NotificationContainer, Button } from '@/components/ui';
import { CombatTab } from '@/components/tabs/CombatTab';
import { MagicTab } from '@/components/tabs/MagicTab';
import { ResourcesTab } from '@/components/tabs/ResourcesTab';
import { ActionsTab } from '@/components/tabs/ActionsTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';
import { cn } from '@/utils/cn';
import type { TabType } from '@/types';

const TABS: { id: TabType; icon: string; label: string }[] = [
  { id: 'combat', icon: '⚔️', label: 'Бой' },
  { id: 'magic', icon: '✨', label: 'Маг' },
  { id: 'resources', icon: '📦', label: 'Рес' },
  { id: 'actions', icon: '🎯', label: 'Дейст' },
  { id: 'settings', icon: '⚙️', label: '' },
];

export function App() {
  const { units, selectedUnitId, activeTab, connections, selectUnit, setActiveTab, setHP, setMana } = useGameStore();
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  return (
    <div className="min-h-screen bg-[#030303] text-[#d4c8b8] flex flex-col" style={{ width: '400px', maxHeight: '700px' }}>
      <NotificationContainer />

      {/* HEADER */}
      <header className="px-4 pt-3 pb-2 border-b border-[#3a332a] bg-[#080706]">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-lg animate-[goldGlow_3s_ease-in-out_infinite]">☠</span>
          <div className="text-center">
            <h1 className="text-sm font-bold tracking-widest uppercase text-[#ffd700] animate-[goldGlow_3s_ease-in-out_infinite]">
              Cursed Hearts
            </h1>
            <p className="text-[9px] tracking-[0.3em] uppercase text-[#7a6f62]">Player Assistant</p>
          </div>
          <span className="text-lg animate-[goldGlow_3s_ease-in-out_infinite]">☠</span>
        </div>

        {/* Unit Selector */}
        <div className="relative flex gap-2 items-center">
          <div className="flex-1 relative">
            <button
              onClick={() => setShowUnitDropdown(!showUnitDropdown)}
              className="w-full h-9 px-3 bg-[#161412] rounded-lg border border-[#3a332a] text-sm text-left flex items-center justify-between cursor-pointer hover:border-[#7a6f62] transition-all"
            >
              <span className={selectedUnit ? 'text-[#d4c8b8]' : 'text-[#4a433a]'}>
                {selectedUnit?.name || 'Выберите юнита...'}
              </span>
              <span className="text-[#7a6f62] text-xs">▾</span>
            </button>
            {showUnitDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0d0c] border border-[#3a332a] rounded-lg shadow-xl z-30 overflow-hidden">
                {units.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[#7a6f62] italic">Нет юнитов</div>
                ) : (
                  units.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { selectUnit(u.id); setShowUnitDropdown(false); }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-[#1a1816] transition-all cursor-pointer',
                        u.id === selectedUnitId ? 'text-[#ffd700] bg-[#1a1816]' : 'text-[#d4c8b8]'
                      )}
                    >
                      <div className="font-medium">{u.name}</div>
                      <div className="text-[10px] text-[#7a6f62]">HP: {u.health.current}/{u.health.max} | MP: {u.mana.current}/{u.mana.max}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setActiveTab('settings')} className="text-base">⚙️</Button>
        </div>

        {/* HP & Mana Bars */}
        {selectedUnit && (
          <div className="mt-2 space-y-1.5">
            <ProgressBar
              current={selectedUnit.health.current}
              max={selectedUnit.health.max}
              type="hp"
              icon="🩸"
              label="HP"
              onAdjust={(amount) => setHP(selectedUnit.id, selectedUnit.health.current + amount)}
            />
            <ProgressBar
              current={selectedUnit.mana.current}
              max={selectedUnit.mana.max}
              type="mana"
              icon="💠"
              label="Мана"
              onAdjust={(amount) => setMana(selectedUnit.id, selectedUnit.mana.current + amount)}
            />
          </div>
        )}
      </header>

      {/* TAB BAR */}
      <nav className="flex bg-[#080706] border-b border-[#3a332a] px-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 transition-all border-b-2 cursor-pointer',
              activeTab === tab.id
                ? 'border-[#d4a726] text-[#ffd700]'
                : 'border-transparent text-[#7a6f62] hover:text-[#b8a892]'
            )}
          >
            <span className="text-base">{tab.icon}</span>
            {tab.label && <span className="text-[9px] font-medium">{tab.label}</span>}
          </button>
        ))}
      </nav>

      {/* TAB CONTENT */}
      <main className="flex-1 overflow-y-auto px-3 py-3" style={{ maxHeight: 'calc(700px - 260px)' }}>
        {activeTab === 'combat' && <CombatTab />}
        {activeTab === 'magic' && <MagicTab />}
        {activeTab === 'resources' && <ResourcesTab />}
        {activeTab === 'actions' && <ActionsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {/* STATUS BAR */}
      <footer className="px-4 py-2 border-t border-[#3a332a] bg-[#080706] flex items-center gap-3 text-[10px]">
        <StatusDot label="OBR" status={connections.owlbear} />
        <StatusDot label="Docs" status={connections.docs} />
        <StatusDot label="Grimoire" status={connections.grimoire} />
        <span className="ml-auto text-[#4a433a]">v1.0.0</span>
      </footer>
    </div>
  );
}

function StatusDot({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    connected: 'bg-[#2e5a1c]',
    disconnected: 'bg-[#4a433a]',
    error: 'bg-[#8b0000]',
    not_configured: 'bg-[#6a5014]',
  };
  const icons: Record<string, string> = {
    connected: '✓',
    disconnected: '○',
    error: '✕',
    not_configured: '⚠',
  };
  return (
    <span className="flex items-center gap-1">
      <span className={cn('w-2 h-2 rounded-full', colors[status] || 'bg-[#4a433a]')} />
      <span className="text-[#7a6f62]">{icons[status] || '?'} {label}</span>
    </span>
  );
}
