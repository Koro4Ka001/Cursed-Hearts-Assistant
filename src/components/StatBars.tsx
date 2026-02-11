import { useGameStore } from '../stores/useGameStore';
import { ProgressBar } from './ui';
import { cn } from '../utils/cn';

export function StatBars() {
  const { units, selectedUnitId } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);

  if (!unit) {
    return (
      <div className="px-3 py-2 bg-dark border-b border-edge-bone">
        <div className="text-center text-faded text-sm py-2 font-garamond italic">
          Выберите персонажа
        </div>
      </div>
    );
  }

  const showHP = !unit.useManaAsHp;
  const resources = (unit.resources ?? []).filter(r => r.resourceType === 'generic');

  return (
    <div className="px-3 py-2 bg-dark border-b border-edge-bone space-y-1.5">
      {showHP && (
        <ProgressBar type="hp" value={unit.health.current} max={unit.health.max} />
      )}
      <ProgressBar type="mana" value={unit.mana.current} max={unit.mana.max} />

      {resources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {resources.map(r => {
            const pct = r.max > 0 ? (r.current / r.max) * 100 : 0;
            return (
              <div
                key={r.id}
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-cinzel',
                  pct < 25 ? 'border-blood-dark text-blood-bright' : 'border-edge-bone text-ancient'
                )}
                title={`${r.name}: ${r.current}/${r.max}`}
              >
                <span>{r.icon}</span>
                <span>{r.current}/{r.max}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
