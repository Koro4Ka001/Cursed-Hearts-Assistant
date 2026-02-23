// src/types/index.ts

import { ELEMENT_NAMES_MAP } from '../constants/elements';

// ═══════════════════════════════════════════════════════════════════════════
// БАЗОВЫЕ ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export type DamageType = 
  | 'огонь' | 'вода' | 'земля' | 'воздух' 
  | 'свет' | 'пространство' | 'астрал' | 'скверна'
  | 'электричество' | 'тьма' | 'пустота' | 'жизнь'
  | 'смерть' | 'ужас' | 'запредельность'
  | 'slashing' | 'piercing' | 'bludgeoning' | 'chopping'
  | 'pure';

export type ProficiencyType = 'swords' | 'axes' | 'hammers' | 'polearms' | 'unarmed' | 'bows';
export type WeaponType = 'melee' | 'ranged';
export type RollModifier = 'normal' | 'advantage' | 'disadvantage';
export type StatKey = 'physicalPower' | 'dexterity' | 'vitality' | 'intelligence' | 'charisma' | 'initiative';

// ═══════════════════════════════════════════════════════════════════════════
// МОДИФИКАТОР ЭЛЕМЕНТА
// ═══════════════════════════════════════════════════════════════════════════

export interface ElementModifier {
  id: string;
  element: string;
  isActive: boolean;
  castBonus: number;
  damageBonus: number;
  damageBonusPercent: number;
  manaReduction: number;
  manaReductionPercent: number;
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

export type SpellActionType = 
  | 'roll_attack' // НОВОЕ
  | 'roll_cast'   // НОВОЕ
  | 'roll_check'  // Deprecated
  | 'roll_dice'
  | 'roll_table'
  | 'roll_damage'
  | 'damage_tiers'
  | 'set_value'
  | 'modify_resource'
  | 'apply_damage'
  | 'message'
  | 'branch'
  | 'goto'
  | 'stop';

export type TransitionCondition = 
  | 'always'
  | 'crit'
  | 'crit_fail'
  | 'success'
  | 'fail'
  | 'value_equals'
  | 'value_gte'
  | 'value_lte'
  | 'value_in_range';

export interface StepTransition {
  id: string;
  condition: TransitionCondition;
  conditionKey?: string;
  conditionValue?: number | string;
  conditionValueMax?: number;
  targetStepId: string;
  priority: number;
}

export interface TableResultEntry {
  id: string;
  min: number;
  max: number;
  resultValue: string;
  resultLabel?: string;
  resultIcon?: string;
}

export interface DamageTierEntry {
  id: string;
  minRoll: number;
  maxRoll: number;
  formula: string;
  label?: string;
}

export interface RollBonus {
  type: 'stat' | 'proficiency' | 'flat' | 'from_context' | 'from_elements';
  statKey?: string;
  proficiencyKey?: string;
  flatValue?: number;
  contextKey?: string;
  elementBonusType?: 'cast';
  multiplier?: number;
}

export interface SpellAction {
  id: string;
  type: SpellActionType;
  label: string;
  description?: string;
  order: number;
  
  condition?: {
    type: 'always' | 'value_equals' | 'value_gte' | 'value_lte' | 'value_exists';
    key?: string;
    value?: number | string;
  };
  
  diceFormula?: string;
  bonuses?: RollBonus[];
  successThreshold?: number;
  useThresholdFromContext?: string;
  
  resultTable?: TableResultEntry[];
  saveResultAs?: string;
  
  damageTiers?: DamageTierEntry[];
  
  damageFormula?: string;
  damageType?: DamageType | 'from_context';
  damageTypeContextKey?: string;
  critMultiplier?: number;
  addDamageBonus?: boolean;
  saveDamageAs?: string;
  forcePureOnCrit?: boolean; // ГАЛОЧКА
  
  setKey?: string;
  setValue?: string | number | boolean;
  setValueFromContext?: string;
  setValueFormula?: string;
  
  resourceType?: 'mana' | 'health' | 'resource';
  resourceId?: string;
  resourceAmount?: number;
  resourceAmountFormula?: string;
  resourceOperation?: 'spend' | 'restore';
  
  messageTemplate?: string;
  messageType?: 'info' | 'success' | 'warning' | 'damage' | 'crit';
  
  branchCondition?: {
    type: 'value_equals' | 'value_gte' | 'value_lte' | 'value_exists' | 'value_in_range';
    key: string;
    value?: number | string;
    valueMax?: number;
  };
  branchTrueStepId?: string;
  branchFalseStepId?: string;
  
  gotoStepId?: string;
  
  transitions?: StepTransition[];
  defaultNextStepId?: string;
}

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
  
  // Флаги для логики
  doubleDamageDice?: boolean;
  manaDiscount?: number;
}

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

export function isSpellV2(spell: Spell | SpellV2): spell is SpellV2 {
  return 'version' in spell && spell.version === 2;
}

// ═══════════════════════════════════════════════════════════════════════════
// КАСТОМНЫЕ ДЕЙСТВИЯ V2
// ═══════════════════════════════════════════════════════════════════════════

export type ActionCategory = 
  | 'check'       // Проверки характеристик
  | 'social'      // Социальные взаимодействия
  | 'exploration' // Исследование
  | 'item'        // Использование предметов
  | 'ability'     // Особые способности
  | 'reaction'    // Реакции
  | 'other';      // Прочее

export const ACTION_CATEGORY_NAMES: Record<ActionCategory, string> = {
  check: 'Проверка',
  social: 'Социальное',
  exploration: 'Исследование',
  item: 'Предмет',
  ability: 'Способность',
  reaction: 'Реакция',
  other: 'Прочее'
};

export const ACTION_CATEGORY_ICONS: Record<ActionCategory, string> = {
  check: '🎲',
  social: '🗣️',
  exploration: '🔍',
  item: '🧪',
  ability: '⚡',
  reaction: '🛡️',
  other: '✨'
};

export interface ActionCost {
  id: string;
  type: 'mana' | 'health' | 'resource';
  resourceId?: string;
  amount: number;
}

export interface CustomActionV2 {
  id: string;
  name: string;
  version: 2;
  icon: string;
  category: ActionCategory;
  description?: string;
  costs: ActionCost[];
  defaultRollModifier: RollModifier;
  actions: SpellAction[];
}

export function isCustomActionV2(action: CustomAction | CustomActionV2): action is CustomActionV2 {
  return 'version' in action && action.version === 2;
}

export function createEmptyCustomActionV2(): CustomActionV2 {
  return {
    id: '',
    name: 'Новое действие',
    version: 2,
    icon: '⚡',
    category: 'check',
    description: '',
    costs: [],
    defaultRollModifier: 'normal',
    actions: []
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// КАСТОМНЫЕ ДЕЙСТВИЯ (СТАРАЯ ВЕРСИЯ)
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated */
export interface ActionBonus {
  type: 'stat' | 'proficiency' | 'flat';
  stat?: StatKey;
  proficiency?: ProficiencyType;
  flatValue?: number;
  label?: string;
}

/** @deprecated */
export interface ActionOutcome {
  type: 'message' | 'next_step' | 'damage' | 'heal' | 'mana_cost' | 'health_cost';
  message?: string;
  nextStepId?: string;
  damageFormula?: string;
  healFormula?: string;
  amount?: number;
}

/** @deprecated */
export interface ActionStep {
  id: string;
  label: string;
  roll?: {
    dice: string;
    bonuses: ActionBonus[];
  };
  threshold?: number;
  rollModifier?: RollModifier;
  onSuccess?: ActionOutcome;
  onFailure?: ActionOutcome;
}

/** @deprecated */
export interface CustomAction {
  id: string;
  name: string;
  icon: string;
  steps: ActionStep[];
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
// ЮНИТ
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
  
  customActions?: (CustomAction | CustomActionV2)[];
  
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
// ОСТАЛЬНОЕ
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

export const DAMAGE_TYPE_NAMES = ELEMENT_NAMES_MAP;
export const ELEMENT_NAMES = ELEMENT_NAMES_MAP;

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

export const ROLL_MODIFIER_NAMES: Record<RollModifier, string> = {
  normal: 'Обычный',
  advantage: 'Преимущество',
  disadvantage: 'Помеха'
};

/** @deprecated */
export const AFFINITY_BONUS_NAMES: Record<AffinityBonusType, string> = {
  castHit: '+к касту/попаданию',
  manaCost: '−к затрате маны',
  damage: '+к урону'
};

export const ALL_DAMAGE_TYPES: DamageType[] = [
  'огонь', 'вода', 'земля', 'воздух', 
  'свет', 'пространство', 'астрал', 'скверна',
  'электричество', 'тьма', 'пустота', 'жизнь',
  'смерть', 'ужас', 'запредельность',
  'slashing', 'piercing', 'bludgeoning', 'chopping',
  'pure'
];

export const PHYSICAL_DAMAGE_TYPES: DamageType[] = [
  'slashing', 'piercing', 'bludgeoning', 'chopping'
];

export const MAGICAL_DAMAGE_TYPES: DamageType[] = [
  'огонь', 'вода', 'земля', 'воздух', 
  'свет', 'пространство', 'астрал', 'скверна',
  'электричество', 'тьма', 'пустота', 'жизнь',
  'смерть', 'ужас', 'запредельность'
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

export const SPELL_ACTION_TYPE_META: Record<SpellActionType, {
  name: string;
  icon: string;
  description: string;
  color: string;
}> = {
  roll_attack: { name: 'Попадание', icon: '⚔️', description: 'Крит = x2 кубов урона', color: 'text-blood-bright' },
  roll_cast: { name: 'Каст', icon: '✨', description: 'Крит = 1/2 маны', color: 'text-mana-bright' },
  roll_check: { name: 'Проверка', icon: '🎯', description: 'd20 + бонусы', color: 'text-gold' },
  roll_dice: { name: 'Бросок', icon: '🎲', description: 'Бросить кубики', color: 'text-ancient' },
  roll_table: { name: 'Таблица', icon: '📋', description: 'Бросок → таблица', color: 'text-mana-bright' },
  roll_damage: { name: 'Урон', icon: '💥', description: 'Кубики урона', color: 'text-blood-bright' },
  damage_tiers: { name: 'Tier-урон', icon: '⚖️', description: 'Урон по броску', color: 'text-blood-bright' },
  set_value: { name: 'Установить', icon: '📝', description: 'Сохранить значение', color: 'text-faded' },
  modify_resource: { name: 'Ресурс', icon: '💠', description: 'Изменить ресурс', color: 'text-mana-bright' },
  apply_damage: { name: 'Применить', icon: '🩸', description: 'Применить урон', color: 'text-blood' },
  message: { name: 'Сообщение', icon: '💬', description: 'В лог', color: 'text-bone' },
  branch: { name: 'Ветвление', icon: '🔀', description: 'Условие', color: 'text-purple-400' },
  goto: { name: 'Переход', icon: '➡️', description: 'Go to', color: 'text-purple-400' },
  stop: { name: 'Стоп', icon: '🛑', description: 'Стоп', color: 'text-blood' }
};
