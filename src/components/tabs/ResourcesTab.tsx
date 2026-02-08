import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Select, DiceResultDisplay } from '@/components/ui';
import { rollD20 } from '@/utils/dice';
import { ROK_EFFECTS } from '@/types';
import { cn } from '@/utils/cn';

interface RokCardResult {
  label: string;
  roll: number;
  bonus: number;
  total: number;
  success?: boolean;
  isCrit?: boolean;
  isCritFail?: boolean;
  details?: string;
}

export function ResourcesTab() {
  const unit = useGameStore((s) => s.getSelectedUnit());
  const setResource = useGameStore((s) => s.setResource);
  const addLog = useGameStore((s) => s.addLog);
  const addNotification = useGameStore((s) => s.addNotification);

  const [rokTarget, setRokTarget] = useState<'enemy' | 'ally' | 'self'>('enemy');
  const [rokResults, setRokResults] = useState<RokCardResult[]>([]);
  const [rokEffects, setRokEffects] = useState<Array<{ effect: number; name: string; desc: string; applied: boolean }>>([]);

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">📦</span>
        <p className="text-sm text-[#7a6f62]">Выберите или создайте юнита в настройках</p>
      </div>
    );
  }

  const rokResource = unit.resources.find((r) => r.name.toLowerCase().includes('карт') || r.name.toLowerCase().includes('рок'));

  const handleRokCards = (count: 1 | 3) => {
    if (!rokResource) return;
    if (rokResource.current < count) {
      addNotification({ type: 'error', title: 'Ошибка', message: `Недостаточно Карт Рока! (${rokResource.current}/${count})` });
      return;
    }

    // Deduct cards
    setResource(unit.id, rokResource.id, rokResource.current - count);

    const results: RokCardResult[] = [];
    const effects: Array<{ effect: number; name: string; desc: string; applied: boolean }> = [];
    const extraCards: number[] = [];

    const processCard = (cardIndex: number, isExtra: boolean = false) => {
      // Hit roll
      const hitRoll = rollD20(0);
      const hit = hitRoll.total > 11;

      results.push({
        label: `${isExtra ? 'Доп.' : ''}Карта ${cardIndex}: Попад.`,
        roll: hitRoll.rolls[0],
        bonus: 0,
        total: hitRoll.total,
        success: hit,
        isCrit: hitRoll.isCrit,
        isCritFail: hitRoll.isCritFail,
      });

      // Effect roll - ALWAYS
      const effectRoll = rollD20(0);
      const effectNum = effectRoll.rolls[0];
      const effect = ROK_EFFECTS[effectNum];

      results.push({
        label: `${isExtra ? 'Доп.' : ''}Карта ${cardIndex}: Эффект`,
        roll: effectRoll.rolls[0],
        bonus: 0,
        total: effectRoll.total,
        details: effect ? effect.name : 'Неизвестно',
      });

      if (effect) {
        effects.push({
          effect: effectNum,
          name: effect.name,
          desc: effect.description,
          applied: hit,
        });

        // Check for card 17 (Раздвоение)
        if (effectNum === 17 && hit) {
          extraCards.push(cardIndex * 10 + 1, cardIndex * 10 + 2);
        }
      }
    };

    for (let i = 1; i <= count; i++) {
      processCard(i);
    }

    // Process extra cards from Раздвоение
    for (const extraIdx of extraCards) {
      processCard(extraIdx, true);
    }

    setRokResults(results);
    setRokEffects(effects);

    addLog({
      unitName: unit.shortName,
      message: `🃏 Брошено ${count} Карт Рока → ${rokTarget}`,
      type: 'action',
    });
  };

  return (
    <div className="space-y-3 animate-[fadeSlideIn_300ms]">
      {/* Resources List */}
      <Section title="Ресурсы" icon="📦">
        {unit.resources.length === 0 ? (
          <p className="text-xs text-[#7a6f62] italic">Нет ресурсов. Добавьте в настройках.</p>
        ) : (
          <div className="space-y-2">
            {unit.resources.map((res) => {
              const pct = res.max > 0 ? (res.current / res.max) * 100 : 0;
              return (
                <div key={res.id} className="bg-[#161412] rounded-lg p-3 border border-[#3a332a]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{res.icon}</span>
                    <span className="text-sm font-medium text-[#d4c8b8] flex-1">{res.name}</span>
                    <span className="text-xs font-mono text-[#b8a892]">{res.current}/{res.max}</span>
                  </div>
                  {/* Progress */}
                  <div className="relative h-3 bg-[#0c0a09] rounded-full overflow-hidden mb-2">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#6a5014] to-[#d4a726] rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {/* Controls */}
                  <div className="flex gap-1">
                    <Button size="sm" variant="danger" onClick={() => setResource(unit.id, res.id, res.current - 5)} disabled={res.current <= 0} className="min-w-[36px] px-1">-5</Button>
                    <Button size="sm" variant="danger" onClick={() => setResource(unit.id, res.id, res.current - 1)} disabled={res.current <= 0} className="min-w-[36px] px-1">-1</Button>
                    <div className="flex-1" />
                    <Button size="sm" variant="success" onClick={() => setResource(unit.id, res.id, res.current + 1)} disabled={res.current >= res.max} className="min-w-[36px] px-1">+1</Button>
                    <Button size="sm" variant="success" onClick={() => setResource(unit.id, res.id, res.current + 5)} disabled={res.current >= res.max} className="min-w-[36px] px-1">+5</Button>
                  </div>
                  {res.damageFormula && (
                    <div className="mt-1 text-[10px] text-[#7a6f62]">
                      💥 {res.damageFormula} урона
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Rok Cards */}
      {unit.hasRokCards && rokResource && (
        <Section title="Карты Рока" icon="🃏">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🃏</span>
              <div>
                <div className="text-sm font-bold text-[#d4c8b8]">Карты Рока</div>
                <div className="text-xs text-[#7a6f62]">{rokResource.current}/{rokResource.max} осталось</div>
              </div>
            </div>

            <Select
              label="Цель"
              value={rokTarget}
              onChange={(e) => setRokTarget(e.target.value as 'enemy' | 'ally' | 'self')}
              options={[
                { value: 'enemy', label: '👹 Враг' },
                { value: 'ally', label: '🤝 Союзник' },
                { value: 'self', label: '🙋 Себя' },
              ]}
            />

            <div className="flex gap-2">
              <Button
                variant="gold"
                size="lg"
                className="flex-1"
                onClick={() => handleRokCards(1)}
                disabled={rokResource.current < 1}
              >
                🃏 Бросить 1
              </Button>
              <Button
                variant="gold"
                size="lg"
                className="flex-1"
                onClick={() => handleRokCards(3)}
                disabled={rokResource.current < 3}
              >
                🃏🃏🃏 Бросить 3
              </Button>
            </div>

            {/* Results */}
            {rokResults.length > 0 && <DiceResultDisplay title="Броски Карт Рока" results={rokResults} />}

            {/* Effects */}
            {rokEffects.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#d4a726]">Эффекты:</h4>
                {rokEffects.map((e, i) => (
                  <div
                    key={i}
                    className={cn(
                      'p-2.5 rounded-lg border text-xs animate-[fadeSlideIn_300ms]',
                      e.applied
                        ? 'bg-[#1a2e14]/30 border-[#2e5a1c]'
                        : 'bg-[#2e1414]/20 border-[#5a1c1c] opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: e.applied ? '#ffd700' : '#7a6f62' }}>
                        [{e.effect}]
                      </span>
                      <span className="font-bold text-[#d4c8b8]">{e.name}</span>
                      {!e.applied && <span className="ml-auto text-[9px] text-[#d09090]">НЕ ПРИМЕНЁН</span>}
                    </div>
                    <p className="mt-1 text-[#b8a892]">{e.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
