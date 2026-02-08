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
  const logToDocs = useGameStore((s) => s.logToDocs);

  const [rokTarget, setRokTarget] = useState<'enemy' | 'ally' | 'self'>('enemy');
  const [rokResults, setRokResults] = useState<RokCardResult[]>([]);
  const [rokEffects, setRokEffects] = useState<Array<{ effect: number; name: string; desc: string; applied: boolean }>>([]);

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

  const handleRokCards = (count: 1 | 3) => {
    if (!rokResource) return;
    if (rokResource.current < count) {
      addNotification({ type: 'error', title: 'Ошибка', message: `Мало Карт Рока! (${rokResource.current}/${count})` });
      return;
    }

    setResource(unit.id, rokResource.id, rokResource.current - count);

    const results: RokCardResult[] = [];
    const effects: Array<{ effect: number; name: string; desc: string; applied: boolean }> = [];
    const extraCards: number[] = [];

    const processCard = (cardIndex: number, isExtra: boolean = false) => {
      const prefix = isExtra ? 'Доп.' : '';

      // Hit roll — ALWAYS
      const hitRoll = rollD20(0);
      const hit = hitRoll.total > 11;

      results.push({
        label: `${prefix}Карта ${cardIndex}: Попад`,
        roll: hitRoll.rolls[0], bonus: 0, total: hitRoll.total,
        success: hit, isCrit: hitRoll.isCrit, isCritFail: hitRoll.isCritFail,
      });

      // Effect roll — ALWAYS (even on miss!)
      const effectRoll = rollD20(0);
      const effectNum = effectRoll.rolls[0];
      const effect = ROK_EFFECTS[effectNum];

      results.push({
        label: `${prefix}Карта ${cardIndex}: Эффект`,
        roll: effectRoll.rolls[0], bonus: 0, total: effectRoll.total,
        details: effect?.name || '???',
      });

      if (effect) {
        effects.push({
          effect: effectNum,
          name: effect.name,
          desc: effect.description,
          applied: hit,
        });

        // Card 17 — split into 2 extra cards
        if (effectNum === 17 && hit) {
          extraCards.push(cardIndex * 10 + 1, cardIndex * 10 + 2);
        }
      }
    };

    for (let i = 1; i <= count; i++) {
      processCard(i);
    }

    // Process extra cards from Раздвоение (no resource cost)
    for (const extraIdx of extraCards) {
      processCard(extraIdx, true);
    }

    setRokResults(results);
    setRokEffects(effects);

    const msg = `🃏 ${count} Карт Рока → ${rokTarget === 'enemy' ? 'Враг' : rokTarget === 'ally' ? 'Союзник' : 'Себя'}`;
    addLog({ unitName: unit.shortName, message: msg, type: 'action' });
    logToDocs(msg);
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
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#6a5014] to-[#d4a726] rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
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

      {/* Rok Cards */}
      {unit.hasRokCards && rokResource && (
        <Section title="Карты Рока" icon="🃏">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🃏</span>
              <div className="flex-1">
                <div className="text-[12px] font-bold text-[#d4c8b8]">Карты Рока</div>
                <div className="text-[10px] text-[#7a6f62]">{rokResource.current}/{rokResource.max}</div>
              </div>
            </div>

            <Select label="Цель" value={rokTarget} onChange={(e) => setRokTarget(e.target.value as 'enemy' | 'ally' | 'self')}
              options={[
                { value: 'enemy', label: '👹 Враг' },
                { value: 'ally', label: '🤝 Союзник' },
                { value: 'self', label: '🙋 Себя' },
              ]}
            />

            <div className="flex gap-1.5">
              <Button variant="gold" className="flex-1" onClick={() => handleRokCards(1)} disabled={rokResource.current < 1}>
                🃏 Бросить 1
              </Button>
              <Button variant="gold" className="flex-1" onClick={() => handleRokCards(3)} disabled={rokResource.current < 3}>
                🃏×3
              </Button>
            </div>

            {rokResults.length > 0 && <DiceResultDisplay title="Броски" results={rokResults} />}

            {rokEffects.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-[#d4a726] uppercase tracking-wider">Эффекты:</h4>
                {rokEffects.map((e, i) => (
                  <div
                    key={i}
                    className={cn(
                      'p-2 rounded-lg border text-[11px] animate-[fadeSlideIn_200ms]',
                      e.applied
                        ? 'bg-[#1a2e14]/30 border-[#2e5a1c]'
                        : 'bg-[#2e1414]/20 border-[#5a1c1c] opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold" style={{ color: e.applied ? '#ffd700' : '#7a6f62' }}>
                        [{e.effect}]
                      </span>
                      <span className="font-bold text-[#d4c8b8] text-[11px]">{e.name}</span>
                      {!e.applied && <span className="ml-auto text-[8px] text-[#d09090]">НЕ ПРИМЕНЁН</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] text-[#b8a892]">{e.desc}</p>
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
