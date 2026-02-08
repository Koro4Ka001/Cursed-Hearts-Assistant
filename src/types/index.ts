export type DamageType = 
  | 'slashing' | 'piercing' | 'bludgeoning' | 'chopping'
  | 'fire' | 'water' | 'earth' | 'air' | 'light' | 'darkness' 
  | 'electricity' | 'void' | 'life' | 'death' | 'astral' 
  | 'corruption' | 'space' | 'blood' | 'frost' | 'nature' 
  | 'transcendence' | 'pure';

export type ProficiencyType = 'swords' | 'axes' | 'hammers' | 'polearms' | 'unarmed' | 'bows';
export type StatType = 'physicalPower' | 'dexterity' | 'intelligence';

export const DAMAGE_TYPE_NAMES: Record<string, string> = {
  slashing: '🗡️ Режущий', piercing: '🔪 Колющий', bludgeoning: '🔨 Дробящий', chopping: '🪓 Рубящий',
  fire: '🔥 Огонь', water: '💧 Вода', earth: '🪨 Земля', air: '💨 Воздух',
  light: '☀️ Свет', darkness: '🌑 Тьма', electricity: '⚡ Электричество', void: '🕳️ Пустота',
  life: '💚 Жизнь', death: '💀 Смерть', astral: '🌟 Астрал', corruption: '☠️ Скверна',
  space: '🌀 Пространство', blood: '🩸 Кровь', frost: '❄️ Мороз', nature: '🌿 Природа',
  transcendence: '✨ Запредельность', pure: '⚪ Чистый',
};

export const PROFICIENCY_NAMES: Record<ProficiencyType, string> = {
  swords: 'Мечи', axes: 'Топоры', hammers: 'Молоты', polearms: 'Древковое', unarmed: 'Рукопашный', bows: 'Луки',
};

export interface Weapon {
  id: string;
  name: string;
  damageFormula: string;
  damageType: DamageType;
  proficiencyType: ProficiencyType;
  statBonus: StatType;
  range?: number;
  special?: string;
}

export interface Spell {
  id: string;
  name: string;
  manaCost: number;
  elements: string[];
  type: 'targeted' | 'aoe' | 'self' | 'summon';
  projectiles?: number;
  canDodge?: boolean;
  damageFormula?: string;
  damageType?: string;
  range?: number;
  duration?: string;
  description?: string;
}

export interface Resource {
  id: string;
  name: string;
  icon: string;
  current: number;
  max: number;
  isConsumableWeapon?: boolean;
  damageFormula?: string;
  damageType?: DamageType;
  proficiencyType?: ProficiencyType;
  statBonus?: StatType;
}

export interface QuickAction {
  id: string;
  name: string;
  icon: string;
  diceFormula?: string;
  description?: string;
}

export interface Unit {
  id: string;
  name: string;
  shortName: string;
  googleDocsHeader: string;
  tokenId?: string;
  health: { current: number; max: number };
  mana: { current: number; max: number };
  stats: {
    physicalPower: number;
    dexterity: number;
    intelligence: number;
    vitality: number;
    charisma: number;
    initiative: number;
  };
  proficiencies: Record<ProficiencyType, number>;
  magicBonuses: Record<string, number>;
  weapons: Weapon[];
  spells: Spell[];
  resources: Resource[];
  quickActions: QuickAction[];
}

export interface RollResult {
  formula: string;
  rolls: number[];
  total: number;
  isCrit: boolean;
  isFail: boolean;
  rawD20?: number;
}

export interface CombatState {
  phase: 'idle' | 'rolled' | 'waiting_dodge' | 'damage' | 'miss';
  attackRoll?: RollResult;
  damageRoll?: RollResult;
  message?: string;
}

export interface AppSettings {
  webAppUrl: string;
  syncOnHpChange: boolean;
  syncOnManaChange: boolean;
}
