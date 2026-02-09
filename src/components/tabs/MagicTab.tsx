import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, NumberStepper, Checkbox, DiceResultDisplay, EmptyState } from '../ui';
import { rollDice, getMaxMagicBonus, isHit } from '../../utils/dice';
import { getIntelligenceBonus } from '../../utils/damage';
import { diceService } from '../../services/diceService';
import type { DiceRollResult, Spell } from '../../types';
import { DAMAGE_TYPE_NAMES } from '../../types';
import { SPELL_TYPES } from '../../constants/elements';

/**
 * Парсит строку projectiles и возвращает количество снарядов
 * Если строка — число, возвращает его. Если формула — бросает кубик.
 */
function parseProjectiles(projectiles: string | undefined | null): { count: number; rolls?: number[] } {
  if (!projectiles) return { count: 1 };
  
  const trimmed = projectiles.trim();
  if (!trimmed) return { count: 1 };
  
  // Если это просто число
  const asNumber = parseInt(trimmed, 10);
  if (!isNaN(asNumber) && !trimmed.includes('d')) {
    return { count: Math.max(1, asNumber) };
  }
  
  // Если это формула с кубиком
  if (trimmed.includes('d')) {
    const result = rollDice(trimmed);
    return { count: Math.max(1, result.total), rolls: result.rolls };
  }
  
  // По умолчанию 1 снаряд
  return { count: 1 };
}

export function MagicTab() {
  const { units, selectedUnitId, spendMana, takeDamage } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [selectedSpellId, setSelectedSpellId] = useState<string>('');
  const [targetCount, setTargetCount] = useState(1);
  const [useDoubleShot, setUseDoubleShot] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [damageResults, setDamageResults] = useState<DiceRollResult[]>([]);
  const [castLog, setCastLog] = useState<string[]>([]);
  
  // Защита от отсутствия юнита
  if (!unit) {
    return (
      <EmptyState
        icon="✨"
        title="Нет персонажа"
        description="Выберите персонажа для магии"
      />
    );
  }
  
  // Защита от отсутствия заклинаний
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
  
  // Рассчитываем стоимость с учётом ДаблШота
  const getManaCost = (spell: Spell | undefined): number => {
    if (!spell) return 0;
    const base = spell.manaCost ?? 0;
    return useDoubleShot && unit.hasDoubleShot ? base * 2 : base;
  };
  
  const currentManaCost = getManaCost(selectedSpell);
  const currentMana = unit.mana?.current ?? 0;
  const canCast = currentMana >= currentManaCost;
  
  // Обработчик каста
  const handleCast = async () => {
    if (!selectedSpell) return;
    
    setIsCasting(true);
    setDamageResults([]);
    setCastLog([]);
    
    const log: string[] = [];
    const newDamageResults: DiceRollResult[] = [];
    
    try {
      // 1. Проверяем стоимость
      const cost = getManaCost(selectedSpell);
      const costType = selectedSpell.costType ?? 'mana';
      
      if (costType === 'mana') {
        if (currentMana < cost) {
          log.push(`❌ Недостаточно маны! Нужно ${cost}, есть ${currentMana}`);
          setCastLog(log);
          return;
        }
        
        // 2. Списываем ману СРАЗУ
        const success = await spendMana(unit.id, cost);
        if (!success) {
          log.push('❌ Не удалось потратить ману');
          setCastLog(log);
          return;
        }
        log.push(`💠 Потрачено ${cost} маны`);
      } else {
        // costType === 'health' — стоимость HP
        log.push(`🩸 Заклинание стоит ${cost} HP`);
        await takeDamage(unit.id, cost);
      }
      
      // 3. Бросок на каст
      const elements = selectedSpell.elements ?? [];
      const magicBonuses = unit.magicBonuses ?? {};
      const magicBonus = getMaxMagicBonus(elements, magicBonuses);
      const castFormula = magicBonus >= 0 ? `d20+${magicBonus}` : `d20${magicBonus}`;
      
      const castResult = rollDice(castFormula, `Каст ${selectedSpell.name}`);
      
      const castSuccess = isHit(castResult);
      await diceService.announceSpellCast(unit.shortName, selectedSpell.name, castSuccess, castResult);
      
      if (!castSuccess) {
        log.push(`❌ Каст провален! [${castResult.rawD20}] + ${magicBonus} = ${castResult.total}`);
        setCastLog(log);
        return;
      }
      
      log.push(`✅ Каст успешен! [${castResult.rawD20}] + ${magicBonus} = ${castResult.total}`);
      
      // 4. ДаблШот проверка
      let spellCount = 1;
      if (useDoubleShot && unit.hasDoubleShot && castResult.rawD20) {
        const threshold = unit.doubleShotThreshold ?? 18;
        if (castResult.rawD20 >= threshold) {
          spellCount = 2;
          log.push(`⚡ ДаблШот активирован! d20 = ${castResult.rawD20} >= ${threshold}`);
          await diceService.showNotification(`⚡ ${unit.shortName}: ДаблШот! 2× ${selectedSpell.name}!`);
        } else {
          log.push(`💨 ДаблШот не сработал (${castResult.rawD20} < ${threshold}), но мана ×2 потрачена`);
        }
      }
      
      // 5. Применяем заклинание
      const intBonus = getIntelligenceBonus(unit);
      const equipBonus = selectedSpell.equipmentBonus ?? 0;
      const totalBonus = intBonus + equipBonus;
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
              const aoeFormula = totalBonus > 0 
                ? `${selectedSpell.damageFormula}+${totalBonus}`
                : selectedSpell.damageFormula;
              
              const aoeResult = rollDice(aoeFormula, 'Урон по площади');
              newDamageResults.push(aoeResult);
              
              log.push(`💥 АОЕ урон: [${aoeResult.rolls.join(', ')}] + ${totalBonus} = ${aoeResult.total} ${DAMAGE_TYPE_NAMES[selectedSpell.damageType] ?? selectedSpell.damageType}`);
              
              await diceService.announceDamage(
                unit.shortName,
                aoeResult.total,
                DAMAGE_TYPE_NAMES[selectedSpell.damageType] ?? selectedSpell.damageType,
                aoeResult.rolls,
                totalBonus
              );
            } else {
              log.push(`✨ ${selectedSpell.description ?? 'АОЕ эффект применён'}`);
            }
            break;
            
          case 'targeted': {
            // Парсим количество снарядов (может быть формула)
            const { count: projectileCount, rolls: projectileRolls } = parseProjectiles(selectedSpell.projectiles);
            
            // Если снаряды определялись кубиком — показываем
            if (projectileRolls) {
              log.push(`🎲 Количество снарядов: [${projectileRolls.join(', ')}] = ${projectileCount}`);
              await diceService.announceProjectileCount(unit.shortName, projectileCount, projectileRolls);
            }
            
            // Если снаряды фиксированные — бросаем по каждой цели
            // Если снаряды по формуле — они все летят в одну цель
            const targets = projectileRolls ? 1 : targetCount;
            const projectilesPerTarget = projectileRolls ? projectileCount : (parseInt(selectedSpell.projectiles ?? '1', 10) || 1);
            
            for (let t = 0; t < targets; t++) {
              if (targets > 1) {
                log.push(`--- Цель ${t + 1} ---`);
              }
              
              for (let p = 0; p < projectilesPerTarget; p++) {
                // Бросок на попадание снаряда
                const projectileHitFormula = magicBonus >= 0 ? `d20+${magicBonus}` : `d20${magicBonus}`;
                const projectileHit = rollDice(projectileHitFormula, `Снаряд ${p + 1}`);
                
                const projectileSuccess = isHit(projectileHit);
                
                if (projectileSuccess && selectedSpell.damageFormula && selectedSpell.damageType) {
                  const dmgFormula = totalBonus > 0 
                    ? `${selectedSpell.damageFormula}+${totalBonus}`
                    : selectedSpell.damageFormula;
                  
                  const dmgResult = rollDice(dmgFormula, `Урон снаряда ${p + 1}`);
                  newDamageResults.push(dmgResult);
                  
                  log.push(`🎯 Снаряд ${p + 1}: [${projectileHit.rawD20}] = ${projectileHit.total} → 💥 ${dmgResult.total} ${DAMAGE_TYPE_NAMES[selectedSpell.damageType] ?? selectedSpell.damageType}`);
                  
                  await diceService.announceDamage(
                    unit.shortName,
                    dmgResult.total,
                    DAMAGE_TYPE_NAMES[selectedSpell.damageType] ?? selectedSpell.damageType,
                    dmgResult.rolls,
                    totalBonus
                  );
                } else if (projectileSuccess) {
                  log.push(`🎯 Снаряд ${p + 1}: [${projectileHit.rawD20}] = ${projectileHit.total} → Попадание!`);
                } else {
                  log.push(`💨 Снаряд ${p + 1}: [${projectileHit.rawD20}] = ${projectileHit.total} → Промах`);
                }
              }
            }
            break;
          }
        }
      }
      
    } finally {
      setCastLog(log);
      setDamageResults(newDamageResults);
      setIsCasting(false);
    }
  };
  
  // Проверяем, содержит ли projectiles формулу с кубиком
  const hasProjectileFormula = (selectedSpell?.projectiles ?? '').includes('d');
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      <Section title="Сотворение заклинания" icon="✨">
        <div className="space-y-3">
          <Select
            label="Заклинание"
            value={selectedSpell?.id ?? ''}
            onChange={(e) => setSelectedSpellId(e.target.value)}
            options={spells.map(s => ({ 
              value: s.id, 
              label: `${s.name} (${s.manaCost ?? 0} ${s.costType === 'health' ? 'HP' : 'маны'})` 
            }))}
          />
          
          {selectedSpell && (
            <div className="p-2 bg-obsidian rounded border border-edge-bone text-sm">
              <div className="flex flex-wrap gap-2 mb-1">
                <span className="text-mana-bright">
                  {selectedSpell.costType === 'health' ? '🩸' : '💠'} {currentManaCost}
                </span>
                <span className="text-faded">|</span>
                <span className="text-gold">{SPELL_TYPES[selectedSpell.type ?? 'targeted'] ?? selectedSpell.type}</span>
                {selectedSpell.projectiles && (
                  <>
                    <span className="text-faded">|</span>
                    <span className="text-ancient">
                      {hasProjectileFormula ? `${selectedSpell.projectiles} снарядов` : `${selectedSpell.projectiles} снаряд(ов)`}
                    </span>
                  </>
                )}
              </div>
              <div className="text-xs text-faded">
                Элементы: {(selectedSpell.elements ?? []).join(', ') || 'нет'}
              </div>
              {selectedSpell.damageFormula && (
                <div className="text-xs text-ancient">
                  Урон: {selectedSpell.damageFormula} {selectedSpell.damageType && (DAMAGE_TYPE_NAMES[selectedSpell.damageType] ?? selectedSpell.damageType)}
                </div>
              )}
              {selectedSpell.description && (
                <div className="text-xs text-bone mt-1 italic">
                  {selectedSpell.description}
                </div>
              )}
            </div>
          )}
          
          {/* Показываем количество целей только если снаряды НЕ по формуле */}
          {selectedSpell?.type === 'targeted' && !hasProjectileFormula && (
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
            ✨ СОТВОРИТЬ
          </Button>
          
          {!canCast && selectedSpell && (
            <div className="text-blood-bright text-xs text-center">
              Мало маны! Нужно {currentManaCost}, есть {currentMana}
            </div>
          )}
          
          {/* Лог каста */}
          {castLog.length > 0 && (
            <div className="p-2 bg-obsidian rounded border border-edge-bone space-y-1">
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
      
      {/* Информация о магических бонусах */}
      <Section title="Магические бонусы" icon="📚" collapsible defaultOpen={false}>
        {Object.keys(unit.magicBonuses ?? {}).length === 0 ? (
          <p className="text-faded text-sm">Нет магических бонусов</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(unit.magicBonuses ?? {}).map(([element, bonus]) => (
              <div key={element} className="flex justify-between">
                <span className="text-ancient capitalize">{element}</span>
                <span className="text-gold">+{bonus}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
