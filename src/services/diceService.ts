import OBR from '@owlbear-rodeo/sdk';
import { rollDice } from '../utils/dice';
import type { DiceRollResult } from '../types';

// Каналы для broadcast к Dice Extension
const DICE_CHANNELS = [
  'rodeo.owlbear.dice/roll',
  'com.owlbear.dice/roll',
  'dice-roller/roll',
  'owlbear-dice/roll'
];

export type DiceStatus = 'dice3d' | 'broadcast' | 'notification';

class DiceService {
  private diceChannel: string | null = null;
  private hasDiceAPI: boolean = false;
  private initialized: boolean = false;
  private status: DiceStatus = 'notification';
  
  /**
   * Инициализация сервиса — проверка доступных методов
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Уровень 1: Проверяем OBR.dice API (если существует)
      // @ts-expect-error — OBR.dice может не существовать в типах
      if (typeof OBR.dice !== 'undefined' && typeof OBR.dice.roll === 'function') {
        this.hasDiceAPI = true;
        this.status = 'dice3d';
        console.log('[DiceService] OBR.dice API доступен');
        this.initialized = true;
        return;
      }
    } catch {
      // OBR.dice не существует
    }
    
    // Уровень 2: Проверяем broadcast каналы
    for (const channel of DICE_CHANNELS) {
      try {
        // Пробуем отправить тестовое сообщение
        await OBR.broadcast.sendMessage(channel, { test: true });
        this.diceChannel = channel;
        this.status = 'broadcast';
        console.log(`[DiceService] Broadcast канал найден: ${channel}`);
        this.initialized = true;
        return;
      } catch {
        // Канал не работает, пробуем следующий
      }
    }
    
    // Уровень 3: Fallback на notifications
    this.status = 'notification';
    console.log('[DiceService] Fallback на OBR notifications');
    this.initialized = true;
  }
  
  /**
   * Получить текущий статус сервиса
   */
  getStatus(): DiceStatus {
    return this.status;
  }
  
  /**
   * Основной метод броска кубиков
   * Всегда считает результат локально, параллельно показывает визуально
   */
  async roll(formula: string, label: string, unitName: string): Promise<DiceRollResult> {
    // 1. Всегда считаем результат ЛОКАЛЬНО
    const localResult = rollDice(formula, label);
    
    // 2. Параллельно показываем визуально через лучший доступный метод
    await this.showDiceVisual(formula, label, unitName, localResult);
    
    // 3. Возвращаем локальный результат
    return localResult;
  }
  
  /**
   * Показать визуальное представление броска
   */
  private async showDiceVisual(
    formula: string,
    label: string,
    unitName: string,
    result: DiceRollResult
  ): Promise<void> {
    try {
      if (this.hasDiceAPI) {
        await this.showViaDiceAPI(formula, label, unitName);
      } else if (this.diceChannel) {
        await this.showViaBroadcast(formula, label, unitName);
      } else {
        await this.showViaNotification(label, unitName, result);
      }
    } catch (error) {
      console.error('[DiceService] Ошибка показа кубиков:', error);
      // Fallback на notification
      await this.showViaNotification(label, unitName, result);
    }
  }
  
  /**
   * Показать через OBR.dice API
   */
  private async showViaDiceAPI(
    formula: string,
    label: string,
    unitName: string
  ): Promise<void> {
    try {
      // @ts-expect-error — OBR.dice может не существовать в типах
      await OBR.dice.roll({
        formula,
        label: `${unitName}: ${label}`
      });
    } catch (error) {
      console.error('[DiceService] OBR.dice.roll ошибка:', error);
      throw error;
    }
  }
  
  /**
   * Показать через broadcast к Dice Extension
   */
  private async showViaBroadcast(
    formula: string,
    label: string,
    unitName: string
  ): Promise<void> {
    if (!this.diceChannel) throw new Error('No dice channel');
    
    await OBR.broadcast.sendMessage(this.diceChannel, {
      formula,
      notation: formula,
      label: `${unitName}: ${label}`,
      rolls: this.parseFormulaForBroadcast(formula)
    });
  }
  
  /**
   * Fallback — показать через OBR notification
   */
  private async showViaNotification(
    label: string,
    unitName: string,
    result: DiceRollResult
  ): Promise<void> {
    let message = `🎲 ${unitName}: ${label} — `;
    
    if (result.isCrit) {
      message += '✨ КРИТ! ';
    } else if (result.isCritFail) {
      message += '💀 ПРОВАЛ! ';
    }
    
    message += `[${result.rolls.join(', ')}]`;
    
    if (result.bonus !== 0) {
      message += result.bonus > 0 ? ` + ${result.bonus}` : ` − ${Math.abs(result.bonus)}`;
    }
    
    message += ` = ${result.total}`;
    
    await OBR.notification.show(message);
  }
  
  /**
   * Парсинг формулы для broadcast формата
   */
  private parseFormulaForBroadcast(formula: string): Array<{ dice: string; count: number; modifier?: number }> {
    const result: Array<{ dice: string; count: number; modifier?: number }> = [];
    
    const normalized = formula.toLowerCase().replace(/\s/g, '');
    const parts = normalized.split(/(?=[+-])/);
    
    let modifier = 0;
    
    for (const part of parts) {
      const trimmed = part.replace(/^\+/, '');
      
      if (trimmed.includes('d')) {
        const match = trimmed.match(/^(-?\d*)d(\d+)$/);
        if (match) {
          const countStr = match[1];
          const sides = match[2];
          let count = 1;
          
          if (countStr === '-') {
            count = -1;
          } else if (countStr && countStr !== '') {
            count = parseInt(countStr, 10);
          }
          
          result.push({ dice: `d${sides}`, count });
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) {
          modifier += num;
        }
      }
    }
    
    // Добавляем модификатор к последнему элементу
    if (modifier !== 0 && result.length > 0) {
      result[result.length - 1]!.modifier = modifier;
    }
    
    return result;
  }
  
  /**
   * Простой анонс попадания
   */
  async announceHit(
    unitName: string,
    weaponName: string,
    result: DiceRollResult
  ): Promise<void> {
    const hitText = result.total >= 11 || result.isCrit ? '✅' : '❌';
    let message = `🎯 ${unitName}: ${weaponName} — [${result.rawD20 ?? result.rolls[0]}]`;
    
    if (result.bonus !== 0) {
      message += result.bonus > 0 ? ` + ${result.bonus}` : ` − ${Math.abs(result.bonus)}`;
    }
    
    message += ` = ${result.total} ${hitText}`;
    
    if (result.isCrit) message += ' ✨ КРИТ!';
    if (result.isCritFail) message += ' 💀 ПРОВАЛ!';
    
    await OBR.notification.show(message);
  }
  
  /**
   * Анонс урона
   */
  async announceDamage(
    unitName: string,
    damage: number,
    damageTypeName: string,
    rolls: number[],
    bonus: number,
    isCrit: boolean = false
  ): Promise<void> {
    let message = `💥 ${unitName}: `;
    if (isCrit) message += '✨ КРИТ! ';
    message += `[${rolls.join(', ')}]`;
    if (bonus !== 0) {
      message += bonus > 0 ? ` + ${bonus}` : ` − ${Math.abs(bonus)}`;
    }
    message += ` = ${damage} ${damageTypeName}`;
    
    await OBR.notification.show(message);
  }
  
  /**
   * Анонс промаха
   */
  async announceMiss(
    unitName: string,
    weaponName: string,
    result: DiceRollResult
  ): Promise<void> {
    await OBR.notification.show(
      `❌ ${unitName}: Промах ${weaponName} — [${result.rawD20 ?? result.rolls[0]}] = ${result.total}`
    );
  }
  
  /**
   * Анонс каста заклинания
   */
  async announceSpellCast(
    unitName: string,
    spellName: string,
    success: boolean,
    result: DiceRollResult
  ): Promise<void> {
    const icon = success ? '✨' : '💨';
    const status = success ? 'успех' : 'провал';
    
    await OBR.notification.show(
      `${icon} ${unitName}: ${spellName} — [${result.rawD20}] = ${result.total} (${status})`
    );
  }
  
  /**
   * Анонс количества снарядов
   */
  async announceProjectileCount(
    unitName: string,
    count: number,
    rolls?: number[]
  ): Promise<void> {
    let message = `🎲 ${unitName}: Количество снарядов`;
    if (rolls && rolls.length > 0) {
      message += ` — [${rolls.join(', ')}]`;
    }
    message += ` = ${count}`;
    
    await OBR.notification.show(message);
  }
  
  /**
   * Анонс получения урона
   */
  async announceTakeDamage(
    unitName: string,
    damage: number,
    currentHP: number,
    maxHP: number
  ): Promise<void> {
    const percent = Math.floor((currentHP / maxHP) * 100);
    const icon = percent < 25 ? '💀' : '💔';
    
    await OBR.notification.show(
      `${icon} ${unitName}: −${damage} HP (${currentHP}/${maxHP})`
    );
  }
  
  /**
   * Анонс исцеления
   */
  async announceHealing(
    unitName: string,
    amount: number,
    currentHP: number,
    maxHP: number
  ): Promise<void> {
    await OBR.notification.show(
      `💚 ${unitName}: +${amount} HP (${currentHP}/${maxHP})`
    );
  }
  
  /**
   * Анонс карты Рока
   */
  async announceRokCard(
    unitName: string,
    cardIndex: number,
    isHit: boolean,
    effectName: string,
    hitRoll: number,
    effectRoll: number
  ): Promise<void> {
    const hitIcon = isHit ? '🎯' : '💨';
    
    await OBR.notification.show(
      `🃏 ${unitName}: Карта ${cardIndex} — ${hitIcon} [${hitRoll}] | Эффект [${effectRoll}]: ${effectName}`
    );
  }
  
  /**
   * Общее уведомление
   */
  async showNotification(message: string): Promise<void> {
    await OBR.notification.show(message);
  }
}

// Синглтон
export const diceService = new DiceService();
