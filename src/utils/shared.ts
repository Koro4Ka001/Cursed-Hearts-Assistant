// src/utils/shared.ts
// Единый источник для общих функций (парсинг формул, броски кубиков, генерация ID)

// ═══════════════════════════════════════════════════════════
// ГЕНЕРАТОР ID
// ═══════════════════════════════════════════════════════════

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ═══════════════════════════════════════════════════════════
// ПАРСЕР ФОРМУЛ КУБИКОВ
// ═══════════════════════════════════════════════════════════

interface DiceGroup {
  count: number;
  sides: number;
}

interface ParsedFormula {
  dice: DiceGroup[];
  bonus: number;
}

export function parseFormula(formula: string): ParsedFormula {
  const dice: DiceGroup[] = [];
  let bonus = 0;
  const tokens = formula.toLowerCase().replace(/\s/g, '').match(/[+-]?(\d*d\d+|\d+)/g) || [];
  for (const t of tokens) {
    const m = t.match(/([+-]?)(\d*)d(\d+)/);
    if (m) {
      const sign = m[1] === '-' ? -1 : 1;
      dice.push({ count: Math.abs(parseInt(m[2] || '1', 10) * sign), sides: parseInt(m[3]!, 10) });
    } else {
      const n = parseInt(t, 10);
      if (!isNaN(n)) bonus += n;
    }
  }
  return { dice, bonus };
}

// ═══════════════════════════════════════════════════════════
// БРОСОК КУБИКОВ
// ═══════════════════════════════════════════════════════════

export function rollDice(formula: string): { formula: string; rolls: number[]; bonus: number; total: number } {
  const { dice, bonus } = parseFormula(formula);
  const rolls: number[] = [];
  for (const { count, sides } of dice) {
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
  }
  const total = rolls.reduce((s, r) => s + r, 0) + bonus;
  return { formula, rolls, bonus, total };
}

export function doubleDiceFormula(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_, c, s) => `${parseInt(c || '1', 10) * 2}d${s}`);
}
