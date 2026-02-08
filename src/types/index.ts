// === ОСНОВНЫЕ ТИПЫ ===

export interface Unit {
  id: string;
  name: string;                    // "Кассиан"
  shortName: string;               // "Касс"
  googleDocsHeader: string;        // "КАССИАН|КАРТОЧНЫЙ ДИЛЕР" — для поиска в Docs
  owlbearTokenId?: string;         // ID токена на карте OBR
  
  health: { current: number; max: number };
  mana: { current: number; max: number };
  
  stats: {
    physicalPower: number;   // +5 к физ урону за единицу
    dexterity: number;       // +3 к урону луков за единицу
    vitality: number;        // +5 к макс ХП за единицу (информативно)
    intelligence: number;    // +3 к маг урону за единицу
    charisma: number;        // информативно
    initiative: number;      // информативно
  };
  
  proficiencies: {
    swords: number;     // бонус к d20 на попадание мечами
    axes: number;       // бонус к d20 на попадание топорами
    hammers: number;    // бонус к d20 на попадание молотами
    polearms: number;   // бонус к d20 на попадание древковым
    unarmed: number;    // бонус к d20 на попадание рукопашный
    bows: number;       // бонус к d20 на попадание луками
  };
  
  magicBonuses: Record<string, number>;
  // Пример: { "электричество": 3, "воздух": 2, "природа": 3, "жизнь": 3, "скверна": 3 }
  // При касте берётся МАКСИМАЛЬНЫЙ бонус из элементов заклинания
  
  armor: {
    slashing: number;      // от режущего
    piercing: number;      // от колющего
    bludgeoning: number;   // от дробящего
    chopping: number;      // от рубящего
    magicBase: number;     // базовая маг защита
    magicOverrides: Record<string, number>; // { "огонь": 15, "свет": 0 }
    undead: number;        // защита от нежити
  };
  
  damageMultipliers: Record<string, number>;
  // { "колющий": 0.5, "свет": 2.0 } — множитель урона ДО вычета брони
  // если не указан — 1.0
  
  weapons: Weapon[];
  spells: Spell[];
  resources: Resource[];
  customActions: CustomAction[];
  
  hasRokCards: boolean;        // только для Кассиана
  hasDoubleShot: boolean;      // способность ДаблШот (только для Кассиана)
  doubleShotThreshold: number; // порог для ДаблШот (18)
}

export type WeaponType = 'melee' | 'ranged';
export type ProficiencyType = 'swords' | 'axes' | 'hammers' | 'polearms' | 'unarmed' | 'bows';

export interface Weapon {
  id: string;
  name: string;                    // "Фамильная сабля"
  type: WeaponType;                // melee / ranged
  damageFormula: string;           // "5d20" или "6d10"
  damageType: DamageType;          // "chopping" / "piercing" / etc
  proficiencyType: ProficiencyType;
  statBonus: 'physicalPower' | 'dexterity' | 'none';
  // physicalPower = стат × 5 к урону, dexterity = стат × 3 к урону
  hitBonus: number;                // доп бонус к попаданию (напр. +3 от лука)
  extraDamageFormula?: string;     // доп урон (напр. стрелы с рунами)
  extraDamageType?: DamageType;
  notes?: string;                  // "все стрелы разделяются на две"
}

export type SpellCostType = 'mana' | 'health';

export interface Spell {
  id: string;
  name: string;                    // "Винтовая молния"
  manaCost: number;                // стоимость маны (или HP если costType='health')
  costType: SpellCostType;         // 'mana' (по умолчанию) или 'health'
  elements: string[];              // ["электричество"] или ["земля", "тьма"]
  type: 'targeted' | 'aoe' | 'self' | 'summon';
  projectiles: number;             // кол-во снарядов (для targeted)
  damageFormula?: string;          // "d20+d4" — формула урона ЗА ОДИН СНАРЯД
  damageType?: DamageType;
  description?: string;            // текстовое описание эффекта
  equipmentBonus?: number;         // доп бонус от экипировки (напр. +10 от посоха)
}

export interface Resource {
  id: string;
  name: string;         // "Колода Рока"
  icon: string;         // "🃏"
  current: number;
  max: number;
  syncWithDocs: boolean; // синхронизировать с Google Docs
}

// === КАСТОМНЫЕ ДЕЙСТВИЯ ===

export type StatKey = keyof Unit['stats'];

export interface ActionStep {
  id: string;
  label: string;                   // "Бросок на осмотр"
  roll: {
    dice: string;                  // "d20"
    bonuses: ActionBonus[];
  };
  threshold?: number;              // порог успеха (>= threshold = успех)
  onSuccess?: ActionOutcome;
  onFailure?: ActionOutcome;
}

export interface ActionBonus {
  type: 'stat' | 'proficiency' | 'flat';
  stat?: StatKey;
  proficiency?: ProficiencyType;
  flatValue?: number;
  label?: string;                  // для отображения
}

export interface ActionOutcome {
  type: 'message' | 'next_step' | 'damage' | 'heal' | 'mana_cost' | 'health_cost';
  message?: string;
  nextStepId?: string;
  damageFormula?: string;
  damageType?: DamageType;
  healFormula?: string;
  amount?: number;                 // для mana_cost / health_cost
}

export interface CustomAction {
  id: string;
  name: string;                    // "Осмотр"
  icon: string;                    // "🔍"
  steps: ActionStep[];
}

// === ТИПЫ УРОНА ===

export type PhysicalDamageType = 'slashing' | 'piercing' | 'bludgeoning' | 'chopping';
export type MagicalDamageType = 'fire' | 'water' | 'earth' | 'air' | 'light' | 'space' |
  'astral' | 'corruption' | 'electricity' | 'darkness' | 'void' | 'life' |
  'blood' | 'frost' | 'death' | 'nature' | 'transcendence';
export type DamageType = PhysicalDamageType | MagicalDamageType | 'pure';
export type DamageCategory = 'physical' | 'magical' | 'pure';

// === РЕЗУЛЬТАТ БРОСКА ===

export interface DiceRollResult {
  formula: string;       // "3d20+5"
  rolls: number[];       // [14, 7, 19]
  bonus: number;         // 5
  total: number;         // 45
  isCrit: boolean;       // d20 == 20
  isCritFail: boolean;   // d20 == 1
  rawD20?: number;       // значение d20 если бросался d20
  label?: string;        // "Попадание мечом"
}

// === КАРТЫ РОКА ===

export interface RokCardResult {
  cardIndex: number;
  hitRoll: number;        // d20 на попадание
  isHit: boolean;         // hitRoll >= 11
  effectRoll: number;     // d20 на эффект (1-20)
  effectDescription: string;
  additionalRolls: DiceRollResult[];  // доп броски от эффекта
  subEffects?: string[];   // под-эффекты (например аура д4)
}

// === НАСТРОЙКИ ===

export interface Settings {
  googleDocsUrl: string;    // URL Google Apps Script Web App
  syncHP: boolean;
  syncMana: boolean;
  syncResources: boolean;
  autoSyncInterval: number; // минуты (по умолчанию 5)
  writeLogs: boolean;       // писать логи в Google Docs
}

export interface ConnectionStatus {
  owlbear: boolean;
  docs: boolean;
  lastSyncTime?: number;
}

// === ВСПОМОГАТЕЛЬНЫЕ ТИПЫ ===

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

// Маппинг русских названий типов урона
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
