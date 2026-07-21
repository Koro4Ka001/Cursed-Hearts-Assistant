import { useState, useRef, useEffect } from 'react';
import type { Monster } from '../stores/monsterStore';
import { getGroupColor } from './RegistrationModal';

interface Props {
  monster: Monster;
  selected: boolean;
  onToggle: (id: string) => void;
  onUpdate: (id: string, fields: Partial<Pick<Monster, 'name' | 'hp' | 'maxHp' | 'group'>>) => void;
  onRemove: (id: string) => void;
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

export function MonsterCard({ monster, selected, onToggle, onUpdate, onRemove }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const { tokenId, name, hp, maxHp, group } = monster;

  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const isDead = hp <= 0;
  const isLow = pct <= 25 && !isDead;

  const hpColor = isDead ? '#333333' : isLow ? '#ff0000' : pct < 50 ? '#aa4400' : '#cc2222';

  return (
    <div className={`rounded-lg border transition-all ${selected ? 'bg-[#1a1a2a] border-gold-dark/40' : 'bg-[#111118] border-[#1a1a2a]/50 hover:border-[#2a2a3a]'} ${isDead ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <input type="checkbox" checked={selected}
          onChange={() => onToggle(tokenId)}
          className="w-3.5 h-3.5 accent-[#c9a84c] shrink-0 cursor-pointer" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <InlineInput value={name}
              onChange={(v) => onUpdate(tokenId, { name: v })}
              className="text-xs font-cinzel truncate" />
            {group && (
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-cinzel shrink-0 ${getGroupColor(group)}`}>
                {group}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-faded font-mono w-12 text-right">{hp}/{maxHp}</span>
            <div className="flex-1 h-[4px] bg-[#0a0505] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: hpColor }} />
            </div>
            {isDead && <span className="text-[10px]">💀</span>}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => { const n = hp - 1; if (n >= 0) onUpdate(tokenId, { hp: n }); }}
            className="w-6 h-6 flex items-center justify-center text-[11px] text-faded hover:text-blood-bright hover:bg-blood-dark/30 rounded transition-colors">
            −
          </button>
          <NumericInput value={hp} min={0}
            onChange={(v) => onUpdate(tokenId, { hp: v })}
            className="w-10 text-center" />
          <button onClick={() => { const n = hp + 1; if (n <= maxHp) onUpdate(tokenId, { hp: n }); }}
            className="w-6 h-6 flex items-center justify-center text-[11px] text-faded hover:text-green-400 hover:bg-green-900/30 rounded transition-colors">
            +
          </button>
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

      {showSettings && (
        <div className="px-3 pb-3 pt-1 border-t border-[#1a1a2a]/50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-faded uppercase tracking-wider">Макс. HP</label>
              <NumericInput value={maxHp} min={1}
                onChange={(v) => onUpdate(tokenId, { maxHp: v })}
                className="w-full mt-0.5" />
            </div>
            <div>
              <label className="text-[9px] text-faded uppercase tracking-wider">Группа</label>
              <input type="text" value={group}
                onChange={(e) => onUpdate(tokenId, { group: e.target.value })}
                placeholder="Без группы"
                className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1 text-bone text-[10px] focus:border-gold-dark focus:outline-none mt-0.5" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
