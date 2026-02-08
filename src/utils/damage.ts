import type { Unit, DamageType } from '@/types';
import { getDamageCategory } from '@/types';

export function calculateDamage(
  rawDamage: number,
  damageType: DamageType,
  isUndead: boolean,
  unit: Unit
): { finalDamage: number; armorApplied: number; multiplier: number } {
  const category = getDamageCategory(damageType);

  if (category === 'pure') {
    return { finalDamage: rawDamage, armorApplied: 0, multiplier: 1 };
  }

  let armor = 0;

  if (category === 'physical') {
    const physKey = damageType as 'slashing' | 'piercing' | 'bludgeoning' | 'chopping';
    armor = unit.armor[physKey] || 0;
  }

  if (category === 'magical') {
    const typeName = damageType as string;
    armor = unit.armor.magicOverrides[typeName] ?? unit.armor.magicBase;
  }

  if (isUndead) {
    armor += unit.armor.undead;
  }

  const mult = unit.damageMultipliers[damageType] ?? 1.0;
  const finalDamage = Math.max(0, Math.round(rawDamage * mult) - armor);

  return { finalDamage, armorApplied: armor, multiplier: mult };
}

export function getStatDamageBonus(stat: 'physicalPower' | 'dexterity' | 'intelligence' | 'none', unit: Unit): number {
  switch (stat) {
    case 'physicalPower': return unit.stats.physicalPower * 5;
    case 'dexterity': return unit.stats.dexterity * 3;
    case 'intelligence': return unit.stats.intelligence * 3;
    default: return 0;
  }
}
