import { useState, useCallback, useMemo } from 'react';
import { useMonsterTokens } from '../hooks/useMonsterTokens';
import { MonsterCard } from './MonsterCard';
import { RegistrationModal, getGroupColor } from './RegistrationModal';

type Tab = 'all' | 'alive' | 'dead';

export function GMDashboard() {
  const { monsters, registerTokens, updateMonster, unregister, getSelection, getGroups } = useMonsterTokens();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>('all');
  const [quickAmount, setQuickAmount] = useState(10);
  const [isHeal, setIsHeal] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [pendingTokens, setPendingTokens] = useState<{ tokenId: string; defaultName: string }[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [customAmount, setCustomAmount] = useState('');

  const filtered = useMemo(() => {
    if (tab === 'alive') return monsters.filter((m) => m.hp > 0);
    if (tab === 'dead') return monsters.filter((m) => m.hp <= 0);
    return monsters;
  }, [monsters, tab]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    const ungrouped: typeof filtered = [];
    for (const m of filtered) {
      if (m.group) {
        const arr = groups.get(m.group) || [];
        arr.push(m);
        groups.set(m.group, arr);
      } else {
        ungrouped.push(m);
      }
    }
    return { groups, ungrouped };
  }, [filtered]);

  const toggle = useCallback((id: string) => {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(filtered.map((m) => m.tokenId))), [filtered]);
  const deselectAll = useCallback(() => setSelected(new Set()), []);

  const toggleGroup = useCallback((group: string) => {
    const groupMonsters = filtered.filter(m => m.group === group);
    const allSelected = groupMonsters.every(m => selected.has(m.tokenId));
    setSelected(prev => {
      const next = new Set(prev);
      for (const m of groupMonsters) {
        if (allSelected) next.delete(m.tokenId);
        else next.add(m.tokenId);
      }
      return next;
    });
  }, [filtered, selected]);

  const toggleCollapse = useCallback((group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const applyQuick = useCallback(() => {
    const amount = quickAmount;
    for (const id of selected) {
      const m = monsters.find((x) => x.tokenId === id);
      if (!m) continue;
      const newHp = isHeal ? Math.min(m.maxHp, m.hp + amount) : Math.max(0, m.hp - amount);
      updateMonster(id, { hp: newHp });
    }
  }, [selected, monsters, quickAmount, isHeal, updateMonster]);

  const applyCustom = useCallback(() => {
    const amount = parseInt(customAmount, 10);
    if (isNaN(amount) || amount <= 0) return;
    for (const id of selected) {
      const m = monsters.find((x) => x.tokenId === id);
      if (!m) continue;
      const newHp = isHeal ? Math.min(m.maxHp, m.hp + amount) : Math.max(0, m.hp - amount);
      updateMonster(id, { hp: newHp });
    }
    setCustomAmount('');
  }, [selected, monsters, customAmount, isHeal, updateMonster]);

  const removeSelected = useCallback(() => {
    for (const id of selected) {
      unregister(id);
    }
    setSelected(new Set());
  }, [selected, unregister]);

  const handleAddClick = async () => {
    const tokenIds = await getSelection();
    if (!tokenIds.length) return;
    const tokens = tokenIds.map(id => {
      const existing = monsters.find(m => m.tokenId === id);
      return { tokenId: id, defaultName: existing?.name || '' };
    }).filter(t => !monsters.find(m => m.tokenId === t.tokenId));
    if (!tokens.length) return;
    setPendingTokens(tokens);
    setShowRegistration(true);
  };

  const handleRegister = (entries: { tokenId: string; name: string; maxHp: number; group: string }[]) => {
    for (const e of entries) {
      registerTokens([e.tokenId], e.name, e.maxHp, e.group);
    }
    setShowRegistration(false);
    setPendingTokens([]);
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'Все', count: monsters.length },
    { id: 'alive', label: 'Живые', count: monsters.filter((m) => m.hp > 0).length },
    { id: 'dead', label: 'Мёртвые', count: monsters.filter((m) => m.hp <= 0).length },
  ];

  const renderMonster = (m: typeof monsters[0]) => (
    <MonsterCard key={m.tokenId} monster={m} selected={selected.has(m.tokenId)}
      onToggle={toggle} onUpdate={updateMonster} onRemove={unregister} />
  );

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-bone overflow-hidden">
      {showRegistration && (
        <RegistrationModal tokens={pendingTokens} existingGroups={getGroups()}
          onConfirm={handleRegister} onClose={() => { setShowRegistration(false); setPendingTokens([]); }} />
      )}

      <header className="px-4 py-3 bg-[#0d0d14] border-b border-[#1a1a2a] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="font-cinzel-decorative text-sm text-gold tracking-wider">☠️ GM Grimoire</span>
          <button onClick={handleAddClick}
            className="px-3 py-1.5 text-[11px] bg-gold-dark/30 text-gold rounded-lg hover:bg-gold-dark/50 transition-colors font-cinzel">
            + Добавить
          </button>
        </div>

        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1 text-[10px] rounded-lg font-cinzel transition-all ${tab === t.id ? 'bg-gold-dark/30 text-gold border border-gold-dark/50' : 'text-faded hover:text-bone border border-transparent'}`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 space-y-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-faded">
            <div className="text-4xl mb-3 opacity-40">🎯</div>
            <p className="text-sm">{monsters.length === 0 ? 'Выделите токены на карте' : 'Нет монстров в этой группе'}</p>
            {monsters.length === 0 && (
              <button onClick={handleAddClick}
                className="mt-4 px-4 py-2 bg-gold-dark/30 text-gold rounded-lg hover:bg-gold-dark/50 text-xs font-cinzel">
                + Добавить токены
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] text-faded">
                {selected.size > 0 ? `${selected.size} выбрано` : `${filtered.length} монстров`}
              </span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] text-gold hover:text-gold-bright">Все</button>
                <button onClick={deselectAll} className="text-[10px] text-faded hover:text-bone">Снять</button>
              </div>
            </div>

            {Array.from(grouped.groups.entries()).map(([group, items]) => (
              <div key={group} className="mb-2">
                <button onClick={() => toggleCollapse(group)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[#111118] transition-colors group">
                  <span className="text-[10px] text-faded">{collapsedGroups.has(group) ? '▶' : '▼'}</span>
                  <input type="checkbox" checked={items.every(m => selected.has(m.tokenId))}
                    onChange={() => toggleGroup(group)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3 h-3 accent-[#c9a84c] cursor-pointer" />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-cinzel ${getGroupColor(group)}`}>
                    {group}
                  </span>
                  <span className="text-[10px] text-faded">({items.length})</span>
                </button>
                {!collapsedGroups.has(group) && (
                  <div className="space-y-1 mt-1 ml-4">
                    {items.map(renderMonster)}
                  </div>
                )}
              </div>
            ))}

            {grouped.ungrouped.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1.5">
                  <span className="text-[10px] text-faded font-cinzel">Без группы</span>
                  <span className="text-[10px] text-faded ml-1">({grouped.ungrouped.length})</span>
                </div>
                <div className="space-y-1 ml-4">
                  {grouped.ungrouped.map(renderMonster)}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {selected.size > 0 && (
        <div className="px-3 py-3 bg-[#0d0d14] border-t border-[#1a1a2a] shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsHeal(false)}
              className={`px-3 py-1.5 text-[11px] rounded-lg font-cinzel transition-all ${!isHeal ? 'bg-blood-dark text-blood-bright border border-blood/50' : 'bg-[#1a1a2a] text-faded border border-transparent'}`}>
              ⚔️ Урон
            </button>
            <button onClick={() => setIsHeal(true)}
              className={`px-3 py-1.5 text-[11px] rounded-lg font-cinzel transition-all ${isHeal ? 'bg-green-900/50 text-green-400 border border-green-800/50' : 'bg-[#1a1a2a] text-faded border border-transparent'}`}>
              💚 Исцеление
            </button>
            <div className="flex-1" />
            {[5, 10, 20, 50, 100].map((n) => (
              <button key={n} onClick={() => setQuickAmount(n)}
                className={`px-2 py-1 text-[10px] rounded font-mono transition-all ${quickAmount === n ? 'bg-gold-dark/30 text-gold border border-gold-dark/50' : 'bg-[#1a1a2a] text-faded border border-transparent hover:text-bone'}`}>
                {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyCustom(); }}
              placeholder="Свое"
              className="w-16 bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1 text-[10px] font-mono text-bone focus:border-gold-dark focus:outline-none" />
            <button onClick={applyQuick}
              className={`flex-1 py-2 rounded-lg font-cinzel text-xs font-bold transition-all ${!isHeal ? 'bg-blood-dark text-blood-bright hover:bg-blood border border-blood/50' : 'bg-green-900/50 text-green-400 hover:bg-green-900/80 border border-green-800/50'}`}>
              {isHeal ? `💚 Исцелить −${quickAmount} ×${selected.size}` : `⚔️ Нанести ${quickAmount} ×${selected.size}`}
            </button>
            <button onClick={removeSelected}
              className="py-2 px-3 text-[11px] text-faded hover:text-blood-bright hover:bg-blood-dark/30 rounded-lg border border-transparent hover:border-blood/30 font-cinzel transition-all">
              🗑️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
