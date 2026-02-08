import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { NotificationContainer, Button } from '@/components/ui';
import { CombatTab } from '@/components/tabs/CombatTab';
import { MagicTab } from '@/components/tabs/MagicTab';
import { ResourcesTab } from '@/components/tabs/ResourcesTab';
import { ActionsTab } from '@/components/tabs/ActionsTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';
import { cn } from '@/utils/cn';
import type { TabType } from '@/types';

const TABS: { id: TabType; icon: string }[] = [
  { id: 'combat', icon: '⚔️' },
  { id: 'magic', icon: '✨' },
  { id: 'resources', icon: '📦' },
  { id: 'actions', icon: '🎯' },
  { id: 'settings', icon: '⚙️' },
];

export function App() {
  const { units, selectedUnitId, activeTab, connections, isSyncing, selectUnit, setActiveTab, setHP, setMana, syncFromDocs } = useGameStore();
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const [showDropdown, setShowDropdown] = useState(false);

  const hpPct = selectedUnit ? Math.min(100, (selectedUnit.health.current / selectedUnit.health.max) * 100) : 0;
  const manaPct = selectedUnit ? Math.min(100, (selectedUnit.mana.current / selectedUnit.mana.max) * 100) : 0;
  const hpLow = hpPct < 25 && hpPct > 0;

  return (
    <div className="h-screen flex flex-col bg-[#030303] text-[#d4c8b8] overflow-hidden" style={{ width: '400px', maxWidth: '100vw' }}>
      <NotificationContainer />

      {/* HEADER — 32px */}
      <div className="h-8 flex items-center justify-center border-b border-[#3a332a] bg-[#080706] flex-shrink-0">
        <span className="text-[#ffd700] text-[10px] tracking-[0.2em] font-bold animate-[goldGlow_3s_ease-in-out_infinite]">
          ☠ CURSED HEARTS ☠
        </span>
      </div>

      {/* UNIT SELECTOR + SYNC — 40px */}
      <div className="h-10 flex gap-1.5 px-2 py-1 border-b border-[#3a332a] bg-[#080706] flex-shrink-0 items-center relative">
        <div className="flex-1 relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full h-8 px-2.5 bg-[#161412] rounded border border-[#3a332a] text-[12px] text-left flex items-center justify-between cursor-pointer hover:border-[#7a6f62] transition-all"
          >
            <span className={selectedUnit ? 'text-[#d4a726] truncate' : 'text-[#4a433a]'}>
              {selectedUnit?.name || 'Выберите юнита...'}
            </span>
            <span className="text-[#7a6f62] text-[10px] ml-1">▾</span>
          </button>
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-0.5 bg-[#0f0d0c] border border-[#3a332a] rounded shadow-xl z-30 overflow-hidden">
              {units.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-[#7a6f62] italic">Нет юнитов — создайте в ⚙️</div>
              ) : (
                units.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { selectUnit(u.id); setShowDropdown(false); }}
                    className={cn(
                      'w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#1a1816] transition-all cursor-pointer',
                      u.id === selectedUnitId ? 'text-[#ffd700] bg-[#1a1816]' : 'text-[#d4c8b8]'
                    )}
                  >
                    {u.name}
                    <span className="text-[9px] text-[#7a6f62] ml-2">
                      {u.health.current}/{u.health.max}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => syncFromDocs()}
          loading={isSyncing}
          className="w-8 h-8 px-0"
          title="Синхронизировать с Google Docs"
        >
          🔄
        </Button>
      </div>

      {/* HP + MANA — ~50px */}
      {selectedUnit && (
        <div className="px-2 py-1 flex-shrink-0 space-y-0.5 border-b border-[#3a332a]">
          {/* HP */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px]">🩸</span>
            <div className={cn(
              'flex-1 h-5 bg-[#0a0606] border border-[#4a0000] relative rounded-sm overflow-hidden',
              hpLow && 'animate-[bloodPulse_2s_ease-in-out_infinite]'
            )}>
              <div
                className="h-full bg-gradient-to-r from-[#8b0000] to-[#cc2020] transition-all duration-500"
                style={{ width: `${hpPct}%` }}
              />
              <span className="absolute right-1.5 top-0 leading-5 text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {selectedUnit.health.current}/{selectedUnit.health.max}
              </span>
            </div>
            <div className="flex gap-0.5">
              <button onClick={() => setHP(selectedUnit.id, selectedUnit.health.current - 1)} className="w-5 h-5 rounded bg-[#4a0000] text-[#d09090] text-[10px] cursor-pointer hover:bg-[#5a1c1c] flex items-center justify-center">−</button>
              <button onClick={() => setHP(selectedUnit.id, selectedUnit.health.current + 1)} className="w-5 h-5 rounded bg-[#2e5a1c] text-[#a0d090] text-[10px] cursor-pointer hover:bg-[#3a6a24] flex items-center justify-center">+</button>
            </div>
          </div>
          {/* Mana */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px]">💠</span>
            <div className="flex-1 h-5 bg-[#050a14] border border-[#0a2040] relative rounded-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1a4a8b] to-[#4a9eff] transition-all duration-500"
                style={{ width: `${manaPct}%` }}
              />
              <span className="absolute right-1.5 top-0 leading-5 text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {selectedUnit.mana.current}/{selectedUnit.mana.max}
              </span>
            </div>
            <div className="flex gap-0.5">
              <button onClick={() => setMana(selectedUnit.id, selectedUnit.mana.current - 1)} className="w-5 h-5 rounded bg-[#0a2040] text-[#4a9eff] text-[10px] cursor-pointer hover:bg-[#1a3050] flex items-center justify-center">−</button>
              <button onClick={() => setMana(selectedUnit.id, selectedUnit.mana.current + 1)} className="w-5 h-5 rounded bg-[#0a2040] text-[#4a9eff] text-[10px] cursor-pointer hover:bg-[#1a3050] flex items-center justify-center">+</button>
            </div>
          </div>
        </div>
      )}

      {/* TABS — 36px */}
      <div className="h-9 flex px-1 flex-shrink-0 bg-[#080706] border-b border-[#3a332a]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center transition-all border-b-2 cursor-pointer text-[16px]',
              activeTab === tab.id
                ? 'border-[#d4a726] text-[#ffd700]'
                : 'border-transparent text-[#7a6f62] hover:text-[#b8a892]'
            )}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* CONTENT — flexible, scrollable */}
      <main className="flex-1 overflow-y-auto p-2.5">
        {activeTab === 'combat' && <CombatTab />}
        {activeTab === 'magic' && <MagicTab />}
        {activeTab === 'resources' && <ResourcesTab />}
        {activeTab === 'actions' && <ActionsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {/* STATUS BAR — 24px */}
      <div className="h-6 flex items-center justify-center gap-4 text-[9px] border-t border-[#3a332a] bg-[#080706] flex-shrink-0 px-2">
        <StatusDot label="OBR" status={connections.owlbear} />
        <StatusDot label="Dice" status={connections.dice} />
        <StatusDot label="Docs" status={connections.docs} />
        <StatusDot label="Grim" status={connections.grimoire} />
        <span className="ml-auto text-[#4a433a]">v1.0</span>
      </div>
    </div>
  );
}

function StatusDot({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    connected: 'text-[#a0d090]',
    disconnected: 'text-[#4a433a]',
    error: 'text-[#d09090]',
    not_configured: 'text-[#b8a060]',
  };
  const icons: Record<string, string> = {
    connected: '✓',
    disconnected: '○',
    error: '✕',
    not_configured: '⚠',
  };
  return (
    <span className={cn('flex items-center gap-0.5', colors[status] || 'text-[#4a433a]')}>
      <span>{icons[status] || '?'}</span>
      <span>{label}</span>
    </span>
  );
}
