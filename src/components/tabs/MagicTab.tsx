// src/components/tabs/MagicTab.tsx

import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { 
  Button, Section, Select, NumberStepper, 
  DiceResultDisplay, EmptyState, RollModifierSelector 
} from '../ui';
import { spellExecutor } from '../../services/spellExecutor';
import { diceService } from '../../services/diceService';
import type { DiceRollResult, Spell, SpellV2, CastContext } from '../../types';
import { isSpellV2, DAMAGE_TYPE_NAMES, ELEMENT_NAMES } from '../../types';
import { ELEMENT_ICONS, SPELL_TYPES } from '../../constants/elements';

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
  const [castLog, setCastLog] = useState<string[]>([]);
  const [castResults, setCastResults] = useState<DiceRollResult[]>([]);
  const [lastContext, setLastContext] = useState<CastContext | null>(null);
  
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
  
  // Приводим к SpellV2 для отображения
  const getSpellV2Display = (spell: Spell | SpellV2) => {
    if (isSpellV2(spell)) return spell;
    // Для старых заклинаний — простое отображение
    return {
      cost: spell.manaCost,
      costResource: spell.costType === 'health' ? 'health' : 'mana',
      elements: spell.elements ?? [],
      spellType: spell.type,
      projectiles: spell.projectiles ?? '1',
      description: spell.description,
    };
  };
  
  const selectedSpellDisplay = selectedSpell ? getSpellV2Display(selectedSpell) : null;
  
  // Рассчитываем стоимость с учётом предрасположенностей
  const getSpellCost = (spell: Spell | SpellV2): number => {
    if (isSpellV2(spell)) {
      return spellExecutor.calculateManaCost(spell, unit);
    }
    // Старое заклинание
    let cost = spell.manaCost;
    for (const element of (spell.elements ?? [])) {
      const mod = unit.elementModifiers.find(m => m.element === element && m.isActive);
      if (mod) cost -= mod.manaReduction;
    }
    return Math.max(0, cost);
  };
  
  const spellCost = selectedSpell ? getSpellCost(selectedSpell) : 0;
  
  // ─────────────────────────────────────────────────────────────────────────
  // КАСТ ЗАКЛИНАНИЯ
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleCast = async () => {
    if (!selectedSpell) return;
    
    // Проверяем ресурсы
    const costResource = isSpellV2(selectedSpell) 
      ? selectedSpell.costResource 
      : (selectedSpell.costType === 'health' ? 'health' : 'mana');
    
    if (costResource === 'health') {
      if (unit.health.current < spellCost) {
        addNotification(`Недостаточно HP! Нужно ${spellCost}`, 'warning');
        return;
      }
    } else if (costResource === 'mana') {
      if (unit.mana.current < spellCost) {
        addNotification(`Недостаточно маны! Нужно ${spellCost}`, 'warning');
        return;
      }
    }
    
    setIsCasting(true);
    setCastLog([]);
    setCastResults([]);
    setLastContext(null);
    
    const modifier = nextRollModifier;
    setNextRollModifier('normal');
    
    try {
      // Тратим ресурс
      if (costResource === 'health') {
        await setHP(unit.id, unit.health.current - spellCost);
        addCombatLog(unit.shortName ?? unit.name, 'Кровавая магия', `-${spellCost} HP`);
      } else {
        await spendMana(unit.id, spellCost);
      }
      
      // Если заклинание V2 — используем spellExecutor
      if (isSpellV2(selectedSpell)) {
        const result = await spellExecutor.execute({
          spell: selectedSpell,
          caster: unit,
          targetCount,
          rollModifier: modifier,
          onLog: (msg) => console.log('[Spell]', msg),
        });
        
        setCastLog(result.log);
        setLastContext(result.context);
        
        // Конвертируем rolls в DiceRollResult для отображения
        const diceResults: DiceRollResult[] = result.context.rolls.map(r => ({
          formula: r.formula,
          rolls: r.rolls,
          bonus: 0,
          total: r.total,
          rawD20: r.rawD20,
          isCrit: r.isCrit,
          isCritFail: r.isCritFail,
        }));
        setCastResults(diceResults);
        
        // Эффекты
        if (result.context.isCritFail) {
          triggerEffect('crit-fail');
        } else if (result.context.isCrit) {
          triggerEffect('crit-gold');
        }
        
        // Broadcast
        if (result.totalDamage > 0) {
          await diceService.broadcastSpell(
            selectedSpell.name,
            unit.shortName ?? unit.name,
            result.totalDamage,
            result.damageType,
            result.context.isCrit
          );
          
          addCombatLog(
            unit.shortName ?? unit.name, 
            selectedSpell.name, 
            `${result.totalDamage} ${result.damageType ?? ''}`
          );
        } else {
          addCombatLog(unit.shortName ?? unit.name, selectedSpell.name, 'скастовано');
        }
        
      } else {
        // Старое заклинание — используем старую логику
        await handleLegacyCast(selectedSpell, modifier);
      }
      
    } catch (err) {
      console.error('[MagicTab] Cast error:', err);
      addNotification(`Ошибка каста: ${err}`, 'error');
    } finally {
      setIsCasting(false);
    }
  };
  
  // Старая логика для совместимости
  const handleLegacyCast = async (spell: Spell, modifier: 'normal' | 'advantage' | 'disadvantage') => {
    const log: string[] = [];
    log.push(`═══ ${spell.name} ═══`);
    
    // Бонусы от элементов
    let castBonus = spell.equipmentBonus ?? 0;
    for (const element of (spell.elements ?? [])) {
      const mod = unit.elementModifiers.find(m => m.element === element && m.isActive);
      if (mod) castBonus += mod.castBonus;
    }
    
    // Каст
    const castFormula = castBonus >= 0 ? `d20+${castBonus}` : `d20${castBonus}`;
    const castResult = await diceService.roll(
      castFormula,
      `Каст ${spell.name}`,
      unit.shortName ?? unit.name,
      modifier
    );
    
    setCastResults([castResult]);
    
    if (castResult.isCritFail) {
      log.push(`💀 Каст: [${castResult.rawD20}] = КРИТ ПРОВАЛ!`);
      triggerEffect('crit-fail');
      setCastLog(log);
      return;
    }
    
    if (castResult.isCrit) {
      log.push(`✨ Каст: [${castResult.rawD20}] + ${castBonus} = ${castResult.total} — КРИТ!`);
      triggerEffect('crit-gold');
    } else {
      log.push(`🎯 Каст: [${castResult.rawD20}] + ${castBonus} = ${castResult.total}`);
    }
    
    // Урон
    if (spell.damageFormula) {
      let dmgBonus = 0;
      for (const element of (spell.elements ?? [])) {
        const mod = unit.elementModifiers.find(m => m.element === element && m.isActive);
        if (mod) dmgBonus += mod.damageBonus;
      }
      
      let formula = spell.damageFormula;
      if (dmgBonus > 0) formula = `${formula}+${dmgBonus}`;
      
      const dmgResult = await diceService.rollDamage(
        formula,
        `Урон ${spell.name}`,
        unit.shortName ?? unit.name,
        castResult.isCrit
      );
      
      setCastResults(prev => [...prev, dmgResult]);
      
      const critText = castResult.isCrit ? ' ×2' : '';
      const typeText = spell.damageType ? DAMAGE_TYPE_NAMES[spell.damageType] : '';
      log.push(`💥 ${dmgResult.total}${critText} ${typeText}`);
      
      addCombatLog(unit.shortName ?? unit.name, spell.name, `${dmgResult.total} урона`);
    } else {
      addCombatLog(unit.shortName ?? unit.name, spell.name, 'скастовано');
    }
    
    setCastLog(log);
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
                setCastLog([]);
                setCastResults([]);
              }}
              options={spells.map(s => {
                const cost = getSpellCost(s);
                const resource = isSpellV2(s) 
                  ? (s.costResource === 'health' ? 'HP' : 'маны')
                  : (s.costType === 'health' ? 'HP' : 'маны');
                return {
                  value: s.id,
                  label: `${s.name} (${cost} ${resource})`
                };
              })}
            />
            
            {selectedSpell && selectedSpellDisplay && (
              <div className="p-3 bg-obsidian rounded border border-edge-bone space-y-2">
                {/* Элементы */}
                {selectedSpellDisplay.elements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedSpellDisplay.elements.map(el => (
                      <span key={el} className="px-2 py-0.5 bg-panel rounded text-xs text-ancient">
                        {ELEMENT_ICONS[el] ?? '✨'} {ELEMENT_NAMES[el] ?? el}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Тип */}
                <div className="text-xs text-faded">
                  Тип: {SPELL_TYPES[selectedSpellDisplay.spellType as keyof typeof SPELL_TYPES] ?? selectedSpellDisplay.spellType}
                  {selectedSpellDisplay.projectiles && selectedSpellDisplay.projectiles !== '1' && (
                    <span className="text-ancient ml-2">• Снаряды: {selectedSpellDisplay.projectiles}</span>
                  )}
                </div>
                
                {/* Стоимость */}
                <div className="text-xs">
                  <span className={selectedSpellDisplay.costResource === 'health' ? 'text-blood-bright' : 'text-mana-bright'}>
                    Стоимость: {spellCost} {selectedSpellDisplay.costResource === 'health' ? 'HP' : 'маны'}
                  </span>
                  {isSpellV2(selectedSpell) && spellCost < selectedSpell.cost && (
                    <span className="text-green-500 ml-1">(−{selectedSpell.cost - spellCost} от предрасп.)</span>
                  )}
                </div>
                
                {/* Версия заклинания */}
                {isSpellV2(selectedSpell) && (
                  <div className="text-xs text-purple-400">
                    ⚡ V2: {selectedSpell.actions.length} шагов
                  </div>
                )}
                
                {/* Описание */}
                {selectedSpellDisplay.description && (
                  <div className="text-xs text-bone italic border-t border-edge-bone pt-2 mt-2">
                    {selectedSpellDisplay.description}
                  </div>
                )}
              </div>
            )}
            
            {/* Количество целей */}
            <NumberStepper
              label="Количество целей"
              value={targetCount}
              onChange={setTargetCount}
              min={1}
              max={10}
            />
            
            {/* Кнопка каста */}
            <Button
              variant="gold"
              onClick={handleCast}
              loading={isCasting}
              disabled={!selectedSpell}
              className="w-full"
            >
              ✨ СОТВОРИТЬ {nextRollModifier !== 'normal' ? (nextRollModifier === 'advantage' ? '🎯' : '💨') : ''}
            </Button>
            
            {/* Лог каста */}
            {castLog.length > 0 && (
              <div className="p-3 bg-obsidian rounded border border-edge-bone space-y-1 max-h-48 overflow-y-auto">
                {castLog.map((line, idx) => (
                  <div 
                    key={idx} 
                    className={`text-sm font-garamond ${
                      line.includes('КРИТ ПРОВАЛ') ? 'text-blood-bright' :
                      line.includes('КРИТ') ? 'text-gold' :
                      line.includes('💥') ? 'text-blood-bright' :
                      line.includes('═══') ? 'text-gold font-cinzel' :
                      'text-bone'
                    }`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}
            
            {/* Результаты бросков */}
            {castResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-faded uppercase">Броски:</div>
                <DiceResultDisplay results={castResults} />
              </div>
            )}
            
            {/* Итоговый урон */}
            {lastContext && lastContext.totalDamage > 0 && (
              <div className="p-3 bg-blood/20 rounded border border-blood/50 text-center">
                <div className="text-xs text-faded uppercase mb-1">Итоговый урон</div>
                <div className="text-2xl font-cinzel text-blood-bright">
                  💥 {lastContext.totalDamage}
                  {lastContext.damageType && (
                    <span className="text-sm text-ancient ml-2">
                      ({DAMAGE_TYPE_NAMES[lastContext.damageType as keyof typeof DAMAGE_TYPE_NAMES] ?? lastContext.damageType})
                    </span>
                  )}
                </div>
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
