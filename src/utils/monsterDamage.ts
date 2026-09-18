import type { Monster } from '../stores/monsterStore';
import type { DamageType, ArmorResist } from '../types';
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
  // Pure damage ignores armor, but the armor resist to 'pure' still applies
  if (damageType === 'pure') {
    const resist = target.armorResists?.['pure'];
    const resistMult = resist?.mult ?? 1;
    const resistFlat = resist?.flat ?? 0;
    const finalDamage = Math.max(0, Math.round(rawDamage * resistMult) - resistFlat);
    let breakdown = `${rawDamage} чистого`;
    if (resistMult !== 1) breakdown = `${rawDamage} ×${resistMult} резист = ${Math.round(rawDamage * resistMult)}`;
    if (resistFlat !== 0) breakdown += ` −${resistFlat} резист`;
    return { finalDamage, armorApplied: resistFlat, multiplier: resistMult, breakdown };
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
    const typeArmor = target.armorByType?.[damageType] ?? 0;
    armorApplied = target.armor + typeArmor;
  } else if (category === 'magical') {
    // Magical: flat armor + element-specific armor from armorByType
    const typeArmor = target.armorByType?.[damageType] ?? 0;
    armorApplied = target.armor + typeArmor;
  }

  const afterMultiplier = Math.round(rawDamage * multiplier);

  // Резист брони: сначала коэффициент (урон делится), потом вычеты
  const resist = target.armorResists?.[damageType];
  const resistMult = resist?.mult ?? 1;
  const resistFlat = resist?.flat ?? 0;

  const finalDamage = Math.max(0, Math.round(afterMultiplier * resistMult - armorApplied - resistFlat));

  const resistParts: string[] = [];
  if (resistMult !== 1) resistParts.push(`×${resistMult} резист`);
  if (resistFlat !== 0) resistParts.push(`−${resistFlat} резист`);

  return {
    finalDamage,
    armorApplied,
    multiplier,
    breakdown: `${rawDamage} ×${multiplier}${resistParts.length ? ' ' + resistParts.join(' ') : ''} −${armorApplied} = ${finalDamage}`,
  };
}
