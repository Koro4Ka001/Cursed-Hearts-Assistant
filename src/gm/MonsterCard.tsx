import { useState, useRef, useEffect } from 'react';
import type { Monster, MonsterWeapon } from '../stores/monsterStore';
import { useMonsterStore } from '../stores/monsterStore';
import { getGroupColor } from './RegistrationModal';
import { ELEMENT_NAMES_MAP } from '../constants/elements';
import type { DamageType } from '../types';

interface Props {
  monster: Monster;
  selected: boolean;
  onToggle: (id: string) => void;
  onUpdate: (id: string, fields: Partial<Pick<Monster, 'name' | 'hp' | 'maxHp' | 'group' | 'armor'>>) => void;
  onRemove: (id: string) => void;
  onAttack?: (monster: Monster, weapon: MonsterWeapon) => void;
  onDuplicate?: (tokenId: string) => void;
}

function InlineInput({ value, onChange, className = '' }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(value); }, [value]);

  if (!editing) {
    return (
      <span onDoubleClick={() => { setEditing(true); setText(value); }}
        className={`cursor-pointer hover:text-gold transition-colors select-none ${className}`}>
        {value || 'Без имени'}
      </span>
    );
  }

  return (
    <input ref={ref} type="text" value={text}
      autoFocus
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { setEditing(false); if (text.trim()) onChange(text.trim()); else setText(value); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') ref.current?.blur();
        if (e.key === 'Escape') { setEditing(false); setText(value); }
      }}
      className={`bg-[#1a1a2a] border border-gold-dark/50 rounded px-1 py-0 text-bone text-xs focus:outline-none w-full ${className}`}
    />
  );
}

function NumericInput({ value, onChange, min = 0, className = '' }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(String(value)); }, [value]);

  const commit = () => {
    const n = parseInt(text, 10);
    if (isNaN(n) || n < min) setText(String(value));
    else onChange(n);
  };

  return (
    <input ref={ref} type="text" inputMode="numeric" value={text}
      onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { commit(); ref.current?.blur(); } }}
      className={`bg-[#1a1a2a] border border-[#2a2a3a] rounded px-1.5 py-0.5 text-bone text-[10px] font-mono focus:border-gold-dark focus:outline-none ${className}`}
    />
  );
}

/**
 * 🔧 Буферизованный текстовый инпут: пишет в стор только по blur/Enter, а не на
 * каждый символ. Нужен для поля «Группа»: живая запись в стор заставляла
 * GMDashboard перегруппировывать карточки во время набора, инпут переезжал между
 * DOM-контейнерами секций и терял фокус после каждого символа.
 */
function BufferedInput({ value, onCommit, placeholder, className = '' }: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(value); }, [value]);

  return (
    <input ref={ref} type="text" value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text.trim())}
      onKeyDown={(e) => { if (e.key === 'Enter') ref.current?.blur(); }}
      placeholder={placeholder}
      className={className}
    />
  );
}

const STAT_LABELS: Record<string, string> = {
  physicalPower: 'Физ. сила',
  dexterity: 'Ловкость',
  vitality: 'Живучесть',
  intelligence: 'Интеллект',
  charisma: 'Харизма',
  initiative: 'Инициатива',
};

const STAT_ICONS: Record<string, string> = {
  physicalPower: '⚔',
  dexterity: '💨',
  vitality: '❤',
  intelligence: '🧠',
  charisma: '✨',
  initiative: '⚡',
};

const ALL_DAMAGE_TYPES: DamageType[] = [
  'slashing', 'piercing', 'bludgeoning', 'chopping',
  'огонь', 'вода', 'земля', 'воздух', 'свет', 'тьма',
  'пространство', 'астрал', 'скверна', 'электричество', 'пустота', 'жизнь',
  'смерть', 'pure',
];

export function MonsterCard({ monster, selected, onToggle, onUpdate, onRemove, onAttack, onDuplicate }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'armor' | 'stats' | 'weapons'>('armor');
  const { tokenId, name, hp, maxHp, group, armor, stats, weapons } = monster;

  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const isDead = hp <= 0;
  const isLow = pct <= 25 && !isDead;
  const hpColor = isDead ? '#333333' : isLow ? '#ff0000' : pct < 50 ? '#aa4400' : '#cc2222';

  const handleAddWeapon = () => {
    const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    useMonsterStore.getState().addWeapon(tokenId, {
      id, name: 'Оружие', damageFormula: '1d6', damageType: 'slashing', hitBonus: 0,
    });
  };

  return (
    <div className={`rounded-lg border transition-all ${selected ? 'bg-[#1a1a2a] border-gold-dark/40' : 'bg-[#111118] border-[#1a1a2a]/50 hover:border-[#2a2a3a]'} ${isDead ? 'opacity-50' : ''}`}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <input type="checkbox" checked={selected}
          onChange={() => onToggle(tokenId)}
          className="w-3.5 h-3.5 accent-[#c9a84c] shrink-0 cursor-pointer" />

        <div className="flex-1 min-w-0">
          {/* Name + badges */}
          <div className="flex items-center gap-1.5 min-w-0">
            <InlineInput value={name}
              onChange={(v) => onUpdate(tokenId, { name: v })}
              className="text-xs font-cinzel truncate min-w-0" />
            {group && (
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-cinzel shrink-0 max-w-[80px] truncate ${getGroupColor(group)}`}>
                {group}
              </span>
            )}
            {armor > 0 && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-[#1a1a2a] text-faded border border-[#2a2a3a] shrink-0">
                🛡{armor}
              </span>
            )}
          </div>

          {/* HP bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <NumericInput value={hp} min={0}
              onChange={(v) => onUpdate(tokenId, { hp: v })}
              className="w-10 text-center shrink-0" />
            <div className="flex-1 h-[4px] bg-[#0a0505] rounded-full overflow-hidden min-w-0">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: hpColor }} />
            </div>
            <span className="text-[9px] text-faded font-mono shrink-0">/{maxHp}</span>
            {isDead && <span className="text-[10px] shrink-0">💀</span>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {onDuplicate && (
            <button onClick={() => onDuplicate(tokenId)}
              className="w-6 h-6 flex items-center justify-center text-[11px] text-faded hover:text-gold hover:bg-gold-dark/20 rounded transition-colors"
              title="Копировать">
              📋
            </button>
          )}
          {weapons.length > 0 && onAttack && (
            <button onClick={() => onAttack(monster, weapons[0])}
              className="w-6 h-6 flex items-center justify-center text-[11px] text-faded hover:text-blood-bright hover:bg-blood-dark/30 rounded transition-colors"
              title="Атака оружием">
              ⚔
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            className={`w-6 h-6 flex items-center justify-center text-[11px] rounded transition-colors ${showSettings ? 'text-gold bg-gold-dark/20' : 'text-faded hover:text-bone hover:bg-[#1a1a2a]'}`}>
            ⚙
          </button>
          <button onClick={() => onRemove(tokenId)}
            className="w-6 h-6 flex items-center justify-center text-[11px] text-faded hover:text-blood-bright hover:bg-blood-dark/30 rounded transition-colors">
            ✕
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-3 pb-3 pt-1 border-t border-[#1a1a2a]/50 space-y-2">
          {/* Basic row */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] text-faded uppercase tracking-wider">Макс. HP</label>
              <NumericInput value={maxHp} min={1}
                onChange={(v) => onUpdate(tokenId, { maxHp: v })}
                className="w-full mt-0.5" />
            </div>
            <div>
              <label className="text-[9px] text-faded uppercase tracking-wider">Броня</label>
              <NumericInput value={armor} min={0}
                onChange={(v) => onUpdate(tokenId, { armor: v })}
                className="w-full mt-0.5" />
            </div>
            <div>
              <label className="text-[9px] text-faded uppercase tracking-wider">Группа</label>
              <BufferedInput
                value={group}
                onCommit={(v) => onUpdate(tokenId, { group: v })}
                placeholder="—"
                className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1 text-bone text-[10px] focus:border-gold-dark focus:outline-none mt-0.5" />
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex gap-1">
            {(['armor', 'stats', 'weapons'] as const).map(tab => (
              <button key={tab} onClick={() => setSettingsTab(tab)}
                className={`px-2 py-0.5 text-[9px] rounded font-cinzel transition-all ${
                  settingsTab === tab
                    ? 'bg-gold-dark/20 text-gold border border-gold-dark/30'
                    : 'text-faded hover:text-bone border border-transparent'
                }`}>
                {tab === 'armor' ? '🛡 Броня' : tab === 'stats' ? '📊 Хар-ки' : '⚔ Оружие'}
              </button>
            ))}
          </div>

          {/* Armor tab */}
          {settingsTab === 'armor' && (
            <div className="space-y-1">
              {ALL_DAMAGE_TYPES.map(dt => (
                <div key={dt} className="flex items-center gap-2">
                  <span className="text-[9px] text-faded w-24 truncate">{ELEMENT_NAMES_MAP[dt] ?? dt}</span>
                  <NumericInput
                    value={monster.armorByType?.[dt] ?? 0}
                    min={0}
                    onChange={(v) => useMonsterStore.getState().setArmorByType(tokenId, dt, v)}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Stats tab */}
          {settingsTab === 'stats' && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {(Object.keys(STAT_LABELS) as Array<keyof typeof stats>).map(key => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-[9px]">{STAT_ICONS[key]}</span>
                  <span className="text-[9px] text-faded flex-1">{STAT_LABELS[key]}</span>
                  <NumericInput
                    value={stats[key]}
                    min={0}
                    onChange={(v) => useMonsterStore.getState().setStats(tokenId, { [key]: v })}
                    className="w-12 text-center"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Weapons tab */}
          {settingsTab === 'weapons' && (
            <div className="space-y-1.5">
              {weapons.map(w => (
                <div key={w.id} className="bg-[#0d0d14] rounded p-2 space-y-1 border border-[#1a1a2a]/30">
                  <div className="flex items-center gap-1">
                    <input type="text" value={w.name}
                      onChange={(e) => useMonsterStore.getState().updateWeapon(tokenId, w.id, { name: e.target.value })}
                      className="flex-1 bg-[#1a1a2a] border border-[#2a2a3a] rounded px-1.5 py-0.5 text-bone text-[10px] focus:border-gold-dark focus:outline-none"
                    />
                    <button onClick={() => useMonsterStore.getState().removeWeapon(tokenId, w.id)}
                      className="text-[9px] text-faded hover:text-blood-bright px-1">✕</button>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="text" value={w.damageFormula}
                      onChange={(e) => useMonsterStore.getState().updateWeapon(tokenId, w.id, { damageFormula: e.target.value })}
                      placeholder="2d6+3"
                      className="w-20 bg-[#1a1a2a] border border-[#2a2a3a] rounded px-1.5 py-0.5 text-bone text-[10px] font-mono focus:border-gold-dark focus:outline-none"
                    />
                    <select value={w.damageType}
                      onChange={(e) => useMonsterStore.getState().updateWeapon(tokenId, w.id, { damageType: e.target.value as DamageType })}
                      className="bg-[#1a1a2a] border border-[#2a2a3a] rounded px-1 py-0.5 text-bone text-[9px] focus:border-gold-dark focus:outline-none">
                      {ALL_DAMAGE_TYPES.map(dt => <option key={dt} value={dt}>{ELEMENT_NAMES_MAP[dt] ?? dt}</option>)}
                    </select>
                    <NumericInput value={w.hitBonus} min={-20}
                      onChange={(v) => useMonsterStore.getState().updateWeapon(tokenId, w.id, { hitBonus: v })}
                      className="w-10 text-center"
                    />
                    {onAttack && (
                      <button onClick={() => onAttack(monster, w)}
                        className="px-2 py-0.5 text-[9px] bg-blood-dark/30 text-blood-bright border border-blood/30 rounded hover:bg-blood-dark/50 font-cinzel transition-colors">
                        Атака
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={handleAddWeapon}
                className="w-full py-1 text-[9px] text-gold/70 hover:text-gold border border-dashed border-[#2a2a3a] hover:border-gold-dark/30 rounded transition-colors font-cinzel">
                + Добавить оружие
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
