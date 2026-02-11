import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, NumberStepper, Checkbox, DiceResultDisplay, EmptyState } from '../ui';
import { isHit } from '../../utils/dice';
import { calculateDamage, getStatDamageBonus } from '../../utils/damage';
import { diceService } from '../../services/diceService';
import type { DiceRollResult, DamageType, DamageCategory } from '../../types';
import { DAMAGE_TYPE_NAMES } from '../../types';

export function CombatTab() {
  const { units, selectedUnitId, takeDamage, heal: healUnit, setResource } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  // Состояние ближней атаки
  const [selectedMeleeWeaponId, setSelectedMeleeWeaponId] = useState<string>('');
  const [meleeTargetCount, setMeleeTargetCount] = useState(1);
  const [meleeAttackResults, setMeleeAttackResults] = useState<DiceRollResult[]>([]);
  const [meleeDamageResults, setMeleeDamageResults] = useState<DiceRollResult[]>([]);
  const [isMeleeAttacking, setIsMeleeAttacking] = useState(false);
  
  // Состояние дальней атаки
  const [selectedRangedWeaponId, setSelectedRangedWeaponId] = useState<string>('');
  const [selectedAmmoId, setSelectedAmmoId] = useState<string>('');
  const [rangedShotCount, setRangedShotCount] = useState(1);
  const [rangedDamageResults, setRangedDamageResults] = useState<DiceRollResult[]>([]);
  const [isRangedAttacking, setIsRangedAttacking] = useState(false);
  const [rangedLog, setRangedLog] = useState<string[]>([]);
  
  // Состояние получения урона
  const [incomingDamage, setIncomingDamage] = useState(0);
  const [isUndeadAttacker, setIsUndeadAttacker] = useState(false);
  const [damageCategory, setDamageCategory] = useState<DamageCategory>('physical');
  const [damageType, setDamageType] = useState<DamageType>('slashing');
  
  // Состояние исцеления
  const [healAmount, setHealAmount] = useState(0);
  
  // Защита от отсутствия юнита
  if (!unit) {
    return (
      <EmptyState
        icon="⚔️"
        title="Нет персонажа"
        description="Выберите персонажа для боя"
      />
    );
  }
  
  // Безопасное получение данных
  const weapons = unit.weapons ?? [];
  const resources = unit.resources ?? [];
  const proficiencies = unit.proficiencies ?? {};
  const stats = unit.stats ?? {};
  
  // Разделяем оружие на ближнее и дальнее
  const meleeWeapons = weapons.filter(w => w.type === 'melee');
  const rangedWeapons = weapons.filter(w => w.type === 'ranged');
  
  // Боеприпасы (ресурсы с типом ammo)
  const ammoResources = resources.filter(r => r.resourceType === 'ammo');
  
  const selectedMeleeWeapon = meleeWeapons.find(w => w.id === selectedMeleeWeaponId) ?? meleeWeapons[0];
  const selectedRangedWeapon = rangedWeapons.find(w => w.id === selectedRangedWeaponId) ?? rangedWeapons[0];
  const selectedAmmo = ammoResources.find(r => r.id === selectedAmmoId) ?? ammoResources[0];
  
  // Обработчик ближней атаки — ВСЕ БРОСКИ ЧЕРЕЗ diceService
  const handleMeleeAttack = async () => {
    if (!selectedMeleeWeapon) return;
    
    setIsMeleeAttacking(true);
    setMeleeAttackResults([]);
    setMeleeDamageResults([]);
    
    const newAttackResults: DiceRollResult[] = [];
    const newDamageResults: DiceRollResult[] = [];
    
    try {
      for (let target = 0; target < meleeTargetCount; target++) {
        // Бросок на попадание через diceService (3D кубики!)
        const profKey = selectedMeleeWeapon.proficiencyType;
        const profBonus = proficiencies[profKey] ?? 0;
        const hitBonus = profBonus + (selectedMeleeWeapon.hitBonus ?? 0);
        const hitFormula = hitBonus >= 0 ? `d20+${hitBonus}` : `d20${hitBonus}`;
        
        // ✅ Используем diceService.roll() для 3D кубиков
        const hitResult = await diceService.roll(
          hitFormula, 
          `Попадание ${selectedMeleeWeapon.name}`, 
          unit.shortName ?? unit.name
        );
        newAttackResults.push(hitResult);
        
        // Проверка попадания
        if (hitResult.isCritFail) {
          // Крит промах — пропускаем урон
          continue;
        }
        
        const hit = isHit(hitResult);
        
        if (!hit) {
          // Промах
          continue;
        }
        
        // Бросок урона через diceService
        const isCrit = hitResult.isCrit;
        const statBonus = getStatDamageBonus(unit, selectedMeleeWeapon.statBonus);
        
        // Формула урона с бонусом от стата
        const baseDamageFormula = selectedMeleeWeapon.damageFormula ?? 'd6';
        const damageFormula = statBonus > 0 
          ? `${baseDamageFormula}+${statBonus}`
          : baseDamageFormula;
        
        // ✅ Используем diceService.rollWithCrit() для 3D кубиков с удвоением при крите
        const damageResult = await diceService.rollWithCrit(
          damageFormula, 
          isCrit, 
          `Урон ${selectedMeleeWeapon.name}`, 
          unit.shortName ?? unit.name
        );
        newDamageResults.push(damageResult);
        
        // Дополнительный урон (если есть)
        if (selectedMeleeWeapon.extraDamageFormula && selectedMeleeWeapon.extraDamageType) {
          // ✅ Дополнительный урон тоже через diceService
          const extraResult = await diceService.rollWithCrit(
            selectedMeleeWeapon.extraDamageFormula,
            isCrit,
            `Доп. урон (${DAMAGE_TYPE_NAMES[selectedMeleeWeapon.extraDamageType] ?? 'доп'})`,
            unit.shortName ?? unit.name
          );
          newDamageResults.push(extraResult);
        }
      }
    } finally {
      setMeleeAttackResults(newAttackResults);
      setMeleeDamageResults(newDamageResults);
      setIsMeleeAttacking(false);
    }
  };
  
  // Обработчик дальней атаки — ВСЕ БРОСКИ ЧЕРЕЗ diceService
  const handleRangedAttack = async () => {
    if (!selectedRangedWeapon || !selectedAmmo) return;
    
    // Количество стрел, которые ЛЕТЯТ
    const arrowsFlying = selectedRangedWeapon.multishot ?? 1;
    // Количество боеприпасов, которые ТРАТЯТСЯ
    const ammoConsumed = selectedRangedWeapon.ammoPerShot ?? arrowsFlying;
    // Общее количество боеприпасов, нужное для всех выстрелов
    const totalAmmoNeeded = rangedShotCount * ammoConsumed;
    
    // Проверяем количество боеприпасов
    const ammoCurrent = selectedAmmo.current ?? 0;
    if (ammoCurrent < totalAmmoNeeded) {
      await diceService.showNotification(`❌ Недостаточно ${selectedAmmo.name}! Нужно ${totalAmmoNeeded}, есть ${ammoCurrent}`);
      return;
    }
    
    setIsRangedAttacking(true);
    setRangedDamageResults([]);
    setRangedLog([]);
    
    const newDamageResults: DiceRollResult[] = [];
    const log: string[] = [];
    
    try {
      for (let shot = 0; shot < rangedShotCount; shot++) {
        if (rangedShotCount > 1) {
          log.push(`--- Выстрел ${shot + 1} ---`);
        }
        
        // Для каждой стрелы, которая ЛЕТИТ
        for (let arrow = 0; arrow < arrowsFlying; arrow++) {
          // Бросок на попадание через diceService (3D кубики!)
          const bowsProf = proficiencies.bows ?? 0;
          const hitBonus = bowsProf + (selectedRangedWeapon.hitBonus ?? 0);
          const hitFormula = hitBonus >= 0 ? `d20+${hitBonus}` : `d20${hitBonus}`;
          
          // ✅ Используем diceService.roll() для 3D кубиков
          const hitResult = await diceService.roll(
            hitFormula, 
            `Стрела ${arrow + 1}`, 
            unit.shortName ?? unit.name
          );
          
          const hit = isHit(hitResult);
          const isCrit = hitResult.isCrit;
          const isCritFail = hitResult.isCritFail;
          
          if (isCritFail) {
            log.push(`💀 Стрела ${arrow + 1}: [${hitResult.rawD20}] = КРИТ ПРОМАХ!`);
            continue;
          }
          
          if (!hit) {
            log.push(`❌ Стрела ${arrow + 1}: [${hitResult.rawD20}] + ${hitBonus} = ${hitResult.total} — Промах`);
            continue;
          }
          
          // Попадание — бросаем урон от боеприпаса
          if (selectedAmmo.damageFormula && selectedAmmo.damageType) {
            const dexBonus = getStatDamageBonus(unit, 'dexterity');
            
            const ammoFormula = selectedAmmo.damageFormula;
            const dmgFormula = dexBonus > 0
              ? `${ammoFormula}+${dexBonus}`
              : ammoFormula;
            
            // ✅ Используем diceService.rollWithCrit() для 3D кубиков
            const damageResult = await diceService.rollWithCrit(
              dmgFormula, 
              isCrit, 
              `Урон ${selectedAmmo.name}`, 
              unit.shortName ?? unit.name
            );
            newDamageResults.push(damageResult);
            
            const critText = isCrit ? '✨ КРИТ! ' : '';
            log.push(`🎯 Стрела ${arrow + 1}: [${hitResult.rawD20}] + ${hitBonus} = ${hitResult.total} ${critText}→ 💥 ${damageResult.total} ${DAMAGE_TYPE_NAMES[selectedAmmo.damageType] ?? 'физ'}`);
            
            // Дополнительный урон от боеприпаса (рунами и т.д.)
            if (selectedAmmo.extraDamageFormula && selectedAmmo.extraDamageType) {
              // ✅ Дополнительный урон тоже через diceService
              const extraResult = await diceService.rollWithCrit(
                selectedAmmo.extraDamageFormula,
                isCrit,
                `Доп. урон (${DAMAGE_TYPE_NAMES[selectedAmmo.extraDamageType] ?? 'доп'})`,
                unit.shortName ?? unit.name
              );
              newDamageResults.push(extraResult);
              
              log.push(`    + ${extraResult.total} ${DAMAGE_TYPE_NAMES[selectedAmmo.extraDamageType] ?? 'доп'}`);
            }
          } else {
            log.push(`🎯 Стрела ${arrow + 1}: [${hitResult.rawD20}] + ${hitBonus} = ${hitResult.total} — Попадание!`);
          }
        }
      }
      
      // Списываем боеприпасы (ammoPerShot × кол-во выстрелов)
      const totalSpent = rangedShotCount * ammoConsumed;
      await setResource(unit.id, selectedAmmo.id, ammoCurrent - totalSpent);
      log.push(`📦 Списано ${totalSpent} ${selectedAmmo.name} (${ammoConsumed} за выстрел × ${rangedShotCount})`);
      
    } finally {
      setRangedDamageResults(newDamageResults);
      setRangedLog(log);
      setIsRangedAttacking(false);
    }
  };
  
  // Расчёт входящего урона
  const damagePreview = unit && incomingDamage > 0
    ? calculateDamage(incomingDamage, damageType, unit, isUndeadAttacker)
    : null;
  
  // Обработчик получения урона
  const handleTakeDamage = async () => {
    if (!damagePreview || damagePreview.finalDamage === 0) return;
    
    const currentHP = unit.health?.current ?? 0;
    const maxHP = unit.health?.max ?? 1;
    
    await takeDamage(unit.id, damagePreview.finalDamage);
    
    // Анонс урона с учётом режима "Мана = Жизнь"
    if (unit.useManaAsHp) {
      const curMana = unit.mana?.current ?? 0;
      const mxMana = unit.mana?.max ?? 1;
      await diceService.announceTakeDamage(
        unit.shortName ?? unit.name,
        damagePreview.finalDamage,
        curMana - damagePreview.finalDamage,
        mxMana
      );
    } else {
      await diceService.announceTakeDamage(
        unit.shortName ?? unit.name,
        damagePreview.finalDamage,
        currentHP - damagePreview.finalDamage,
        maxHP
      );
    }
    
    setIncomingDamage(0);
  };
  
  // Обработчик исцеления
  const handleHeal = async () => {
    if (healAmount <= 0) return;
    
    const currentHP = unit.health?.current ?? 0;
    const maxHP = unit.health?.max ?? 1;
    
    await healUnit(unit.id, healAmount);
    
    // Анонс исцеления с учётом режима "Мана = Жизнь"
    if (unit.useManaAsHp) {
      const curMana = unit.mana?.current ?? 0;
      const mxMana = unit.mana?.max ?? 1;
      await diceService.announceHealing(
        unit.shortName ?? unit.name,
        healAmount,
        Math.min(mxMana, curMana + healAmount),
        mxMana
      );
    } else {
      await diceService.announceHealing(
        unit.shortName ?? unit.name,
        healAmount,
        Math.min(maxHP, currentHP + healAmount),
        maxHP
      );
    }
    
    setHealAmount(0);
  };
  
  // Опции типов урона
  const physicalTypes: DamageType[] = ['slashing', 'piercing', 'bludgeoning', 'chopping'];
  const magicalTypes: DamageType[] = ['fire', 'water', 'earth', 'air', 'light', 'darkness', 
    'electricity', 'frost', 'nature', 'corruption', 'life', 'death', 'blood', 'void', 'astral'];
  
  const getDamageTypeOptions = () => {
    if (damageCategory === 'pure') {
      return [{ value: 'pure', label: 'Чистый' }];
    }
    if (damageCategory === 'physical') {
      return physicalTypes.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] ?? t }));
    }
    return magicalTypes.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] ?? t }));
  };
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      {/* СЕКЦИЯ: АТАКА БЛИЖНИМ ОРУЖИЕМ */}
      <Section title="Ближний бой" icon="⚔️">
        {meleeWeapons.length === 0 ? (
          <p className="text-faded text-sm">Добавьте оружие ближнего боя в настройках</p>
        ) : (
          <div className="space-y-3">
            <Select
              label="Оружие"
              value={selectedMeleeWeapon?.id ?? ''}
              onChange={(e) => setSelectedMeleeWeaponId(e.target.value)}
              options={meleeWeapons.map(w => ({ value: w.id, label: w.name }))}
            />
            
            {selectedMeleeWeapon && (
              <div className="text-xs text-faded">
                {selectedMeleeWeapon.damageFormula} {DAMAGE_TYPE_NAMES[selectedMeleeWeapon.damageType] ?? selectedMeleeWeapon.damageType} | 
                Владение +{proficiencies[selectedMeleeWeapon.proficiencyType] ?? 0}
                {(selectedMeleeWeapon.hitBonus ?? 0) > 0 && ` | Бонус +${selectedMeleeWeapon.hitBonus}`}
                {selectedMeleeWeapon.notes && <span className="block text-ancient">{selectedMeleeWeapon.notes}</span>}
              </div>
            )}
            
            <NumberStepper
              label="Количество целей"
              value={meleeTargetCount}
              onChange={setMeleeTargetCount}
              min={1}
              max={10}
            />
            
            <Button
              variant="danger"
              onClick={handleMeleeAttack}
              loading={isMeleeAttacking}
              disabled={!selectedMeleeWeapon}
              className="w-full"
            >
              ⚔️ АТАКОВАТЬ
            </Button>
            
            {meleeAttackResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-faded uppercase">Попадания:</div>
                <DiceResultDisplay results={meleeAttackResults} />
              </div>
            )}
            
            {meleeDamageResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-faded uppercase">Урон:</div>
                <DiceResultDisplay results={meleeDamageResults} />
              </div>
            )}
          </div>
        )}
      </Section>
      
      {/* СЕКЦИЯ: АТАКА ДАЛЬНИМ ОРУЖИЕМ */}
      <Section title="Дальний бой" icon="🏹">
        {rangedWeapons.length === 0 ? (
          <p className="text-faded text-sm">Добавьте оружие дальнего боя в настройках</p>
        ) : ammoResources.length === 0 ? (
          <p className="text-faded text-sm">Добавьте боеприпасы (тип "ammo") в ресурсах</p>
        ) : (
          <div className="space-y-3">
            <Select
              label="Оружие"
              value={selectedRangedWeapon?.id ?? ''}
              onChange={(e) => setSelectedRangedWeaponId(e.target.value)}
              options={rangedWeapons.map(w => ({ 
                value: w.id, 
                label: `${w.name}${(w.multishot ?? 1) > 1 ? ` (×${w.multishot})` : ''}` 
              }))}
            />
            
            <Select
              label="Боеприпасы"
              value={selectedAmmo?.id ?? ''}
              onChange={(e) => setSelectedAmmoId(e.target.value)}
              options={ammoResources.map(r => ({ 
                value: r.id, 
                label: `${r.icon ?? '🏹'} ${r.name} (${r.current ?? 0}/${r.max ?? 0}) — ${r.damageFormula ?? 'нет урона'}` 
              }))}
            />
            
            {selectedRangedWeapon && selectedAmmo && (
              <div className="text-xs text-faded p-2 bg-obsidian rounded border border-edge-bone">
                <div>🏹 {selectedRangedWeapon.name}: +{(selectedRangedWeapon.hitBonus ?? 0) + (proficiencies.bows ?? 0)} к попаданию</div>
                {(selectedRangedWeapon.multishot ?? 1) > 1 && (
                  <div className="text-ancient">⚡ {selectedRangedWeapon.multishot} стрел за выстрел</div>
                )}
                {selectedRangedWeapon.ammoPerShot !== undefined && 
                 selectedRangedWeapon.ammoPerShot !== (selectedRangedWeapon.multishot ?? 1) && (
                  <div className="text-mana-bright">✨ Тратится: {selectedRangedWeapon.ammoPerShot} за выстрел</div>
                )}
                <div className="mt-1">
                  🎯 {selectedAmmo.name}: {selectedAmmo.damageFormula} {selectedAmmo.damageType && (DAMAGE_TYPE_NAMES[selectedAmmo.damageType] ?? selectedAmmo.damageType)}
                </div>
                {selectedAmmo.extraDamageFormula && (
                  <div className="text-mana-bright">+ {selectedAmmo.extraDamageFormula} {selectedAmmo.extraDamageType && (DAMAGE_TYPE_NAMES[selectedAmmo.extraDamageType] ?? selectedAmmo.extraDamageType)}</div>
                )}
              </div>
            )}
            
            <NumberStepper
              label="Количество выстрелов"
              value={rangedShotCount}
              onChange={setRangedShotCount}
              min={1}
              max={10}
            />
            
            {selectedRangedWeapon && selectedAmmo && (
              <div className="text-xs text-faded">
                Летит: {rangedShotCount * (selectedRangedWeapon.multishot ?? 1)} стрел | 
                Тратится: {rangedShotCount * (selectedRangedWeapon.ammoPerShot ?? selectedRangedWeapon.multishot ?? 1)} боеприпасов
              </div>
            )}
            
            <Button
              variant="danger"
              onClick={handleRangedAttack}
              loading={isRangedAttacking}
              disabled={!selectedRangedWeapon || !selectedAmmo || (selectedAmmo.current ?? 0) < (selectedRangedWeapon?.ammoPerShot ?? selectedRangedWeapon?.multishot ?? 1)}
              className="w-full"
            >
              🏹 ВЫСТРЕЛИТЬ
            </Button>
            
            {rangedLog.length > 0 && (
              <div className="p-2 bg-obsidian rounded border border-edge-bone space-y-1">
                {rangedLog.map((line, idx) => (
                  <div key={idx} className="text-sm font-garamond">{line}</div>
                ))}
              </div>
            )}
            
            {rangedDamageResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-faded uppercase">Урон:</div>
                <DiceResultDisplay results={rangedDamageResults} />
              </div>
            )}
          </div>
        )}
      </Section>
      
      {/* СЕКЦИЯ: ПОЛУЧЕНИЕ УРОНА */}
      <Section title="Получение урона" icon="💀">
        <div className="space-y-3">
          <NumberStepper
            label="Входящий урон"
            value={incomingDamage}
            onChange={setIncomingDamage}
            min={0}
            max={9999}
          />
          
          <Checkbox
            checked={isUndeadAttacker}
            onChange={setIsUndeadAttacker}
            label="☠️ Атакует нежить"
          />
          
          <Select
            label="Категория"
            value={damageCategory}
            onChange={(e) => {
              const cat = e.target.value as DamageCategory;
              setDamageCategory(cat);
              if (cat === 'physical') setDamageType('slashing');
              else if (cat === 'magical') setDamageType('fire');
              else setDamageType('pure');
            }}
            options={[
              { value: 'physical', label: 'Физический' },
              { value: 'magical', label: 'Магический' },
              { value: 'pure', label: 'Чистый' }
            ]}
          />
          
          {damageCategory !== 'pure' && (
            <Select
              label="Тип урона"
              value={damageType}
              onChange={(e) => setDamageType(e.target.value as DamageType)}
              options={getDamageTypeOptions()}
            />
          )}
          
          {damagePreview && (
            <div className="p-2 bg-obsidian rounded border border-edge-bone">
              <div className="text-xs text-faded uppercase mb-1">Расчёт:</div>
              <div className="text-bone font-garamond">{damagePreview.breakdown}</div>
              <div className="text-blood-bright font-bold mt-1">
                Итого: {damagePreview.finalDamage} урона
              </div>
            </div>
          )}
          
          <Button
            variant="danger"
            onClick={handleTakeDamage}
            disabled={!damagePreview || damagePreview.finalDamage === 0}
            className="w-full"
          >
            💀 Получить урон
          </Button>
        </div>
      </Section>
      
      {/* СЕКЦИЯ: ИСЦЕЛЕНИЕ */}
      <Section title="Исцеление" icon="💚">
        <div className="space-y-3">
          <NumberStepper
            label="Количество HP"
            value={healAmount}
            onChange={setHealAmount}
            min={0}
            max={9999}
          />
          
          <Button
            variant="success"
            onClick={handleHeal}
            disabled={healAmount <= 0}
            className="w-full"
          >
            💚 Исцелить
          </Button>
        </div>
      </Section>
    </div>
  );
}
