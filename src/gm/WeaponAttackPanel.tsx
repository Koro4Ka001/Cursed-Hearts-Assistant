import { useState, useCallback } from 'react';
import type { Monster, MonsterWeapon } from '../stores/monsterStore';
import { useMonsterStore } from '../stores/monsterStore';
import { rollDice } from '../utils/dice';
import { calculateMonsterDamage } from '../utils/monsterDamage';
import OBR from '@owlbear-rodeo/sdk';
import { DICE_BROADCAST_CHANNEL } from '../services/diceService';
import { ELEMENT_NAMES_MAP } from '../constants/elements';
import type { BroadcastMessage } from '../types';

interface Props {
  attacker: Monster;
  weapon: MonsterWeapon;
  onClose: () => void;
}

export function WeaponAttackPanel({ attacker, weapon, onClose }: Props) {
  const [targetId, setTargetId] = useState<string>('');
  const [advantage, setAdvantage] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [result, setResult] = useState<{
    hitRoll: number;
    hitTotal: number;
    isHit: boolean;
    isCrit: boolean;
    damageTotal: number;
    damageType: string;
    log: string[];
  } | null>(null);
  const [attackCount, setAttackCount] = useState(0);

  // Подписка на список монстров: HP/имя цели обновляют панель реактивно
  const monstersList = useMonsterStore(s => Object.values(s.monsters));

  const executeAttack = useCallback(() => {
    const currentTarget = useMonsterStore.getState().monsters[targetId];
    if (!currentTarget) return;
    const log: string[] = [];

    // Hit roll
    const agiMod = Math.floor((attacker.stats.dexterity || 0) * 3);
    const hitFormula = `d20+${weapon.hitBonus + agiMod}`;
    const hitResult = rollDice(hitFormula, 'Атака', advantage);

    const isCrit = hitResult.isCrit ?? false;
    const isCritFail = hitResult.isCritFail ?? false;

    log.push(`🎯 Бросок: [${hitResult.rolls.join(', ')}] + ${weapon.hitBonus + agiMod} = ${hitResult.total}`);
    if (isCrit) log.push('✨ КРИТ!');
    if (isCritFail) log.push('💀 ПРОВАЛ!');

    // Determine hit
    const isHit = isCrit || (!isCritFail && hitResult.total >= 11);

    if (!isHit) {
      log.push(`💨 Промах (порог: 11)`);
    }

    // Roll damage if hit
    let rawDamage = 0;
    if (isHit) {
      let formula = weapon.damageFormula;
      if (isCrit) formula = formula.replace(/(\d*)d(\d+)/gi, (_, c, s) => `${parseInt(c || '1') * 2}d${s}`);
      const strMod = Math.floor((attacker.stats.physicalPower || 0) * 5);
      if (strMod > 0) formula += `+${strMod}`;
      rawDamage = rollDice(formula, 'Урон').total;
    }

    let damageTotal = 0;
    if (isHit && rawDamage > 0) {
      const dmgResult = calculateMonsterDamage(rawDamage, weapon.damageType, currentTarget);
      damageTotal = dmgResult.finalDamage;
      log.push(`💥 ${weapon.name}: ${rawDamage} → ${dmgResult.finalDamage} урона`);
      if (dmgResult.armorApplied > 0) log.push(`🛡 Броня: −${dmgResult.armorApplied}`);
      if (dmgResult.multiplier !== 1) log.push(`🔮 Множитель: ×${dmgResult.multiplier}`);

      // Apply damage
      const newHp = Math.max(0, currentTarget.hp - damageTotal);
      useMonsterStore.getState().setHp(currentTarget.tokenId, newHp);
      log.push(`❤ ${currentTarget.name}: ${currentTarget.hp} → ${newHp} HP`);

      // Broadcast
      const msg: BroadcastMessage = {
        id: `gm-atk-${Date.now()}`,
        type: 'hit',
        unitName: attacker.name,
        title: `${weapon.name} → ${currentTarget.name}`,
        subtitle: isCrit ? 'КРИТ!' : undefined,
        icon: '⚔',
        rolls: hitResult.rolls,
        total: damageTotal,
        isCrit,
        isCritFail: false,
        color: isCrit ? 'gold' : 'blood',
        timestamp: Date.now(),
        hpBar: { current: newHp, max: currentTarget.maxHp },
        details: log,
      };
      OBR.broadcast.sendMessage(DICE_BROADCAST_CHANNEL, msg);
    }

    // Use functional state update to avoid stale closure issues
    setResult(prev => ({
      hitRoll: hitResult.rolls[0] || 0,
      hitTotal: hitResult.total,
      isHit,
      isCrit,
      damageTotal,
      damageType: weapon.damageType,
      log,
    }));
    setAttackCount(c => c + 1);
  }, [attacker, weapon, targetId, advantage]);

  // Get fresh target for display
  const displayTarget = useMonsterStore(s => targetId ? s.monsters[targetId] : undefined);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d0d14] border border-[#1a1a2a] rounded-xl w-[380px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1a1a2a]">
          <div className="flex items-center justify-between">
            <h3 className="font-cinzel text-sm text-gold">⚔ {weapon.name}</h3>
            <button onClick={onClose} className="text-faded hover:text-bone text-xs">✕</button>
          </div>
          <p className="text-[10px] text-faded mt-1">
            {attacker.name} → {displayTarget?.name || '...'}
            {displayTarget && ` (${displayTarget.hp}/${displayTarget.maxHp})`}
          </p>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Target */}
          <div>
            <label className="text-[9px] text-faded uppercase tracking-wider">Цель</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1.5 text-bone text-xs focus:border-gold-dark focus:outline-none mt-0.5">
              <option value="">Выбери цель...</option>
              {monstersList
                .filter(m => m.tokenId !== attacker.tokenId && m.hp > 0)
                .map(m => (
                  <option key={m.tokenId} value={m.tokenId}>{m.name} ({m.hp}/{m.maxHp})</option>
                ))}
            </select>
          </div>

          {/* Modifier */}
          <div className="flex gap-1">
            {(['normal', 'advantage', 'disadvantage'] as const).map(mod => (
              <button key={mod} onClick={() => setAdvantage(mod)}
                className={`flex-1 py-1 text-[9px] rounded font-cinzel transition-all ${
                  advantage === mod
                    ? mod === 'advantage' ? 'bg-green-900/50 text-green-400 border border-green-800/50'
                      : mod === 'disadvantage' ? 'bg-blood-dark/50 text-blood-bright border border-blood/30'
                      : 'bg-gold-dark/20 text-gold border border-gold-dark/30'
                    : 'text-faded hover:text-bone border border-transparent'
                }`}>
                {mod === 'normal' ? 'Обычный' : mod === 'advantage' ? '🎯 Преим.' : '💨 Помеха'}
              </button>
            ))}
          </div>

          {/* Info */}
          <div className="text-[9px] text-faded space-y-0.5">
            <div>Формула: <span className="text-bone font-mono">{weapon.damageFormula}</span> ({ELEMENT_NAMES_MAP[weapon.damageType] ?? weapon.damageType})</div>
            <div>Бонус атаки: <span className="text-bone">+{weapon.hitBonus + Math.floor((attacker.stats.dexterity || 0) * 3)}</span></div>
            <div>Бонус урона: <span className="text-bone">+{Math.floor((attacker.stats.physicalPower || 0) * 5)}</span></div>
          </div>

          {/* Attack button */}
          <button onClick={executeAttack} disabled={!displayTarget}
            className={`w-full py-2.5 rounded-lg font-cinzel text-sm font-bold transition-all ${
              displayTarget
                ? 'bg-blood-dark text-blood-bright hover:bg-blood border border-blood/50'
                : 'bg-[#1a1a2a] text-faded/50 border border-transparent cursor-not-allowed'
            }`}>
            ⚔ Атаковать {displayTarget ? `→ ${displayTarget.name}` : ''}
          </button>

          {/* Result */}
          {result && (
            <div className="bg-[#111118] rounded-lg p-3 space-y-1 border border-[#1a1a2a]/50" key={attackCount}>
              <div className="flex items-center gap-2 text-xs">
                <span className={result.isHit ? 'text-green-400' : 'text-blood-bright'}>
                  {result.isHit ? '🎯 Попадание!' : '💨 Промах'}
                </span>
                {result.isCrit && <span className="text-gold">✨ КРИТ!</span>}
              </div>
              <div className="text-[10px] text-faded font-mono">
                Атака: d20 + бонус = {result.hitTotal} (d20={result.hitRoll})
              </div>
              {result.damageTotal > 0 && (
                <div className="text-[10px] text-faded font-mono">
                  Итого: {result.damageTotal} ({ELEMENT_NAMES_MAP[result.damageType] ?? result.damageType})
                </div>
              )}
              <div className="space-y-0.5 mt-1">
                {result.log.map((line, i) => (
                  <div key={i} className="text-[9px] text-faded/80">{line}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
