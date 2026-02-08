// Dice Service — broadcasts rolls to all players
// Attempts OBR integration, falls back to local + BroadcastChannel

export interface DiceRollResult {
  formula: string;
  rolls: number[];
  total: number;
  isCrit: boolean;
  isCritFail: boolean;
  label: string;
}

type RollListener = (msg: DiceRollResult & { player: string }) => void;

// Global OBR reference (set from outside if available)
let _obr: any = null;

export function setOBR(obr: any) {
  _obr = obr;
}

class DiceService {
  private playerName = 'Player';
  private listeners: RollListener[] = [];
  private obrReady = false;

  async initialize(): Promise<boolean> {
    if (_obr) {
      try {
        this.playerName = await _obr.player.getName();
        this.obrReady = true;

        _obr.broadcast.onMessage('cursed-hearts/roll-result', (event: { data: DiceRollResult & { player: string } }) => {
          if (event.data) {
            this.listeners.forEach(fn => fn(event.data));
          }
        });

        return true;
      } catch (e) {
        console.warn('OBR dice init failed:', e);
      }
    }

    // Fallback: BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('cursed-hearts-dice');
        channel.onmessage = (event) => {
          this.listeners.forEach(fn => fn(event.data));
        };
      }
    } catch { /* silent */ }

    return false;
  }

  setPlayerName(name: string) { this.playerName = name; }
  isOBRAvailable(): boolean { return this.obrReady; }

  onRoll(fn: RollListener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  /**
   * Roll dice, broadcast result, return it
   */
  async roll(formula: string, label: string = ''): Promise<DiceRollResult> {
    const result = this.parseAndRoll(formula);
    const fullResult: DiceRollResult = { ...result, label };

    if (this.obrReady && _obr) {
      try {
        const critText = result.isCrit ? ' 💥КРИТ!' : result.isCritFail ? ' ❌ПРОВАЛ!' : '';
        await _obr.notification.show(
          `🎲 ${label || formula}: [${result.rolls.join(', ')}] = ${result.total}${critText}`,
          'INFO'
        );

        await _obr.broadcast.sendMessage('cursed-hearts/roll-result', {
          ...fullResult,
          player: this.playerName,
        });

        // Try Dice Owlbear channels
        for (const ch of ['rodeo.owlbear.dice/roll', 'com.owlbear.dice/roll', 'dice-roll']) {
          try {
            await _obr.broadcast.sendMessage(ch, { formula, label: label || 'Cursed Hearts', source: 'cursed-hearts' });
          } catch { /* */ }
        }
      } catch (e) {
        console.warn('OBR broadcast failed:', e);
      }
    } else {
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('cursed-hearts-dice');
          channel.postMessage({ ...fullResult, player: this.playerName });
        }
      } catch { /* silent */ }
    }

    return fullResult;
  }

  /**
   * Parse formula and roll: 3d20+5, d20, 5d12-3, 2d6+1d4+3
   */
  private parseAndRoll(formula: string): Omit<DiceRollResult, 'label'> {
    const rolls: number[] = [];
    let total = 0;
    let firstD20: number | null = null;

    const cleaned = formula.replace(/\s/g, '').toLowerCase();
    const regex = /([+-]?)(\d*)d(\d+)|([+-]?\d+)(?!d)/gi;
    let match;

    while ((match = regex.exec(cleaned)) !== null) {
      if (match[3]) {
        const sign = match[1] === '-' ? -1 : 1;
        const count = parseInt(match[2]) || 1;
        const sides = parseInt(match[3]);

        for (let i = 0; i < count; i++) {
          const roll = Math.floor(Math.random() * sides) + 1;
          rolls.push(roll);
          total += roll * sign;
          if (sides === 20 && firstD20 === null) firstD20 = roll;
        }
      } else if (match[4]) {
        total += parseInt(match[4]);
      }
    }

    return {
      formula,
      rolls,
      total,
      isCrit: firstD20 === 20,
      isCritFail: firstD20 === 1,
    };
  }
}

export const diceService = new DiceService();
