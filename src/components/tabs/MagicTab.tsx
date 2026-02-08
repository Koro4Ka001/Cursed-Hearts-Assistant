import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Modal, Badge, EmptyState } from '@/components/ui';
import { rollDice, rollD20 } from '@/utils/dice';
import { STAT_MULTIPLIERS } from '@/constants/proficiencies';
import { DAMAGE_TYPE_NAMES, DAMAGE_TYPE_ICONS } from '@/constants/damageTypes';
import type { Spell, DiceRollResult, DamageType, Unit } from '@/types';
import { cn } from '@/utils/cn';

function calcMagicBonus(unit: Unit, spell: Spell): number {
  let maxBonus = 0;
  for (const el of spell.elements) {
    const b = unit.magicBonuses[el] || 0;
    if (b > maxBonus) maxBonus = b;
  }
  return maxBonus;
}

function calcSpellDamageBonus(unit: Unit): number {
  return unit.stats.intelligence * STAT_MULTIPLIERS.intelligence;
}

export function MagicTab() {
  const unit = useGameStore(s => s.getActiveUnit());
  const modifyMana = useGameStore(s => s.modifyMana);
  const addLog = useGameStore(s => s.addLog);

  const [castResult, setCastResult] = useState<{
    spell: Spell;
    hitRolls: DiceRollResult[];
    damageRolls: DiceRollResult[];
    totalDamage: number;
    magicBonus: number;
  } | null>(null);
  const [showResult, setShowResult] = useState(false);

  if (!unit) return <EmptyState icon="🔮" message="Выберите юнита для магии" />;

  const spells = unit.spells;

  const handleCast = (spell: Spell) => {
    if (unit.mana.current < spell.manaCost) {
      addLog(`❌ ${unit.shortName}: недостаточно маны для ${spell.name} (нужно ${spell.manaCost})`, 'error');
      return;
    }

    modifyMana(unit.id, -spell.manaCost);
    const magicBonus = calcMagicBonus(unit, spell);
    const intBonus = calcSpellDamageBonus(unit);

    if (spell.type === 'targeted' && spell.damageFormula) {
      const hitRolls: DiceRollResult[] = [];
      const damageRolls: DiceRollResult[] = [];
      let totalDamage = 0;

      for (let i = 0; i < spell.projectiles; i++) {
        if (spell.canDodge) {
          const hit = rollD20(magicBonus);
          hitRolls.push(hit);
        }
        const dmg = rollDice(spell.damageFormula);
        const projDmg = dmg.total + intBonus;
        damageRolls.push({ ...dmg, total: projDmg, bonus: dmg.bonus + intBonus });
        totalDamage += projDmg;
      }

      setCastResult({ spell, hitRolls, damageRolls, totalDamage, magicBonus });
      setShowResult(true);

      addLog(
        `🔮 ${unit.shortName} применяет ${spell.name} (−${spell.manaCost} маны): ${totalDamage} ${spell.damageType ? DAMAGE_TYPE_NAMES[spell.damageType as DamageType] : ''} урона`,
        'spell'
      );
    } else if (spell.type === 'aoe' && spell.damageFormula) {
      const dmg = rollDice(spell.damageFormula);
      const totalDamage = dmg.total + intBonus;
      setCastResult({
        spell,
        hitRolls: [],
        damageRolls: [{ ...dmg, total: totalDamage, bonus: dmg.bonus + intBonus }],
        totalDamage,
        magicBonus,
      });
      setShowResult(true);
      addLog(`🔮 ${unit.shortName} применяет ${spell.name} (AoE, −${spell.manaCost} маны): ${totalDamage} урона`, 'spell');
    } else {
      addLog(`🔮 ${unit.shortName} применяет ${spell.name} (−${spell.manaCost} маны)`, 'spell');
      setCastResult({
        spell,
        hitRolls: [],
        damageRolls: [],
        totalDamage: 0,
        magicBonus,
      });
      setShowResult(true);
    }
  };

  const handleManaChange = (delta: number) => {
    modifyMana(unit.id, delta);
    if (delta > 0) {
      addLog(`💎 ${unit.shortName} восстанавливает ${delta} маны`, 'resource');
    } else {
      addLog(`💎 ${unit.shortName} тратит ${Math.abs(delta)} маны`, 'resource');
    }
  };

  const spellTypeNames: Record<string, string> = {
    targeted: 'По цели',
    aoe: 'По области',
    self: 'На себя',
    summon: 'Призыв',
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Mana controls */}
      <Section title="Управление маной" icon="💎">
        <div className="flex gap-2 items-center">
          <Button variant="secondary" size="sm" onClick={() => handleManaChange(-5)}>−5</Button>
          <Button variant="secondary" size="sm" onClick={() => handleManaChange(-1)}>−1</Button>
          <div className="flex-1 text-center">
            <span className="text-lg font-bold text-mana-bright">{unit.mana.current}</span>
            <span className="text-faded">/{unit.mana.max}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => handleManaChange(1)}>+1</Button>
          <Button variant="secondary" size="sm" onClick={() => handleManaChange(5)}>+5</Button>
        </div>
      </Section>

      {/* Spell list */}
      <Section title="Заклинания" icon="📖">
        {spells.length === 0 ? (
          <p className="text-xs text-faded">Добавьте заклинания в настройках</p>
        ) : (
          <div className="space-y-2">
            {spells.map(spell => {
              const canCast = unit.mana.current >= spell.manaCost;
              const mBonus = calcMagicBonus(unit, spell);
              return (
                <div key={spell.id} className={cn(
                  'p-3 rounded-lg border transition-all',
                  canCast ? 'bg-input border-border-bone hover:border-faded' : 'bg-input/50 border-border-bone/50 opacity-60'
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-bone">{spell.name}</span>
                        <Badge color="mana">💎 {spell.manaCost}</Badge>
                        <Badge color="faded">{spellTypeNames[spell.type]}</Badge>
                      </div>
                      <div className="text-xs text-faded mt-1">
                        {spell.elements.join(', ')}
                        {mBonus > 0 && <span className="text-gold"> (+{mBonus} бонус)</span>}
                        {spell.damageFormula && (
                          <span> • {spell.damageFormula} {spell.damageType && DAMAGE_TYPE_ICONS[spell.damageType as DamageType]}</span>
                        )}
                        {spell.type === 'targeted' && <span> • {spell.projectiles} снаряд(ов)</span>}
                      </div>
                      {spell.description && <div className="text-xs text-ancient mt-1">{spell.description}</div>}
                    </div>
                    <Button variant="gold" size="sm" disabled={!canCast} onClick={() => handleCast(spell)}>
                      🔮
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Cast result modal */}
      <Modal open={showResult} onClose={() => setShowResult(false)} title="Результат заклинания" size="md">
        {castResult && (
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-lg font-bold text-mana-bright">{castResult.spell.name}</div>
              <Badge color="mana">−{castResult.spell.manaCost} маны</Badge>
            </div>

            {castResult.damageRolls.length > 0 && (
              <div className="space-y-2">
                {castResult.damageRolls.map((dr, i) => (
                  <div key={i} className="flex items-center justify-between bg-input rounded-lg px-3 py-2">
                    <span className="text-xs text-faded">
                      {castResult.hitRolls[i] && `Попадание: ${castResult.hitRolls[i].total} • `}
                      Снаряд {i + 1}
                    </span>
                    <span className="font-bold text-blood-bright">{dr.total}</span>
                  </div>
                ))}
                {castResult.totalDamage > 0 && (
                  <div className="text-center p-2 bg-blood-dark/20 rounded-lg border border-blood-dark">
                    <div className="text-xs text-faded">Суммарный урон</div>
                    <div className="text-2xl font-bold text-blood-bright">{castResult.totalDamage}</div>
                    {castResult.spell.damageType && (
                      <div className="text-xs text-ancient">
                        {DAMAGE_TYPE_ICONS[castResult.spell.damageType as DamageType]} {DAMAGE_TYPE_NAMES[castResult.spell.damageType as DamageType]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {castResult.damageRolls.length === 0 && castResult.spell.description && (
              <div className="p-3 bg-input rounded-lg">
                <p className="text-sm text-ancient">{castResult.spell.description}</p>
              </div>
            )}

            <Button variant="secondary" className="w-full" onClick={() => setShowResult(false)}>Готово</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
