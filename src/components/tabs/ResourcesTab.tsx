import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section } from '@/components/ui';
import { diceService } from '@/services/diceService';
import { getRokEffect } from '@/constants/rokEffects';
import type { RokEffect } from '@/constants/rokEffects';
import { cn } from '@/utils/cn';

interface RokCardResult {
  cardIndex: number;
  hitRoll: number;
  hit: boolean;
  hitIsCrit: boolean;
  effectRoll: number;
  effect: RokEffect;
  additionalRolls: { formula: string; result: number }[];
  successCheck?: { total: number; success: boolean };
  applied: boolean;
  ricochetEffect?: number;
}

export function ResourcesTab() {
  const unit = useGameStore((s) => s.getSelectedUnit());
  const setResource = useGameStore((s) => s.setResource);
  const addLog = useGameStore((s) => s.addLog);
  const addNotification = useGameStore((s) => s.addNotification);
  const logToDocs = useGameStore((s) => s.logToDocs);

  const [rokTarget, setRokTarget] = useState<'enemy' | 'ally' | 'self'>('enemy');
  const [rokResults, setRokResults] = useState<RokCardResult[]>([]);
  const [isRolling, setIsRolling] = useState(false);

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="text-3xl mb-2">📦</span>
        <p className="text-[12px] text-[#7a6f62]">Выберите или создайте юнита в ⚙️</p>
      </div>
    );
  }

  const rokResource = unit.resources.find(
    (r) => r.name.toLowerCase().includes('карт') || r.name.toLowerCase().includes('рок')
  );

  const handleRokCards = async (count: 1 | 3) => {
    if (!rokResource) return;
    if (rokResource.current < count) {
      addNotification({ type: 'error', title: 'Ошибка', message: `Мало Карт Рока! (${rokResource.current}/${count})` });
      return;
    }

    setIsRolling(true);
    setRokResults([]);

    // Spend cards first
    setResource(unit.id, rokResource.id, rokResource.current - count);

    const results: RokCardResult[] = [];
    let totalCardsToProcess = count;
    let cardIdx = 0;

    while (cardIdx < totalCardsToProcess) {
      cardIdx++;
      const isExtra = cardIdx > count;
      const prefix = isExtra ? 'Доп.' : '';

      // 1. Hit roll (d20 no bonuses) — ALWAYS
      const hitRoll = await diceService.roll('d20', `${prefix}Карта ${cardIdx}: попадание`);
      const hitD20 = hitRoll.rolls[0] || hitRoll.total;
      const hit = hitD20 > 11;

      // 2. Effect roll (d20) — ALWAYS even on miss!
      const effectRoll = await diceService.roll('d20', `${prefix}Карта ${cardIdx}: эффект`);
      const effectD20 = effectRoll.rolls[0] || effectRoll.total;
      const effect = getRokEffect(effectD20);

      // 3. Additional rolls if needed
      const additionalRolls: { formula: string; result: number }[] = [];
      if (effect.additionalRolls) {
        for (const formula of effect.additionalRolls) {
          const roll = await diceService.roll(formula, `Эффект #${effectD20}: ${formula}`);
          additionalRolls.push({ formula, result: roll.total });
        }
      }

      // 4. Success check if needed
      let successCheck: { total: number; success: boolean } | undefined;
      if (effect.requiresSuccessCheck) {
        const check = await diceService.roll('d20', `Эффект #${effectD20}: проверка`);
        successCheck = { total: check.total, success: check.total > 11 };
      }

      // 5. Special effects
      let ricochetEffect: number | undefined;

      if (effectD20 === 17 && hit) {
        // Раздвоение — 2 extra cards WITHOUT spending
        totalCardsToProcess += 2;
        addLog({ unitName: unit.shortName, message: `🃏 Раздвоение! +2 карты (бесплатно)`, type: 'action' });
      }

      if (effectD20 === 13 && hit) {
        // Рикошет — new effect roll
        const redirect = await diceService.roll('d20', 'Рикошет: новый эффект');
        ricochetEffect = redirect.total;
        addLog({ unitName: unit.shortName, message: `🃏 Рикошет → #${redirect.total}: ${getRokEffect(redirect.total).name}`, type: 'action' });
      }

      results.push({
        cardIndex: cardIdx,
        hitRoll: hitD20,
        hit,
        hitIsCrit: hitRoll.isCrit,
        effectRoll: effectD20,
        effect,
        additionalRolls,
        successCheck,
        applied: hit,
        ricochetEffect,
      });

      const status = hit ? '✓ применён' : '✗ промах';
      const target = rokTarget === 'enemy' ? 'Враг' : rokTarget === 'ally' ? 'Союзник' : 'Себя';
      addLog({ unitName: unit.shortName, message: `🃏 Карта ${cardIdx} → ${target}: [${hitD20}] ${status} | #${effectD20} ${effect.name}`, type: 'action' });
    }

    setRokResults(results);
    setIsRolling(false);

    const target = rokTarget === 'enemy' ? 'Враг' : rokTarget === 'ally' ? 'Союзник' : 'Себя';
    logToDocs(`🃏 ${count} Карт Рока → ${target}, ${results.filter(r => r.applied).length} попаданий`);
  };

  return (
    <div className="space-y-2 animate-[fadeSlideIn_200ms]">
      {/* Resources List */}
      <Section title="Ресурсы" icon="📦">
        {unit.resources.length === 0 ? (
          <p className="text-[11px] text-[#7a6f62] italic">Нет ресурсов. Добавьте в ⚙️</p>
        ) : (
          <div className="space-y-1.5">
            {unit.resources.map((res) => {
              const pct = res.max > 0 ? (res.current / res.max) * 100 : 0;
              return (
                <div key={res.id} className="bg-[#161412] rounded-lg p-2 border border-[#3a332a]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{res.icon}</span>
                    <span className="text-[12px] font-medium text-[#d4c8b8] flex-1 truncate">{res.name}</span>
                    <span className="text-[11px] font-mono text-[#b8a892]">{res.current}/{res.max}</span>
                  </div>
                  <div className="relative h-2 bg-[#0c0a09] rounded-full overflow-hidden mb-1.5">
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#6a5014] to-[#d4a726] rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex gap-0.5">
                    <button onClick={() => setResource(unit.id, res.id, res.current - 5)} disabled={res.current <= 0}
                      className="h-6 px-1.5 rounded bg-[#4a0000] text-[#d09090] text-[10px] cursor-pointer hover:bg-[#5a1c1c] disabled:opacity-30 disabled:pointer-events-none">-5</button>
                    <button onClick={() => setResource(unit.id, res.id, res.current - 1)} disabled={res.current <= 0}
                      className="h-6 px-1.5 rounded bg-[#4a0000] text-[#d09090] text-[10px] cursor-pointer hover:bg-[#5a1c1c] disabled:opacity-30 disabled:pointer-events-none">-1</button>
                    <div className="flex-1" />
                    <button onClick={() => setResource(unit.id, res.id, res.current + 1)} disabled={res.current >= res.max}
                      className="h-6 px-1.5 rounded bg-[#2e5a1c] text-[#a0d090] text-[10px] cursor-pointer hover:bg-[#3a6a24] disabled:opacity-30 disabled:pointer-events-none">+1</button>
                    <button onClick={() => setResource(unit.id, res.id, res.current + 5)} disabled={res.current >= res.max}
                      className="h-6 px-1.5 rounded bg-[#2e5a1c] text-[#a0d090] text-[10px] cursor-pointer hover:bg-[#3a6a24] disabled:opacity-30 disabled:pointer-events-none">+5</button>
                  </div>
                  {res.damageFormula && (
                    <div className="mt-0.5 text-[9px] text-[#7a6f62]">💥 {res.damageFormula}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ROK CARDS — FULL IMPLEMENTATION */}
      {unit.hasRokCards && rokResource && (
        <Section title="Карты Рока" icon="🃏">
          <div className="space-y-2">
            {/* Card counter with ±buttons */}
            <div className="flex items-center justify-center gap-1.5">
              <button onClick={() => setResource(unit.id, rokResource.id, rokResource.current - 5)}
                disabled={rokResource.current < 5}
                className="w-8 h-8 rounded bg-[#161412] border border-[#3a332a] text-[#7a6f62] text-[10px] cursor-pointer disabled:opacity-30">-5</button>
              <button onClick={() => setResource(unit.id, rokResource.id, rokResource.current - 1)}
                disabled={rokResource.current < 1}
                className="w-8 h-8 rounded bg-[#161412] border border-[#3a332a] text-[#7a6f62] text-[10px] cursor-pointer disabled:opacity-30">-1</button>
              <span className="text-[18px] font-bold text-[#ffd700] min-w-[70px] text-center font-mono">
                [{rokResource.current}]/{rokResource.max}
              </span>
              <button onClick={() => setResource(unit.id, rokResource.id, rokResource.current + 1)}
                disabled={rokResource.current >= rokResource.max}
                className="w-8 h-8 rounded bg-[#161412] border border-[#3a332a] text-[#7a6f62] text-[10px] cursor-pointer disabled:opacity-30">+1</button>
              <button onClick={() => setResource(unit.id, rokResource.id, rokResource.current + 5)}
                disabled={rokResource.current >= rokResource.max - 4}
                className="w-8 h-8 rounded bg-[#161412] border border-[#3a332a] text-[#7a6f62] text-[10px] cursor-pointer disabled:opacity-30">+5</button>
            </div>

            {/* Target selection */}
            <div className="flex gap-1.5">
              {(['enemy', 'ally', 'self'] as const).map(t => (
                <button key={t} onClick={() => setRokTarget(t)}
                  className={cn('flex-1 h-9 border text-[12px] rounded transition-colors cursor-pointer',
                    rokTarget === t
                      ? 'border-[#d4a726] text-[#ffd700] bg-[#1a1408]'
                      : 'border-[#3a332a] text-[#4a433a] hover:text-[#7a6f62]'
                  )}>
                  {t === 'enemy' ? '👹 Враг' : t === 'ally' ? '🤝 Союзник' : '🎭 Себя'}
                </button>
              ))}
            </div>

            {/* Throw buttons */}
            {rokResults.length === 0 && (
              <div className="flex gap-2">
                <Button variant="gold" className="flex-1" onClick={() => handleRokCards(1)}
                  disabled={rokResource.current < 1 || isRolling} loading={isRolling}>
                  🃏 Бросить 1
                </Button>
                <Button variant="gold" className="flex-1" onClick={() => handleRokCards(3)}
                  disabled={rokResource.current < 3 || isRolling} loading={isRolling}>
                  🃏×3
                </Button>
              </div>
            )}

            {/* Results */}
            {rokResults.length > 0 && (
              <div className="space-y-1.5">
                {rokResults.map((result, idx) => (
                  <div key={idx}
                    className={cn(
                      'p-2 rounded-lg border text-[11px] animate-[fadeSlideIn_200ms]',
                      result.applied
                        ? 'bg-[#0a150a] border-[#2e5a1c]'
                        : 'bg-[#0a0806] border-[#3a332a] opacity-50'
                    )}>
                    {/* Header */}
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-[12px]">
                        {result.cardIndex > 3 ? '🔄 ' : ''}Карта {result.cardIndex}
                      </span>
                      <span className={cn('font-mono text-[11px]', result.hit ? 'text-[#a0d090]' : 'text-[#666]')}>
                        Попадание: [{result.hitRoll}] {result.hit ? '✓' : '✗'}
                        {result.hitIsCrit ? ' 💥' : ''}
                      </span>
                    </div>

                    {/* Effect */}
                    <div className="flex items-center gap-1">
                      <span className="text-[#d4a726] font-bold">#{result.effectRoll}</span>
                      <span className="text-[#d4c8b8] font-medium">{result.effect.name}</span>
                    </div>
                    <p className="text-[10px] text-[#7a6f62] mt-0.5">{result.effect.description}</p>

                    {/* Additional rolls */}
                    {result.additionalRolls.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {result.additionalRolls.map((r, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-[#161412] rounded text-[10px] text-[#b8a892] font-mono">
                            {r.formula}: [{r.result}]
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Success check */}
                    {result.successCheck && (
                      <div className={cn('mt-1 text-[10px] font-mono',
                        result.successCheck.success ? 'text-[#a0d090]' : 'text-[#d09090]')}>
                        Проверка: [{result.successCheck.total}] {result.successCheck.success ? '✓ УСПЕХ' : '✗ ПРОВАЛ'}
                      </div>
                    )}

                    {/* Ricochet */}
                    {result.ricochetEffect && (
                      <div className="mt-1 text-[10px] text-[#d4a726]">
                        🔄 Рикошет → #{result.ricochetEffect}: {getRokEffect(result.ricochetEffect).name}
                      </div>
                    )}

                    {/* Applied status */}
                    <div className={cn('mt-1 text-[10px] font-bold',
                      result.applied ? 'text-[#a0d090]' : 'text-[#666]')}>
                      {result.applied ? '✅ ПРИМЕНЕНО' : '❌ НЕ ПРИМЕНЕНО'}
                    </div>
                  </div>
                ))}

                <Button variant="secondary" size="sm" className="w-full" onClick={() => setRokResults([])}>
                  Сбросить
                </Button>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
