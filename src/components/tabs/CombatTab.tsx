// src/components/tabs/CombatTab.tsx

import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, NumberStepper, Checkbox, DiceResultDisplay, EmptyState } from '../ui';
import { isHit } from '../../utils/dice';
import { calculateDamage, getStatDamageBonus } from '../../utils/damage';
import { diceService } from '../../services/diceService';
import type { DiceRollResult, DamageType, DamageCategory } from '../../types';
import { DAMAGE_TYPE_NAMES, PHYSICAL_DAMAGE_TYPES, MAGICAL_DAMAGE_TYPES } from '../../types';

export function CombatTab() {
  const {
    units, selectedUnitId, takeDamage, heal: healUnit,
    setResource, triggerEffect, addCombatLog
  } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [selectedMeleeWeaponId, setSelectedMeleeWeaponId] = useState<string>('');
  const [meleeTargetCount, setMeleeTargetCount] = useState(1);
  const [meleeAttackResults, setMeleeAttackResults] = useState<DiceRollResult[]>([]);
  const [meleeDamageResults, setMeleeDamageResults] = useState<DiceRollResult[]>([]);
  const [isMeleeAttacking, setIsMeleeAttacking] = useState(false);
  
  const [selectedRangedWeaponId, setSelectedRangedWeaponId] = useState<string>('');
  const [selectedAmmoId, setSelectedAmmoId] = useState<string>('');
  const [rangedShotCount, setRangedShotCount] = useState(1);
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
  
  const handleMeleeAttack = async () => {
    if (!selectedMeleeWeapon) return;
    setIsMeleeAttacking(true);
    setMeleeAttackResults([]); setMeleeDamageResults([]);
    const atkRes: DiceRollResult[] = []; const dmgRes: DiceRollResult[] = [];
    try {
      for (let t = 0; t < meleeTargetCount; t++) {
        const profBonus = proficiencies[selectedMeleeWeapon.proficiencyType] ?? 0;
        const hitBonus = profBonus + (selectedMeleeWeapon.hitBonus ?? 0);
        const hitFormula = hitBonus >= 0 ? `d20+${hitBonus}` : `d20${hitBonus}`;
        const hitResult = await diceService.roll(hitFormula, `Попадание ${selectedMeleeWeapon.name}`, unit.shortName ?? unit.name, 'normal');
        atkRes.push(hitResult);
        if (hitResult.isCritFail) continue;
        if (!isHit(hitResult)) continue;
        const isCrit = hitResult.isCrit;
        const statBonus = getStatDamageBonus(unit, selectedMeleeWeapon.statBonus);
        const base = selectedMeleeWeapon.damageFormula ?? 'd6';
        const formula = statBonus > 0 ? `${base}+${statBonus}` : base;
        const dmg = await diceService.rollDamage(formula, `Урон ${selectedMeleeWeapon.name}`, unit.shortName ?? unit.name, isCrit);
        dmgRes.push(dmg);
        addCombatLog(unit.shortName ?? unit.name, selectedMeleeWeapon.name, `${isCrit ? '✨КРИТ ' : ''}${dmg.total} ${DAMAGE_TYPE_NAMES[selectedMeleeWeapon.damageType] ?? ''}`);
        if (selectedMeleeWeapon.extraDamageFormula && selectedMeleeWeapon.extraDamageType) {
          const extra = await diceService.rollDamage(selectedMeleeWeapon.extraDamageFormula, `Доп. урон (${DAMAGE_TYPE_NAMES[selectedMeleeWeapon.extraDamageType] ?? 'доп'})`, unit.shortName ?? unit.name, isCrit);
          dmgRes.push(extra);
        }
      }
    } finally { setMeleeAttackResults(atkRes); setMeleeDamageResults(dmgRes); setIsMeleeAttacking(false); }
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
    try {
      for (let s = 0; s < rangedShotCount; s++) {
        if (rangedShotCount > 1) log.push(`--- Выстрел ${s+1} ---`);
        for (let a = 0; a < arrowsFlying; a++) {
          const hitBonus = (proficiencies.bows ?? 0) + (selectedRangedWeapon.hitBonus ?? 0);
          const hitFormula = hitBonus >= 0 ? `d20+${hitBonus}` : `d20${hitBonus}`;
          const hit = await diceService.roll(hitFormula, `Стрела ${a+1}`, unit.shortName ?? unit.name, 'normal');
          if (hit.isCritFail) { log.push(`💀 Стрела ${a+1}: [${hit.rawD20}] = КРИТ ПРОМАХ!`); continue; }
          if (!isHit(hit)) { log.push(`❌ Стрела ${a+1}: [${hit.rawD20}]+${hitBonus}=${hit.total} — Промах`); continue; }
          if (selectedAmmo.damageFormula && selectedAmmo.damageType) {
            const dexB = getStatDamageBonus(unit, 'dexterity');
            const f = dexB > 0 ? `${selectedAmmo.damageFormula}+${dexB}` : selectedAmmo.damageFormula;
            const dmg = await diceService.rollDamage(f, `Урон ${selectedAmmo.name}`, unit.shortName ?? unit.name, hit.isCrit);
            dmgRes.push(dmg);
            log.push(`🎯 Стрела ${a+1}: [${hit.rawD20}]+${hitBonus}=${hit.total} ${hit.isCrit?'✨КРИТ ':''}→ 💥${dmg.total} ${DAMAGE_TYPE_NAMES[selectedAmmo.damageType]??''}`);
            addCombatLog(unit.shortName??unit.name, `${selectedRangedWeapon.name} (${selectedAmmo.name})`, `${hit.isCrit?'✨КРИТ ':''}${dmg.total} ${DAMAGE_TYPE_NAMES[selectedAmmo.damageType]??''}`);
            if (selectedAmmo.extraDamageFormula && selectedAmmo.extraDamageType) {
              const extra = await diceService.rollDamage(selectedAmmo.extraDamageFormula, `Доп. урон`, unit.shortName??unit.name, hit.isCrit);
              dmgRes.push(extra); log.push(`    + ${extra.total} ${DAMAGE_TYPE_NAMES[selectedAmmo.extraDamageType]??''}`);
            }
          } else { log.push(`🎯 Стрела ${a+1}: [${hit.rawD20}]+${hitBonus}=${hit.total} — Попадание!`); }
        }
      }
      await setResource(unit.id, selectedAmmo.id, ammoCur - totalNeeded);
      log.push(`📦 Списано ${totalNeeded} ${selectedAmmo.name}`);
    } finally { setRangedDamageResults(dmgRes); setRangedLog(log); setIsRangedAttacking(false); }
  };
  
  const damagePreview = unit && incomingDamage > 0 ? calculateDamage(incomingDamage, damageType, unit, isUndeadAttacker) : null;
  
  const handleTakeDamage = async () => {
    if (!damagePreview || damagePreview.finalDamage === 0) return;
    await takeDamage(unit.id, damagePreview.finalDamage);
    triggerEffect('shake');
    addCombatLog(unit.shortName??unit.name, 'Получил урон', `${damagePreview.finalDamage} ${DAMAGE_TYPE_NAMES[damageType]??damageType}`);
    if (unit.useManaAsHp) {
      await diceService.announceTakeDamage(unit.shortName??unit.name, damagePreview.finalDamage, unit.mana.current - damagePreview.finalDamage, unit.mana.max);
    } else {
      await diceService.announceTakeDamage(unit.shortName??unit.name, damagePreview.finalDamage, unit.health.current - damagePreview.finalDamage, unit.health.max);
    }
    setIncomingDamage(0);
  };
  
  const handleHeal = async () => {
    if (healAmount <= 0) return;
    await healUnit(unit.id, healAmount);
    triggerEffect('heal');
    addCombatLog(unit.shortName??unit.name, 'Исцеление', `+${healAmount} HP`);
    if (unit.useManaAsHp) {
      await diceService.announceHealing(unit.shortName??unit.name, healAmount, Math.min(unit.mana.max, unit.mana.current+healAmount), unit.mana.max);
    } else {
      await diceService.announceHealing(unit.shortName??unit.name, healAmount, Math.min(unit.health.max, unit.health.current+healAmount), unit.health.max);
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
      <Section title="Ближний бой" icon="⚔️" collapsible defaultOpen={true}>
        {meleeWeapons.length === 0 ? <p className="text-faded text-sm">Добавьте оружие ближнего боя в настройках</p> : (
          <div className="space-y-3">
            <Select label="Оружие" value={selectedMeleeWeapon?.id??''} onChange={e=>setSelectedMeleeWeaponId(e.target.value)} options={meleeWeapons.map(w=>({value:w.id,label:w.name}))} />
            {selectedMeleeWeapon && <div className="text-xs text-faded">{selectedMeleeWeapon.damageFormula} {DAMAGE_TYPE_NAMES[selectedMeleeWeapon.damageType]??selectedMeleeWeapon.damageType} | Владение +{proficiencies[selectedMeleeWeapon.proficiencyType]??0}{(selectedMeleeWeapon.hitBonus??0)>0&&` | Бонус +${selectedMeleeWeapon.hitBonus}`}{selectedMeleeWeapon.notes&&<span className="block text-ancient">{selectedMeleeWeapon.notes}</span>}</div>}
            <NumberStepper label="Количество целей" value={meleeTargetCount} onChange={setMeleeTargetCount} min={1} max={10} />
            <Button variant="danger" onClick={handleMeleeAttack} loading={isMeleeAttacking} disabled={!selectedMeleeWeapon} className="w-full">⚔️ АТАКОВАТЬ</Button>
            {meleeAttackResults.length>0&&<div className="space-y-2"><div className="text-xs text-faded uppercase">Попадания:</div><DiceResultDisplay results={meleeAttackResults}/></div>}
            {meleeDamageResults.length>0&&<div className="space-y-2"><div className="text-xs text-faded uppercase">Урон:</div><DiceResultDisplay results={meleeDamageResults}/></div>}
          </div>
        )}
      </Section>
      
      <Section title="Дальний бой" icon="🏹" collapsible defaultOpen={true}>
        {rangedWeapons.length===0?<p className="text-faded text-sm">Добавьте оружие дальнего боя в настройках</p>:ammoResources.length===0?<p className="text-faded text-sm">Добавьте боеприпасы в ресурсах</p>:(
          <div className="space-y-3">
            <Select label="Оружие" value={selectedRangedWeapon?.id??''} onChange={e=>setSelectedRangedWeaponId(e.target.value)} options={rangedWeapons.map(w=>({value:w.id,label:`${w.name}${(w.multishot??1)>1?` (×${w.multishot})`:''}`}))} />
            <Select label="Боеприпасы" value={selectedAmmo?.id??''} onChange={e=>setSelectedAmmoId(e.target.value)} options={ammoResources.map(r=>({value:r.id,label:`${r.icon??'🏹'} ${r.name} (${r.current??0}/${r.max??0}) — ${r.damageFormula??'нет урона'}`}))} />
            {selectedRangedWeapon&&selectedAmmo&&<div className="text-xs text-faded p-2 bg-obsidian rounded border border-edge-bone"><div>🏹 {selectedRangedWeapon.name}: +{(selectedRangedWeapon.hitBonus??0)+(proficiencies.bows??0)} к попаданию</div>{(selectedRangedWeapon.multishot??1)>1&&<div className="text-ancient">⚡ {selectedRangedWeapon.multishot} стрел</div>}<div className="mt-1">🎯 {selectedAmmo.name}: {selectedAmmo.damageFormula} {selectedAmmo.damageType&&(DAMAGE_TYPE_NAMES[selectedAmmo.damageType]??selectedAmmo.damageType)}</div></div>}
            <NumberStepper label="Количество выстрелов" value={rangedShotCount} onChange={setRangedShotCount} min={1} max={10} />
            <Button variant="danger" onClick={handleRangedAttack} loading={isRangedAttacking} disabled={!selectedRangedWeapon||!selectedAmmo||(selectedAmmo.current??0)<(selectedRangedWeapon?.ammoPerShot??selectedRangedWeapon?.multishot??1)} className="w-full">🏹 ВЫСТРЕЛИТЬ</Button>
            {rangedLog.length>0&&<div className="p-2 bg-obsidian rounded border border-edge-bone space-y-1 max-h-48 overflow-y-auto">{rangedLog.map((l,i)=><div key={i} className="text-sm font-garamond">{l}</div>)}</div>}
            {rangedDamageResults.length>0&&<div className="space-y-2"><div className="text-xs text-faded uppercase">Урон:</div><DiceResultDisplay results={rangedDamageResults}/></div>}
          </div>
        )}
      </Section>
      
      <Section title="Получение урона" icon="💀" collapsible defaultOpen={true}>
        <div className="space-y-3">
          <NumberStepper label="Входящий урон" value={incomingDamage} onChange={setIncomingDamage} min={0} max={9999} />
          <Checkbox checked={isUndeadAttacker} onChange={setIsUndeadAttacker} label="☠️ Атакует нежить" />
          <Select label="Категория" value={damageCategory} onChange={e=>{const c=e.target.value as DamageCategory;setDamageCategory(c);if(c==='physical')setDamageType('slashing');else if(c==='magical')setDamageType('огонь');else setDamageType('pure');}} options={[{value:'physical',label:'Физический'},{value:'magical',label:'Магический'},{value:'pure',label:'Чистый'}]} />
          {damageCategory!=='pure'&&<Select label="Тип урона" value={damageType} onChange={e=>setDamageType(e.target.value as DamageType)} options={getDamageTypeOptions()} />}
          {damagePreview&&<div className="p-2 bg-obsidian rounded border border-edge-bone"><div className="text-xs text-faded uppercase mb-1">Расчёт:</div><div className="text-bone font-garamond">{damagePreview.breakdown}</div><div className="text-blood-bright font-bold mt-1">Итого: {damagePreview.finalDamage} урона</div></div>}
          <Button variant="danger" onClick={handleTakeDamage} disabled={!damagePreview||damagePreview.finalDamage===0} className="w-full">💀 Получить урон</Button>
        </div>
      </Section>
      
      <Section title="Исцеление" icon="💚" collapsible defaultOpen={true}>
        <div className="space-y-3">
          <NumberStepper label="Количество HP" value={healAmount} onChange={setHealAmount} min={0} max={9999} />
          <Button variant="success" onClick={handleHeal} disabled={healAmount<=0} className="w-full">💚 Исцелить</Button>
        </div>
      </Section>
    </div>
  );
}
