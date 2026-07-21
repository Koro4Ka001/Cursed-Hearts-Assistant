import { useState, useCallback, useMemo } from 'react';
import { useMonsterTokens } from '../hooks/useMonsterTokens';
import { MonsterCard } from './MonsterCard';
import { RegistrationModal, getGroupColor } from './RegistrationModal';
import { WeaponAttackPanel } from './WeaponAttackPanel';
import { rollFormula } from '../services/diceService';
import type { Monster, MonsterWeapon } from '../stores/monsterStore';

type Tab = 'all' | 'alive' | 'dead';

export function GMDashboard() {
  const { monsters, registerTokens, updateMonster, unregister, getSelection, getGroups } = useMonsterTokens();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>('all');
  const [isHeal, setIsHeal] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [pendingTokens, setPendingTokens] = useState<{ tokenId: string; defaultName: string }[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [formula, setFormula] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [useArmor, setUseArmor] = useState(false);
  const [attackContext, setAttackContext] = useState<{ monster: Monster; weapon: MonsterWeapon } | null>(null);

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

  const applyFormula = useCallback(async () => {
    if (!formula.trim() || selected.size === 0) return;
    const amount = rollFormula(formula);
    let results: string[] = [];
    for (const id of selected) {
      const m = monsters.find((x) => x.tokenId === id);
      if (!m) continue;

      let effectiveAmount = amount;
      let armorBlocked = 0;

      // Apply armor reduction if enabled
      if (useArmor && !isHeal && amount > 0) {
        const totalArmor = m.armor + Math.floor(
          Object.values(m.armorByType || {}).reduce((s, v) => s + v, 0) /
          Math.max(1, Object.keys(m.armorByType || {}).length)
        );
        if (totalArmor > 0) {
          armorBlocked = Math.min(amount, totalArmor);
          effectiveAmount = Math.max(0, amount - totalArmor);
        }
      }

      const newHp = isHeal
        ? Math.min(m.maxHp, m.hp + effectiveAmount)
        : Math.max(0, m.hp - effectiveAmount);

      await updateMonster(id, { hp: newHp });

      if (useArmor && !isHeal && armorBlocked > 0) {
        results.push(`${m.name}: ${m.hp} → ${newHp} (−${effectiveAmount}, 🛡${armorBlocked})`);
      } else {
        results.push(`${m.name}: ${m.hp} → ${newHp}`);
      }
    }
    setLastResult(`${isHeal ? '+' : '-'}${amount} (${formula}) → ${results.length} монстров`);
    setTimeout(() => setLastResult(null), 3000);
  }, [formula, selected, monsters, isHeal, updateMonster, useArmor]);

  const removeSelected = useCallback(() => {
    for (const id of selected) unregister(id);
    setSelected(new Set());
  }, [selected, unregister]);

  const handleAddClick = async () => {
    const tokenIds = await getSelection();
    if (!tokenIds.length) return;
    const tokens = tokenIds
      .map(id => ({ tokenId: id, defaultName: monsters.find(m => m.tokenId === id)?.name || '' }))
      .filter(t => !monsters.find(m => m.tokenId === t.tokenId));
    if (!tokens.length) return;
    setPendingTokens(tokens);
    setShowRegistration(true);
  };

  const handleRegister = (entries: { tokenId: string; name: string; maxHp: number; group: string }[]) => {
    for (const e of entries) registerTokens([e.tokenId], e.name, e.maxHp, e.group);
    setShowRegistration(false);
    setPendingTokens([]);
  };

  const handleAttack = (monster: Monster, weapon: MonsterWeapon) => {
    setAttackContext({ monster, weapon });
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'Все', count: monsters.length },
    { id: 'alive', label: 'Живые', count: monsters.filter((m) => m.hp > 0).length },
    { id: 'dead', label: 'Мёртвые', count: monsters.filter((m) => m.hp <= 0).length },
  ];

  const renderMonster = (m: typeof monsters[0]) => (
    <MonsterCard key={m.tokenId} monster={m} selected={selected.has(m.tokenId)}
      onToggle={toggle} onUpdate={updateMonster} onRemove={unregister} onAttack={handleAttack} />
  );

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-bone overflow-hidden">
      {showRegistration && (
        <RegistrationModal tokens={pendingTokens} existingGroups={getGroups()}
          onConfirm={handleRegister} onClose={() => { setShowRegistration(false); setPendingTokens([]); }} />
      )}

      {attackContext && (
        <WeaponAttackPanel
          attacker={attackContext.monster}
          weapon={attackContext.weapon}
          onClose={() => setAttackContext(null)}
        />
      )}

      <header className="px-4 py-3 bg-[#0d0d14] border-b border-[#1a1a2a] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="font-cinzel-decorative text-sm text-gold tracking-wider">☠️ Cursed Assistant</span>
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
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[#111118] transition-colors">
                  <span className="text-[10px] text-faded w-3">{collapsedGroups.has(group) ? '▶' : '▼'}</span>
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
              💚 Лечение
            </button>
            {!isHeal && (
              <button onClick={() => setUseArmor(!useArmor)}
                className={`px-2 py-1.5 text-[10px] rounded-lg font-cinzel transition-all ${useArmor ? 'bg-[#1a1a2a] text-gold border border-gold-dark/30' : 'bg-[#1a1a2a] text-faded border border-transparent'}`}>
                🛡 Броня
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input type="text" value={formula}
              onChange={(e) => setFormula(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFormula(); }}
              placeholder="Формула: 10, 2d6+3, 1d20..."
              className="flex-1 bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs font-mono text-bone placeholder:text-faded/50 focus:border-gold-dark focus:outline-none" />
            <button onClick={applyFormula}
              className={`px-4 py-1.5 rounded-lg font-cinzel text-xs font-bold transition-all ${!isHeal ? 'bg-blood-dark text-blood-bright hover:bg-blood border border-blood/50' : 'bg-green-900/50 text-green-400 hover:bg-green-900/80 border border-green-800/50'}`}>
              {isHeal ? 'Лечить' : 'Нанести'} ×{selected.size}
            </button>
            <button onClick={removeSelected}
              className="py-1.5 px-2.5 text-[11px] text-faded hover:text-blood-bright hover:bg-blood-dark/30 rounded-lg border border-transparent hover:border-blood/30 transition-all">
              🗑️
            </button>
          </div>

          {lastResult && (
            <div className="text-[10px] text-gold/70 font-mono text-center animate-pulse">{lastResult}</div>
          )}
        </div>
      )}
    </div>
  );
}
