// ===== BASE TYPES =====
export type DamageType =
  | 'slashing' | 'piercing' | 'bludgeoning' | 'chopping'
  | 'fire' | 'water' | 'earth' | 'air' | 'light' | 'darkness'
  | 'electricity' | 'void' | 'life' | 'death' | 'astral'
  | 'corruption' | 'space' | 'blood' | 'frost' | 'nature'
  | 'transcendence' | 'pure';

export type DamageCategory = 'physical' | 'magical' | 'pure';

export type ProficiencyType = 'swords' | 'axes' | 'hammers' | 'polearms' | 'unarmed' | 'bows';

export type StatName = 'physicalPower' | 'dexterity' | 'intelligence' | 'vitality' | 'charisma' | 'initiative';

export type TabType = 'combat' | 'magic' | 'resources' | 'actions' | 'settings';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'not_configured';

// ===== WEAPON =====
export interface Weapon {
  id: string;
  name: string;
  weaponType: 'melee' | 'ranged';
  damageFormula?: string;
  damageType?: DamageType;
  hitBonus?: number;
  arrowsPerShot?: number;
  usesAmmo?: boolean;
  proficiencyType: ProficiencyType;
  statBonus: 'physicalPower' | 'dexterity' | 'none';
  range?: number;
  special?: string;
}

// ===== SPELL =====
export interface Spell {
  id: string;
  name: string;
  manaCost: number;
  elements: string[];
  type: 'targeted' | 'aoe' | 'self' | 'summon';
  projectiles: number;
  canDodge: boolean;
  damageFormula?: string;
  damageType?: string;
  range?: number;
  duration?: string;
  description?: string;
}

// ===== RESOURCE =====
export interface Resource {
  id: string;
  name: string;
  icon: string;
  current: number;
  max: number;
  resourceType: 'generic' | 'arrows' | 'consumable';
  damageFormula?: string;
  damageType?: DamageType;
  syncWithDocs?: boolean;
}

// ===== QUICK ACTION =====
export interface QuickAction {
  id: string;
  name: string;
  icon: string;
  description?: string;
  steps: ActionStep[];
}

export interface ActionStep {
  id: string;
  order: number;
  roll: {
    dice: string;
    bonuses: ActionBonus[];
  };
  threshold: number;
  onSuccess: ActionOutcome;
  onFailure: ActionOutcome;
}

export interface ActionBonus {
  type: 'stat' | 'proficiency' | 'flat';
  stat?: StatName;
  proficiency?: ProficiencyType;
  value?: number;
  multiplier?: number;
}

export interface ActionOutcome {
  type: 'next_step' | 'success' | 'failure' | 'damage' | 'heal';
  nextStepId?: string;
  damageFormula?: string;
  damageType?: DamageType;
  target?: 'self' | 'enemy';
  healFormula?: string;
  message?: string;
}

// ===== UNIT =====
export interface Unit {
  id: string;
  name: string;
  shortName: string;
  googleDocsHeader: string;
  owlbearTokenId?: string;
  health: { current: number; max: number };
  mana: { current: number; max: number };
  stats: Record<StatName, number>;
  proficiencies: Record<ProficiencyType, number>;
  magicBonuses: Record<string, number>;
  armor: {
    slashing: number;
    piercing: number;
    bludgeoning: number;
    chopping: number;
    magicBase: number;
    magicOverrides: Record<string, number>;
    undead: number;
  };
  damageMultipliers: Record<string, number>;
  weapons: Weapon[];
  spells: Spell[];
  resources: Resource[];
  quickActions: QuickAction[];
  hasRokCards: boolean;
}

// ===== NOTIFICATIONS =====
export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

// ===== LOG =====
export interface LogEntry {
  id: string;
  timestamp: number;
  unitName: string;
  message: string;
  type: 'attack' | 'spell' | 'damage' | 'heal' | 'resource' | 'action' | 'system';
}

// ===== ROLL RESULT =====
export interface RollResult {
  formula: string;
  rolls: number[];
  total: number;
  bonus: number;
  isCrit: boolean;
  isCritFail: boolean;
}

// ===== SETTINGS =====
export interface SyncSettings {
  googleDocsUrl: string;
  syncHP: boolean;
  syncMana: boolean;
  syncResources: boolean;
  writeLogs: boolean;
}

// ===== CONSTANTS =====
export const STAT_NAMES: Record<StatName, string> = {
  physicalPower: 'Физ. мощь',
  dexterity: 'Ловкость',
  intelligence: 'Интеллект',
  vitality: 'Живучесть',
  charisma: 'Харизма',
  initiative: 'Инициатива',
};

export const PROFICIENCY_NAMES: Record<ProficiencyType, string> = {
  swords: 'Мечи',
  axes: 'Топоры',
  hammers: 'Молоты',
  polearms: 'Древковое',
  unarmed: 'Рукопашный',
  bows: 'Луки',
};

export const DAMAGE_TYPE_NAMES: Record<DamageType, string> = {
  slashing: 'Режущий', piercing: 'Колющий', bludgeoning: 'Дробящий', chopping: 'Рубящий',
  fire: 'Огонь', water: 'Вода', earth: 'Земля', air: 'Воздух',
  light: 'Свет', darkness: 'Тьма', electricity: 'Электричество', void: 'Пустота',
  life: 'Жизнь', death: 'Смерть', astral: 'Астрал', corruption: 'Скверна',
  space: 'Пространство', blood: 'Кровь', frost: 'Мороз', nature: 'Природа',
  transcendence: 'Трансцендентность', pure: 'Чистый',
};

export const DAMAGE_TYPE_ICONS: Record<DamageType, string> = {
  slashing: '🗡️', piercing: '🏹', bludgeoning: '🔨', chopping: '🪓',
  fire: '🔥', water: '💧', earth: '🪨', air: '💨',
  light: '✨', darkness: '🌑', electricity: '⚡', void: '🕳️',
  life: '💚', death: '💀', astral: '🌟', corruption: '☠️',
  space: '🌌', blood: '🩸', frost: '❄️', nature: '🌿',
  transcendence: '🔮', pure: '⚪',
};

export const PHYSICAL_DAMAGE_TYPES: DamageType[] = ['slashing', 'piercing', 'bludgeoning', 'chopping'];
export const MAGICAL_DAMAGE_TYPES: DamageType[] = [
  'fire', 'water', 'earth', 'air', 'light', 'darkness',
  'electricity', 'void', 'life', 'death', 'astral', 'corruption',
  'space', 'blood', 'frost', 'nature', 'transcendence',
];

export function getDamageCategory(type: DamageType): DamageCategory {
  if (type === 'pure') return 'pure';
  if (PHYSICAL_DAMAGE_TYPES.includes(type)) return 'physical';
  return 'magical';
}

// ===== ROK CARD EFFECTS =====
export const ROK_EFFECTS: Record<number, { name: string; description: string }> = {
  1: { name: 'Стихийный удар', description: 'Накидывает эффект элемента (d12). Огонь поджигает, тьма слепит.' },
  2: { name: 'Элементальный барьер', description: 'Блокирует ВЕСЬ урон от случайного элемента (d12) на 1 раунд.' },
  3: { name: 'Архитектор хаоса', description: 'Создаёт постройку, размер по d6.' },
  4: { name: 'Целительный поток', description: 'd4, каждая единица = +d12 HP.' },
  5: { name: 'Восстание мёртвых', description: 'Призывает БЕСКОНТРОЛЬНУЮ нежить! Атакует ВСЕХ! Сила: d20.' },
  6: { name: 'Чистое разрушение', description: 'd4, каждая единица = +d12 чистого урона.' },
  7: { name: 'Инверсия удачи', description: '1 становится удачей, 20 — неудачей. 8 раундов на ВСЕХ!' },
  8: { name: 'Зеркальный двойник', description: 'Копия цели. Проверка d20 > 11.' },
  9: { name: 'Нестабильная аура', description: '5 раундов: d4 определяет эффект ауры.' },
  10: { name: 'Магический хаос', description: 'Триггерит случайное заклинание (d10).' },
  11: { name: 'Метка смерти', description: 'Следующий урон по цели УДВАИВАЕТСЯ. 1 раунд.' },
  12: { name: 'Червоточина', description: 'Открывается червоточина.' },
  13: { name: 'Рикошет неудачи', description: 'Карта летит в БЛИЖАЙШЕЕ существо, НОВЫЙ бросок d20 на эффект.' },
  14: { name: 'Временной щит', description: 'ОТМЕНЯЕТ весь урон этого раунда.' },
  15: { name: 'Мутация', description: 'Случайная характеристика (d6), d20 < 11 = -10, ≥ 11 = +10. 3 раунда.' },
  16: { name: 'Боевая ярость', description: '+20 урон, +40 HP.' },
  17: { name: 'Раздвоение', description: 'Бросить ещё 2 карты БЕЗ траты ресурса!' },
  18: { name: 'Портал измерений', description: 'd8: 1-Ад, 2-Пустота, 3-Лёд, 4-Эфир, 5-Мёртвые, 6-Кошмары, 7-Скверна, 8-Облачность.' },
  19: { name: 'Ужас', description: 'Цель получает страх, пытается сбежать.' },
  20: { name: 'Обмен жизнями', description: 'Обмен HP на 6 раундов. Проверка d20 > 11.' },
};

export const ELEMENT_LIST = [
  'Огонь', 'Вода', 'Земля', 'Воздух', 'Свет', 'Тьма',
  'Электричество', 'Пустота', 'Жизнь', 'Смерть', 'Астрал',
  'Скверна', 'Пространство', 'Кровь', 'Мороз', 'Природа', 'Трансцендентность',
];

export function createDefaultUnit(): Unit {
  return {
    id: crypto.randomUUID(),
    name: 'Новый юнит',
    shortName: 'Юнит',
    googleDocsHeader: '',
    health: { current: 100, max: 100 },
    mana: { current: 50, max: 50 },
    stats: { physicalPower: 0, dexterity: 0, intelligence: 0, vitality: 0, charisma: 0, initiative: 0 },
    proficiencies: { swords: 0, axes: 0, hammers: 0, polearms: 0, unarmed: 0, bows: 0 },
    magicBonuses: {},
    armor: { slashing: 0, piercing: 0, bludgeoning: 0, chopping: 0, magicBase: 0, magicOverrides: {}, undead: 0 },
    damageMultipliers: {},
    weapons: [],
    spells: [],
    resources: [],
    quickActions: [],
    hasRokCards: false,
  };
}
