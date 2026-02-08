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
  const logToDocs = useGameStore((s) => s.logToDocs);

  const [selectedWeaponId, setSelectedWeaponId] = useState('');
  const [targetCount, setTargetCount] = useState(1);
  const [meleeResults, setMeleeResults] = useState<AttackResult[]>([]);

  const [selectedBowId, setSelectedBowId] = useState('');
  const [selectedArrowId, setSelectedArrowId] = useState('');
  const [arrowCount, setArrowCount] = useState(1);
  const [rangedResults, setRangedResults] = useState<AttackResult[]>([]);

  const [incomingDamage, setIncomingDamage] = useState('');
  const [damageCategory, setDamageCategory] = useState<'physical' | 'magical' | 'pure'>('physical');
  const [damageType, setDamageType] = useState<DamageType>('slashing');
  const [isUndead, setIsUndead] = useState(false);

  const [healAmount, setHealAmount] = useState('');

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="text-3xl mb-2">⚔️</span>
        <p className="text-[12px] text-[#7a6f62]">Выберите или создайте юнита в ⚙️</p>
      </div>
    );
  }

  const meleeWeapons = unit.weapons.filter((w) => w.weaponType === 'melee');
  const rangedWeapons = unit.weapons.filter((w) => w.weaponType === 'ranged');
  const arrowResources = unit.resources.filter((r) => r.resourceType === 'arrows');

  const handleMeleeAttack = () => {
    const weapon = meleeWeapons.find((w) => w.id === selectedWeaponId);
    if (!weapon) { addNotification({ type: 'error', title: 'Ошибка', message: 'Выберите оружие!' }); return; }

    const results: AttackResult[] = [];
    const profBonus = unit.proficiencies[weapon.proficiencyType] || 0;

    for (let i = 0; i < targetCount; i++) {
      const hitRoll = rollD20(profBonus);
      const hit = hitRoll.isCrit || (!hitRoll.isCritFail && hitRoll.total > 11);

      results.push({
        label: `Цель ${i + 1}`,
        roll: hitRoll.rolls[0], bonus: profBonus, total: hitRoll.total,
        success: hit, isCrit: hitRoll.isCrit, isCritFail: hitRoll.isCritFail,
      });

      if (hit && weapon.damageFormula) {
        const statBonus = getStatDamageBonus(weapon.statBonus, unit);
        const dmgRoll = rollDamageWithCrit(weapon.damageFormula, statBonus, hitRoll.isCrit);
        results.push({
          label: `  → Урон`,
          roll: dmgRoll.rolls.reduce((a, b) => a + b, 0), bonus: statBonus, total: dmgRoll.total,
          details: `${DAMAGE_TYPE_NAMES[weapon.damageType || 'slashing']}${hitRoll.isCrit ? ' ×2🎲' : ''}`,
        });
      }
    }

    setMeleeResults(results);
    const hits = results.filter((r) => r.success).length;
    const msg = `⚔️ ${weapon.name}: ${hits}/${targetCount} попаданий`;
    addLog({ unitName: unit.shortName, message: msg, type: 'attack' });
    logToDocs(msg);
  };

  const handleRangedAttack = () => {
    const bow = rangedWeapons.find((w) => w.id === selectedBowId);
    const arrow = arrowResources.find((r) => r.id === selectedArrowId);

    if (!bow) { addNotification({ type: 'error', title: 'Ошибка', message: 'Выберите лук!' }); return; }
    if (!arrow) { addNotification({ type: 'error', title: 'Ошибка', message: 'Выберите стрелы!' }); return; }
    if (arrow.current < arrowCount) {
      addNotification({ type: 'error', title: 'Ошибка', message: `Мало стрел! (${arrow.current}/${arrowCount})` });
      return;
    }

    const results: AttackResult[] = [];
    const profBonus = unit.proficiencies.bows || 0;
    const hitBonus = (bow.hitBonus || 0) + profBonus;

    for (let i = 0; i < arrowCount; i++) {
      const hitRoll = rollD20(hitBonus);
      const hit = hitRoll.isCrit || (!hitRoll.isCritFail && hitRoll.total > 11);

      results.push({
        label: `Стрела ${i + 1}`,
        roll: hitRoll.rolls[0], bonus: hitBonus, total: hitRoll.total,
        success: hit, isCrit: hitRoll.isCrit, isCritFail: hitRoll.isCritFail,
      });

      if (hit && arrow.damageFormula) {
        const statBonus = getStatDamageBonus('dexterity', unit);
        const dmgRoll = rollDamageWithCrit(arrow.damageFormula, statBonus, hitRoll.isCrit);
        results.push({
          label: `  → Урон`,
          roll: dmgRoll.rolls.reduce((a, b) => a + b, 0), bonus: statBonus, total: dmgRoll.total,
          details: DAMAGE_TYPE_NAMES[arrow.damageType || 'piercing'],
        });
      }
    }

    useGameStore.getState().setResource(unit.id, arrow.id, arrow.current - arrowCount);
    setRangedResults(results);
    const msg = `🏹 ${bow.name}+${arrow.name}: ${arrowCount} стрел`;
    addLog({ unitName: unit.shortName, message: msg, type: 'attack' });
    logToDocs(msg);
  };

  const handleReceiveDamage = () => {
    const rawDmg = parseInt(incomingDamage);
    if (!rawDmg || rawDmg <= 0) { addNotification({ type: 'error', title: 'Ошибка', message: 'Введите урон!' }); return; }

    const { finalDamage, armorApplied, multiplier, breakdown } = calculateDamage(rawDmg, damageType, isUndead, unit);
    const newHP = Math.max(0, unit.health.current - finalDamage);
    setHP(unit.id, newHP);

    addNotification({
      type: finalDamage > 0 ? 'warning' : 'info',
      title: `Урон: ${finalDamage}`,
      message: breakdown,
    });

    const msg = `🩸 ${finalDamage} ${DAMAGE_TYPE_NAMES[damageType]} (сыр:${rawDmg} бр:${armorApplied} ×${multiplier})`;
    addLog({ unitName: unit.shortName, message: msg, type: 'damage' });
    logToDocs(msg);
    setIncomingDamage('');
  };

  const handleHeal = () => {
    const amount = parseInt(healAmount);
    if (!amount || amount <= 0) { addNotification({ type: 'error', title: 'Ошибка', message: 'Введите HP!' }); return; }
    const newHP = Math.min(unit.health.max, unit.health.current + amount);
    setHP(unit.id, newHP);
    addNotification({ type: 'success', title: `+${amount} HP`, message: `HP: ${newHP}/${unit.health.max}` });
    addLog({ unitName: unit.shortName, message: `💚 +${amount} HP`, type: 'heal' });
    logToDocs(`💚 Исцеление +${amount} HP`);
    setHealAmount('');
  };

  const currentDamageTypes = damageCategory === 'physical' ? PHYSICAL_DAMAGE_TYPES :
    damageCategory === 'magical' ? MAGICAL_DAMAGE_TYPES : (['pure'] as DamageType[]);

  return (
    <div className="space-y-2 animate-[fadeSlideIn_200ms]">
      {/* MELEE */}
      <Section title="Ближний бой" icon="⚔️" collapsible>
        {meleeWeapons.length === 0 ? (
          <p className="text-[11px] text-[#7a6f62] italic">Нет оружия. Добавьте в ⚙️</p>
        ) : (
          <div className="space-y-2">
            <Select
              label="Оружие"
              value={selectedWeaponId}
              onChange={(e) => setSelectedWeaponId(e.target.value)}
              options={[{ value: '', label: '-- Выберите --' }, ...meleeWeapons.map((w) => ({ value: w.id, label: `${w.name} (${w.damageFormula})` }))]}
            />
            {selectedWeaponId && <WeaponInfo weapon={meleeWeapons.find((w) => w.id === selectedWeaponId)!} unit={unit} />}
            <NumberStepper label="Целей" value={targetCount} onChange={setTargetCount} min={1} max={10} />
            <Button variant="primary" className="w-full" onClick={handleMeleeAttack} disabled={!selectedWeaponId}>
              ⚔️ Атаковать
            </Button>
            {meleeResults.length > 0 && <DiceResultDisplay title="Результат" results={meleeResults} />}
          </div>
        )}
      </Section>

      {/* RANGED */}
      <Section title="Дальний бой" icon="🏹" collapsible defaultOpen={false}>
        {rangedWeapons.length === 0 ? (
          <p className="text-[11px] text-[#7a6f62] italic">Нет луков. Добавьте в ⚙️</p>
        ) : (
          <div className="space-y-2">
            <Select label="Лук" value={selectedBowId} onChange={(e) => setSelectedBowId(e.target.value)}
              options={[{ value: '', label: '-- Выберите --' }, ...rangedWeapons.map((w) => ({ value: w.id, label: `${w.name} (+${w.hitBonus || 0})` }))]} />
            <Select label="Стрелы" value={selectedArrowId} onChange={(e) => setSelectedArrowId(e.target.value)}
              options={[{ value: '', label: '-- Выберите --' }, ...arrowResources.map((r) => ({ value: r.id, label: `${r.icon} ${r.name} (${r.current}шт) — ${r.damageFormula}` }))]} />
            <NumberStepper label="Кол-во стрел" value={arrowCount} onChange={setArrowCount} min={1} max={10} />
            <Button variant="primary" className="w-full" onClick={handleRangedAttack} disabled={!selectedBowId || !selectedArrowId}>
              🏹 Выстрелить
            </Button>
            {rangedResults.length > 0 && <DiceResultDisplay title="Результат" results={rangedResults} />}
          </div>
        )}
      </Section>

      {/* RECEIVE DAMAGE */}
      <Section title="Получение урона" icon="🩸" collapsible>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block mb-0.5 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">Урон</label>
              <input type="number" value={incomingDamage} onChange={(e) => setIncomingDamage(e.target.value)} placeholder="0"
                className="w-full h-9 px-3 bg-[#161412] text-[#d4c8b8] text-[14px] rounded-lg border border-[#3a332a] focus:outline-none focus:border-[#d4a726]" />
            </div>
            <Select label="Категория" value={damageCategory}
              onChange={(e) => {
                const cat = e.target.value as 'physical' | 'magical' | 'pure';
                setDamageCategory(cat);
                if (cat === 'physical') setDamageType('slashing');
                else if (cat === 'magical') setDamageType('fire');
                else setDamageType('pure');
              }}
              options={[
                { value: 'physical', label: 'Физ.' },
                { value: 'magical', label: 'Маг.' },
                { value: 'pure', label: 'Чист.' },
              ]}
            />
          </div>
          {damageCategory !== 'pure' && (
            <Select label="Тип" value={damageType} onChange={(e) => setDamageType(e.target.value as DamageType)}
              options={currentDamageTypes.map((t) => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))} />
          )}
          <Checkbox checked={isUndead} onChange={setIsUndead} label="Атакующий — нежить" />
          {incomingDamage && parseInt(incomingDamage) > 0 && (
            <DamagePreview raw={parseInt(incomingDamage)} type={damageType} isUndead={isUndead} unit={unit} />
          )}
          <Button variant="danger" className="w-full" onClick={handleReceiveDamage}>
            🩸 Получить урон
          </Button>
        </div>
      </Section>

      {/* HEAL */}
      <Section title="Исцеление" icon="💚" collapsible defaultOpen={false}>
        <div className="flex gap-2">
          <input type="number" value={healAmount} onChange={(e) => setHealAmount(e.target.value)} placeholder="HP"
            className="flex-1 h-9 px-3 bg-[#161412] text-[#d4c8b8] text-[14px] rounded-lg border border-[#3a332a] focus:outline-none focus:border-[#d4a726]" />
          <Button variant="success" onClick={handleHeal}>💚 Лечить</Button>
        </div>
      </Section>
    </div>
  );
}

function WeaponInfo({ weapon, unit }: { weapon: Weapon; unit: Unit }) {
  const prof = unit.proficiencies[weapon.proficiencyType] || 0;
  const statBonusVal = getStatDamageBonus(weapon.statBonus, unit);
  return (
    <div className="bg-[#161412] rounded p-2 text-[10px] text-[#b8a892] space-y-0.5">
      <div>🎯 d20 + {prof}</div>
      <div>💥 {weapon.damageFormula} + {statBonusVal}</div>
      <div>🔖 {DAMAGE_TYPE_NAMES[weapon.damageType || 'slashing']}</div>
    </div>
  );
}

function DamagePreview({ raw, type, isUndead, unit }: { raw: number; type: DamageType; isUndead: boolean; unit: Unit }) {
  const { finalDamage, armorApplied, multiplier } = calculateDamage(raw, type, isUndead, unit);
  const category = getDamageCategory(type);
  return (
    <div className="bg-[#161412] rounded p-2 text-[10px] text-[#b8a892] flex gap-3 items-center">
      <span>Сыр: {raw}</span>
      {category !== 'pure' && <span>🛡 {armorApplied}</span>}
      {multiplier !== 1 && <span>×{multiplier}</span>}
      <span className="font-bold text-[#d4c8b8]">= {finalDamage}</span>
    </div>
  );
}
