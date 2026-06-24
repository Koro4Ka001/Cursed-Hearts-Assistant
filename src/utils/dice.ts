// src/utils/dice.ts
import type { DiceRollResult, RollModifier } from '../types';
import { generateId } from './shared';

export { generateId } from './shared';

/**
 * Парсит формулу кубиков и возвращает структуру для броска
 * Поддерживаемые форматы:
 * - d20 → 1d20
 * - 3d20 → 3×d20
 * - 3d20+5 → 3×d20 + 5
 * - 8d8+4d6 → 8×d8 + 4×d6
 * - d20+d4+18 → 1×d20 + 1×d4 + 18
 */
interface DicePart {
  count: number;
  sides: number;
}

interface ParsedFormula {
  dice: DicePart[];
  flatBonus: number;
}

function parseFormula(formula: string): ParsedFormula {
  const normalized = formula.toLowerCase().replace(/\s/g, '');
  const dice: DicePart[] = [];
  let flatBonus = 0;
  
  // Разбиваем по + и -, сохраняя знаки
  const parts = normalized.split(/(?=[+-])/);
  
  for (const part of parts) {
    const trimmed = part.replace(/^\+/, '');
    
    if (trimmed.includes('d')) {
      // Это кубик: NdM или dM
      const match = trimmed.match(/^(-?\d*)d(\d+)$/);
      if (match) {
        const countStr = match[1];
        const sides = parseInt(match[2] ?? '0', 10);
        let count = 1;
        
        if (countStr === '-') {
          count = -1;
        } else if (countStr && countStr !== '') {
          count = parseInt(countStr, 10);
        }
        
        if (sides > 0) {
          dice.push({ count, sides });
        }
      }
    } else {
      // Это плоский бонус
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        flatBonus += num;
      }
    }
  }
  
  return { dice, flatBonus };
}

/**
 * Бросает один кубик с указанным количеством сторон
 */
function rollSingleDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Бросает d20 с модификатором (преимущество/помеха)
 * Возвращает выбранное значение и все броски
 */
function rollD20WithModifier(modifier: RollModifier): { value: number; allRolls: number[] } {
  if (modifier === 'normal') {
    const roll = rollSingleDie(20);
    return { value: roll, allRolls: [roll] };
  }
  
  const roll1 = rollSingleDie(20);
  const roll2 = rollSingleDie(20);
  const allRolls = [roll1, roll2];
  
  if (modifier === 'advantage') {
    return { value: Math.max(roll1, roll2), allRolls };
  } else {
    return { value: Math.min(roll1, roll2), allRolls };
  }
}

/**
 * Основная функция броска кубиков
 * @param formula - формула броска (например "d20+5", "3d6+2")
 * @param label - описание броска
 * @param modifier - модификатор d20 (преимущество/помеха)
 */
export function rollDice(
  formula: string,
  label?: string,
  modifier: RollModifier = 'normal'
): DiceRollResult {
  const { dice, flatBonus } = parseFormula(formula);
  
  const rolls: number[] = [];
  let rawD20: number | undefined;
  let allD20Rolls: number[] | undefined;
  let hasD20 = false;
  
  for (const { count, sides } of dice) {
    const absCount = Math.abs(count);
    const sign = count < 0 ? -1 : 1;
    
    for (let i = 0; i < absCount; i++) {
      // Первый d20 учитывает модификатор (преимущество/помеха)
      if (sides === 20 && !hasD20 && modifier !== 'normal') {
        const { value, allRolls } = rollD20WithModifier(modifier);
        rolls.push(value * sign);
        rawD20 = value;
        allD20Rolls = allRolls;
        hasD20 = true;
      } else {
        const roll = rollSingleDie(sides);
        rolls.push(roll * sign);
        
        // Запоминаем первый d20 (без модификатора)
        if (sides === 20 && !hasD20) {
          rawD20 = roll;
          hasD20 = true;
        }
      }
    }
  }
  
  const diceTotal = rolls.reduce((sum, r) => sum + r, 0);
  const total = diceTotal + flatBonus;
  
  // Крит только если есть d20 и выбранный d20 = 20
  const isCrit = rawD20 === 20;
  const isCritFail = rawD20 === 1;
  
  return {
    formula,
    rolls,
    bonus: flatBonus,
    total,
    isCrit,
    isCritFail,
    rawD20,
    label,
    rollModifier: modifier !== 'normal' ? modifier : undefined,
    allD20Rolls
  };
}

/**
 * Бросок с удвоением кубиков при крите
 * При крите удваивается количество КУБИКОВ, не бонусы
 */
export function rollWithCrit(
  formula: string,
  isCrit: boolean,
  label?: string,
  modifier: RollModifier = 'normal'
): DiceRollResult {
  if (!isCrit) {
    return rollDice(formula, label, modifier);
  }
  
  // Удваиваем количество кубиков в формуле
  const { dice, flatBonus } = parseFormula(formula);
  
  const doubledDice = dice.map(d => ({ ...d, count: d.count * 2 }));
  
  // Собираем новую формулу
  let newFormula = doubledDice
    .map(d => `${d.count}d${d.sides}`)
    .join('+');
  
  if (flatBonus !== 0) {
    newFormula += flatBonus > 0 ? `+${flatBonus}` : `${flatBonus}`;
  }
  
  const result = rollDice(newFormula, label, 'normal'); // урон без модификатора
  // Отмечаем что это был крит
  return { ...result, isCrit: true };
}

/**
 * Простой бросок d20
 */
export function rollD20(modifier: RollModifier = 'normal'): number {
  const { value } = rollD20WithModifier(modifier);
  return value;
}

/**
 * Бросок d20 с модификатором (бонусом к броску)
 */
export function rollD20WithMod(
  bonus: number,
  label?: string,
  modifier: RollModifier = 'normal'
): DiceRollResult {
  const formula = bonus >= 0 ? `d20+${bonus}` : `d20${bonus}`;
  return rollDice(formula, label, modifier);
}

/**
 * Форматирование результата броска для отображения
 */
export function formatRollResult(result: DiceRollResult): string {
  let text = '';
  
  // Показываем модификатор если был
  if (result.rollModifier === 'advantage') {
    text += '🎯 Преим. ';
  } else if (result.rollModifier === 'disadvantage') {
    text += '💨 Помеха ';
  }
  
  if (result.isCrit) {
    text += '✨ КРИТ! ';
  } else if (result.isCritFail) {
    text += '💀 ПРОВАЛ! ';
  }
  
  // Показываем все d20 если было преимущество/помеха
  if (result.allD20Rolls && result.allD20Rolls.length > 1) {
    const chosen = result.rawD20;
    const displayRolls = result.allD20Rolls.map(r =>
      r === chosen ? `[${r}]` : `~~${r}~~`
    ).join(', ');
    text += `{${displayRolls}} `;
  }
  
  text += `[${result.rolls.join(', ')}]`;
  
  if (result.bonus !== 0) {
    text += result.bonus > 0 ? ` + ${result.bonus}` : ` − ${Math.abs(result.bonus)}`;
  }
  
  text += ` = ${result.total}`;
  
  return text;
}

/**
 * Проверка, является ли бросок попаданием (>= 11 или крит)
 */
export function isHit(result: DiceRollResult, threshold: number = 11): boolean {
  if (result.isCrit) return true;
  if (result.isCritFail) return false;
  return result.total >= threshold;
}

/**
 * Вычисляет бонус к броску магии на основе элементов заклинания
 * Берётся МАКСИМАЛЬНЫЙ бонус из всех элементов
 */
export function getMaxMagicBonus(
  elements: string[],
  magicBonuses: Record<string, number>
): number {
  if (elements.length === 0) return 0;
  
  let maxBonus = 0;
  for (const element of elements) {
    const bonus = magicBonuses[element.toLowerCase()] ?? 0;
    if (bonus > maxBonus) {
      maxBonus = bonus;
    }
  }
  
  return maxBonus;
}


