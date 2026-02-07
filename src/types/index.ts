// === ТИПЫ ДЛЯ CURSED HEARTS ===

export type DamageType = 
  | 'slashing' | 'piercing' | 'bludgeoning' | 'chopping'  // физические
  | 'fire' | 'water' | 'earth' | 'air' | 'light' | 'darkness' 
  | 'electricity' | 'void' | 'life' | 'death' | 'astral' 
  | 'corruption' | 'space' | 'blood' | 'frost' | 'nature' 
  | 'transcendence' | 'pure';

export type ProficiencyType = 'swords' | 'axes' | 'hammers' | 'polearms' | 'unarmed' | 'bows';

export type StatType = 'physicalPower' | 'dexterity' | 'intelligence';

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

export interface AppSettings {
  webAppUrl: string;
  syncOnHpChange: boolean;
  syncOnManaChange: boolean;
  diceMethod: 'built-in' | 'dice-owlbear';
  grimoireNamespace: string;
}
