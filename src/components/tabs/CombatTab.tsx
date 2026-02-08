import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, NumberStepper, Checkbox, DiceResultDisplay, EmptyState } from '../ui';
import { rollDice, rollWithCrit, isHit } from '../../utils/dice';
import { calculateDamage, getStatDamageBonus } from '../../utils/damage';
import { announceHit, announceDamage, announceMiss, announceTakeDamage, announceHealing } from '../../services/obrService';
import type { DiceRollResult, DamageType, DamageCategory } from '../../types';
import { DAMAGE_TYPE_NAMES } from '../../types';

export function CombatTab() {
  const { units, selectedUnitId, takeDamage, heal: healUnit } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  // Состояние атаки
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('');
  const [targetCount, setTargetCount] = useState(1);
  const [attackResults, setAttackResults] = useState<DiceRollResult[]>([]);
  const [damageResults, setDamageResults] = useState<DiceRollResult[]>([]);
  const [isAttacking, setIsAttacking] = useState(false);
  
  // Состояние получения урона
  const [incomingDamage, setIncomingDamage] = useState(0);
  const [isUndeadAttacker, setIsUndeadAttacker] = useState(false);
  const [damageCategory, setDamageCategory] = useState<DamageCategory>('physical');
  const [damageType, setDamageType] = useState<DamageType>('slashing');
  
  // Состояние исцеления
  const [healAmount, setHealAmount] = useState(0);
  
  if (!unit) {
    return (
      <EmptyState
        icon="⚔️"
        title="Нет персонажа"
        description="Выберите персонажа для боя"
      />
    );
  }
  
  const selectedWeapon = unit.weapons.find(w => w.id === selectedWeaponId) ?? unit.weapons[0];
  
  // Обработчик атаки
  const handleAttack = async () => {
    if (!selectedWeapon) return;
    
    setIsAttacking(true);
    setAttackResults([]);
    setDamageResults([]);
    
    const newAttackResults: DiceRollResult[] = [];
    const newDamageResults: DiceRollResult[] = [];
    
    try {
      for (let target = 0; target < targetCount; target++) {
        // Бросок на попадание
        const profBonus = unit.proficiencies[selectedWeapon.proficiencyType];
        const hitBonus = profBonus + selectedWeapon.hitBonus;
        const hitFormula = hitBonus >= 0 ? `d20+${hitBonus}` : `d20${hitBonus}`;
        
        const hitResult = rollDice(hitFormula, `Попадание ${selectedWeapon.name}`);
        newAttackResults.push(hitResult);
        
        await announceHit(unit.shortName, selectedWeapon.name, hitResult);
        
        // Проверка попадания
        if (hitResult.isCritFail) {
          // Крит промах — ничего не происходит
          await announceMiss(unit.shortName, selectedWeapon.name, hitResult);
          continue;
        }
        
        const hit = isHit(hitResult);
        
        if (!hit) {
          await announceMiss(unit.shortName, selectedWeapon.name, hitResult);
          continue;
        }
        
        // Бросок урона
        const isCrit = hitResult.isCrit;
        const statBonus = getStatDamageBonus(unit, selectedWeapon.statBonus);
        
        // Формула урона с бонусом от стата
        const baseDamageFormula = selectedWeapon.damageFormula;
        const damageFormula = statBonus > 0 
          ? `${baseDamageFormula}+${statBonus}`
          : baseDamageFormula;
        
        const damageResult = rollWithCrit(damageFormula, isCrit, `Урон ${selectedWeapon.name}`);
        newDamageResults.push(damageResult);
        
        await announceDamage(
          unit.shortName,
          damageResult.total,
          DAMAGE_TYPE_NAMES[selectedWeapon.damageType],
          damageResult.rolls,
          statBonus,
          isCrit
        );
        
        // Дополнительный урон (если есть)
        if (selectedWeapon.extraDamageFormula && selectedWeapon.extraDamageType) {
          const extraResult = rollWithCrit(
            selectedWeapon.extraDamageFormula,
            isCrit,
            `Доп. урон (${DAMAGE_TYPE_NAMES[selectedWeapon.extraDamageType]})`
          );
          newDamageResults.push(extraResult);
          
          await announceDamage(
            unit.shortName,
            extraResult.total,
            DAMAGE_TYPE_NAMES[selectedWeapon.extraDamageType],
            extraResult.rolls,
            0,
            isCrit
          );
        }
      }
    } finally {
      setAttackResults(newAttackResults);
      setDamageResults(newDamageResults);
      setIsAttacking(false);
    }
  };
  
  // Расчёт входящего урона
  const damagePreview = unit && incomingDamage > 0
    ? calculateDamage(incomingDamage, damageType, unit, isUndeadAttacker)
    : null;
  
  // Обработчик получения урона
  const handleTakeDamage = async () => {
    if (!damagePreview || damagePreview.finalDamage === 0) return;
    
    await takeDamage(unit.id, damagePreview.finalDamage);
    await announceTakeDamage(
      unit.shortName,
      damagePreview.finalDamage,
      unit.health.current - damagePreview.finalDamage,
      unit.health.max
    );
    
    setIncomingDamage(0);
  };
  
  // Обработчик исцеления
  const handleHeal = async () => {
    if (healAmount <= 0) return;
    
    await healUnit(unit.id, healAmount);
    await announceHealing(
      unit.shortName,
      healAmount,
      Math.min(unit.health.max, unit.health.current + healAmount),
      unit.health.max
    );
    
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
      return physicalTypes.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }));
    }
    return magicalTypes.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }));
  };
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      {/* СЕКЦИЯ: АТАКА ОРУЖИЕМ */}
      <Section title="Атака оружием" icon="⚔️">
        {unit.weapons.length === 0 ? (
          <p className="text-faded text-sm">Добавьте оружие в настройках</p>
        ) : (
          <div className="space-y-3">
            <Select
              label="Оружие"
              value={selectedWeapon?.id ?? ''}
              onChange={(e) => setSelectedWeaponId(e.target.value)}
              options={unit.weapons.map(w => ({ value: w.id, label: w.name }))}
            />
            
            {selectedWeapon && (
              <div className="text-xs text-faded">
                {selectedWeapon.damageFormula} {DAMAGE_TYPE_NAMES[selectedWeapon.damageType]} | 
                Владение +{unit.proficiencies[selectedWeapon.proficiencyType]}
                {selectedWeapon.hitBonus > 0 && ` | Бонус попадания +${selectedWeapon.hitBonus}`}
                {selectedWeapon.notes && <span className="block text-ancient">{selectedWeapon.notes}</span>}
              </div>
            )}
            
            <NumberStepper
              label="Количество целей"
              value={targetCount}
              onChange={setTargetCount}
              min={1}
              max={10}
            />
            
            <Button
              variant="danger"
              onClick={handleAttack}
              loading={isAttacking}
              disabled={!selectedWeapon}
              className="w-full"
            >
              ⚔️ АТАКОВАТЬ
            </Button>
            
            {attackResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-faded uppercase">Попадания:</div>
                <DiceResultDisplay results={attackResults} />
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
