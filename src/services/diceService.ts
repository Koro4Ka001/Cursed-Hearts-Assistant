/**
 * DiceService — интеграция с Dice Extension через player metadata
 * 
 * Протокол работы:
 * 1. Записываем конфигурацию броска в OBR.player.setMetadata()
 * 2. Dice Extension читает metadata, показывает 3D кубики
 * 3. Dice Extension записывает результаты обратно в metadata
 * 4. Мы читаем результаты через OBR.player.onChange()
 */

import OBR from '@owlbear-rodeo/sdk';
import type { DiceRollResult } from '../types';

// Маппинг сторон кубика на тип Dice Extension
const DICE_TYPE_MAP: Record<number, string> = {
  4: 'D4',
  6: 'D6',
  8: 'D8',
  10: 'D10',
  12: 'D12',
  20: 'D20'
};

// Ключи metadata для Dice Extension
const METADATA_KEYS = {
  roll: 'rodeo.owlbear.dice/roll',
  throws: 'rodeo.owlbear.dice/rollThrows',
  values: 'rodeo.owlbear.dice/rollValues',
  transforms: 'rodeo.owlbear.dice/rollTransforms',
} as const;

// Типы для metadata
interface DiceConfig {
  id: string;
  style: string;
  type: string;
}

interface ThrowPhysics {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  linearVelocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
}

interface RollMetadata {
  dice: DiceConfig[];
  bonus: number;
  hidden: boolean;
}

export type DiceStatus = 'dice3d' | 'local';

/**
 * Генерирует случайную физику броска для кубика
 */
function generateThrowPhysics(): ThrowPhysics {
  const r = (min: number, max: number) => Math.random() * (max - min) + min;
  
  // Случайный unit quaternion для вращения
  const u1 = Math.random();
  const u2 = Math.random();
  const u3 = Math.random();
  const s1 = Math.sqrt(1 - u1);
  const s2 = Math.sqrt(u1);
  
  return {
    position: { x: r(-0.5, 0.5), y: r(0.8, 1.5), z: r(-0.5, 0.5) },
    rotation: {
      x: s1 * Math.sin(2 * Math.PI * u2),
      y: s1 * Math.cos(2 * Math.PI * u2),
      z: s2 * Math.sin(2 * Math.PI * u3),
      w: s2 * Math.cos(2 * Math.PI * u3)
    },
    linearVelocity: { x: r(-2, 2), y: 0, z: r(-2, 2) },
    angularVelocity: { x: r(-8, 8), y: r(-8, 8), z: r(-8, 8) }
  };
}

/**
 * Парсит формулу кубиков
 */
function parseFormula(formula: string): { groups: Array<{ count: number; sides: number }>; bonus: number } {
  const groups: Array<{ count: number; sides: number }> = [];
  let bonus = 0;
  
  const normalized = formula.toLowerCase().replace(/\s/g, '');
  const tokens = normalized.match(/[+-]?(\d*d\d+|\d+)/g) || [];
  
  for (const token of tokens) {
    const diceMatch = token.match(/([+-]?)(\d*)d(\d+)/);
    if (diceMatch) {
      const sign = diceMatch[1] === '-' ? -1 : 1;
      const count = parseInt(diceMatch[2] || '1', 10) * sign;
      const sides = parseInt(diceMatch[3] ?? '0', 10);
      
      if (sides > 0) {
        // Если это стандартный кубик (d4, d6, d8, d10, d12, d20) — добавляем в groups
        if (DICE_TYPE_MAP[sides]) {
          groups.push({ count: Math.abs(count), sides });
        } else {
          // Нестандартный кубик — бросаем локально и добавляем к бонусу
          for (let i = 0; i < Math.abs(count); i++) {
            bonus += (Math.floor(Math.random() * sides) + 1) * (count < 0 ? -1 : 1);
          }
        }
      }
    } else {
      // Плоский бонус
      const num = parseInt(token, 10);
      if (!isNaN(num)) {
        bonus += num;
      }
    }
  }
  
  return { groups, bonus };
}

/**
 * Удваивает количество кубиков в формуле (для крита)
 */
function doubleDiceInFormula(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_, count, sides) => {
    const c = parseInt(count || '1', 10);
    return `${c * 2}d${sides}`;
  });
}

/**
 * Локальный бросок (fallback)
 */
function localRollDice(formula: string, label?: string): DiceRollResult {
  const { groups, bonus } = parseFormula(formula);
  
  const rolls: number[] = [];
  let rawD20: number | undefined;
  let hasD20 = false;
  
  for (const { count, sides } of groups) {
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      
      if (sides === 20 && !hasD20) {
        rawD20 = roll;
        hasD20 = true;
      }
    }
  }
  
  const diceTotal = rolls.reduce((sum, r) => sum + r, 0);
  const total = diceTotal + bonus;
  
  return {
    formula,
    rolls,
    bonus,
    total,
    isCrit: rawD20 === 20,
    isCritFail: rawD20 === 1,
    rawD20,
    label
  };
}

class DiceService {
  private diceAvailable = false;
  private rollCounter = 0;
  private currentStyle = 'DEFAULT';
  private initialized = false;
  
  /**
   * Инициализация сервиса — проверяем доступность Dice Extension
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const metadata = await OBR.player.getMetadata();
      
      // Проверяем, есть ли ключи Dice Extension в metadata
      this.diceAvailable = METADATA_KEYS.roll in metadata;
      
      // Пытаемся получить текущий стиль кубиков
      const rollData = metadata[METADATA_KEYS.roll] as RollMetadata | null | undefined;
      if (rollData?.dice?.[0]?.style) {
        this.currentStyle = rollData.dice[0].style;
      }
      
      console.log(`[DiceService] Dice Extension ${this.diceAvailable ? 'доступен' : 'не найден'}`);
    } catch (error) {
      console.warn('[DiceService] Ошибка при инициализации:', error);
      this.diceAvailable = false;
    }
    
    this.initialized = true;
  }
  
  /**
   * Получить статус сервиса
   */
  getStatus(): DiceStatus {
    return this.diceAvailable ? 'dice3d' : 'local';
  }
  
  /**
   * Основной метод броска кубиков
   */
  async roll(formula: string, label?: string, unitName?: string): Promise<DiceRollResult> {
    // Если 3D кубики недоступны — используем локальный бросок
    if (!this.diceAvailable) {
      return this.rollLocal(formula, label, unitName);
    }
    
    try {
      return await this.roll3D(formula, label, unitName);
    } catch (error) {
      console.warn('[DiceService] 3D бросок не удался, fallback на локальный:', error);
      return this.rollLocal(formula, label, unitName);
    }
  }
  
  /**
   * Бросок через 3D Dice Extension
   */
  private async roll3D(formula: string, label?: string, unitName?: string): Promise<DiceRollResult> {
    const parsed = parseFormula(formula);
    
    // Если нет стандартных кубиков — используем локальный бросок
    if (parsed.groups.length === 0) {
      return this.rollLocal(formula, label, unitName);
    }
    
    // Создаём конфигурацию для каждого кубика
    const diceConfigs: DiceConfig[] = [];
    const throwsMap: Record<string, ThrowPhysics> = {};
    const valuesMap: Record<string, null> = {};
    const transformsMap: Record<string, null> = {};
    
    for (const group of parsed.groups) {
      for (let i = 0; i < group.count; i++) {
        const id = `ch_${++this.rollCounter}_${Date.now()}`;
        const diceType = DICE_TYPE_MAP[group.sides];
        
        if (diceType) {
          diceConfigs.push({
            id,
            style: this.currentStyle,
            type: diceType
          });
          throwsMap[id] = generateThrowPhysics();
          valuesMap[id] = null;
          transformsMap[id] = null;
        }
      }
    }
    
    if (diceConfigs.length === 0) {
      return this.rollLocal(formula, label, unitName);
    }
    
    // Записываем конфигурацию броска в metadata
    await OBR.player.setMetadata({
      [METADATA_KEYS.roll]: {
        dice: diceConfigs,
        bonus: parsed.bonus,
        hidden: false
      },
      [METADATA_KEYS.throws]: throwsMap,
      [METADATA_KEYS.values]: valuesMap,
      [METADATA_KEYS.transforms]: transformsMap
    });
    
    // Ждём результаты от Dice Extension
    const values = await this.waitForResults(diceConfigs.map(d => d.id));
    
    // Собираем результаты
    const rolls = diceConfigs.map(d => values[d.id] ?? 0);
    const total = rolls.reduce((a, b) => a + b, 0) + parsed.bonus;
    
    // Определяем d20 для крита
    const d20Configs = diceConfigs.filter(d => d.type === 'D20');
    const rawD20 = d20Configs.length > 0 ? (values[d20Configs[0]!.id] ?? undefined) : undefined;
    const isCrit = rawD20 === 20;
    const isCritFail = rawD20 === 1;
    
    // Анонсируем результат
    if (label && unitName) {
      let msg = `⚔ ${unitName}: ${label} — `;
      if (isCrit) msg += '✨КРИТ! ';
      if (isCritFail) msg += '💀ПРОВАЛ! ';
      msg += `[${rolls.join(', ')}]`;
      if (parsed.bonus !== 0) {
        msg += parsed.bonus > 0 ? ` + ${parsed.bonus}` : ` − ${Math.abs(parsed.bonus)}`;
      }
      msg += ` = ${total}`;
      
      try {
        await OBR.notification.show(msg);
      } catch {
        // Notification может не работать
      }
    }
    
    return {
      formula,
      rolls,
      bonus: parsed.bonus,
      total,
      isCrit,
      isCritFail,
      rawD20,
      label
    };
  }
  
  /**
   * Ожидание результатов от Dice Extension
   */
  private waitForResults(ids: string[]): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsub();
        reject(new Error('Dice timeout — кубики не упали за 15 секунд'));
      }, 15000);
      
      const unsub = OBR.player.onChange(async () => {
        try {
          const meta = await OBR.player.getMetadata();
          const vals = meta[METADATA_KEYS.values] as Record<string, number | null> | undefined;
          
          if (!vals) return;
          
          // Проверяем, все ли кубики упали (значения !== null)
          const allReady = ids.every(id => vals[id] != null);
          
          if (allReady) {
            clearTimeout(timeout);
            unsub();
            
            const result: Record<string, number> = {};
            ids.forEach(id => {
              result[id] = vals[id] as number;
            });
            
            resolve(result);
          }
        } catch {
          // Игнорируем ошибки чтения
        }
      });
    });
  }
  
  /**
   * Локальный бросок (fallback)
   */
  private async rollLocal(formula: string, label?: string, unitName?: string): Promise<DiceRollResult> {
    const result = localRollDice(formula, label);
    
    // Анонсируем через notification
    if (label && unitName) {
      let msg = `🎲 ${unitName}: ${label} — [${result.rolls.join(', ')}]`;
      if (result.bonus !== 0) {
        msg += result.bonus > 0 ? ` + ${result.bonus}` : ` − ${Math.abs(result.bonus)}`;
      }
      msg += ` = ${result.total}`;
      if (result.isCrit) msg += ' ✨КРИТ!';
      if (result.isCritFail) msg += ' 💀ПРОВАЛ!';
      
      try {
        await OBR.notification.show(msg);
      } catch {
        // Notification может не работать
      }
    }
    
    return result;
  }
  
  /**
   * Бросок с удвоением при крите
   */
  async rollWithCrit(formula: string, isCrit: boolean, label?: string, unitName?: string): Promise<DiceRollResult> {
    const f = isCrit ? doubleDiceInFormula(formula) : formula;
    const critLabel = label ? `${label}${isCrit ? ' (КРИТ×2)' : ''}` : undefined;
    return this.roll(f, critLabel, unitName);
  }
  
  // === Вспомогательные методы для анонсов ===
  
  async announceHit(unitName: string, weaponName: string, result: DiceRollResult): Promise<void> {
    const hitText = result.total >= 11 || result.isCrit ? '✅' : '❌';
    let msg = `🎯 ${unitName}: ${weaponName} — [${result.rawD20 ?? result.rolls[0]}]`;
    if (result.bonus !== 0) {
      msg += result.bonus > 0 ? ` + ${result.bonus}` : ` − ${Math.abs(result.bonus)}`;
    }
    msg += ` = ${result.total} ${hitText}`;
    if (result.isCrit) msg += ' ✨КРИТ!';
    if (result.isCritFail) msg += ' 💀ПРОВАЛ!';
    
    try {
      await OBR.notification.show(msg);
    } catch { /* ignore */ }
  }
  
  async announceDamage(
    unitName: string,
    damage: number,
    damageTypeName: string,
    rolls: number[],
    bonus: number,
    isCrit: boolean = false
  ): Promise<void> {
    let msg = `💥 ${unitName}: `;
    if (isCrit) msg += '✨КРИТ! ';
    msg += `[${rolls.join(', ')}]`;
    if (bonus !== 0) {
      msg += bonus > 0 ? ` + ${bonus}` : ` − ${Math.abs(bonus)}`;
    }
    msg += ` = ${damage} ${damageTypeName}`;
    
    try {
      await OBR.notification.show(msg);
    } catch { /* ignore */ }
  }
  
  async announceMiss(unitName: string, weaponName: string, result: DiceRollResult): Promise<void> {
    try {
      await OBR.notification.show(
        `❌ ${unitName}: Промах ${weaponName} — [${result.rawD20 ?? result.rolls[0]}] = ${result.total}`
      );
    } catch { /* ignore */ }
  }
  
  async announceSpellCast(unitName: string, spellName: string, success: boolean, result: DiceRollResult): Promise<void> {
    const icon = success ? '✨' : '💨';
    const status = success ? 'успех' : 'провал';
    
    try {
      await OBR.notification.show(
        `${icon} ${unitName}: ${spellName} — [${result.rawD20}] = ${result.total} (${status})`
      );
    } catch { /* ignore */ }
  }
  
  async announceProjectileCount(unitName: string, count: number, rolls?: number[]): Promise<void> {
    let msg = `🎲 ${unitName}: Количество снарядов`;
    if (rolls && rolls.length > 0) {
      msg += ` — [${rolls.join(', ')}]`;
    }
    msg += ` = ${count}`;
    
    try {
      await OBR.notification.show(msg);
    } catch { /* ignore */ }
  }
  
  async announceTakeDamage(unitName: string, damage: number, currentHP: number, maxHP: number): Promise<void> {
    const percent = Math.floor((currentHP / maxHP) * 100);
    const icon = percent < 25 ? '💀' : '💔';
    
    try {
      await OBR.notification.show(`${icon} ${unitName}: −${damage} HP (${currentHP}/${maxHP})`);
    } catch { /* ignore */ }
  }
  
  async announceHealing(unitName: string, amount: number, currentHP: number, maxHP: number): Promise<void> {
    try {
      await OBR.notification.show(`💚 ${unitName}: +${amount} HP (${currentHP}/${maxHP})`);
    } catch { /* ignore */ }
  }
  
  async announceRokCard(
    unitName: string,
    cardIndex: number,
    isHit: boolean,
    effectName: string,
    hitRoll: number,
    effectRoll: number
  ): Promise<void> {
    const hitIcon = isHit ? '🎯' : '💨';
    
    try {
      await OBR.notification.show(
        `🃏 ${unitName}: Карта ${cardIndex} — ${hitIcon} [${hitRoll}] | Эффект [${effectRoll}]: ${effectName}`
      );
    } catch { /* ignore */ }
  }
  
  async showNotification(message: string): Promise<void> {
    try {
      await OBR.notification.show(message);
    } catch { /* ignore */ }
  }
}

// Синглтон
export const diceService = new DiceService();
