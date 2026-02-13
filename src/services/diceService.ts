import OBR from "@owlbear-rodeo/sdk";
import type { DiceRollResult } from "../types";

export type DiceStatus = "local";
export const DICE_BROADCAST_CHANNEL = "cursed-hearts/dice-notification";

interface DiceGroup { count: number; sides: number; }

function parseFormula(formula: string): { groups: DiceGroup[]; bonus: number } {
  const groups: DiceGroup[] = [];
  let bonus = 0;
  const tokens = formula.toLowerCase().replace(/\s/g, "").match(/[+-]?(\d*d\d+|\d+)/g) || [];
  for (const token of tokens) {
    const m = token.match(/([+-]?)(\d*)d(\d+)/);
    if (m) {
      const sign = m[1] === "-" ? -1 : 1;
      const count = parseInt(m[2] || "1", 10) * sign;
      const sides = parseInt(m[3] ?? "0", 10);
      if (sides > 0) groups.push({ count: Math.abs(count), sides });
    } else {
      const n = parseInt(token, 10);
      if (!isNaN(n)) bonus += n;
    }
  }
  return { groups, bonus };
}

function doubleDiceInFormula(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_, c, s) => `${parseInt(c || "1", 10) * 2}d${s}`);
}

function localRoll(formula: string, label?: string): DiceRollResult {
  const { groups, bonus } = parseFormula(formula);
  const rolls: number[] = [];
  let rawD20: number | undefined;
  let hasD20 = false;
  for (const { count, sides } of groups) {
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      if (sides === 20 && !hasD20) { rawD20 = roll; hasD20 = true; }
    }
  }
  const total = rolls.reduce((s, r) => s + r, 0) + bonus;
  return { formula, rolls, bonus, total, isCrit: rawD20 === 20, isCritFail: rawD20 === 1, rawD20, label };
}

// ── Красивое форматирование уведомлений ──

function formatBonus(bonus: number): string {
  if (bonus === 0) return '';
  return bonus > 0 ? ` + ${bonus}` : ` − ${Math.abs(bonus)}`;
}

function critBanner(isCrit: boolean, isFail: boolean): string {
  if (isCrit) return ' ══✨ КРИТ! ✨══';
  if (isFail) return ' ══💀 ПРОВАЛ! 💀══';
  return '';
}

async function notifyAll(message: string): Promise<void> {
  try { await OBR.notification.show(message); } catch { console.log("[Dice]", message); }
  try { await OBR.broadcast.sendMessage(DICE_BROADCAST_CHANNEL, { message }); } catch {}
}

class DiceService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log("[DiceService] Ready — local dice + broadcast");
  }

  getStatus(): DiceStatus { return "local"; }

  async roll(formula: string, label?: string, unitName?: string): Promise<DiceRollResult> {
    const r = localRoll(formula, label);
    if (label && unitName) {
      const crit = critBanner(r.isCrit, r.isCritFail);
      const msg = `🎲 ${unitName} ║ ${label}${crit}\n⟐ [${r.rolls.join(", ")}]${formatBonus(r.bonus)} = ${r.total}`;
      await notifyAll(msg);
    }
    return r;
  }

  async rollWithCrit(formula: string, isCrit: boolean, label?: string, unitName?: string): Promise<DiceRollResult> {
    const f = isCrit ? doubleDiceInFormula(formula) : formula;
    return this.roll(f, label ? `${label}${isCrit ? ' ×2' : ''}` : undefined, unitName);
  }

  // ── Анонсы ───────────────────────────────────────────

  async announceHit(unitName: string, weaponName: string, result: DiceRollResult): Promise<void> {
    const hit = result.total >= 11 || result.isCrit;
    const icon = hit ? '🎯' : '❌';
    const crit = critBanner(result.isCrit, result.isCritFail);
    await notifyAll(`${icon} ${unitName} ║ ${weaponName}${crit}\n⟐ [${result.rawD20 ?? result.rolls[0]}]${formatBonus(result.bonus)} = ${result.total}`);
  }

  async announceDamage(unitName: string, damage: number, typeName: string, rolls: number[], bonus: number, isCrit = false): Promise<void> {
    const crit = isCrit ? ' ══✨ КРИТ! ✨══' : '';
    await notifyAll(`💥 ${unitName} ║ Урон${crit}\n⟐ [${rolls.join(", ")}]${formatBonus(bonus)} = ${damage} ${typeName}`);
  }

  async announceMiss(unitName: string, weaponName: string, result: DiceRollResult): Promise<void> {
    await notifyAll(`💨 ${unitName} ║ Промах (${weaponName})\n⟐ [${result.rawD20 ?? result.rolls[0]}] = ${result.total}`);
  }

  async announceSpellCast(unitName: string, spellName: string, success: boolean, result: DiceRollResult): Promise<void> {
    const icon = success ? '✨' : '💨';
    const status = success ? 'УСПЕХ' : 'провал';
    await notifyAll(`${icon} ${unitName} ║ ${spellName} — ${status}\n⟐ [${result.rawD20}] = ${result.total}`);
  }

  async announceProjectileCount(unitName: string, count: number, rolls?: number[]): Promise<void> {
    const r = rolls?.length ? ` [${rolls.join(", ")}]` : '';
    await notifyAll(`🔮 ${unitName} ║ Снаряды${r} = ${count}`);
  }

  async announceTakeDamage(unitName: string, damage: number, currentHP: number, maxHP: number): Promise<void> {
    const pct = Math.floor((currentHP / maxHP) * 100);
    const bar = pct > 60 ? '🟩' : pct > 25 ? '🟨' : '🟥';
    const icon = currentHP <= 0 ? '💀' : '💔';
    await notifyAll(`${icon} ${unitName} ║ −${damage} HP\n${bar} ${currentHP}/${maxHP} (${pct}%)`);
  }

  async announceHealing(unitName: string, amount: number, currentHP: number, maxHP: number): Promise<void> {
    const pct = Math.floor((currentHP / maxHP) * 100);
    await notifyAll(`💚 ${unitName} ║ +${amount} HP\n🟩 ${currentHP}/${maxHP} (${pct}%)`);
  }

  async announceRokCard(unitName: string, cardIdx: number, isHit: boolean, effectName: string, hitRoll: number, effectRoll: number): Promise<void> {
    const hitIcon = isHit ? '🎯 Попадание' : '💨 Промах';
    const border = '═══════════════';
    await notifyAll(`🃏 ${unitName} ║ Карта Рока #${cardIdx}\n${border}\n${hitIcon} [${hitRoll}]\n⟐ Эффект [${effectRoll}]: ${effectName}\n${border}`);
  }

  async showNotification(message: string): Promise<void> {
    await notifyAll(message);
  }
}

export const diceService = new DiceService();
