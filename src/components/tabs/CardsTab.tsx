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
  
  // Защита от отсутствия юнита
  if (!unit) {
    return (
      <EmptyState
        icon="🃏"
        title="Нет персонажа"
        description="Выберите персонажа для использования Карт Рока"
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
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-5xl mb-4 animate-float">🃏</div>
        <h3 className="font-cinzel text-gold text-lg uppercase tracking-widest mb-2">
          Колода не привязана
        </h3>
        <p className="text-faded font-garamond text-sm mb-6 max-w-[280px]">
          Выберите ресурс колоды в настройках персонажа, чтобы использовать Карты Рока
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
  const maxCards = rokDeck.max ?? 1;
  const isLowDeck = cardsLeft < 5 && cardsLeft > 0;
  const isEmptyDeck = cardsLeft === 0;
  
  // Бросок карт через diceService
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
        
        // 🔹 SILENT: TRUE — не спамим в чат броском попадания
        const hitResult = await diceService.roll('d20', `Карта ${cardIndex} попадание`, unit.shortName, 'normal', true);
        const isHit = (hitResult.total ?? 0) >= 11;
        
        // 🔹 SILENT: TRUE — не спамим в чат броском эффекта
        const effectResult = await diceService.roll('d20', `Карта ${cardIndex} эффект`, unit.shortName, 'normal', true);
        const effectRoll = effectResult.rawD20 ?? effectResult.total ?? 1;
        const effect = getRokEffect(effectRoll);
        
        // Дополнительные броски
        const additionalRolls: DiceRollResult[] = [];
        
        if (effect.additionalRolls) {
          for (const roll of effect.additionalRolls) {
            // 🔹 SILENT: TRUE — не спамим доп бросками
            const result = await diceService.roll(roll.dice, roll.label, unit.shortName, 'normal', true);
            additionalRolls.push(result);
          }
        }
        
        // Проверка успеха (если требуется)
        if (effect.requiresSuccessCheck) {
          const successCheck = await diceService.roll('d20', 'Проверка успеха', unit.shortName, 'normal', true);
          additionalRolls.push(successCheck);
        }
        
        // Эффект раздвоения — добавляем бонусные карты
        if (effect.spawnsExtra) {
          extraCardsToRoll += effect.spawnsExtra;
          // Эффект золотой вспышки для раздвоения
          triggerEffect('crit-gold');
        }
        
        // Эффект на экран при попадании
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
        
        // Формируем красивые строки для Broadcast
        const interpretedResults = additionalRolls.map(r => 
          `${r.label}: [${r.rolls.join(', ')}] = ${r.total}`
        );
        
        // Анонсируем ОДНИМ красивым сообщением
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
      // Небольшая задержка перед показом результатов для эффекта
      setTimeout(() => setShowResults(true), 100);
      
    } finally {
      setIsRolling(false);
    }
  };
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      {/* Секция колоды */}
      <Section title="Колода Рока" icon="🃏">
        <div className="space-y-4">
          {/* Большой счётчик колоды */}
          <div className="deck-counter">
            <div className="deck-counter-name">
              {rokDeck.icon ?? '🃏'} {rokDeck.name}
            </div>
            <div className={cn(
              'deck-counter-number',
              isLowDeck && 'low',
              isEmptyDeck && 'empty'
            )}>
              {cardsLeft}
            </div>
            <div className="deck-counter-label">
              из {maxCards} карт
            </div>
          </div>
          
          {/* Предупреждение о пустой колоде */}
          {isEmptyDeck && (
            <div className="text-center py-2">
              <div className="text-blood-bright font-cinzel text-xs uppercase tracking-wider animate-pulse">
                ⚠️ Колода пуста! ⚠️
              </div>
            </div>
          )}
          
          {/* Выбор цели */}
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
          
          {/* Кнопки бросков */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="gold"
              onClick={() => handleRollCards(1)}
              loading={isRolling}
              disabled={cardsLeft < 1}
              className="w-full py-3"
            >
              🃏 1 карта
            </Button>
            <Button
              variant="gold"
              onClick={() => handleRollCards(3)}
              loading={isRolling}
              disabled={cardsLeft < 3}
              className="w-full py-3"
            >
              🃏🃏🃏 3 карты
            </Button>
          </div>
          
          {/* Подсказка */}
          <div className="text-center text-[10px] text-dim font-garamond">
            Попадание: d20 ≥ 11 • Эффект: d20 → таблица
          </div>
        </div>
      </Section>
      
      {/* Результаты с 3D переворотом */}
      {cardResults.length > 0 && showResults && (
        <Section title="Результаты" icon="📜">
          <div className="grid grid-cols-1 gap-4">
            {cardResults.map((result, index) => {
              const effect = getRokEffect(result.effectRoll);
              
              return (
                <div 
                  key={`${result.cardIndex}-${index}`} 
                  className="card-3d"
                  style={{ minHeight: '120px' }}
                >
                  <div 
                    className="card-3d-inner animate-card-flip"
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    {/* Рубашка карты (видна до переворота) */}
                    <div className="card-front">
                      <span className="card-front-symbol">🃏</span>
                    </div>
                    
                    {/* Лицевая сторона (результат) */}
                    <div className={cn(
                      'card-back p-3 rounded',
                      result.isHit ? 'rok-card-hit' : 'rok-card-miss'
                    )}>
                      {/* Заголовок карты */}
                      <div className="rok-card-header">
                        <span className="rok-card-number">
                          #{result.cardIndex}
                        </span>
                        <span className={cn(
                          'rok-card-status',
                          result.isHit ? 'rok-card-status-hit' : 'rok-card-status-miss'
                        )}>
                          {result.isHit ? '🎯 ' : '💨 '}
                          [{result.hitRoll}]
                        </span>
                      </div>
                      
                      {/* Эффект */}
                      <div>
                        <div className="rok-card-effect">
                          {effect.icon} [{result.effectRoll}] {effect.name}
                        </div>
                        <div className="rok-card-desc">
                          {effect.description}
                        </div>
                      </div>
                      
                      {/* Дополнительные броски */}
                      {(result.additionalRolls ?? []).length > 0 && (
                        <div className="rok-card-rolls">
                          {(result.additionalRolls ?? []).map((roll: DiceRollResult, idx: number) => (
                            <div key={idx} className="rok-card-roll-item">
                              {roll.label}: 
                              <span className="text-faded"> [{(roll.rolls ?? []).join(', ')}] </span>
                              = <span className="text-gold font-bold">{roll.total}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Специальные метки */}
                      <div className="flex flex-wrap gap-2">
                        {effect.isRecursive && (
                          <div className="rok-card-badge rok-card-badge-recursive">
                            🔄 Рикошет
                          </div>
                        )}
                        {effect.spawnsExtra && (
                          <div className="rok-card-badge rok-card-badge-extra">
                            ✨ +{effect.spawnsExtra} карт
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
      <Section title="Таблица эффектов" icon="📖" collapsible defaultOpen={false}>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {ROK_EFFECTS.map((effect) => (
            <div 
              key={effect.id} 
              className="flex items-start gap-2 py-1.5 border-b border-edge-bone/30 last:border-0"
            >
              <span className="font-cinzel text-gold font-bold text-xs w-6 shrink-0">
                [{effect.id}]
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-cinzel text-ancient text-xs uppercase tracking-wide">
                  {effect.icon} {effect.name}
                </div>
                <div className="font-garamond text-faded text-[11px] leading-snug">
                  {effect.description}
                </div>
                {effect.additionalRolls && effect.additionalRolls.length > 0 && (
                  <div className="text-[10px] text-mana-bright mt-0.5">
                    Броски: {effect.additionalRolls.map(r => r.dice).join(', ')}
                  </div>
                )}
                {effect.isRecursive && (
                  <span className="text-[9px] text-mana-bright">🔄 Рикошет</span>
                )}
                {effect.spawnsExtra && (
                  <span className="text-[9px] text-gold-bright ml-2">✨ +{effect.spawnsExtra}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
