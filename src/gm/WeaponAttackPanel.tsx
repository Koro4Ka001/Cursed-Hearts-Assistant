import { useState, useCallback } from 'react';
import type { Monster, MonsterWeapon } from '../stores/monsterStore';
import { rollDice } from '../utils/dice';
import OBR from '@owlbear-rodeo/sdk';
import { DICE_BROADCAST_CHANNEL, diceService } from '../services/diceService';
import { spellExecutor } from '../services/spellExecutor';
import { ELEMENT_NAMES_MAP } from '../constants/elements';
import type { BroadcastMessage, RollModifier, Unit } from '../types';

interface Props {
  attacker: Monster;
  /** Оружие, выбранное при открытии панели (null — открыто для каста/прокидок) */
  weapon: MonsterWeapon | null;
  onClose: () => void;
}

const HIT_THRESHOLD = 11;

/** Быстрые прокидки на характеристики */
const QUICK_STATS: { key: keyof Monster['stats']; label: string; icon: string }[] = [
  { key: 'physicalPower', label: 'Физ. сила', icon: '⚔' },
  { key: 'dexterity', label: 'Ловкость', icon: '💨' },
  { key: 'vitality', label: 'Живучесть', icon: '❤' },
  { key: 'intelligence', label: 'Интеллект', icon: '🧠' },
  { key: 'charisma', label: 'Харизма', icon: '✨' },
  { key: 'initiative', label: 'Инициатива', icon: '⚡' },
];

export function WeaponAttackPanel({ attacker, weapon, onClose }: Props) {
  const [weaponId, setWeaponId] = useState<string>(weapon?.id ?? attacker.weapons[0]?.id ?? '');
  const [spellId, setSpellId] = useState<string>(attacker.spells[0]?.id ?? '');
  const [modifier, setModifier] = useState<RollModifier>('normal');
  const [logTitle, setLogTitle] = useState<string>('');
  const [log, setLog] = useState<string[]>([]);
  const [logKey, setLogKey] = useState(0);
  const [isCasting, setIsCasting] = useState(false);

  const activeWeapon = attacker.weapons.find(w => w.id === weaponId) ?? attacker.weapons[0] ?? null;
  const activeSpell = attacker.spells.find(s => s.id === spellId) ?? attacker.spells[0] ?? null;

  const pushLog = useCallback((title: string, lines: string[]) => {
    setLogTitle(title);
    setLog(lines);
    setLogKey(k => k + 1);
  }, []);

  // ⚔ Атака оружием: попадание = d20 + hitBonus (ловкость НЕ добавляется к попаданию).
  // При результате ≥11 (или крите) — прокидывается урон. Урон НИКТО не получает
  // автоматически — это бросок, ГМ применяет результат сам.
  // Бонус урона: ближнее +5×физ.сила, дальнее +3×ловкость.
  const executeAttack = useCallback(async () => {
    const w = activeWeapon;
    if (!w) return;
    const isMelee = (w.weaponType ?? 'melee') === 'melee';
    const lines: string[] = [];

    const hitResult = rollDice(`d20+${w.hitBonus}`, 'Попадание', modifier);
    const isCrit = hitResult.isCrit ?? false;
    const isCritFail = hitResult.isCritFail ?? false;
    const isHit = isCrit || (!isCritFail && hitResult.total >= HIT_THRESHOLD);

    lines.push(`🎯 Попадание: [${hitResult.rolls.join(', ')}] + ${w.hitBonus} = ${hitResult.total} (порог ${HIT_THRESHOLD})`);
    if (isCrit) lines.push('✨ КРИТ — кубы урона ×2!');
    if (isCritFail) lines.push('💀 КРИТ-ПРОВАЛ!');

    let damageTotal = 0;
    if (isHit) {
      let formula = w.damageFormula;
      if (isCrit) formula = formula.replace(/(\d*)d(\d+)/gi, (_, c, s) => `${parseInt(c || '1') * 2}d${s}`);
      const statBonus = isMelee
        ? Math.floor((attacker.stats.physicalPower || 0) * 5)
        : Math.floor((attacker.stats.dexterity || 0) * 3);
      // Владение оружием: +5 за очко
      const profType = w.proficiencyType;
      const profValue = profType ? (attacker.proficiencies?.[profType] ?? 0) : 0;
      const profBonus = profValue * 5;
      const totalBonus = statBonus + profBonus;
      if (totalBonus > 0) formula += `+${totalBonus}`;
      damageTotal = rollDice(formula, 'Урон').total;
      lines.push(`💥 Урон: ${formula} = ${damageTotal} (${ELEMENT_NAMES_MAP[w.damageType] ?? w.damageType})`);
      lines.push(`Бонус: ${isMelee ? 'ближнее +5×ФС' : 'дальнее +3×ЛОВ'} = +${statBonus}${profBonus > 0 ? `, владение +${profBonus}` : ''}`);
    } else {
      lines.push('💨 Промах — урон не прокидывается');
    }

    // Broadcast игрокам — используем diceService для единообразия (с await + локальная очередь)
    const msg: BroadcastMessage = {
      id: `gm-atk-${Date.now()}`,
      type: 'hit',
      unitName: attacker.name,
      title: w.name,
      subtitle: isCrit ? '✨ КРИТ!' : isHit ? `${damageTotal} урона` : 'Промах',
      icon: '⚔',
      rolls: hitResult.rolls,
      total: isHit ? damageTotal : hitResult.total,
      isCrit,
      isCritFail,
      color: isCrit ? 'gold' : isHit ? 'blood' : 'white',
      timestamp: Date.now(),
      details: lines,
    };
    try {
      await OBR.broadcast.sendMessage(DICE_BROADCAST_CHANNEL, msg);
    } catch (e) {
      console.warn('[WeaponAttackPanel] ❌ Broadcast failed:', e);
    }

    pushLog(`⚔ ${w.name} — ${isHit ? 'попадание' : 'промах'}`, lines);
  }, [activeWeapon, attacker, modifier, pushLog]);

  // ✨ Каст заклинания монстром — движок как у игроков, но без траты маны (cost = 0)
  const executeCast = useCallback(async () => {
    const s = activeSpell;
    if (!s || isCasting) return;
    setIsCasting(true);
    try {
      // spellExecutor работает с Unit: передаём минимальный адаптер монстра
      const caster = {
        id: attacker.tokenId,
        name: attacker.name,
        shortName: attacker.name,
        stats: attacker.stats,
        proficiencies: {},
        elementModifiers: [],
      } as unknown as Unit;
      const result = await spellExecutor.execute({
        spell: { ...s, cost: 0 },
        caster,
        targetCount: 1,
        rollModifier: 'normal',
      });
      // Бонус от интеллекта: +3 к урону заклинаний
      const intBonus = Math.floor((attacker.stats.intelligence || 0) * 3);
      if (intBonus > 0 && result.totalDamage > 0) {
        result.totalDamage += intBonus;
        result.context.totalDamage += intBonus; // 🔧 синхронизация
        result.context.log.push(`🧠 Интеллект: +${intBonus} к урону заклинания`);
      }
      const lines = [...result.context.log];
      if (result.totalDamage > 0) {
        lines.push(`💥 Итого урона: ${result.totalDamage}${result.damageType ? ` (${ELEMENT_NAMES_MAP[result.damageType] ?? result.damageType})` : ''}`);
      }
      pushLog(`✨ ${s.name}`, lines);
      await diceService.broadcastSpell(s.name, attacker.name, result.totalDamage, result.damageType, result.context.isCrit);
    } catch (e) {
      pushLog('✨ Ошибка каста', [String(e)]);
    } finally {
      setIsCasting(false);
    }
  }, [activeSpell, attacker, isCasting, pushLog]);

  // 🎲 Быстрая прокидка на характеристику: d20 + очки характеристики
  const quickRoll = useCallback((key: keyof Monster['stats'], label: string, icon: string) => {
    const value = attacker.stats[key] || 0;
    const r = rollDice(`d20+${value}`, label, 'normal');
    const isCrit = r.rawD20 === 20;
    const isCritFail = r.rawD20 === 1;
    const lines = [`🎲 [${r.rolls.join(', ')}] + ${value} = ${r.total}`];
    if (isCrit) lines.push('✨ Естественная 20!');
    if (isCritFail) lines.push('💀 Естественная 1!');
    pushLog(`${icon} ${label}`, lines);
    diceService.broadcastAction(label, attacker.name, r.total >= HIT_THRESHOLD, isCrit, `${label}: ${r.total}`).catch(() => {});
  }, [attacker, pushLog]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d0d14] border border-[#1a1a2a] rounded-xl w-[380px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-2 border-b border-[#1a1a2a]">
          <div className="flex items-center justify-between">
            <h3 className="font-cinzel text-sm text-gold">⚔ Панель монстра</h3>
            <button onClick={onClose} className="text-faded hover:text-bone text-xs">✕</button>
          </div>
          <p className="text-[10px] text-faded mt-1">{attacker.name}</p>
        </div>

        <div className="px-4 py-3 space-y-4 overflow-y-auto">

          {/* ⚔ Атака оружием — без выбора цели: просто прокидок */}
          {activeWeapon && (
            <div className="space-y-2">
              <div className="text-[9px] text-faded uppercase tracking-wider">⚔ Атака оружием</div>
              <select value={activeWeapon.id} onChange={(e) => setWeaponId(e.target.value)}
                className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1.5 text-bone text-xs focus:border-gold-dark focus:outline-none">
                {attacker.weapons.map(w => (
                  <option key={w.id} value={w.id}>
                    {(w.weaponType ?? 'melee') === 'melee' ? '🗡' : '🏹'} {w.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-1">
                {(['normal', 'advantage', 'disadvantage'] as const).map(mod => (
                  <button key={mod} onClick={() => setModifier(mod)}
                    className={`flex-1 py-1 text-[9px] rounded font-cinzel transition-all ${
                      modifier === mod
                        ? mod === 'advantage' ? 'bg-green-900/50 text-green-400 border border-green-800/50'
                          : mod === 'disadvantage' ? 'bg-blood-dark/50 text-blood-bright border border-blood/30'
                          : 'bg-gold-dark/20 text-gold border border-gold-dark/30'
                        : 'text-faded hover:text-bone border border-transparent'
                    }`}>
                    {mod === 'normal' ? 'Обычный' : mod === 'advantage' ? '🎯 Преим.' : '💨 Помеха'}
                  </button>
                ))}
              </div>

              <div className="text-[9px] text-faded space-y-0.5">
                <div>Тип: <span className="text-bone">{(activeWeapon.weaponType ?? 'melee') === 'melee' ? '🗡 Ближнее — урон +5×физ.сила' : '🏹 Дальнее — урон +3×ловкость'}</span></div>
                <div>Формула: <span className="text-bone font-mono">{activeWeapon.damageFormula}</span> ({ELEMENT_NAMES_MAP[activeWeapon.damageType] ?? activeWeapon.damageType})</div>
                <div>Бонус попадания: <span className="text-bone">+{activeWeapon.hitBonus}</span> · Бонус урона: <span className="text-bone">+{Math.floor(((activeWeapon.weaponType ?? 'melee') === 'melee' ? attacker.stats.physicalPower : attacker.stats.dexterity) || 0) * ((activeWeapon.weaponType ?? 'melee') === 'melee' ? 5 : 3)}</span></div>
              </div>

              <button onClick={executeAttack}
                className="w-full py-2.5 rounded-lg font-cinzel text-sm font-bold bg-blood-dark text-blood-bright hover:bg-blood border border-blood/50 transition-all">
                ⚔ Прокинуть атаку
              </button>
            </div>
          )}

          {/* ✨ Каст заклинания — как у игроков, без траты маны */}
          {activeSpell && (
            <div className="space-y-2">
              <div className="text-[9px] text-faded uppercase tracking-wider">✨ Каст заклинания (без траты маны)</div>
              <select value={activeSpell.id} onChange={(e) => setSpellId(e.target.value)}
                className="w-full bg-[#1a1a2a] border border-[#2a2a3a] rounded px-2 py-1.5 text-bone text-xs focus:border-gold-dark focus:outline-none">
                {attacker.spells.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button onClick={executeCast} disabled={isCasting}
                className={`w-full py-2 rounded-lg font-cinzel text-sm font-bold transition-all ${
                  isCasting
                    ? 'bg-[#1a1a2a] text-faded/50 border border-transparent cursor-not-allowed'
                    : 'bg-[#1a2a4a] text-[#7aa2ff] hover:bg-[#22366a] border border-[#2244aa]/50'
                }`}>
                {isCasting ? '⏳ Каст...' : '✨ Кастануть'}
              </button>
            </div>
          )}

          {/* 🎲 Быстрые прокидки d20 на характеристики */}
          <div className="space-y-2">
            <div className="text-[9px] text-faded uppercase tracking-wider">🎲 Быстрая прокидка d20</div>
            <div className="grid grid-cols-3 gap-1">
              {QUICK_STATS.map(({ key, label, icon }) => (
                <button key={key} onClick={() => quickRoll(key, label, icon)}
                  className="py-1.5 text-[9px] rounded bg-[#1a1a2a] text-faded hover:text-bone hover:border-gold-dark/40 border border-[#2a2a3a] transition-all">
                  {icon} {label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Результат последнего действия */}
          {log.length > 0 && (
            <div className="bg-[#111118] rounded-lg p-3 space-y-1 border border-[#1a1a2a]/50" key={logKey}>
              {logTitle && <div className="text-xs text-gold font-cinzel">{logTitle}</div>}
              <div className="space-y-0.5">
                {log.map((line, i) => (
                  <div key={i} className="text-[10px] text-faded/90 font-sans">{line}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
