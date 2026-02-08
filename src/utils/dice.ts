import type { DiceRollResult } from '../types';

const DICE_REGEX = /([+-]?\d*)d(\d+)|([+-]\d+)/gi;

export function isValidDiceFormula(formula: string): boolean {
  if (!formula || formula.trim() === '') return false;
  const clean = formula.replace(/\s/g, '');
  const hasContent = /\d/.test(clean);
  if (!hasContent) return false;
  const validChars = /^[0-9d+\-]+$/i.test(clean);
  if (!validChars) return false;
  const parts = clean.split(/(?=[+-])/);
  for (const part of parts) {
    const trimmed = part.replace(/^[+-]/, '');
    if (trimmed === '') continue;
    const isNumber = /^\d+$/.test(trimmed);
    const isDice = /^\d*d\d+$/i.test(trimmed);
    if (!isNumber && !isDice) return false;
  }
  return true;
}

export function rollDice(formula: string, doubleDice: boolean = false): DiceRollResult {
  const individualRolls: number[] = [];
  let bonus = 0;
  let rawD20Value: number | undefined;
  const clean = formula.replace(/\s/g, '');
  let match;
  DICE_REGEX.lastIndex = 0;

  while ((match = DICE_REGEX.exec(clean)) !== null) {
    if (match[2]) {
      let count = match[1] === '' || match[1] === '+' ? 1 :
                  match[1] === '-' ? -1 : parseInt(match[1]);
      const sides = parseInt(match[2]);
      const sign = count < 0 ? -1 : 1;
      count = Math.abs(count);
      if (doubleDice) count *= 2;
      for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        individualRolls.push(roll * sign);
        if (sides === 20 && rawD20Value === undefined) {
          rawD20Value = roll;
        }
      }
    } else if (match[3]) {
      bonus += parseInt(match[3]);
    }
  }

  const rollsSum = individualRolls.reduce((a, b) => a + b, 0);
  const total = rollsSum + bonus;

  return {
    formula: doubleDice ? `(${formula})×2` : formula,
    individualRolls,
    bonus,
    total,
    isCritical: rawD20Value === 20,
    isCriticalFail: rawD20Value === 1,
    rawD20Value,
  };
}

export function rollD20(bonus: number = 0): DiceRollResult {
  const roll = Math.floor(Math.random() * 20) + 1;
  return {
    formula: bonus >= 0 ? `d20+${bonus}` : `d20${bonus}`,
    individualRolls: [roll],
    bonus,
    total: roll + bonus,
    isCritical: roll === 20,
    isCriticalFail: roll === 1,
    rawD20Value: roll,
  };
}

export function rollSingleDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function formatRollResult(result: DiceRollResult): string {
  if (result.individualRolls.length === 1 && result.bonus === 0) {
    return `${result.formula} = ${result.total}`;
  }
  const rollsStr = result.individualRolls.length > 1
    ? `[${result.individualRolls.join(', ')}]`
    : `[${result.individualRolls[0]}]`;
  if (result.bonus !== 0) {
    const bonusStr = result.bonus > 0 ? `+${result.bonus}` : `${result.bonus}`;
    return `${result.formula} = ${rollsStr}${bonusStr} = ${result.total}`;
  }
  return `${result.formula} = ${rollsStr} = ${result.total}`;
}
