// src/utils/formulaValidator.ts

/**
 * Валидатор dice-формул
 * Поддерживаемые форматы:
 * - d20, d6, d100
 * - 2d6, 3d8, 10d10
 * - 2d6+5, d20-2
 * - 2d6+3d4+5 (составные)
 * - 10 (просто число)
 * - 2d6+СИЛ (с переменными - для будущего)
 */

export interface FormulaValidationResult {
  isValid: boolean;
  error?: string;
  normalized?: string;  // Нормализованная формула
  breakdown?: {
    dice: Array<{ count: number; sides: number }>;
    flatBonus: number;
    variables: string[];
  };
}

// Паттерн для одного dice-терма: 2d6, d20, 3d8
const DICE_TERM_PATTERN = /^(\d+)?d(\d+)$/i;

// Паттерн для числа
const NUMBER_PATTERN = /^[+-]?\d+$/;

// Паттерн для переменной (для будущего расширения)
const VARIABLE_PATTERN = /^[A-ZА-Яa-zа-я_][A-ZА-Яa-zа-я0-9_]*$/;

/**
 * Валидирует dice-формулу
 */
export function validateFormula(formula: string): FormulaValidationResult {
  if (!formula || typeof formula !== 'string') {
    return { isValid: false, error: 'Формула не может быть пустой' };
  }
  
  // Убираем пробелы
  const cleaned = formula.replace(/\s+/g, '');
  
  if (cleaned.length === 0) {
    return { isValid: false, error: 'Формула не может быть пустой' };
  }
  
  // Проверяем на недопустимые символы
  if (!/^[0-9d+\-*\/()a-zA-Zа-яА-Я_]+$/i.test(cleaned)) {
    return { isValid: false, error: 'Формула содержит недопустимые символы' };
  }
  
  // Разбиваем на термы по + и -
  // Сначала заменяем - на +- чтобы сохранить знак
  const normalized = cleaned.replace(/-/g, '+-');
  const terms = normalized.split('+').filter(t => t.length > 0);
  
  const dice: Array<{ count: number; sides: number }> = [];
  let flatBonus = 0;
  const variables: string[] = [];
  
  for (const term of terms) {
    // Проверяем, это dice-терм?
    const diceMatch = term.match(/^(-)?(\d+)?d(\d+)$/i);
    if (diceMatch) {
      const isNegative = diceMatch[1] === '-';
      const count = parseInt(diceMatch[2] || '1', 10);
      const sides = parseInt(diceMatch[3], 10);
      
      if (count < 1 || count > 100) {
        return { isValid: false, error: `Количество кубиков должно быть от 1 до 100 (получено: ${count})` };
      }
      
      if (sides < 1 || sides > 1000) {
        return { isValid: false, error: `Грани кубика должны быть от 1 до 1000 (получено: d${sides})` };
      }
      
      dice.push({ count: isNegative ? -count : count, sides });
      continue;
    }
    
    // Это число?
    if (NUMBER_PATTERN.test(term)) {
      flatBonus += parseInt(term, 10);
      continue;
    }
    
    // Это переменная? (для будущего)
    const varMatch = term.match(/^(-)?([A-ZА-Яa-zа-я_][A-ZА-Яa-zа-я0-9_]*)$/);
    if (varMatch) {
      variables.push(varMatch[2]);
      continue;
    }
    
    // Неизвестный терм
    return { isValid: false, error: `Неизвестный элемент формулы: "${term}"` };
  }
  
  // Должен быть хотя бы один терм
  if (dice.length === 0 && flatBonus === 0 && variables.length === 0) {
    return { isValid: false, error: 'Формула должна содержать хотя бы один элемент' };
  }
  
  // Собираем нормализованную формулу
  const normalizedParts: string[] = [];
  
  for (const d of dice) {
    if (d.count < 0) {
      normalizedParts.push(`-${Math.abs(d.count)}d${d.sides}`);
    } else if (normalizedParts.length > 0) {
      normalizedParts.push(`+${d.count}d${d.sides}`);
    } else {
      normalizedParts.push(`${d.count}d${d.sides}`);
    }
  }
  
  for (const v of variables) {
    if (normalizedParts.length > 0) {
      normalizedParts.push(`+${v}`);
    } else {
      normalizedParts.push(v);
    }
  }
  
  if (flatBonus !== 0) {
    if (flatBonus > 0 && normalizedParts.length > 0) {
      normalizedParts.push(`+${flatBonus}`);
    } else if (flatBonus < 0) {
      normalizedParts.push(`${flatBonus}`);
    } else if (normalizedParts.length === 0) {
      normalizedParts.push(`${flatBonus}`);
    }
  }
  
  return {
    isValid: true,
    normalized: normalizedParts.join(''),
    breakdown: { dice, flatBonus, variables }
  };
}

/**
 * Проверяет, валидна ли формула (простая версия)
 */
export function isValidFormula(formula: string): boolean {
  return validateFormula(formula).isValid;
}

/**
 * Получает читаемое описание формулы
 */
export function describeFormula(formula: string): string {
  const result = validateFormula(formula);
  if (!result.isValid || !result.breakdown) {
    return 'Невалидная формула';
  }
  
  const parts: string[] = [];
  
  for (const d of result.breakdown.dice) {
    if (d.count === 1) {
      parts.push(`кубик d${d.sides}`);
    } else {
      parts.push(`${Math.abs(d.count)} кубиков d${d.sides}`);
    }
  }
  
  if (result.breakdown.flatBonus > 0) {
    parts.push(`+${result.breakdown.flatBonus} бонус`);
  } else if (result.breakdown.flatBonus < 0) {
    parts.push(`${result.breakdown.flatBonus} штраф`);
  }
  
  if (result.breakdown.variables.length > 0) {
    parts.push(`переменные: ${result.breakdown.variables.join(', ')}`);
  }
  
  return parts.join(', ');
}

/**
 * Вычисляет минимальный и максимальный результат формулы
 */
export function getFormulaRange(formula: string): { min: number; max: number } | null {
  const result = validateFormula(formula);
  if (!result.isValid || !result.breakdown) {
    return null;
  }
  
  // Не можем вычислить диапазон если есть переменные
  if (result.breakdown.variables.length > 0) {
    return null;
  }
  
  let min = result.breakdown.flatBonus;
  let max = result.breakdown.flatBonus;
  
  for (const d of result.breakdown.dice) {
    if (d.count > 0) {
      min += d.count * 1;  // минимум на кубике = 1
      max += d.count * d.sides;  // максимум = грани
    } else {
      // Отрицательные кубики (редко, но возможно)
      min += d.count * d.sides;
      max += d.count * 1;
    }
  }
  
  return { min, max };
}

/**
 * Форматирует диапазон для отображения
 */
export function formatFormulaRange(formula: string): string {
  const range = getFormulaRange(formula);
  if (!range) return '';
  return `${range.min}–${range.max}`;
}
