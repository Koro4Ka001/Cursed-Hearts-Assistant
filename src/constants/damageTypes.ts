import type { DamageType, DamageCategory } from '../types';

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
  darkness: 'Тьма',
  electricity: 'Электричество',
  void: 'Пустота',
  life: 'Жизнь',
  death: 'Смерть',
  astral: 'Астрал',
  corruption: 'Скверна',
  space: 'Пространство',
  blood: 'Кровь',
  frost: 'Мороз',
  nature: 'Природа',
  transcendence: 'Запредельность',
  pure: 'Чистый',
};

export const DAMAGE_TYPE_ICONS: Record<DamageType, string> = {
  slashing: '🗡️',
  piercing: '🔪',
  bludgeoning: '🔨',
  chopping: '🪓',
  fire: '🔥',
  water: '💧',
  earth: '🪨',
  air: '💨',
  light: '☀️',
  darkness: '🌑',
  electricity: '⚡',
  void: '🕳️',
  life: '💚',
  death: '💀',
  astral: '🌟',
  corruption: '☠️',
  space: '🌀',
  blood: '🩸',
  frost: '❄️',
  nature: '🌿',
  transcendence: '✨',
  pure: '⚪',
};

export const DAMAGE_CATEGORIES: Record<DamageType, DamageCategory> = {
  slashing: 'physical',
  piercing: 'physical',
  bludgeoning: 'physical',
  chopping: 'physical',
  fire: 'magical',
  water: 'magical',
  earth: 'magical',
  air: 'magical',
  light: 'magical',
  darkness: 'magical',
  electricity: 'magical',
  void: 'magical',
  life: 'magical',
  death: 'magical',
  astral: 'magical',
  corruption: 'magical',
  space: 'magical',
  blood: 'magical',
  frost: 'magical',
  nature: 'magical',
  transcendence: 'magical',
  pure: 'pure',
};

export const PHYSICAL_DAMAGE_TYPES: DamageType[] = ['slashing', 'piercing', 'bludgeoning', 'chopping'];

export const MAGICAL_DAMAGE_TYPES: DamageType[] = [
  'fire', 'water', 'earth', 'air', 'light', 'darkness',
  'electricity', 'void', 'life', 'death', 'astral', 'corruption',
  'space', 'blood', 'frost', 'nature', 'transcendence'
];
