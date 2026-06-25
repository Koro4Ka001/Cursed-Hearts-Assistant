import type { Monster } from '../stores/monsterStore';

interface Props {
  monster: Monster;
  selected: boolean;
  onToggle: (id: string) => void;
  onHp: (id: string, hp: number) => void;
  onMaxHp: (id: string, maxHp: number) => void;
  onRemove: (id: string) => void;
}

export function MonsterCard({ monster, selected, onToggle, onHp, onMaxHp, onRemove }: Props) {
  const pct = monster.maxHp > 0 ? (monster.hp / monster.maxHp) * 100 : 0;
  const isDead = monster.hp <= 0;
  const isLow = pct <= 25 && !isDead;
  const hpColor = isDead ? '#333' : pct < 25 ? '#ff0000' : pct < 50 ? '#aa4400' : '#cc2222';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${selected ? 'bg-gold/5 border-gold/30' : 'bg-[#111118] border-[#1a1a2a] hover:border-[#2a2a3a]'} ${isDead ? 'opacity-50' : ''}`}
      onClick={() => onToggle(monster.tokenId)}
    >
      <input type="checkbox" checked={selected} onChange={() => onToggle(monster.tokenId)} className="w-4 h-4 accent-[#c8a84e] shrink-0" onClick={(e) => e.stopPropagation()} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-cinzel text-[11px] text-bone truncate">{monster.name}</span>
          <span className="text-[10px] text-faded font-mono">{monster.hp}/{monster.maxHp}</span>
        </div>
        <div className="relative h-2.5 rounded-full overflow-hidden bg-[#0a0a0f] border border-[#1a1a2a]">
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: hpColor }} />
          {isDead && <div className="absolute inset-0 flex items-center justify-center text-[8px] text-faded font-cinzel">💀</div>}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onHp(monster.tokenId, monster.hp - 1)} className="w-6 h-6 flex items-center justify-center text-[10px] bg-blood-dark/40 text-blood-bright rounded hover:bg-blood-dark/70">−</button>
        <input type="number" value={monster.hp} onChange={(e) => onHp(monster.tokenId, parseInt(e.target.value) || 0)} className="w-10 text-center text-[10px] bg-[#0a0a0f] border border-[#1a1a2a] text-bone rounded py-0.5 font-mono focus:border-gold outline-none" />
        <button onClick={() => onHp(monster.tokenId, monster.hp + 1)} className="w-6 h-6 flex items-center justify-center text-[10px] bg-green-900/40 text-green-400 rounded hover:bg-green-900/70">+</button>
        <button onClick={() => onRemove(monster.tokenId)} className="w-6 h-6 flex items-center justify-center text-[9px] text-faded hover:text-blood-bright rounded hover:bg-blood-dark/30 ml-1">✕</button>
      </div>
    </div>
  );
}
