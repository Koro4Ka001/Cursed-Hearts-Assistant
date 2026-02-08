import type { ProficiencyType, StatBonusType } from '../types';

export const PROFICIENCY_NAMES: Record<ProficiencyType, string> = {
  swords: 'Мечи',
  axes: 'Топоры',
  hammers: 'Молоты',
  polearms: 'Древковое',
  unarmed: 'Рукопашный',
  bows: 'Луки',
};

export const PROFICIENCY_ICONS: Record<ProficiencyType, string> = {
  swords: '⚔️',
  axes: '🪓',
  hammers: '🔨',
  polearms: '🔱',
  unarmed: '👊',
  bows: '🏹',
};

export const STAT_NAMES: Record<StatBonusType, string> = {
  physicalPower: 'Физ. мощь',
  dexterity: 'Ловкость',
  intelligence: 'Интеллект',
  none: 'Нет',
};

export const STAT_MULTIPLIERS: Record<StatBonusType, number> = {
  physicalPower: 5,
  dexterity: 3,
  intelligence: 3,
  none: 0,
};

export const STAT_FULL_NAMES: Record<string, string> = {
  physicalPower: 'Физическая мощь',
  dexterity: 'Ловкость',
  intelligence: 'Интеллект',
  vitality: 'Живучесть',
  charisma: 'Харизма',
  initiative: 'Инициатива',
};
