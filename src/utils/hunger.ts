// src/utils/hunger.ts
// 🍖 «Голод»: существо умеет считать только до 50, поэтому все значения
// отображаются в формате N×50(+M): 1000 → «20x50», 990 → «19x50+40», 210 → «4x50+10».

import type { Unit } from '../types';

export const HUNGER_STEP_SIZE = 50;

/** Число → формат существа: 990 → «19x50+40» */
export function formatHungerValue(n: number): string {
  const v = Math.max(0, Math.floor(n));
  const f = Math.floor(v / HUNGER_STEP_SIZE);
  const r = v % HUNGER_STEP_SIZE;
  return r === 0 ? `${f}x50` : `${f}x50+${r}`;
}

/** Текст «19x50+40» (или просто число) → число */
export function parseHungerText(s: string): number {
  const m = s.trim().match(/^(\d+)\s*x\s*50(?:\s*\+\s*(\d+))?$/i);
  if (m) return parseInt(m[1]!) * HUNGER_STEP_SIZE + (m[2] ? parseInt(m[2]) : 0);
  const v = parseInt(s.trim(), 10);
  return isNaN(v) ? 0 : v;
}

/** Бонус брони от сытости — СТУПЕНЯМИ: floor(сытость / step) × броня (pure не получает) */
export function getHungerArmorBonus(unit: Unit, category: string): number {
  if (!unit.hasHunger || !unit.hungerConfig || category === 'pure') return 0;
  const cur = unit.hunger?.current ?? 0;
  const step = unit.hungerConfig.step > 0 ? unit.hungerConfig.step : 45;
  const steps = Math.floor(cur / step);
  const per = category === 'physical'
    ? unit.hungerConfig.armorPerStep.physical
    : unit.hungerConfig.armorPerStep.magical;
  return Math.max(0, steps) * (per ?? 0);
}

/** Конфиг голода по умолчанию */
export function defaultHungerConfig() {
  return {
    step: 45,
    armorPerStep: { physical: 6, magical: 4 },
    regen: { hp: 3, hungerCost: 10 },
  };
}
