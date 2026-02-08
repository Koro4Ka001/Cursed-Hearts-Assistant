// Dice Service — handles broadcasting rolls to all players

interface DiceRollMessage {
  formula: string;
  result: number;
  rolls: number[];
  label?: string;
  player: string;
  timestamp: number;
}

type RollListener = (msg: DiceRollMessage) => void;

class DiceService {
  private playerName = 'Player';
  private listeners: RollListener[] = [];
  private channelId = 'cursed-hearts-dice';

  async initialize(): Promise<boolean> {
    // Try to detect Owlbear Rodeo SDK
    try {
      // In production this would use the real OBR SDK
      // For now we'll use BroadcastChannel as fallback
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(this.channelId);
        channel.onmessage = (event) => {
          const msg = event.data as DiceRollMessage;
          this.listeners.forEach(fn => fn(msg));
        };
      }
      return true;
    } catch {
      return false;
    }
  }

  setPlayerName(name: string) {
    this.playerName = name;
  }

  onRoll(fn: RollListener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  async broadcastRoll(formula: string, result: number, rolls: number[], label?: string) {
    const msg: DiceRollMessage = {
      formula,
      result,
      rolls,
      label,
      player: this.playerName,
      timestamp: Date.now(),
    };

    // Try to broadcast via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(this.channelId);
        channel.postMessage(msg);
      }
    } catch {
      // Silent fail
    }

    // Notify local listeners
    this.listeners.forEach(fn => fn(msg));
  }

  // Parse and roll dice locally
  roll(formula: string, bonus: number = 0): { total: number; rolls: number[]; isCrit: boolean; isCritFail: boolean } {
    const rolls: number[] = [];
    let total = 0;

    const regex = /(\d*)d(\d+)/gi;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(formula)) !== null) {
      // Handle any + or - before this dice group
      const before = formula.substring(lastIndex, match.index).trim();
      if (before) {
        const num = parseInt(before.replace('+', ''));
        if (!isNaN(num)) total += num;
      }

      const count = parseInt(match[1]) || 1;
      const sides = parseInt(match[2]);
      for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
      }
      lastIndex = regex.lastIndex;
    }

    // Handle trailing modifier
    const trailing = formula.substring(lastIndex).trim();
    if (trailing) {
      const num = parseInt(trailing.replace('+', ''));
      if (!isNaN(num)) total += num;
    }

    total += bonus;

    // Crit detection for single d20
    const isCrit = rolls.length === 1 && rolls[0] === 20 && formula.toLowerCase().includes('d20');
    const isCritFail = rolls.length === 1 && rolls[0] === 1 && formula.toLowerCase().includes('d20');

    return { total, rolls, isCrit, isCritFail };
  }
}

export const diceService = new DiceService();
