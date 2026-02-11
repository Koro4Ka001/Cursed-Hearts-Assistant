import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, EmptyState } from '../ui';
import { ROK_EFFECTS, getRokEffect } from '../../constants/rokEffects';
import { diceService } from '../../services/diceService';
import type { RokCardResult, DiceRollResult } from '../../types';

type RokTarget = 'enemy' | 'ally' | 'self';

export function CardsTab() {
  const { units, selectedUnitId, spendResource, setActiveTab } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [target, setTarget] = useState<RokTarget>('enemy');
  const [isRolling, setIsRolling] = useState(false);
  const [cardResults, setCardResults] = useState<RokCardResult[]>([]);
  
  // Защита от отсутствия юнита
  if (!unit) {
    return (
      <EmptyState
        icon="🃏"
        title="Нет персонажа"
        description="Выберите персонажа"
      />
    );
  }
  
  // Проверяем, есть ли у персонажа карты Рока
  if (!unit.hasRokCards) {
    return (
      <EmptyState
        icon="🃏"
        title="Нет колоды Рока"
        description="У этого персонажа нет способности Карты Рока"
      />
    );
  }
  
  // Находим ресурс колоды по rokDeckResourceId
  const resources = unit.resources ?? [];
  const rokDeck = unit.rokDeckResourceId 
    ? resources.find(r => r.id === unit.rokDeckResourceId)
    : null;
  
  // Если ресурс не привязан — показываем сообщение
  if (!rokDeck) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <div className="text-4xl mb-4">🃏</div>
        <h3 className="heading text-gold mb-2">Колода не привязана</h3>
        <p className="text-faded text-sm text-center mb-4">
          Привяжите ресурс колоды в настройках персонажа
        </p>
        <Button 
          variant="gold" 
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Открыть настройки
        </Button>
      </div>
    );
  }
  
  const cardsLeft = rokDeck.current ?? 0;
  const maxCards = rokDeck.max ?? 0;
  
  // Бросок карт через diceService
  const handleRollCards = async (count: number) => {
    if (cardsLeft < count) {
      await diceService.showNotification(`❌ Недостаточно карт! Осталось ${cardsLeft}`);
      return;
    }
    
    setIsRolling(true);
    setCardResults([]);
    
    const results: RokCardResult[] = [];
    let extraCardsToRoll = 0;
    
    try {
      // Тратим карты
      await spendResource(unit.id, rokDeck.id, count);
      
      // Бросаем указанное количество карт + дополнительные от эффекта 17
      let cardsToProcess = count;
      let cardIndex = 1;
      
      while (cardsToProcess > 0 || extraCardsToRoll > 0) {
        if (cardsToProcess > 0) {
          cardsToProcess--;
        } else if (extraCardsToRoll > 0) {
          extraCardsToRoll--;
        }
        
        // Бросок на попадание через diceService
        const hitResult = await diceService.roll('d20', `Карта ${cardIndex} попадание`, unit.shortName);
        const isHit = (hitResult.total ?? 0) >= 11;
        
        // Бросок на эффект через diceService
        const effectResult = await diceService.roll('d20', `Карта ${cardIndex} эффект`, unit.shortName);
        const effectRoll = effectResult.rawD20 ?? effectResult.total ?? 1;
        const effect = getRokEffect(effectRoll);
        
        // Дополнительные броски
        const additionalRolls: DiceRollResult[] = [];
        
        if (effect.additionalRolls) {
          for (const roll of effect.additionalRolls) {
            const result = await diceService.roll(roll.dice, roll.label, unit.shortName);
            additionalRolls.push(result);
          }
        }
        
        // Проверка успеха (если требуется)
        if (effect.requiresSuccessCheck) {
          const successCheck = await diceService.roll('d20', 'Проверка успеха', unit.shortName);
          additionalRolls.push(successCheck);
        }
        
        // Эффект раздвоения — добавляем бонусные карты
        if (effect.spawnsExtra) {
          extraCardsToRoll += effect.spawnsExtra;
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
        
        // Анонсируем
        await diceService.announceRokCard(
          unit.shortName,
          cardIndex,
          isHit,
          effect.name,
          hitResult.total ?? 0,
          effectRoll
        );
        
        cardIndex++;
      }
      
      setCardResults(results);
      
    } finally {
      setIsRolling(false);
    }
  };
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      <Section title="Колода Рока" icon="🃏">
        <div className="space-y-3">
          {/* Счётчик карт */}
          <div className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
            <div>
              <span className="text-bone font-garamond">{rokDeck.icon ?? '🃏'} {rokDeck.name}</span>
            </div>
            <span className={`font-cinzel text-lg ${cardsLeft < 5 ? 'text-blood-bright' : 'text-gold'}`}>
              {cardsLeft}/{maxCards}
            </span>
          </div>
          
          {/* Выбор цели */}
          <Select
            label="Цель"
            value={target}
            onChange={(e) => setTarget(e.target.value as RokTarget)}
            options={[
              { value: 'enemy', label: '👹 Враг' },
              { value: 'ally', label: '🛡️ Союзник' },
              { value: 'self', label: '🎭 Себя' }
            ]}
          />
          
          {/* Кнопки бросков */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="gold"
              onClick={() => handleRollCards(1)}
              loading={isRolling}
              disabled={cardsLeft < 1}
              className="w-full"
            >
              🃏 1 карта
            </Button>
            <Button
              variant="gold"
              onClick={() => handleRollCards(3)}
              loading={isRolling}
              disabled={cardsLeft < 3}
              className="w-full"
            >
              🃏🃏🃏 3 карты
            </Button>
          </div>
          
          {cardsLeft === 0 && (
            <div className="text-blood-bright text-xs text-center">
              Колода пуста!
            </div>
          )}
        </div>
      </Section>
      
      {/* Результаты */}
      {cardResults.length > 0 && (
        <Section title="Результаты" icon="📜">
          <div className="space-y-3">
            {cardResults.map((result, index) => {
              const effect = getRokEffect(result.effectRoll);
              
              return (
                <div key={result.cardIndex} className="card-3d">
                  <div 
                    className="card-3d-inner animate-card-flip"
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    <div
                      className={`p-3 rounded border ${
                        result.isHit 
                          ? 'border-gold bg-gold-dark/10' 
                          : 'border-edge-bone bg-obsidian'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-cinzel text-gold">
                          Карта {result.cardIndex}
                        </span>
                        <span className={result.isHit ? 'text-heal-bright' : 'text-blood-bright'}>
                          {result.isHit ? '🎯 Попала' : '💨 Промах'} [{result.hitRoll}]
                        </span>
                      </div>
                      
                      <div className="text-sm">
                        <div className="text-ancient font-bold">
                          Эффект [{result.effectRoll}]: {effect.name}
                        </div>
                        <div className="text-faded text-xs mt-1">
                          {effect.description}
                        </div>
                        
                        {/* Дополнительные броски */}
                        {(result.additionalRolls ?? []).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {(result.additionalRolls ?? []).map((roll, idx) => (
                              <div key={idx} className="text-xs text-bone">
                                {roll.label}: [{(roll.rolls ?? []).join(', ')}] = <span className="text-gold">{roll.total}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Специальные метки */}
                        {effect.isRecursive && (
                          <div className="mt-1 text-xs text-mana-bright">
                            🔄 Рикошет! Бросьте для ближайшего существа
                          </div>
                        )}
                        {effect.spawnsExtra && (
                          <div className="mt-1 text-xs text-gold-bright">
                            ✨ +{effect.spawnsExtra} бонусных карт!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
      
      {/* Справка по эффектам */}
      <Section title="Справка по эффектам" icon="📖" collapsible defaultOpen={false}>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {ROK_EFFECTS.map((effect) => (
            <div key={effect.id} className="text-xs border-b border-edge-bone pb-1">
              <span className="text-gold font-bold">[{effect.id}]</span>{' '}
              <span className="text-ancient">{effect.name}</span>
              <div className="text-faded">{effect.description}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
