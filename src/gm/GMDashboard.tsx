import { useState, useCallback, useMemo } from 'react';
import { useMonsterTokens } from '../hooks/useMonsterTokens';
import { MonsterCard } from './MonsterCard';

type Tab = 'all' | 'alive' | 'dead';

export function GMDashboard() {
  const { monsters, registerSelected, updateHp, updateMaxHp, unregister } = useMonsterTokens();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>('all');
  const [quickAmount, setQuickAmount] = useState(10);
  const [isHeal, setIsHeal] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);

  const filtered = useMemo(() => {
    if (tab === 'alive') return monsters.filter((m) => m.hp > 0);
    if (tab === 'dead') return monsters.filter((m) => m.hp <= 0);
    return monsters;
  }, [monsters, tab]);

  const toggle = useCallback((id: string) => {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(filtered.map((m) => m.tokenId))), [filtered]);
  const deselectAll = useCallback(() => setSelected(new Set()), []);

  const applyQuick = useCallback(async () => {
    for (const id of selected) {
      const m = monsters.find((x) => x.tokenId === id);
      if (!m) continue;
      const newHp = isHeal ? Math.min(m.maxHp, m.hp + quickAmount) : Math.max(0, m.hp - quickAmount);
      await updateHp(id, newHp);
    }
  }, [selected, monsters, quickAmount, isHeal, updateHp]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'Все', count: monsters.length },
    { id: 'alive', label: 'Живые', count: monsters.filter((m) => m.hp > 0).length },
    { id: 'dead', label: 'Мёртвые', count: monsters.filter((m) => m.hp <= 0).length },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-bone overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-[#0d0d14] border-b border-[#1a1a2a] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="font-cinzel-decorative text-sm text-gold tracking-wider">☠️ GM Grimoire</span>
          <button onClick={registerSelected} className="px-3 py-1.5 text-[11px] bg-gold-dark/30 text-gold rounded-lg hover:bg-gold-dark/50 transition-colors font-cinzel">
            + Добавить выделенное
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1 text-[10px] rounded-lg font-cinzel transition-all ${tab === t.id ? 'bg-gold-dark/30 text-gold border border-gold-dark/50' : 'text-faded hover:text-bone border border-transparent'}`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </header>

      {/* Monster list */}
      <main className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-faded">
            <div className="text-4xl mb-3 opacity-40">🎯</div>
            <p className="text-sm">{monsters.length === 0 ? 'Выделите токены на карте' : 'Нет монстров в этой группе'}</p>
            {monsters.length === 0 && (
              <button onClick={registerSelected} className="mt-4 px-4 py-2 bg-gold-dark/30 text-gold rounded-lg hover:bg-gold-dark/50 text-xs font-cinzel">
                + Добавить токены
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[10px] text-faded">{selected.size > 0 ? `${selected.size} выбрано` : `${filtered.length} монстров`}</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] text-gold hover:text-gold-bright">Все</button>
                <button onClick={deselectAll} className="text-[10px] text-faded hover:text-bone">Снять</button>
              </div>
            </div>
            {filtered.map((m) => (
              <MonsterCard key={m.tokenId} monster={m} selected={selected.has(m.tokenId)} onToggle={toggle} onHp={updateHp} onMaxHp={updateMaxHp} onRemove={unregister} />
            ))}
          </>
        )}
      </main>

      {/* Bottom action bar */}
      {selected.size > 0 && (
        <div className="px-3 py-3 bg-[#0d0d14] border-t border-[#1a1a2a] shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsHeal(false)} className={`px-3 py-1.5 text-[11px] rounded-lg font-cinzel transition-all ${!isHeal ? 'bg-blood-dark text-blood-bright border border-blood/50' : 'bg-[#1a1a2a] text-faded border border-transparent'}`}>⚔️ Урон</button>
            <button onClick={() => setIsHeal(true)} className={`px-3 py-1.5 text-[11px] rounded-lg font-cinzel transition-all ${isHeal ? 'bg-green-900/50 text-green-400 border border-green-800/50' : 'bg-[#1a1a2a] text-faded border border-transparent'}`}>💚 Исцеление</button>
            <div className="flex-1" />
            {[5, 10, 20, 50, 100].map((n) => (
              <button key={n} onClick={() => setQuickAmount(n)} className={`px-2 py-1 text-[10px] rounded font-mono transition-all ${quickAmount === n ? 'bg-gold-dark/30 text-gold border border-gold-dark/50' : 'bg-[#1a1a2a] text-faded border border-transparent hover:text-bone'}`}>{n}</button>
            ))}
          </div>
          <button onClick={applyQuick} className={`w-full py-2.5 rounded-lg font-cinzel text-sm font-bold transition-all ${!isHeal ? 'bg-blood-dark text-blood-bright hover:bg-blood border border-blood/50' : 'bg-green-900/50 text-green-400 hover:bg-green-900/80 border border-green-800/50'}`}>
            {isHeal ? `💚 Исцелить −${quickAmount} ×${selected.size}` : `⚔️ Нанести ${quickAmount} ×${selected.size}`}
          </button>
        </div>
      )}
    </div>
  );
}
