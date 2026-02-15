// src/services/diceService.ts
import OBR from "@owlbear-rodeo/sdk";
import type { DiceRollResult, RollModifier } from "../types";
import { toastOnMapService } from './toastOnMapService';

export type DiceStatus = "local";
export const DICE_BROADCAST_CHANNEL = "cursed-hearts/dice-roll";
const TOAST_POPOVER_ID = 'cursed-hearts-dice-toast';

// ═══════════════════════════════════════════════════════════════
// BROADCAST MESSAGE TYPE
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// LOCAL EVENT EMITTER
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// TOAST POPOVER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

let popoverOpen = false;
let popoverReady = false;
let pendingMessages: BroadcastMessage[] = [];

async function openToastPopover(): Promise<void> {
  if (popoverOpen) return;
  
  try {
    // Сначала закроем если вдруг завис
    await OBR.popover.close(TOAST_POPOVER_ID).catch(() => {});
    
    await OBR.popover.open({
      id: TOAST_POPOVER_ID,
      url: '/toast.html',
      width: 360,
      height: 450,
      anchorOrigin: { vertical: 'BOTTOM', horizontal: 'RIGHT' },
      transformOrigin: { vertical: 'BOTTOM', horizontal: 'RIGHT' },
      disableClickAway: true,
      offsetX: -16,
      offsetY: -16
    });
    
    popoverOpen = true;
    popoverReady = false;
    console.log('[DiceService] Toast popover opened, waiting for ready signal...');
  } catch (e) {
    console.warn('[DiceService] Failed to open popover:', e);
  }
}

async function closeToastPopover(): Promise<void> {
  if (!popoverOpen) return;
  try {
    await OBR.popover.close(TOAST_POPOVER_ID);
    popoverOpen = false;
    popoverReady = false;
    console.log('[DiceService] Toast popover closed');
  } catch (e) {
    console.warn('[DiceService] Failed to close popover:', e);
    popoverOpen = false;
    popoverReady = false;
  }
}

// Отправка сообщения с гарантией доставки
async function sendToToast(msg: BroadcastMessage): Promise<void> {
  try {
    await OBR.broadcast.sendMessage(DICE_BROADCAST_CHANNEL, msg);
    console.log('[DiceService] Message sent:', msg.title);
  } catch (e) {
    console.warn('[DiceService] Broadcast failed:', e);
  }
}

// Flush pending messages когда toast готов
function flushPendingMessages(): void {
  if (pendingMessages.length === 0) return;
  console.log('[DiceService] Flushing', pendingMessages.length, 'pending messages');
  
  const messages = [...pendingMessages];
  pendingMessages = [];
  
  messages.forEach((msg, i) => {
    setTimeout(() => sendToToast(msg), i * 100);
  });
}

// ═══════════════════════════════════════════════════════════════
// DICE PARSER
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// ROLL WITH MODIFIER
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// LOCAL ROLL
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// MESSAGE ID
// ═══════════════════════════════════════════════════════════════

let _idCounter = 0;
function msgId(): string { 
  return `dice-${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 6)}`; 
}

// ═══════════════════════════════════════════════════════════════
// BROADCAST — Открывает popover, ждёт готовности, отправляет
// ═══════════════════════════════════════════════════════════════

async function broadcast(msg: BroadcastMessage): Promise<void> {
  console.log('[DiceService] Broadcasting:', msg.title);
  
  // Эмитим локально
  emitLocal(msg);
  
  // Показываем на карте
  await toastOnMapService.showToast(msg);
}
  
  // Если popover открыт но не готов — в очередь
  if (!popoverReady) {
    pendingMessages.push(msg);
    return;
  }
  
  // Popover готов — отправляем
  await sendToToast(msg);
}

// ═══════════════════════════════════════════════════════════════
// DICE SERVICE CLASS
// ═══════════════════════════════════════════════════════════════

class DiceService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    
    try {
      // Слушаем сигнал "toast готов"
      OBR.broadcast.onMessage('cursed-hearts/toast-ready', () => {
        console.log('[DiceService] Toast is ready!');
        popoverReady = true;
        flushPendingMessages();
      });
      
      // Слушаем команду закрыть popover
      OBR.broadcast.onMessage('cursed-hearts/close-toast', () => {
        console.log('[DiceService] Received close signal');
        closeToastPopover();
      });
    } catch (e) {
      console.warn('[DiceService] Failed to setup broadcast listeners:', e);
    }
    
    console.log("[DiceService] Ready");
  }

  getStatus(): DiceStatus { 
    return "local"; 
  }

  // ═══════════════════════════════════════════════════════════
  // ОСНОВНОЙ БРОСОК
  // ═══════════════════════════════════════════════════════════

  async roll(
    formula: string,
    label?: string,
    unitName?: string,
    modifier: RollModifier = 'normal'
  ): Promise<DiceRollResult> {
    const r = localRoll(formula, label, modifier, true);
    
    if (label && unitName) {
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

  // ═══════════════════════════════════════════════════════════
  // БРОСОК УРОНА
  // ═══════════════════════════════════════════════════════════

  async rollDamage(
    formula: string,
    label?: string,
    unitName?: string,
    isCritHit: boolean = false
  ): Promise<DiceRollResult> {
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

  async rollWithCrit(
    formula: string,
    isCrit: boolean,
    label?: string,
    unitName?: string
  ): Promise<DiceRollResult> {
    return this.rollDamage(formula, label, unitName, isCrit);
  }

  // ═══════════════════════════════════════════════════════════
  // СПЕЦИАЛЬНЫЕ АНОНСЫ
  // ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export const diceService = new DiceService();
