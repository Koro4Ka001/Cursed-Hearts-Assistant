import { useGameStore } from '../stores/useGameStore';
import { ProgressBar } from './ui';

export function StatBars() {
  const { units, selectedUnitId } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  if (!unit) {
    return (
      <div className="px-3 py-2 bg-dark border-b border-edge-bone">
        <div className="text-center text-faded text-sm py-2 font-garamond">
          Выберите персонажа
        </div>
      </div>
    );
  }
  
  // Если режим "Мана = Жизнь" — показываем только ману
  if (unit.useManaAsHp) {
    return (
      <div className="px-3 py-2 bg-dark border-b border-edge-bone space-y-1">
        <div className="text-[0.6rem] text-faded uppercase tracking-wider font-cinzel mb-0.5">
          ЖИЗНЕННАЯ СИЛА
        </div>
        <ProgressBar
          type="mana"
          value={unit.mana.current}
          max={unit.mana.max}
        />
      </div>
    );
  }
  
  // Обычный режим — показываем и HP, и ману
  return (
    <div className="px-3 py-2 bg-dark border-b border-edge-bone space-y-1.5">
      <div>
        <div className="text-[0.6rem] text-faded uppercase tracking-wider font-cinzel mb-0.5">
          ЗДОРОВЬЕ
        </div>
        <ProgressBar
          type="hp"
          value={unit.health.current}
          max={unit.health.max}
        />
      </div>
      <div>
        <div className="text-[0.6rem] text-faded uppercase tracking-wider font-cinzel mb-0.5">
          МАНА
        </div>
        <ProgressBar
          type="mana"
          value={unit.mana.current}
          max={unit.mana.max}
        />
      </div>
    </div>
  );
}
