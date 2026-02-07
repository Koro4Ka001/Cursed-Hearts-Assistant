import type { RollResult } from '@/types';

// Парсит формулу кубиков и возвращает структуру
interface DiceGroup {
  count: number;
  sides: number;
}

interface ParsedFormula {
  dice: DiceGroup[];
  modifier: number;
}

function parseFormula(formula: string): ParsedFormula {
  const result: ParsedFormula = { dice: [], modifier: 0 };
  
  // Убираем пробелы
  const cleaned = formula.replace(/\s/g, '');
  
  // Разбиваем на части по + и -
  const parts = cleaned.split(/(?=[+-])/);
  
  for (const part of parts) {
    // Проверяем, это кубики или модификатор
    const diceMatch = part.match(/^([+-]?)(\d*)d(\d+)$/i);
    if (diceMatch) {
      const sign = diceMatch[1] === '-' ? -1 : 1;
      const count = parseInt(diceMatch[2] || '1') * sign;
      const sides = parseInt(diceMatch[3]);
      result.dice.push({ count, sides });
    } else {
      const num = parseInt(part);
      if (!isNaN(num)) {
        result.modifier += num;
      }
    }
  }
  
  return result;
}

// Бросает кубики локально
function rollDice(count: number, sides: number): number[] {
  const results: number[] = [];
  const absCount = Math.abs(count);
  for (let i = 0; i < absCount; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

// Основная функция броска
export async function roll(formula: string): Promise<RollResult> {
  const parsed = parseFormula(formula);
  const diceResults: number[] = [];
  let total = parsed.modifier;
  let rawD20: number | undefined;
  
  for (const group of parsed.dice) {
    const rolls = rollDice(group.count, group.sides);
    const sign = group.count < 0 ? -1 : 1;
    
    for (const r of rolls) {
      diceResults.push(r * sign);
      total += r * sign;
      
      // Запоминаем первый d20 для определения крита
      if (group.sides === 20 && rawD20 === undefined) {
        rawD20 = r;
      }
    }
  }
  
  const isCrit = rawD20 === 20;
  
  return {
    formula,
    total,
    diceResults,
    rawD20,
    isCrit,
  };
}

// Бросок d20 с модификатором
export async function rollD20(modifier: number = 0): Promise<RollResult> {
  const formula = modifier >= 0 ? `1d20+${modifier}` : `1d20${modifier}`;
  return roll(formula);
}

// Удваивает кубики в формуле (для критов)
export function doubleDiceInFormula(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_match, count, sides) => {
    const numCount = parseInt(count || '1');
    return `${numCount * 2}d${sides}`;
  });
}

// Форматирует результат для отображения
export function formatRollResult(result: RollResult): string {
  const diceStr = result.diceResults.length > 0 
    ? `[${result.diceResults.join(', ')}]` 
    : '';
  return `${result.formula} = ${diceStr} → ${result.total}`;
}

// Попытка интеграции с Dice Owlbear Rodeo через broadcast channel
export async function rollWithDiceOwlbear(formula: string): Promise<RollResult | null> {
  try {
    // Пытаемся отправить команду в чат Owlbear
    // Dice Owlbear слушает сообщения в формате /roll
    if (typeof window !== 'undefined' && (window as any).OBR) {
      const OBR = (window as any).OBR;
      
      // Попытка отправить сообщение в чат
      if (OBR.broadcast) {
        await OBR.broadcast.sendMessage('dice-owlbear-rodeo', {
          type: 'roll',
          formula: formula,
        });
      }
    }
  } catch (e) {
    console.warn('Dice Owlbear integration not available, using local dice');
  }
  
  // Всегда делаем локальный бросок как fallback
  return roll(formula);
}

// Отправка результата в чат Owlbear
export async function sendToChat(message: string): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      const OBR = await import('@owlbear-rodeo/sdk').then(m => m.default);
      if (OBR.isReady) {
        await OBR.notification.show(message, 'INFO');
      }
    }
  } catch (e) {
    console.log('Chat message:', message);
  }
}
