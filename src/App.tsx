import { useState, useEffect } from 'react';
import { useGameStore } from './stores/gameStore';
import { rollD20, rollDice, formatRoll } from './utils/dice';
import { logToGoogleDocs } from './services/googleDocsService';
import { DAMAGE_TYPE_NAMES, PROFICIENCY_NAMES } from './types';
import type { Unit, Weapon, Spell, Resource, QuickAction, ProficiencyType, StatType, DamageType } from './types';
import OBR from '@owlbear-rodeo/sdk';

type TabType = 'combat' | 'magic' | 'resources' | 'actions' | 'settings';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('combat');
  const [isOBRReady, setIsOBRReady] = useState(false);
  const { units, activeUnitId, setActiveUnit, getActiveUnit, addLog, settings } = useGameStore();
  const activeUnit = getActiveUnit();

  useEffect(() => {
    OBR.onReady(() => setIsOBRReady(true));
  }, []);

  const log = (msg: string) => {
    addLog(msg);
    if (settings.webAppUrl && activeUnit) {
      logToGoogleDocs(settings.webAppUrl, activeUnit.googleDocsHeader, msg);
    }
  };

  const tabs = [
    { id: 'combat' as TabType, icon: '⚔️', label: 'Бой' },
    { id: 'magic' as TabType, icon: '✨', label: 'Магия' },
    { id: 'resources' as TabType, icon: '📦', label: 'Ресурс' },
    { id: 'actions' as TabType, icon: '🎯', label: 'Действ' },
    { id: 'settings' as TabType, icon: '⚙️', label: 'Настр' },
  ];

  const hp = activeUnit?.health || { current: 0, max: 1 };
  const mp = activeUnit?.mana || { current: 0, max: 1 };

  return (
    <div className="min-h-screen bg-[#030303] text-[#d4c8b8] p-2 text-sm">
      {/* Header */}
      <div className="text-center py-2 border-b border-[#3a332a] mb-2">
        <div className="text-[#ffd700] text-xs tracking-[0.2em]">☠ CURSED HEARTS ☠</div>
        <div className="text-[#4a433a] text-[10px]">PLAYER ASSISTANT</div>
      </div>

      {/* Unit Selector */}
      <div className="flex gap-2 mb-2">
        <select
          value={activeUnitId || ''}
          onChange={(e) => setActiveUnit(e.target.value)}
          className="flex-1 bg-[#161412] border border-[#3a332a] text-[#d4a726] px-2 py-1.5 text-sm focus:outline-none focus:border-[#d4a726]"
        >
          {units.length === 0 && <option value="">— Добавьте юнита —</option>}
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button className="bg-[#161412] border border-[#3a332a] px-2 text-[#d4a726] hover:border-[#d4a726]">🔄</button>
      </div>

      {/* HP / Mana */}
      {activeUnit && (
        <div className="space-y-1.5 mb-2">
          <StatBar label="HP" icon="🩸" current={hp.current} max={hp.max} color="red" />
          <StatBar label="Мана" icon="💠" current={mp.current} max={mp.max} color="blue" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 mb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-1.5 border text-center transition-colors ${
              activeTab === t.id
                ? 'bg-[#161412] border-[#d4a726] text-[#ffd700]'
                : 'bg-[#0c0a09] border-[#3a332a] text-[#4a433a] hover:text-[#7a6f62]'
            }`}
          >
            <div className="text-base">{t.icon}</div>
            <div className="text-[8px]">{t.label}</div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="border border-[#3a332a] bg-[#0c0a09] p-2 min-h-[300px]">
        {activeTab === 'combat' && <CombatTab unit={activeUnit} log={log} />}
        {activeTab === 'magic' && <MagicTab unit={activeUnit} log={log} />}
        {activeTab === 'resources' && <ResourcesTab unit={activeUnit} />}
        {activeTab === 'actions' && <ActionsTab unit={activeUnit} log={log} />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>

      <div className="mt-1 text-center text-[9px] text-[#4a433a]">
        {isOBRReady ? '✓ Owlbear' : '⏳ Подключение...'}
      </div>
    </div>
  );
}

/* ═══════════════════════ STAT BAR ═══════════════════════ */
function StatBar({ label, icon, current, max, color }: { label: string; icon: string; current: number; max: number; color: 'red' | 'blue' }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const colors = color === 'red'
    ? { border: '#4a0000', bg: 'from-[#cc2020] via-[#8b0000] to-[#2a0000]' }
    : { border: '#0a2040', bg: 'from-[#4a9eff] via-[#1a4a8b] to-[#051530]' };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm">{icon}</span>
      <span className="text-[9px] text-[#7a6f62] w-8">{label}</span>
      <div className={`flex-1 h-5 bg-[#0a0606] border-2 relative overflow-hidden`} style={{ borderColor: colors.border }}>
        <div className={`h-full bg-gradient-to-b ${colors.bg} transition-all`} style={{ width: `${pct}%` }} />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow">{current}/{max}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════ COMBAT TAB ═══════════════════════ */
function CombatTab({ unit, log }: { unit: Unit | null; log: (m: string) => void }) {
  const { setHealth, combatState, setCombatState, resetCombat } = useGameStore();
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('');
  const [damageInput, setDamageInput] = useState('');
  const [healInput, setHealInput] = useState('');
  const [damageType, setDamageType] = useState<DamageType>('slashing');

  if (!unit) return <NoUnit />;

  const weapon = unit.weapons.find((w) => w.id === selectedWeaponId);

  const handleAttack = () => {
    if (!weapon) return;
    const profBonus = unit.proficiencies[weapon.proficiencyType] || 0;
    const roll = rollD20(profBonus);
    
    log(`${unit.shortName} атакует ${weapon.name}: ${formatRoll(roll)}`);
    
    if (roll.rawD20 === 1) {
      setCombatState({ phase: 'miss', message: '❌ Критический промах!' });
    } else if (roll.total > 11) {
      setCombatState({ phase: 'waiting_dodge', attackRoll: roll, message: roll.isCrit ? '💥 КРИТ 20! Уворот?' : `🎯 ${roll.total} — Попадание! Уворот?` });
    } else {
      setCombatState({ phase: 'miss', message: `❌ ${roll.total} — Промах` });
    }
  };

  const handleDodge = (dodged: boolean) => {
    if (!weapon || !combatState.attackRoll) return;
    
    if (dodged) {
      log(`${unit.shortName}: противник увернулся`);
      setCombatState({ phase: 'miss', message: '🌀 Противник увернулся!' });
    } else {
      const isCrit = combatState.attackRoll.isCrit;
      const statBonus = weapon.statBonus === 'physicalPower' ? unit.stats.physicalPower * 5
        : weapon.statBonus === 'dexterity' ? unit.stats.dexterity * 3 : 0;
      
      const dmgRoll = rollDice(weapon.damageFormula + '+' + statBonus, isCrit);
      log(`${unit.shortName} наносит ${dmgRoll.total} ${DAMAGE_TYPE_NAMES[weapon.damageType] || weapon.damageType}`);
      setCombatState({ phase: 'damage', damageRoll: dmgRoll, message: `💥 ${dmgRoll.total} ${DAMAGE_TYPE_NAMES[weapon.damageType]}${isCrit ? ' (КРИТ!)' : ''}` });
    }
  };

  const handleTakeDamage = () => {
    const dmg = parseInt(damageInput) || 0;
    if (dmg <= 0) return;
    const newHp = Math.max(0, unit.health.current - dmg);
    setHealth(unit.id, newHp);
    log(`${unit.shortName} получает ${dmg} урона → ${newHp}/${unit.health.max}`);
    setDamageInput('');
  };

  const handleHeal = () => {
    const heal = parseInt(healInput) || 0;
    if (heal <= 0) return;
    const newHp = Math.min(unit.health.max, unit.health.current + heal);
    setHealth(unit.id, newHp);
    log(`${unit.shortName} исцеляется на ${heal} → ${newHp}/${unit.health.max}`);
    setHealInput('');
  };

  return (
    <div className="space-y-3">
      {/* Attack */}
      <Section title="⚔️ АТАКА">
        <select
          value={selectedWeaponId}
          onChange={(e) => { setSelectedWeaponId(e.target.value); resetCombat(); }}
          className="w-full bg-[#161412] border border-[#3a332a] text-[#d4c8b8] px-2 py-1.5 mb-2"
        >
          <option value="">— Выберите оружие —</option>
          {unit.weapons.map((w) => (
            <option key={w.id} value={w.id}>{w.name} ({w.damageFormula} {DAMAGE_TYPE_NAMES[w.damageType]?.split(' ')[0]})</option>
          ))}
        </select>

        {weapon && combatState.phase === 'idle' && (
          <button onClick={handleAttack} className="w-full py-2 bg-gradient-to-b from-[#3a1515] to-[#100404] border border-[#4a0000] text-[#f0c0c0] font-bold hover:border-[#8b0000]">
            ⚔️ АТАКОВАТЬ!
          </button>
        )}

        {combatState.phase === 'waiting_dodge' && (
          <div className="space-y-2">
            <div className="text-center text-[#ffd700] py-2">{combatState.message}</div>
            <div className="flex gap-2">
              <button onClick={() => handleDodge(true)} className="flex-1 py-2 bg-[#1a1a30] border border-[#3a3a70] text-[#a0a0e0]">🌀 Уворот</button>
              <button onClick={() => handleDodge(false)} className="flex-1 py-2 bg-[#3a1515] border border-[#703030] text-[#e0a0a0]">💥 Нет уворота</button>
            </div>
          </div>
        )}

        {(combatState.phase === 'damage' || combatState.phase === 'miss') && (
          <div className="text-center py-3">
            <div className={combatState.phase === 'damage' ? 'text-2xl text-[#ff4444] font-bold' : 'text-lg text-[#888]'}>
              {combatState.message}
            </div>
            <button onClick={resetCombat} className="mt-2 text-[10px] text-[#7a6f62] underline">Сбросить</button>
          </div>
        )}
      </Section>

      {/* Take Damage */}
      <Section title="🩸 ПОЛУЧЕНИЕ УРОНА">
        <div className="flex gap-2 mb-2">
          <input type="number" value={damageInput} onChange={(e) => setDamageInput(e.target.value)} placeholder="Урон" className="flex-1 bg-[#161412] border border-[#3a332a] px-2 py-1.5" />
          <select value={damageType} onChange={(e) => setDamageType(e.target.value as DamageType)} className="bg-[#161412] border border-[#3a332a] px-2 py-1.5 text-xs">
            {Object.entries(DAMAGE_TYPE_NAMES).slice(0, 4).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button onClick={handleTakeDamage} className="w-full py-1.5 bg-[#2a1515] border border-[#5a1c1c] text-[#d09090]">🩸 Получить урон</button>
      </Section>

      {/* Heal */}
      <Section title="💚 ИСЦЕЛЕНИЕ">
        <div className="flex gap-2">
          <input type="number" value={healInput} onChange={(e) => setHealInput(e.target.value)} placeholder="HP" className="flex-1 bg-[#161412] border border-[#3a332a] px-2 py-1.5" />
          <button onClick={handleHeal} className="px-4 bg-[#1a2a15] border border-[#2e5a1c] text-[#a0d090]">💚 Исцелить</button>
        </div>
      </Section>
    </div>
  );
}

/* ═══════════════════════ MAGIC TAB ═══════════════════════ */
function MagicTab({ unit, log }: { unit: Unit | null; log: (m: string) => void }) {
  const { setMana } = useGameStore();
  const [selectedSpellId, setSelectedSpellId] = useState('');
  const [manaInput, setManaInput] = useState('');
  const [castResult, setCastResult] = useState<string | null>(null);

  if (!unit) return <NoUnit />;

  const spell = unit.spells.find((s) => s.id === selectedSpellId);

  const handleCast = () => {
    if (!spell) return;
    if (unit.mana.current < spell.manaCost) {
      setCastResult('❌ Недостаточно маны!');
      return;
    }

    // Списываем ману
    const newMana = unit.mana.current - spell.manaCost;
    setMana(unit.id, newMana);

    // Находим макс бонус элемента
    const bonus = Math.max(0, ...spell.elements.map((e) => unit.magicBonuses[e] || 0));
    const roll = rollD20(bonus);

    log(`${unit.shortName} кастует ${spell.name} (-${spell.manaCost} маны): ${formatRoll(roll)}`);

    if (roll.total > 11) {
      if (spell.damageFormula) {
        const intBonus = unit.stats.intelligence * 3;
        const isCrit = roll.isCrit;
        const dmgRoll = rollDice(spell.damageFormula + '+' + intBonus, isCrit);
        
        if (spell.projectiles && spell.projectiles > 1) {
          // Множественные снаряды
          let hits = 0;
          let totalDmg = 0;
          for (let i = 0; i < spell.projectiles; i++) {
            const hitRoll = spell.canDodge === false ? { total: 20 } : rollD20(bonus);
            if (hitRoll.total > 11) {
              hits++;
              const projDmg = rollDice(spell.damageFormula + '+' + intBonus, false);
              totalDmg += projDmg.total;
            }
          }
          log(`${unit.shortName} попадает ${hits}/${spell.projectiles}, урон: ${totalDmg}`);
          setCastResult(`✅ Попало ${hits}/${spell.projectiles} снарядов! Урон: ${totalDmg}`);
        } else {
          log(`${unit.shortName} наносит ${dmgRoll.total} урона`);
          setCastResult(`✅ Успех! Урон: ${dmgRoll.total}${isCrit ? ' (КРИТ!)' : ''}`);
        }
      } else {
        log(`${unit.shortName}: ${spell.name} — успех`);
        setCastResult(`✅ ${spell.name} применено!`);
      }
    } else {
      log(`${unit.shortName}: каст провален`);
      setCastResult(`❌ Каст провален (${roll.total}). Мана потрачена.`);
    }
  };

  const handleManaChange = (delta: number) => {
    const amount = parseInt(manaInput) || 0;
    if (amount <= 0) return;
    const newMana = Math.max(0, Math.min(unit.mana.max, unit.mana.current + delta * amount));
    setMana(unit.id, newMana);
    log(`${unit.shortName} ${delta > 0 ? '+' : ''}${delta * amount} маны → ${newMana}/${unit.mana.max}`);
    setManaInput('');
  };

  return (
    <div className="space-y-3">
      <Section title="✨ ЗАКЛИНАНИЯ">
        <select
          value={selectedSpellId}
          onChange={(e) => { setSelectedSpellId(e.target.value); setCastResult(null); }}
          className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1.5 mb-2"
        >
          <option value="">— Гримуар —</option>
          {unit.spells.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.manaCost}💠)</option>
          ))}
        </select>

        {spell && (
          <div className="text-[10px] text-[#7a6f62] mb-2 p-2 bg-[#0a0806] border border-[#2a2520]">
            <div><span className="text-[#d4a726]">Элементы:</span> {spell.elements.join(', ')}</div>
            {spell.damageFormula && <div><span className="text-[#d4a726]">Урон:</span> {spell.damageFormula}</div>}
            {spell.projectiles && <div><span className="text-[#d4a726]">Снаряды:</span> {spell.projectiles}</div>}
            {spell.description && <div className="mt-1 italic">{spell.description}</div>}
          </div>
        )}

        {castResult && <div className="text-center py-2 text-[#ffd700]">{castResult}</div>}

        <button
          onClick={handleCast}
          disabled={!spell}
          className="w-full py-2 bg-gradient-to-b from-[#2a2010] to-[#0a0805] border border-[#8b6914] text-[#ffd700] font-bold disabled:opacity-30"
        >
          ✨ СОТВОРИТЬ!
        </button>
      </Section>

      <Section title="💠 МАНА">
        <input type="number" value={manaInput} onChange={(e) => setManaInput(e.target.value)} placeholder="Количество" className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1.5 mb-2" />
        <div className="flex gap-2">
          <button onClick={() => handleManaChange(-1)} className="flex-1 py-1.5 bg-[#2a1515] border border-[#5a1c1c] text-[#d09090]">− Потратить</button>
          <button onClick={() => handleManaChange(1)} className="flex-1 py-1.5 bg-[#1a2a15] border border-[#2e5a1c] text-[#a0d090]">+ Восстановить</button>
        </div>
      </Section>
    </div>
  );
}

/* ═══════════════════════ RESOURCES TAB ═══════════════════════ */
function ResourcesTab({ unit }: { unit: Unit | null }) {
  const { modifyResource, addResource, deleteResource } = useGameStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newRes, setNewRes] = useState({ name: '', icon: '📦', max: 10 });

  if (!unit) return <NoUnit />;

  const handleAdd = () => {
    if (!newRes.name) return;
    addResource(unit.id, { ...newRes, current: newRes.max });
    setNewRes({ name: '', icon: '📦', max: 10 });
    setShowAdd(false);
  };

  return (
    <div className="space-y-2">
      {unit.resources.map((r) => (
        <div key={r.id} className="border border-[#3a332a] bg-[#0f0d0c] p-2">
          <div className="flex items-center gap-2 mb-1">
            <span>{r.icon}</span>
            <span className="flex-1 text-[#d4a726] text-sm">{r.name}</span>
            <button onClick={() => deleteResource(unit.id, r.id)} className="text-[#5a1c1c] text-xs">🗑</button>
          </div>
          <div className="flex items-center justify-center gap-1">
            <button onClick={() => modifyResource(unit.id, r.id, -5)} className="px-1.5 py-0.5 bg-[#161412] border border-[#3a332a] text-[10px]">-5</button>
            <button onClick={() => modifyResource(unit.id, r.id, -1)} className="px-1.5 py-0.5 bg-[#161412] border border-[#3a332a] text-[10px]">-1</button>
            <span className="px-2 text-[#ffd700] font-bold text-sm">[{r.current}]/{r.max}</span>
            <button onClick={() => modifyResource(unit.id, r.id, 1)} className="px-1.5 py-0.5 bg-[#161412] border border-[#3a332a] text-[10px]">+1</button>
            <button onClick={() => modifyResource(unit.id, r.id, 5)} className="px-1.5 py-0.5 bg-[#161412] border border-[#3a332a] text-[10px]">+5</button>
          </div>
        </div>
      ))}

      {showAdd ? (
        <div className="border border-[#3a332a] bg-[#0f0d0c] p-2 space-y-2">
          <input value={newRes.name} onChange={(e) => setNewRes({ ...newRes, name: e.target.value })} placeholder="Название" className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1" />
          <div className="flex gap-2">
            <input value={newRes.icon} onChange={(e) => setNewRes({ ...newRes, icon: e.target.value })} className="w-12 bg-[#161412] border border-[#3a332a] px-2 py-1 text-center" />
            <input type="number" value={newRes.max} onChange={(e) => setNewRes({ ...newRes, max: +e.target.value })} className="flex-1 bg-[#161412] border border-[#3a332a] px-2 py-1" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 py-1 bg-[#1a2a15] border border-[#2e5a1c] text-[#a0d090]">✓</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 py-1 bg-[#2a1515] border border-[#5a1c1c] text-[#d09090]">✕</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="w-full py-1.5 border border-dashed border-[#3a332a] text-[#4a433a] hover:text-[#7a6f62]">+ Добавить ресурс</button>
      )}
    </div>
  );
}

/* ═══════════════════════ ACTIONS TAB ═══════════════════════ */
function ActionsTab({ unit, log }: { unit: Unit | null; log: (m: string) => void }) {
  const { addQuickAction, deleteQuickAction } = useGameStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newAction, setNewAction] = useState({ name: '', icon: '🎯', diceFormula: '' });

  if (!unit) return <NoUnit />;

  const handleRun = (action: QuickAction) => {
    if (action.diceFormula) {
      const roll = rollDice(action.diceFormula);
      log(`${unit.shortName} → ${action.name}: ${formatRoll(roll)}`);
    } else {
      log(`${unit.shortName} → ${action.name}`);
    }
  };

  const handleAdd = () => {
    if (!newAction.name) return;
    addQuickAction(unit.id, newAction);
    setNewAction({ name: '', icon: '🎯', diceFormula: '' });
    setShowAdd(false);
  };

  return (
    <div className="space-y-2">
      {unit.quickActions.map((a) => (
        <div key={a.id} className="flex items-center gap-2 p-2 bg-[#0f0d0c] border border-[#3a332a]">
          <button onClick={() => handleRun(a)} className="flex-1 flex items-center gap-2 text-left hover:text-[#ffd700]">
            <span>{a.icon}</span>
            <span className="flex-1">{a.name}</span>
            {a.diceFormula && <span className="text-[10px] text-[#7a6f62]">{a.diceFormula}</span>}
          </button>
          <button onClick={() => deleteQuickAction(unit.id, a.id)} className="text-[#5a1c1c]">🗑</button>
        </div>
      ))}

      {showAdd ? (
        <div className="border border-[#3a332a] bg-[#0f0d0c] p-2 space-y-2">
          <input value={newAction.name} onChange={(e) => setNewAction({ ...newAction, name: e.target.value })} placeholder="Название" className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1" />
          <div className="flex gap-2">
            <input value={newAction.icon} onChange={(e) => setNewAction({ ...newAction, icon: e.target.value })} className="w-12 bg-[#161412] border border-[#3a332a] px-2 py-1 text-center" />
            <input value={newAction.diceFormula} onChange={(e) => setNewAction({ ...newAction, diceFormula: e.target.value })} placeholder="1d20+5" className="flex-1 bg-[#161412] border border-[#3a332a] px-2 py-1" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 py-1 bg-[#1a2a15] border border-[#2e5a1c] text-[#a0d090]">✓</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 py-1 bg-[#2a1515] border border-[#5a1c1c] text-[#d09090]">✕</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="w-full py-1.5 border border-dashed border-[#3a332a] text-[#4a433a] hover:text-[#7a6f62]">+ Создать действие</button>
      )}
    </div>
  );
}

/* ═══════════════════════ SETTINGS TAB ═══════════════════════ */
function SettingsTab() {
  const { units, addUnit, deleteUnit, updateUnit, settings, updateSettings, logs } = useGameStore();
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [showNewUnit, setShowNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  const createUnit = () => {
    if (!newUnitName.trim()) return;
    addUnit({
      name: newUnitName, shortName: newUnitName, googleDocsHeader: newUnitName,
      health: { current: 100, max: 100 }, mana: { current: 50, max: 50 },
      stats: { physicalPower: 1, dexterity: 1, intelligence: 1, vitality: 1, charisma: 1, initiative: 1 },
      proficiencies: { swords: 0, axes: 0, hammers: 0, polearms: 0, unarmed: 0, bows: 0 },
      magicBonuses: {}, weapons: [], spells: [], resources: [], quickActions: [],
    });
    setNewUnitName('');
    setShowNewUnit(false);
  };

  if (editingUnit) {
    return <UnitEditor unit={editingUnit} onClose={() => setEditingUnit(null)} />;
  }

  return (
    <div className="space-y-3">
      <Section title="👥 ЮНИТЫ">
        {units.map((u) => (
          <div key={u.id} className="flex items-center gap-2 p-2 bg-[#0f0d0c] border border-[#3a332a] mb-1">
            <span className="flex-1">{u.name}</span>
            <button onClick={() => setEditingUnit(u)} className="text-[#7a6f62] hover:text-[#d4c8b8]">✏</button>
            <button onClick={() => deleteUnit(u.id)} className="text-[#5a1c1c] hover:text-[#8b0000]">🗑</button>
          </div>
        ))}
        {showNewUnit ? (
          <div className="flex gap-2">
            <input value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="Имя" className="flex-1 bg-[#161412] border border-[#3a332a] px-2 py-1" onKeyDown={(e) => e.key === 'Enter' && createUnit()} />
            <button onClick={createUnit} className="px-2 bg-[#1a2a15] border border-[#2e5a1c] text-[#a0d090]">✓</button>
            <button onClick={() => setShowNewUnit(false)} className="px-2 bg-[#2a1515] border border-[#5a1c1c] text-[#d09090]">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowNewUnit(true)} className="w-full py-1.5 border border-dashed border-[#3a332a] text-[#4a433a]">+ Добавить юнита</button>
        )}
      </Section>

      <Section title="🔗 СИНХРОНИЗАЦИЯ">
        <input
          value={settings.webAppUrl}
          onChange={(e) => updateSettings({ webAppUrl: e.target.value })}
          placeholder="https://script.google.com/macros/s/..."
          className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1 text-[10px]"
        />
      </Section>

      <Section title="📜 ЛОГИ">
        <div className="max-h-32 overflow-y-auto text-[10px] text-[#7a6f62] space-y-0.5">
          {logs.length === 0 ? <div>Пусто</div> : logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </Section>
    </div>
  );
}

/* ═══════════════════════ UNIT EDITOR ═══════════════════════ */
function UnitEditor({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const { updateUnit, addWeapon, deleteWeapon, addSpell, deleteSpell } = useGameStore();
  const [tab, setTab] = useState<'stats' | 'weapons' | 'spells' | 'magic'>('stats');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#ffd700] font-bold">{unit.name}</span>
        <button onClick={onClose} className="text-[#7a6f62]">✕ Закрыть</button>
      </div>

      <div className="flex gap-1 text-[10px]">
        {(['stats', 'weapons', 'spells', 'magic'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-1 border ${tab === t ? 'border-[#d4a726] text-[#ffd700]' : 'border-[#3a332a] text-[#4a433a]'}`}>
            {t === 'stats' ? '📊' : t === 'weapons' ? '⚔️' : t === 'spells' ? '✨' : '🔮'}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-[#7a6f62]">HP Max</label>
              <input type="number" value={unit.health.max} onChange={(e) => updateUnit(unit.id, { health: { ...unit.health, max: +e.target.value } })} className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1" />
            </div>
            <div>
              <label className="text-[9px] text-[#7a6f62]">Мана Max</label>
              <input type="number" value={unit.mana.max} onChange={(e) => updateUnit(unit.id, { mana: { ...unit.mana, max: +e.target.value } })} className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1" />
            </div>
          </div>
          <div className="text-[9px] text-[#d4a726] mt-2">Характеристики:</div>
          <div className="grid grid-cols-3 gap-1">
            {Object.entries(unit.stats).map(([k, v]) => (
              <div key={k}>
                <label className="text-[8px] text-[#7a6f62]">{k.slice(0, 4)}</label>
                <input type="number" value={v} onChange={(e) => updateUnit(unit.id, { stats: { ...unit.stats, [k]: +e.target.value } })} className="w-full bg-[#161412] border border-[#3a332a] px-1 py-0.5 text-center" />
              </div>
            ))}
          </div>
          <div className="text-[9px] text-[#d4a726] mt-2">Владение оружием:</div>
          <div className="grid grid-cols-3 gap-1">
            {Object.entries(unit.proficiencies).map(([k, v]) => (
              <div key={k}>
                <label className="text-[8px] text-[#7a6f62]">{PROFICIENCY_NAMES[k as ProficiencyType]?.slice(0, 4)}</label>
                <input type="number" value={v} onChange={(e) => updateUnit(unit.id, { proficiencies: { ...unit.proficiencies, [k]: +e.target.value } })} className="w-full bg-[#161412] border border-[#3a332a] px-1 py-0.5 text-center" />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'weapons' && (
        <div className="space-y-2">
          {unit.weapons.map((w) => (
            <div key={w.id} className="p-2 bg-[#0f0d0c] border border-[#3a332a] flex justify-between items-center">
              <div>
                <div className="text-[#d4a726]">{w.name}</div>
                <div className="text-[10px] text-[#7a6f62]">{w.damageFormula} • {PROFICIENCY_NAMES[w.proficiencyType]}</div>
              </div>
              <button onClick={() => deleteWeapon(unit.id, w.id)} className="text-[#5a1c1c]">🗑</button>
            </div>
          ))}
          <WeaponForm onAdd={(w) => addWeapon(unit.id, w)} />
        </div>
      )}

      {tab === 'spells' && (
        <div className="space-y-2">
          {unit.spells.map((s) => (
            <div key={s.id} className="p-2 bg-[#0f0d0c] border border-[#3a332a] flex justify-between items-center">
              <div>
                <div className="text-[#d4a726]">{s.name}</div>
                <div className="text-[10px] text-[#7a6f62]">{s.manaCost}💠 • {s.elements.join(', ')}</div>
              </div>
              <button onClick={() => deleteSpell(unit.id, s.id)} className="text-[#5a1c1c]">🗑</button>
            </div>
          ))}
          <SpellForm onAdd={(s) => addSpell(unit.id, s)} />
        </div>
      )}

      {tab === 'magic' && (
        <div className="space-y-2">
          <div className="text-[9px] text-[#7a6f62]">Бонусы к элементам (название:бонус)</div>
          <textarea
            value={Object.entries(unit.magicBonuses).map(([k, v]) => `${k}:${v}`).join('\n')}
            onChange={(e) => {
              const bonuses: Record<string, number> = {};
              e.target.value.split('\n').forEach((line) => {
                const [k, v] = line.split(':');
                if (k && v) bonuses[k.trim()] = +v;
              });
              updateUnit(unit.id, { magicBonuses: bonuses });
            }}
            placeholder="Астрал:3&#10;Жизнь:2"
            className="w-full h-24 bg-[#161412] border border-[#3a332a] px-2 py-1 text-[11px]"
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ FORMS ═══════════════════════ */
function WeaponForm({ onAdd }: { onAdd: (w: Omit<Weapon, 'id'>) => void }) {
  const [show, setShow] = useState(false);
  const [data, setData] = useState({ name: '', damageFormula: '1d8', damageType: 'slashing' as DamageType, proficiencyType: 'swords' as ProficiencyType, statBonus: 'physicalPower' as StatType });

  if (!show) return <button onClick={() => setShow(true)} className="w-full py-1 border border-dashed border-[#3a332a] text-[#4a433a] text-[11px]">+ Добавить оружие</button>;

  return (
    <div className="p-2 bg-[#0a0806] border border-[#3a332a] space-y-1">
      <input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="Название" className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1 text-[11px]" />
      <input value={data.damageFormula} onChange={(e) => setData({ ...data, damageFormula: e.target.value })} placeholder="3d6+5" className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1 text-[11px]" />
      <select value={data.proficiencyType} onChange={(e) => setData({ ...data, proficiencyType: e.target.value as ProficiencyType })} className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1 text-[11px]">
        {Object.entries(PROFICIENCY_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <div className="flex gap-1">
        <button onClick={() => { onAdd(data); setShow(false); setData({ name: '', damageFormula: '1d8', damageType: 'slashing', proficiencyType: 'swords', statBonus: 'physicalPower' }); }} className="flex-1 py-1 bg-[#1a2a15] border border-[#2e5a1c] text-[#a0d090] text-[11px]">✓</button>
        <button onClick={() => setShow(false)} className="flex-1 py-1 bg-[#2a1515] border border-[#5a1c1c] text-[#d09090] text-[11px]">✕</button>
      </div>
    </div>
  );
}

function SpellForm({ onAdd }: { onAdd: (s: Omit<Spell, 'id'>) => void }) {
  const [show, setShow] = useState(false);
  const [data, setData] = useState({ name: '', manaCost: 20, elements: '', damageFormula: '', projectiles: 1, type: 'targeted' as const });

  if (!show) return <button onClick={() => setShow(true)} className="w-full py-1 border border-dashed border-[#3a332a] text-[#4a433a] text-[11px]">+ Добавить заклинание</button>;

  return (
    <div className="p-2 bg-[#0a0806] border border-[#3a332a] space-y-1">
      <input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="Название" className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1 text-[11px]" />
      <div className="flex gap-1">
        <input type="number" value={data.manaCost} onChange={(e) => setData({ ...data, manaCost: +e.target.value })} placeholder="Мана" className="w-16 bg-[#161412] border border-[#3a332a] px-2 py-1 text-[11px]" />
        <input value={data.elements} onChange={(e) => setData({ ...data, elements: e.target.value })} placeholder="Огонь,Тьма" className="flex-1 bg-[#161412] border border-[#3a332a] px-2 py-1 text-[11px]" />
      </div>
      <input value={data.damageFormula} onChange={(e) => setData({ ...data, damageFormula: e.target.value })} placeholder="2d10+5 (урон)" className="w-full bg-[#161412] border border-[#3a332a] px-2 py-1 text-[11px]" />
      <div className="flex gap-1">
        <button onClick={() => { onAdd({ ...data, elements: data.elements.split(',').map((s) => s.trim()) }); setShow(false); }} className="flex-1 py-1 bg-[#1a2a15] border border-[#2e5a1c] text-[#a0d090] text-[11px]">✓</button>
        <button onClick={() => setShow(false)} className="flex-1 py-1 bg-[#2a1515] border border-[#5a1c1c] text-[#d09090] text-[11px]">✕</button>
      </div>
    </div>
  );
}

/* ═══════════════════════ HELPERS ═══════════════════════ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[10px] text-[#d4a726] uppercase tracking-wider font-bold mb-2">
        {title}<div className="flex-1 h-px bg-[#3a332a]" />
      </div>
      {children}
    </div>
  );
}

function NoUnit() {
  return <div className="text-center text-[#4a433a] py-8">Добавьте юнита в настройках</div>;
}
