import { useState } from 'react';
import { useDefenseStore } from '../stores/defenseStore';
import type { MonsterToken } from '../hooks/useMonsterTokens';
import type { DamageType } from '../types';

interface MonsterCardProps {
  monster: MonsterToken;
  isSelected: boolean;
  onToggleSelect: (tokenId: string) => void;
  onUpdateHp: (tokenId: string, hp: number) => void;
  onSetMaxHp: (tokenId: string, maxHp: number) => void;
  onRemove: (tokenId: string) => void;
}

const DAMAGE_TYPES: { key: DamageType; name: string; icon: string }[] = [
  { key: 'slashing', name: 'Режущий', icon: '⚔️' },
  { key: 'piercing', name: 'Колющий', icon: '🗡️' },
  { key: 'bludgeoning', name: 'Дробящий', icon: '🔨' },
  { key: 'chopping', name: 'Рубящий', icon: '🪓' },
  { key: 'огонь', name: 'Огонь', icon: '🔥' },
  { key: 'вода', name: 'Вода', icon: '💧' },
  { key: 'земля', name: 'Земля', icon: '🪨' },
  { key: 'воздух', name: 'Воздух', icon: '💨' },
  { key: 'свет', name: 'Свет', icon: '✨' },
  { key: 'тьма', name: 'Тьма', icon: '🌑' },
  { key: 'электричество', name: 'Электричество', icon: '⚡' },
  { key: 'pure', name: 'Чистый', icon: '💎' },
];

const MULT_OPTIONS = [0, 0.25, 0.5, 1, 1.5, 2, 3];
const MULT_LABELS: Record<number, string> = {
  0: 'Иммунитет', 0.25: 'Сильн. резист', 0.5: 'Резист',
  1: 'Норма', 1.5: 'Слабость', 2: 'Уязвимость', 3: 'Крит. уязв.',
};

export function MonsterCard({ monster, isSelected, onToggleSelect, onUpdateHp, onSetMaxHp, onRemove }: MonsterCardProps) {
  const [showDefense, setShowDefense] = useState(false);
  const { setFlatArmor, setArmorByType, removeArmorByType, setMultiplier, removeMultiplier } = useDefenseStore();

  const pct = monster.maxHp > 0 ? (monster.hp / monster.maxHp) * 100 : 0;
  const isDead = monster.hp <= 0;
  const isLow = pct <= 25 && !isDead;

  const hpColor = isDead ? '#333' : pct < 25 ? '#ff0000' : pct < 50 ? '#aa4400' : '#cc2222';

  return (
    <>
      <div
        className={`
          relative rounded-xl overflow-hidden transition-all duration-200
          bg-[#111118] border
          ${isSelected ? 'border-gold ring-1 ring-gold/30' : 'border-[#222233]'}
          ${isDead ? 'opacity-50 grayscale' : ''}
          ${isLow ? 'animate-pulse' : ''}
          hover:border-[#333344] cursor-pointer
        `}
        onClick={() => onToggleSelect(monster.tokenId)}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(monster.tokenId)}
            className="w-4 h-4 accent-[#c8a84e] shrink-0"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-cinzel text-xs text-bone truncate">{monster.name}</span>
              <span className="text-[10px] text-faded font-mono">{monster.hp}/{monster.maxHp}</span>
            </div>

            <div className="relative h-3 rounded-full overflow-hidden bg-[#0a0a0f] border border-[#1a1a2a]">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: hpColor }}
              />
              {isDead && (
                <div className="absolute inset-0 flex items-center justify-center text-[9px] text-faded font-cinzel">
                  💀 МЁРТВ
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateHp(monster.tokenId, Math.max(0, monster.hp - 1)); }}
                className="px-2 py-0.5 text-[10px] bg-blood-dark/50 text-blood-bright rounded hover:bg-blood-dark/80 transition-colors"
              >
                −1
              </button>
              <input
                type="number"
                value={monster.hp}
                onChange={(e) => onUpdateHp(monster.tokenId, parseInt(e.target.value) || 0)}
                onClick={(e) => e.stopPropagation()}
                className="w-14 text-center text-xs bg-[#0a0a0f] border border-[#1a1a2a] text-bone rounded px-1 py-0.5 font-mono focus:border-gold outline-none"
              />
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateHp(monster.tokenId, Math.min(monster.maxHp, monster.hp + 1)); }}
                className="px-2 py-0.5 text-[10px] bg-green-900/50 text-green-400 rounded hover:bg-green-900/80 transition-colors"
              >
                +1
              </button>
              <div className="flex-1" />
              <button
                onClick={(e) => { e.stopPropagation(); setShowDefense(true); }}
                className="px-1.5 py-0.5 text-[9px] bg-[#1a1a2a] text-faded rounded hover:bg-[#222233] transition-colors"
              >
                🛡️
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(monster.tokenId); }}
                className="px-1.5 py-0.5 text-[9px] bg-blood-dark/30 text-blood-bright rounded hover:bg-blood-dark/60 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDefense && (
        <DefenseModal
          monster={monster}
          onClose={() => setShowDefense(false)}
          setFlatArmor={setFlatArmor}
          setArmorByType={setArmorByType}
          removeArmorByType={removeArmorByType}
          setMultiplier={setMultiplier}
          removeMultiplier={removeMultiplier}
        />
      )}
    </>
  );
}

function DefenseModal({
  monster, onClose,
  setFlatArmor, setArmorByType, removeArmorByType, setMultiplier, removeMultiplier,
}: {
  monster: MonsterToken;
  onClose: () => void;
  setFlatArmor: (id: string, v: number) => void;
  setArmorByType: (id: string, t: DamageType, v: number) => void;
  removeArmorByType: (id: string, t: DamageType) => void;
  setMultiplier: (id: string, t: DamageType, v: number) => void;
  removeMultiplier: (id: string, t: DamageType) => void;
}) {
  const defense = useDefenseStore((s) => s.units[monster.tokenId]);
  const [newArmorType, setNewArmorType] = useState<DamageType | ''>('');
  const [newArmorVal, setNewArmorVal] = useState(5);
  const [newMultType, setNewMultType] = useState<DamageType | ''>('');

  const flatArmor = defense?.flatArmor ?? 0;
  const armorByType = defense?.armorByType ?? {};
  const multipliers = defense?.multipliers ?? {};

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111118] rounded-xl border border-[#222233] max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#222233] flex items-center justify-between bg-[#0a0a0f]">
          <span className="font-cinzel text-sm text-gold">🛡️ {monster.name}</span>
          <button onClick={onClose} className="text-faded hover:text-bone text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-[10px] text-faded uppercase tracking-wider">Общая броня</label>
            <input
              type="number"
              value={flatArmor}
              onChange={(e) => setFlatArmor(monster.tokenId, parseInt(e.target.value) || 0)}
              className="w-full mt-1 bg-[#0a0a0f] border border-[#222233] rounded-lg px-3 py-2 text-bone font-mono text-center focus:border-gold outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-faded uppercase tracking-wider">Броня по типам</label>
            <div className="flex gap-2 mt-1">
              <select value={newArmorType} onChange={(e) => setNewArmorType(e.target.value as DamageType)} className="flex-1 bg-[#0a0a0f] border border-[#222233] rounded px-2 py-1.5 text-xs text-bone focus:border-gold outline-none">
                <option value="">Тип...</option>
                {DAMAGE_TYPES.map((t) => (<option key={t.key} value={t.key}>{t.icon} {t.name}</option>))}
              </select>
              <input type="number" value={newArmorVal} onChange={(e) => setNewArmorVal(parseInt(e.target.value) || 0)} className="w-16 bg-[#0a0a0f] border border-[#222233] rounded px-2 py-1.5 text-xs text-bone font-mono text-center focus:border-gold outline-none" />
              <button
                onClick={() => { if (newArmorType) { setArmorByType(monster.tokenId, newArmorType, newArmorVal); setNewArmorType(''); } }}
                disabled={!newArmorType}
                className="px-3 py-1.5 bg-gold-dark/30 text-gold rounded text-xs hover:bg-gold-dark/50 disabled:opacity-40"
              >+</button>
            </div>
            {Object.entries(armorByType).map(([type, val]) => (
              <div key={type} className="flex items-center gap-2 mt-1 px-2 py-1 bg-[#0a0a0f] rounded text-xs">
                <span className="text-bone flex-1">{type}</span>
                <span className="text-faded font-mono">{val}</span>
                <button onClick={() => removeArmorByType(monster.tokenId, type as DamageType)} className="text-blood-bright hover:text-blood text-xs">✕</button>
              </div>
            ))}
          </div>

          <div>
            <label className="text-[10px] text-faded uppercase tracking-wider">Множители</label>
            <select value={newMultType} onChange={(e) => setNewMultType(e.target.value as DamageType)} className="w-full mt-1 bg-[#0a0a0f] border border-[#222233] rounded px-2 py-1.5 text-xs text-bone focus:border-gold outline-none">
              <option value="">Тип урона...</option>
              {DAMAGE_TYPES.map((t) => (<option key={t.key} value={t.key}>{t.icon} {t.name}</option>))}
            </select>
            {newMultType && (
              <div className="flex flex-wrap gap-1 mt-1">
                {MULT_OPTIONS.map((v) => (
                  <button key={v} onClick={() => { setMultiplier(monster.tokenId, newMultType, v); setNewMultType(''); }}
                    className="px-2 py-1 text-[10px] bg-[#0a0a0f] border border-[#222233] rounded hover:border-gold text-bone transition-colors">
                    ×{v} <span className="text-faded">{MULT_LABELS[v]}</span>
                  </button>
                ))}
              </div>
            )}
            {Object.entries(multipliers).filter(([_, v]) => v !== 1).map(([type, val]) => (
              <div key={type} className="flex items-center gap-2 mt-1 px-2 py-1 bg-[#0a0a0f] rounded text-xs">
                <span className="text-bone flex-1">{type}</span>
                <span className="font-mono" style={{ color: val === 0 ? '#44ff44' : val < 1 ? '#88ff88' : val > 1 ? '#ff4444' : '#888' }}>×{val}</span>
                <button onClick={() => removeMultiplier(monster.tokenId, type as DamageType)} className="text-blood-bright hover:text-blood text-xs">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
