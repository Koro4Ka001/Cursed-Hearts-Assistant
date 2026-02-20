// src/components/tabs/MagicTab.tsx
import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { 
  Button, Section, Select, NumberStepper,
  DiceResultDisplay, EmptyState, RollModifierSelector 
} from '../ui';
import { diceService } from '../../services/diceService';
import { rollDice } from '../../utils/dice';
import type { DiceRollResult, Spell, ElementModifier } from '../../types';
import { DAMAGE_TYPE_NAMES, ELEMENT_NAMES } from '../../types';
import { ELEMENT_ICONS, SPELL_TYPES } from '../../constants/elements';

// ═══════════════════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════

interface ElementBonuses {
  castBonus: number;
  damageBonus: number;
  damageBonusPercent: number;
  manaReduction: number;
  manaReductionPercent: number;
}

/** Получить все бонусы от модификаторов элементов для заклинания */
function getElementBonuses(
  spellElements: string[],
  modifiers: ElementModifier[]
): ElementBonuses {
  let castBonus = 0;
  let damageBonus = 0;
  let damageBonusPercent = 0;
  let manaReduction = 0;
  let manaReductionPercent = 0;

  for (const element of spellElements) {
    const mod = modifiers.find(m => m.element === element && m.isActive);
    if (mod) {
      castBonus += mod.castBonus;
      damageBonus += mod.damageBonus;
      damageBonusPercent += mod.damageBonusPercent;
      manaReduction += mod.manaReduction;
      manaReductionPercent += mod.manaReductionPercent;
    }
  }

  return { castBonus, damageBonus, damageBonusPercent, manaReduction, manaReductionPercent };
}

/** Вычислить итоговую стоимость маны */
function calculateManaCost(baseCost: number, bonuses: ElementBonuses): number {
  let cost = baseCost;
  // Сначала процентное снижение
  if (bonuses.manaReductionPercent > 0) {
    cost = cost * (1 - bonuses.manaReductionPercent / 100);
  }
  // Потом абсолютное снижение
  cost = cost - bonuses.manaReduction;
  return Math.max(0, Math.round(cost));
}

/** Вычислить итоговый урон с бонусами */
function calculateDamageWithBonuses(baseDamage: number, bonuses: ElementBonuses): number {
  // Сначала фиксированный бонус
  let damage = baseDamage + bonuses.damageBonus;
  // Потом процентный бонус
  if (bonuses.damageBonusPercent > 0) {
    damage = damage * (1 + bonuses.damageBonusPercent / 100);
  }
  return Math.round(damage);
}

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export function MagicTab() {
  const { 
    units, selectedUnitId, 
    spendMana, setHP,
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
  const elementModifiers = unit.elementModifiers ?? [];
  
  // Бонусы от модификаторов элементов
  const spellElements = selectedSpell?.elements ?? [];
  const elementBonuses = getElementBonuses(spellElements, elementModifiers);
  
  // Итоговая стоимость маны
  const baseCost = selectedSpell?.manaCost ?? 0;
  const finalCost = calculateManaCost(baseCost, elementBonuses);
  const costSaved = baseCost - finalCost;
  
  // Итоговый бонус к касту (+ бонус от экипировки)
  const totalCastBonus = elementBonuses.castBonus + (selectedSpell?.equipmentBonus ?? 0);
  
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
    
    // Лог бонусов
    if (costSaved > 0) {
      log.push(`💠 Мана: ${baseCost} − ${costSaved} = ${finalCost}`);
    }
    if (totalCastBonus !== 0) {
      log.push(`🎯 Бонус к касту: ${totalCastBonus >= 0 ? '+' : ''}${totalCastBonus}`);
    }
    
    try {
      const newCastResults: DiceRollResult[] = [];
      const newDamageResults: DiceRollResult[] = [];
      
      // Определяем количество снарядов
      let projectileCount = 1;
      if (selectedSpell.projectiles) {
        if (/^\d+$/.test(selectedSpell.projectiles)) {
          projectileCount = parseInt(selectedSpell.projectiles, 10);
        } else {
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
            const damageResult = await diceService.rollDamage(
              selectedSpell.damageFormula,
              `Урон ${selectedSpell.name}`,
              unit.shortName ?? unit.name,
              isCrit
            );
            
            // Применяем бонусы от элементов
            const baseDmg = damageResult.total;
            const finalDmg = calculateDamageWithBonuses(baseDmg, elementBonuses);
            
            newDamageResults.push({
              ...damageResult,
              total: finalDmg
            });
            
            const critText = isCrit ? ' ×2' : '';
            const typeText = selectedSpell.damageType ? DAMAGE_TYPE_NAMES[selectedSpell.damageType] : '';
            const bonusText = finalDmg !== baseDmg ? ` (${baseDmg}+${finalDmg - baseDmg})` : '';
            log.push(`   💥 ${finalDmg}${critText} ${typeText}${bonusText}`);
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
  // МНОГОШАГОВЫЙ КАСТ
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
        const damageResult = await diceService.rollDamage(
          tier.formula,
          `Урон ${selectedSpell.name}`,
          unit.shortName ?? unit.name,
          powerResult.isCrit
        );
        
        // Применяем бонусы
        const baseDmg = damageResult.total;
        const finalDmg = calculateDamageWithBonuses(baseDmg, elementBonuses);
        
        setDamageResults([{ ...damageResult, total: finalDmg }]);
        
        const elementName = ELEMENT_NAMES[multiStepElement] ?? multiStepElement;
        const critText = powerResult.isCrit ? ' ×2 КРИТ!' : '';
        const bonusText = finalDmg !== baseDmg ? ` (${baseDmg}+${finalDmg - baseDmg})` : '';
        setCastLog(prev => [...prev, `💥 Урон: ${finalDmg}${bonusText}${critText} (${elementName})`]);
        
        if (powerResult.isCrit) {
          triggerEffect('crit-gold');
        }
        
        addCombatLog(unit.shortName ?? unit.name, selectedSpell.name, `${finalDmg} ${elementName}`);
        
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
                    {spellElements.map(el => {
                      const mod = elementModifiers.find(m => m.element === el && m.isActive);
                      const hasBonus = mod && (mod.castBonus !== 0 || mod.damageBonus !== 0 || mod.manaReduction !== 0);
                      return (
                        <span 
                          key={el} 
                          className={`px-2 py-0.5 rounded text-xs ${
                            hasBonus 
                              ? 'bg-gold/20 border border-gold/30 text-gold' 
                              : 'bg-panel text-ancient'
                          }`}
                          title={hasBonus ? `Есть бонусы от ${ELEMENT_NAMES[el]}` : undefined}
                        >
                          {ELEMENT_ICONS[el] ?? '✨'} {ELEMENT_NAMES[el] ?? el}
                          {hasBonus && ' ★'}
                        </span>
                      );
                    })}
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
                    {elementBonuses.damageBonus > 0 && (
                      <span className="text-gold ml-1">+{elementBonuses.damageBonus}</span>
                    )}
                    {elementBonuses.damageBonusPercent > 0 && (
                      <span className="text-gold ml-1">+{elementBonuses.damageBonusPercent}%</span>
                    )}
                  </div>
                )}
                
                {/* Стоимость */}
                <div className="text-xs">
                  <span className={selectedSpell.costType === 'health' ? 'text-blood-bright' : 'text-mana-bright'}>
                    Стоимость: {finalCost} {selectedSpell.costType === 'health' ? 'HP' : 'маны'}
                  </span>
                  {costSaved > 0 && (
                    <span className="text-green-500 ml-1">(−{costSaved})</span>
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
            
            {/* Количество целей */}
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
      
      {/* Активные модификаторы элементов */}
      {elementModifiers.filter(m => m.isActive).length > 0 && (
        <Section title="Активные модификаторы" icon="🔮">
          <div className="space-y-1">
            {elementModifiers.filter(m => m.isActive).map(mod => {
              const parts: string[] = [];
              if (mod.castBonus !== 0) parts.push(`🎯${mod.castBonus > 0 ? '+' : ''}${mod.castBonus}`);
              if (mod.damageBonus !== 0) parts.push(`💥${mod.damageBonus > 0 ? '+' : ''}${mod.damageBonus}`);
              if (mod.damageBonusPercent !== 0) parts.push(`💥${mod.damageBonusPercent > 0 ? '+' : ''}${mod.damageBonusPercent}%`);
              if (mod.manaReduction !== 0) parts.push(`💠−${mod.manaReduction}`);
              if (mod.manaReductionPercent !== 0) parts.push(`💠−${mod.manaReductionPercent}%`);
              if (mod.resistance !== 0) parts.push(`🛡️${mod.resistance}`);
              if (mod.damageMultiplier !== 1) parts.push(`×${mod.damageMultiplier}`);
              
              if (parts.length === 0) return null;
              
              return (
                <div key={mod.id} className="flex items-center justify-between text-xs p-1 bg-obsidian rounded">
                  <span className="text-ancient">
                    {ELEMENT_ICONS[mod.element] ?? '✨'} {ELEMENT_NAMES[mod.element] ?? mod.element}
                  </span>
                  <span className="text-gold">{parts.join(' ')}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
