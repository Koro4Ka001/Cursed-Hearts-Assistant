/**
 * DiceService — локальные кубики + уведомления для ВСЕХ игроков
 *
 * Механизм:
 * 1. Кубики бросаются локально (Math.random)
 * 2. Результат показывается СЕБЕ через OBR.notification.show()
 * 3. Результат отправляется ДРУГИМ через OBR.broadcast.sendMessage()
 * 4. В App.tsx стоит слушатель OBR.broadcast.onMessage() —
 *    когда другой игрок бросает кубик, вызывается OBR.notification.show()
 *
 * Оба игрока должны иметь расширение ОТКРЫТЫМ, чтобы видеть броски друг друга.
 */

import OBR from "@owlbear-rodeo/sdk";
import type { DiceRollResult } from "../types";

export type DiceStatus = "local";

/** Канал для broadcast */
export const DICE_BROADCAST_CHANNEL = "cursed-hearts/dice-notification";

// ============================================================
// Парсер формул
// ============================================================

interface DiceGroup {
  count: number;
  sides: number;
}

function parseFormula(formula: string): { groups: DiceGroup[]; bonus: number } {
  const groups: DiceGroup[] = [];
  let bonus = 0;

  const normalized = formula.toLowerCase().replace(/\s/g, "");
  const tokens = normalized.match(/[+-]?(\d*d\d+|\d+)/g) || [];

  for (const token of tokens) {
    const diceMatch = token.match(/([+-]?)(\d*)d(\d+)/);
    if (diceMatch) {
      const sign = diceMatch[1] === "-" ? -1 : 1;
      const count = parseInt(diceMatch[2] || "1", 10) * sign;
      const sides = parseInt(diceMatch[3] ?? "0", 10);
      if (sides > 0) {
        groups.push({ count: Math.abs(count), sides });
      }
    } else {
      const num = parseInt(token, 10);
      if (!isNaN(num)) bonus += num;
    }
  }

  return { groups, bonus };
}

function doubleDiceInFormula(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_, count, sides) => {
    const c = parseInt(count || "1", 10);
    return `${c * 2}d${sides}`;
  });
}

// ============================================================
// Локальный бросок
// ============================================================

function localRoll(formula: string, label?: string): DiceRollResult {
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

  const total = rolls.reduce((s, r) => s + r, 0) + bonus;

  return {
    formula,
    rolls,
    bonus,
    total,
    isCrit: rawD20 === 20,
    isCritFail: rawD20 === 1,
    rawD20,
    label,
  };
}

// ============================================================
// Уведомления — СЕБЕ + broadcast ДРУГИМ
// ============================================================

/**
 * Показывает уведомление СЕБЕ и отправляет ДРУГИМ игрокам.
 * OBR.broadcast.sendMessage — отправляет ТОЛЬКО другим (не себе).
 * OBR.notification.show — показывает ТОЛЬКО себе.
 * Вместе — все видят.
 */
async function notifyAll(message: string): Promise<void> {
  // Показать себе
  try {
    await OBR.notification.show(message);
  } catch {
    console.log("[Dice]", message);
  }

  // Отправить другим
  try {
    await OBR.broadcast.sendMessage(DICE_BROADCAST_CHANNEL, { message });
  } catch (error) {
    console.warn("[DiceService] Broadcast failed:", error);
  }
}

// ============================================================
// DiceService
// ============================================================

class DiceService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log(
      "[DiceService] Инициализирован — локальные кубики + broadcast уведомления"
    );
  }

  getStatus(): DiceStatus {
    return "local";
  }

  // ── Основной бросок ──────────────────────────────────────
  async roll(
    formula: string,
    label?: string,
    unitName?: string
  ): Promise<DiceRollResult> {
    const result = localRoll(formula, label);

    if (label && unitName) {
      let msg = `🎲 ${unitName}: ${label} — `;
      if (result.isCrit) msg += "✨КРИТ! ";
      if (result.isCritFail) msg += "💀ПРОВАЛ! ";
      msg += `[${result.rolls.join(", ")}]`;
      if (result.bonus !== 0) {
        msg +=
          result.bonus > 0
            ? ` + ${result.bonus}`
            : ` − ${Math.abs(result.bonus)}`;
      }
      msg += ` = ${result.total}`;
      await notifyAll(msg);
    }

    return result;
  }

  // ── Бросок с удвоением при крите ─────────────────────────
  async rollWithCrit(
    formula: string,
    isCrit: boolean,
    label?: string,
    unitName?: string
  ): Promise<DiceRollResult> {
    const f = isCrit ? doubleDiceInFormula(formula) : formula;
    const critLabel = label
      ? `${label}${isCrit ? " (КРИТ×2)" : ""}`
      : undefined;
    return this.roll(f, critLabel, unitName);
  }

  // ── Анонсы ───────────────────────────────────────────────

  async announceHit(
    unitName: string,
    weaponName: string,
    result: DiceRollResult
  ): Promise<void> {
    const hitText = result.total >= 11 || result.isCrit ? "✅" : "❌";
    let msg = `🎯 ${unitName}: ${weaponName} — [${result.rawD20 ?? result.rolls[0]}]`;
    if (result.bonus !== 0) {
      msg +=
        result.bonus > 0
          ? ` + ${result.bonus}`
          : ` − ${Math.abs(result.bonus)}`;
    }
    msg += ` = ${result.total} ${hitText}`;
    if (result.isCrit) msg += " ✨КРИТ!";
    if (result.isCritFail) msg += " 💀ПРОВАЛ!";
    await notifyAll(msg);
  }

  async announceDamage(
    unitName: string,
    damage: number,
    damageTypeName: string,
    rolls: number[],
    bonus: number,
    isCrit = false
  ): Promise<void> {
    let msg = `💥 ${unitName}: `;
    if (isCrit) msg += "✨КРИТ! ";
    msg += `[${rolls.join(", ")}]`;
    if (bonus !== 0) {
      msg += bonus > 0 ? ` + ${bonus}` : ` − ${Math.abs(bonus)}`;
    }
    msg += ` = ${damage} ${damageTypeName}`;
    await notifyAll(msg);
  }

  async announceMiss(
    unitName: string,
    weaponName: string,
    result: DiceRollResult
  ): Promise<void> {
    await notifyAll(
      `❌ ${unitName}: Промах ${weaponName} — [${result.rawD20 ?? result.rolls[0]}] = ${result.total}`
    );
  }

  async announceSpellCast(
    unitName: string,
    spellName: string,
    success: boolean,
    result: DiceRollResult
  ): Promise<void> {
    const icon = success ? "✨" : "💨";
    const status = success ? "успех" : "провал";
    await notifyAll(
      `${icon} ${unitName}: ${spellName} — [${result.rawD20}] = ${result.total} (${status})`
    );
  }

  async announceProjectileCount(
    unitName: string,
    count: number,
    rolls?: number[]
  ): Promise<void> {
    let msg = `🎲 ${unitName}: Количество снарядов`;
    if (rolls && rolls.length > 0) msg += ` — [${rolls.join(", ")}]`;
    msg += ` = ${count}`;
    await notifyAll(msg);
  }

  async announceTakeDamage(
    unitName: string,
    damage: number,
    currentHP: number,
    maxHP: number
  ): Promise<void> {
    const percent = Math.floor((currentHP / maxHP) * 100);
    const icon = percent < 25 ? "💀" : "💔";
    await notifyAll(
      `${icon} ${unitName}: −${damage} HP (${currentHP}/${maxHP})`
    );
  }

  async announceHealing(
    unitName: string,
    amount: number,
    currentHP: number,
    maxHP: number
  ): Promise<void> {
    await notifyAll(
      `💚 ${unitName}: +${amount} HP (${currentHP}/${maxHP})`
    );
  }

  async announceRokCard(
    unitName: string,
    cardIndex: number,
    isHit: boolean,
    effectName: string,
    hitRoll: number,
    effectRoll: number
  ): Promise<void> {
    const hitIcon = isHit ? "🎯" : "💨";
    await notifyAll(
      `🃏 ${unitName}: Карта ${cardIndex} — ${hitIcon} [${hitRoll}] | Эффект [${effectRoll}]: ${effectName}`
    );
  }

  async showNotification(message: string): Promise<void> {
    await notifyAll(message);
  }
}

export const diceService = new DiceService();
