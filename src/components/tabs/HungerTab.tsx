// src/components/tabs/HungerTab.tsx
// 🍖 Голод (сытость): существо умеет считать только до 50 — все значения в
// формате N×50(+M). Сытость скейлит броню (ступенями) и обменивается на HP.

import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, EmptyState, NumberStepper } from '../ui';
import { SortableTab } from '../SortableTab';
import { rollDice } from '../../utils/dice';
import { formatHungerValue, parseHungerText, getHungerArmorBonus, defaultHungerConfig } from '../../utils/hunger';

// Цвет шкалы — как у бара на токене: янтарь / кость / пепел
function hungerBarColor(pct: number): string {
  if (pct <= 0.33) return '#5a4a3a';
  if (pct < 0.66) return '#b0a080';
  return '#d9a441';
}

export function HungerTab() {
  const unit = useGameStore(s => s.units.find(u => u.id === s.selectedUnitId));
  const updateUnit = useGameStore(s => s.updateUnit);
  const setHunger = useGameStore(s => s.setHunger);
  const addHunger = useGameStore(s => s.addHunger);
  const regenHunger = useGameStore(s => s.regenHunger);
  const addNotification = useGameStore(s => s.addNotification);

  const [amountText, setAmountText] = useState('50');
  const [busy, setBusy] = useState(false);

  if (!unit) {
    return (
      <EmptyState icon="🍖" title="Нет персонажа" description="Выберите персонажа" />
    );
  }

  if (!unit.hasHunger) {
    return (
      <EmptyState
        icon="🍖"
        title="Голод недоступен"
        description="Включите Голод в настройках персонажа"
        action={
          <Button
            variant="gold"
            onClick={() => updateUnit(unit.id, {
              hasHunger: true,
              hunger: unit.hunger ?? { current: 0, max: 1000 },
              hungerConfig: unit.hungerConfig ?? defaultHungerConfig(),
            })}
          >
            🍖 Включить Голод
          </Button>
        }
      />
    );
  }

  const cfg = unit.hungerConfig ?? defaultHungerConfig();
  const cur = unit.hunger?.current ?? 0;
  const max = unit.hunger?.max ?? 1000;
  const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
  const physBonus = getHungerArmorBonus(unit, 'physical');
  const magBonus = getHungerArmorBonus(unit, 'magical');
  const formatted = formatHungerValue(cur);

  // Ввод: просто число («50») или формула куба («2d20», «d100+20»)
  const applyAmount = async (sign: 1 | -1) => {
    const text = amountText.trim();
    if (!text) return;
    setBusy(true);
    try {
      let delta: number;
      if (/\d*d\d+/i.test(text)) {
        const r = rollDice(text, undefined, 'normal');
        delta = Math.max(0, r.total);
      } else {
        delta = parseHungerText(text);
      }
      if (delta > 0) await addHunger(unit.id, sign * delta);
      else addNotification('Введи число или формулу куба (например 50 или 2d20)', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const updateCfg = (updates: Partial<typeof cfg>) => {
    const merged = { ...cfg, ...updates } as typeof cfg;
    if (merged.step <= 0) merged.step = 45;
    updateUnit(unit.id, { hungerConfig: merged });
  };

  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      <SortableTab tabId="hunger">
      <Section title="Голод" icon="🍖" sortableId="hunger.main">
        <div className="space-y-3">

          {/* Значение в «манере существа» + шкала */}
          <div className="p-3 bg-obsidian rounded border border-edge-bone">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] text-ancient font-cinzel uppercase tracking-wider">🍖 Сытость</span>
              <span className="text-[10px] text-faded">макс: {formatHungerValue(max)}</span>
            </div>
            <div className="text-2xl font-cinzel text-gold mt-1">[{formatted}]</div>
            <div className="mt-2 h-2.5 rounded bg-black/40 overflow-hidden">
              <div
                className="h-full rounded transition-all duration-300"
                style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: hungerBarColor(pct) }}
              />
            </div>
            {/* Броня от сытости — сразу пересчитывается при изменении */}
            <div className="text-xs text-faded mt-2">
              🛡 Броня сейчас: <span className="text-bone">+{physBonus} физ</span> / <span className="text-bone">+{magBonus} маг</span>
              <span className="text-ancient"> ({Math.floor(cur / cfg.step)} × {cfg.step})</span>
            </div>
          </div>

          {/* Изменить: число или куб */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void applyAmount(1); }}
                placeholder="50 или 2d20"
                className="flex-1 bg-obsidian border border-edge-bone text-bone rounded px-2 py-1.5 text-sm focus:border-gold outline-none"
              />
              <Button variant="secondary" disabled={busy} onClick={() => void applyAmount(-1)} className="px-3">−</Button>
              <Button variant="gold" disabled={busy} onClick={() => void applyAmount(1)} className="px-3">+</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[10, 50, 100].map(n => (
                <Button key={`m${n}`} variant="secondary" size="sm" disabled={busy} onClick={() => void addHunger(unit.id, -n)}>−{n}</Button>
              ))}
              {[10, 50, 100].map(n => (
                <Button key={`p${n}`} variant="secondary" size="sm" disabled={busy} onClick={() => void addHunger(unit.id, n)}>+{n}</Button>
              ))}
            </div>
          </div>

          {/* 🩸 Пассивная регенерация: −сытость → +HP (просто кнопка, раз в ход — сам следишь) */}
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => { setBusy(true); try { await regenHunger(unit.id); } finally { setBusy(false); } }}
            className="w-full text-sm py-3"
          >
            🩸 Пассивная регенерация: +{cfg.regen.hp} HP за {cfg.regen.hungerCost} сытости
          </Button>
        </div>
      </Section>

      <Section title="Настройки голода" icon="⚙️" collapsible defaultOpen={false} sortableId="hunger.config">
        <div className="space-y-2">
          <NumberStepper
            label="Ступень сытости"
            value={cfg.step}
            onChange={(v) => updateCfg({ step: v })}
            min={1}
            max={500}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper
              label="Броня физ / ступень"
              value={cfg.armorPerStep.physical}
              onChange={(v) => updateCfg({ armorPerStep: { ...cfg.armorPerStep, physical: v } })}
              min={0}
              max={100}
            />
            <NumberStepper
              label="Броня маг / ступень"
              value={cfg.armorPerStep.magical}
              onChange={(v) => updateCfg({ armorPerStep: { ...cfg.armorPerStep, magical: v } })}
              min={0}
              max={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper
              label="Реген: HP"
              value={cfg.regen.hp}
              onChange={(v) => updateCfg({ regen: { ...cfg.regen, hp: v } })}
              min={1}
              max={100}
            />
            <NumberStepper
              label="Реген: сытости"
              value={cfg.regen.hungerCost}
              onChange={(v) => updateCfg({ regen: { ...cfg.regen, hungerCost: v } })}
              min={1}
              max={500}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper
              label="Текущая сытость"
              value={cur}
              onChange={(v) => void setHunger(unit.id, v)}
              min={0}
              max={max}
            />
            <NumberStepper
              label="Максимум"
              value={max}
              onChange={(v) => updateUnit(unit.id, { hunger: { current: Math.min(cur, Math.max(1, v)), max: Math.max(1, v) } })}
              min={1}
              max={100000}
            />
          </div>
          <div className="text-[10px] text-faded">
            💡 В Google Docs пишется как <code className="text-ancient">Голод: [{formatHungerValue(cur)}]/{formatHungerValue(max)}</code> — существо считает только до 50.
          </div>
        </div>
      </Section>
      </SortableTab>
    </div>
  );
}
