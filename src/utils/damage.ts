// src/utils/damage.ts
import type { Unit, DamageType, DamageCategory } from '../types';

export type { DamageCategory };

export interface DamageResult {
  finalDamage: number;
  armorApplied: number;
  multiplier: number;
  undeadBonus: number;
  breakdown: string;
}

/**
 * Определяет категорию урона по типу
 */
export function getDamageCategory(damageType: DamageType): DamageCategory {
  const physicalTypes: DamageType[] = ['slashing', 'piercing', 'bludgeoning', 'chopping'];
  
  if (damageType === 'pure') {
    return 'pure';
  }
  
  if (physicalTypes.includes(damageType)) {
    return 'physical';
  }
  
  // Всё остальное (огонь, вода, тьма...) — магия
  return 'magical';
}

/**
 * Получает броню против определённого типа урона
 */
function getArmorValue(unit: Unit, category: DamageCategory, damageType: DamageType): number {
  if (category === 'pure') {
    return 0;
  }
  
  if (category === 'physical') {
    switch (damageType) {
      case 'slashing': return unit.armor.slashing;
      case 'piercing': return unit.armor.piercing;
      case 'bludgeoning': return unit.armor.bludgeoning;
      case 'chopping': return unit.armor.chopping;
      default: return 0;
    }
  }
  
  // Магический урон (русские ключи: 'огонь', 'вода', 'тьма'...)
  const elementKey = damageType.toLowerCase();
  
  // Ищем модификатор с резистом к этому элементу
  const modifier = unit.elementModifiers?.find(m => m.element === elementKey && m.isActive);
  
  if (modifier && modifier.resistance > 0) {
    // 🔥 FIX: Суммируем базовую магическую защиту + специфический резист
    return (unit.armor.magicBase ?? 0) + modifier.resistance;
  }
  
  // Иначе используем только базовую магическую защиту
  return unit.armor.magicBase ?? 0;
}

/**
 * Находит множитель урона для данного типа
 */
function getDamageMultiplier(unit: Unit, category: DamageCategory, damageType: DamageType): number {
  const elementKey = damageType.toLowerCase();
  
  if (category === 'physical') {
    // 🔥 FIX: Используем `in` вместо truthy-check (чтобы ×0 иммунитет работал!)
    if (unit.physicalMultipliers && elementKey in unit.physicalMultipliers) {
      return unit.physicalMultipliers[elementKey]!;
    }
    return 1;
  }
  
  if (category === 'magical') {
    const modifier = unit.elementModifiers?.find(m => m.element === elementKey && m.isActive);
    if (modifier) {
      return modifier.damageMultiplier;
    }
    return 1;
  }
  
  // pure — всегда ×1
  return 1;
}

/**
 * Рассчитывает итоговый урон с учётом брони и множителей
 */
export function calculateDamage(
  rawDamage: number,
  damageType: DamageType,
  unit: Unit,
  isUndeadAttacker: boolean = false
): DamageResult {
  // Чистый урон игнорирует всё
  if (damageType === 'pure') {
    return {
      finalDamage: rawDamage,
      armorApplied: 0,
      multiplier: 1,
      undeadBonus: 0,
      breakdown: `${rawDamage} чистого урона`
    };
  }
  
  const category = getDamageCategory(damageType);
  
  // Множитель урона (уязвимости/сопротивления)
  const multiplier = getDamageMultiplier(unit, category, damageType);
  
  // Иммунитет (×0) — сразу выходим
  if (multiplier === 0) {
    return {
      finalDamage: 0,
      armorApplied: 0,
      multiplier: 0,
      undeadBonus: 0,
      breakdown: `${rawDamage} × 0 = 0 (ИММУНИТЕТ)`
    };
  }
  
  // Броня
  const armorApplied = getArmorValue(unit, category, damageType);
  
  // Бонус от нежити
  const undeadBonus = isUndeadAttacker ? (unit.armor.undead ?? 0) : 0;
  
  // Итоговый урон
  const damageAfterMultiplier = rawDamage * multiplier;
  const finalDamage = Math.max(0, Math.round(damageAfterMultiplier - armorApplied - undeadBonus));
  
  // Формируем строку разбивки
  const parts: string[] = [];
  
  if (multiplier !== 1) {
    parts.push(`${rawDamage} × ${multiplier}`);
  } else {
    parts.push(`${rawDamage}`);
  }
  
  if (armorApplied > 0) {
    parts.push(`− ${armorApplied} броня`);
  }
  
  if (undeadBonus > 0) {
    parts.push(`− ${undeadBonus} (нежить)`);
  }
  
  parts.push(`= ${finalDamage}`);
  
  return {
    finalDamage,
    armorApplied,
    multiplier,
    undeadBonus,
    breakdown: parts.join(' ')
  };
}

/**
 * Рассчитывает бонус к урону от характеристики
 */
export function getStatDamageBonus(
  unit: Unit,
  statBonus: 'physicalPower' | 'dexterity' | 'none'
): number {
  switch (statBonus) {
    case 'physicalPower':
      return (unit.stats.physicalPower ?? 0) * 5;
    case 'dexterity':
      return (unit.stats.dexterity ?? 0) * 3;
    case 'none':
    default:
      return 0;
  }
}

/**
 * Применяет урон к юниту (уменьшает HP)
 */
export function applyDamage(currentHP: number, damage: number): number {
  return currentHP - damage;
}

/**
 * Применяет исцеление к юниту
 */
export function applyHealing(currentHP: number, maxHP: number, healing: number): number {
  return Math.min(maxHP, currentHP + healing);
}
