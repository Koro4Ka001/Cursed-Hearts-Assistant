import OBR from "@owlbear-rodeo/sdk";
import type { DiceRollResult } from "../types";
import { pushBroadcast, type BroadcastMessage } from "../components/BroadcastOverlay";

export type DiceStatus = "local";
export const DICE_BROADCAST_CHANNEL = "cursed-hearts/dice-rich";

// ── Парсер ──

interface DG { count: number; sides: number; }

function parseFormula(f: string): { groups: DG[]; bonus: number } {
  const groups: DG[] = [];
  let bonus = 0;
  const tokens = f.toLowerCase().replace(/\s/g, "").match(/[+-]?(\d*d\d+|\d+)/g) || [];
  for (const t of tokens) {
    const m = t.match(/([+-]?)(\d*)d(\d+)/);
    if (m) {
      const s = m[1] === "-" ? -1 : 1;
      groups.push({ count: Math.abs(parseInt(m[2] || "1", 10) * s), sides: parseInt(m[3]!, 10) });
    } else { const n = parseInt(t, 10); if (!isNaN(n)) bonus += n; }
  }
  return { groups, bonus };
}

function doubleDice(f: string): string {
  return f.replace(/(\d*)d(\d+)/gi, (_, c, s) => `${parseInt(c || "1", 10) * 2}d${s}`);
}

function localRoll(formula: string, label?: string): DiceRollResult {
  const { groups, bonus } = parseFormula(formula);
  const rolls: number[] = [];
  let rawD20: number | undefined;
  let has = false;
  for (const { count, sides } of groups) {
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      if (sides === 20 && !has) { rawD20 = r; has = true; }
    }
  }
  const total = rolls.reduce((s, r) => s + r, 0) + bonus;
  return { formula, rolls, bonus, total, isCrit: rawD20 === 20, isCritFail: rawD20 === 1, rawD20, label };
}

let _idCounter = 0;
function msgId(): string { return `bc-${Date.now()}-${++_idCounter}`; }

// ── Отправка ВСЕМ (себе + другим) ──

function showLocally(msg: BroadcastMessage) {
  pushBroadcast(msg);
}

async function sendToOthers(msg: BroadcastMessage) {
  try {
    await OBR.broadcast.sendMessage(DICE_BROADCAST_CHANNEL, msg);
  } catch {}
  // Фоллбэк — OBR нативное уведомление для тех у кого расширение закрыто
  try {
    const fallback = `${msg.icon ?? '🎲'} ${msg.unitName}: ${msg.title}${msg.total !== undefined ? ` = ${msg.total}` : ''}`;
    await OBR.notification.show(fallback);
  } catch {}
}

async function broadcast(msg: BroadcastMessage) {
  showLocally(msg);
  await sendToOthers(msg);
}

// ══════════════════════════════════════════════════════════

class DiceService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log("[DiceService] Ready");
  }

  getStatus(): DiceStatus { return "local"; }

  // ── Основной бросок ──

  async roll(formula: string, label?: string, unitName?: string): Promise<DiceRollResult> {
    const r = localRoll(formula, label);
    if (label && unitName) {
      await broadcast({
        id: msgId(), type: 'roll', unitName,
        title: label, icon: '🎲',
        rolls: r.rolls, total: r.total,
        isCrit: r.isCrit, isCritFail: r.isCritFail,
        color: r.isCrit ? 'gold' : r.isCritFail ? 'blood' : 'white',
        timestamp: Date.now()
      });
    }
    return r;
  }

  async rollWithCrit(formula: string, isCrit: boolean, label?: string, unitName?: string): Promise<DiceRollResult> {
    const f = isCrit ? doubleDice(formula) : formula;
    return this.roll(f, label ? `${label}${isCrit ? ' ×2' : ''}` : undefined, unitName);
  }

  // ── Специальные анонсы ──

  async announceHit(unitName: string, weaponName: string, result: DiceRollResult): Promise<void> {
    const hit = result.total >= 11 || result.isCrit;
    await broadcast({
      id: msgId(), type: hit ? 'hit' : 'miss', unitName,
      title: `${weaponName} — ${hit ? 'Попадание!' : 'Промах'}`,
      icon: hit ? '🎯' : '💨',
      rolls: result.rolls, total: result.total,
      isCrit: result.isCrit, isCritFail: result.isCritFail,
      color: result.isCrit ? 'gold' : hit ? 'green' : 'blood',
      timestamp: Date.now()
    });
  }

  async announceDamage(unitName: string, damage: number, typeName: string, rolls: number[], bonus: number, isCrit = false): Promise<void> {
    await broadcast({
      id: msgId(), type: 'damage', unitName,
      title: `${damage} ${typeName}`,
      subtitle: isCrit ? 'Критический урон!' : undefined,
      icon: '💥', rolls, total: damage,
      isCrit, color: 'blood',
      timestamp: Date.now()
    });
  }

  async announceMiss(unitName: string, weaponName: string, result: DiceRollResult): Promise<void> {
    await broadcast({
      id: msgId(), type: 'miss', unitName,
      title: `Промах — ${weaponName}`,
      icon: '💨', rolls: result.rolls, total: result.total,
      isCritFail: result.isCritFail,
      color: result.isCritFail ? 'blood' : 'white',
      timestamp: Date.now()
    });
  }

  async announceSpellCast(unitName: string, spellName: string, success: boolean, result: DiceRollResult): Promise<void> {
    await broadcast({
      id: msgId(), type: 'spell', unitName,
      title: `${spellName} — ${success ? 'Успех!' : 'Провал'}`,
      icon: success ? '✨' : '💨',
      rolls: result.rolls, total: result.total,
      isCrit: result.isCrit, isCritFail: result.isCritFail,
      color: success ? 'purple' : 'white',
      timestamp: Date.now()
    });
  }

  async announceProjectileCount(unitName: string, count: number, rolls?: number[]): Promise<void> {
    await broadcast({
      id: msgId(), type: 'spell', unitName,
      title: `Снаряды: ${count}`,
      icon: '🔮', rolls, total: count,
      color: 'mana',
      timestamp: Date.now()
    });
  }

  async announceTakeDamage(unitName: string, damage: number, currentHP: number, maxHP: number): Promise<void> {
    const dead = currentHP <= 0;
    await broadcast({
      id: msgId(), type: dead ? 'death' : 'damage', unitName,
      title: `−${damage} HP`,
      subtitle: dead ? '☠️ ПАЛИ В БОЮ' : undefined,
      icon: dead ? '💀' : '💔',
      color: 'blood',
      hpBar: { current: Math.max(0, currentHP), max: maxHP },
      timestamp: Date.now()
    });
  }

  async announceHealing(unitName: string, amount: number, currentHP: number, maxHP: number): Promise<void> {
    await broadcast({
      id: msgId(), type: 'heal', unitName,
      title: `+${amount} HP`,
      icon: '💚', color: 'green',
      hpBar: { current: currentHP, max: maxHP },
      timestamp: Date.now()
    });
  }

  async announceRokCard(unitName: string, cardIdx: number, isHit: boolean, effectName: string, hitRoll: number, effectRoll: number): Promise<void> {
    await broadcast({
      id: msgId(), type: 'rok-card', unitName,
      title: `Карта Рока #${cardIdx}`,
      icon: '🃏',
      color: isHit ? 'purple' : 'white',
      details: [
        `${isHit ? '🎯 Попадание' : '💨 Промах'} [${hitRoll}]`,
        `⟐ Эффект [${effectRoll}]: ${effectName}`
      ],
      timestamp: Date.now()
    });
  }

  async showNotification(message: string): Promise<void> {
    await broadcast({
      id: msgId(), type: 'custom', unitName: '',
      title: message, icon: '📢', color: 'gold',
      timestamp: Date.now()
    });
  }
}

export const diceService = new DiceService();
