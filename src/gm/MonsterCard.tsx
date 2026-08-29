import { useState, useRef, useEffect } from 'react';
import type { Monster, MonsterWeapon } from '../stores/monsterStore';
import { useMonsterStore } from '../stores/monsterStore';
import { getGroupColor } from './RegistrationModal';
import { ELEMENT_NAMES_MAP } from '../constants/elements';
import { SpellEditorModal } from '../components/spell-editor';
import type { DamageType, SpellV2 } from '../types';

interface Props {
  monster: Monster;
  selected: boolean;
  onToggle: (id: string) => void;
  onUpdate: (id: string, fields: Partial<Pick<Monster, 'name' | 'hp' | 'maxHp' | 'group' | 'armor' | 'notes'>>) => void;
  /** Последняя строка в своей секции — ⋮-меню открывается вверх, чтобы не обрезаться */
  isLast?: boolean;
  onRemove: (id: string) => void;
  onAttack?: (monster: Monster, weapon: MonsterWeapon | null) => void;
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

function NumericInput({ value, onChange, min = 0, allowNegative = false, className = '' }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  allowNegative?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(String(value)); }, [value]);

  const commit = () => {
    const n = parseInt(text, 10);
    if (isNaN(n) || (!allowNegative && n < min)) setText(String(value));
    else onChange(n);
  };

  return (
    <input ref={ref} type="text" inputMode={allowNegative ? 'text' : 'numeric'} value={text}
      onChange={(e) => setText(
        allowNegative
          ? e.target.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '')
          : e.target.value.replace(/[^0-9]/g, '')
      )}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { commit(); ref.current?.blur(); } }}
      className={`bg-[#1a1a2a] border border-[#2a2a3a] rounded px-1.5 py-0.5 text-bone text-[10px] font-sans focus:border-gold-dark focus:outline-none ${className}`}
    />
  );
}

/**
 * Иконка сердца: сплошная заливка цветом статуса (не outline); при HP <= 0 —
 * серое «разбитое» сердце с трещиной. Инлайн-SVG — без внешних библиотек иконок.
 */
function HeartIcon({ color, dead }: { color: string; dead: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" className="shrink-0" aria-hidden>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={dead ? '#3a3a3a' : color}
      />
      {dead && (
        <path d="M12 5.5 L10.4 9.5 L13.2 12.5 L11 17" stroke="#0a0a0f" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Выпадающее меню с position: fixed — рендерится вне DOM-иерархии карточки,
 * поэтому не обрезается overflow:hidden родительских контейнеров.
 * Позиция вычисляется относительно кнопки-якоря.
 */
function FixedMenu({ anchorRef, isLast, onClose, onNotes, onSettings, onDuplicate, onRemove }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  isLast?: boolean;
  onClose: () => void;
  onNotes: () => void;
  onSettings: () => void;
  onDuplicate?: () => void;
  onRemove: () => void;
}) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  useEffect(() => {
    const btn = anchorRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    if (isLast) {
      setPos({ bottom: window.innerHeight - rect.top + 4, right });
    } else {
      setPos({ top: rect.bottom + 4, right });
    }
  }, [anchorRef, isLast]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [anchorRef, onClose]);

  if (!pos) return null;

  return (
    <div
      className="fixed z-50 w-40 bg-[#111118] border border-[#2a2a3a] rounded-lg shadow-xl overflow-hidden"
      style={pos}
    >
      <button onClick={onNotes}
        className="w-full px-3 py-1.5 text-left text-[11px] text-bone hover:bg-[#1a1a2a] transition-colors">📝 Заметки</button>
      <button onClick={onSettings}
        className="w-full px-3 py-1.5 text-left text-[11px] text-bone hover:bg-[#1a1a2a] transition-colors">⚙ Настройки</button>
      {onDuplicate && (
        <button onClick={onDuplicate}
          className="w-full px-3 py-1.5 text-left text-[11px] text-bone hover:bg-[#1a1a2a] transition-colors">📋 Копировать</button>
      )}
      <button onClick={onRemove}
        className="w-full px-3 py-1.5 text-left text-[11px] text-blood-bright hover:bg-blood-dark/30 transition-colors border-t border-[#2a2a3a]/60">🗑 Удалить</button>
    </div>
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

/**
 * Буферизованная textarea заметок: коммит в стор по blur — набор текста
 * не дёргает перерисовку списка.
 */
function NotesInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      placeholder="Заметки ГМа о монстре..."
      className="w-full h-20 bg-[#0d0d14] border border-[#2a2a3a] rounded px-2 py-1.5 text-bone text-[11px] font-garamond placeholder:text-faded/50 focus:border-gold-dark focus:outline-none resize-none"
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

export function MonsterCard({ monster, selected, onToggle, onUpdate, onRemove, onAttack, onDuplicate, isLast }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'notes' | 'armor' | 'stats' | 'weapons' | 'spells'>('armor');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingSpell, setEditingSpell] = useState<SpellV2 | null>(null);
  const [isCreatingSpell, setIsCreatingSpell] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const { tokenId, name, hp, maxHp, group, armor, stats, weapons } = monster;
  const notes = monster.notes ?? '';

  // 🔧 Универсальные статусные цвета HP (НЕ золотые): зелёный >50%, жёлтый 25–50%, красный <25%
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const isDead = hp <= 0;
  const statusColor = isDead ? '#4a4a4a' : pct > 50 ? '#22c55e' : pct >= 25 ? '#eab308' : '#ef4444';

  

  const openSettings = (tab: 'notes' | 'armor' | 'stats' | 'weapons' | 'spells') => {
    setSettingsTab(tab);
    setShowSettings(true);
    setMenuOpen(false);
  };

  const handleAddWeapon = () => {
    const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    useMonsterStore.getState().addWeapon(tokenId, {
      id, name: 'Оружие', damageFormula: '1d6', damageType: 'slashing', hitBonus: 0,
      weaponType: 'melee' as const,
    });
  };

  const handleAddSpell = () => {
    // 🔧 Открываем полноценный редактор заклинаний (как у игроков)
    setEditingSpell(null);
    setIsCreatingSpell(true);
  };

  const handleEditSpell = (s: SpellV2) => {
    setEditingSpell(s);
    setIsCreatingSpell(false);
  };

  const handleSaveSpell = (sp: SpellV2) => {
    if (editingSpell) {
      useMonsterStore.getState().updateSpell(tokenId, sp);
    } else {
      useMonsterStore.getState().addSpell(tokenId, sp);
    }
    setEditingSpell(null);
    setIsCreatingSpell(false);
  };

  return (
    <div className={`transition-colors ${selected ? 'bg-[#1a1a2a]/70' : 'hover:bg-[#15151f]/70'} ${isDead ? 'opacity-50' : ''}`}>
      {/* Main row — плотная строка, границы даёт divide-y родительского списка */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
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

          {/* HP: сердце + компактный бар (60px) + current/max (цифры — plain sans) */}
          <div className="flex items-center gap-1.5 mt-1">
            <svg width="12" height="12" viewBox="0 0 24 24" className="shrink-0" aria-hidden
              style={{ filter: isDead ? 'none' : `drop-shadow(0 0 2px ${statusColor}88)` }}>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill={isDead ? '#3a3a3a' : statusColor}
              />
              {isDead && (
                <path d="M12 5.5 L10.4 9.5 L13.2 12.5 L11 17" stroke="#0a0a0f" strokeWidth="1.7" fill="none" strokeLinecap="round" />
              )}
            </svg>
            <div className="w-[60px] h-[6px] bg-black/70 rounded-full overflow-hidden shrink-0 border border-black/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]">
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(180deg, ${statusColor}cc 0%, ${statusColor} 55%, ${statusColor}99 100%)`,
                  boxShadow: isDead ? 'none' : `0 0 4px ${statusColor}66`,
                }} />
            </div>
            <span className="text-[10px] font-sans shrink-0" style={{ color: isDead ? '#8a8a8a' : statusColor }}>
              <span className="font-semibold">{hp}</span><span className="text-faded">/{maxHp}</span>
            </span>
          </div>
        </div>

        {/* Actions: Атака (всегда видима) + ⋮ Ещё */}
        <div className="flex items-center gap-0.5 shrink-0 relative">
          <button onClick={() => { if (weapons.length > 0 || monster.spells.length > 0) onAttack?.(monster, weapons[0] ?? null); }}
            disabled={weapons.length === 0 && monster.spells.length === 0}
            className={`w-6 h-6 flex items-center justify-center text-[11px] rounded transition-colors ${
              weapons.length === 0 && monster.spells.length === 0
                ? 'text-faded/30 cursor-not-allowed'
                : 'text-blood-bright/80 hover:text-blood-bright hover:bg-blood-dark/30'
            }`}
            title={weapons.length > 0 ? `Атака: ${weapons[0].name}` : monster.spells.length > 0 ? 'Каст / прокидки' : 'Нет оружия'}>
            ⚔
          </button>
          <button onClick={() => setMenuOpen(v => !v)}
            ref={menuBtnRef}
            className={`w-6 h-6 flex items-center justify-center text-[13px] leading-none rounded transition-colors ${menuOpen ? 'text-gold bg-gold-dark/20' : 'text-faded hover:text-bone hover:bg-[#1a1a2a]'}`}
            title="Ещё">
            ⋮
          </button>
        </div>
      </div>

      {/* Выпадающее меню — position: fixed, не обрезается overflow родителей */}
      {menuOpen && (
        <FixedMenu
          anchorRef={menuBtnRef}
          isLast={isLast}
          onClose={() => setMenuOpen(false)}
          onNotes={() => openSettings('notes')}
          onSettings={() => openSettings('armor')}
          onDuplicate={onDuplicate ? () => { setMenuOpen(false); onDuplicate(tokenId); } : undefined}
          onRemove={() => { setMenuOpen(false); onRemove(tokenId); }}
        />
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-[#1a1a2a]/50 space-y-2">
          {/* Basic row */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] text-faded uppercase tracking-wider">Тек. HP</label>
              <NumericInput value={hp} allowNegative
                onChange={(v) => onUpdate(tokenId, { hp: v })}
                className="w-full mt-0.5" />
            </div>
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
          </div>

          <div>
            <label className="text-[9px] text-faded uppercase tracking-wider">Группа</label>
            <BufferedInput
              value={group}
              onCommit={(v) => onUpdate(tokenId, { group: v })}
              placeholder="—"
              className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1 text-bone text-[10px] focus:border-gold-dark focus:outline-none mt-0.5" />
          </div>

          {/* Tab buttons */}
          <div className="flex gap-1">
            {(['notes', 'armor', 'stats', 'weapons', 'spells'] as const).map(tab => (
              <button key={tab} onClick={() => setSettingsTab(tab)}
                className={`px-2 py-0.5 text-[9px] rounded font-cinzel transition-all ${
                  settingsTab === tab
                    ? 'bg-gold-dark/20 text-gold border border-gold-dark/30'
                    : 'text-faded hover:text-bone border border-transparent'
                }`}>
                {tab === 'notes' ? '📝 Заметки' : tab === 'armor' ? '🛡 Броня' : tab === 'stats' ? '📊 Хар-ки' : tab === 'weapons' ? '⚔ Оружие' : '✨ Заклинания'}
              </button>
            ))}
          </div>

          {/* Notes tab */}
          {settingsTab === 'notes' && (
            <NotesInput value={notes} onCommit={(v) => onUpdate(tokenId, { notes: v })} />
          )}

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
                    <span className="text-[10px] shrink-0 cursor-help"
                      title={(w.weaponType ?? 'melee') === 'melee' ? 'Ближнее: урон +5×физ.сила' : 'Дальнее: урон +3×ловкость (ловкость НЕ даёт бонуса к попаданию)'}>
                      {(w.weaponType ?? 'melee') === 'melee' ? '🗡' : '🏹'}
                    </span>
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
                  </div>
                  <div className="flex items-center gap-1">
                    <select value={w.weaponType ?? 'melee'}
                      onChange={(e) => useMonsterStore.getState().updateWeapon(tokenId, w.id, { weaponType: e.target.value as 'melee' | 'ranged' })}
                      className="flex-1 bg-[#1a1a2a] border border-[#2a2a3a] rounded px-1 py-0.5 text-bone text-[9px] focus:border-gold-dark focus:outline-none"
                      title="Ближнее: урон +5×физ.сила · Дальнее: урон +3×ловкость (ловкость НЕ даёт бонуса к попаданию)">
                      <option value="melee">🗡 Ближнее (+5×ФС)</option>
                      <option value="ranged">🏹 Дальнее (+3×ЛОВ)</option>
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

          {/* Spells tab */}
          {settingsTab === 'spells' && (
            <div className="space-y-1.5">
              {monster.spells.length === 0 && (
                <div className="text-[10px] text-faded text-center py-2">Нет заклинаний</div>
              )}
              {monster.spells.map(s => (
                <div key={s.id} className="bg-[#0d0d14] rounded p-2 flex items-center gap-1 border border-[#1a1a2a]/30">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-bone font-cinzel truncate">{s.name}</div>
                    <div className="text-[9px] text-faded">{s.actions?.length ?? 0} шагов · {s.elements?.length ? s.elements.join(', ') : 'без элементов'}</div>
                  </div>
                  <button onClick={() => handleEditSpell(s)}
                    className="px-1.5 py-0.5 text-[9px] text-faded hover:text-gold border border-[#2a2a3a] rounded hover:border-gold-dark/40 transition-colors shrink-0"
                    title="Редактировать заклинание">✏️</button>
                  {onAttack && (
                    <button onClick={() => onAttack(monster, null)}
                      className="px-2 py-0.5 text-[9px] bg-[#1a2a4a]/60 text-[#7aa2ff] border border-[#2244aa]/40 rounded hover:bg-[#1a2a4a] transition-colors font-cinzel shrink-0">
                      ✨ Каст
                    </button>
                  )}
                  <button onClick={() => useMonsterStore.getState().removeSpell(tokenId, s.id)}
                    className="text-[9px] text-faded hover:text-blood-bright px-1 shrink-0">✕</button>
                </div>
              ))}
              <button onClick={handleAddSpell}
                className="w-full py-1 text-[9px] text-gold/70 hover:text-gold border border-dashed border-[#2a2a3a] hover:border-gold-dark/30 rounded transition-colors font-cinzel">
                + Добавить заклинание
              </button>
            </div>
          )}

          {/* 🔧 Полноценный редактор заклинаний (как у игроков) */}
          <SpellEditorModal
            isOpen={editingSpell !== null || isCreatingSpell}
            onClose={() => { setEditingSpell(null); setIsCreatingSpell(false); }}
            spell={editingSpell}
            onSave={handleSaveSpell}
          />
        </div>
      )}
    </div>
  );
}
