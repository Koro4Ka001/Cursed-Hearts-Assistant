import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { useMonsterTokens } from '../hooks/useMonsterTokens';
import { MonsterCard } from './MonsterCard';
import { RegistrationModal, getGroupColor } from './RegistrationModal';
import { WeaponAttackPanel } from './WeaponAttackPanel';
import { rollFormula } from '../services/diceService';
import { tokenBarService } from '../services/tokenBarService';
import { calculateMonsterDamage } from '../utils/monsterDamage';
import { ELEMENT_NAMES_MAP } from '../constants/elements';
import type { Monster, MonsterWeapon } from '../stores/monsterStore';
import { useMonsterStore } from '../stores/monsterStore';
import type { DamageType } from '../types';

const ALL_DAMAGE_TYPES: DamageType[] = [
  'slashing', 'piercing', 'bludgeoning', 'chopping',
  'огонь', 'вода', 'земля', 'воздух', 'свет', 'тьма',
  'пространство', 'астрал', 'скверна', 'электричество', 'пустота', 'жизнь',
  'смерть', 'ужас', 'запредельность', 'pure',
];

const UNGROUPED_KEY = '__ungrouped__';

type GmViewMode = 'compact' | 'medium' | 'large';

export function GMDashboard() {
  const { monsters, registerTokens, updateMonster, unregister, getSelection, getGroups } = useMonsterTokens();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isHeal, setIsHeal] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [pendingTokens, setPendingTokens] = useState<{ tokenId: string; defaultName: string }[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [formula, setFormula] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [damageType, setDamageType] = useState<DamageType>('slashing');
  const [attackContext, setAttackContext] = useState<{ monster: Monster; weapon: MonsterWeapon | null } | null>(null);
  const [viewMode, setViewMode] = useState<GmViewMode>('medium');

  // Change window size when view mode changes
  useEffect(() => {
    const sizes: Record<GmViewMode, { width: number; height: number }> = {
      compact: { width: 300, height: 150 },
      medium: { width: 420, height: 700 },
      large: { width: 700, height: 850 },
    };
    const size = sizes[viewMode];
    try {
      OBR.action.setWidth(size.width);
      OBR.action.setHeight(size.height);
    } catch { /* ignore */ }
  }, [viewMode]);

  const searchLower = searchQuery.trim().toLowerCase();
  const searchActive = searchLower.length > 0;

  // 🔍 Поиск по имени фильтрует список (чипы навигации считаются по тому же набору)
  const visibleMonsters = useMemo(
    () => (searchActive ? monsters.filter(m => m.name.toLowerCase().includes(searchLower)) : monsters),
    [monsters, searchActive, searchLower]
  );

  // Group monsters
  const grouped = useMemo(() => {
    const groups = new Map<string, Monster[]>();
    const ungrouped: Monster[] = [];
    for (const m of visibleMonsters) {
      if (m.group) {
        const arr = groups.get(m.group) || [];
        arr.push(m);
        groups.set(m.group, arr);
      } else {
        ungrouped.push(m);
      }
    }
    return { groups, ungrouped };
  }, [visibleMonsters]);

  // 🔝 Чипы групп: имя + счётчик + индикатор по самому низкому HP% в группе
  // (универсальные цвета: зелёный >50%, жёлтый 25–50%, красный <25%; мёртвые = 0%)
  const groupRefs = useRef(new Map<string, HTMLElement>());
  const setGroupRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    if (el) groupRefs.current.set(key, el);
    else groupRefs.current.delete(key);
  }, []);

  const hpPctOf = (m: Monster) => (m.maxHp > 0 ? Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100)) : 0);
  const dotFor = (items: Monster[]) => {
    const min = items.length ? Math.min(...items.map(hpPctOf)) : 0;
    return min > 50 ? 'bg-green-500' : min >= 25 ? 'bg-yellow-500' : 'bg-red-500';
  };

  const chips = useMemo(() => {
    const list: { key: string; label: string; count: number; dot: string }[] = [];
    for (const [group, items] of grouped.groups) {
      list.push({ key: group, label: group, count: items.length, dot: dotFor(items) });
    }
    if (grouped.ungrouped.length > 0) {
      list.push({ key: UNGROUPED_KEY, label: 'Без группы', count: grouped.ungrouped.length, dot: dotFor(grouped.ungrouped) });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped]);

  // Плавный скролл к группе: при необходимости разворачиваем её и ждём кадр
  const scrollToGroup = useCallback((key: string) => {
    if (collapsedGroups.has(key)) {
      setCollapsedGroups(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
    setTimeout(() => {
      groupRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, [collapsedGroups]);

  const toggle = useCallback((id: string) => {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(monsters.map(m => m.tokenId))), [monsters]);
  const deselectAll = useCallback(() => setSelected(new Set()), []);

  const toggleGroup = useCallback((group: string) => {
    const groupMonsters = monsters.filter(m => m.group === group);
    const allSelected = groupMonsters.every(m => selected.has(m.tokenId));
    setSelected(prev => {
      const next = new Set(prev);
      for (const m of groupMonsters) {
        if (allSelected) next.delete(m.tokenId);
        else next.add(m.tokenId);
      }
      return next;
    });
  }, [monsters, selected]);

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

      // Apply proper damage calculation if dealing damage
      if (!isHeal && amount > 0) {
        const dmgResult = calculateMonsterDamage(amount, damageType, m);
        effectiveAmount = dmgResult.finalDamage;
        armorBlocked = dmgResult.armorApplied;
      }

      const newHp = isHeal
        ? Math.min(m.maxHp, m.hp + effectiveAmount)
        // 🔧 Нижний кламп убран: HP монстра может уходить в минус.
        : m.hp - effectiveAmount;

      await updateMonster(id, { hp: newHp });

      if (!isHeal && armorBlocked > 0) {
        results.push(`${m.name}: ${m.hp} → ${newHp} (−${effectiveAmount}, 🛡${armorBlocked})`);
      } else {
        results.push(`${m.name}: ${m.hp} → ${newHp}`);
      }
    }
    setLastResult(`${isHeal ? '+' : '-'}${amount} (${formula}) → ${results.length} монстров`);
    setTimeout(() => setLastResult(null), 3000);
  }, [formula, selected, monsters, isHeal, updateMonster, damageType]);

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

  const handleAttack = (monster: Monster, weapon: MonsterWeapon | null) => {
    setAttackContext({ monster, weapon });
  };

  const handleDuplicate = async (tokenId: string) => {
    const tokenIds = await getSelection();
    if (!tokenIds.length) {
      // No token selected on map - show notification
      alert('Выделите токен на карте для копирования');
      return;
    }
    const newTokenId = tokenIds.find(id => id !== tokenId);
    if (!newTokenId) {
      alert('Выделите ДРУГОЙ токен на карте (не тот же самый)');
      return;
    }
    useMonsterStore.getState().duplicate(tokenId, newTokenId);
    const m = useMonsterStore.getState().get(newTokenId);
    if (m) {
      await tokenBarService.createBars(newTokenId, m.maxHp, m.maxHp, 0, 0, false, m.name);
    }
  };

  const renderMonster = (m: Monster, isLast: boolean = false) => (
    <MonsterCard key={m.tokenId} monster={m} selected={selected.has(m.tokenId)}
      onToggle={toggle} onUpdate={updateMonster} onRemove={unregister}
      onAttack={handleAttack} onDuplicate={handleDuplicate} isLast={isLast} />
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

      {/* Header */}
      <header className="px-4 py-3 bg-[#0d0d14] border-b border-[#1a1a2a] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="font-cinzel-decorative text-sm text-gold tracking-wider">☠️ Cursed Assistant</span>
          <div className="flex items-center gap-2">
            {/* View mode switcher */}
            <div className="flex items-center gap-0.5 mr-2">
              {(['compact', 'medium', 'large'] as GmViewMode[]).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                    viewMode === mode
                      ? 'bg-gold-dark/30 text-gold border border-gold-dark/40'
                      : 'text-faded hover:text-bone border border-transparent'
                  }`}
                  title={mode === 'compact' ? 'Компактный' : mode === 'medium' ? 'Средний' : 'Большой'}>
                  {mode === 'compact' ? '▢' : mode === 'medium' ? '▬' : '▣'}
                </button>
              ))}
            </div>
            {selected.size > 0 && (
              <span className="text-[10px] text-gold bg-gold-dark/20 px-2 py-0.5 rounded-full border border-gold-dark/30">
                {selected.size} выбрано
              </span>
            )}
            <button onClick={handleAddClick}
              className="px-3 py-1.5 text-[11px] bg-gold-dark/30 text-gold rounded-lg hover:bg-gold-dark/50 transition-colors font-cinzel">
              + Добавить
            </button>
          </div>
        </div>

        {/* Quick actions when selected */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-[10px] text-gold hover:text-gold-bright">Все</button>
            <button onClick={deselectAll} className="text-[10px] text-faded hover:text-bone">Снять</button>
            <span className="text-[9px] text-faded/50">|</span>
            <button onClick={removeSelected}
              className="text-[10px] text-faded hover:text-blood-bright">
              🗑 Удалить
            </button>
          </div>
        )}
      </header>

      {/* 🔝 Навигационная панель над списком: поиск + чипы групп (фиксированный блок, не sticky) */}
      <div className="px-3 py-2 bg-[#0d0d14] border-b border-[#1a1a2a] shrink-0 space-y-2">
        <input type="text" value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Поиск юнита по имени..."
          className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-bone placeholder:text-faded/50 focus:border-gold-dark focus:outline-none" />
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map(chip => (
              <button key={chip.key} onClick={() => scrollToGroup(chip.key)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#1a1a2a] border border-[#2a2a3a] hover:border-gold-dark/60 transition-colors"
                title={`Перейти к «${chip.label}»`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${chip.dot}`} />
                <span className="text-[10px] font-cinzel text-bone max-w-[110px] truncate">{chip.label}</span>
                <span className="text-[10px] font-sans text-faded">{chip.count}</span>
              </button>
            ))}
          </div>
        )}
        {searchActive && visibleMonsters.length === 0 && (
          <div className="text-[10px] text-faded text-center py-1">Ничего не найдено по «{searchQuery.trim()}»</div>
        )}
      </div>

      {/* Monster list */}
      <main className="flex-1 overflow-y-auto p-3 space-y-2">
        {monsters.length === 0 ? (
          <div className="text-center py-12 text-faded">
            <div className="text-4xl mb-3 opacity-40">🎯</div>
            <p className="text-sm">Выделите токены на карте</p>
            <button onClick={handleAddClick}
              className="mt-4 px-4 py-2 bg-gold-dark/30 text-gold rounded-lg hover:bg-gold-dark/50 text-xs font-cinzel">
              + Добавить токены
            </button>
          </div>
        ) : (
          <>
            {/* Groups */}
            {Array.from(grouped.groups.entries()).map(([group, items]) => (
              <div key={group} id={`gm-group-${group.replace(/\s+/g, '-')}`} ref={setGroupRef(group)}
                className="rounded-lg border border-[#1a1a2a]/50 overflow-hidden bg-[#0d0d14]">
                <button onClick={() => toggleCollapse(group)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 bg-[#111118] hover:bg-[#151520] transition-colors">
                  <span className="text-[10px] text-faded w-3">{collapsedGroups.has(group) ? '▶' : '▼'}</span>
                  <input type="checkbox" checked={items.every(m => selected.has(m.tokenId))}
                    onChange={() => toggleGroup(group)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3 h-3 accent-[#c9a84c] cursor-pointer" />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-cinzel ${getGroupColor(group)}`}>
                    {group}
                  </span>
                  <span className="text-[10px] text-faded font-sans">({items.length})</span>
                </button>
                {/* Во время поиска показываем совпадения даже в свёрнутых группах */}
                {(!collapsedGroups.has(group) || searchActive) && (
                  <div className="divide-y divide-[#1a1a2a]/40">
                    {items.map((m, i) => renderMonster(m, i === items.length - 1))}
                  </div>
                )}
              </div>
            ))}

            {/* Ungrouped */}
            {grouped.ungrouped.length > 0 && (
              <div id="gm-group-ungrouped" ref={setGroupRef(UNGROUPED_KEY)}
                className="rounded-lg border border-[#1a1a2a]/50 overflow-hidden bg-[#0d0d14]">
                <div className="px-3 py-1.5 bg-[#111118]">
                  <span className="text-[10px] text-faded font-cinzel">Без группы</span>
                  <span className="text-[10px] text-faded font-sans ml-1">({grouped.ungrouped.length})</span>
                </div>
                <div className="divide-y divide-[#1a1a2a]/40">
                  {grouped.ungrouped.map((m, i) => renderMonster(m, i === grouped.ungrouped.length - 1))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Damage/Heal panel — always visible */}
      <div className="px-3 py-3 bg-[#0d0d14] border-t border-[#1a1a2a] shrink-0 space-y-2">
        {selected.size === 0 ? (
          <div className="text-center text-[10px] text-faded py-1">
            Выделите монстров галочками для нанесения урона или лечения
          </div>
        ) : (
          <>
            {/* Mode selector */}
            <div className="flex items-center gap-2">
              <button onClick={() => setIsHeal(false)}
                className={`px-3 py-1.5 text-[11px] rounded-lg font-cinzel transition-all ${!isHeal ? 'bg-blood-dark text-blood-bright border border-blood/50' : 'bg-[#1a1a2a] text-faded border border-transparent'}`}>
                ⚔️ Урон
              </button>
              <button onClick={() => setIsHeal(true)}
                className={`px-3 py-1.5 text-[11px] rounded-lg font-cinzel transition-all ${isHeal ? 'bg-green-900/50 text-green-400 border border-green-800/50' : 'bg-[#1a1a2a] text-faded border border-transparent'}`}>
                💚 Лечение
              </button>
            </div>

            {/* Damage type */}
            {!isHeal && (
              <div className="flex items-center gap-2">
                <select value={damageType}
                  onChange={(e) => setDamageType(e.target.value as DamageType)}
                  className="bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1.5 text-bone text-[10px] focus:border-gold-dark focus:outline-none shrink-0 w-28">
                  {ALL_DAMAGE_TYPES.map(dt => (
                    <option key={dt} value={dt}>{ELEMENT_NAMES_MAP[dt] ?? dt}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Formula input + action */}
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
            </div>

            {lastResult && (
              <div className="text-[10px] text-gold/70 font-mono text-center animate-pulse">{lastResult}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
