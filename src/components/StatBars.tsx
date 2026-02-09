import { useGameStore } from '../stores/useGameStore';
import { ProgressBar } from './ui';

export function StatBars() {
  const { units, selectedUnitId } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  if (!unit) {
    return (
      <div className="px-3 py-2 bg-dark border-b border-edge-bone">
        <div className="text-center text-faded text-sm py-2">
          Выберите персонажа
        </div>
      </div>
    );
  }
  
  return (
    <div className="px-3 py-2 bg-dark border-b border-edge-bone space-y-1.5">
      <ProgressBar
        type="hp"
        value={unit.health.current}
        max={unit.health.max}
      />
      <ProgressBar
        type="mana"
        value={unit.mana.current}
        max={unit.mana.max}
      />
    </div>
  );
}
