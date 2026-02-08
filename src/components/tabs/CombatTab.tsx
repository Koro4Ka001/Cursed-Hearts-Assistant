import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Modal, Badge, EmptyState, Input, Select } from '@/components/ui';
import { rollD20, rollDice, formatRollResult } from '@/utils/dice';
import { formatBonus } from '@/utils/format';
import { DAMAGE_TYPE_NAMES, DAMAGE_TYPE_ICONS, PHYSICAL_DAMAGE_TYPES, MAGICAL_DAMAGE_TYPES } from '@/constants/damageTypes';
import { PROFICIENCY_NAMES, STAT_MULTIPLIERS } from '@/constants/proficiencies';
import type { Weapon, DiceRollResult, DamageType, Unit } from '@/types';
import { cn } from '@/utils/cn';

function calcHitBonus(unit: Unit, weapon: Weapon): number {
  return unit.proficiencies[weapon.proficiencyType] || 0;
}

function calcDamageBonus(unit: Unit, weapon: Weapon): number {
  if (weapon.statBonus === 'none') return 0;
  const statVal = unit.stats[weapon.statBonus] || 0;
  return statVal * (STAT_MULTIPLIERS[weapon.statBonus] || 0);
}

export function CombatTab() {
  const unit = useGameStore(s => s.getActiveUnit());
  const addLog = useGameStore(s => s.addLog);
  const modifyHealth = useGameStore(s => s.modifyHealth);

  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('');
  const [hitResult, setHitResult] = useState<DiceRollResult | null>(null);
  const [damageResult, setDamageResult] = useState<DiceRollResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCritAttack, setIsCritAttack] = useState(false);

  // Direct damage/heal state
  const [directDamage, setDirectDamage] = useState('');
  const [directDamageType, setDirectDamageType] = useState<DamageType>('slashing');
  const [healAmount, setHealAmount] = useState('');

  if (!unit) return <EmptyState icon="⚔️" message="Выберите юнита для начала боя" />;

  const weapons = unit.weapons;
  const selectedWeapon = weapons.find(w => w.id === selectedWeaponId) || weapons[0];

  const handleAttack = () => {
    if (!selectedWeapon) return;
    const bonus = calcHitBonus(unit, selectedWeapon);
    const result = rollD20(bonus);
    setHitResult(result);
    setDamageResult(null);
    setIsCritAttack(result.isCritical);

    if (result.isCritical) {
      addLog(`🎯 ${unit.shortName} КРИТИЧЕСКОЕ ПОПАДАНИЕ! ${formatRollResult(result)}`, 'action');
    } else if (result.isCriticalFail) {
      addLog(`💀 ${unit.shortName} КРИТИЧЕСКИЙ ПРОМАХ! ${formatRollResult(result)}`, 'error');
    } else {
      addLog(`🎯 ${unit.shortName} атакует: ${formatRollResult(result)}`, 'action');
    }
  };

  const handleRollDamage = () => {
    if (!selectedWeapon) return;
    const statBonus = calcDamageBonus(unit, selectedWeapon);
    const baseRoll = rollDice(selectedWeapon.damageFormula, isCritAttack);
    const totalDamage = baseRoll.total + statBonus;

    const finalResult: DiceRollResult = {
      ...baseRoll,
      bonus: baseRoll.bonus + statBonus,
      total: totalDamage,
    };
    setDamageResult(finalResult);
    setShowResult(true);

    const critText = isCritAttack ? ' (КРИТ!)' : '';
    addLog(
      `💥 ${unit.shortName}: ${DAMAGE_TYPE_ICONS[selectedWeapon.damageType]} ${totalDamage} ${DAMAGE_TYPE_NAMES[selectedWeapon.damageType]} урона${critText}`,
      'damage'
    );
  };

  const handleDirectDamage = () => {
    const dmg = parseInt(directDamage);
    if (isNaN(dmg) || dmg <= 0) return;
    modifyHealth(unit.id, -dmg);
    addLog(`🩸 ${unit.shortName} получает ${dmg} ${DAMAGE_TYPE_NAMES[directDamageType]} урона`, 'damage');
    setDirectDamage('');
  };

  const handleHeal = () => {
    const heal = parseInt(healAmount);
    if (isNaN(heal) || heal <= 0) return;
    modifyHealth(unit.id, heal);
    addLog(`💚 ${unit.shortName} восстанавливает ${heal} HP`, 'heal');
    setHealAmount('');
  };

  const handleReset = () => {
    setHitResult(null);
    setDamageResult(null);
    setShowResult(false);
    setIsCritAttack(false);
  };

  const allDamageTypes = [...PHYSICAL_DAMAGE_TYPES, ...MAGICAL_DAMAGE_TYPES, 'pure' as DamageType];

  return (
    <div className="space-y-3 animate-fade-in">
      {/* ATTACK SECTION */}
      <Section title="Атака" icon="⚔️">
        {weapons.length === 0 ? (
          <p className="text-xs text-faded">Добавьте оружие в настройках</p>
        ) : (
          <div className="space-y-3">
            {/* Weapon select */}
            <div className="grid grid-cols-1 gap-2">
              {weapons.map(w => (
                <button
                  key={w.id}
                  onClick={() => { setSelectedWeaponId(w.id); handleReset(); }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer',
                    (selectedWeapon?.id === w.id)
                      ? 'bg-gold-dark/20 border-gold-dark text-bone'
                      : 'bg-input border-border-bone text-ancient hover:border-faded'
                  )}
                >
                  <span>{DAMAGE_TYPE_ICONS[w.damageType]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{w.name}</div>
                    <div className="text-xs text-faded">
                      {w.damageFormula} {DAMAGE_TYPE_NAMES[w.damageType]} • {PROFICIENCY_NAMES[w.proficiencyType]} {formatBonus(calcHitBonus(unit, w))}
                    </div>
                  </div>
                  <Badge color="gold">{formatBonus(calcDamageBonus(unit, w))}</Badge>
                </button>
              ))}
            </div>

            {/* Attack actions */}
            {selectedWeapon && (
              <div className="space-y-2">
                <Button variant="gold" className="w-full" onClick={handleAttack}>
                  🎲 Бросок на попадание (d20{formatBonus(calcHitBonus(unit, selectedWeapon))})
                </Button>

                {/* Hit result */}
                {hitResult && (
                  <div className={cn(
                    'p-3 rounded-lg border text-center animate-fade-in',
                    hitResult.isCritical ? 'bg-gold-dark/20 border-gold' :
                    hitResult.isCriticalFail ? 'bg-blood-dark/20 border-blood animate-shake' :
                    'bg-input border-border-bone'
                  )}>
                    <div className="text-xs text-faded mb-1">Бросок на попадание</div>
                    <div className={cn(
                      'text-2xl font-bold',
                      hitResult.isCritical ? 'text-gold-bright' :
                      hitResult.isCriticalFail ? 'text-blood-bright' :
                      'text-bone'
                    )}>
                      {hitResult.total}
                    </div>
                    <div className="text-xs text-faded">{formatRollResult(hitResult)}</div>
                    {hitResult.isCritical && <div className="text-sm text-gold-bright font-bold mt-1">⭐ КРИТИЧЕСКОЕ ПОПАДАНИЕ!</div>}
                    {hitResult.isCriticalFail && <div className="text-sm text-blood-bright font-bold mt-1">💀 КРИТИЧЕСКИЙ ПРОМАХ!</div>}
                  </div>
                )}

                {/* Damage roll */}
                {hitResult && !hitResult.isCriticalFail && (
                  <Button variant="primary" className="w-full" onClick={handleRollDamage}>
                    💥 Бросок урона ({selectedWeapon.damageFormula}{isCritAttack ? ' ×2' : ''}{formatBonus(calcDamageBonus(unit, selectedWeapon))})
                  </Button>
                )}

                {hitResult && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
                    Сбросить
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* DIRECT DAMAGE */}
      <Section title="Получить урон" icon="🩸">
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Кол-во"
            value={directDamage}
            onChange={e => setDirectDamage(e.target.value)}
            className="w-20"
          />
          <Select
            value={directDamageType}
            onChange={e => setDirectDamageType(e.target.value as DamageType)}
            options={allDamageTypes.map(dt => ({ value: dt, label: `${DAMAGE_TYPE_ICONS[dt]} ${DAMAGE_TYPE_NAMES[dt]}` }))}
            className="flex-1"
          />
          <Button variant="danger" onClick={handleDirectDamage}>−HP</Button>
        </div>
      </Section>

      {/* HEAL */}
      <Section title="Лечение" icon="💚">
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Кол-во HP"
            value={healAmount}
            onChange={e => setHealAmount(e.target.value)}
            className="flex-1"
          />
          <Button variant="primary" onClick={handleHeal}>💚 Лечить</Button>
        </div>
      </Section>

      {/* Result modal */}
      <Modal open={showResult} onClose={() => setShowResult(false)} title="Результат атаки" size="sm">
        {damageResult && selectedWeapon && (
          <div className="text-center space-y-3">
            <div className="text-4xl">{DAMAGE_TYPE_ICONS[selectedWeapon.damageType]}</div>
            <div className={cn('text-3xl font-bold', isCritAttack ? 'text-gold-bright' : 'text-blood-bright')}>
              {damageResult.total}
            </div>
            <div className="text-sm text-ancient">{DAMAGE_TYPE_NAMES[selectedWeapon.damageType]} урон</div>
            <div className="text-xs text-faded">{formatRollResult(damageResult)}</div>
            {isCritAttack && <Badge color="gold">⭐ КРИТИЧЕСКИЙ УДАР</Badge>}
            <Button variant="secondary" className="w-full mt-4" onClick={() => { setShowResult(false); handleReset(); }}>
              Готово
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
