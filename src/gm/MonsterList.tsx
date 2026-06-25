import { MonsterCard } from './MonsterCard';
import type { MonsterToken } from '../hooks/useMonsterTokens';

interface MonsterListProps {
  monsters: MonsterToken[];
  selectedIds: Set<string>;
  onToggleSelect: (tokenId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onUpdateHp: (tokenId: string, hp: number) => void;
  onSetMaxHp: (tokenId: string, maxHp: number) => void;
}

export function MonsterList({
  monsters, selectedIds, onToggleSelect, onSelectAll, onDeselectAll, onUpdateHp, onSetMaxHp,
}: MonsterListProps) {
  if (monsters.length === 0) {
    return (
      <div className="text-center py-8 text-faded text-sm">
        <div className="text-3xl mb-2 opacity-40">🎯</div>
        <p>Нет монстров на сцене</p>
        <p className="text-[11px] text-dim mt-1">Добавьте токены с HP metadata</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-faded font-cinzel uppercase tracking-wider">
          {monsters.length} монстров · {selectedIds.size} выбрано
        </span>
        <div className="flex gap-2">
          <button onClick={onSelectAll} className="text-[10px] text-gold hover:text-gold-bright transition-colors">Все</button>
          <button onClick={onDeselectAll} className="text-[10px] text-faded hover:text-bone transition-colors">Снять</button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
        {monsters.map((m) => (
          <MonsterCard
            key={m.tokenId}
            monster={m}
            isSelected={selectedIds.has(m.tokenId)}
            onToggleSelect={onToggleSelect}
            onUpdateHp={onUpdateHp}
            onSetMaxHp={onSetMaxHp}
          />
        ))}
      </div>
    </div>
  );
}
