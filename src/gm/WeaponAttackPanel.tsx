import { useState, useCallback } from 'react';
import type { Monster, MonsterWeapon } from '../stores/monsterStore';
import { useMonsterStore } from '../stores/monsterStore';
import { rollDice } from '../utils/dice';
import OBR from '@owlbear-rodeo/sdk';
import { DICE_BROADCAST_CHANNEL } from '../services/diceService';
import type { BroadcastMessage } from '../types';

interface Props {
  attacker: Monster;
  weapon: MonsterWeapon;
  onClose: () => void;
}

export function WeaponAttackPanel({ attacker, weapon, onClose }: Props) {
  const monsters = useMonsterStore(s => Object.values(s.monsters));
  const [targetId, setTargetId] = useState<string>('');
  const [advantage, setAdvantage] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [result, setResult] = useState<{
    hitRoll: number;
    hitTotal: number;
    isHit: boolean;
    isCrit: boolean;
    damageRoll: number;
    damageTotal: number;
    damageType?: string;
    log: string[];
  } | null>(null);

  const target = monsters.find(m => m.tokenId === targetId);

  const executeAttack = useCallback(() => {
    if (!target) return;
    const log: string[] = [];

    // Hit roll: d20 + hitBonus + dexterity bonus
    const agiMod = Math.floor((attacker.stats.dexterity || 0) * 3);
    const hitFormula = `d20+${weapon.hitBonus + agiMod}`;
    const hitResult = rollDice(hitFormula, 'Атака', advantage);

    const isCrit = hitResult.isCrit ?? false;
    const isCritFail = hitResult.isCritFail ?? false;

    log.push(`🎯 Бросок атаки: [${hitResult.rolls.join(', ')}] + ${weapon.hitBonus + agiMod} = ${hitResult.total}`);
    if (isCrit) log.push('✨ КРИТИЧЕСКОЕ ПОПАДАНИЕ!');
    if (isCritFail) log.push('💀 КРИТИЧЕСКИЙ ПРОВАЛ!');

    // Check hit vs target armor
    const targetArmor = target.armor + Math.floor(
      Object.values(target.armorByType || {}).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(target.armorByType || {}).length)
    );
    const isHit = isCrit || (!isCritFail && hitResult.total >= (11 + targetArmor));

    log.push(`🛡 Броня цели: ${targetArmor} | Порог: ${11 + targetArmor} | ${isHit ? 'Попадание!' : 'Промах'}`);

    let damageTotal = 0;
    let damageRoll = 0;

    if (isHit) {
      // Damage roll
      let formula = weapon.damageFormula;
      if (isCrit) {
        // Double dice on crit
        formula = formula.replace(/(\d*)d(\d+)/gi, (_, c, s) => `${parseInt(c || '1') * 2}d${s}`);
      }
      // Add physicalPower bonus
      const strMod = Math.floor((attacker.stats.physicalPower || 0) * 5);
      if (strMod > 0) formula += `+${strMod}`;

      const dmgResult = rollDice(formula, 'Урон');
      damageRoll = dmgResult.total;
      damageTotal = dmgResult.total;

      // Apply target resistance
      const resistance = target.elementResistances?.[weapon.damageType as keyof typeof target.elementResistances];
      if (resistance !== undefined && resistance !== 1) {
        const original = damageTotal;
        damageTotal = Math.round(damageTotal * resistance);
        log.push(`🔮 Сопротивление ${weapon.damageType}: ×${resistance} → ${original} → ${damageTotal}`);
      }

      // Apply target armor reduction for physical damage
      const isPhysical = ['slashing', 'piercing', 'bludgeoning', 'chopping'].includes(weapon.damageType);
      if (isPhysical) {
        const typeArmor = target.armorByType?.[weapon.damageType as keyof typeof target.armorByType] ?? 0;
        const totalArmor = target.armor + typeArmor;
        damageTotal = Math.max(0, damageTotal - totalArmor);
        log.push(`🛡 Броня: −${totalArmor} → ${damageTotal}`);
      }

      // Apply damage to target
      const newHp = Math.max(0, target.hp - damageTotal);
      useMonsterStore.getState().setHp(target.tokenId, newHp);

      log.push(`💥 ${weapon.name}: [${dmgResult.rolls.join(', ')}] = ${dmgResult.total} → ${damageTotal} урона`);
      log.push(`❤ ${target.name}: ${target.hp} → ${newHp} HP`);

      // Broadcast
      const msg: BroadcastMessage = {
        id: `gm-atk-${Date.now()}`,
        type: 'hit',
        unitName: attacker.name,
        title: `${weapon.name} → ${target.name}`,
        subtitle: isCrit ? 'КРИТ!' : undefined,
        icon: '⚔',
        rolls: dmgResult.rolls,
        total: damageTotal,
        isCrit,
        isCritFail: false,
        color: isCrit ? 'gold' : 'blood',
        timestamp: Date.now(),
        hpBar: { current: newHp, max: target.maxHp },
        details: log,
      };
      OBR.broadcast.sendMessage(DICE_BROADCAST_CHANNEL, msg);
    }

    setResult({
      hitRoll: hitResult.rolls[0] || 0,
      hitTotal: hitResult.total,
      isHit,
      isCrit,
      damageRoll,
      damageTotal,
      damageType: weapon.damageType,
      log,
    });
  }, [attacker, weapon, target, advantage]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d0d14] border border-[#1a1a2a] rounded-xl w-[380px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1a1a2a]">
          <div className="flex items-center justify-between">
            <h3 className="font-cinzel text-sm text-gold">⚔ {weapon.name}</h3>
            <button onClick={onClose} className="text-faded hover:text-bone text-xs">✕</button>
          </div>
          <p className="text-[10px] text-faded mt-1">{attacker.name} → {target?.name || '...'}</p>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Target selection */}
          <div>
            <label className="text-[9px] text-faded uppercase tracking-wider">Цель</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1.5 text-bone text-xs focus:border-gold-dark focus:outline-none mt-0.5">
              <option value="">Выбери цель...</option>
              {monsters.filter(m => m.tokenId !== attacker.tokenId && m.hp > 0).map(m => (
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
            <div>Формула урона: <span className="text-bone font-mono">{weapon.damageFormula}</span> ({weapon.damageType})</div>
            <div>Бонус к атаке: <span className="text-bone">{weapon.hitBonus} + {Math.floor((attacker.stats.dexterity || 0) * 3)} (ловк.)</span></div>
            <div>Бонус к урону: <span className="text-bone">+{Math.floor((attacker.stats.physicalPower || 0) * 5)} (сила)</span></div>
          </div>

          {/* Attack button */}
          <button onClick={executeAttack} disabled={!target}
            className={`w-full py-2 rounded-lg font-cinzel text-xs font-bold transition-all ${
              target
                ? 'bg-blood-dark text-blood-bright hover:bg-blood border border-blood/50'
                : 'bg-[#1a1a2a] text-faded/50 border border-transparent cursor-not-allowed'
            }`}>
            ⚔ Атаковать
          </button>

          {/* Result */}
          {result && (
            <div className="bg-[#111118] rounded-lg p-3 space-y-1 border border-[#1a1a2a]/50">
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
                  Урон: {result.damageTotal} ({result.damageType})
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
