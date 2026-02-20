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
// МОДИФИКАТОР ЭЛЕМЕНТА
// ═══════════════════════════════════════════════════════════════════════════

export interface ElementModifier {
  id: string;
  element: string;
  isActive: boolean;
  
  // Атака
  castBonus: number;
  damageBonus: number;
  damageBonusPercent: number;
  manaReduction: number;
  manaReductionPercent: number;
  
  // Защита
  resistance: number;
  damageMultiplier: number;
  
  notes?: string;
}

export function createEmptyElementModifier(element: string): ElementModifier {
  return {
    id: '',
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
// СТАРЫЕ ТИПЫ (для миграции)
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated */
export type AffinityBonusType = 'castHit' | 'manaCost' | 'damage';

/** @deprecated */
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
// 🔮 КОНСТРУКТОР ЗАКЛИНАНИЙ V2
// ═══════════════════════════════════════════════════════════════════════════

/** Типы шагов (действий) в цепочке заклинания */
export type SpellActionType = 
  | 'roll_check'       // d20 + бонус vs порог (каст, попадание)
  | 'roll_dice'        // Просто бросить кубик
  | 'roll_table'       // Бросок → таблица → результат
  | 'roll_damage'      // Бросок кубиков урона
  | 'damage_tiers'     // Бросок → урон зависит от диапазона
  | 'set_value'        // Установить переменную в контекст
  | 'modify_resource'  // Потратить/восстановить ресурс
  | 'apply_damage'     // Применить накопленный урон
  | 'message'          // Показать сообщение
  | 'branch'           // Условный переход
  | 'goto'             // Безусловный переход
  | 'stop';            // Остановка цепочки

/** Условие перехода */
export type TransitionCondition = 
  | 'always'           // Всегда
  | 'crit'             // При крите (20)
  | 'crit_fail'        // При провале (1)
  | 'success'          // Успех (>= порога)
  | 'fail'             // Провал (< порога)
  | 'value_equals'     // Значение равно
  | 'value_gte'        // Значение >=
  | 'value_lte'        // Значение <=
  | 'value_in_range';  // Значение в диапазоне

/** Переход после выполнения шага */
export interface StepTransition {
  id: string;
  condition: TransitionCondition;
  conditionKey?: string;
  conditionValue?: number | string;
  conditionValueMax?: number;
  targetStepId: string;
  priority: number;
}

/** Элемент таблицы результатов */
export interface TableResultEntry {
  id: string;
  min: number;
  max: number;
  resultValue: string;
  resultLabel?: string;
  resultIcon?: string;
}

/** Tier урона */
export interface DamageTierEntry {
  id: string;
  minRoll: number;
  maxRoll: number;
  formula: string;
  label?: string;
}

/** Бонус к броску */
export interface RollBonus {
  type: 'stat' | 'proficiency' | 'flat' | 'from_context' | 'from_elements';
  statKey?: string;
  proficiencyKey?: string;
  flatValue?: number;
  contextKey?: string;
  elementBonusType?: 'cast';
  multiplier?: number;
}

/** Один шаг в цепочке заклинания */
export interface SpellAction {
  id: string;
  type: SpellActionType;
  label: string;
  description?: string;
  order: number;
  
  // Условие выполнения шага
  condition?: {
    type: 'always' | 'value_equals' | 'value_gte' | 'value_lte' | 'value_exists';
    key?: string;
    value?: number | string;
  };
  
  // Для roll_check
  diceFormula?: string;
  bonuses?: RollBonus[];
  successThreshold?: number;
  useThresholdFromContext?: string;
  
  // Для roll_table
  resultTable?: TableResultEntry[];
  saveResultAs?: string;
  
  // Для damage_tiers
  damageTiers?: DamageTierEntry[];
  
  // Для roll_damage / apply_damage
  damageFormula?: string;
  damageType?: DamageType | 'from_context';
  damageTypeContextKey?: string;
  critMultiplier?: number;
  addDamageBonus?: boolean;
  saveDamageAs?: string;
  
  // Для set_value
  setKey?: string;
  setValue?: string | number | boolean;
  setValueFromContext?: string;
  setValueFormula?: string;
  
  // Для modify_resource
  resourceType?: 'mana' | 'health' | 'resource';
  resourceId?: string;
  resourceAmount?: number;
  resourceAmountFormula?: string;
  resourceOperation?: 'spend' | 'restore';
  
  // Для message
  messageTemplate?: string;
  messageType?: 'info' | 'success' | 'warning' | 'damage' | 'crit';
  
  // Для branch
  branchCondition?: {
    type: 'value_equals' | 'value_gte' | 'value_lte' | 'value_exists' | 'value_in_range';
    key: string;
    value?: number | string;
    valueMax?: number;
  };
  branchTrueStepId?: string;
  branchFalseStepId?: string;
  
  // Для goto
  gotoStepId?: string;
  
  // Переходы (для roll_check и других)
  transitions?: StepTransition[];
  
  // Если нет transitions — по умолчанию
  defaultNextStepId?: string;
}

/** Глобальный модификатор заклинания */
export interface SpellModifier {
  id: string;
  name?: string;
  condition: 'always' | 'crit' | 'crit_fail' | 'roll_gte' | 'roll_lte' | 'element_is' | 'value_equals';
  conditionKey?: string;
  conditionValue?: number | string;
  
  effect: 'change_damage_type' | 'add_flat_damage' | 'multiply_damage' | 'heal_caster' | 'set_value' | 'add_message';
  effectValue?: string | number;
  effectKey?: string;
}

/** Контекст выполнения заклинания */
export interface CastContext {
  casterId: string;
  casterName: string;
  targetCount: number;
  currentTargetIndex: number;
  currentProjectileIndex: number;
  
  values: Record<string, any>;
  log: string[];
  
  rolls: Array<{
    stepId: string;
    formula: string;
    rolls: number[];
    total: number;
    rawD20?: number;
    isCrit?: boolean;
    isCritFail?: boolean;
  }>;
  
  totalDamage: number;
  damageType?: string;
  damageBreakdown: Array<{
    formula: string;
    result: number;
    type?: string;
    isCrit?: boolean;
  }>;
  
  isCrit: boolean;
  isCritFail: boolean;
  lastRoll?: number;
  lastD20?: number;
  
  currentStepIndex: number;
  currentStepId?: string;
  stopped: boolean;
  success: boolean;
  error?: string;
}

/** Заклинание V2 (с конструктором) */
export interface SpellV2 {
  id: string;
  name: string;
  version: 2;
  
  cost: number;
  costResource: 'mana' | 'health' | 'resource';
  costResourceId?: string;
  
  spellType: 'targeted' | 'aoe' | 'self' | 'utility' | 'summon';
  projectiles: string;
  elements: string[];
  description?: string;
  
  actions: SpellAction[];
  modifiers?: SpellModifier[];
}

/** Проверка версии заклинания */
export function isSpellV2(spell: Spell | SpellV2): spell is SpellV2 {
  return 'version' in spell && spell.version === 2;
}

// ═══════════════════════════════════════════════════════════════════════════
// ЗАКЛИНАНИЯ (СТАРАЯ ВЕРСИЯ — для совместимости)
// ═══════════════════════════════════════════════════════════════════════════

export interface DamageTier {
  minRoll: number;
  maxRoll: number;
  formula: string;
  label?: string;
}

/** @deprecated Используй SpellV2 */
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
    magicBase: number;
    undead: number;
  };
  
  elementModifiers: ElementModifier[];
  physicalMultipliers?: Record<string, number>;
  
  weapons: Weapon[];
  spells: (Spell | SpellV2)[];
  resources: Resource[];
  
  useManaAsHp: boolean;
  hasRokCards?: boolean;
  rokDeckResourceId?: string;
  hasDoubleShot?: boolean;
  doubleShotThreshold?: number;
  
  /** @deprecated */
  magicBonuses?: Record<string, number>;
  /** @deprecated */
  elementAffinities?: ElementAffinity[];
  /** @deprecated */
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
  order: 'Порядок',
  // Русские названия из constants/elements.ts
  'огонь': 'Огонь',
  'вода': 'Вода',
  'земля': 'Земля',
  'воздух': 'Воздух',
  'свет': 'Свет',
  'тьма': 'Тьма',
  'электричество': 'Электричество',
  'мороз': 'Мороз',
  'природа': 'Природа',
  'пустота': 'Пустота',
  'скверна': 'Скверна',
  'смерть': 'Смерть',
  'жизнь': 'Жизнь',
  'кровь': 'Кровь',
  'астрал': 'Астрал',
  'пространство': 'Пространство',
  'трансцендентность': 'Трансцендентность'
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

/** @deprecated */
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

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ ШАГОВ ЗАКЛИНАНИЙ — МЕТАДАННЫЕ
// ═══════════════════════════════════════════════════════════════════════════

export const SPELL_ACTION_TYPE_META: Record<SpellActionType, {
  name: string;
  icon: string;
  description: string;
  color: string;
}> = {
  roll_check: {
    name: 'Проверка',
    icon: '🎯',
    description: 'd20 + бонусы против порога',
    color: 'text-gold'
  },
  roll_dice: {
    name: 'Бросок',
    icon: '🎲',
    description: 'Бросить кубики и сохранить результат',
    color: 'text-ancient'
  },
  roll_table: {
    name: 'Таблица',
    icon: '📋',
    description: 'Бросок → результат из таблицы',
    color: 'text-mana-bright'
  },
  roll_damage: {
    name: 'Урон',
    icon: '💥',
    description: 'Бросок кубиков урона',
    color: 'text-blood-bright'
  },
  damage_tiers: {
    name: 'Tier-урон',
    icon: '⚔️',
    description: 'Урон зависит от броска',
    color: 'text-blood-bright'
  },
  set_value: {
    name: 'Установить',
    icon: '📝',
    description: 'Сохранить значение в контекст',
    color: 'text-faded'
  },
  modify_resource: {
    name: 'Ресурс',
    icon: '💠',
    description: 'Изменить ресурс (мана/HP)',
    color: 'text-mana-bright'
  },
  apply_damage: {
    name: 'Применить',
    icon: '🩸',
    description: 'Применить накопленный урон',
    color: 'text-blood'
  },
  message: {
    name: 'Сообщение',
    icon: '💬',
    description: 'Показать сообщение в логе',
    color: 'text-bone'
  },
  branch: {
    name: 'Ветвление',
    icon: '🔀',
    description: 'Условный переход',
    color: 'text-purple-400'
  },
  goto: {
    name: 'Переход',
    icon: '➡️',
    description: 'Перейти к шагу',
    color: 'text-purple-400'
  },
  stop: {
    name: 'Стоп',
    icon: '🛑',
    description: 'Остановить выполнение',
    color: 'text-blood'
  }
};
