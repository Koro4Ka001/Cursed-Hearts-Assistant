import type { DiceRollResult } from '../types';

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
 * Основная функция броска кубиков
 */
export function rollDice(formula: string, label?: string): DiceRollResult {
  const { dice, flatBonus } = parseFormula(formula);
  
  const rolls: number[] = [];
  let rawD20: number | undefined;
  let hasD20 = false;
  
  for (const { count, sides } of dice) {
    const absCount = Math.abs(count);
    const sign = count < 0 ? -1 : 1;
    
    for (let i = 0; i < absCount; i++) {
      const roll = rollSingleDie(sides);
      rolls.push(roll * sign);
      
      // Запоминаем первый d20
      if (sides === 20 && !hasD20) {
        rawD20 = roll;
        hasD20 = true;
      }
    }
  }
  
  const diceTotal = rolls.reduce((sum, r) => sum + r, 0);
  const total = diceTotal + flatBonus;
  
  // Крит только если есть d20 и первый d20 = 20
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
    label
  };
}

/**
 * Бросок с удвоением кубиков при крите
 * При крите удваивается количество КУБИКОВ, не бонусы
 */
export function rollWithCrit(formula: string, isCrit: boolean, label?: string): DiceRollResult {
  if (!isCrit) {
    return rollDice(formula, label);
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
  
  const result = rollDice(newFormula, label);
  // Отмечаем что это был крит
  return { ...result, isCrit: true };
}

/**
 * Простой бросок d20
 */
export function rollD20(): number {
  return rollSingleDie(20);
}

/**
 * Бросок d20 с модификатором
 */
export function rollD20WithMod(modifier: number, label?: string): DiceRollResult {
  const formula = modifier >= 0 ? `d20+${modifier}` : `d20${modifier}`;
  return rollDice(formula, label);
}

/**
 * Форматирование результата броска для отображения
 */
export function formatRollResult(result: DiceRollResult): string {
  let text = '';
  
  if (result.isCrit) {
    text += '✨ КРИТ! ';
  } else if (result.isCritFail) {
    text += '💀 ПРОВАЛ! ';
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

/**
 * Генерация уникального ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
