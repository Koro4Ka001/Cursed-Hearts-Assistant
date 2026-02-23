import type { Unit, DamageType } from '../types';

export type DamageCategory = 'physical' | 'magical' | 'pure';

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
  
  // Магический урон (русские ключи)
  // Сначала проверяем override для конкретного типа (например, резист к 'огонь')
  const damageTypeLower = damageType.toLowerCase();
  
  // Ищем модификатор с резистом к этому элементу
  const modifier = unit.elementModifiers.find(m => m.element === damageTypeLower && m.isActive);
  
  if (modifier && modifier.resistance > 0) {
    return modifier.resistance;
  }
  
  // Иначе используем базовую магическую защиту
  return unit.armor.magicBase;
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
  const damageTypeLower = damageType.toLowerCase();
  
  // Ищем множитель в модификаторах элементов
  let multiplier = 1.0;
  
  // Проверяем физические множители (legacy или если добавлены)
  if (unit.physicalMultipliers && unit.physicalMultipliers[damageTypeLower]) {
    multiplier = unit.physicalMultipliers[damageTypeLower];
  } else {
    // Проверяем магические модификаторы
    const modifier = unit.elementModifiers.find(m => m.element === damageTypeLower && m.isActive);
    if (modifier) {
      multiplier = modifier.damageMultiplier;
    }
  }
  
  // Броня
  const armorApplied = getArmorValue(unit, category, damageType);
  
  // Бонус от нежити
  const undeadBonus = isUndeadAttacker ? unit.armor.undead : 0;
  
  // Итоговый урон
  const damageAfterMultiplier = rawDamage * multiplier;
  const finalDamage = Math.max(0, Math.round(damageAfterMultiplier - armorApplied - undeadBonus));
  
  // Формируем строку разбивки
  let breakdown = '';
  
  if (multiplier !== 1) {
    breakdown += `(${rawDamage} × ${multiplier})`;
  } else {
    breakdown += `${rawDamage}`;
  }
  
  if (armorApplied > 0) {
    breakdown += ` − ${armorApplied} броня`;
  }
  
  if (undeadBonus > 0) {
    breakdown += ` − ${undeadBonus} (нежить)`;
  }
  
  breakdown += ` = ${finalDamage}`;
  
  return {
    finalDamage,
    armorApplied,
    multiplier,
    undeadBonus,
    breakdown
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
      return unit.stats.physicalPower * 5;
    case 'dexterity':
      return unit.stats.dexterity * 3;
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
