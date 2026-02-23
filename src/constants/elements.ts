// src/constants/elements.ts

// ═══════════════════════════════════════════════════════════════════════════
// ЕДИНЫЙ РЕЕСТР ЭЛЕМЕНТОВ И ТИПОВ УРОНА
// ═══════════════════════════════════════════════════════════════════════════

export interface MagicElementInfo {
  id: string;        // Английский ID (для кода)
  name: string;      // Русское название (для UI)
  icon: string;      // Иконка
  color: string;     // Цвет (для эффектов)
  isSecret?: boolean;// Тайная магия?
}

// 12 Базовых + Тайные + Физика
export const GAME_ELEMENTS: MagicElementInfo[] = [
  // --- БАЗОВЫЕ (12) ---
  { id: 'fire', name: 'Огонь', icon: '🔥', color: '#ff4500' },
  { id: 'water', name: 'Вода', icon: '💧', color: '#1e90ff' },
  { id: 'earth', name: 'Земля', icon: '🪨', color: '#8b4513' },
  { id: 'air', name: 'Воздух', icon: '💨', color: '#87ceeb' },
  { id: 'light', name: 'Свет', icon: '✨', color: '#ffd700' },
  { id: 'space', name: 'Пространство', icon: '🌀', color: '#9370db' },
  { id: 'astral', name: 'Астрал', icon: '🌟', color: '#daa520' },
  { id: 'corruption', name: 'Скверна', icon: '☠️', color: '#9932cc' },
  { id: 'electricity', name: 'Электричество', icon: '⚡', color: '#00ffff' },
  { id: 'darkness', name: 'Тьма', icon: '🌑', color: '#4b0082' },
  { id: 'void', name: 'Пустота', icon: '🕳️', color: '#2f2f2f' },
  { id: 'life', name: 'Жизнь', icon: '💚', color: '#32cd32' },

  // --- ТАЙНЫЕ ---
  { id: 'death', name: 'Смерть', icon: '💀', color: '#2f4f4f', isSecret: true },
  { id: 'horror', name: 'Ужас', icon: '😱', color: '#4a0a0a', isSecret: true },
  { id: 'transcendence', name: 'Запредельность', icon: '🔮', color: '#ff69b4', isSecret: true },

  // --- ФИЗИЧЕСКИЕ (для оружия) ---
  { id: 'slashing', name: 'Режущий', icon: '🔪', color: '#aaaaaa' },
  { id: 'piercing', name: 'Колющий', icon: '🗡️', color: '#aaaaaa' },
  { id: 'bludgeoning', name: 'Дробящий', icon: '🔨', color: '#aaaaaa' },
  { id: 'chopping', name: 'Рубящий', icon: '🪓', color: '#aaaaaa' },
  
  // --- ОСОБЫЕ ---
  { id: 'pure', name: 'Чистый', icon: '⚔️', color: '#ffffff' },
];

// Хелперы для быстрого доступа
export const MAGIC_ELEMENTS = GAME_ELEMENTS
  .filter(e => !['slashing', 'piercing', 'bludgeoning', 'chopping', 'pure'].includes(e.id))
  .map(e => e.id); // Возвращает массив ID ['fire', 'water'...]

export const ELEMENT_ICONS: Record<string, string> = 
  Object.fromEntries(GAME_ELEMENTS.map(e => [e.id, e.icon]));

export const ELEMENT_COLORS: Record<string, string> = 
  Object.fromEntries(GAME_ELEMENTS.map(e => [e.id, e.color]));

export const ELEMENT_NAMES_MAP: Record<string, string> = 
  Object.fromEntries(GAME_ELEMENTS.map(e => [e.id, e.name]));

// Типы заклинаний (оставляем как было)
export const SPELL_TYPES = {
  targeted: 'Направленное',
  aoe: 'По площади',
  self: 'На себя',
  summon: 'Призыв',
  utility: 'Утилита'
} as const;

export type SpellType = keyof typeof SPELL_TYPES;
