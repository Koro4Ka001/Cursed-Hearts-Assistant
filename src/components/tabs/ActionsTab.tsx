import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, EmptyState } from '@/components/ui';
import { rollDice, formatRollResult } from '@/utils/dice';
import { STAT_NAMES, STAT_MULTIPLIERS } from '@/constants/proficiencies';
import { formatBonus } from '@/utils/format';
import type { QuickAction, DiceRollResult } from '@/types';
import { cn } from '@/utils/cn';

export function ActionsTab() {
  const unit = useGameStore(s => s.getActiveUnit());
  const addLog = useGameStore(s => s.addLog);

  const [lastResult, setLastResult] = useState<{ action: QuickAction; result: DiceRollResult } | null>(null);

  if (!unit) return <EmptyState icon="🎯" message="Выберите юнита для действий" />;

  const actions = unit.quickActions;

  const getFullBonus = (action: QuickAction): number => {
    let total = action.flatBonus;
    if (action.statBonus !== 'none') {
      const statVal = unit.stats[action.statBonus] || 0;
      total += statVal * (STAT_MULTIPLIERS[action.statBonus] || 0);
    }
    return total;
  };

  const handleRoll = (action: QuickAction) => {
    const totalBonus = getFullBonus(action);
    let formula: string;
    if (action.baseDice) {
      formula = totalBonus >= 0 ? `${action.baseDice}+${totalBonus}` : `${action.baseDice}${totalBonus}`;
    } else {
      formula = `${totalBonus}`;
    }
    const result = rollDice(formula);
    setLastResult({ action, result });
    addLog(`🎯 ${unit.shortName}: ${action.icon} ${action.name} — ${formatRollResult(result)}`, 'action');
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <Section title="Быстрые действия" icon="🎯">
        {actions.length === 0 ? (
          <p className="text-xs text-faded">Добавьте быстрые действия в настройках ⚙️</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {actions.map(action => {
              const bonus = getFullBonus(action);
              const bonusText = action.baseDice
                ? `${action.baseDice}${formatBonus(bonus)}`
                : `${bonus}`;

              return (
                <button
                  key={action.id}
                  onClick={() => handleRoll(action)}
                  className="p-3 rounded-lg border border-border-bone bg-input hover:border-gold-dark hover:bg-hover transition-all text-left cursor-pointer group"
                >
                  <div className="text-xl text-center mb-1 group-hover:scale-110 transition-transform">{action.icon}</div>
                  <div className="text-xs font-medium text-bone text-center truncate">{action.name}</div>
                  <div className="text-[10px] text-faded text-center">{bonusText}</div>
                  {action.statBonus !== 'none' && (
                    <div className="text-[9px] text-dim text-center">{STAT_NAMES[action.statBonus]}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* Last result */}
      {lastResult && (
        <Section title="Результат" icon="📊">
          <div
            className={cn(
              'text-center p-4 rounded-lg border animate-fade-in',
              lastResult.result.isCritical
                ? 'bg-gold-dark/20 border-gold'
                : lastResult.result.isCriticalFail
                  ? 'bg-blood-dark/20 border-blood animate-shake'
                  : 'bg-input border-border-bone'
            )}
          >
            <div className="text-sm text-faded mb-1">
              {lastResult.action.icon} {lastResult.action.name}
            </div>
            <div
              className={cn(
                'text-3xl font-bold',
                lastResult.result.isCritical
                  ? 'text-gold-bright'
                  : lastResult.result.isCriticalFail
                    ? 'text-blood-bright'
                    : 'text-bone'
              )}
            >
              {lastResult.result.total}
            </div>
            <div className="text-xs text-faded mt-1">{formatRollResult(lastResult.result)}</div>
            {lastResult.result.isCritical && (
              <div className="text-sm text-gold-bright font-bold mt-1">⭐ КРИТИЧЕСКИЙ УСПЕХ!</div>
            )}
            {lastResult.result.isCriticalFail && (
              <div className="text-sm text-blood-bright font-bold mt-1">💀 КРИТИЧЕСКИЙ ПРОВАЛ!</div>
            )}
            {lastResult.action.description && (
              <div className="text-xs text-ancient mt-2 border-t border-border-bone pt-2">
                {lastResult.action.description}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setLastResult(null)}>
            Сбросить
          </Button>
        </Section>
      )}
    </div>
  );
}
