import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, EmptyState } from '../ui';
import { ROK_EFFECTS, getRokEffect } from '../../constants/rokEffects';
import { diceService } from '../../services/diceService';
import type { RokCardResult, DiceRollResult } from '../../types';
import { cn } from '../../utils/cn';

type RokTarget = 'enemy' | 'ally' | 'self';

export function CardsTab() {
  const { units, selectedUnitId, spendResource, setActiveTab, triggerEffect } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [target, setTarget] = useState<RokTarget>('enemy');
  const [isRolling, setIsRolling] = useState(false);
  const [cardResults, setCardResults] = useState<RokCardResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  if (!unit) return <EmptyState icon="🃏" title="Нет персонажа" description="Выберите персонажа" />;
  if (!unit.hasRokCards) return <EmptyState icon="🃏" title="Нет колоды" description="Нет способности Карты Рока" />;
  
  const resources = unit.resources ?? [];
  const rokDeck = unit.rokDeckResourceId ? resources.find(r => r.id === unit.rokDeckResourceId) : null;
  
  if (!rokDeck) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-5xl mb-4">🃏</div>
        <h3 className="font-cinzel text-gold text-lg mb-2">Колода не привязана</h3>
        <Button variant="gold" onClick={() => setActiveTab('settings')}>⚙️ Настройки</Button>
      </div>
    );
  }
  
  const cardsLeft = rokDeck.current ?? 0;
  
  const handleRollCards = async (count: number) => {
    if (cardsLeft < count) {
      await diceService.showNotification(`❌ Недостаточно карт! Осталось ${cardsLeft}`);
      return;
    }
    
    setIsRolling(true);
    setCardResults([]);
    setShowResults(false);
    
    const results: RokCardResult[] = [];
    let extraCardsToRoll = 0;
    
    try {
      await spendResource(unit.id, rokDeck.id, count);
      
      let cardsToProcess = count;
      let cardIndex = 1;
      
      while (cardsToProcess > 0 || extraCardsToRoll > 0) {
        if (cardsToProcess > 0) cardsToProcess--;
        else if (extraCardsToRoll > 0) extraCardsToRoll--;
        
        // 🔹 SILENT: true, чтобы не спамить в чат отдельными бросками
        const hitResult = await diceService.roll('d20', `Карта ${cardIndex}`, unit.shortName, 'normal', true);
        const isHit = (hitResult.total ?? 0) >= 11;
        
        const effectResult = await diceService.roll('d20', `Эффект`, unit.shortName, 'normal', true);
        const effectRoll = effectResult.rawD20 ?? effectResult.total ?? 1;
        const effect = getRokEffect(effectRoll);
        
        const additionalRolls: DiceRollResult[] = [];
        
        if (effect.additionalRolls) {
          for (const roll of effect.additionalRolls) {
            // 🔹 SILENT: true
            const result = await diceService.roll(roll.dice, roll.label, unit.shortName, 'normal', true);
            additionalRolls.push(result);
          }
        }
        
        if (effect.requiresSuccessCheck) {
          const successCheck = await diceService.roll('d20', 'Проверка', unit.shortName, 'normal', true);
          additionalRolls.push(successCheck);
        }
        
        if (effect.spawnsExtra) {
          extraCardsToRoll += effect.spawnsExtra;
          triggerEffect('crit-gold');
        }
        
        if (isHit && hitResult.rawD20 === 20) {
          triggerEffect('crit-gold');
        }
        
        const cardResult: RokCardResult = {
          cardIndex,
          hitRoll: hitResult.total ?? 0,
          isHit,
          effectRoll,
          effectDescription: effect.name,
          additionalRolls
        };
        
        results.push(cardResult);
        
        // Формируем красивый вывод для Broadcast
        const interpretedResults = additionalRolls.map(r => `${r.label}: [${r.rolls.join(', ')}] = ${r.total}`);
        
        await diceService.broadcastRokCard(
          unit.shortName ?? unit.name,
          cardIndex,
          isHit,
          hitResult.rawD20 === 20,
          hitResult.rawD20 === 1,
          effect.icon,
          effect.name,
          hitResult.total ?? 0,
          effectRoll,
          interpretedResults
        );
        
        cardIndex++;
      }
      
      setCardResults(results);
      setTimeout(() => setShowResults(true), 100);
      
    } finally {
      setIsRolling(false);
    }
  };
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      <Section title="Колода Рока" icon="🃏">
        <div className="space-y-4">
          <div className="deck-counter">
            <div className="deck-counter-name">{rokDeck.icon} {rokDeck.name}</div>
            <div className={cn('deck-counter-number', cardsLeft < 5 && 'low', cardsLeft === 0 && 'empty')}>
              {cardsLeft}
            </div>
            <div className="deck-counter-label">из {rokDeck.max} карт</div>
          </div>
          
          <Select
            label="Цель броска"
            value={target}
            onChange={(e) => setTarget(e.target.value as RokTarget)}
            options={[
              { value: 'enemy', label: '👹 Враг' },
              { value: 'ally', label: '🛡️ Союзник' },
              { value: 'self', label: '🎭 Себя' }
            ]}
          />
          
          <div className="grid grid-cols-2 gap-3">
            <Button variant="gold" onClick={() => handleRollCards(1)} loading={isRolling} disabled={cardsLeft < 1} className="py-3">🃏 1 карта</Button>
            <Button variant="gold" onClick={() => handleRollCards(3)} loading={isRolling} disabled={cardsLeft < 3} className="py-3">🃏🃏🃏 3 карты</Button>
          </div>
        </div>
      </Section>
      
      {cardResults.length > 0 && showResults && (
        <Section title="Результаты" icon="📜">
          <div className="grid grid-cols-1 gap-4">
            {cardResults.map((result, index) => {
              const effect = getRokEffect(result.effectRoll);
              return (
                <div key={`${result.cardIndex}-${index}`} className="card-3d">
                  <div className="card-3d-inner animate-card-flip" style={{ animationDelay: `${index * 0.15}s` }}>
                    <div className="card-front"><span className="card-front-symbol">🃏</span></div>
                    <div className={cn('card-back p-3', result.isHit ? 'rok-card-hit' : 'rok-card-miss')}>
                      <div className="rok-card-header">
                        <span className="rok-card-number">#{result.cardIndex}</span>
                        <span className={cn('rok-card-status', result.isHit ? 'rok-card-status-hit' : 'rok-card-status-miss')}>
                          {result.isHit ? '🎯' : '💨'} [{result.hitRoll}]
                        </span>
                      </div>
                      <div>
                        <div className="rok-card-effect">{effect.icon} {effect.name}</div>
                        <div className="rok-card-desc">{effect.description}</div>
                      </div>
                      {(result.additionalRolls ?? []).length > 0 && (
                        <div className="rok-card-rolls">
                          {result.additionalRolls!.map((roll, idx) => (
                            <div key={idx} className="rok-card-roll-item">
                              {roll.label}: <span className="text-gold font-bold">{roll.total}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
