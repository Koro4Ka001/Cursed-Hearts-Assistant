import type { Unit, DamageType } from '@/types';
import { getDamageCategory } from '@/types';

export interface DamageResult {
  finalDamage: number;
  armorApplied: number;
  multiplier: number;
  breakdown: string;
}

export function calculateDamage(
  rawDamage: number,
  damageType: DamageType,
  isUndead: boolean,
  unit: Unit
): DamageResult {
  const category = getDamageCategory(damageType);

  // Pure damage ignores everything
  if (category === 'pure') {
    return {
      finalDamage: rawDamage,
      armorApplied: 0,
      multiplier: 1,
      breakdown: `${rawDamage} чистого (броня игнорируется)`,
    };
  }

  // 1. Get multiplier (vulnerability/resist)
  const mult = unit.damageMultipliers[damageType] ?? 1.0;
  const afterMultiplier = Math.round(rawDamage * mult);

  // 2. Get armor
  let armor = 0;

  if (category === 'physical') {
    const physKey = damageType as 'slashing' | 'piercing' | 'bludgeoning' | 'chopping';
    armor = unit.armor[physKey] ?? 0;
  } else if (category === 'magical') {
    // Check overrides first, then base
    armor = unit.armor.magicOverrides[damageType] ?? unit.armor.magicBase ?? 0;
  }

  // 3. Undead bonus
  if (isUndead) {
    armor += unit.armor.undead ?? 0;
  }

  // 4. Final damage
  const finalDamage = Math.max(0, afterMultiplier - armor);

  // 5. Breakdown
  let breakdown = `${rawDamage}`;
  if (mult !== 1.0) {
    breakdown += ` × ${mult} = ${afterMultiplier}`;
  }
  if (armor > 0) {
    breakdown += ` - ${armor} брони`;
  }
  breakdown += ` = ${finalDamage}`;

  return { finalDamage, armorApplied: armor, multiplier: mult, breakdown };
}

export function getStatDamageBonus(stat: 'physicalPower' | 'dexterity' | 'intelligence' | 'none', unit: Unit): number {
  switch (stat) {
    case 'physicalPower': return unit.stats.physicalPower * 5;
    case 'dexterity': return unit.stats.dexterity * 3;
    case 'intelligence': return unit.stats.intelligence * 3;
    default: return 0;
  }
}
