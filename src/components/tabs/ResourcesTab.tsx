import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Modal, Badge, EmptyState, ProgressBar } from '@/components/ui';
import { rollSingleDie } from '@/utils/dice';
import { ROK_EFFECTS, ROK_ELEMENTS, ROK_DIMENSIONS, ROK_STATS, ROK_AURA_EFFECTS } from '@/constants/rokEffects';
import type { Resource, RokEffect } from '@/types';
import { cn } from '@/utils/cn';

export function ResourcesTab() {
  const unit = useGameStore(s => s.getActiveUnit());
  const modifyResourceAmount = useGameStore(s => s.modifyResourceAmount);
  const addLog = useGameStore(s => s.addLog);

  const [rokResult, setRokResult] = useState<{
    hit: boolean;
    hitRoll: number;
    effect?: RokEffect;
    effectRoll?: number;
    additionalResults: string[];
    successCheck?: { roll: number; success: boolean };
  } | null>(null);
  const [showRokModal, setShowRokModal] = useState(false);
  const [showRokTable, setShowRokTable] = useState(false);

  if (!unit) return <EmptyState icon="🎒" message="Выберите юнита" />;

  const resources = unit.resources;

  const handleModify = (res: Resource, delta: number) => {
    modifyResourceAmount(unit.id, res.id, delta);
    if (delta < 0) {
      addLog(`📦 ${unit.shortName} использует ${res.icon} ${res.name} (${res.current + delta}/${res.max})`, 'resource');
    } else {
      addLog(`📦 ${unit.shortName} получает ${res.icon} ${res.name} (${res.current + delta}/${res.max})`, 'resource');
    }
  };

  const handleRokCard = (rokResource: Resource) => {
    if (rokResource.current <= 0) {
      addLog(`❌ ${unit.shortName}: нет Карт Рока!`, 'error');
      return;
    }

    modifyResourceAmount(unit.id, rokResource.id, -1);

    // Hit roll
    const hitRoll = rollSingleDie(20);
    const hit = hitRoll >= 11;

    if (!hit) {
      setRokResult({ hit: false, hitRoll, additionalResults: [] });
      setShowRokModal(true);
      addLog(`🃏 ${unit.shortName} бросает Карту Рока: ${hitRoll} — Промах!`, 'action');
      return;
    }

    // Effect roll
    const effectRoll = rollSingleDie(20);
    const effect = ROK_EFFECTS[effectRoll - 1];
    const additionalResults: string[] = [];
    let successCheck: { roll: number; success: boolean } | undefined;

    // Process additional rolls
    if (effect.additionalRolls) {
      for (const dieStr of effect.additionalRolls) {
        const sides = parseInt(dieStr.replace('d', ''));
        const roll = rollSingleDie(sides);
        let desc = `${dieStr}: ${roll}`;

        // Interpret based on effect
        if (effect.id === 1 && sides === 12) desc += ` — ${ROK_ELEMENTS[roll - 1] || 'Неизвестно'}`;
        if (effect.id === 2 && sides === 12) desc += ` — ${ROK_ELEMENTS[roll - 1] || 'Неизвестно'}`;
        if (effect.id === 9 && sides === 4) desc += ` — ${ROK_AURA_EFFECTS[roll - 1]}`;
        if (effect.id === 15 && sides === 6) desc += ` — ${ROK_STATS[roll - 1] || 'Неизвестно'}`;
        if (effect.id === 18 && sides === 8) desc += ` — ${ROK_DIMENSIONS[roll - 1] || 'Неизвестно'}`;

        additionalResults.push(desc);
      }
    }

    if (effect.requiresSuccessCheck) {
      const scRoll = rollSingleDie(20);
      successCheck = { roll: scRoll, success: scRoll >= 11 };
      additionalResults.push(`Проверка успеха: ${scRoll} — ${scRoll >= 11 ? '✅ Успех!' : '❌ Провал!'}`);
    }

    setRokResult({ hit: true, hitRoll, effect, effectRoll, additionalResults, successCheck });
    setShowRokModal(true);
    addLog(`🃏 ${unit.shortName} Карта Рока: ${hitRoll} (попал) → #${effectRoll} ${effect.name}`, 'action');
  };

  const rokResource = resources.find(r => r.isRokCards);

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Rok Cards special section */}
      {rokResource && (
        <Section title="Карты Рока" icon="🃏">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🃏</span>
                <div>
                  <div className="text-sm font-medium text-bone">{rokResource.name}</div>
                  <div className="text-xs text-faded">{rokResource.current}/{rokResource.max} карт</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="secondary" size="sm" onClick={() => handleModify(rokResource, -1)}>−</Button>
                <Button variant="secondary" size="sm" onClick={() => handleModify(rokResource, 1)}>+</Button>
              </div>
            </div>
            <Button
              variant="gold"
              className="w-full"
              disabled={rokResource.current <= 0}
              onClick={() => handleRokCard(rokResource)}
            >
              🎲 Бросить Карту Рока
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowRokTable(true)}>
              📋 Таблица эффектов
            </Button>
          </div>
        </Section>
      )}

      {/* Regular resources */}
      <Section title="Ресурсы" icon="🎒">
        {resources.filter(r => !r.isRokCards).length === 0 ? (
          <p className="text-xs text-faded">Добавьте ресурсы в настройках</p>
        ) : (
          <div className="space-y-2">
            {resources.filter(r => !r.isRokCards).map(res => (
              <div key={res.id} className="flex items-center gap-2 p-2 bg-input rounded-lg border border-border-bone">
                <span className="text-lg">{res.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-bone truncate">{res.name}</div>
                  <ProgressBar current={res.current} max={res.max} color="gold" height="sm" showValues={false} />
                </div>
                <div className="text-xs font-mono text-gold">{res.current}/{res.max}</div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="sm" onClick={() => handleModify(res, -1)}>−</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleModify(res, 1)}>+</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Rok Result Modal */}
      <Modal open={showRokModal} onClose={() => setShowRokModal(false)} title="🃏 Карта Рока" size="md">
        {rokResult && (
          <div className="space-y-3">
            <div className={cn(
              'text-center p-3 rounded-lg border',
              rokResult.hit ? 'bg-gold-dark/20 border-gold' : 'bg-blood-dark/20 border-blood'
            )}>
              <div className="text-xs text-faded">Бросок попадания</div>
              <div className={cn('text-2xl font-bold', rokResult.hit ? 'text-gold-bright' : 'text-blood-bright')}>
                {rokResult.hitRoll}
              </div>
              <div className="text-sm">{rokResult.hit ? '✅ Попадание!' : '❌ Промах!'}</div>
            </div>

            {rokResult.effect && (
              <div className="p-3 bg-input rounded-lg border border-border-bone">
                <div className="flex items-center gap-2 mb-2">
                  <Badge color="gold">#{rokResult.effectRoll}</Badge>
                  <span className="text-sm font-bold text-gold">{rokResult.effect.name}</span>
                </div>
                <p className="text-xs text-ancient">{rokResult.effect.description}</p>
                {rokResult.effect.duration && (
                  <Badge color="mana" >⏱ {rokResult.effect.duration} раунд(ов)</Badge>
                )}
              </div>
            )}

            {rokResult.additionalResults.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-faded uppercase">Дополнительные броски:</div>
                {rokResult.additionalResults.map((r, i) => (
                  <div key={i} className="text-sm text-ancient bg-hover p-2 rounded">{r}</div>
                ))}
              </div>
            )}

            <Button variant="secondary" className="w-full" onClick={() => setShowRokModal(false)}>Готово</Button>
          </div>
        )}
      </Modal>

      {/* Rok Effects Table Modal */}
      <Modal open={showRokTable} onClose={() => setShowRokTable(false)} title="📋 Таблица эффектов Карт Рока" size="lg">
        <div className="max-h-96 overflow-y-auto space-y-1">
          {ROK_EFFECTS.map(e => (
            <div key={e.id} className="flex gap-2 p-2 rounded bg-input border border-border-bone/50 text-xs">
              <Badge color={e.id === 13 ? 'error' : e.id === 17 ? 'gold' : 'faded'}>{e.id}</Badge>
              <div>
                <span className="font-medium text-bone">{e.name}</span>
                <span className="text-faded ml-1">— {e.description}</span>
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" className="w-full mt-3" onClick={() => setShowRokTable(false)}>Закрыть</Button>
      </Modal>
    </div>
  );
}
