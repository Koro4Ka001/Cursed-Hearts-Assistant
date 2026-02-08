import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Select, NumberStepper, DiceResultDisplay, Checkbox } from '@/components/ui';
import { rollD20, rollDamageWithCrit } from '@/utils/dice';
import { getStatDamageBonus, calculateDamage } from '@/utils/damage';
import type { Weapon, DamageType, Unit } from '@/types';
import { DAMAGE_TYPE_NAMES, PHYSICAL_DAMAGE_TYPES, MAGICAL_DAMAGE_TYPES, getDamageCategory } from '@/types';

interface AttackResult {
  label: string;
  roll: number;
  bonus: number;
  total: number;
  success?: boolean;
  isCrit?: boolean;
  isCritFail?: boolean;
  details?: string;
}

export function CombatTab() {
  const unit = useGameStore((s) => s.getSelectedUnit());
  const setHP = useGameStore((s) => s.setHP);
  const addLog = useGameStore((s) => s.addLog);
  const addNotification = useGameStore((s) => s.addNotification);

  // Melee state
  const [selectedWeaponId, setSelectedWeaponId] = useState('');
  const [targetCount, setTargetCount] = useState(1);
  const [meleeResults, setMeleeResults] = useState<AttackResult[]>([]);

  // Ranged state
  const [selectedBowId, setSelectedBowId] = useState('');
  const [selectedArrowId, setSelectedArrowId] = useState('');
  const [arrowCount, setArrowCount] = useState(1);
  const [rangedResults, setRangedResults] = useState<AttackResult[]>([]);

  // Damage receive state
  const [incomingDamage, setIncomingDamage] = useState('');
  const [damageCategory, setDamageCategory] = useState<'physical' | 'magical' | 'pure'>('physical');
  const [damageType, setDamageType] = useState<DamageType>('slashing');
  const [isUndead, setIsUndead] = useState(false);

  // Heal state
  const [healAmount, setHealAmount] = useState('');

  if (!unit) return <EmptyState />;

  const meleeWeapons = unit.weapons.filter((w) => w.weaponType === 'melee');
  const rangedWeapons = unit.weapons.filter((w) => w.weaponType === 'ranged');
  const arrowResources = unit.resources.filter((r) => r.resourceType === 'arrows');

  const handleMeleeAttack = () => {
    const weapon = meleeWeapons.find((w) => w.id === selectedWeaponId);
    if (!weapon) {
      addNotification({ type: 'error', title: 'Ошибка', message: 'Выберите оружие!' });
      return;
    }

    const results: AttackResult[] = [];
    const profBonus = unit.proficiencies[weapon.proficiencyType] || 0;

    for (let i = 0; i < targetCount; i++) {
      const hitRoll = rollD20(profBonus);
      const hit = hitRoll.isCrit || (!hitRoll.isCritFail && hitRoll.total > 11);

      if (hit && weapon.damageFormula) {
        const statBonus = getStatDamageBonus(weapon.statBonus, unit);
        const dmgRoll = rollDamageWithCrit(weapon.damageFormula, statBonus, hitRoll.isCrit);

        results.push({
          label: `Цель ${i + 1}: Удар`,
          roll: hitRoll.rolls[0],
          bonus: profBonus,
          total: hitRoll.total,
          success: true,
          isCrit: hitRoll.isCrit,
          isCritFail: hitRoll.isCritFail,
        });
        results.push({
          label: `Цель ${i + 1}: Урон`,
          roll: dmgRoll.rolls.reduce((a, b) => a + b, 0),
          bonus: statBonus,
          total: dmgRoll.total,
          details: `${DAMAGE_TYPE_NAMES[weapon.damageType || 'slashing']}${hitRoll.isCrit ? ' (×2 кубики)' : ''}`,
        });
      } else {
        results.push({
          label: `Цель ${i + 1}`,
          roll: hitRoll.rolls[0],
          bonus: profBonus,
          total: hitRoll.total,
          success: false,
          isCrit: hitRoll.isCrit,
          isCritFail: hitRoll.isCritFail,
        });
      }
    }

    setMeleeResults(results);
    const hits = results.filter((r) => r.success).length;
    addLog({
      unitName: unit.shortName,
      message: `⚔️ ${weapon.name}: ${hits}/${targetCount} попаданий`,
      type: 'attack',
    });
  };

  const handleRangedAttack = () => {
    const bow = rangedWeapons.find((w) => w.id === selectedBowId);
    const arrow = arrowResources.find((r) => r.id === selectedArrowId);

    if (!bow) { addNotification({ type: 'error', title: 'Ошибка', message: 'Выберите лук!' }); return; }
    if (!arrow) { addNotification({ type: 'error', title: 'Ошибка', message: 'Выберите стрелы!' }); return; }
    if (arrow.current < arrowCount) {
      addNotification({ type: 'error', title: 'Ошибка', message: `Недостаточно стрел! (${arrow.current}/${arrowCount})` });
      return;
    }

    const results: AttackResult[] = [];
    const profBonus = unit.proficiencies.bows || 0;
    const hitBonus = (bow.hitBonus || 0) + profBonus;

    for (let i = 0; i < arrowCount; i++) {
      const hitRoll = rollD20(hitBonus);
      const hit = hitRoll.isCrit || (!hitRoll.isCritFail && hitRoll.total > 11);

      if (hit && arrow.damageFormula) {
        const statBonus = getStatDamageBonus('dexterity', unit);
        const dmgRoll = rollDamageWithCrit(arrow.damageFormula, statBonus, hitRoll.isCrit);

        results.push({
          label: `Стрела ${i + 1}: Попад.`,
          roll: hitRoll.rolls[0],
          bonus: hitBonus,
          total: hitRoll.total,
          success: true,
          isCrit: hitRoll.isCrit,
          isCritFail: hitRoll.isCritFail,
        });
        results.push({
          label: `Стрела ${i + 1}: Урон`,
          roll: dmgRoll.rolls.reduce((a, b) => a + b, 0),
          bonus: statBonus,
          total: dmgRoll.total,
          details: DAMAGE_TYPE_NAMES[arrow.damageType || 'piercing'],
        });
      } else {
        results.push({
          label: `Стрела ${i + 1}`,
          roll: hitRoll.rolls[0],
          bonus: hitBonus,
          total: hitRoll.total,
          success: false,
          isCritFail: hitRoll.isCritFail,
        });
      }
    }

    // Deduct arrows
    useGameStore.getState().setResource(unit.id, arrow.id, arrow.current - arrowCount);
    setRangedResults(results);
    addLog({
      unitName: unit.shortName,
      message: `🏹 ${bow.name} + ${arrow.name}: ${arrowCount} стрел`,
      type: 'attack',
    });
  };

  const handleReceiveDamage = () => {
    const rawDmg = parseInt(incomingDamage);
    if (!rawDmg || rawDmg <= 0) {
      addNotification({ type: 'error', title: 'Ошибка', message: 'Введите урон!' });
      return;
    }

    const { finalDamage, armorApplied, multiplier } = calculateDamage(rawDmg, damageType, isUndead, unit);
    const newHP = Math.max(0, unit.health.current - finalDamage);
    setHP(unit.id, newHP);

    addNotification({
      type: finalDamage > 0 ? 'warning' : 'info',
      title: `Получен урон: ${finalDamage}`,
      message: `Сырой: ${rawDmg} | Броня: ${armorApplied} | Множитель: ×${multiplier} | HP: ${newHP}/${unit.health.max}`,
    });

    addLog({
      unitName: unit.shortName,
      message: `🩸 Получен ${finalDamage} ${DAMAGE_TYPE_NAMES[damageType]} урона (сырой: ${rawDmg}, броня: ${armorApplied})`,
      type: 'damage',
    });
    setIncomingDamage('');
  };

  const handleHeal = () => {
    const amount = parseInt(healAmount);
    if (!amount || amount <= 0) {
      addNotification({ type: 'error', title: 'Ошибка', message: 'Введите количество HP!' });
      return;
    }
    const newHP = Math.min(unit.health.max, unit.health.current + amount);
    setHP(unit.id, newHP);
    addNotification({ type: 'success', title: `Исцеление: +${amount}`, message: `HP: ${newHP}/${unit.health.max}` });
    addLog({ unitName: unit.shortName, message: `💚 Исцеление +${amount} HP`, type: 'heal' });
    setHealAmount('');
  };

  const currentDamageTypes = damageCategory === 'physical' ? PHYSICAL_DAMAGE_TYPES :
    damageCategory === 'magical' ? MAGICAL_DAMAGE_TYPES : (['pure'] as const);

  return (
    <div className="space-y-3 animate-[fadeSlideIn_300ms]">
      {/* MELEE */}
      <Section title="Ближний бой" icon="⚔️" collapsible>
        {meleeWeapons.length === 0 ? (
          <p className="text-xs text-[#7a6f62] italic">Нет оружия ближнего боя. Добавьте в настройках.</p>
        ) : (
          <div className="space-y-3">
            <Select
              label="Оружие"
              value={selectedWeaponId}
              onChange={(e) => setSelectedWeaponId(e.target.value)}
              options={[{ value: '', label: '-- Выберите --' }, ...meleeWeapons.map((w) => ({ value: w.id, label: `${w.name} (${w.damageFormula})` }))]}
            />
            {selectedWeaponId && <WeaponInfo weapon={meleeWeapons.find((w) => w.id === selectedWeaponId)!} unit={unit} />}
            <NumberStepper label="Количество целей" value={targetCount} onChange={setTargetCount} min={1} max={10} />
            <Button variant="primary" size="lg" className="w-full" onClick={handleMeleeAttack} disabled={!selectedWeaponId}>
              ⚔️ Атаковать
            </Button>
            {meleeResults.length > 0 && <DiceResultDisplay title="Результат атаки" results={meleeResults} />}
          </div>
        )}
      </Section>

      {/* RANGED */}
      <Section title="Дальний бой" icon="🏹" collapsible>
        {rangedWeapons.length === 0 ? (
          <p className="text-xs text-[#7a6f62] italic">Нет оружия дальнего боя. Добавьте в настройках.</p>
        ) : (
          <div className="space-y-3">
            <Select
              label="Лук"
              value={selectedBowId}
              onChange={(e) => setSelectedBowId(e.target.value)}
              options={[{ value: '', label: '-- Выберите --' }, ...rangedWeapons.map((w) => ({ value: w.id, label: `${w.name} (+${w.hitBonus || 0} попад.)` }))]}
            />
            <Select
              label="Тип стрел"
              value={selectedArrowId}
              onChange={(e) => setSelectedArrowId(e.target.value)}
              options={[
                { value: '', label: '-- Выберите --' },
                ...arrowResources.map((r) => ({ value: r.id, label: `${r.icon} ${r.name} (${r.current}/${r.max}) — ${r.damageFormula || '?'}` })),
              ]}
            />
            <NumberStepper label="Количество стрел" value={arrowCount} onChange={setArrowCount} min={1} max={10} />
            <Button variant="primary" size="lg" className="w-full" onClick={handleRangedAttack} disabled={!selectedBowId || !selectedArrowId}>
              🏹 Выстрелить
            </Button>
            {rangedResults.length > 0 && <DiceResultDisplay title="Результат стрельбы" results={rangedResults} />}
          </div>
        )}
      </Section>

      {/* RECEIVE DAMAGE */}
      <Section title="Получение урона" icon="🩸" collapsible>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block mb-1 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">Урон</label>
              <input
                type="number"
                value={incomingDamage}
                onChange={(e) => setIncomingDamage(e.target.value)}
                placeholder="0"
                className="w-full h-10 px-3 bg-[#161412] text-[#d4c8b8] text-sm rounded-lg border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
              />
            </div>
            <Select
              label="Категория"
              value={damageCategory}
              onChange={(e) => {
                const cat = e.target.value as 'physical' | 'magical' | 'pure';
                setDamageCategory(cat);
                if (cat === 'physical') setDamageType('slashing');
                else if (cat === 'magical') setDamageType('fire');
                else setDamageType('pure');
              }}
              options={[
                { value: 'physical', label: 'Физический' },
                { value: 'magical', label: 'Магический' },
                { value: 'pure', label: 'Чистый' },
              ]}
            />
          </div>
          {damageCategory !== 'pure' && (
            <Select
              label="Тип урона"
              value={damageType}
              onChange={(e) => setDamageType(e.target.value as DamageType)}
              options={currentDamageTypes.map((t) => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))}
            />
          )}
          <Checkbox checked={isUndead} onChange={setIsUndead} label="Атакующий — нежить" />
          {incomingDamage && parseInt(incomingDamage) > 0 && (
            <DamagePreview raw={parseInt(incomingDamage)} type={damageType} isUndead={isUndead} unit={unit} />
          )}
          <Button variant="danger" size="lg" className="w-full" onClick={handleReceiveDamage}>
            🩸 Получить урон
          </Button>
        </div>
      </Section>

      {/* HEAL */}
      <Section title="Исцеление" icon="💚" collapsible>
        <div className="flex gap-2">
          <input
            type="number"
            value={healAmount}
            onChange={(e) => setHealAmount(e.target.value)}
            placeholder="Кол-во HP"
            className="flex-1 h-10 px-3 bg-[#161412] text-[#d4c8b8] text-sm rounded-lg border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
          />
          <Button variant="success" onClick={handleHeal}>💚 Исцелить</Button>
        </div>
      </Section>
    </div>
  );
}

function WeaponInfo({ weapon, unit }: { weapon: Weapon; unit: Unit }) {
  const prof = unit.proficiencies[weapon.proficiencyType] || 0;
  const statBonusVal = getStatDamageBonus(weapon.statBonus, unit);
  return (
    <div className="bg-[#161412] rounded-lg p-2 text-[11px] text-[#b8a892] space-y-0.5">
      <div>📊 Попадание: d20 + {prof} (владение)</div>
      <div>💥 Урон: {weapon.damageFormula} + {statBonusVal} ({weapon.statBonus === 'physicalPower' ? 'физ.мощь' : weapon.statBonus === 'dexterity' ? 'ловкость' : 'нет'})</div>
      <div>🔖 Тип: {DAMAGE_TYPE_NAMES[weapon.damageType || 'slashing']}</div>
      {weapon.special && <div>✨ Особое: {weapon.special}</div>}
    </div>
  );
}

function DamagePreview({ raw, type, isUndead, unit }: { raw: number; type: DamageType; isUndead: boolean; unit: Unit }) {
  const { finalDamage, armorApplied, multiplier } = calculateDamage(raw, type, isUndead, unit);
  const category = getDamageCategory(type);
  return (
    <div className="bg-[#161412] rounded-lg p-2 text-[11px] text-[#b8a892]">
      <div>📊 Сырой урон: {raw}</div>
      {category !== 'pure' && <div>🛡️ Броня: {armorApplied}</div>}
      {multiplier !== 1 && <div>⚖️ Множитель: ×{multiplier}</div>}
      <div className="font-bold text-[#d4c8b8]">💀 Итого: {finalDamage}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">⚔️</span>
      <p className="text-sm text-[#7a6f62]">Выберите или создайте юнита в настройках</p>
    </div>
  );
}
