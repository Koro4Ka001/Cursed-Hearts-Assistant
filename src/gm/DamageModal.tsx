import { useState, useMemo } from 'react';
import type { MonsterToken } from '../hooks/useMonsterTokens';
import type { DamageType } from '../types';

interface DamageModalProps {
  monsters: MonsterToken[];
  selectedIds: Set<string>;
  onClose: () => void;
  onApply: (updates: { tokenId: string; newHp: number }[]) => void;
}

const DAMAGE_TYPES: { key: DamageType; name: string; icon: string; category: string }[] = [
  { key: 'slashing', name: 'Режущий', icon: '⚔️', category: 'Физический' },
  { key: 'piercing', name: 'Колющий', icon: '🗡️', category: 'Физический' },
  { key: 'bludgeoning', name: 'Дробящий', icon: '🔨', category: 'Физический' },
  { key: 'chopping', name: 'Рубящий', icon: '🪓', category: 'Физический' },
  { key: 'огонь', name: 'Огонь', icon: '🔥', category: 'Магический' },
  { key: 'вода', name: 'Вода', icon: '💧', category: 'Магический' },
  { key: 'земля', name: 'Земля', icon: '🪨', category: 'Магический' },
  { key: 'воздух', name: 'Воздух', icon: '💨', category: 'Магический' },
  { key: 'свет', name: 'Свет', icon: '✨', category: 'Магический' },
  { key: 'тьма', name: 'Тьма', icon: '🌑', category: 'Магический' },
  { key: 'электричество', name: 'Электричество', icon: '⚡', category: 'Магический' },
  { key: 'pure', name: 'Чистый', icon: '💎', category: 'Особый' },
];

function calcDamage(monster: MonsterToken, raw: number, type: DamageType): { final: number; newHp: number; breakdown: string } {
  if (type === 'pure') {
    const final = Math.max(0, raw);
    return { final, newHp: Math.max(0, monster.hp - final), breakdown: `${raw} (чистый)` };
  }

  const mult = monster.multipliers[type] ?? 1;
  const afterMult = Math.floor(raw * mult);
  const armor = monster.flatArmor + (monster.armorByType[type] ?? 0);
  const final = Math.max(0, afterMult - armor);
  const newHp = Math.max(0, monster.hp - final);

  let bd = `${raw}`;
  if (mult !== 1) bd += ` ×${mult}`;
  if (armor > 0) bd += ` −${armor}`;
  bd += ` = ${final}`;
  return { final, newHp, breakdown: bd };
}

export function DamageModal({ monsters, selectedIds, onClose, onApply }: DamageModalProps) {
  const [rawDamage, setRawDamage] = useState(10);
  const [damageType, setDamageType] = useState<DamageType>('slashing');

  const selected = monsters.filter((m) => selectedIds.has(m.tokenId));

  const calculations = useMemo(() => {
    return selected.map((m) => {
      const { final, newHp, breakdown } = calcDamage(m, rawDamage, damageType);
      return { ...m, finalDamage: final, newHp, breakdown, isDead: newHp <= 0 };
    });
  }, [selected, rawDamage, damageType]);

  const totalDamage = calculations.reduce((s, c) => s + c.finalDamage, 0);
  const kills = calculations.filter((c) => c.isDead).length;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111118] rounded-xl border border-[#222233] max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#222233] flex items-center justify-between bg-[#0a0a0f]">
          <span className="font-cinzel text-sm text-blood-bright">⚔️ Нанести урон</span>
          <button onClick={onClose} className="text-faded hover:text-bone text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-[10px] text-faded uppercase tracking-wider">Количество</label>
            <input
              type="number"
              value={rawDamage}
              onChange={(e) => setRawDamage(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full mt-1 bg-[#0a0a0f] border border-[#222233] rounded-lg px-4 py-3 text-2xl font-mono text-center text-bone focus:border-blood-bright outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-faded uppercase tracking-wider">Тип урона</label>
            <select
              value={damageType}
              onChange={(e) => setDamageType(e.target.value as DamageType)}
              className="w-full mt-1 bg-[#0a0a0f] border border-[#222233] rounded-lg px-3 py-2 text-sm text-bone focus:border-gold outline-none"
            >
              {['Физический', 'Магический', 'Особый'].map((cat) => (
                <optgroup key={cat} label={cat}>
                  {DAMAGE_TYPES.filter((t) => t.category === cat).map((t) => (
                    <option key={t.key} value={t.key}>{t.icon} {t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            {calculations.map((c) => (
              <div key={c.tokenId} className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0f] rounded-lg text-xs">
                <span className="text-bone flex-1 truncate">{c.name}</span>
                <span className="text-faded font-mono">{c.breakdown}</span>
                {c.isDead && <span className="text-blood-bright">💀</span>}
                <span className="font-mono text-blood-bright w-10 text-right">−{c.finalDamage}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#0a0a0f] rounded-lg p-2">
              <div className="text-[9px] text-faded">Целей</div>
              <div className="text-sm font-mono text-bone">{calculations.length}</div>
            </div>
            <div className="bg-[#0a0a0f] rounded-lg p-2">
              <div className="text-[9px] text-faded">Общий урон</div>
              <div className="text-sm font-mono text-blood-bright">{totalDamage}</div>
            </div>
            <div className="bg-[#0a0a0f] rounded-lg p-2">
              <div className="text-[9px] text-faded">Убийств</div>
              <div className="text-sm font-mono text-purple-400">{kills}</div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#222233] bg-[#0a0a0f]">
          <button
            onClick={() => {
              onApply(calculations.map((c) => ({ tokenId: c.tokenId, newHp: c.newHp })));
              onClose();
            }}
            disabled={calculations.length === 0}
            className="w-full py-3 rounded-lg font-cinzel text-sm font-bold bg-blood-dark text-blood-bright hover:bg-blood border border-blood/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            ⚔️ Применить ({calculations.length} целей)
          </button>
        </div>
      </div>
    </div>
  );
}
