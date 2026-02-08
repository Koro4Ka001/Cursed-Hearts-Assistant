// ================== БАЗОВЫЕ ТИПЫ ==================

export type EntityId = string;

export type PhysicalDamageType = 'slashing' | 'piercing' | 'bludgeoning' | 'chopping';

export type MagicalDamageType =
  | 'fire' | 'water' | 'earth' | 'air'
  | 'light' | 'darkness' | 'electricity' | 'void'
  | 'life' | 'death' | 'astral' | 'corruption'
  | 'space' | 'blood' | 'frost' | 'nature' | 'transcendence';

export type DamageType = PhysicalDamageType | MagicalDamageType | 'pure';

export type DamageCategory = 'physical' | 'magical' | 'pure';

export type ProficiencyType = 'swords' | 'axes' | 'hammers' | 'polearms' | 'unarmed' | 'bows';

export type StatBonusType = 'physicalPower' | 'dexterity' | 'intelligence' | 'none';

export type SpellType = 'targeted' | 'aoe' | 'self' | 'summon';

export type TargetType = 'enemy' | 'ally' | 'self';

export interface StatValue {
  current: number;
  max: number;
}

export interface DiceRollResult {
  formula: string;
  individualRolls: number[];
  bonus: number;
  total: number;
  isCritical: boolean;
  isCriticalFail: boolean;
  rawD20Value?: number;
}

export interface CharacterStats {
  physicalPower: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  charisma: number;
  initiative: number;
}

export interface WeaponProficiencies {
  swords: number;
  axes: number;
  hammers: number;
  polearms: number;
  unarmed: number;
  bows: number;
}

export interface Weapon {
  id: EntityId;
  name: string;
  damageFormula: string;
  damageType: DamageType;
  proficiencyType: ProficiencyType;
  statBonus: StatBonusType;
  range?: number;
  special?: string;
}

export interface Spell {
  id: EntityId;
  name: string;
  manaCost: number;
  elements: string[];
  type: SpellType;
  projectiles: number;
  canDodge: boolean;
  damageFormula?: string;
  damageType?: string;
  range?: number;
  duration?: string;
  description?: string;
}

export interface Resource {
  id: EntityId;
  name: string;
  icon: string;
  current: number;
  max: number;
  isConsumableWeapon: boolean;
  damageFormula?: string;
  damageType?: DamageType;
  proficiencyType?: ProficiencyType;
  statBonus?: StatBonusType;
  isRokCards: boolean;
}

export interface QuickAction {
  id: EntityId;
  name: string;
  icon: string;
  baseDice: string;
  statBonus: StatBonusType;
  flatBonus: number;
  description?: string;
}

export interface Unit {
  id: EntityId;
  name: string;
  shortName: string;
  googleDocsHeader: string;
  owlbearTokenId?: string;
  health: StatValue;
  mana: StatValue;
  stats: CharacterStats;
  proficiencies: WeaponProficiencies;
  magicBonuses: Record<string, number>;
  weapons: Weapon[];
  spells: Spell[];
  resources: Resource[];
  quickActions: QuickAction[];
  hasRokCards: boolean;
}

export interface AppSettings {
  webAppUrl: string;
  syncHpOnChange: boolean;
  syncManaOnChange: boolean;
  syncResourcesOnChange: boolean;
}

export type CombatPhase =
  | 'idle'
  | 'rolling_hit'
  | 'waiting_dodge'
  | 'rolling_damage'
  | 'showing_result'
  | 'miss';

export interface CombatState {
  phase: CombatPhase;
  hitRoll?: DiceRollResult;
  damageRoll?: DiceRollResult;
  message?: string;
  damageType?: DamageType;
  wasCritical?: boolean;
}

export interface LogEntry {
  timestamp: Date;
  message: string;
  type: 'action' | 'damage' | 'heal' | 'spell' | 'resource' | 'error';
}

export interface RokEffect {
  id: number;
  name: string;
  description: string;
  additionalRolls?: string[];
  requiresSuccessCheck?: boolean;
  duration?: number;
  flags?: {
    redirect?: boolean;
    extraCards?: number;
    global?: boolean;
  };
}

export interface RokCardResult {
  hit: boolean;
  hitRoll: DiceRollResult;
  effect?: RokEffect;
  effectRoll?: DiceRollResult;
  additionalRolls?: DiceRollResult[];
  successCheck?: DiceRollResult;
  resultDescription: string;
}

export type TabId = 'combat' | 'magic' | 'resources' | 'actions' | 'settings';
