import type { RollResult } from '../types';

export function parseFormula(formula: string): { count: number; sides: number; bonus: number }[] {
  const parts: { count: number; sides: number; bonus: number }[] = [];
  const regex = /([+-]?\d*)d(\d+)|([+-]\d+)/gi;
  let match;
  
  while ((match = regex.exec(formula)) !== null) {
    if (match[2]) {
      const count = match[1] === '' || match[1] === '+' ? 1 : match[1] === '-' ? -1 : parseInt(match[1]);
      parts.push({ count, sides: parseInt(match[2]), bonus: 0 });
    } else if (match[3]) {
      parts.push({ count: 0, sides: 0, bonus: parseInt(match[3]) });
    }
  }
  
  return parts;
}

export function rollDice(formula: string, doubleDice: boolean = false): RollResult {
  const parts = parseFormula(formula);
  const rolls: number[] = [];
  let total = 0;
  let rawD20: number | undefined;
  
  for (const part of parts) {
    if (part.sides > 0) {
      const count = doubleDice ? Math.abs(part.count) * 2 : Math.abs(part.count);
      const sign = part.count < 0 ? -1 : 1;
      
      for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * part.sides) + 1;
        rolls.push(roll * sign);
        total += roll * sign;
        
        if (part.sides === 20 && rawD20 === undefined) {
          rawD20 = roll;
        }
      }
    } else {
      total += part.bonus;
    }
  }
  
  return {
    formula: doubleDice ? `(${formula})×2` : formula,
    rolls,
    total,
    isCrit: rawD20 === 20,
    isFail: rawD20 === 1,
    rawD20,
  };
}

export function rollD20(bonus: number = 0): RollResult {
  const roll = Math.floor(Math.random() * 20) + 1;
  return {
    formula: bonus >= 0 ? `d20+${bonus}` : `d20${bonus}`,
    rolls: [roll],
    total: roll + bonus,
    isCrit: roll === 20,
    isFail: roll === 1,
    rawD20: roll,
  };
}

export function formatRoll(result: RollResult): string {
  if (result.rolls.length <= 1) {
    return `${result.formula} = ${result.total}`;
  }
  return `${result.formula} = [${result.rolls.join(', ')}] = ${result.total}`;
}
