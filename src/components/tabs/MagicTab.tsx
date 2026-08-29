// src/components/tabs/MagicTab.tsx

import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { 
  Button, Section, Select, NumberStepper, 
  DiceResultDisplay, EmptyState 
} from '../ui';
import { spellExecutor } from '../../services/spellExecutor';
import { diceService } from '../../services/diceService';
import { evaluateElementEffects, formatElementEffectLog } from '../../utils/elementEffects';
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
    triggerEffect, addCombatLog, addNotification
  } = useGameStore();
  
  const unit = units.find(u => u.id === selectedUnitId);
  
  // Состояние каста
  const [selectedSpellId, setSelectedSpellId] = useState<string>('');
  const [targetCount, setTargetCount] = useState(1);
  const [isCasting, setIsCasting] = useState(false);
  const [castLog, setCastLog] = useState<string[]>([]);
  const [castResults, setCastResults] = useState<DiceRollResult[]>([]);
  const [lastContext, setLastContext] = useState<CastContext | null>(null);
  const [lastElementEffects, setLastElementEffects] = useState<ReturnType<typeof evaluateElementEffects> | null>(null);
  
  // Сворачивание групп заклинаний по типу
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  
  // 🔥 Управление маной
  const [manaAmount, setManaAmount] = useState(0);
  
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
    let cost = spell.manaCost;
    for (const element of (spell.elements ?? [])) {
      const mod = unit.elementModifiers.find(m => m.element === element && m.isActive);
      if (mod) cost -= mod.manaReduction;
    }
    return Math.max(0, cost);
  };
  
  const spellCost = selectedSpell ? getSpellCost(selectedSpell) : 0;
  
  // Группировка заклинаний по типу
  const spellsByType = spells.reduce((acc, spell) => {
    const type = isSpellV2(spell) ? spell.spellType : spell.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(spell);
    return acc;
  }, {} as Record<string, (Spell | SpellV2)[]>);
  
  const toggleType = (type: string) => {
    setCollapsedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🔥 УПРАВЛЕНИЕ МАНОЙ
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleRestoreMana = async () => {
    if (manaAmount <= 0) return;
    
    const curMana = unit.mana.current;
    const maxMana = unit.mana.max;
    const newMana = Math.min(maxMana, curMana + manaAmount);
    const actualRestored = newMana - curMana;
    
    if (actualRestored <= 0) return;
    
    await setMana(unit.id, newMana);
    triggerEffect('heal');
    
    addCombatLog(unit.shortName ?? unit.name, 'Восстановление маны', `+${actualRestored} 💠`);
    
    try {
      await diceService.showNotification(
        `💠 ${unit.shortName ?? unit.name} восстановил ${actualRestored} маны (${newMana}/${maxMana})`
      );
    } catch { /* не критично */ }
    
    setManaAmount(0);
  };
  
  const handleSpendMana = async () => {
    if (manaAmount <= 0) return;
    
    const curMana = unit.mana.current;
    const newMana = Math.max(0, curMana - manaAmount);
    const actualSpent = curMana - newMana;
    
    if (actualSpent <= 0) return;
    
    await setMana(unit.id, newMana);
    
    addCombatLog(unit.shortName ?? unit.name, 'Трата маны', `-${actualSpent} 💠`);
    
    try {
      await diceService.showNotification(
        `🔻 ${unit.shortName ?? unit.name} потратил ${actualSpent} маны (${newMana}/${unit.mana.max})`
      );
    } catch { /* не критично */ }
    
    setManaAmount(0);
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // КАСТ ЗАКЛИНАНИЯ
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleCast = async () => {
    if (!selectedSpell) return;
    
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
    setLastElementEffects(null);
    
    try {
      // Тратим ресурс
      if (costResource === 'health') {
        await setHP(unit.id, unit.health.current - spellCost);
        addCombatLog(unit.shortName ?? unit.name, 'Кровавая магия', `-${spellCost} HP`);
      } else {
        await spendMana(unit.id, spellCost);
      }
      
      // Если V2 — spellExecutor
      if (isSpellV2(selectedSpell)) {
        triggerEffect('cast');
        const result = await spellExecutor.execute({
          spell: selectedSpell,
          caster: unit,
          targetCount,
          rollModifier: 'normal',
          onLog: (msg) => console.log('[Spell]', msg),
        });
        
        // Применяем ресурсные изменения из modify_resource шагов
        const resourceChanges = result.context.values._resourceChanges as Array<{type: string; amount: number; resourceId?: string}> | undefined;
        if (resourceChanges) {
          for (const change of resourceChanges) {
            if (change.type === 'mana') {
              const currentMana = useGameStore.getState().units.find(u => u.id === unit.id)?.mana.current ?? unit.mana.current;
              await setMana(unit.id, currentMana + change.amount);
            } else if (change.type === 'health') {
              const currentHP = useGameStore.getState().units.find(u => u.id === unit.id)?.health.current ?? unit.health.current;
              await setHP(unit.id, currentHP + change.amount);
            } else if (change.type === 'rage' && unit.hasRage) {
              const currentRage = useGameStore.getState().units.find(u => u.id === unit.id)?.rage?.current ?? unit.rage?.current ?? 0;
              if (change.amount > 0) {
                await useGameStore.getState().addRage(unit.id, change.amount);
              } else {
                await useGameStore.getState().spendRage(unit.id, Math.abs(change.amount));
              }
            } else if (change.type === 'resource' && change.resourceId) {
              const currentUnit = useGameStore.getState().units.find(u => u.id === unit.id);
              const resource = currentUnit?.resources.find(r => r.id === change.resourceId);
              if (resource) {
                await useGameStore.getState().setResource(unit.id, change.resourceId, resource.current + change.amount);
              }
            }
          }
        }
        
        // Оцениваем элементные эффекты
        const elementEffects = isSpellV2(selectedSpell)
          ? evaluateElementEffects(selectedSpell.elements, result.context)
          : null;
        setLastElementEffects(elementEffects);

        // Бонус от интеллекта: +3 к урону заклинаний
        const intBonus = Math.floor((unit.stats.intelligence || 0) * 3);
        if (intBonus > 0 && result.totalDamage > 0) {
          result.totalDamage += intBonus;
          result.log.push(`🧠 Интеллект: +${intBonus} к урону заклинания`);
        }

        // Элементный бонус — показываем отдельно как напоминание, НЕ суммируем в итог автоматически
        const cleanDamage = result.totalDamage;
        let finalDamage = cleanDamage;
        if (elementEffects && elementEffects.totalBonusDamage > 0) {
          result.log.push(`📈 Элемент. бонус: +${elementEffects.totalBonusDamage} (${elementEffects.effects.filter(e => e.triggered && e.bonusDamage).map(e => e.icon).join('')}) — по соответствующим существам`);
        }

        // Астрал: половина стоимости при прокидке >18
        if (elementEffects && elementEffects.manaCostModifier < 0) {
          const halfCost = Math.floor(spellCost * 0.5);
          const refunded = spellCost - halfCost;
          const freshUnit = useGameStore.getState().units.find(u => u.id === unit.id);
          if (freshUnit && freshUnit.mana.current < unit.mana.current) {
            await setMana(unit.id, freshUnit.mana.current + refunded);
            result.log.push(`🌟 Астрал: стоимость снижена на ${refunded} (прокидка ${elementEffects.castRollRaw} > 18)`);
          }
        }

        // Формируем лог элементных эффектов
        const effectLogLines = elementEffects ? formatElementEffectLog(elementEffects) : [];

        setCastLog([...result.log, ...effectLogLines]);
        setLastContext(result.context);

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

        if (result.context.isCritFail) {
          triggerEffect('crit-fail');
        } else if (result.context.isCrit) {
          triggerEffect('crit-gold');
        }

        if (cleanDamage > 0) {
          await diceService.broadcastSpell(
            selectedSpell.name,
            unit.shortName ?? unit.name,
            cleanDamage,
            result.damageType,
            result.context.isCrit
          );
          addCombatLog(unit.shortName ?? unit.name, selectedSpell.name, `${cleanDamage} ${result.damageType ?? ''}`);
        } else {
          addCombatLog(unit.shortName ?? unit.name, selectedSpell.name, 'скастовано');
        }
        
        // Логируем элементные эффекты в боевой журнал
        if (elementEffects) {
          for (const effect of elementEffects.effects.filter(e => e.triggered)) {
            addCombatLog(
              unit.shortName ?? unit.name,
              effect.effectName,
              effect.description
            );
          }
          if (elementEffects.totalBonusDamage > 0) {
            addCombatLog(
              unit.shortName ?? unit.name,
              'Элемент. бонус',
              `+${elementEffects.totalBonusDamage} доп. урона`
            );
          }
        }
      } else {
        await handleLegacyCast(selectedSpell);
      }
    } catch (err) {
      console.error('[MagicTab] Cast error:', err);
      addNotification(`Ошибка каста: ${err}`, 'error');
    } finally {
      setIsCasting(false);
    }
  };
  
  // Старая логика для совместимости
  const handleLegacyCast = async (spell: Spell) => {
    const log: string[] = [];
    log.push(`═══ ${spell.name} ═══`);
    triggerEffect('cast');
    
    let castBonus = spell.equipmentBonus ?? 0;
    for (const element of (spell.elements ?? [])) {
      const mod = unit.elementModifiers.find(m => m.element === element && m.isActive);
      if (mod) castBonus += mod.castBonus;
    }
    
    const castFormula = castBonus >= 0 ? `d20+${castBonus}` : `d20${castBonus}`;
    const castResult = await diceService.roll(
      castFormula,
      `Каст ${spell.name}`,
      unit.shortName ?? unit.name,
      'normal'
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
      
      {/* ═══ 🔥 УПРАВЛЕНИЕ МАНОЙ ═══ */}
      <Section title="Управление маной" icon="💠">
        <div className="space-y-3">
          {/* Текущая мана */}
          <div className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
            <span className="text-mana-bright text-sm">💠 Мана</span>
            <span className="text-bone font-bold">{unit.mana.current} / {unit.mana.max}</span>
          </div>
          
          {unit.useManaAsHp && (
            <div className="text-xs text-ancient p-2 bg-panel rounded border border-edge-bone">
              ⚠️ Мана используется как жизнь — урон и хил через вкладку Бой
            </div>
          )}
          
          <NumberStepper
            label="Количество маны"
            value={manaAmount}
            onChange={setManaAmount}
            min={0}
            max={9999}
          />
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="success"
              onClick={handleRestoreMana}
              disabled={manaAmount <= 0 || unit.mana.current >= unit.mana.max}
            >
              💠 Восстановить
            </Button>
            <Button
              variant="danger"
              onClick={handleSpendMana}
              disabled={manaAmount <= 0 || unit.mana.current <= 0}
            >
              🔻 Потратить
            </Button>
          </div>
        </div>
      </Section>
      
      {/* ═══ ЗАКЛИНАНИЯ ═══ */}
      <Section title="Заклинания" icon="✨">
        {spells.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">📜</div>
            <p className="text-faded text-sm">Добавьте заклинания в настройках персонажа</p>
          </div>
        ) : (
          <div className="space-y-3">
            
            {/* Группы заклинаний по типу */}
            <div className="space-y-2">
              {Object.entries(spellsByType).map(([type, typeSpells]) => {
                const isCollapsed = collapsedTypes.has(type);
                const typeName = SPELL_TYPES[type as keyof typeof SPELL_TYPES] ?? type;
                
                return (
                  <div key={type} className="border border-edge-bone rounded overflow-hidden">
                    <button
                      onClick={() => toggleType(type)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 bg-obsidian hover:bg-panel transition-colors text-left"
                    >
                      <span className="text-xs text-faded uppercase flex-1">{typeName}</span>
                      <span className="text-xs text-ancient">{typeSpells.length}</span>
                      <span className={`text-faded text-xs transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▾</span>
                    </button>
                    
                    {!isCollapsed && (
                      <div className="p-2 space-y-1 bg-panel/30">
                        {typeSpells.map(spell => {
                          const cost = getSpellCost(spell);
                          const isSelected = selectedSpell?.id === spell.id;
                          const resource = isSpellV2(spell) 
                            ? (spell.costResource === 'health' ? 'HP' : '💠')
                            : (spell.costType === 'health' ? 'HP' : '💠');
                          
                          return (
                            <button
                              key={spell.id}
                              onClick={() => setSelectedSpellId(spell.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                                isSelected 
                                  ? 'bg-gold/20 border border-gold/50' 
                                  : 'bg-obsidian border border-transparent hover:border-edge-bone'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-bone text-sm">{spell.name}</span>
                                <span className={`text-xs ${resource === 'HP' ? 'text-blood-bright' : 'text-mana-bright'}`}>
                                  {cost} {resource}
                                </span>
                              </div>
                              {isSpellV2(spell) && spell.elements.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {spell.elements.slice(0, 3).map(el => (
                                    <span key={el} className="text-xs opacity-60">{ELEMENT_ICONS[el] ?? '✨'}</span>
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Детали выбранного заклинания */}
            {selectedSpell && selectedSpellDisplay && (
              <div className="p-4 bg-obsidian rounded-lg border border-gold/30 space-y-2.5">
                <div className="font-cinzel text-gold text-sm">{selectedSpell.name}</div>
                
                {selectedSpellDisplay.elements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedSpellDisplay.elements.map(el => (
                      <span key={el} className="px-2 py-0.5 bg-panel rounded text-xs text-ancient">
                        {ELEMENT_ICONS[el] ?? '✨'} {ELEMENT_NAMES[el] ?? el}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="text-xs text-faded">
                  Тип: {SPELL_TYPES[selectedSpellDisplay.spellType as keyof typeof SPELL_TYPES] ?? selectedSpellDisplay.spellType}
                  {selectedSpellDisplay.projectiles && selectedSpellDisplay.projectiles !== '1' && (
                    <span className="text-ancient ml-2">• Снаряды: {selectedSpellDisplay.projectiles}</span>
                  )}
                </div>
                
                <div className="text-xs">
                  <span className={selectedSpellDisplay.costResource === 'health' ? 'text-blood-bright' : 'text-mana-bright'}>
                    Стоимость: {spellCost} {selectedSpellDisplay.costResource === 'health' ? 'HP' : 'маны'}
                  </span>
                  {isSpellV2(selectedSpell) && spellCost < Number(selectedSpell.cost) && (
                    <span className="text-green-500 ml-1">(−{Number(selectedSpell.cost) - spellCost} от предрасп.)</span>
                  )}
                </div>
                
                {isSpellV2(selectedSpell) && (
                  <div className="text-xs text-purple-400">
                    ⚡ V2: {selectedSpell.actions.length} шагов
                  </div>
                )}
                
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
              className="w-full text-sm py-3"
            >
              ✨ СОТВОРИТЬ
            </Button>
            
            {/* Лог каста */}
            {castLog.length > 0 && (
              <div className="p-3 bg-obsidian rounded-lg border border-edge-bone space-y-1 max-h-48 overflow-y-auto">
                {castLog.map((line, idx) => {
                  const parts = line.split(/(\*\*.*?\*\*)/g);
                  return (
                    <div 
                      key={idx} 
                      className={`text-sm font-garamond ${
                        line.includes('КРИТ ПРОВАЛ') ? 'text-blood-bright' :
                        line.includes('КРИТ') ? 'text-gold' :
                        line.includes('💥') ? 'text-blood-bright' :
                        line.includes('═══') ? 'text-gold font-cinzel' :
                        line.startsWith('🔥') || line.startsWith('💧') || line.startsWith('🪨') ||
                        line.startsWith('💨') || line.startsWith('✨') || line.startsWith('🌀') ||
                        line.startsWith('🌟') || line.startsWith('☠️') || line.startsWith('⚡') ||
                        line.startsWith('🌑') || line.startsWith('🕳️') || line.startsWith('💚') ||
                        line.startsWith('🌿') || line.startsWith('💀') || line.startsWith('📈') ||
                        line.startsWith('💠')
                          ? 'text-gold-dark' :
                        'text-bone'
                      }`}
                    >
                      {parts.map((part, pi) => 
                        part.startsWith('**') && part.endsWith('**') 
                          ? <strong key={pi} className="text-gold font-cinzel">{part.slice(2, -2)}</strong>
                          : part
                      )}
                    </div>
                  );
                })}
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
              <div className="p-4 bg-blood/20 rounded-lg border border-blood/50 text-center">
                <div className="text-xs text-faded uppercase mb-1.5">Итоговый урон</div>
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
            
            {/* Элементные эффекты */}
            {lastElementEffects && lastElementEffects.effects.filter(e => e.triggered).length > 0 && (
              <div className="p-4 bg-gold/5 rounded-lg border border-gold/30 space-y-2.5">
                <div className="text-xs text-gold uppercase font-cinzel tracking-wider">⚡ Элементные эффекты</div>
                {lastElementEffects.effects.filter(e => e.triggered).map((effect, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-base shrink-0">{effect.icon}</span>
                    <div>
                      <span className="font-cinzel text-ancient text-xs">{effect.effectName}</span>
                      <span className="text-faded text-xs ml-2">
                        {effect.stackable ? '(суммируется)' : '(не суммируется)'}
                      </span>
                      <div className="text-bone font-garamond text-xs">{effect.description}</div>
                    </div>
                  </div>
                ))}
                {lastElementEffects.totalBonusDamage > 0 && (
                  <div className="text-xs text-blood-bright font-cinzel pt-1 border-t border-gold/20">
                    📈 Суммарный доп. урон: +{lastElementEffects.totalBonusDamage}
                  </div>
                )}
                {lastElementEffects.manaCostModifier < 0 && (
                  <div className="text-xs text-mana-bright font-cinzel pt-1 border-t border-gold/20">
                    💠 Стоимость снижена на 50%
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
