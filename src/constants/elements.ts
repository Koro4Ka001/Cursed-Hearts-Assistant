// src/constants/elements.ts

// ═══════════════════════════════════════════════════════════════════════════
// ЕДИНЫЙ РЕЕСТР ЭЛЕМЕНТОВ И ТИПОВ УРОНА
// ═══════════════════════════════════════════════════════════════════════════

export interface MagicElementInfo {
  id: string;        // ID (русский для магии, англ для физики)
  name: string;      // Отображаемое название
  icon: string;      // Иконка
  color: string;     // Цвет (для эффектов)
  isSecret?: boolean;// Тайная магия?
}

export const GAME_ELEMENTS: MagicElementInfo[] = [
  // --- БАЗОВЫЕ (12) ---
  { id: 'огонь', name: 'Огонь', icon: '🔥', color: '#ff4500' },
  { id: 'вода', name: 'Вода', icon: '💧', color: '#1e90ff' },
  { id: 'земля', name: 'Земля', icon: '🪨', color: '#8b4513' },
  { id: 'воздух', name: 'Воздух', icon: '💨', color: '#87ceeb' },
  { id: 'свет', name: 'Свет', icon: '✨', color: '#ffd700' },
  { id: 'пространство', name: 'Пространство', icon: '🌀', color: '#9370db' },
  { id: 'астрал', name: 'Астрал', icon: '🌟', color: '#daa520' },
  { id: 'скверна', name: 'Скверна', icon: '☠️', color: '#9932cc' },
  { id: 'электричество', name: 'Электричество', icon: '⚡', color: '#00ffff' },
  { id: 'тьма', name: 'Тьма', icon: '🌑', color: '#4b0082' },
  { id: 'пустота', name: 'Пустота', icon: '🕳️', color: '#2f2f2f' },
  { id: 'жизнь', name: 'Жизнь', icon: '💚', color: '#32cd32' },

  // --- ТАЙНЫЕ ---
  { id: 'смерть', name: 'Смерть', icon: '💀', color: '#2f4f4f', isSecret: true },
  { id: 'ужас', name: 'Ужас', icon: '😱', color: '#4a0a0a', isSecret: true },
  { id: 'запредельность', name: 'Запредельность', icon: '🔮', color: '#ff69b4', isSecret: true },

  // --- ФИЗИЧЕСКИЕ (оставляем англ ID для совместимости с броней) ---
  { id: 'slashing', name: 'Режущий', icon: '🔪', color: '#aaaaaa' },
  { id: 'piercing', name: 'Колющий', icon: '🗡️', color: '#aaaaaa' },
  { id: 'bludgeoning', name: 'Дробящий', icon: '🔨', color: '#aaaaaa' },
  { id: 'chopping', name: 'Рубящий', icon: '🪓', color: '#aaaaaa' },
  
  // --- ОСОБЫЕ ---
  { id: 'pure', name: 'Чистый', icon: '⚔️', color: '#ffffff' },
];

// Хелперы
export const MAGIC_ELEMENTS = GAME_ELEMENTS
  .filter(e => !['slashing', 'piercing', 'bludgeoning', 'chopping', 'pure'].includes(e.id))
  .map(e => e.id); 

export const ELEMENT_ICONS: Record<string, string> = 
  Object.fromEntries(GAME_ELEMENTS.map(e => [e.id, e.icon]));

export const ELEMENT_COLORS: Record<string, string> = 
  Object.fromEntries(GAME_ELEMENTS.map(e => [e.id, e.color]));

export const ELEMENT_NAMES_MAP: Record<string, string> = 
  Object.fromEntries(GAME_ELEMENTS.map(e => [e.id, e.name]));

// Типы заклинаний
export const SPELL_TYPES = {
  targeted: 'Направленное',
  aoe: 'По площади',
  self: 'На себя',
  summon: 'Призыв',
  utility: 'Утилита'
} as const;

export type SpellType = keyof typeof SPELL_TYPES;

// === МНОГОШАГОВЫЕ ЗАКЛИНАНИЯ ===

import type { DamageType } from '../types';

// Дефолтная таблица (на русском!)
export const DEFAULT_ELEMENT_TABLE: Record<number, DamageType> = {
  1: 'огонь',
  2: 'вода',
  3: 'земля',
  4: 'воздух',
  5: 'электричество',
  6: 'свет',
  7: 'тьма',
  8: 'жизнь',
  9: 'скверна',
  10: 'пустота',
  11: 'пространство',
  12: 'астрал'
};

export const DEFAULT_DAMAGE_TIERS: Array<{
  minRoll: number;
  maxRoll: number;
  formula: string;
  label?: string;
}> = [
  { minRoll: 1, maxRoll: 3, formula: 'd6', label: 'Слабый' },
  { minRoll: 4, maxRoll: 7, formula: '2d12', label: 'Средний' },
  { minRoll: 8, maxRoll: 12, formula: '4d12+2d10', label: 'Сильный' },
  { minRoll: 13, maxRoll: 16, formula: '4d20+2d12', label: 'Мощный' },
  { minRoll: 17, maxRoll: 20, formula: '8d20', label: 'Разрушительный' }
];
