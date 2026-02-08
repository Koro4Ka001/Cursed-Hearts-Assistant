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

  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [doubleShot, setDoubleShot] = useState(false);
  const [spellResults, setSpellResults] = useState<SpellResult[]>([]);

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">✨</span>
        <p className="text-sm text-[#7a6f62]">Выберите или создайте юнита в настройках</p>
      </div>
    );
  }

  const selectedSpell = unit.spells.find((s) => s.id === selectedSpellId);
  const effectiveCost = selectedSpell ? selectedSpell.manaCost * (doubleShot ? 2 : 1) : 0;
  const canCast = selectedSpell && unit.mana.current >= effectiveCost;
  const castThreshold = doubleShot ? 18 : 11;

  const getMaxElementBonus = (spell: Spell): number => {
    if (spell.elements.length === 0) return 0;
    return Math.max(...spell.elements.map((el) => unit.magicBonuses[el] ?? 0));
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
      roll: castRoll.rolls[0],
      bonus: magicBonus,
      total: castRoll.total,
      success: castSuccess,
      isCrit: castRoll.isCrit,
      isCritFail: castRoll.isCritFail,
      details: `Порог: ${castThreshold}`,
    });

    if (!castSuccess) {
      results.push({
        label: 'Провал!',
        roll: 0, bonus: 0, total: 0,
        details: `Мана потрачена: ${effectiveCost}`,
      });
      setSpellResults(results);
      addLog({ unitName: unit.shortName, message: `❌ ${selectedSpell.name} — провал каста! (-${effectiveCost} маны)`, type: 'spell' });
      addNotification({ type: 'error', title: 'Провал каста!', message: `${selectedSpell.name} — мана потрачена впустую` });
      return;
    }

    // Success!
    if (selectedSpell.type === 'self' || selectedSpell.type === 'summon') {
      results.push({
        label: 'Применено!',
        roll: 0, bonus: 0, total: 0,
        success: true,
        details: selectedSpell.description || selectedSpell.type === 'summon' ? 'Призыв!' : 'На себя',
      });
    } else if (selectedSpell.type === 'aoe' && selectedSpell.damageFormula) {
      const statBonus = getStatDamageBonus('intelligence', unit);
      const dmgRoll = rollDamageWithCrit(selectedSpell.damageFormula, statBonus, castRoll.isCrit);
      results.push({
        label: 'AOE Урон',
        roll: dmgRoll.rolls.reduce((a, b) => a + b, 0),
        bonus: statBonus,
        total: dmgRoll.total,
        details: `${selectedSpell.damageType || 'магический'}${castRoll.isCrit ? ' (×2 кубики)' : ''}`,
      });
    } else if (selectedSpell.type === 'targeted') {
      for (let i = 0; i < selectedSpell.projectiles; i++) {
        if (selectedSpell.canDodge) {
          // Hit roll required
          const hitRoll = rollD20(magicBonus);
          const hit = hitRoll.isCrit || (!hitRoll.isCritFail && hitRoll.total > 11);

          results.push({
            label: `Снаряд ${i + 1}: Попад.`,
            roll: hitRoll.rolls[0],
            bonus: magicBonus,
            total: hitRoll.total,
            success: hit,
            isCrit: hitRoll.isCrit,
            isCritFail: hitRoll.isCritFail,
          });

          if (hit && selectedSpell.damageFormula) {
            const statBonus = getStatDamageBonus('intelligence', unit);
            const dmgRoll = rollDamageWithCrit(selectedSpell.damageFormula, statBonus, hitRoll.isCrit);
            results.push({
              label: `Снаряд ${i + 1}: Урон`,
              roll: dmgRoll.rolls.reduce((a, b) => a + b, 0),
              bonus: statBonus,
              total: dmgRoll.total,
              details: selectedSpell.damageType || 'магический',
            });
          }
        } else {
          // Auto-hit! No d20 roll for hit
          if (selectedSpell.damageFormula) {
            const statBonus = getStatDamageBonus('intelligence', unit);
            const dmgRoll = rollDice(selectedSpell.damageFormula, statBonus);
            results.push({
              label: `Снаряд ${i + 1}: Авто`,
              roll: dmgRoll.rolls.reduce((a, b) => a + b, 0),
              bonus: statBonus,
              total: dmgRoll.total,
              success: true,
              details: `АВТОПОПАДАНИЕ — ${selectedSpell.damageType || 'магический'}`,
            });
          }
        }
      }
    }

    setSpellResults(results);
    addLog({
      unitName: unit.shortName,
      message: `✨ ${selectedSpell.name} — успех! (-${effectiveCost} маны)`,
      type: 'spell',
    });
    addNotification({ type: 'success', title: `${selectedSpell.name}`, message: 'Заклинание успешно!' });
  };

  return (
    <div className="space-y-3 animate-[fadeSlideIn_300ms]">
      {/* Mana bar */}
      <ProgressBar
        current={unit.mana.current}
        max={unit.mana.max}
        type="mana"
        icon="💠"
        label="Мана"
        showControls
        onAdjust={(amount) => setMana(unit.id, unit.mana.current + amount)}
      />

      {/* Spell List */}
      <Section title="Заклинания" icon="📖">
        {unit.spells.length === 0 ? (
          <p className="text-xs text-[#7a6f62] italic">Нет заклинаний. Добавьте в настройках.</p>
        ) : (
          <div className="space-y-1.5">
            {unit.spells.map((spell) => {
              const maxBonus = getMaxElementBonus(spell);
              const cost = spell.manaCost * (doubleShot ? 2 : 1);
              const canAfford = unit.mana.current >= cost;

              return (
                <button
                  key={spell.id}
                  onClick={() => setSelectedSpellId(spell.id === selectedSpellId ? null : spell.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg border transition-all cursor-pointer',
                    spell.id === selectedSpellId
                      ? 'bg-[#1a1816] border-[#d4a726] shadow-[0_0_8px_rgba(212,167,38,0.2)]'
                      : canAfford
                        ? 'bg-[#161412] border-[#3a332a] hover:border-[#7a6f62]'
                        : 'bg-[#161412] border-[#3a332a] opacity-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#d4c8b8]">{spell.name}</span>
                    <span className="ml-auto text-[10px] text-[#4a9eff] font-mono">{cost} MP</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {spell.elements.map((el) => (
                      <span key={el} className="text-[9px] px-1.5 py-0.5 rounded bg-[#0c0a09] text-[#7a6f62]">{el}</span>
                    ))}
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0c0a09] text-[#7a6f62]">
                      +{maxBonus} бонус
                    </span>
                    {spell.type === 'targeted' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0c0a09] text-[#7a6f62]">
                        {spell.projectiles}× {spell.canDodge ? 'уворот' : 'авто'}
                      </span>
                    )}
                  </div>
                  {spell.damageFormula && (
                    <div className="mt-1 text-[10px] text-[#b8a892]">
                      💥 {spell.damageFormula} + {unit.stats.intelligence * 3} (инт)
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
          <div className="space-y-3">
            <div className="bg-[#161412] rounded-lg p-3 text-xs text-[#b8a892]">
              <div className="font-bold text-[#d4a726] mb-1">{selectedSpell.name}</div>
              {selectedSpell.description && <div className="mb-1">{selectedSpell.description}</div>}
              <div>💠 Стоимость: {effectiveCost} маны</div>
              <div>🎯 Порог каста: {castThreshold}</div>
              <div>🎲 Бонус: +{getMaxElementBonus(selectedSpell)}</div>
              {selectedSpell.range && <div>📏 Дальность: {selectedSpell.range}</div>}
              {selectedSpell.duration && <div>⏱️ Длительность: {selectedSpell.duration}</div>}
            </div>

            <Checkbox
              checked={doubleShot}
              onChange={setDoubleShot}
              label={`ДаблШот (×2 мана, порог ${18})`}
            />

            <Button
              variant="gold"
              size="lg"
              className="w-full"
              onClick={handleCast}
              disabled={!canCast}
            >
              {!canCast ? `Мало маны (${unit.mana.current}/${effectiveCost})` : `✨ Сотворить — ${effectiveCost} MP`}
            </Button>
          </div>
        </Section>
      )}

      {/* Results */}
      {spellResults.length > 0 && <DiceResultDisplay title="Результат заклинания" results={spellResults} />}
    </div>
  );
}
