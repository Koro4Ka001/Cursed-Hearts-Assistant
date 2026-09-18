// src/components/tabs/RokTab.tsx
// 🃏 Карты Рока: тяга карты (d20 → один из 20 эффектов колоды Кассиана),
// доп. броски эффектов, broadcast «rok-card» всем игрокам (плашка с деталями).

import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { diceService } from '../../services/diceService';
import { ROK_EFFECTS, type RokEffect } from '../../constants/rokEffects';
import { Button, Section, EmptyState } from '../ui';
import { SortableTab } from '../SortableTab';

interface DrawResult {
  effect: RokEffect;
  roll: number;
  isCrit: boolean;
  isCritFail: boolean;
  extra: { label: string; dice: string; value: number }[];
}

export function RokTab() {
  const unit = useGameStore(s => s.units.find(u => u.id === s.selectedUnitId));
  const setResource = useGameStore(s => s.setResource);
  const [last, setLast] = useState<DrawResult | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  if (!unit) {
    return (
      <EmptyState
        icon="🃏"
        title="Нет персонажа"
        description="Выберите персонажа, чтобы тянуть карты Рока"
      />
    );
  }

  const unitName = unit.shortName ?? unit.name;
  const deckResource = (unit.resources ?? []).find(r => r.id === unit.rokDeckResourceId);

  const draw = async () => {
    if (isDrawing) return;
    if (deckResource && (deckResource.current ?? 0) <= 0) {
      await diceService.showNotification(`🃏 ${deckResource.name} пуста!`);
      return;
    }
    setIsDrawing(true);
    try {
      const cardRoll = await diceService.roll('d20', 'Карта Рока', unitName, 'normal');
      const roll = cardRoll.rawD20 ?? cardRoll.rolls[0] ?? 1;
      const effect = ROK_EFFECTS.find(e => e.id === roll) ?? ROK_EFFECTS[0]!;

      const extra: DrawResult['extra'] = [];
      for (const ar of effect.additionalRolls ?? []) {
        const er = await diceService.roll(ar.dice, ar.label, unitName, 'normal');
        extra.push({ label: ar.label, dice: ar.dice, value: er.total });
      }

      setLast({ effect, roll, isCrit: !!cardRoll.isCrit, isCritFail: !!cardRoll.isCritFail, extra });
      setHistory(prev => [roll, ...prev].slice(0, 12));

      await diceService.broadcastRokCard(
        unitName,
        roll,
        true,
        !!cardRoll.isCrit,
        !!cardRoll.isCritFail,
        effect.icon,
        effect.name,
        roll,
        roll,
        [
          effect.shortDesc,
          ...extra.map(e => `${e.label} [${e.dice}]: ${e.value}`),
        ]
      );

      // Списываем карту из ресурса колоды (если назначен)
      if (deckResource) {
        await setResource(unit.id, deckResource.id, (deckResource.current ?? 0) - 1);
      }
    } finally {
      setIsDrawing(false);
    }
  };

  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      <SortableTab tabId="rok">
      <Section title="Карты Рока" icon="🃏" sortableId="rok.deck">
        <div className="text-xs text-faded">
          {deckResource
            ? <>Колода: {deckResource.icon ?? '🃏'} <strong className="text-bone">{deckResource.name}</strong> — осталось {deckResource.current ?? 0}/{deckResource.max ?? 0}</>
            : 'Ресурс колоды не назначен (Настройки → персонаж → «Имеет колоду Рока»). Карты не списываются.'}
        </div>

        <Button
          variant="gold"
          onClick={draw}
          loading={isDrawing}
          disabled={!!deckResource && (deckResource.current ?? 0) <= 0}
          className="w-full text-sm py-3"
        >
          🎴 Тянуть карту (d20)
        </Button>

        {last && (
          <div className={`p-3 rounded border bg-obsidian space-y-2 ${last.isCrit ? 'border-gold' : last.isCritFail ? 'border-blood' : 'border-edge-bone'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-cinzel text-sm text-gold">
                {last.effect.icon} #{last.roll} {last.effect.name}
              </span>
              <span className="text-xs">
                {last.isCrit && <span className="text-gold">✨ КРИТ</span>}
                {last.isCritFail && <span className="text-blood">💀 ПРОВАЛ</span>}
              </span>
            </div>
            <div className="text-sm font-garamond text-bone">{last.effect.description}</div>
            {last.extra.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-edge-bone/40">
                {last.extra.map((e, i) => (
                  <div key={i} className="text-xs text-ancient">
                    🎲 {e.label} [{e.dice}] = <span className="text-gold font-bold">{e.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {history.length > 0 && (
        <Section title="История" icon="📜" collapsible defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {history.map((r, i) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded bg-obsidian border border-edge-bone text-faded">
                #{r}
              </span>
            ))}
          </div>
        </Section>
      )}
      </SortableTab>
    </div>
  );
}
