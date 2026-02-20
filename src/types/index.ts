// src/types/index.ts

// ═══════════════════════════════════════════════════════════════════════════
// БАЗОВЫЕ ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export type DamageType = 
  | 'slashing' | 'piercing' | 'bludgeoning' | 'chopping'  // Физические
  | 'fire' | 'ice' | 'lightning' | 'acid'                 // Стихии
  | 'poison' | 'necrotic' | 'radiant' | 'psychic'         // Магические
  | 'force' | 'thunder' | 'void' | 'pure';                // Особые

export type ProficiencyType = 'swords' | 'axes' | 'hammers' | 'polearms' | 'unarmed' | 'bows';
export type WeaponType = 'melee' | 'ranged';
export type RollModifier = 'normal' | 'advantage' | 'disadvantage';

// ═══════════════════════════════════════════════════════════════════════════
// МОДИФИКАТОР ЭЛЕМЕНТА (НОВАЯ ГИБКАЯ СИСТЕМА)
// ═══════════════════════════════════════════════════════════════════════════

export interface ElementModifier {
  id: string;
  element: string;          // 'fire', 'ice', 'lightning', etc.
  isActive: boolean;        // Можно временно выключить
  
  // ═══ АТАКА (при касте заклинаний с этим элементом) ═══
  castBonus: number;        // +к d20 на каст/попадание
  damageBonus: number;      // +к урону (фиксированный)
  damageBonusPercent: number; // +% к урону (множитель)
  manaReduction: number;    // −к стоимости маны (абсолютное)
  manaReductionPercent: number; // −% к стоимости маны
  
  // ═══ ЗАЩИТА (при получении урона этого элемента) ═══
  resistance: number;           // Фиксированное снижение урона
  damageMultiplier: number;     // 1 = норма, 0.5 = резист, 1.5 = уязвимость, 0 = иммунитет
  
  // ═══ ДОПОЛНИТЕЛЬНО ═══
  notes?: string;
}

// Хелпер для создания пустого модификатора
export function createEmptyElementModifier(element: string): ElementModifier {
  return {
    id: '',  // Будет сгенерирован
    element,
    isActive: true,
    castBonus: 0,
    damageBonus: 0,
    damageBonusPercent: 0,
    manaReduction: 0,
    manaReductionPercent: 0,
    resistance: 0,
    damageMultiplier: 1,
    notes: ''
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// СТАРЫЕ ТИПЫ (для миграции, потом можно убрать)
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated Используй ElementModifier */
export type AffinityBonusType = 'castHit' | 'manaCost' | 'damage';

/** @deprecated Используй ElementModifier */
export interface ElementAffinity {
  id: string;
  element: string;
  bonusType: AffinityBonusType;
  value: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ОРУЖИЕ
// ═══════════════════════════════════════════════════════════════════════════

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  damageFormula?: string;
  damageType: DamageType;
  proficiencyType: ProficiencyType;
  statBonus: 'physicalPower' | 'dexterity' | 'none';
  hitBonus: number;
  multishot?: number;
  ammoPerShot?: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ЗАКЛИНАНИЯ
// ═══════════════════════════════════════════════════════════════════════════

export interface DamageTier {
  minRoll: number;
  maxRoll: number;
  formula: string;
  label?: string;
}

export interface Spell {
  id: string;
  name: string;
  manaCost: number;
  costType: 'mana' | 'health';
  elements: string[];
  type: 'targeted' | 'aoe' | 'self' | 'utility' | 'summon';
  projectiles?: string;
  damageFormula?: string;
  damageType?: DamageType;
  description?: string;
  equipmentBonus?: number;
  
  // Многошаговый режим
  isMultiStep?: boolean;
  elementTable?: Record<number, DamageType>;
  damageTiers?: DamageTier[];
}

// ═══════════════════════════════════════════════════════════════════════════
// РЕСУРСЫ
// ═══════════════════════════════════════════════════════════════════════════

export interface Resource {
  id: string;
  name: string;
  icon: string;
  current: number;
  max: number;
  resourceType: 'generic' | 'ammo';
  syncWithDocs?: boolean;
  
  // Для боеприпасов
  damageFormula?: string;
  damageType?: DamageType;
  extraDamageFormula?: string;
  extraDamageType?: DamageType;
}

// ═══════════════════════════════════════════════════════════════════════════
// ЮНИТ (ПЕРСОНАЖ)
// ═══════════════════════════════════════════════════════════════════════════

export interface Unit {
  id: string;
  name: string;
  shortName: string;
  googleDocsHeader: string;
  owlbearTokenId?: string;
  
  health: { current: number; max: number };
  mana: { current: number; max: number };
  
  stats: {
    physicalPower: number;
    dexterity: number;
    vitality: number;
    intelligence: number;
    charisma: number;
    initiative: number;
  };
  
  proficiencies: Record<ProficiencyType, number>;
  
  armor: {
    slashing: number;
    piercing: number;
    bludgeoning: number;
    chopping: number;
    magicBase: number;        // Базовая магическая защита (fallback)
    undead: number;
    // magicOverrides убран — теперь в elementModifiers
  };
  
  // ═══ НОВАЯ СИСТЕМА МОДИФИКАТОРОВ ЭЛЕМЕНТОВ ═══
  elementModifiers: ElementModifier[];
  
  // Физические множители (уязвимости к физ. урону)
  physicalMultipliers?: Record<string, number>;  // 'slashing': 1.5, etc.
  
  weapons: Weapon[];
  spells: Spell[];
  resources: Resource[];
  
  useManaAsHp: boolean;
  hasRokCards?: boolean;
  rokDeckResourceId?: string;
  hasDoubleShot?: boolean;
  doubleShotThreshold?: number;
  
  // ═══ DEPRECATED (для миграции) ═══
  /** @deprecated Перенесено в elementModifiers */
  magicBonuses?: Record<string, number>;
  /** @deprecated Перенесено в elementModifiers */
  elementAffinities?: ElementAffinity[];
  /** @deprecated Физические в physicalMultipliers, магические в elementModifiers */
  damageMultipliers?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// РЕЗУЛЬТАТЫ БРОСКОВ
// ═══════════════════════════════════════════════════════════════════════════

export interface DiceRollResult {
  formula: string;
  rolls: number[];
  bonus: number;
  total: number;
  rawD20?: number;
  isCrit?: boolean;
  isCritFail?: boolean;
  rollModifier?: RollModifier;
  allD20Rolls?: number[];
  label?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// BROADCAST СООБЩЕНИЯ
// ═══════════════════════════════════════════════════════════════════════════

export interface BroadcastMessage {
  id: string;
  type: 'roll' | 'damage' | 'hit' | 'miss' | 'spell' | 'heal' | 'death' | 'rok-card' | 'custom';
  unitName: string;
  title: string;
  subtitle?: string;
  icon?: string;
  rolls?: number[];
  total?: number;
  isCrit?: boolean;
  isCritFail?: boolean;
  color?: 'gold' | 'blood' | 'mana' | 'green' | 'purple' | 'white';
  hpBar?: { current: number; max: number };
  details?: string[];
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// НАСТРОЙКИ
// ═══════════════════════════════════════════════════════════════════════════

export interface AppSettings {
  googleDocsUrl?: string;
  syncHP?: boolean;
  syncMana?: boolean;
  syncResources?: boolean;
  writeLogs?: boolean;
  showTokenBars?: boolean;
  autoSyncInterval?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ И МАППИНГИ
// ═══════════════════════════════════════════════════════════════════════════

export const DAMAGE_TYPE_NAMES: Record<DamageType, string> = {
  slashing: 'Режущий',
  piercing: 'Колющий',
  bludgeoning: 'Дробящий',
  chopping: 'Рубящий',
  fire: 'Огонь',
  ice: 'Лёд',
  lightning: 'Молния',
  acid: 'Кислота',
  poison: 'Яд',
  necrotic: 'Некротика',
  radiant: 'Свет',
  psychic: 'Психика',
  force: 'Сила',
  thunder: 'Гром',
  void: 'Пустота',
  pure: 'Чистый'
};

export const ELEMENT_NAMES: Record<string, string> = {
  fire: 'Огонь',
  ice: 'Лёд',
  lightning: 'Молния',
  acid: 'Кислота',
  poison: 'Яд',
  necrotic: 'Некротика',
  radiant: 'Свет',
  psychic: 'Психика',
  force: 'Сила',
  thunder: 'Гром',
  void: 'Пустота',
  water: 'Вода',
  earth: 'Земля',
  wind: 'Ветер',
  nature: 'Природа',
  shadow: 'Тень',
  holy: 'Святость',
  arcane: 'Аркана',
  blood: 'Кровь',
  time: 'Время',
  space: 'Пространство',
  chaos: 'Хаос',
  order: 'Порядок'
};

export const PROFICIENCY_NAMES: Record<ProficiencyType, string> = {
  swords: 'Мечи',
  axes: 'Топоры',
  hammers: 'Молоты',
  polearms: 'Древковое',
  unarmed: 'Рукопашный',
  bows: 'Луки'
};

export const STAT_NAMES: Record<string, string> = {
  physicalPower: 'Физ. сила',
  dexterity: 'Ловкость',
  vitality: 'Живучесть',
  intelligence: 'Интеллект',
  charisma: 'Харизма',
  initiative: 'Инициатива'
};

/** @deprecated Используй ElementModifier */
export const AFFINITY_BONUS_NAMES: Record<AffinityBonusType, string> = {
  castHit: '+к касту/попаданию',
  manaCost: '−к затрате маны',
  damage: '+к урону'
};

export const ALL_DAMAGE_TYPES: DamageType[] = [
  'slashing', 'piercing', 'bludgeoning', 'chopping',
  'fire', 'ice', 'lightning', 'acid',
  'poison', 'necrotic', 'radiant', 'psychic',
  'force', 'thunder', 'void', 'pure'
];

export const PHYSICAL_DAMAGE_TYPES: DamageType[] = [
  'slashing', 'piercing', 'bludgeoning', 'chopping'
];

export const MAGICAL_DAMAGE_TYPES: DamageType[] = [
  'fire', 'ice', 'lightning', 'acid',
  'poison', 'necrotic', 'radiant', 'psychic',
  'force', 'thunder', 'void'
];

export const MULTIPLIER_OPTIONS = [
  { value: 0, label: '×0 (Иммунитет)' },
  { value: 0.25, label: '×0.25 (Сильный резист)' },
  { value: 0.5, label: '×0.5 (Резист)' },
  { value: 0.75, label: '×0.75 (Слабый резист)' },
  { value: 1, label: '×1 (Норма)' },
  { value: 1.25, label: '×1.25 (Слабая уязв.)' },
  { value: 1.5, label: '×1.5 (Уязвимость)' },
  { value: 2, label: '×2 (Сильная уязв.)' },
  { value: 3, label: '×3 (Крит. уязв.)' }
];
