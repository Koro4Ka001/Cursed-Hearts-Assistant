import { useState, useCallback } from 'react';
import { useMonsterTokens } from '../hooks/useMonsterTokens';
import { MonsterList } from './MonsterList';
import { DamageModal } from './DamageModal';

export function GMDashboard() {
  const { monsters, registerFromSelection, updateHp, updateMaxHp, unregister } = useMonsterTokens();
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
            onClick={registerFromSelection}
            className="px-3 py-1.5 text-[11px] bg-gold-dark/30 text-gold rounded-lg hover:bg-gold-dark/50 transition-colors font-cinzel"
          >
            + Добавить выделенное
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 space-y-3">
        {monsters.length === 0 ? (
          <div className="text-center py-12 text-faded">
            <div className="text-4xl mb-3 opacity-40">🎯</div>
            <p className="text-sm">Выделите токены на карте</p>
            <p className="text-[11px] text-dim mt-1">и нажмите "Добавить выделенное"</p>
            <button
              onClick={registerFromSelection}
              className="mt-4 px-4 py-2 bg-gold-dark/30 text-gold rounded-lg hover:bg-gold-dark/50 transition-colors text-xs font-cinzel"
            >
              + Добавить токены
            </button>
          </div>
        ) : (
          <MonsterList
            monsters={monsters}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onUpdateHp={updateHp}
            onSetMaxHp={updateMaxHp}
            onRemove={unregister}
          />
        )}
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
