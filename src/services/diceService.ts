// src/services/diceService.ts
import OBR from "@owlbear-rodeo/sdk";
import type { DiceRollResult, RollModifier } from "../types";
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
    } else {
      const n = parseInt(t, 10);
      if (!isNaN(n)) bonus += n;
    }
  }
  return { groups, bonus };
}

function doubleDice(f: string): string {
  return f.replace(/(\d*)d(\d+)/gi, (_, c, s) => `${parseInt(c || "1", 10) * 2}d${s}`);
}

/**
 * Бросает d20 с модификатором (преимущество/помеха)
 */
function rollD20WithModifier(modifier: RollModifier): { value: number; allRolls: number[] } {
  const roll1 = Math.floor(Math.random() * 20) + 1;
  
  if (modifier === 'normal') {
    return { value: roll1, allRolls: [roll1] };
  }
  
  const roll2 = Math.floor(Math.random() * 20) + 1;
  const allRolls = [roll1, roll2];
  
  if (modifier === 'advantage') {
    return { value: Math.max(roll1, roll2), allRolls };
  } else {
    return { value: Math.min(roll1, roll2), allRolls };
  }
}

/**
 * Локальный бросок с поддержкой модификатора
 * @param checkForCrits - если false, не проверяем крит/крит-провал (для бросков урона)
 */
function localRoll(
  formula: string,
  label?: string,
  modifier: RollModifier = 'normal',
  checkForCrits: boolean = true
): DiceRollResult {
  const { groups, bonus } = parseFormula(formula);
  const rolls: number[] = [];
  let rawD20: number | undefined;
  let allD20Rolls: number[] | undefined;
  let hasD20 = false;
  
  for (const { count, sides } of groups) {
    for (let i = 0; i < count; i++) {
      // Первый d20 учитывает модификатор (преимущество/помеха)
      if (sides === 20 && !hasD20 && modifier !== 'normal') {
        const { value, allRolls } = rollD20WithModifier(modifier);
        rolls.push(value);
        rawD20 = value;
        allD20Rolls = allRolls;
        hasD20 = true;
      } else {
        const r = Math.floor(Math.random() * sides) + 1;
        rolls.push(r);
        if (sides === 20 && !hasD20) {
          rawD20 = r;
          hasD20 = true;
        }
      }
    }
  }
  
  const total = rolls.reduce((s, r) => s + r, 0) + bonus;
  
  // Крит только если checkForCrits=true И есть d20
  const isCrit = checkForCrits && rawD20 === 20;
  const isCritFail = checkForCrits && rawD20 === 1;
  
  return {
    formula,
    rolls,
    bonus,
    total,
    isCrit,
    isCritFail,
    rawD20: checkForCrits ? rawD20 : undefined,
    label,
    rollModifier: modifier !== 'normal' ? modifier : undefined,
    allD20Rolls
  };
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

  // ── Основной бросок (для d20 попаданий/кастов) ──

  async roll(
    formula: string,
    label?: string,
    unitName?: string,
    modifier: RollModifier = 'normal'
  ): Promise<DiceRollResult> {
    const r = localRoll(formula, label, modifier, true);
    
    if (label && unitName) {
      // Формируем subtitle для преимущества/помехи
      let subtitle: string | undefined;
      if (r.allD20Rolls && r.allD20Rolls.length > 1) {
        const modName = modifier === 'advantage' ? 'Преимущество' : 'Помеха';
        subtitle = `${modName}: [${r.allD20Rolls.join(', ')}] → ${r.rawD20}`;
      }
      
      await broadcast({
        id: msgId(),
        type: 'roll',
        unitName,
        title: label,
        subtitle,
        icon: modifier === 'advantage' ? '🎯' : modifier === 'disadvantage' ? '💨' : '🎲',
        rolls: r.rolls,
        total: r.total,
        isCrit: r.isCrit,
        isCritFail: r.isCritFail,
        color: r.isCrit ? 'gold' : r.isCritFail ? 'blood' : 'white',
        timestamp: Date.now()
      });
    }
    return r;
  }

  // ── Бросок урона (БЕЗ проверки крита) ──

  async rollDamage(
    formula: string,
    label?: string,
    unitName?: string,
    isCritHit: boolean = false
  ): Promise<DiceRollResult> {
    // При крите удваиваем кубики
    const f = isCritHit ? doubleDice(formula) : formula;
    const r = localRoll(f, label, 'normal', false); // checkForCrits = false!
    
    if (label && unitName) {
      await broadcast({
        id: msgId(),
        type: 'damage',
        unitName,
        title: label + (isCritHit ? ' ×2' : ''),
        subtitle: isCritHit ? '✨ Критический удар!' : undefined,
        icon: '💥',
        rolls: r.rolls,
        total: r.total,
        isCrit: isCritHit, // для отображения золотого цвета
        color: isCritHit ? 'gold' : 'blood',
        timestamp: Date.now()
      });
    }
    return r;
  }

  // ── Старый метод для совместимости ──

  async rollWithCrit(
    formula: string,
    isCrit: boolean,
    label?: string,
    unitName?: string
  ): Promise<DiceRollResult> {
    return this.rollDamage(formula, label, unitName, isCrit);
  }

  // ── Специальные анонсы ──

  async announceHit(
    unitName: string,
    weaponName: string,
    result: DiceRollResult
  ): Promise<void> {
    const hit = result.total >= 11 || result.isCrit;
    
    let subtitle: string | undefined;
    if (result.allD20Rolls && result.allD20Rolls.length > 1) {
      const modName = result.rollModifier === 'advantage' ? 'Преим.' : 'Помеха';
      subtitle = `${modName}: [${result.allD20Rolls.join(', ')}]`;
    }
    
    await broadcast({
      id: msgId(),
      type: hit ? 'hit' : 'miss',
      unitName,
      title: `${weaponName} — ${hit ? 'Попадание!' : 'Промах'}`,
      subtitle,
      icon: hit ? '🎯' : '💨',
      rolls: result.rolls,
      total: result.total,
      isCrit: result.isCrit,
      isCritFail: result.isCritFail,
      color: result.isCrit ? 'gold' : hit ? 'green' : 'blood',
      timestamp: Date.now()
    });
  }

  async announceDamage(
    unitName: string,
    damage: number,
    typeName: string,
    rolls: number[],
    bonus: number,
    isCrit = false
  ): Promise<void> {
    await broadcast({
      id: msgId(),
      type: 'damage',
      unitName,
      title: `${damage} ${typeName}`,
      subtitle: isCrit ? '✨ Критический урон!' : undefined,
      icon: '💥',
      rolls,
      total: damage,
      isCrit,
      color: isCrit ? 'gold' : 'blood',
      timestamp: Date.now()
    });
  }

  async announceMiss(
    unitName: string,
    weaponName: string,
    result: DiceRollResult
  ): Promise<void> {
    await broadcast({
      id: msgId(),
      type: 'miss',
      unitName,
      title: `Промах — ${weaponName}`,
      icon: '💨',
      rolls: result.rolls,
      total: result.total,
      isCritFail: result.isCritFail,
      color: result.isCritFail ? 'blood' : 'white',
      timestamp: Date.now()
    });
  }

  async announceSpellCast(
    unitName: string,
    spellName: string,
    success: boolean,
    result: DiceRollResult,
    manaSaved?: number
  ): Promise<void> {
    let subtitle: string | undefined;
    if (result.isCrit && manaSaved) {
      subtitle = `✨ КРИТ! Мана −${manaSaved} (×0.5)`;
    } else if (result.allD20Rolls && result.allD20Rolls.length > 1) {
      const modName = result.rollModifier === 'advantage' ? 'Преим.' : 'Помеха';
      subtitle = `${modName}: [${result.allD20Rolls.join(', ')}]`;
    }
    
    await broadcast({
      id: msgId(),
      type: 'spell',
      unitName,
      title: `${spellName} — ${success ? 'Успех!' : 'Провал'}`,
      subtitle,
      icon: success ? '✨' : '💨',
      rolls: result.rolls,
      total: result.total,
      isCrit: result.isCrit,
      isCritFail: result.isCritFail,
      color: result.isCrit ? 'gold' : success ? 'purple' : 'white',
      timestamp: Date.now()
    });
  }

  async announceProjectileCount(
    unitName: string,
    count: number,
    rolls?: number[]
  ): Promise<void> {
    await broadcast({
      id: msgId(),
      type: 'spell',
      unitName,
      title: `Снаряды: ${count}`,
      icon: '🔮',
      rolls,
      total: count,
      color: 'mana',
      timestamp: Date.now()
    });
  }

  async announceTakeDamage(
    unitName: string,
    damage: number,
    currentHP: number,
    maxHP: number
  ): Promise<void> {
    const dead = currentHP <= 0;
    await broadcast({
      id: msgId(),
      type: dead ? 'death' : 'damage',
      unitName,
      title: `−${damage} HP`,
      subtitle: dead ? '☠️ ПАЛИ В БОЮ' : undefined,
      icon: dead ? '💀' : '💔',
      color: 'blood',
      hpBar: { current: Math.max(0, currentHP), max: maxHP },
      timestamp: Date.now()
    });
  }

  async announceHealing(
    unitName: string,
    amount: number,
    currentHP: number,
    maxHP: number
  ): Promise<void> {
    await broadcast({
      id: msgId(),
      type: 'heal',
      unitName,
      title: `+${amount} HP`,
      icon: '💚',
      color: 'green',
      hpBar: { current: currentHP, max: maxHP },
      timestamp: Date.now()
    });
  }

  async announceRokCard(
    unitName: string,
    cardIdx: number,
    isHit: boolean,
    effectName: string,
    hitRoll: number,
    effectRoll: number
  ): Promise<void> {
    await broadcast({
      id: msgId(),
      type: 'rok-card',
      unitName,
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
      id: msgId(),
      type: 'custom',
      unitName: '',
      title: message,
      icon: '📢',
      color: 'gold',
      timestamp: Date.now()
    });
  }
}

export const diceService = new DiceService();
