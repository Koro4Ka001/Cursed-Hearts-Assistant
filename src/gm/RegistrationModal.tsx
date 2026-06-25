import { useState, useRef, useEffect } from 'react';

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

export function RegistrationModal({ tokens, existingGroups, onConfirm, onClose }: Props) {
  const [entries, setEntries] = useState(() =>
    tokens.map(t => ({ tokenId: t.tokenId, name: t.defaultName, maxHp: 50, group: '' }))
  );
  const [commonGroup, setCommonGroup] = useState('');
  const [groupSuggestions, setGroupSuggestions] = useState<string[]>([]);
  const [editingGroupIdx, setEditingGroupIdx] = useState<number | null>(null);

  const update = (idx: number, field: string, value: string | number) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const applyGroupToAll = () => {
    setEntries(prev => prev.map(e => ({ ...e, group: commonGroup })));
  };

  const filteredSuggestions = commonGroup
    ? existingGroups.filter(g => g.toLowerCase().includes(commonGroup.toLowerCase()) && g !== commonGroup)
    : existingGroups;

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
            <div className="relative">
              <input
                type="text"
                value={commonGroup}
                onChange={(e) => setCommonGroup(e.target.value)}
                placeholder="Например: Гоблины"
                className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-3 py-1.5 text-bone text-xs focus:border-gold-dark focus:outline-none"
              />
              {filteredSuggestions.length > 0 && commonGroup && (
                <div className="absolute z-10 top-full mt-1 w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded max-h-24 overflow-y-auto">
                  {filteredSuggestions.map(g => (
                    <button key={g} onClick={() => { setCommonGroup(g); applyGroupToAll(); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-faded hover:bg-[#2a2a3a] hover:text-bone">
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={applyGroupToAll}
              className="text-[10px] text-gold hover:text-gold-bright transition-colors font-cinzel">
              Применить группу ко всем
            </button>
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
                <div className="relative">
                  <label className="text-[9px] text-faded uppercase tracking-wider">Группа</label>
                  <input type="text" value={entry.group}
                    onChange={(e) => { update(idx, 'group', e.target.value); setEditingGroupIdx(idx); }}
                    onFocus={() => setEditingGroupIdx(idx)}
                    onBlur={() => setTimeout(() => setEditingGroupIdx(null), 150)}
                    placeholder="Без группы"
                    className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1 text-bone text-xs focus:border-gold-dark focus:outline-none mt-0.5" />
                  {editingGroupIdx === idx && existingGroups.filter(g => g.toLowerCase().includes(entry.group.toLowerCase())).length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded max-h-20 overflow-y-auto">
                      {existingGroups.filter(g => g.toLowerCase().includes(entry.group.toLowerCase())).map(g => (
                        <button key={g} onMouseDown={() => update(idx, 'group', g)}
                          className="w-full text-left px-3 py-1.5 text-xs text-faded hover:bg-[#2a2a3a] hover:text-bone">
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
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
          <button onClick={() => onConfirm(entries)}
            className="flex-1 py-2 text-xs text-gold bg-gold-dark/30 border border-gold-dark/50 rounded-lg hover:bg-gold-dark/50 font-cinzel transition-colors">
            Добавить ({entries.length})
          </button>
        </div>
      </div>
    </div>
  );
}
