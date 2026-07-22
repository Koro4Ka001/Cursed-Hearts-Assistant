import type { Monster } from '../stores/monsterStore';
import type { DamageType } from '../types';
import { getDamageCategory } from './damage';

export interface MonsterDamageResult {
  finalDamage: number;
  armorApplied: number;
  multiplier: number;
  breakdown: string;
}

/**
 * Calculates damage for a Monster target using the same algorithm as calculateDamage for Units.
 */
export function calculateMonsterDamage(
  rawDamage: number,
  damageType: DamageType,
  target: Monster
): MonsterDamageResult {
  // Pure damage ignores everything
  if (damageType === 'pure') {
    return { finalDamage: rawDamage, armorApplied: 0, multiplier: 1, breakdown: `${rawDamage} чистого` };
  }

  const category = getDamageCategory(damageType);

  // Multiplier from element resistances
  let multiplier = 1;
  if (category === 'magical') {
    const resistance = target.elementResistances?.[damageType];
    if (resistance !== undefined) multiplier = resistance;
  }
  // Physical multipliers not tracked per-monster, default 1

  if (multiplier === 0) {
    return { finalDamage: 0, armorApplied: 0, multiplier: 0, breakdown: 'Иммунитет' };
  }

  // Armor
  let armorApplied = 0;
  if (category === 'physical') {
    // Flat armor + type-specific armor
    const typeArmor = target.armorByType?.[damageType] ?? 0;
    armorApplied = target.armor + typeArmor;
  } else if (category === 'magical') {
    // Magical: flat armor applies as magic resistance
    armorApplied = target.armor;
  }

  const afterMultiplier = Math.round(rawDamage * multiplier);
  const finalDamage = Math.max(0, afterMultiplier - armorApplied);

  return {
    finalDamage,
    armorApplied,
    multiplier,
    breakdown: `${rawDamage} ×${multiplier} −${armorApplied} = ${finalDamage}`,
  };
}
