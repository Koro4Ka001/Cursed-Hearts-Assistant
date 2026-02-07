// Типы урона
export type PhysicalDamageType = 'slashing' | 'piercing' | 'bludgeoning' | 'chopping';
export type MagicalDamageType = 'fire' | 'water' | 'earth' | 'air' | 'light' | 'darkness' 
  | 'electricity' | 'void' | 'life' | 'death' | 'astral' | 'corruption' 
  | 'space' | 'blood' | 'frost' | 'nature' | 'transcendence';
export type PureDamageType = 'pure';
export type DamageType = PhysicalDamageType | MagicalDamageType | PureDamageType;
export type DamageCategory = 'physical' | 'magical' | 'pure';

// Типы владения оружием
export type ProficiencyType = 'swords' | 'axes' | 'hammers' | 'polearms' | 'unarmed' | 'bows';

// Статы персонажа
export interface Stats {
  physicalPower: number;    // +5 к физ урону за единицу
  dexterity: number;        // +3 к урону луков за единицу
  intelligence: number;     // +3 к маг урону за единицу
  vitality: number;
  charisma: number;
  initiative: number;
}

// Владение оружием
export interface WeaponProficiencies {
  swords: number;
  axes: number;
  hammers: number;
  polearms: number;
  unarmed: number;
  bows: number;
}

// Оружие
export interface Weapon {
  id: string;
  name: string;
  damageFormula: string;
  damageType: DamageType;
  proficiencyType: ProficiencyType;
  statBonus: 'physicalPower' | 'dexterity';
  range?: number;
  special?: string;
}

// Заклинание
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

// Ресурс
export interface Resource {
  id: string;
  name: string;
  icon: string;
  current: number;
  max: number;
  isConsumableWeapon?: boolean;
  damageFormula?: string;
  damageType?: string;
}

// Быстрое действие
export interface QuickAction {
  id: string;
  name: string;
  icon: string;
  diceFormula?: string;
  description?: string;
}

// Юнит (персонаж/компаньон)
export interface Unit {
  id: string;
  name: string;
  shortName: string;
  googleDocsHeader: string;
  tokenId?: string;
  health: { current: number; max: number };
  mana: { current: number; max: number };
  stats: Stats;
  weaponProficiencies: WeaponProficiencies;
  magicBonuses: Record<string, number>;
  weapons: Weapon[];
  spells: Spell[];
  resources: Resource[];
  quickActions: QuickAction[];
}

// Результат броска
export interface RollResult {
  formula: string;
  total: number;
  diceResults: number[];
  rawD20?: number;
  isCrit?: boolean;
}

// Лог действия
export interface ActionLog {
  timestamp: Date;
  unitName: string;
  action: string;
  details?: string;
}

// Настройки плагина
export interface PluginSettings {
  googleWebAppUrl: string;
  autoSync: boolean;
  syncInterval: number;
}

// Ответ от Google Docs API
export interface GoogleDocsResponse {
  success: boolean;
  health?: { current: number; max: number };
  mana?: { current: number; max: number };
  currencies?: { gold: number; silver: number; copper: number };
  error?: string;
}

// Состояние атаки
export interface AttackState {
  phase: 'idle' | 'rolling_hit' | 'waiting_dodge' | 'rolling_damage' | 'complete';
  hitRoll?: RollResult;
  damageRoll?: RollResult;
  isHit?: boolean;
  isCrit?: boolean;
  isDodged?: boolean;
  totalDamage?: number;
}

// Состояние каста
export interface CastState {
  phase: 'idle' | 'rolling_cast' | 'rolling_projectiles' | 'rolling_damage' | 'complete';
  castRoll?: RollResult;
  projectileResults?: { hit: boolean; dodged: boolean; damage: number }[];
  totalDamage?: number;
  isDoubleShot?: boolean;
}

// Названия типов урона на русском
export const DAMAGE_TYPE_NAMES: Record<string, string> = {
  slashing: 'Режущий',
  piercing: 'Колющий',
  bludgeoning: 'Дробящий',
  chopping: 'Рубящий',
  fire: 'Огненный',
  water: 'Водный',
  earth: 'Земляной',
  air: 'Воздушный',
  light: 'Световой',
  darkness: 'Тёмный',
  electricity: 'Электрический',
  void: 'Пустотный',
  life: 'Жизни',
  death: 'Смерти',
  astral: 'Астральный',
  corruption: 'Порчи',
  space: 'Пространства',
  blood: 'Крови',
  frost: 'Морозный',
  nature: 'Природы',
  transcendence: 'Трансцендентный',
  pure: 'Чистый',
};

// Названия типов владения оружием
export const PROFICIENCY_NAMES: Record<ProficiencyType, string> = {
  swords: 'Мечи',
  axes: 'Топоры',
  hammers: 'Молоты',
  polearms: 'Древковое',
  unarmed: 'Рукопашный',
  bows: 'Луки',
};

// Названия характеристик
export const STAT_NAMES: Record<keyof Stats, string> = {
  physicalPower: 'Физ. Сила',
  dexterity: 'Ловкость',
  intelligence: 'Интеллект',
  vitality: 'Живучесть',
  charisma: 'Харизма',
  initiative: 'Инициатива',
};
