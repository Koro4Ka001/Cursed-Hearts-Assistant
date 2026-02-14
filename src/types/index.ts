// src/types/index.ts

// ═══════════════════════════════════════════════════════════════
// ROLL MODIFIER — Преимущество / Помеха
// ═══════════════════════════════════════════════════════════════

export type RollModifier = 'normal' | 'advantage' | 'disadvantage';

export const ROLL_MODIFIER_NAMES: Record<RollModifier, string> = {
  normal: 'Обычный',
  advantage: 'Преимущество',
  disadvantage: 'Помеха'
};

// ═══════════════════════════════════════════════════════════════
// UNIT
// ═══════════════════════════════════════════════════════════════

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
  proficiencies: {
    swords: number;
    axes: number;
    hammers: number;
    polearms: number;
    unarmed: number;
    bows: number;
  };
  magicBonuses: Record<string, number>;
  elementAffinities: string[];
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
  customActions: CustomAction[];
  hasRokCards: boolean;
  rokDeckResourceId?: string;
  hasDoubleShot: boolean;
  doubleShotThreshold: number;
  notes: string;
  useManaAsHp: boolean;
}

export type WeaponType = 'melee' | 'ranged';
export type ProficiencyType = 'swords' | 'axes' | 'hammers' | 'polearms' | 'unarmed' | 'bows';

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  damageFormula: string;
  damageType: DamageType;
  proficiencyType: ProficiencyType;
  statBonus: 'physicalPower' | 'dexterity' | 'none';
  hitBonus: number;
  multishot: number;
  ammoPerShot?: number;
  extraDamageFormula?: string;
  extraDamageType?: DamageType;
  notes?: string;
}

export type SpellCostType = 'mana' | 'health';

export interface Spell {
  id: string;
  name: string;
  manaCost: number;
  costType: SpellCostType;
  elements: string[];
  type: 'targeted' | 'aoe' | 'self' | 'summon';
  projectiles: string;
  damageFormula?: string;
  damageType?: DamageType;
  description?: string;
  equipmentBonus?: number;
  isMultiStep?: boolean;
  elementTable?: Record<number, DamageType>;
  damageTiers?: Array<{
    minRoll: number;
    maxRoll: number;
    formula: string;
    label?: string;
  }>;
}

export type ResourceType = 'generic' | 'ammo';

export interface Resource {
  id: string;
  name: string;
  icon: string;
  current: number;
  max: number;
  resourceType: ResourceType;
  damageFormula?: string;
  damageType?: DamageType;
  extraDamageFormula?: string;
  extraDamageType?: DamageType;
  syncWithDocs: boolean;
}

export type StatKey = keyof Unit['stats'];

// ═══════════════════════════════════════════════════════════════
// CUSTOM ACTIONS
// ═══════════════════════════════════════════════════════════════

export interface ActionStep {
  id: string;
  label: string;
  roll: {
    dice: string;
    bonuses: ActionBonus[];
  };
  threshold?: number;
  rollModifier?: RollModifier;
  onSuccess?: ActionOutcome;
  onFailure?: ActionOutcome;
}

export interface ActionBonus {
  type: 'stat' | 'proficiency' | 'flat';
  stat?: StatKey;
  proficiency?: ProficiencyType;
  flatValue?: number;
  label?: string;
}

export interface ActionOutcome {
  type: 'message' | 'next_step' | 'damage' | 'heal' | 'mana_cost' | 'health_cost';
  message?: string;
  nextStepId?: string;
  damageFormula?: string;
  damageType?: DamageType;
  healFormula?: string;
  amount?: number;
}

export interface CustomAction {
  id: string;
  name: string;
  icon: string;
  steps: ActionStep[];
}

// ═══════════════════════════════════════════════════════════════
// DAMAGE TYPES
// ═══════════════════════════════════════════════════════════════

export type PhysicalDamageType = 'slashing' | 'piercing' | 'bludgeoning' | 'chopping';
export type MagicalDamageType = 'fire' | 'water' | 'earth' | 'air' | 'light' | 'space' |
  'astral' | 'corruption' | 'electricity' | 'darkness' | 'void' | 'life' |
  'blood' | 'frost' | 'death' | 'nature' | 'transcendence';
export type DamageType = PhysicalDamageType | MagicalDamageType | 'pure';
export type DamageCategory = 'physical' | 'magical' | 'pure';

// ═══════════════════════════════════════════════════════════════
// DICE ROLL RESULT
// ═══════════════════════════════════════════════════════════════

export interface DiceRollResult {
  formula: string;
  rolls: number[];
  bonus: number;
  total: number;
  isCrit: boolean;
  isCritFail: boolean;
  rawD20?: number;
  label?: string;
  rollModifier?: RollModifier;
  allD20Rolls?: number[];
}

// ═══════════════════════════════════════════════════════════════
// ROK CARDS
// ═══════════════════════════════════════════════════════════════

export interface RokCardResult {
  cardIndex: number;
  hitRoll: number;
  isHit: boolean;
  effectRoll: number;
  effectDescription: string;
  additionalRolls: DiceRollResult[];
  subEffects?: string[];
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS & STATE
// ═══════════════════════════════════════════════════════════════

export interface Settings {
  googleDocsUrl: string;
  syncHP: boolean;
  syncMana: boolean;
  syncResources: boolean;
  autoSyncInterval: number;
  writeLogs: boolean;
  showTokenBars: boolean;
}

export interface ConnectionStatus {
  owlbear: boolean;
  docs: boolean;
  dice: 'local';
  lastSyncTime?: number;
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: number;
}

export interface CombatLogEntry {
  timestamp: number;
  unitName: string;
  action: string;
  details: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const DAMAGE_TYPE_NAMES: Record<DamageType, string> = {
  slashing: 'Режущий',
  piercing: 'Колющий',
  bludgeoning: 'Дробящий',
  chopping: 'Рубящий',
  fire: 'Огонь',
  water: 'Вода',
  earth: 'Земля',
  air: 'Воздух',
  light: 'Свет',
  space: 'Пространство',
  astral: 'Астрал',
  corruption: 'Скверна',
  electricity: 'Электричество',
  darkness: 'Тьма',
  void: 'Пустота',
  life: 'Жизнь',
  blood: 'Кровь',
  frost: 'Мороз',
  death: 'Смерть',
  nature: 'Природа',
  transcendence: 'Трансцендентность',
  pure: 'Чистый'
};

export const PROFICIENCY_NAMES: Record<ProficiencyType, string> = {
  swords: 'Мечи',
  axes: 'Топоры',
  hammers: 'Молоты',
  polearms: 'Древковое',
  unarmed: 'Рукопашный',
  bows: 'Луки'
};

export const STAT_NAMES: Record<StatKey, string> = {
  physicalPower: 'Физ. сила',
  dexterity: 'Ловкость',
  vitality: 'Живучесть',
  intelligence: 'Интеллект',
  charisma: 'Харизма',
  initiative: 'Инициатива'
};

export const MULTIPLIER_OPTIONS = [
  { value: 0, label: '×0 (Иммунитет)' },
  { value: 0.25, label: '×0.25' },
  { value: 0.5, label: '×0.5 (Резист)' },
  { value: 0.75, label: '×0.75' },
  { value: 1, label: '×1 (Обычный)' },
  { value: 1.5, label: '×1.5' },
  { value: 2, label: '×2 (Уязвимость)' },
  { value: 3, label: '×3' }
];

export const ALL_DAMAGE_TYPES: DamageType[] = [
  'slashing', 'piercing', 'bludgeoning', 'chopping',
  'fire', 'water', 'earth', 'air', 'light', 'darkness',
  'electricity', 'frost', 'nature', 'corruption', 'life', 'death',
  'blood', 'void', 'astral', 'space', 'transcendence', 'pure'
];
