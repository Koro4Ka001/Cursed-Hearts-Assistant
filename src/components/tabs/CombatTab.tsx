// src/components/tabs/CombatTab.tsx

import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, NumberStepper, Checkbox, DiceResultDisplay, EmptyState, ProgressBar, ModifierToggle } from '../ui';
import { isHit } from '../../utils/dice';
import { calculateDamage, getStatDamageBonus } from '../../utils/damage';
import { diceService } from '../../services/diceService';
import { executeWeaponEffects } from '../../utils/weaponEffects';
import { BonusDamageField } from '../BonusDamageField';
import { SortableTab } from '../SortableTab';
import type { DiceRollResult, DamageType, DamageCategory, RollModifier } from '../../types';
import { DAMAGE_TYPE_NAMES, PHYSICAL_DAMAGE_TYPES, MAGICAL_DAMAGE_TYPES } from '../../types';

// Оба куба при помехе/преимуществе: [17|4→17], иначе [12]
const d20Txt = (r: DiceRollResult): string =>
  r.allD20Rolls && r.allD20Rolls.length > 1
    ? `[${r.allD20Rolls.join('|')}→${r.rawD20}]`
    : `[${r.rawD20}]`;

// ═══════════════════════════════════════════════════════════════
export function CombatTab() {
  const {
    units, selectedUnitId, takeDamage, heal: healUnit, addRage,
    setResource, triggerEffect, addCombatLog
  } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [selectedMeleeWeaponId, setSelectedMeleeWeaponId] = useState<string>('');
  const [meleeTargetCount, setMeleeTargetCount] = useState(1);
  // Модификатор броска попадания (одноразовый): Помеха/Преимущество
  const [meleeModifier, setMeleeModifier] = useState<RollModifier>('normal');
  const [meleeAttackResults, setMeleeAttackResults] = useState<DiceRollResult[]>([]);
  const [meleeDamageResults, setMeleeDamageResults] = useState<DiceRollResult[]>([]);
  const [isMeleeAttacking, setIsMeleeAttacking] = useState(false);
  const [meleeLog, setMeleeLog] = useState<string[]>([]);
  
  const [selectedRangedWeaponId, setSelectedRangedWeaponId] = useState<string>('');
  const [selectedAmmoId, setSelectedAmmoId] = useState<string>('');
  const [rangedShotCount, setRangedShotCount] = useState(1);
  const [rangedModifier, setRangedModifier] = useState<RollModifier>('normal');
  const [rangedDamageResults, setRangedDamageResults] = useState<DiceRollResult[]>([]);
  const [isRangedAttacking, setIsRangedAttacking] = useState(false);
  const [rangedLog, setRangedLog] = useState<string[]>([]);
  
  const [incomingDamage, setIncomingDamage] = useState(0);
  const [isUndeadAttacker, setIsUndeadAttacker] = useState(false);
  const [damageCategory, setDamageCategory] = useState<DamageCategory>('physical');
  const [damageType, setDamageType] = useState<DamageType>('slashing');
  const [healAmount, setHealAmount] = useState(0);
  
  if (!unit) return <EmptyState icon="⚔️" title="Нет персонажа" description="Выберите персонажа для боя" />;
  
  const weapons = unit.weapons ?? [];
  const resources = unit.resources ?? [];
  const proficiencies = unit.proficiencies ?? {};
  const meleeWeapons = weapons.filter(w => w.type === 'melee');
  const rangedWeapons = weapons.filter(w => w.type === 'ranged');
  const ammoResources = resources.filter(r => r.resourceType === 'ammo');
  const selectedMeleeWeapon = meleeWeapons.find(w => w.id === selectedMeleeWeaponId) ?? meleeWeapons[0];
  const selectedRangedWeapon = rangedWeapons.find(w => w.id === selectedRangedWeaponId) ?? rangedWeapons[0];
  const selectedAmmo = ammoResources.find(r => r.id === selectedAmmoId) ?? ammoResources[0];
  
  const handleAddRageOnDamage = async (damageDealt: number, armorBlocked: boolean) => {
    if (!unit.hasRage) return;
    
    const config = unit.rageConfig ?? { onTakeDamage: 5, onArmorBlock: 2, onDealDamage: 4, max: 100 };
    
    if (armorBlocked) {
      await addRage(unit.id, config.onArmorBlock);
      addCombatLog(unit.shortName ?? unit.name, 'Rage', `+${config.onArmorBlock} (броня)`);
    } else {
      await addRage(unit.id, config.onTakeDamage);
      addCombatLog(unit.shortName ?? unit.name, 'Rage', `+${config.onTakeDamage} (урон)`);
    }
  };
  
  const handleAddRageOnDealDamage = async (damageDealt: number) => {
    if (!unit.hasRage || damageDealt <= 0) return;
    
    const config = unit.rageConfig ?? { onTakeDamage: 5, onArmorBlock: 2, onDealDamage: 4, max: 100 };
    await addRage(unit.id, config.onDealDamage);
    addCombatLog(unit.shortName ?? unit.name, 'Rage', `+${config.onDealDamage} (атака)`);
  };
  
  const handleMeleeAttack = async () => {
    if (!selectedMeleeWeapon) return;
    setIsMeleeAttacking(true);
    setMeleeAttackResults([]); setMeleeDamageResults([]); setMeleeLog([]);
    const atkRes: DiceRollResult[] = []; const dmgRes: DiceRollResult[] = [];
    const log: string[] = [];
    // Берём свежие данные юнита (могли измениться от rage effects)
    const freshUnit = useGameStore.getState().units.find(u => u.id === unit.id) ?? unit;
    console.log('[Combat] Fresh unit stats:', JSON.stringify(freshUnit.stats), 'proficiencies:', JSON.stringify(freshUnit.proficiencies));
    try {
      const meleeMod = meleeModifier;
      setMeleeModifier('normal');
      for (let t = 0; t < meleeTargetCount; t++) {
        if (meleeTargetCount > 1) log.push(`--- Цель ${t + 1} ---`);

        // Накопители урона текущей цели
        let meleeBonusDmg = 0;
        let extraTotal = 0;
        let extraLabel = '';
        
        const profBonus = proficiencies[selectedMeleeWeapon.proficiencyType] ?? 0;
        const hitBonus = profBonus + (selectedMeleeWeapon.hitBonus ?? 0);
        const hitFormula = hitBonus >= 0 ? `d20+${hitBonus}` : `d20${hitBonus}`;
        // Заряд сгорает на первой попытке — даже при промахе
        const pendingBonus = t === 0 ? useGameStore.getState().consumePendingBonusDamage() : null;
        const hitResult = await diceService.roll(hitFormula, `Попадание ${selectedMeleeWeapon.name}`, freshUnit.shortName ?? freshUnit.name, t === 0 ? meleeMod : 'normal');
        atkRes.push(hitResult);
        
        if (hitResult.isCritFail) {
          log.push(`💀 ${d20Txt(hitResult)} = КРИТ ПРОМАХ!`);
          if (pendingBonus) log.push(`    💠 Заряженный урон сгорел (промах)`);
          continue;
        }
        if (!isHit(hitResult)) {
          log.push(`❌ ${d20Txt(hitResult)}+${hitBonus}=${hitResult.total} — Промах`);
          if (pendingBonus) log.push(`    💠 Заряженный урон сгорел (промах)`);
          continue;
        }
        
        const isCrit = hitResult.isCrit;
        const statBonus = getStatDamageBonus(freshUnit, selectedMeleeWeapon.statBonus, selectedMeleeWeapon.proficiencyType);
        console.log('[Combat] statBonus:', statBonus, 'from stat:', freshUnit.stats[selectedMeleeWeapon.statBonus === 'physicalPower' ? 'physicalPower' : 'dexterity'], 'profType:', selectedMeleeWeapon.proficiencyType, 'profVal:', freshUnit.proficiencies[selectedMeleeWeapon.proficiencyType]);
        const base = selectedMeleeWeapon.damageFormula ?? 'd6';
        const formula = statBonus > 0 ? `${base}+${statBonus}` : base;
        // 🔧 Тихий бросок: один общий broadcast после всех компонент урона
        const dmg = await diceService.rollDamage(formula, undefined, undefined, isCrit, true);
        dmgRes.push(dmg);
        
        await handleAddRageOnDealDamage(dmg.total);
        
        log.push(`🎯 ${d20Txt(hitResult)}+${hitBonus}=${hitResult.total} ${isCrit ? '✨КРИТ ' : ''}→ 💥${dmg.total} ${DAMAGE_TYPE_NAMES[selectedMeleeWeapon.damageType] ?? ''}`);
        addCombatLog(freshUnit.shortName ?? freshUnit.name, selectedMeleeWeapon.name, `${isCrit ? '✨КРИТ ' : ''}${dmg.total} ${DAMAGE_TYPE_NAMES[selectedMeleeWeapon.damageType] ?? ''}`);
        
        if (selectedMeleeWeapon.extraDamageFormula && selectedMeleeWeapon.extraDamageType) {
          extraLabel = DAMAGE_TYPE_NAMES[selectedMeleeWeapon.extraDamageType] ?? 'доп';
          const extra = await diceService.rollDamage(selectedMeleeWeapon.extraDamageFormula, undefined, undefined, isCrit, true);
          dmgRes.push(extra);
          extraTotal = extra.total;
          log.push(`    + ${extra.total} ${extraLabel}`);
        }

        // Заряженный доп. урон — списан на первой попытке
        if (pendingBonus) {
          const bLabel = DAMAGE_TYPE_NAMES[pendingBonus.damageType] ?? pendingBonus.damageType;
          const bDmg = await diceService.rollDamage(pendingBonus.formula, undefined, undefined, isCrit, true);
          dmgRes.push(bDmg);
          meleeBonusDmg += bDmg.total;
          log.push(`    💠 +${bDmg.total} ${bLabel} (заряженный урон)`);
          addCombatLog(freshUnit.shortName ?? freshUnit.name, 'Заряженный урон', `+${bDmg.total} ${bLabel}`);
        }

        // Один объединённый broadcast на все компоненты урона (вместо 3-4 плашек)
        {
          const parts: string[] = [`${dmg.total} (${DAMAGE_TYPE_NAMES[selectedMeleeWeapon.damageType] ?? selectedMeleeWeapon.damageType})`];
          if (extraTotal > 0) parts.push(`+${extraTotal} ${extraLabel}`);
          if (meleeBonusDmg > 0) parts.push(`+${meleeBonusDmg} заряженный`);
          const totalSum = dmg.total + extraTotal + meleeBonusDmg;
          await diceService.broadcastMessage({
            id: `dmg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'damage',
            unitName: freshUnit.shortName ?? freshUnit.name,
            title: `Урон ${selectedMeleeWeapon.name}`,
            subtitle: `${parts.join(' + ')} = ${totalSum}`,
            icon: '💥',
            rolls: dmg.rolls,
            total: totalSum,
            isCrit,
            color: isCrit ? 'gold' : 'blood',
            timestamp: Date.now(),
          });
        }
        
        if (selectedMeleeWeapon.onHitActions?.length) {
          console.log('[WeaponFX] Melee onHitActions:', JSON.stringify(selectedMeleeWeapon.onHitActions, null, 2));
          console.log('[WeaponFX] Context: hitRoll=', hitResult.rawD20, 'hitTotal=', hitResult.total, 'damage=', dmg.total);
          
          const effectLog: string[] = [];
          executeWeaponEffects(
            selectedMeleeWeapon.onHitActions,
            {
              hitRoll: hitResult.rawD20 ?? 0,
              hitTotal: hitResult.total,
              isCrit: !!isCrit,
              isCritFail: false,
              damage: dmg.total + extraTotal + meleeBonusDmg,
              weaponName: selectedMeleeWeapon.name,
              unitName: freshUnit.shortName ?? freshUnit.name,
              unitId: freshUnit.id,
              targetIndex: t,
              shotIndex: 0,
              values: {},
              log: effectLog,
            },
            addCombatLog
          );
          
          console.log('[WeaponFX] Effect log:', effectLog);
          
          for (const msg of effectLog) {
            log.push(`    ⚡ ${msg}`);
            await diceService.broadcastWeaponEffect(
              freshUnit.shortName ?? freshUnit.name,
              selectedMeleeWeapon.name,
              msg
            );
          }
        }
      }
    } finally {
      setMeleeAttackResults(atkRes);
      setMeleeDamageResults(dmgRes);
      setMeleeLog(log);
      setIsMeleeAttacking(false);
    }
  };
  
  const handleRangedAttack = async () => {
    if (!selectedRangedWeapon || !selectedAmmo) return;
    const arrowsFlying = selectedRangedWeapon.multishot ?? 1;
    const ammoConsumed = selectedRangedWeapon.ammoPerShot ?? arrowsFlying;
    const totalNeeded = rangedShotCount * ammoConsumed;
    const ammoCur = selectedAmmo.current ?? 0;
    if (ammoCur < totalNeeded) { await diceService.showNotification(`❌ Недостаточно ${selectedAmmo.name}!`); return; }
    setIsRangedAttacking(true); setRangedDamageResults([]); setRangedLog([]);
    const dmgRes: DiceRollResult[] = []; const log: string[] = [];
    const rangedMod = rangedModifier;
    setRangedModifier('normal');
    try {
      for (let s = 0; s < rangedShotCount; s++) {
        if (rangedShotCount > 1) log.push(`--- Выстрел ${s + 1} ---`);
        for (let a = 0; a < arrowsFlying; a++) {
          const hitBonus = (proficiencies.bows ?? 0) + (selectedRangedWeapon.hitBonus ?? 0);
          const hitFormula = hitBonus >= 0 ? `d20+${hitBonus}` : `d20${hitBonus}`;
          // Заряд сгорает на первой стреле — даже при промахе
          const pendingBonus = (s === 0 && a === 0) ? useGameStore.getState().consumePendingBonusDamage() : null;
          const burnLine = `    💠 Заряженный урон сгорел (промах)`;
          const hit = await diceService.roll(hitFormula, `Стрела ${a + 1}`, unit.shortName ?? unit.name, s === 0 && a === 0 ? rangedMod : 'normal');
          if (hit.isCritFail) { log.push(`💀 Стрела ${a + 1}: ${d20Txt(hit)} = КРИТ ПРОМАХ!`); if (pendingBonus) log.push(burnLine); continue; }
          if (!isHit(hit)) { log.push(`❌ Стрела ${a + 1}: ${d20Txt(hit)}+${hitBonus}=${hit.total} — Промах`); if (pendingBonus) log.push(burnLine); continue; }
          
          let shotDamage = 0;
          
          if (selectedAmmo.damageFormula && selectedAmmo.damageType) {
            const dexB = getStatDamageBonus(unit, 'dexterity', 'bows');
            const f = dexB > 0 ? `${selectedAmmo.damageFormula}+${dexB}` : selectedAmmo.damageFormula;
            // 🔧 Тихие броски: один общий broadcast после всех компонент урона
            const dmg = await diceService.rollDamage(f, undefined, undefined, hit.isCrit, true);
            dmgRes.push(dmg);
            shotDamage = dmg.total;
            log.push(`🎯 Стрела ${a + 1}: ${d20Txt(hit)}+${hitBonus}=${hit.total} ${hit.isCrit ? '✨КРИТ ' : ''}→ 💥${dmg.total} ${DAMAGE_TYPE_NAMES[selectedAmmo.damageType] ?? ''}`);
            addCombatLog(unit.shortName ?? unit.name, `${selectedRangedWeapon.name} (${selectedAmmo.name})`, `${hit.isCrit ? '✨КРИТ ' : ''}${dmg.total} ${DAMAGE_TYPE_NAMES[selectedAmmo.damageType] ?? ''}`);
            
            await handleAddRageOnDealDamage(dmg.total);
            
            let extraTotal = 0;
            let extraLabel = '';
            let bonusTotal = 0;
            if (selectedAmmo.extraDamageFormula && selectedAmmo.extraDamageType) {
              extraLabel = DAMAGE_TYPE_NAMES[selectedAmmo.extraDamageType] ?? 'доп';
              const extra = await diceService.rollDamage(selectedAmmo.extraDamageFormula, undefined, undefined, hit.isCrit, true);
              dmgRes.push(extra);
              extraTotal = extra.total; shotDamage += extra.total;
              log.push(`    + ${extra.total} ${extraLabel}`);
            }

            // Заряженный доп. урон — списан на первой стреле
            if (pendingBonus) {
              const bLabel = DAMAGE_TYPE_NAMES[pendingBonus.damageType] ?? pendingBonus.damageType;
              const bDmg = await diceService.rollDamage(pendingBonus.formula, undefined, undefined, hit.isCrit, true);
              dmgRes.push(bDmg); bonusTotal = bDmg.total; shotDamage += bDmg.total;
              log.push(`    💠 +${bDmg.total} ${bLabel} (заряженный урон)`);
              addCombatLog(unit.shortName ?? unit.name, 'Заряженный урон', `+${bDmg.total} ${bLabel}`);
            }

            // Один объединённый broadcast на все компоненты урона (вместо 3-4 плашек)
            {
              const parts: string[] = [`${dmg.total} (${DAMAGE_TYPE_NAMES[selectedAmmo.damageType] ?? selectedAmmo.damageType})`];
              if (extraTotal > 0) parts.push(`+${extraTotal} ${extraLabel}`);
              if (bonusTotal > 0) parts.push(`+${bonusTotal} заряженный`);
              await diceService.broadcastMessage({
                id: `dmg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'damage',
                unitName: unit.shortName ?? unit.name,
                title: `Урон ${selectedAmmo.name}`,
                subtitle: `${parts.join(' + ')} = ${shotDamage}`,
                icon: '💥',
                rolls: dmg.rolls,
                total: shotDamage,
                isCrit: !!hit.isCrit,
                color: hit.isCrit ? 'gold' : 'blood',
                timestamp: Date.now(),
              });
            }
          } else { log.push(`🎯 Стрела ${a + 1}: ${d20Txt(hit)}+${hitBonus}=${hit.total} — Попадание!`); if (pendingBonus) log.push(`    💠 Заряженный урон сгорел (попадание без урона)`); }
          
          if (selectedRangedWeapon.onHitActions?.length) {
            console.log('[WeaponFX] Ranged weapon onHitActions:', selectedRangedWeapon.onHitActions.length, 'hitTotal:', hit.total);
            const effectLog: string[] = [];
            executeWeaponEffects(
              selectedRangedWeapon.onHitActions,
              {
                hitRoll: hit.rawD20 ?? 0,
                hitTotal: hit.total,
                isCrit: !!hit.isCrit,
                isCritFail: false,
                damage: shotDamage,
                weaponName: selectedRangedWeapon.name,
                unitName: unit.shortName ?? unit.name,
                unitId: unit.id,
                targetIndex: 0,
                shotIndex: s,
                values: {},
                log: effectLog,
              },
              addCombatLog
            );
            for (const msg of effectLog) {
              log.push(`    ⚡ ${msg}`);
              await diceService.broadcastWeaponEffect(unit.shortName ?? unit.name, selectedRangedWeapon.name, msg);
            }
          }
          
          if (selectedAmmo.onHitActions?.length) {
            console.log('[WeaponFX] Ammo onHitActions:', selectedAmmo.onHitActions.length, 'hitTotal:', hit.total);
            const effectLog: string[] = [];
            executeWeaponEffects(
              selectedAmmo.onHitActions,
              {
                hitRoll: hit.rawD20 ?? 0,
                hitTotal: hit.total,
                isCrit: !!hit.isCrit,
                isCritFail: false,
                damage: shotDamage,
                weaponName: selectedAmmo.name,
                unitName: unit.shortName ?? unit.name,
                unitId: unit.id,
                targetIndex: 0,
                shotIndex: s,
                values: {},
                log: effectLog,
              },
              addCombatLog
            );
            for (const msg of effectLog) {
              log.push(`    ⚡ ${msg}`);
              await diceService.broadcastWeaponEffect(unit.shortName ?? unit.name, selectedAmmo.name, msg);
            }
          }
        }
      }
      await setResource(unit.id, selectedAmmo.id, ammoCur - totalNeeded);
      log.push(`📦 Списано ${totalNeeded} ${selectedAmmo.name}`);
    } finally { setRangedDamageResults(dmgRes); setRangedLog(log); setIsRangedAttacking(false); }
  };
  
  const damagePreview = unit && incomingDamage > 0 ? calculateDamage(incomingDamage, damageType, unit, isUndeadAttacker) : null;
  
  const handleTakeDamage = async () => {
    if (!damagePreview) return;
    
    const armorBlocked = incomingDamage > 0 && damagePreview.finalDamage === 0;
    
    // Если урон полностью заблокирован бронёй — всё равно начисляем Rage и логируем
    if (armorBlocked) {
      await handleAddRageOnDamage(incomingDamage, true);
      triggerEffect('shake');
      addCombatLog(unit.shortName ?? unit.name, 'Блок бронёй', `${incomingDamage} ${DAMAGE_TYPE_NAMES[damageType] ?? damageType} → 0 (заблокировано)`);
      setIncomingDamage(0);
      return;
    }
    
    if (damagePreview.finalDamage === 0) return;
    
    await takeDamage(unit.id, damagePreview.finalDamage);
    await handleAddRageOnDamage(incomingDamage, false);
    
    triggerEffect('damage');
    addCombatLog(unit.shortName ?? unit.name, 'Получил урон', `${damagePreview.finalDamage} ${DAMAGE_TYPE_NAMES[damageType] ?? damageType}`);
    
    // Берём свежие данные после применения урона
    const freshUnit = useGameStore.getState().units.find(u => u.id === unit.id);
    if (freshUnit) {
      if (freshUnit.useManaAsHp) {
        await diceService.announceTakeDamage(freshUnit.shortName ?? freshUnit.name, damagePreview.finalDamage, freshUnit.mana.current, freshUnit.mana.max);
      } else {
        await diceService.announceTakeDamage(freshUnit.shortName ?? freshUnit.name, damagePreview.finalDamage, freshUnit.health.current, freshUnit.health.max);
      }
    }
    setIncomingDamage(0);
  };
  
  const handleHeal = async () => {
    if (healAmount <= 0) return;
    await healUnit(unit.id, healAmount);
    triggerEffect('heal');
    addCombatLog(unit.shortName ?? unit.name, 'Исцеление', `+${healAmount} HP`);
    const freshUnit = useGameStore.getState().units.find(u => u.id === unit.id);
    if (freshUnit) {
      if (freshUnit.useManaAsHp) {
        await diceService.announceHealing(freshUnit.shortName ?? freshUnit.name, healAmount, freshUnit.mana.current, freshUnit.mana.max);
      } else {
        await diceService.announceHealing(freshUnit.shortName ?? freshUnit.name, healAmount, freshUnit.health.current, freshUnit.health.max);
      }
    }
    setHealAmount(0);
  };
  
  const getDamageTypeOptions = () => {
    if (damageCategory === 'pure') return [{ value: 'pure', label: 'Чистый' }];
    if (damageCategory === 'physical') return PHYSICAL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] ?? t }));
    return MAGICAL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] ?? t }));
  };
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      <SortableTab tabId="combat">
      {unit.hasRage && (
        <Section title="🔥 Ярость" icon="🔥" sortableId="combat.rage">
          <div className="space-y-2">
            <ProgressBar 
              type="rage" 
              value={unit.rage?.current ?? 0} 
              max={unit.rage?.max ?? unit.rageConfig?.max ?? 100} 
            />
            <div className="flex gap-2">
              <NumberStepper 
                label="Изменить Rage" 
                value={0} 
                onChange={async (v) => {
                  if (v > 0) await addRage(unit.id, v);
                  else if (v < 0) await useGameStore.getState().spendRage(unit.id, Math.abs(v));
                }} 
                min={-100} 
                max={100}
                step={10}
              />
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => useGameStore.getState().resetRage(unit.id)}
                className="mt-4"
              >
                Сброс
              </Button>
            </div>
          </div>
        </Section>
      )}
      
      <Section title="Ближний бой" icon="⚔️" collapsible defaultOpen={true} sortableId="combat.melee">
        {meleeWeapons.length === 0 ? <p className="text-faded text-sm">Добавьте оружие ближнего боя в настройках</p> : (
          <div className="space-y-3">
            <Select label="Оружие" value={selectedMeleeWeapon?.id ?? ''} onChange={e => setSelectedMeleeWeaponId(e.target.value)} options={meleeWeapons.map(w => ({ value: w.id, label: `${w.name}${(w.onHitActions?.length ?? 0) > 0 ? ' ⚡' : ''}` }))} />
            {selectedMeleeWeapon && (
              <div className="text-xs text-faded">
                {selectedMeleeWeapon.damageFormula} {DAMAGE_TYPE_NAMES[selectedMeleeWeapon.damageType] ?? selectedMeleeWeapon.damageType} | Владение +{proficiencies[selectedMeleeWeapon.proficiencyType] ?? 0}
                {(selectedMeleeWeapon.hitBonus ?? 0) > 0 && ` | Бонус +${selectedMeleeWeapon.hitBonus}`}
                {(selectedMeleeWeapon.onHitActions?.length ?? 0) > 0 && <span className="text-purple-400"> | ⚡{selectedMeleeWeapon.onHitActions!.length} эфф.</span>}
                {selectedMeleeWeapon.notes && <span className="block text-ancient">{selectedMeleeWeapon.notes}</span>}
              </div>
            )}
            <NumberStepper label="Количество целей" value={meleeTargetCount} onChange={setMeleeTargetCount} min={1} max={10} />
            <ModifierToggle value={meleeModifier} onChange={setMeleeModifier} />
            <Button variant="danger" onClick={handleMeleeAttack} loading={isMeleeAttacking} disabled={!selectedMeleeWeapon} className="w-full text-sm py-3">⚔️ АТАКОВАТЬ</Button>
            
            {meleeLog.length > 0 && (
              <div className="p-2 bg-obsidian rounded border border-edge-bone space-y-1 max-h-48 overflow-y-auto">
                {meleeLog.map((l, i) => <div key={i} className="text-sm font-garamond">{l}</div>)}
              </div>
            )}
            
            {meleeAttackResults.length > 0 && <div className="space-y-2"><div className="text-xs text-faded uppercase">Попадания:</div><DiceResultDisplay results={meleeAttackResults} /></div>}
            {meleeDamageResults.length > 0 && <div className="space-y-2"><div className="text-xs text-faded uppercase">Урон:</div><DiceResultDisplay results={meleeDamageResults} /></div>}
          </div>
        )}
      </Section>
      
      <Section title="Дальний бой" icon="🏹" collapsible defaultOpen={true} sortableId="combat.ranged">
        {rangedWeapons.length === 0 ? <p className="text-faded text-sm">Добавьте оружие дальнего боя в настройках</p> : ammoResources.length === 0 ? <p className="text-faded text-sm">Добавьте боеприпасы в ресурсах</p> : (
          <div className="space-y-3">
            <Select label="Оружие" value={selectedRangedWeapon?.id ?? ''} onChange={e => setSelectedRangedWeaponId(e.target.value)} options={rangedWeapons.map(w => ({ value: w.id, label: `${w.name}${(w.multishot ?? 1) > 1 ? ` (×${w.multishot})` : ''}${(w.onHitActions?.length ?? 0) > 0 ? ' ⚡' : ''}` }))} />
            <Select label="Боеприпасы" value={selectedAmmo?.id ?? ''} onChange={e => setSelectedAmmoId(e.target.value)} options={ammoResources.map(r => ({ value: r.id, label: `${r.icon ?? '🏹'} ${r.name} (${r.current ?? 0}/${r.max ?? 0}) — ${r.damageFormula ?? 'нет урона'}${(r.onHitActions?.length ?? 0) > 0 ? ' ⚡' : ''}` }))} />
            {selectedRangedWeapon && selectedAmmo && <div className="text-xs text-faded p-2 bg-obsidian rounded border border-edge-bone"><div>🏹 {selectedRangedWeapon.name}: +{(selectedRangedWeapon.hitBonus ?? 0) + (proficiencies.bows ?? 0)} к попаданию</div>{(selectedRangedWeapon.multishot ?? 1) > 1 && <div className="text-ancient">⚡ {selectedRangedWeapon.multishot} стрел</div>}<div className="mt-1">🎯 {selectedAmmo.name}: {selectedAmmo.damageFormula} {selectedAmmo.damageType && (DAMAGE_TYPE_NAMES[selectedAmmo.damageType] ?? selectedAmmo.damageType)}</div>{((selectedRangedWeapon.onHitActions?.length ?? 0) + (selectedAmmo.onHitActions?.length ?? 0)) > 0 && <div className="text-purple-400 mt-1">⚡ Эффекты: {(selectedRangedWeapon.onHitActions?.length ?? 0) + (selectedAmmo.onHitActions?.length ?? 0)} шагов</div>}</div>}
            <NumberStepper label="Количество выстрелов" value={rangedShotCount} onChange={setRangedShotCount} min={1} max={10} />
            <ModifierToggle value={rangedModifier} onChange={setRangedModifier} />
            <Button variant="danger" onClick={handleRangedAttack} loading={isRangedAttacking} disabled={!selectedRangedWeapon || !selectedAmmo || (selectedAmmo.current ?? 0) < (selectedRangedWeapon?.ammoPerShot ?? selectedRangedWeapon?.multishot ?? 1)} className="w-full text-sm py-3">🏹 ВЫСТРЕЛИТЬ</Button>
            {rangedLog.length > 0 && <div className="p-2 bg-obsidian rounded border border-edge-bone space-y-1 max-h-48 overflow-y-auto">{rangedLog.map((l, i) => <div key={i} className="text-sm font-garamond">{l}</div>)}</div>}
            {rangedDamageResults.length > 0 && <div className="space-y-2"><div className="text-xs text-faded uppercase">Урон:</div><DiceResultDisplay results={rangedDamageResults} /></div>}
          </div>
        )}
      </Section>
      
      {/* 💠 Заряженный урон — отдельный перетаскиваемый блок */}
      <Section title="Заряженный урон" icon="💠" collapsible defaultOpen={true} sortableId="combat.bonusDamage">
        <BonusDamageField />
      </Section>

      <Section title="Получение урона" icon="💀" collapsible defaultOpen={true} sortableId="combat.takeDamage">
        <div className="space-y-3">
          <NumberStepper label="Входящий урон" value={incomingDamage} onChange={setIncomingDamage} min={0} max={9999} />
          <Checkbox checked={isUndeadAttacker} onChange={setIsUndeadAttacker} label="☠️ Атакует нежить" />
          <Select label="Категория" value={damageCategory} onChange={e => { const c = e.target.value as DamageCategory; setDamageCategory(c); if (c === 'physical') setDamageType('slashing'); else if (c === 'magical') setDamageType('огонь'); else setDamageType('pure'); }} options={[{ value: 'physical', label: 'Физический' }, { value: 'magical', label: 'Магический' }, { value: 'pure', label: 'Чистый' }]} />
          {damageCategory !== 'pure' && <Select label="Тип урона" value={damageType} onChange={e => setDamageType(e.target.value as DamageType)} options={getDamageTypeOptions()} />}
          {damagePreview && <div className="p-3 bg-obsidian rounded-lg border border-edge-bone"><div className="text-xs text-faded uppercase mb-1.5">Расчёт:</div><div className="text-bone font-garamond text-[13px]">{damagePreview.breakdown}</div><div className="text-blood-bright font-bold mt-1.5 text-[14px]">Итого: {damagePreview.finalDamage} урона</div></div>}
          <Button variant="danger" onClick={handleTakeDamage} disabled={!damagePreview || damagePreview.finalDamage === 0} className="w-full">💀 Получить урон</Button>
        </div>
      </Section>
      
      <Section title="Исцеление" icon="💚" collapsible defaultOpen={true} sortableId="combat.heal">
        <div className="space-y-3">
          <NumberStepper label="Количество HP" value={healAmount} onChange={setHealAmount} min={0} max={9999} />
          <Button variant="success" onClick={handleHeal} disabled={healAmount <= 0} className="w-full text-sm py-3">💚 Исцелить</Button>
        </div>
      </Section>
      </SortableTab>
    </div>
  );
}
