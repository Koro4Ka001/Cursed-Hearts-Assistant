import OBR from '@owlbear-rodeo/sdk';
import type { DiceRollResult } from '../types';
import { rollDice, formatRollResult } from '../utils/dice';

let isOBRReady = false;

/**
 * Инициализация Owlbear Rodeo SDK
 */
export function initOBR(): Promise<void> {
  return new Promise((resolve) => {
    OBR.onReady(() => {
      isOBRReady = true;
      resolve();
    });
  });
}

/**
 * Проверка готовности OBR
 */
export function isOBRConnected(): boolean {
  return isOBRReady;
}

/**
 * Показать уведомление всем игрокам
 */
export async function showNotification(message: string): Promise<void> {
  if (!isOBRReady) {
    console.log('[OBR Notification]:', message);
    return;
  }
  
  try {
    await OBR.notification.show(message);
  } catch (error) {
    console.error('Failed to show OBR notification:', error);
  }
}

/**
 * Бросить кубики и показать результат всем игрокам
 */
export async function rollAndAnnounce(
  formula: string,
  label: string,
  unitName: string
): Promise<DiceRollResult> {
  const result = rollDice(formula, label);
  
  // Формируем сообщение
  let message = `🎲 ${unitName}: ${label} — `;
  message += formatRollResult(result);
  
  // Показываем всем через OBR
  await showNotification(message);
  
  return result;
}

/**
 * Анонсировать попадание
 */
export async function announceHit(
  unitName: string,
  weaponName: string,
  result: DiceRollResult
): Promise<void> {
  const status = result.isCrit 
    ? '✨ КРИТ!' 
    : result.isCritFail 
      ? '💀 ПРОВАЛ!' 
      : result.total >= 11 
        ? '✅' 
        : '❌';
  
  const message = `🎯 ${unitName}: ${weaponName} — [${result.rawD20 ?? result.rolls[0]}] + ${result.bonus} = ${result.total} ${status}`;
  
  await showNotification(message);
}

/**
 * Анонсировать урон
 */
export async function announceDamage(
  unitName: string,
  damage: number,
  damageType: string,
  rolls: number[],
  bonus: number,
  isCrit: boolean = false
): Promise<void> {
  const critText = isCrit ? '✨ КРИТ! ' : '';
  const message = `💥 ${unitName}: ${critText}Урон — [${rolls.join(', ')}] + ${bonus} = ${damage} ${damageType}`;
  
  await showNotification(message);
}

/**
 * Анонсировать каст заклинания
 */
export async function announceSpellCast(
  unitName: string,
  spellName: string,
  success: boolean,
  rollResult: DiceRollResult
): Promise<void> {
  const status = success ? '✅ Успех!' : '❌ Провал!';
  const message = `✨ ${unitName}: ${spellName} — [${rollResult.rawD20 ?? rollResult.rolls[0]}] + ${rollResult.bonus} = ${rollResult.total} ${status}`;
  
  await showNotification(message);
}

/**
 * Анонсировать промах
 */
export async function announceMiss(
  unitName: string,
  attackName: string,
  result: DiceRollResult
): Promise<void> {
  const message = `❌ ${unitName}: Промах (${attackName}) — [${result.rawD20 ?? result.rolls[0]}] + ${result.bonus} = ${result.total}`;
  
  await showNotification(message);
}

/**
 * Анонсировать получение урона
 */
export async function announceTakeDamage(
  unitName: string,
  damage: number,
  newHP: number,
  maxHP: number
): Promise<void> {
  const message = `🩸 ${unitName} получает ${damage} урона! HP: ${newHP}/${maxHP}`;
  
  await showNotification(message);
}

/**
 * Анонсировать исцеление
 */
export async function announceHealing(
  unitName: string,
  healing: number,
  newHP: number,
  maxHP: number
): Promise<void> {
  const message = `💚 ${unitName} исцелён на ${healing}! HP: ${newHP}/${maxHP}`;
  
  await showNotification(message);
}

/**
 * Анонсировать использование маны
 */
export async function announceManaSpent(
  unitName: string,
  amount: number,
  newMana: number,
  maxMana: number
): Promise<void> {
  const message = `💠 ${unitName} тратит ${amount} маны. Мана: ${newMana}/${maxMana}`;
  
  await showNotification(message);
}

/**
 * Анонсировать бросок карты Рока
 */
export async function announceRokCard(
  unitName: string,
  cardNumber: number,
  isHit: boolean,
  effectName: string,
  hitRoll: number,
  effectRoll: number
): Promise<void> {
  const hitStatus = isHit ? '🎯 Попала!' : '💨 Промах';
  const message = `🃏 ${unitName}: Карта ${cardNumber} — [${hitRoll}] ${hitStatus} | Эффект [${effectRoll}]: ${effectName}`;
  
  await showNotification(message);
}

/**
 * Получить текущее выделение игрока
 */
export async function getPlayerSelection(): Promise<string[]> {
  if (!isOBRReady) return [];
  
  try {
    const selection = await OBR.player.getSelection();
    return selection ?? [];
  } catch (error) {
    console.error('Failed to get player selection:', error);
    return [];
  }
}

/**
 * Подписка на изменение выделения
 */
export function onSelectionChange(callback: (selection: string[]) => void): () => void {
  if (!isOBRReady) return () => {};
  
  return OBR.player.onChange((player) => {
    callback(player.selection ?? []);
  });
}

/**
 * Выбор токена на карте (ждём клика пользователя)
 */
export async function selectToken(): Promise<string | null> {
  if (!isOBRReady) {
    console.warn('OBR not ready, cannot select token');
    return null;
  }
  
  await showNotification('🎯 Кликните на токен на карте...');
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsub();
      showNotification('⏰ Время выбора токена истекло');
      resolve(null);
    }, 30000);
    
    const unsub = OBR.player.onChange((player) => {
      if (player.selection && player.selection.length > 0) {
        clearTimeout(timeout);
        unsub();
        const tokenId = player.selection[0];
        if (tokenId) {
          showNotification(`✅ Токен выбран: ${tokenId.substring(0, 8)}...`);
          resolve(tokenId);
        } else {
          resolve(null);
        }
      }
    });
  });
}

/**
 * Получить информацию о сцене
 */
export async function getSceneMetadata(): Promise<Record<string, unknown>> {
  if (!isOBRReady) return {};
  
  try {
    const metadata = await OBR.scene.getMetadata();
    return metadata;
  } catch (error) {
    console.error('Failed to get scene metadata:', error);
    return {};
  }
}
