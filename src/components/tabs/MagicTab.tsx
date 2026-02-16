// src/components/tabs/MagicTab.tsx
import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { 
  Button, Section, Select, NumberStepper, Checkbox, 
  DiceResultDisplay, EmptyState, RollModifierSelector 
} from '../ui';
import { diceService } from '../../services/diceService';
import { rollDice, parseFormula } from '../../utils/dice';
import type { DiceRollResult, Spell, DamageType, AffinityBonusType } from '../../types';
import { DAMAGE_TYPE_NAMES, ELEMENT_NAMES } from '../../types';
import { ELEMENT_ICONS, SPELL_TYPES } from '../../constants/elements';

// ═══════════════════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════

/** Получить бонусы от предрасположенностей для элементов заклинания */
function getAffinityBonuses(
  elements: string[],
  affinities: { element: string; bonusType: AffinityBonusType; value: number }[]
): { castBonus: number; manaReduction: number; damageBonus: number } {
  let castBonus = 0;
  let manaReduction = 0;
  let damageBonus = 0;

  for (const element of elements) {
    for (const aff of affinities) {
      if (aff.element === element) {
        switch (aff.bonusType) {
          case 'castHit':
            castBonus += aff.value;
            break;
          case 'manaCost':
            manaReduction += aff.value;
            break;
          case 'damage':
            damageBonus += aff.value;
            break;
        }
      }
    }
  }

  return { castBonus, manaReduction, damageBonus };
}

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export function MagicTab() {
  const { 
    units, selectedUnitId, 
    spendMana, setHP, setMana,
    triggerEffect, addCombatLog, addNotification,
    nextRollModifier, setNextRollModifier 
  } = useGameStore();
  
  const unit = units.find(u => u.id === selectedUnitId);
  
  // Состояние
  const [selectedSpellId, setSelectedSpellId] = useState<string>('');
  const [targetCount, setTargetCount] = useState(1);
  const [isCasting, setIsCasting] = useState(false);
  const [castResults, setCastResults] = useState<DiceRollResult[]>([]);
  const [damageResults, setDamageResults] = useState<DiceRollResult[]>([]);
  const [castLog, setCastLog] = useState<string[]>([]);
  
  // Многошаговый режим
  const [multiStepPhase, setMultiStepPhase] = useState<'idle' | 'element' | 'power' | 'done'>('idle');
  const [multiStepElement, setMultiStepElement] = useState<string>('');
  const [multiStepPowerRoll, setMultiStepPowerRoll] = useState<number>(0);
  
  // ─────────────────────────────────────────────────────────────────────────
  // ПРОВЕРКИ
  // ─────────────────────────────────────────────────────────────────────────
  
  if (!unit) {
    return (
      <EmptyState
        icon="✨"
        title="Нет персонажа"
        description="Выберите персонажа для магии"
      />
    );
  }
  
  const spells = unit.spells ?? [];
  const selectedSpell = spells.find(s => s.id === selectedSpellId) ?? spells[0];
  const affinities = unit.elementAffinities ?? [];
  const magicBonuses = unit.magicBonuses ?? {};
  
  // Бонусы от предрасположенностей
  const spellElements = selectedSpell?.elements ?? [];
  const affBonuses = getAffinityBonuses(spellElements, affinities);
  
  // Бонус к касту от магических бонусов персонажа
  let magicCastBonus = 0;
  for (const el of spellElements) {
    magicCastBonus += magicBonuses[el] ?? 0;
  }
  
  // Итоговая стоимость маны
  const baseCost = selectedSpell?.manaCost ?? 0;
  const finalCost = Math.max(0, baseCost - affBonuses.manaReduction);
  
  // Итоговый бонус к касту
  const totalCastBonus = affBonuses.castBonus + magicCastBonus + (selectedSpell?.equipmentBonus ?? 0);
  
  // ─────────────────────────────────────────────────────────────────────────
  // ОБЫЧНЫЙ КАСТ
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleCast = async () => {
    if (!selectedSpell) return;
    
    // Многошаговый режим?
    if (selectedSpell.isMultiStep) {
      await handleMultiStepCast();
      return;
    }
    
    // Проверяем и тратим ресурс
    if (selectedSpell.costType === 'health') {
      const newHp = unit.health.current - finalCost;
      if (newHp < 0) {
        addNotification(`Недостаточно HP! Нужно ${finalCost}, есть ${unit.health.current}`, 'warning');
        return;
      }
      await setHP(unit.id, newHp);
      addCombatLog(unit.shortName ?? unit.name, 'Кровавая магия', `-${finalCost} HP`);
    } else {
      if (unit.mana.current < finalCost) {
        addNotification(`Недостаточно маны! Нужно ${finalCost}, есть ${unit.mana.current}`, 'warning');
        return;
      }
      await spendMana(unit.id, finalCost);
    }
    
    setIsCasting(true);
    setCastResults([]);
    setDamageResults([]);
    setCastLog([]);
    
    const modifier = nextRollModifier;
    setNextRollModifier('normal');
    
    const log: string[] = [];
    
    try {
      const newCastResults: DiceRollResult[] = [];
      const newDamageResults: DiceRollResult[] = [];
      
      // Определяем количество снарядов
      let projectileCount = 1;
      if (selectedSpell.projectiles) {
        if (/^\d+$/.test(selectedSpell.projectiles)) {
          projectileCount = parseInt(selectedSpell.projectiles, 10);
        } else {
          // Формула типа "d4" или "2d6+1"
          const projResult = rollDice(selectedSpell.projectiles);
          projectileCount = projResult.total;
          log.push(`🎲 Снарядов: ${selectedSpell.projectiles} = ${projectileCount}`);
        }
      }
      
      // Для каждой цели
      for (let target = 0; target < targetCount; target++) {
        if (targetCount > 1) {
          log.push(`--- Цель ${target + 1} ---`);
        }
        
        // Для каждого снаряда
        for (let proj = 0; proj < projectileCount; proj++) {
          // Бросок на каст/попадание
          const castFormula = totalCastBonus >= 0 ? `d20+${totalCastBonus}` : `d20${totalCastBonus}`;
          const useModifier = (target === 0 && proj === 0) ? modifier : 'normal';
          
          const castResult = await diceService.roll(
            castFormula,
            projectileCount > 1 ? `Каст ${selectedSpell.name} #${proj + 1}` : `Каст ${selectedSpell.name}`,
            unit.shortName ?? unit.name,
            useModifier
          );
          newCastResults.push(castResult);
          
          const modText = castResult.allD20Rolls && castResult.allD20Rolls.length > 1
            ? ` (${castResult.rollModifier === 'advantage' ? '🎯' : '💨'}[${castResult.allD20Rolls.join(',')}])`
            : '';
          
          // Крит провал
          if (castResult.isCritFail) {
            log.push(`💀 Снаряд ${proj + 1}: [${castResult.rawD20}]${modText} = КРИТ ПРОВАЛ!`);
            triggerEffect('crit-fail');
            continue;
          }
          
          // Крит успех
          const isCrit = castResult.isCrit;
          if (isCrit) {
            log.push(`✨ Снаряд ${proj + 1}: [${castResult.rawD20}] + ${totalCastBonus} = ${castResult.total}${modText} — КРИТ!`);
            triggerEffect('crit-gold');
          } else {
            log.push(`🎯 Снаряд ${proj + 1}: [${castResult.rawD20}] + ${totalCastBonus} = ${castResult.total}${modText}`);
          }
          
          // Урон (если есть формула)
          if (selectedSpell.damageFormula) {
            // Добавляем бонус от предрасположенности к урону
            let dmgFormula = selectedSpell.damageFormula;
            if (affBonuses.damageBonus > 0) {
              dmgFormula = `${dmgFormula}+${affBonuses.damageBonus}`;
            }
            
            const damageResult = await diceService.rollDamage(
              dmgFormula,
              `Урон ${selectedSpell.name}`,
              unit.shortName ?? unit.name,
              isCrit
            );
            newDamageResults.push(damageResult);
            
            const critText = isCrit ? ' ×2' : '';
            const typeText = selectedSpell.damageType ? DAMAGE_TYPE_NAMES[selectedSpell.damageType] : '';
            log.push(`   💥 ${damageResult.total}${critText} ${typeText}`);
          }
        }
      }
      
      setCastResults(newCastResults);
      setDamageResults(newDamageResults);
      setCastLog(log);
      
      // Лог в хронику
      const totalDamage = newDamageResults.reduce((sum, r) => sum + r.total, 0);
      if (totalDamage > 0) {
        addCombatLog(unit.shortName ?? unit.name, selectedSpell.name, `${totalDamage} урона`);
      } else {
        addCombatLog(unit.shortName ?? unit.name, selectedSpell.name, 'скастовано');
      }
      
    } finally {
      setIsCasting(false);
    }
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // МНОГОШАГОВЫЙ КАСТ (d20 → d12 элемент → d20 сила → урон)
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleMultiStepCast = async () => {
    if (!selectedSpell) return;
    
    // Фаза 1: Бросок на каст d20
    if (multiStepPhase === 'idle') {
      // Тратим ману
      if (selectedSpell.costType === 'health') {
        const newHp = unit.health.current - finalCost;
        if (newHp < 0) {
          addNotification(`Недостаточно HP!`, 'warning');
          return;
        }
        await setHP(unit.id, newHp);
      } else {
        if (unit.mana.current < finalCost) {
          addNotification(`Недостаточно маны!`, 'warning');
          return;
        }
        await spendMana(unit.id, finalCost);
      }
      
      setIsCasting(true);
      setCastResults([]);
      setDamageResults([]);
      setCastLog([]);
      
      const modifier = nextRollModifier;
      setNextRollModifier('normal');
      
      try {
        const castFormula = totalCastBonus >= 0 ? `d20+${totalCastBonus}` : `d20${totalCastBonus}`;
        const castResult = await diceService.roll(
          castFormula,
          `Каст ${selectedSpell.name}`,
          unit.shortName ?? unit.name,
          modifier
        );
        
        setCastResults([castResult]);
        setCastLog([`🎲 Каст: [${castResult.rawD20}] + ${totalCastBonus} = ${castResult.total}`]);
        
        if (castResult.isCritFail) {
          setCastLog(prev => [...prev, '💀 КРИТ ПРОВАЛ! Заклинание сорвалось.']);
          triggerEffect('crit-fail');
          setMultiStepPhase('idle');
        } else {
          setMultiStepPhase('element');
          setCastLog(prev => [...prev, '✨ Успех! Теперь бросьте d12 для определения элемента.']);
        }
      } finally {
        setIsCasting(false);
      }
      return;
    }
    
    // Фаза 2: d12 на элемент
    if (multiStepPhase === 'element') {
      setIsCasting(true);
      try {
        const elementResult = await diceService.roll(
          'd12',
          'Элемент заклинания',
          unit.shortName ?? unit.name
        );
        
        const elementTable = selectedSpell.elementTable ?? {};
        const element = elementTable[elementResult.total] ?? 'fire';
        setMultiStepElement(element);
        
        const elementName = ELEMENT_NAMES[element] ?? element;
        const elementIcon = ELEMENT_ICONS[element] ?? '✨';
        
        setCastLog(prev => [
          ...prev, 
          `🎲 Элемент: [${elementResult.total}] → ${elementIcon} ${elementName}`,
          '⚡ Теперь бросьте d20 для определения силы заклинания.'
        ]);
        
        setMultiStepPhase('power');
      } finally {
        setIsCasting(false);
      }
      return;
    }
    
    // Фаза 3: d20 на силу → урон
    if (multiStepPhase === 'power') {
      setIsCasting(true);
      try {
        const powerResult = await diceService.roll(
          'd20',
          'Сила заклинания',
          unit.shortName ?? unit.name
        );
        
        setMultiStepPowerRoll(powerResult.total);
        
        // Находим tier по броску
        const tiers = selectedSpell.damageTiers ?? [];
        const tier = tiers.find(t => powerResult.total >= t.minRoll && powerResult.total <= t.maxRoll);
        
        if (!tier) {
          setCastLog(prev => [...prev, `🎲 Сила: [${powerResult.total}] — Нет подходящего tier'а!`]);
          setMultiStepPhase('done');
          return;
        }
        
        setCastLog(prev => [...prev, `🎲 Сила: [${powerResult.total}] → ${tier.label ?? tier.formula}`]);
        
        // Бросаем урон
        let dmgFormula = tier.formula;
        if (affBonuses.damageBonus > 0) {
          dmgFormula = `${dmgFormula}+${affBonuses.damageBonus}`;
        }
        
        const damageResult = await diceService.rollDamage(
          dmgFormula,
          `Урон ${selectedSpell.name}`,
          unit.shortName ?? unit.name,
          powerResult.isCrit
        );
        
        setDamageResults([damageResult]);
        
        const elementName = ELEMENT_NAMES[multiStepElement] ?? multiStepElement;
        const critText = powerResult.isCrit ? ' ×2 КРИТ!' : '';
        setCastLog(prev => [...prev, `💥 Урон: ${damageResult.total}${critText} (${elementName})`]);
        
        if (powerResult.isCrit) {
          triggerEffect('crit-gold');
        }
        
        addCombatLog(unit.shortName ?? unit.name, selectedSpell.name, `${damageResult.total} ${elementName}`);
        
        setMultiStepPhase('done');
      } finally {
        setIsCasting(false);
      }
      return;
    }
  };
  
  const resetMultiStep = () => {
    setMultiStepPhase('idle');
    setMultiStepElement('');
    setMultiStepPowerRoll(0);
    setCastResults([]);
    setDamageResults([]);
    setCastLog([]);
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // РЕНДЕР
  // ─────────────────────────────────────────────────────────────────────────
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      
      {/* Модификатор броска */}
      <Section title="Модификатор" icon="🎲">
        <RollModifierSelector
          value={nextRollModifier}
          onChange={setNextRollModifier}
        />
      </Section>
      
      {/* Заклинания */}
      <Section title="Заклинания" icon="✨">
        {spells.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">📜</div>
            <p className="text-faded text-sm">Добавьте заклинания в настройках персонажа</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Select
              label="Заклинание"
              value={selectedSpell?.id ?? ''}
              onChange={(e) => {
                setSelectedSpellId(e.target.value);
                resetMultiStep();
              }}
              options={spells.map(s => ({
                value: s.id,
                label: `${s.name} (${s.manaCost} ${s.costType === 'health' ? 'HP' : 'маны'})`
              }))}
            />
            
            {selectedSpell && (
              <div className="p-2 bg-obsidian rounded border border-edge-bone space-y-2">
                {/* Элементы */}
                {spellElements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {spellElements.map(el => (
                      <span key={el} className="px-2 py-0.5 bg-panel rounded text-xs text-ancient">
                        {ELEMENT_ICONS[el] ?? '✨'} {ELEMENT_NAMES[el] ?? el}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Тип */}
                <div className="text-xs text-faded">
                  Тип: {SPELL_TYPES[selectedSpell.type] ?? selectedSpell.type}
                  {selectedSpell.projectiles && selectedSpell.projectiles !== '1' && (
                    <span className="text-ancient ml-2">• Снаряды: {selectedSpell.projectiles}</span>
                  )}
                </div>
                
                {/* Урон */}
                {selectedSpell.damageFormula && (
                  <div className="text-xs">
                    <span className="text-blood-bright">Урон: {selectedSpell.damageFormula}</span>
                    {selectedSpell.damageType && (
                      <span className="text-faded ml-1">({DAMAGE_TYPE_NAMES[selectedSpell.damageType]})</span>
                    )}
                    {affBonuses.damageBonus > 0 && (
                      <span className="text-gold ml-1">+{affBonuses.damageBonus} от предрасп.</span>
                    )}
                  </div>
                )}
                
                {/* Стоимость */}
                <div className="text-xs">
                  <span className={selectedSpell.costType === 'health' ? 'text-blood-bright' : 'text-mana-bright'}>
                    Стоимость: {finalCost} {selectedSpell.costType === 'health' ? 'HP' : 'маны'}
                  </span>
                  {affBonuses.manaReduction > 0 && (
                    <span className="text-green-500 ml-1">(−{affBonuses.manaReduction} от предрасп.)</span>
                  )}
                </div>
                
                {/* Бонус к касту */}
                {totalCastBonus !== 0 && (
                  <div className="text-xs text-gold">
                    Бонус к касту: {totalCastBonus >= 0 ? '+' : ''}{totalCastBonus}
                  </div>
                )}
                
                {/* Описание */}
                {selectedSpell.description && (
                  <div className="text-xs text-bone italic border-t border-edge-bone pt-2 mt-2">
                    {selectedSpell.description}
                  </div>
                )}
                
                {/* Многошаговый режим */}
                {selectedSpell.isMultiStep && (
                  <div className="text-xs text-ancient border-t border-edge-bone pt-2 mt-2">
                    ⚡ Многошаговое заклинание: d20 каст → d12 элемент → d20 сила → урон
                  </div>
                )}
              </div>
            )}
            
            {/* Количество целей (не для многошаговых) */}
            {selectedSpell && !selectedSpell.isMultiStep && (
              <NumberStepper
                label="Количество целей"
                value={targetCount}
                onChange={setTargetCount}
                min={1}
                max={10}
              />
            )}
            
            {/* Кнопка каста */}
            <Button
              variant="gold"
              onClick={handleCast}
              loading={isCasting}
              disabled={!selectedSpell || (multiStepPhase === 'done')}
              className="w-full"
            >
              {selectedSpell?.isMultiStep ? (
                multiStepPhase === 'idle' ? '✨ НАЧАТЬ КАСТ' :
                multiStepPhase === 'element' ? '🎲 БРОСИТЬ D12 (ЭЛЕМЕНТ)' :
                multiStepPhase === 'power' ? '⚡ БРОСИТЬ D20 (СИЛА)' :
                '✓ ЗАВЕРШЕНО'
              ) : (
                `✨ СОТВОРИТЬ ${nextRollModifier !== 'normal' ? (nextRollModifier === 'advantage' ? '🎯' : '💨') : ''}`
              )}
            </Button>
            
            {/* Сброс многошагового */}
            {selectedSpell?.isMultiStep && multiStepPhase !== 'idle' && (
              <Button
                variant="secondary"
                onClick={resetMultiStep}
                className="w-full"
              >
                ↺ Сбросить
              </Button>
            )}
            
            {/* Лог каста */}
            {castLog.length > 0 && (
              <div className="p-2 bg-obsidian rounded border border-edge-bone space-y-1 max-h-48 overflow-y-auto">
                {castLog.map((line, idx) => (
                  <div key={idx} className="text-sm font-garamond">{line}</div>
                ))}
              </div>
            )}
            
            {/* Результаты бросков */}
            {castResults.length > 0 && !selectedSpell?.isMultiStep && (
              <div className="space-y-2">
                <div className="text-xs text-faded uppercase">Броски каста:</div>
                <DiceResultDisplay results={castResults} />
              </div>
            )}
            
            {damageResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-faded uppercase">Урон:</div>
                <DiceResultDisplay results={damageResults} />
              </div>
            )}
          </div>
        )}
      </Section>
      
      {/* Мана персонажа */}
      <Section title="Ресурсы" icon="💠">
        <div className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
          <span className="text-mana-bright">💠 Мана</span>
          <span className="text-bone font-bold">{unit.mana.current} / {unit.mana.max}</span>
        </div>
        {unit.useManaAsHp && (
          <div className="text-xs text-ancient mt-2">
            💠 Мана используется как жизнь
          </div>
        )}
      </Section>
    </div>
  );
}
