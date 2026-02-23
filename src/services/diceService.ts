import OBR from "@owlbear-rodeo/sdk";
import type { DiceRollResult, RollModifier } from "../types";

export type DiceStatus = "local";
export const DICE_BROADCAST_CHANNEL = "cursed-hearts/dice-roll";
export const LOCAL_STORAGE_KEY = "cursed-hearts-pending-notification";

export interface BroadcastMessage {
  id: string;
  type: 'roll' | 'damage' | 'hit' | 'miss' | 'spell' | 'heal' | 'death' | 'rok-card' | 'custom';
  unitName: string;
  title: string;
  subtitle?: string;
  icon?: string;
  rolls?: number[];
  total?: number;
  isCrit?: boolean;
  isCritFail?: boolean;
  color?: 'gold' | 'blood' | 'mana' | 'green' | 'purple' | 'white';
  hpBar?: { current: number; max: number };
  details?: string[];
  timestamp: number;
}

type LocalMessageListener = (msg: BroadcastMessage) => void;
const localListeners = new Set<LocalMessageListener>();

export function onLocalDiceMessage(callback: LocalMessageListener): () => void {
  localListeners.add(callback);
  return () => { localListeners.delete(callback); };
}

function emitLocal(msg: BroadcastMessage) {
  localListeners.forEach(fn => {
    try { fn(msg); } catch (e) { console.error('[DiceService] Local listener error:', e); }
  });
}

function addToQueue(msg: BroadcastMessage) {
  try {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    let queue: BroadcastMessage[] = [];
    if (existing) {
      try {
        queue = JSON.parse(existing);
        if (!Array.isArray(queue)) queue = [];
      } catch { queue = []; }
    }
    queue.push(msg);
    if (queue.length > 10) queue = queue.slice(-10);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[DiceService] localStorage error:', e);
  }
}

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

function rollD20WithModifier(modifier: RollModifier): { value: number; allRolls: number[] } {
  const roll1 = Math.floor(Math.random() * 20) + 1;
  if (modifier === 'normal') return { value: roll1, allRolls: [roll1] };
  const roll2 = Math.floor(Math.random() * 20) + 1;
  const allRolls = [roll1, roll2];
  if (modifier === 'advantage') return { value: Math.max(roll1, roll2), allRolls };
  return { value: Math.min(roll1, roll2), allRolls };
}

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
  return {
    formula,
    rolls,
    bonus,
    total,
    isCrit: checkForCrits && rawD20 === 20,
    isCritFail: checkForCrits && rawD20 === 1,
    rawD20: checkForCrits ? rawD20 : undefined,
    label,
    rollModifier: modifier !== 'normal' ? modifier : undefined,
    allD20Rolls
  };
}

let _idCounter = 0;
function msgId(): string { 
  return `dice-${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 6)}`; 
}

async function broadcast(msg: BroadcastMessage): Promise<void> {
  addToQueue(msg);
  emitLocal(msg);
  try {
    await OBR.broadcast.sendMessage(DICE_BROADCAST_CHANNEL, msg);
  } catch (e) {
    console.warn('[DiceService] Broadcast failed:', e);
  }
}

class DiceService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log("[DiceService] Ready");
  }

  getStatus(): DiceStatus { return "local"; }

  // 🔹 ВАЖНО: Добавлен параметр silent
  async roll(
    formula: string,
    label?: string,
    unitName?: string,
    modifier: RollModifier = 'normal',
    silent: boolean = false 
  ): Promise<DiceRollResult> {
    const r = localRoll(formula, label, modifier, true);
    
    if (label && unitName && !silent) {
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

  async rollDamage(formula: string, label?: string, unitName?: string, isCritHit: boolean = false): Promise<DiceRollResult> {
    const f = isCritHit ? doubleDice(formula) : formula;
    const r = localRoll(f, label, 'normal', false);
    
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
        isCrit: isCritHit,
        color: isCritHit ? 'gold' : 'blood',
        timestamp: Date.now()
      });
    }
    return r;
  }

  async broadcastRokCard(
    unitName: string,
    cardIndex: number,
    isHit: boolean,
    isCritHit: boolean,
    isCritMiss: boolean,
    effectIcon: string,
    effectName: string,
    hitRoll: number,
    effectRoll: number,
    interpretedResults: string[]
  ): Promise<void> {
    const details: string[] = [];
    if (isCritMiss) details.push(`💀 КРИТ ПРОМАХ [${hitRoll}]`);
    else if (isCritHit) details.push(`✨ КРИТ ПОПАДАНИЕ [${hitRoll}]`);
    else if (isHit) details.push(`🎯 Попадание [${hitRoll}]`);
    else details.push(`💨 Промах [${hitRoll}]`);
    
    details.push(`${effectIcon} [${effectRoll}] ${effectName}`);
    interpretedResults.forEach(r => details.push(`   └─ ${r}`));
    
    let color: BroadcastMessage['color'] = 'purple';
    if (isCritHit) color = 'gold';
    else if (isCritMiss) color = 'blood';
    else if (!isHit) color = 'white';
    
    let icon = '🃏';
    if (isCritHit) icon = '✨🃏';
    else if (isCritMiss) icon = '💀🃏';
    
    await broadcast({
      id: msgId(),
      type: 'rok-card',
      unitName,
      title: `Карта Рока #${cardIndex}`,
      subtitle: `${effectIcon} ${effectName}`,
      icon,
      total: effectRoll,
      isCrit: isCritHit,
      isCritFail: isCritMiss,
      color,
      details,
      timestamp: Date.now()
    });
  }

  async announceRokCard(unitName: string, cardIdx: number, isHit: boolean, effectName: string, hitRoll: number, effectRoll: number): Promise<void> {
    await this.broadcastRokCard(unitName, cardIdx, isHit, hitRoll === 20, hitRoll === 1, '🃏', effectName, hitRoll, effectRoll, []);
  }

  async broadcastSpell(spellName: string, unitName: string, damage: number, damageType?: string, isCrit?: boolean): Promise<void> {
    const subtitle = damageType ? `${damage} ${damageType}` : `${damage} урона`;
    await broadcast({
      id: msgId(),
      type: 'spell',
      unitName,
      title: spellName,
      subtitle: isCrit ? `✨ КРИТ! ${subtitle}` : subtitle,
      icon: '✨',
      total: damage,
      isCrit,
      color: isCrit ? 'gold' : 'purple',
      timestamp: Date.now()
    });
  }

  async broadcastAction(actionName: string, unitName: string, success: boolean, isCrit?: boolean): Promise<void> {
    await broadcast({
      id: msgId(),
      type: 'custom',
      unitName,
      title: actionName,
      subtitle: isCrit ? '✨ Критический успех!' : success ? 'Успех' : 'Провал',
      icon: success ? '⚡' : '💨',
      isCrit,
      color: isCrit ? 'gold' : success ? 'green' : 'white',
      timestamp: Date.now()
    });
  }

  async showNotification(message: string): Promise<void> {
    await OBR.notification.show(message);
  }
  
  // Методы совместимости (чтобы не сломать CombatTab)
  async announceTakeDamage(unitName: string, damage: number, currentHP: number, maxHP: number): Promise<void> {
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

  async announceHealing(unitName: string, amount: number, currentHP: number, maxHP: number): Promise<void> {
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
}

export const diceService = new DiceService();
