import { useState, useCallback } from 'react';
import { useMonsterTokens } from '../hooks/useMonsterTokens';
import { MonsterList } from './MonsterList';
import { DamageModal } from './DamageModal';

export function GMDashboard() {
  const { monsters, loadMonsters, updateHp, setMaxHp } = useMonsterTokens();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDamage, setShowDamage] = useState(false);

  const toggleSelect = useCallback((tokenId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(monsters.map((m) => m.tokenId)));
  }, [monsters]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const applyDamage = useCallback(async (updates: { tokenId: string; newHp: number }[]) => {
    for (const u of updates) {
      await updateHp(u.tokenId, u.newHp);
    }
    setSelectedIds(new Set());
  }, [updateHp]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-bone overflow-hidden">
      <header className="px-4 py-3 bg-[#0d0d14] border-b border-[#1a1a2a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-cinzel-decorative text-sm text-gold tracking-wider">☠️ GM Grimoire</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMonsters}
            className="px-2 py-1 text-[10px] bg-[#1a1a2a] text-faded rounded hover:bg-[#222233] transition-colors"
          >
            🔄 Обновить
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 space-y-3">
        <MonsterList
          monsters={monsters}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onUpdateHp={updateHp}
          onSetMaxHp={setMaxHp}
        />
      </main>

      {selectedIds.size > 0 && (
        <div className="px-3 py-3 bg-[#0d0d14] border-t border-[#1a1a2a] shrink-0">
          <button
            onClick={() => setShowDamage(true)}
            className="w-full py-3 rounded-lg font-cinzel text-sm font-bold bg-blood-dark text-blood-bright hover:bg-blood border border-blood/50 transition-all"
          >
            ⚔️ Нанести урон ({selectedIds.size})
          </button>
        </div>
      )}

      {showDamage && (
        <DamageModal
          monsters={monsters}
          selectedIds={selectedIds}
          onClose={() => setShowDamage(false)}
          onApply={applyDamage}
        />
      )}
    </div>
  );
}
