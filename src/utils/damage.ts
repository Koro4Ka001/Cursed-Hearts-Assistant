// src/utils/damage.ts
import type { Unit, DamageType, DamageCategory, ProficiencyType, ArmorResist } from '../types';
import { getHungerArmorBonus } from './hunger';

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
  // Чистый урон игнорирует броню, НО резист брони к «чистому» работает
  if (damageType === 'pure') {
    const resist = unit.armor?.resists?.['pure'];
    const resistMult = resist?.mult ?? 1;
    const resistFlat = resist?.flat ?? 0;
    const finalDamage = Math.max(0, Math.round(rawDamage * resistMult) - resistFlat);

    let breakdown = `${rawDamage} чистого урона`;
    if (resistMult !== 1) breakdown = `${rawDamage} × ${resistMult} резист = ${Math.round(rawDamage * resistMult)}`;
    if (resistFlat !== 0) breakdown += ` − ${resistFlat} резист`;

    return {
      finalDamage,
      armorApplied: resistFlat,
      multiplier: resistMult,
      undeadBonus: 0,
      breakdown
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
  let armorApplied = getArmorValue(unit, category, damageType);

  // 🍖 Бонус брони от «Голода» (ступенями, добавляется к обычной броне)
  const hungerBonus = getHungerArmorBonus(unit, category);
  armorApplied += hungerBonus;
  
  // Бонус от нежити
  const undeadBonus = isUndeadAttacker ? (unit.armor.undead ?? 0) : 0;

  // Резист брони: сначала коэффициент (урон делится), потом вычеты
  const resist = unit.armor?.resists?.[damageType];
  const resistMult = resist?.mult ?? 1;
  const resistFlat = resist?.flat ?? 0;

  // Итоговый урон
  const afterResist = rawDamage * multiplier * resistMult;
  const finalDamage = Math.max(0, Math.round(afterResist - armorApplied - undeadBonus - resistFlat));
  
  // Формируем строку разбивки
  const parts: string[] = [];
  
  if (multiplier !== 1) {
    parts.push(`${rawDamage} × ${multiplier}`);
  } else {
    parts.push(`${rawDamage}`);
  }

  if (resistMult !== 1) {
    parts.push(`× ${resistMult} резист`);
  }
  
  if (armorApplied > 0) {
    parts.push(`− ${armorApplied} броня`);
  }

  if (hungerBonus > 0) {
    parts.push(`(в т.ч. ${hungerBonus} 🍖 голод)`);
  }

  if (resistFlat !== 0) {
    parts.push(`− ${resistFlat} резист`);
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
 * Рассчитывает бонус к урону от характеристики и владения оружием
 * Каждое очко владения = +5 к урону
 */
export function getStatDamageBonus(
  unit: Unit,
  statBonus: 'physicalPower' | 'dexterity' | 'none',
  proficiencyType?: ProficiencyType
): number {
  let bonus = 0;
  
  switch (statBonus) {
    case 'physicalPower':
      bonus += (unit.stats.physicalPower ?? 0) * 5;
      break;
    case 'dexterity':
      bonus += (unit.stats.dexterity ?? 0) * 3;
      break;
    case 'none':
    default:
      break;
  }
  
  // Владение оружием: +5 за очко
  if (proficiencyType && unit.proficiencies) {
    const profValue = unit.proficiencies[proficiencyType] ?? 0;
    bonus += profValue * 5;
  }
  
  return bonus;
}

/**
 * Применяет урон к юниту (уменьшает HP)
 */
export function applyDamage(currentHP: number, damage: number): number {
  return currentHP - damage;
}

/**
 * Парс ввода резиста: «x0.5»/«×0.5» → коэффициент, «5»/«-5» → плоский минус
 */
export function parseResistInput(input: string): ArmorResist | null {
  const s = input.trim().replace(',', '.');
  if (!s) return null;
  const multMatch = s.match(/^[x×]\s*(-?\d*\.?\d+)$/i);
  if (multMatch) {
    const v = parseFloat(multMatch[1]!);
    return isNaN(v) ? null : { mult: v };
  }
  const v = parseFloat(s);
  return isNaN(v) ? null : { flat: v };
}

/**
 * Форматирует резист обратно в строку ввода: {mult:0.5} → «x0.5»
 */
export function formatResist(resist: ArmorResist): string {
  if (resist.mult !== undefined) return `x${resist.mult}`;
  return String(resist.flat ?? 0);
}

/**
 * Применяет исцеление к юниту
 */
export function applyHealing(currentHP: number, maxHP: number, healing: number): number {
  return Math.min(maxHP, currentHP + healing);
}
