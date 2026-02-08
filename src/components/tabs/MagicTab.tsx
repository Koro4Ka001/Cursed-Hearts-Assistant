import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, DiceResultDisplay, Checkbox, ProgressBar } from '@/components/ui';
import { rollD20, rollDice, rollDamageWithCrit } from '@/utils/dice';
import { getStatDamageBonus } from '@/utils/damage';
import type { Spell } from '@/types';
import { cn } from '@/utils/cn';

interface SpellResult {
  label: string;
  roll: number;
  bonus: number;
  total: number;
  success?: boolean;
  isCrit?: boolean;
  isCritFail?: boolean;
  details?: string;
}

export function MagicTab() {
  const unit = useGameStore((s) => s.getSelectedUnit());
  const setMana = useGameStore((s) => s.setMana);
  const addLog = useGameStore((s) => s.addLog);
  const addNotification = useGameStore((s) => s.addNotification);
  const logToDocs = useGameStore((s) => s.logToDocs);

  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [doubleShot, setDoubleShot] = useState(false);
  const [spellResults, setSpellResults] = useState<SpellResult[]>([]);

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="text-3xl mb-2">✨</span>
        <p className="text-[12px] text-[#7a6f62]">Выберите или создайте юнита в ⚙️</p>
      </div>
    );
  }

  const selectedSpell = unit.spells.find((s) => s.id === selectedSpellId);
  const effectiveCost = selectedSpell ? selectedSpell.manaCost * (doubleShot ? 2 : 1) : 0;
  const canCast = selectedSpell && unit.mana.current >= effectiveCost;
  const castThreshold = doubleShot ? 18 : 11;

  const getMaxElementBonus = (spell: Spell): number => {
    if (spell.elements.length === 0) return 0;
    return Math.max(0, ...spell.elements.map((el) => unit.magicBonuses[el] ?? 0));
  };

  const handleCast = () => {
    if (!selectedSpell || !canCast) return;

    // Deduct mana immediately
    setMana(unit.id, unit.mana.current - effectiveCost);

    const results: SpellResult[] = [];
    const magicBonus = getMaxElementBonus(selectedSpell);

    // Cast roll
    const castRoll = rollD20(magicBonus);
    const castSuccess = castRoll.isCrit || (!castRoll.isCritFail && castRoll.total > castThreshold);

    results.push({
      label: 'Каст',
      roll: castRoll.rolls[0], bonus: magicBonus, total: castRoll.total,
      success: castSuccess, isCrit: castRoll.isCrit, isCritFail: castRoll.isCritFail,
      details: `порог ${castThreshold}`,
    });

    if (!castSuccess) {
      setSpellResults(results);
      const msg = `❌ ${selectedSpell.name} — провал! (-${effectiveCost}MP)`;
      addLog({ unitName: unit.shortName, message: msg, type: 'spell' });
      addNotification({ type: 'error', title: 'Провал!', message: `Мана потрачена: ${effectiveCost}` });
      logToDocs(msg);
      return;
    }

    // Success
    if (selectedSpell.type === 'self' || selectedSpell.type === 'summon') {
      results.push({
        label: 'Применено',
        roll: 0, bonus: 0, total: 0, success: true,
        details: selectedSpell.description || (selectedSpell.type === 'summon' ? 'Призыв!' : 'На себя'),
      });
    } else if (selectedSpell.type === 'aoe' && selectedSpell.damageFormula) {
      const statBonus = getStatDamageBonus('intelligence', unit);
      const dmgRoll = rollDamageWithCrit(selectedSpell.damageFormula, statBonus, castRoll.isCrit);
      results.push({
        label: 'AOE Урон',
        roll: dmgRoll.rolls.reduce((a, b) => a + b, 0), bonus: statBonus, total: dmgRoll.total,
        details: `${selectedSpell.damageType || 'маг'}${castRoll.isCrit ? ' ×2🎲' : ''}`,
      });
    } else if (selectedSpell.type === 'targeted') {
      for (let i = 0; i < selectedSpell.projectiles; i++) {
        if (selectedSpell.canDodge) {
          const hitRoll = rollD20(magicBonus);
          const hit = hitRoll.isCrit || (!hitRoll.isCritFail && hitRoll.total > 11);

          results.push({
            label: `Снаряд ${i + 1}`,
            roll: hitRoll.rolls[0], bonus: magicBonus, total: hitRoll.total,
            success: hit, isCrit: hitRoll.isCrit, isCritFail: hitRoll.isCritFail,
          });

          if (hit && selectedSpell.damageFormula) {
            const statBonus = getStatDamageBonus('intelligence', unit);
            const dmgRoll = rollDamageWithCrit(selectedSpell.damageFormula, statBonus, hitRoll.isCrit);
            results.push({
              label: `  → Урон`,
              roll: dmgRoll.rolls.reduce((a, b) => a + b, 0), bonus: statBonus, total: dmgRoll.total,
              details: selectedSpell.damageType || 'маг',
            });
          }
        } else {
          // AUTO-HIT — NO d20 roll
          if (selectedSpell.damageFormula) {
            const statBonus = getStatDamageBonus('intelligence', unit);
            const dmgRoll = rollDice(selectedSpell.damageFormula, statBonus);
            results.push({
              label: `Снаряд ${i + 1}`,
              roll: dmgRoll.rolls.reduce((a, b) => a + b, 0), bonus: statBonus, total: dmgRoll.total,
              success: true,
              details: 'АВТО ✓',
            });
          }
        }
      }
    }

    setSpellResults(results);
    const msg = `✨ ${selectedSpell.name} — успех! (-${effectiveCost}MP)`;
    addLog({ unitName: unit.shortName, message: msg, type: 'spell' });
    addNotification({ type: 'success', title: selectedSpell.name, message: 'Заклинание успешно!' });
    logToDocs(msg);
  };

  return (
    <div className="space-y-2 animate-[fadeSlideIn_200ms]">
      {/* Mana bar with controls */}
      <ProgressBar
        current={unit.mana.current}
        max={unit.mana.max}
        type="mana"
        icon="💠"
        showControls
        onAdjust={(amount) => setMana(unit.id, unit.mana.current + amount)}
      />

      {/* Spell List */}
      <Section title="Заклинания" icon="📖">
        {unit.spells.length === 0 ? (
          <p className="text-[11px] text-[#7a6f62] italic">Нет заклинаний. Добавьте в ⚙️</p>
        ) : (
          <div className="space-y-1">
            {unit.spells.map((spell) => {
              const maxBonus = getMaxElementBonus(spell);
              const cost = spell.manaCost * (doubleShot ? 2 : 1);
              const canAfford = unit.mana.current >= cost;

              return (
                <button
                  key={spell.id}
                  onClick={() => setSelectedSpellId(spell.id === selectedSpellId ? null : spell.id)}
                  className={cn(
                    'w-full text-left px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer',
                    spell.id === selectedSpellId
                      ? 'bg-[#1a1816] border-[#d4a726] shadow-[0_0_6px_rgba(212,167,38,0.15)]'
                      : canAfford
                        ? 'bg-[#161412] border-[#3a332a] hover:border-[#7a6f62]'
                        : 'bg-[#161412] border-[#3a332a] opacity-40'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-[#d4c8b8]">{spell.name}</span>
                    <span className="ml-auto text-[10px] text-[#4a9eff] font-mono">{cost}MP</span>
                  </div>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {spell.elements.map((el) => (
                      <span key={el} className="text-[8px] px-1 py-0 rounded bg-[#0c0a09] text-[#7a6f62]">{el}</span>
                    ))}
                    <span className="text-[8px] px-1 py-0 rounded bg-[#0c0a09] text-[#7a6f62]">+{maxBonus}</span>
                    {spell.type === 'targeted' && (
                      <span className="text-[8px] px-1 py-0 rounded bg-[#0c0a09] text-[#7a6f62]">
                        {spell.projectiles}× {spell.canDodge ? 'увор' : 'авто'}
                      </span>
                    )}
                  </div>
                  {spell.damageFormula && (
                    <div className="mt-0.5 text-[9px] text-[#7a6f62]">
                      💥 {spell.damageFormula}+{unit.stats.intelligence * 3}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* Cast controls */}
      {selectedSpell && (
        <Section title="Сотворение" icon="🔮">
          <div className="space-y-2">
            <div className="bg-[#161412] rounded p-2 text-[10px] text-[#b8a892] space-y-0.5">
              <div className="font-bold text-[#d4a726] text-[11px]">{selectedSpell.name}</div>
              {selectedSpell.description && <div>{selectedSpell.description}</div>}
              <div className="flex gap-3">
                <span>💠 {effectiveCost}MP</span>
                <span>🎯 порог {castThreshold}</span>
                <span>🎲 +{getMaxElementBonus(selectedSpell)}</span>
              </div>
            </div>

            <Checkbox checked={doubleShot} onChange={setDoubleShot} label={`ДаблШот (×2 мана, порог 18)`} />

            <Button variant="gold" className="w-full" onClick={handleCast} disabled={!canCast}>
              {!canCast ? `Мало маны (${unit.mana.current}/${effectiveCost})` : `✨ Каст — ${effectiveCost}MP`}
            </Button>
          </div>
        </Section>
      )}

      {spellResults.length > 0 && <DiceResultDisplay title="Результат" results={spellResults} />}
    </div>
  );
}
