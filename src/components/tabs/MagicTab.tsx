// src/components/tabs/MagicTab.tsx

import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, NumberStepper, DiceResultDisplay, EmptyState } from '../ui';
import { spellExecutor } from '../../services/spellExecutor';
import { diceService } from '../../services/diceService';
import type { DiceRollResult, Spell, SpellV2, CastContext } from '../../types';
import { isSpellV2, DAMAGE_TYPE_NAMES, ELEMENT_NAMES } from '../../types';
import { ELEMENT_ICONS, SPELL_TYPES } from '../../constants/elements';

export function MagicTab() {
  const { 
    units, selectedUnitId, 
    spendMana, setHP, setMana,
    triggerEffect, addCombatLog, addNotification
  } = useGameStore();
  
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [selectedSpellId, setSelectedSpellId] = useState<string>('');
  const [targetCount, setTargetCount] = useState(1);
  const [isCasting, setIsCasting] = useState(false);
  const [castLog, setCastLog] = useState<string[]>([]);
  const [castResults, setCastResults] = useState<DiceRollResult[]>([]);
  const [lastContext, setLastContext] = useState<CastContext | null>(null);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  
  // 🔥 Состояние управления маной
  const [manaAmount, setManaAmount] = useState(0);
  
  if (!unit) return <EmptyState icon="✨" title="Нет персонажа" description="Выберите персонажа для магии" />;
  
  const spells = unit.spells ?? [];
  const selectedSpell = spells.find(s => s.id === selectedSpellId) ?? spells[0];
  
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
  
  const getSpellCost = (spell: Spell | SpellV2): number => {
    if (isSpellV2(spell)) return spellExecutor.calculateManaCost(spell, unit);
    let cost = spell.manaCost;
    for (const el of (spell.elements ?? [])) {
      const mod = unit.elementModifiers.find(m => m.element === el && m.isActive);
      if (mod) cost -= mod.manaReduction;
    }
    return Math.max(0, cost);
  };
  
  const spellCost = selectedSpell ? getSpellCost(selectedSpell) : 0;
  
  const spellsByType = spells.reduce((acc, spell) => {
    const type = isSpellV2(spell) ? spell.spellType : spell.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(spell);
    return acc;
  }, {} as Record<string, (Spell | SpellV2)[]>);
  
  const toggleType = (type: string) => {
    setCollapsedTypes(prev => { const n = new Set(prev); if (n.has(type)) n.delete(type); else n.add(type); return n; });
  };
  
  const handleCast = async () => {
    if (!selectedSpell) return;
    const costResource = isSpellV2(selectedSpell) ? selectedSpell.costResource : (selectedSpell.costType === 'health' ? 'health' : 'mana');
    if (costResource === 'health' && unit.health.current < spellCost) { addNotification(`Недостаточно HP! Нужно ${spellCost}`, 'warning'); return; }
    if (costResource === 'mana' && unit.mana.current < spellCost) { addNotification(`Недостаточно маны! Нужно ${spellCost}`, 'warning'); return; }
    
    setIsCasting(true); setCastLog([]); setCastResults([]); setLastContext(null);
    
    try {
      if (costResource === 'health') {
        await setHP(unit.id, unit.health.current - spellCost);
        addCombatLog(unit.shortName ?? unit.name, 'Кровавая магия', `-${spellCost} HP`);
      } else {
        await spendMana(unit.id, spellCost);
      }
      
      if (isSpellV2(selectedSpell)) {
        const result = await spellExecutor.execute({
          spell: selectedSpell, caster: unit, targetCount,
          rollModifier: 'normal', onLog: (msg) => console.log('[Spell]', msg),
        });
        setCastLog(result.log); setLastContext(result.context);
        setCastResults(result.context.rolls.map(r => ({ formula: r.formula, rolls: r.rolls, bonus: 0, total: r.total, rawD20: r.rawD20, isCrit: r.isCrit, isCritFail: r.isCritFail })));
        if (result.context.isCritFail) triggerEffect('crit-fail');
        else if (result.context.isCrit) triggerEffect('crit-gold');
        if (result.totalDamage > 0) {
          await diceService.broadcastSpell(selectedSpell.name, unit.shortName ?? unit.name, result.totalDamage, result.damageType, result.context.isCrit);
          addCombatLog(unit.shortName ?? unit.name, selectedSpell.name, `${result.totalDamage} ${result.damageType ?? ''}`);
        } else {
          addCombatLog(unit.shortName ?? unit.name, selectedSpell.name, 'скастовано');
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
  
  const handleLegacyCast = async (spell: Spell) => {
    const log: string[] = [`═══ ${spell.name} ═══`];
    let castBonus = spell.equipmentBonus ?? 0;
    for (const el of (spell.elements ?? [])) {
      const mod = unit.elementModifiers.find(m => m.element === el && m.isActive);
      if (mod) castBonus += mod.castBonus;
    }
    const castFormula = castBonus >= 0 ? `d20+${castBonus}` : `d20${castBonus}`;
    const castResult = await diceService.roll(castFormula, `Каст ${spell.name}`, unit.shortName ?? unit.name, 'normal');
    setCastResults([castResult]);
    if (castResult.isCritFail) { log.push(`💀 Каст: [${castResult.rawD20}] = КРИТ ПРОВАЛ!`); triggerEffect('crit-fail'); setCastLog(log); return; }
    if (castResult.isCrit) { log.push(`✨ Каст: [${castResult.rawD20}]+${castBonus}=${castResult.total} — КРИТ!`); triggerEffect('crit-gold'); }
    else { log.push(`🎯 Каст: [${castResult.rawD20}]+${castBonus}=${castResult.total}`); }
    if (spell.damageFormula) {
      let dmgBonus = 0;
      for (const el of (spell.elements ?? [])) { const mod = unit.elementModifiers.find(m => m.element === el && m.isActive); if (mod) dmgBonus += mod.damageBonus; }
      let f = spell.damageFormula; if (dmgBonus > 0) f = `${f}+${dmgBonus}`;
      const dmg = await diceService.rollDamage(f, `Урон ${spell.name}`, unit.shortName ?? unit.name, castResult.isCrit);
      setCastResults(prev => [...prev, dmg]);
      log.push(`💥 ${dmg.total}${castResult.isCrit?' ×2':''} ${spell.damageType ? DAMAGE_TYPE_NAMES[spell.damageType] : ''}`);
      addCombatLog(unit.shortName ?? unit.name, spell.name, `${dmg.total} урона`);
    } else { addCombatLog(unit.shortName ?? unit.name, spell.name, 'скастовано'); }
    setCastLog(log);
  };
  
  // 🔥 Мана
  const handleRestoreMana = async () => {
    if (manaAmount <= 0) return;
    const newMana = Math.min(unit.mana.max, unit.mana.current + manaAmount);
    const actual = newMana - unit.mana.current;
    if (actual <= 0) return;
    await setMana(unit.id, newMana);
    triggerEffect('heal');
    addCombatLog(unit.shortName ?? unit.name, 'Восстановление маны', `+${actual} 💠`);
    try { await diceService.showNotification(`💠 ${unit.shortName??unit.name} восстановил ${actual} маны (${newMana}/${unit.mana.max})`); } catch {}
    setManaAmount(0);
  };
  
  const handleSpendMana = async () => {
    if (manaAmount <= 0) return;
    const newMana = Math.max(0, unit.mana.current - manaAmount);
    const actual = unit.mana.current - newMana;
    if (actual <= 0) return;
    await setMana(unit.id, newMana);
    addCombatLog(unit.shortName ?? unit.name, 'Трата маны', `-${actual} 💠`);
    setManaAmount(0);
  };
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      
      {/* 🔥 УПРАВЛЕНИЕ МАНОЙ */}
      <Section title="Управление маной" icon="💠">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
            <span className="text-mana-bright text-sm">💠 Мана</span>
            <span className="text-bone font-bold">{unit.mana.current} / {unit.mana.max}</span>
          </div>
          {unit.useManaAsHp && (
            <div className="text-xs text-ancient p-2 bg-panel rounded border border-edge-bone">⚠️ Мана = жизнь. Урон/хил через вкладку Бой</div>
          )}
          <NumberStepper label="Количество" value={manaAmount} onChange={setManaAmount} min={0} max={9999} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="success" onClick={handleRestoreMana} disabled={manaAmount<=0||unit.mana.current>=unit.mana.max}>💠 Восстановить</Button>
            <Button variant="danger" onClick={handleSpendMana} disabled={manaAmount<=0||unit.mana.current<=0}>🔻 Потратить</Button>
          </div>
        </div>
      </Section>
      
      {/* ЗАКЛИНАНИЯ */}
      <Section title="Заклинания" icon="✨">
        {spells.length === 0 ? (
          <div className="text-center py-6"><div className="text-4xl mb-2">📜</div><p className="text-faded text-sm">Добавьте заклинания в настройках</p></div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {Object.entries(spellsByType).map(([type, typeSpells]) => {
                const isCollapsed = collapsedTypes.has(type);
                return (
                  <div key={type} className="border border-edge-bone rounded overflow-hidden">
                    <button onClick={() => toggleType(type)} className="w-full flex items-center gap-2 px-2 py-1.5 bg-obsidian hover:bg-panel transition-colors text-left">
                      <span className="text-xs text-faded uppercase flex-1">{SPELL_TYPES[type as keyof typeof SPELL_TYPES] ?? type}</span>
                      <span className="text-xs text-ancient">{typeSpells.length}</span>
                      <span className={`text-faded text-xs transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▾</span>
                    </button>
                    {!isCollapsed && (
                      <div className="p-2 space-y-1 bg-panel/30">
                        {typeSpells.map(spell => {
                          const cost = getSpellCost(spell);
                          const isSelected = selectedSpell?.id === spell.id;
                          const res = isSpellV2(spell) ? (spell.costResource === 'health' ? 'HP' : '💠') : (spell.costType === 'health' ? 'HP' : '💠');
                          return (
                            <button key={spell.id} onClick={() => setSelectedSpellId(spell.id)} className={`w-full text-left px-2 py-1.5 rounded transition-all ${isSelected ? 'bg-gold/20 border border-gold/50' : 'bg-obsidian border border-transparent hover:border-edge-bone'}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-bone text-sm">{spell.name}</span>
                                <span className={`text-xs ${res==='HP'?'text-blood-bright':'text-mana-bright'}`}>{cost} {res}</span>
                              </div>
                              {isSpellV2(spell) && spell.elements.length > 0 && <div className="flex gap-1 mt-1">{spell.elements.slice(0,3).map(el=><span key={el} className="text-xs opacity-60">{ELEMENT_ICONS[el]??'✨'}</span>)}</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {selectedSpell && selectedSpellDisplay && (
              <div className="p-3 bg-obsidian rounded border border-gold/30 space-y-2">
                <div className="font-cinzel text-gold text-sm">{selectedSpell.name}</div>
                {selectedSpellDisplay.elements.length > 0 && <div className="flex flex-wrap gap-1">{selectedSpellDisplay.elements.map(el=><span key={el} className="px-2 py-0.5 bg-panel rounded text-xs text-ancient">{ELEMENT_ICONS[el]??'✨'} {ELEMENT_NAMES[el]??el}</span>)}</div>}
                <div className="text-xs text-faded">Тип: {SPELL_TYPES[selectedSpellDisplay.spellType as keyof typeof SPELL_TYPES]??selectedSpellDisplay.spellType}{selectedSpellDisplay.projectiles&&selectedSpellDisplay.projectiles!=='1'&&<span className="text-ancient ml-2">• Снаряды: {selectedSpellDisplay.projectiles}</span>}</div>
                <div className="text-xs"><span className={selectedSpellDisplay.costResource==='health'?'text-blood-bright':'text-mana-bright'}>Стоимость: {spellCost} {selectedSpellDisplay.costResource==='health'?'HP':'маны'}</span>{isSpellV2(selectedSpell)&&spellCost<selectedSpell.cost&&<span className="text-green-500 ml-1">(−{selectedSpell.cost-spellCost} от предрасп.)</span>}</div>
                {isSpellV2(selectedSpell) && <div className="text-xs text-purple-400">⚡ V2: {selectedSpell.actions.length} шагов</div>}
                {selectedSpellDisplay.description && <div className="text-xs text-bone italic border-t border-edge-bone pt-2 mt-2">{selectedSpellDisplay.description}</div>}
              </div>
            )}
            
            <NumberStepper label="Количество целей" value={targetCount} onChange={setTargetCount} min={1} max={10} />
            <Button variant="gold" onClick={handleCast} loading={isCasting} disabled={!selectedSpell} className="w-full">✨ СОТВОРИТЬ</Button>
            
            {castLog.length > 0 && (
              <div className="p-3 bg-obsidian rounded border border-edge-bone space-y-1 max-h-48 overflow-y-auto">
                {castLog.map((line, idx) => <div key={idx} className={`text-sm font-garamond ${line.includes('КРИТ ПРОВАЛ')?'text-blood-bright':line.includes('КРИТ')?'text-gold':line.includes('💥')?'text-blood-bright':line.includes('═══')?'text-gold font-cinzel':'text-bone'}`}>{line}</div>)}
              </div>
            )}
            {castResults.length > 0 && <div className="space-y-2"><div className="text-xs text-faded uppercase">Броски:</div><DiceResultDisplay results={castResults} /></div>}
            {lastContext && lastContext.totalDamage > 0 && (
              <div className="p-3 bg-blood/20 rounded border border-blood/50 text-center">
                <div className="text-xs text-faded uppercase mb-1">Итоговый урон</div>
                <div className="text-2xl font-cinzel text-blood-bright">💥 {lastContext.totalDamage}{lastContext.damageType&&<span className="text-sm text-ancient ml-2">({DAMAGE_TYPE_NAMES[lastContext.damageType as keyof typeof DAMAGE_TYPE_NAMES]??lastContext.damageType})</span>}</div>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
