// src/components/tabs/MagicTab.tsx
import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, NumberStepper, Checkbox, DiceResultDisplay, EmptyState, RollModifierSelector } from '../ui';
import { getMaxMagicBonus, isHit } from '../../utils/dice';
import { getIntelligenceBonus } from '../../utils/damage';
import { diceService } from '../../services/diceService';
import type { DiceRollResult, Spell, ElementAffinity } from '../../types';
import { DAMAGE_TYPE_NAMES, ELEMENT_NAMES } from '../../types';
import { SPELL_TYPES, DEFAULT_ELEMENT_TABLE, DEFAULT_DAMAGE_TIERS } from '../../constants/elements';

function safeProjectilesToString(projectiles: string | number | undefined | null): string {
  if (projectiles === undefined || projectiles === null) return '1';
  if (typeof projectiles === 'number') return String(projectiles);
  if (typeof projectiles === 'string') return projectiles || '1';
  return '1';
}

function hasProjectileDice(projectiles: string | number | undefined | null): boolean {
  const str = safeProjectilesToString(projectiles);
  return str.toLowerCase().includes('d');
}

async function parseProjectiles(projectiles: string | number | undefined | null): Promise<{ count: number; rolls?: number[] }> {
  const str = safeProjectilesToString(projectiles);
  const asNumber = parseInt(str, 10);
  if (!isNaN(asNumber) && !str.toLowerCase().includes('d')) {
    return { count: Math.max(1, asNumber) };
  }
  if (str.toLowerCase().includes('d')) {
    const result = await diceService.roll(str, 'Количество снарядов');
    return { count: Math.max(1, result.total), rolls: result.rolls };
  }
  return { count: 1 };
}

/**
 * Получает бонусы от предрасположенностей для заклинания
 */
function getAffinityBonuses(
  elements: string[],
  affinities: ElementAffinity[]
): { castHitBonus: number; manaCostReduction: number; damageBonus: number } {
  let castHitBonus = 0;
  let manaCostReduction = 0;
  let damageBonus = 0;
  
  for (const aff of affinities) {
    // Проверяем, есть ли элемент предрасположенности среди элементов заклинания
    const elementLower = aff.element.toLowerCase();
    const hasElement = elements.some(e => e.toLowerCase() === elementLower);
    
    if (hasElement) {
      switch (aff.bonusType) {
        case 'castHit':
          castHitBonus += aff.value;
          break;
        case 'manaCost':
          manaCostReduction += aff.value;
          break;
        case 'damage':
          damageBonus += aff.value;
          break;
      }
    }
  }
  
  return { castHitBonus, manaCostReduction, damageBonus };
}

export function MagicTab() {
  const {
    units, selectedUnitId, spendMana, takeDamage,
    nextRollModifier, setNextRollModifier
  } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [selectedSpellId, setSelectedSpellId] = useState<string>('');
  const [targetCount, setTargetCount] = useState(1);
  const [useDoubleShot, setUseDoubleShot] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [damageResults, setDamageResults] = useState<DiceRollResult[]>([]);
  const [castLog, setCastLog] = useState<string[]>([]);
  
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
  if (spells.length === 0) {
    return (
      <div className="p-4">
        <Section title="Сотворение заклинания" icon="✨">
          <p className="text-faded text-sm">Добавьте заклинания в настройках персонажа</p>
        </Section>
      </div>
    );
  }
  
  const selectedSpell = spells.find(s => s.id === selectedSpellId) ?? spells[0];
  const affinities = unit.elementAffinities ?? [];
  
  // Бонусы от предрасположенностей
  const spellElements = selectedSpell?.elements ?? [];
  const affinityBonuses = getAffinityBonuses(spellElements, affinities);
  
  // Стоимость с учётом ДаблШота и предрасположенности
  const getManaCost = (spell: Spell | undefined): number => {
    if (!spell) return 0;
    let base = spell.manaCost ?? 0;
    // ДаблШот удваивает стоимость
    if (useDoubleShot && unit.hasDoubleShot) base *= 2;
    // Предрасположенность снижает стоимость
    base = Math.max(0, base - affinityBonuses.manaCostReduction);
    return base;
  };
  
  const currentManaCost = getManaCost(selectedSpell);
  const currentMana = unit.mana?.current ?? 0;
  const costType = selectedSpell?.costType ?? 'mana';
  const canCast = costType === 'health' ? true : currentMana >= currentManaCost;
  
  const handleCast = async () => {
    if (!selectedSpell) return;
    
    setIsCasting(true);
    setDamageResults([]);
    setCastLog([]);
    
    // Забираем модификатор
    const modifier = nextRollModifier;
    setNextRollModifier('normal');
    
    const log: string[] = [];
    const newDamageResults: DiceRollResult[] = [];
    
    try {
      const baseCost = getManaCost(selectedSpell);
      const costType = selectedSpell.costType ?? 'mana';
      const elements = selectedSpell.elements ?? [];
      const magicBonuses = unit.magicBonuses ?? {};
      
      // Базовый бонус + бонус от предрасположенности
      const baseMagicBonus = getMaxMagicBonus(elements, magicBonuses);
      const totalCastBonus = baseMagicBonus + affinityBonuses.castHitBonus;
      
      let castCritDiscount = false;
      let castResult: DiceRollResult | null = null;
      
      // ═══ БРОСОК НА КАСТ ═══
      if (!selectedSpell.isMultiStep) {
        const castFormula = totalCastBonus >= 0 ? `d20+${totalCastBonus}` : `d20${totalCastBonus}`;
        castResult = await diceService.roll(
          castFormula,
          `Каст ${selectedSpell.name}`,
          unit.shortName ?? unit.name,
          modifier
        );
        
        const castSuccess = isHit(castResult);
        
        // ═══ КРИТ 20 = МАНА ×0.5 ═══
        if (castResult.rawD20 === 20) {
          castCritDiscount = true;
        }
        
        const manaSaved = castCritDiscount ? Math.floor(baseCost / 2) : 0;
        await diceService.announceSpellCast(
          unit.shortName ?? unit.name,
          selectedSpell.name,
          castSuccess,
          castResult,
          manaSaved > 0 ? manaSaved : undefined
        );
        
        if (!castSuccess) {
          // Промах — мана всё равно тратится (полная стоимость)
          if (costType === 'mana') {
            if (currentMana >= baseCost) {
              await spendMana(unit.id, baseCost);
              log.push(`💠 Потрачено ${baseCost} маны`);
            }
          } else {
            await takeDamage(unit.id, baseCost);
            log.push(`🩸 Потрачено ${baseCost} HP`);
          }
          
          const modText = castResult.allD20Rolls && castResult.allD20Rolls.length > 1
            ? ` (${modifier === 'advantage' ? '🎯' : '💨'}[${castResult.allD20Rolls.join(',')}])`
            : '';
          log.push(`❌ Каст провален! [${castResult.rawD20 ?? '?'}] + ${totalCastBonus} = ${castResult.total}${modText}`);
          setCastLog(log);
          return;
        }
        
        const modText = castResult.allD20Rolls && castResult.allD20Rolls.length > 1
          ? ` (${modifier === 'advantage' ? '🎯' : '💨'}[${castResult.allD20Rolls.join(',')}])`
          : '';
        log.push(`✅ Каст успешен! [${castResult.rawD20 ?? '?'}] + ${totalCastBonus} = ${castResult.total}${modText}${castCritDiscount ? ' — ✨КРИТ! Мана ×0.5!' : ''}`);
      }
      
      // ═══ СПИСЫВАЕМ МАНУ (с учётом крит-скидки) ═══
      const finalCost = castCritDiscount ? Math.ceil(baseCost / 2) : baseCost;
      
      if (costType === 'mana') {
        if (currentMana < finalCost) {
          log.push(`❌ Недостаточно маны! Нужно ${finalCost}, есть ${currentMana}`);
          setCastLog(log);
          return;
        }
        
        const success = await spendMana(unit.id, finalCost);
        if (!success) {
          log.push('❌ Не удалось потратить ману');
          setCastLog(log);
          return;
        }
        log.push(`💠 Потрачено ${finalCost} маны${castCritDiscount ? ` (было ${baseCost}, крит ×0.5)` : ''}${affinityBonuses.manaCostReduction > 0 ? ` (−${affinityBonuses.manaCostReduction} от предрасп.)` : ''}`);
      } else {
        log.push(`🩸 Заклинание стоит ${finalCost} HP${castCritDiscount ? ` (было ${baseCost}, крит ×0.5)` : ''}`);
        await takeDamage(unit.id, finalCost);
      }
      
      // ═══ ДаблШот проверка ═══
      let spellCount = 1;
      if (useDoubleShot && unit.hasDoubleShot && castResult && castResult.rawD20) {
        const threshold = unit.doubleShotThreshold ?? 18;
        if (castResult.rawD20 >= threshold) {
          spellCount = 2;
          log.push(`⚡ ДаблШот активирован! d20 = ${castResult.rawD20} >= ${threshold}`);
          await diceService.showNotification(`⚡ ${unit.shortName}: ДаблШот! 2× ${selectedSpell.name}!`);
        } else {
          log.push(`💨 ДаблШот не сработал (${castResult.rawD20} < ${threshold}), но мана ×2 потрачена`);
        }
      }
      
      // ═══ ПРИМЕНЯЕМ ЗАКЛИНАНИЕ ═══
      const intBonus = getIntelligenceBonus(unit);
      const equipBonus = selectedSpell.equipmentBonus ?? 0;
      // Добавляем бонус к урону от предрасположенности
      const totalDamageBonus = intBonus + equipBonus + affinityBonuses.damageBonus;
      const spellType = selectedSpell.type ?? 'targeted';
      
      for (let cast = 0; cast < spellCount; cast++) {
        if (spellCount > 1) {
          log.push(`--- Заклинание ${cast + 1} ---`);
        }
        
        switch (spellType) {
          case 'self':
          case 'summon':
            log.push(`✨ ${selectedSpell.description ?? 'Эффект применён'}`);
            break;
            
          case 'aoe':
            if (selectedSpell.damageFormula && selectedSpell.damageType) {
              const aoeFormula = totalDamageBonus > 0
                ? `${selectedSpell.damageFormula}+${totalDamageBonus}`
                : selectedSpell.damageFormula;
              
              // При крите каста — удваиваем урон АОЕ тоже
              const aoeResult = await diceService.rollDamage(
                aoeFormula,
                'Урон по площади',
                unit.shortName ?? unit.name,
                castResult?.isCrit ?? false
              );
              newDamageResults.push(aoeResult);
              
              const damageTypeName = DAMAGE_TYPE_NAMES[selectedSpell.damageType] ?? selectedSpell.damageType;
              const critText = castResult?.isCrit ? ' ×2!' : '';
              log.push(`💥 АОЕ урон${critText}: [${aoeResult.rolls.join(', ')}] + ${totalDamageBonus} = ${aoeResult.total} ${damageTypeName}`);
              
              await diceService.announceDamage(
                unit.shortName ?? unit.name,
                aoeResult.total,
                damageTypeName,
                aoeResult.rolls,
                totalDamageBonus,
                castResult?.isCrit
              );
            } else {
              log.push(`✨ ${selectedSpell.description ?? 'АОЕ эффект применён'}`);
            }
            break;
            
          case 'targeted': {
            // === МНОГОШАГОВЫЙ РЕЖИМ ===
            if (selectedSpell.isMultiStep) {
              const elementTable = selectedSpell.elementTable ?? DEFAULT_ELEMENT_TABLE;
              const damageTiers = selectedSpell.damageTiers ?? DEFAULT_DAMAGE_TIERS;
              
              // Шаг 1: d20 на попадание (с модификатором только первый каст)
              const useModForHit = cast === 0 ? modifier : 'normal';
              const hitResult = await diceService.roll('d20', 'Попадание', unit.shortName ?? unit.name, useModForHit);
              const hitRoll = hitResult.rawD20 ?? hitResult.total;
              
              if (hitRoll <= 10) {
                log.push(`❌ Шаг 1 — Попадание: [${hitRoll}] — ПРОМАХ!`);
                break;
              }
              
              const isCritHit = hitRoll === 20;
              log.push(`✅ Шаг 1 — Попадание: [${hitRoll}]${isCritHit ? ' — ✨КРИТ! Чистый урон + ×2 кубики!' : ' — Попадание!'}`);
              
              // Шаг 2: Элемент
              let resolvedDamageType: typeof selectedSpell.damageType;
              if (isCritHit) {
                resolvedDamageType = 'pure';
                log.push(`⚡ Шаг 2 — Элемент: Чистый урон (крит)`);
              } else {
                const elementResult = await diceService.roll('d12', 'Элемент', unit.shortName ?? unit.name);
                const elementRoll = elementResult.total;
                resolvedDamageType = elementTable[elementRoll] ?? 'fire';
                const elementName = DAMAGE_TYPE_NAMES[resolvedDamageType] ?? resolvedDamageType;
                log.push(`🎲 Шаг 2 — Элемент: [${elementRoll}] → ${elementName}`);
              }
              
              // Шаг 3: d20 на силу
              const powerResult = await diceService.roll('d20', 'Сила удара', unit.shortName ?? unit.name);
              const powerRoll = powerResult.rawD20 ?? powerResult.total;
              
              const tier = damageTiers.find(t => powerRoll >= t.minRoll && powerRoll <= t.maxRoll);
              if (!tier) {
                log.push(`⚠️ Шаг 3 — Сила: [${powerRoll}] — Tier не найден!`);
                break;
              }
              
              const tierLabel = tier.label ?? `${tier.minRoll}-${tier.maxRoll}`;
              log.push(`💪 Шаг 3 — Сила: [${powerRoll}] → ${tierLabel} (${tier.formula})`);
              
              // Шаг 4: Урон
              const dmgFormula = totalDamageBonus > 0
                ? `${tier.formula}+${totalDamageBonus}`
                : tier.formula;
              
              const dmgResult = await diceService.rollDamage(dmgFormula, `Урон (${tierLabel})`, unit.shortName ?? unit.name, isCritHit);
              newDamageResults.push(dmgResult);
              
              const damageTypeName = resolvedDamageType ? (DAMAGE_TYPE_NAMES[resolvedDamageType] ?? resolvedDamageType) : 'неизвестный';
              const critDmgText = isCritHit ? ' (×2 кубики!)' : '';
              log.push(`💥 Шаг 4 — Урон${critDmgText}: [${dmgResult.rolls.join(', ')}]${totalDamageBonus > 0 ? ` + ${totalDamageBonus}` : ''} = ${dmgResult.total} ${damageTypeName}`);
              
              await diceService.announceDamage(
                unit.shortName ?? unit.name,
                dmgResult.total,
                damageTypeName,
                dmgResult.rolls,
                totalDamageBonus,
                isCritHit
              );
              
              break;
            }
            
            // === ОБЫЧНЫЙ TARGETED РЕЖИМ ===
            const { count: projectileCount, rolls: projectileRolls } = await parseProjectiles(selectedSpell.projectiles);
            
            if (projectileRolls) {
              log.push(`🎲 Количество снарядов: [${projectileRolls.join(', ')}] = ${projectileCount}`);
              await diceService.announceProjectileCount(unit.shortName ?? unit.name, projectileCount, projectileRolls);
            }
            
            const targets = projectileRolls ? 1 : targetCount;
            const projectileStr = safeProjectilesToString(selectedSpell.projectiles);
            const projectilesPerTarget = projectileRolls ? projectileCount : (parseInt(projectileStr, 10) || 1);
            
            // Крит на каст = удвоение урона снарядов
            const isCastCrit = castResult?.isCrit ?? false;
            
            for (let t = 0; t < targets; t++) {
              if (targets > 1) {
                log.push(`--- Цель ${t + 1} ---`);
              }
              
              for (let p = 0; p < projectilesPerTarget; p++) {
                const projectileHitFormula = totalCastBonus >= 0 ? `d20+${totalCastBonus}` : `d20${totalCastBonus}`;
                const projectileHit = await diceService.roll(projectileHitFormula, `Снаряд ${p + 1}`, unit.shortName ?? unit.name);
                
                const projectileSuccess = isHit(projectileHit);
                // Крит на снаряде ИЛИ крит на касте = удвоение урона
                const projectileCrit = projectileHit.isCrit || isCastCrit;
                
                if (projectileSuccess && selectedSpell.damageFormula && selectedSpell.damageType) {
                  const dmgFormula2 = totalDamageBonus > 0
                    ? `${selectedSpell.damageFormula}+${totalDamageBonus}`
                    : selectedSpell.damageFormula;
                  
                  const dmgResult2 = await diceService.rollDamage(dmgFormula2, `Урон снаряда ${p + 1}`, unit.shortName ?? unit.name, projectileCrit);
                  newDamageResults.push(dmgResult2);
                  
                  const damageTypeName2 = DAMAGE_TYPE_NAMES[selectedSpell.damageType] ?? selectedSpell.damageType;
                  const critText = projectileCrit ? ' ×2' : '';
                  log.push(`🎯 Снаряд ${p + 1}: [${projectileHit.rawD20 ?? '?'}] = ${projectileHit.total} → 💥 ${dmgResult2.total}${critText} ${damageTypeName2}`);
                  
                  await diceService.announceDamage(
                    unit.shortName ?? unit.name,
                    dmgResult2.total,
                    damageTypeName2,
                    dmgResult2.rolls,
                    totalDamageBonus,
                    projectileCrit
                  );
                } else if (projectileSuccess) {
                  log.push(`🎯 Снаряд ${p + 1}: [${projectileHit.rawD20 ?? '?'}] = ${projectileHit.total} → Попадание!`);
                } else {
                  log.push(`💨 Снаряд ${p + 1}: [${projectileHit.rawD20 ?? '?'}] = ${projectileHit.total} → Промах`);
                }
              }
            }
            break;
          }
        }
      }
      
    } catch (err) {
      log.push(`❌ Ошибка: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCastLog(log);
      setDamageResults(newDamageResults);
      setIsCasting(false);
    }
  };
  
  const projectileHasFormula = selectedSpell ? hasProjectileDice(selectedSpell.projectiles) : false;
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      
      {/* ═══ МОДИФИКАТОР БРОСКА ═══ */}
      <Section title="Модификатор следующего броска" icon="🎲">
        <RollModifierSelector
          value={nextRollModifier}
          onChange={setNextRollModifier}
        />
      </Section>
      
      <Section title="Сотворение заклинания" icon="✨">
        <div className="space-y-3">
          <Select
            label="Заклинание"
            value={selectedSpell?.id ?? ''}
            onChange={(e) => setSelectedSpellId(e.target.value)}
            options={spells.map(s => ({
              value: s.id,
              label: `${s.name} (${s.manaCost ?? 0} ${(s.costType ?? 'mana') === 'health' ? 'HP' : 'маны'})`
            }))}
          />
          
          {selectedSpell && (
            <div className="p-2 bg-obsidian rounded border border-edge-bone text-sm">
              <div className="flex flex-wrap gap-2 mb-1">
                <span className="text-mana-bright">
                  {(selectedSpell.costType ?? 'mana') === 'health' ? '🩸' : '💠'} {currentManaCost}
                  {affinityBonuses.manaCostReduction > 0 && (
                    <span className="text-emerald-400 text-xs ml-1">(−{affinityBonuses.manaCostReduction})</span>
                  )}
                </span>
                <span className="text-faded">|</span>
                <span className="text-gold">{SPELL_TYPES[selectedSpell.type ?? 'targeted'] ?? selectedSpell.type ?? 'targeted'}</span>
              </div>
              <div className="text-xs text-faded">
                Элементы: {(selectedSpell.elements ?? []).map(e => ELEMENT_NAMES[e] ?? e).join(', ') || 'нет'}
              </div>
              {selectedSpell.damageFormula && (
                <div className="text-xs text-ancient">
                  Урон: {selectedSpell.damageFormula} {selectedSpell.damageType && (DAMAGE_TYPE_NAMES[selectedSpell.damageType] ?? selectedSpell.damageType)}
                  {affinityBonuses.damageBonus > 0 && (
                    <span className="text-emerald-400 ml-1">(+{affinityBonuses.damageBonus} от предрасп.)</span>
                  )}
                </div>
              )}
              {affinityBonuses.castHitBonus > 0 && (
                <div className="text-xs text-emerald-400">
                  +{affinityBonuses.castHitBonus} к касту (предрасположенность)
                </div>
              )}
              {selectedSpell.description && (
                <div className="text-xs text-bone mt-1 italic">
                  {selectedSpell.description}
                </div>
              )}
            </div>
          )}
          
          {(selectedSpell?.type ?? 'targeted') === 'targeted' && !projectileHasFormula && (
            <NumberStepper
              label="Количество целей"
              value={targetCount}
              onChange={setTargetCount}
              min={1}
              max={10}
            />
          )}
          
          {unit.hasDoubleShot && (
            <Checkbox
              checked={useDoubleShot}
              onChange={setUseDoubleShot}
              label={`⚡ ДаблШот (×2 мана, d20 >= ${unit.doubleShotThreshold ?? 18} = 2 заклинания)`}
            />
          )}
          
          {useDoubleShot && currentMana < currentManaCost && (
            <div className="text-blood-bright text-xs">
              ⚠️ Нужно {currentManaCost} маны для ДаблШот!
            </div>
          )}
          
          <Button
            variant="mana"
            onClick={handleCast}
            loading={isCasting}
            disabled={!selectedSpell || !canCast}
            className="w-full"
          >
            ✨ СОТВОРИТЬ {nextRollModifier !== 'normal' && (nextRollModifier === 'advantage' ? '🎯' : '💨')}
          </Button>
          
          {!canCast && selectedSpell && (
            <div className="text-blood-bright text-xs text-center">
              Мало маны! Нужно {currentManaCost}, есть {currentMana}
            </div>
          )}
          
          {castLog.length > 0 && (
            <div className="p-2 bg-obsidian rounded border border-edge-bone space-y-1 max-h-64 overflow-y-auto">
              {castLog.map((line, idx) => (
                <div key={idx} className="text-sm font-garamond">{line}</div>
              ))}
            </div>
          )}
          
          {damageResults.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-faded uppercase">Урон:</div>
              <DiceResultDisplay results={damageResults} />
            </div>
          )}
        </div>
      </Section>
      
      {/* ═══ ПРЕДРАСПОЛОЖЕННОСТИ ═══ */}
      {affinities.length > 0 && (
        <Section title="Активные предрасположенности" icon="🔮" collapsible defaultOpen={false}>
          <div className="space-y-1 text-sm">
            {affinities.map(aff => (
              <div key={aff.id} className="flex justify-between items-center">
                <span className="text-ancient">
                  {ELEMENT_NAMES[aff.element] ?? aff.element}
                </span>
                <span className="text-emerald-400">
                  {aff.bonusType === 'castHit' && `+${aff.value} каст/попадание`}
                  {aff.bonusType === 'manaCost' && `−${aff.value} мана`}
                  {aff.bonusType === 'damage' && `+${aff.value} урон`}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
      
      {/* ═══ МАГИЧЕСКИЕ БОНУСЫ ═══ */}
      <Section title="Магические бонусы" icon="📚" collapsible defaultOpen={false}>
        {Object.keys(unit.magicBonuses ?? {}).length === 0 ? (
          <p className="text-faded text-sm">Нет магических бонусов</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(unit.magicBonuses ?? {}).map(([element, bonus]) => (
              <div key={element} className="flex justify-between">
                <span className="text-ancient capitalize">{ELEMENT_NAMES[element] ?? element}</span>
                <span className="text-gold">+{bonus}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
