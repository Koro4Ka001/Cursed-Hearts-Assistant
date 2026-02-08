import type { RollResult } from '@/types';

// Parse dice formula like "3d20", "d20", "5d12+3"
export function parseDiceFormula(formula: string): { count: number; sides: number; modifier: number } | null {
  const match = formula.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  return {
    count: match[1] ? parseInt(match[1]) : 1,
    sides: parseInt(match[2]),
    modifier: match[3] ? parseInt(match[3]) : 0,
  };
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(formula: string, bonus: number = 0): RollResult {
  const parsed = parseDiceFormula(formula);
  if (!parsed) {
    return { formula, rolls: [0], total: 0, bonus, isCrit: false, isCritFail: false };
  }

  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    rolls.push(rollDie(parsed.sides));
  }

  const diceTotal = rolls.reduce((a, b) => a + b, 0) + parsed.modifier;
  const total = diceTotal + bonus;

  // Crit detection for single d20
  const isCrit = parsed.count === 1 && parsed.sides === 20 && rolls[0] === 20;
  const isCritFail = parsed.count === 1 && parsed.sides === 20 && rolls[0] === 1;

  return { formula, rolls, total, bonus, isCrit, isCritFail };
}

export function rollD20(bonus: number = 0): RollResult {
  return rollDice('d20', bonus);
}

// For crit: double the dice count, not the bonus
export function rollDamageWithCrit(formula: string, bonus: number, isCrit: boolean): RollResult {
  if (!isCrit) return rollDice(formula, bonus);

  const parsed = parseDiceFormula(formula);
  if (!parsed) return rollDice(formula, bonus);

  const doubledFormula = `${parsed.count * 2}d${parsed.sides}${parsed.modifier ? (parsed.modifier > 0 ? '+' : '') + parsed.modifier : ''}`;
  return rollDice(doubledFormula, bonus);
}

export function isValidDiceFormula(formula: string): boolean {
  return parseDiceFormula(formula) !== null;
}

export function formatRoll(result: RollResult): string {
  if (result.isCrit) return `🌟 КРИТ! [${result.rolls.join('+')}] + ${result.bonus} = ${result.total}`;
  if (result.isCritFail) return `💀 КРИТ. ПРОМАХ! [${result.rolls.join('+')}] + ${result.bonus} = ${result.total}`;
  return `[${result.rolls.join('+')}] + ${result.bonus} = ${result.total}`;
}
