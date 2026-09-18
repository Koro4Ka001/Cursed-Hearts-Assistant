import { useState, useRef, useEffect, useCallback } from 'react';

interface TokenInfo {
  tokenId: string;
  defaultName: string;
}

interface Props {
  tokens: TokenInfo[];
  existingGroups: string[];
  onConfirm: (entries: { tokenId: string; name: string; maxHp: number; group: string }[]) => void;
  onClose: () => void;
}

const GROUP_COLORS = [
  'bg-red-900/60 text-red-300 border-red-700/50',
  'bg-blue-900/60 text-blue-300 border-blue-700/50',
  'bg-green-900/60 text-green-300 border-green-700/50',
  'bg-purple-900/60 text-purple-300 border-purple-700/50',
  'bg-amber-900/60 text-amber-300 border-amber-700/50',
  'bg-cyan-900/60 text-cyan-300 border-cyan-700/50',
  'bg-pink-900/60 text-pink-300 border-pink-700/50',
  'bg-orange-900/60 text-orange-300 border-orange-700/50',
];

export function getGroupColor(group: string): string {
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = ((hash << 5) - hash + group.charCodeAt(i)) | 0;
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

function NumericInput({ value, onChange, min = 1, className = '' }: {
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
    if (isNaN(n) || n < min) {
      setText(String(value));
    } else {
      onChange(n);
    }
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9]/g, '');
        setText(v);
      }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { commit(); ref.current?.blur(); } }}
      className={`bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1 text-bone text-xs font-mono focus:border-gold-dark focus:outline-none ${className}`}
    />
  );
}

function GroupInput({ value, onChange, existingGroups, className = '' }: {
  value: string;
  onChange: (v: string) => void;
  existingGroups: string[];
  className?: string;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = value
    ? existingGroups.filter(g => g.toLowerCase().includes(value.toLowerCase()) && g !== value)
    : existingGroups;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        placeholder="Без группы"
        className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1 text-bone text-xs focus:border-gold-dark focus:outline-none"
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded max-h-20 overflow-y-auto shadow-lg">
          {filtered.map(g => (
            <button
              key={g}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(g);
                setShowSuggestions(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-faded hover:bg-[#2a2a3a] hover:text-bone"
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RegistrationModal({ tokens, existingGroups, onConfirm, onClose }: Props) {
  const [entries, setEntries] = useState(() =>
    tokens.map(t => ({ tokenId: t.tokenId, name: t.defaultName, maxHp: 50, group: '' }))
  );
  const [commonGroup, setCommonGroup] = useState('');
  const [groupApplied, setGroupApplied] = useState(false);

  const update = (idx: number, field: string, value: string | number) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const applyGroupToAll = useCallback(() => {
    setEntries(prev => prev.map(e => ({ ...e, group: commonGroup })));
    setGroupApplied(true);
    setTimeout(() => setGroupApplied(false), 1500);
  }, [commonGroup]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d0d14] border border-[#1a1a2a] rounded-xl w-[420px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#1a1a2a]">
          <h3 className="font-cinzel text-sm text-gold tracking-wider">☠️ Добавить монстров</h3>
          <p className="text-[11px] text-faded mt-1">{tokens.length} токен(ов) выбрано</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-faded uppercase tracking-wider font-cinzel">Группа для всех</label>
            <div className="flex gap-2">
              <GroupInput
                value={commonGroup}
                onChange={setCommonGroup}
                existingGroups={existingGroups}
                className="flex-1"
              />
              <button
                onClick={applyGroupToAll}
                disabled={!commonGroup.trim()}
                className={`px-3 py-1 text-[10px] rounded font-cinzel transition-all shrink-0 ${
                  groupApplied
                    ? 'bg-green-900/50 text-green-400 border border-green-800/50'
                    : commonGroup.trim()
                    ? 'bg-gold-dark/30 text-gold border border-gold-dark/50 hover:bg-gold-dark/50'
                    : 'bg-[#1a1a2a] text-faded/50 border border-transparent cursor-not-allowed'
                }`}
              >
                {groupApplied ? '✓ Применено' : 'Применить'}
              </button>
            </div>
          </div>

          <div className="h-px bg-[#1a1a2a]" />

          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <div key={entry.tokenId} className="bg-[#111118] rounded-lg p-3 space-y-2 border border-[#1a1a2a]/50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-faded font-mono w-16 truncate">{entry.tokenId.slice(0, 8)}...</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[9px] text-faded uppercase tracking-wider">Имя</label>
                    <input type="text" value={entry.name}
                      onChange={(e) => update(idx, 'name', e.target.value)}
                      className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1 text-bone text-xs focus:border-gold-dark focus:outline-none mt-0.5" />
                  </div>
                  <div>
                    <label className="text-[9px] text-faded uppercase tracking-wider">HP</label>
                    <NumericInput value={entry.maxHp} min={1}
                      onChange={(v) => update(idx, 'maxHp', v)}
                      className="w-full mt-0.5" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-faded uppercase tracking-wider">Группа</label>
                  <GroupInput
                    value={entry.group}
                    onChange={(v) => update(idx, 'group', v)}
                    existingGroups={existingGroups}
                    className="mt-0.5"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#1a1a2a] flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs text-faded border border-[#2a2a3a] rounded-lg hover:bg-[#1a1a2a] font-cinzel transition-colors">
            Отмена
          </button>
          <button onClick={() => {
            // 🔧 Если «Группа для всех» введена, но кнопка «Применить» не нажималась,
            // подставляем её как значение по умолчанию для записей с пустой группой.
            // Индивидуально указанные группы имеют приоритет.
            const cg = commonGroup.trim();
            onConfirm(entries.map(e => (e.group.trim() ? e : { ...e, group: cg })));
          }}
            className="flex-1 py-2 text-xs text-gold bg-gold-dark/30 border border-gold-dark/50 rounded-lg hover:bg-gold-dark/50 font-cinzel transition-colors">
            Добавить ({entries.length})
          </button>
        </div>
      </div>
    </div>
  );
}
