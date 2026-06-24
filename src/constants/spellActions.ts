// src/constants/spellActions.ts

import type { 
  SpellActionType, 
  TransitionCondition, 
  SpellV2, 
  SpellAction,
  TableResultEntry,
  DamageTierEntry,
  StepTransition
} from '../types';
import { generateId } from '../utils/shared';
export { generateId };

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ ШАГОВ
// ═══════════════════════════════════════════════════════════════════════════

export const SPELL_ACTION_TYPES: {
  value: SpellActionType;
  label: string;
  icon: string;
  description: string;
  category: 'roll' | 'effect' | 'flow' | 'utility';
}[] = [
  // Броски (новые типы)
  { value: 'roll_attack', label: 'Попадание (Атака)', icon: '⚔️', description: 'Крит = x2 кубов урона', category: 'roll' },
  { value: 'roll_cast', label: 'Каст (Магия)', icon: '✨', description: 'Крит = 1/2 маны', category: 'roll' },
  
  // Остальные типы
  { value: 'roll_dice', label: 'Бросок кубиков', icon: '🎲', description: 'Бросить и сохранить', category: 'roll' },
  { value: 'roll_table', label: 'Бросок по таблице', icon: '📋', description: 'Бросок → результат из таблицы', category: 'roll' },
  { value: 'roll_damage', label: 'Бросок урона', icon: '💥', description: 'Бросить кубики урона', category: 'roll' },
  { value: 'damage_tiers', label: 'Урон по tier', icon: '⚖️', description: 'Урон зависит от броска', category: 'roll' },
  
  // Эффекты
  { value: 'modify_resource', label: 'Изменить ресурс', icon: '💠', description: 'Потратить/восстановить', category: 'effect' },
  { value: 'apply_damage', label: 'Применить урон', icon: '🩸', description: 'Нанести урон цели', category: 'effect' },
  { value: 'message', label: 'Сообщение', icon: '💬', description: 'Показать в логе', category: 'effect' },
  
  // Управление потоком
  { value: 'branch', label: 'Условие', icon: '🔀', description: 'Если X → Y, иначе → Z', category: 'flow' },
  { value: 'goto', label: 'Переход', icon: '➡️', description: 'Перейти к шагу', category: 'flow' },
  { value: 'stop', label: 'Стоп', icon: '🛑', description: 'Остановить', category: 'flow' },
  
  // Утилиты
  { value: 'set_value', label: 'Установить значение', icon: '📝', description: 'Сохранить в контекст', category: 'utility' },
];

// ═══════════════════════════════════════════════════════════════════════════
// УСЛОВИЯ ПЕРЕХОДОВ
// ═══════════════════════════════════════════════════════════════════════════

export const TRANSITION_CONDITIONS: {
  value: TransitionCondition;
  label: string;
  icon: string;
  needsKey?: boolean;
  needsValue?: boolean;
  needsValueMax?: boolean;
}[] = [
  { value: 'always', label: 'Всегда', icon: '✓' },
  { value: 'crit', label: 'При крите (20)', icon: '✨' },
  { value: 'crit_fail', label: 'При провале (1)', icon: '💀' },
  { value: 'success', label: 'При успехе', icon: '✅' },
  { value: 'fail', label: 'При провале', icon: '❌' },
  { value: 'value_equals', label: 'Значение =', icon: '=', needsKey: true, needsValue: true },
  { value: 'value_gte', label: 'Значение ≥', icon: '≥', needsKey: true, needsValue: true },
  { value: 'value_lte', label: 'Значение ≤', icon: '≤', needsKey: true, needsValue: true },
  { value: 'value_in_range', label: 'В диапазоне', icon: '↔', needsKey: true, needsValue: true, needsValueMax: true },
];

// ═══════════════════════════════════════════════════════════════════════════
// ХАРАКТЕРИСТИКИ ДЛЯ БОНУСОВ
// ═══════════════════════════════════════════════════════════════════════════

export const STAT_BONUS_OPTIONS: {
  value: string;
  label: string;
  multiplier: number;
}[] = [
  { value: 'intelligence', label: 'Интеллект', multiplier: 1 },
  { value: 'charisma', label: 'Харизма', multiplier: 1 },
  { value: 'dexterity', label: 'Ловкость', multiplier: 1 },
  { value: 'physicalPower', label: 'Физ. сила (×5)', multiplier: 5 },
  { value: 'vitality', label: 'Живучесть', multiplier: 1 },
  { value: 'initiative', label: 'Инициатива', multiplier: 1 },
];

// ═══════════════════════════════════════════════════════════════════════════
// РЕСУРСЫ
// ═══════════════════════════════════════════════════════════════════════════

export const RESOURCE_TYPES: {
  value: 'mana' | 'health' | 'resource';
  label: string;
  icon: string;
}[] = [
  { value: 'mana', label: 'Мана', icon: '💠' },
  { value: 'health', label: 'Здоровье', icon: '❤️' },
  { value: 'resource', label: 'Другой ресурс', icon: '📦' },
];

// ═══════════════════════════════════════════════════════════════════════════
// ПОПУЛЯРНЫЕ ФОРМУЛЫ КУБИКОВ
// ═══════════════════════════════════════════════════════════════════════════

export const COMMON_DICE_FORMULAS: string[] = [
  'd4', 'd6', 'd8', 'd10', 'd12', 'd20',
  '2d6', '2d8', '2d10', '2d12',
  '3d6', '4d6', '3d8', '4d8',
  'd6+2', 'd8+3', 'd10+5',
  '2d6+3', '2d8+4', '2d10+5',
  '4d12+2d10', '4d20+2d12', '8d20',
];

// ═══════════════════════════════════════════════════════════════════════════
// СОЗДАНИЕ ПУСТЫХ ОБЪЕКТОВ
// ═══════════════════════════════════════════════════════════════════════════

export function createEmptyTableEntry(min: number = 1, max: number = 1): TableResultEntry {
  return {
    id: generateId(),
    min,
    max,
    resultValue: '',
    resultLabel: '',
    resultIcon: '✨'
  };
}

export function createEmptyDamageTier(minRoll: number = 1, maxRoll: number = 5): DamageTierEntry {
  return {
    id: generateId(),
    minRoll,
    maxRoll,
    formula: 'd6',
    label: ''
  };
}

export function createEmptyTransition(condition: TransitionCondition = 'always'): StepTransition {
  return {
    id: generateId(),
    condition,
    targetStepId: 'next',
    priority: 99
  };
}

export function createEmptyAction(type: SpellActionType, order: number): SpellAction {
  const meta = SPELL_ACTION_TYPES.find(t => t.value === type);
  
  const base: SpellAction = {
    id: generateId(),
    type,
    label: meta?.label ?? type,
    order,
  };
  
  switch (type) {
    case 'roll_attack':
    case 'roll_cast':
      return { 
        ...base, 
        diceFormula: 'd20', 
        bonuses: [], 
        successThreshold: 10,
        transitions: [
          { id: generateId(), condition: 'crit_fail', targetStepId: 'stop', priority: 0 },
          { id: generateId(), condition: 'fail', targetStepId: 'stop', priority: 1 },
          { id: generateId(), condition: 'always', targetStepId: 'next', priority: 99 },
        ]
      };
    case 'roll_check': // Оставлено для совместимости
      return { 
        ...base, 
        diceFormula: 'd20', 
        bonuses: [], 
        successThreshold: 10,
        transitions: [
          { id: generateId(), condition: 'crit_fail', targetStepId: 'stop', priority: 0 },
          { id: generateId(), condition: 'always', targetStepId: 'next', priority: 99 },
        ]
      };
    case 'roll_dice':
      return { ...base, diceFormula: 'd12', saveResultAs: 'lastRoll' };
    case 'roll_table':
      return { 
        ...base, 
        diceFormula: 'd12', 
        resultTable: [
          createEmptyTableEntry(1, 6),
          createEmptyTableEntry(7, 12),
        ], 
        saveResultAs: 'tableResult' 
      };
    case 'roll_damage':
      return { ...base, damageFormula: '2d6', damageType: 'огонь', critMultiplier: 2, addDamageBonus: true };
    case 'damage_tiers':
      return { 
        ...base, 
        diceFormula: 'd20', 
        damageTiers: [
          { id: generateId(), minRoll: 1, maxRoll: 5, formula: 'd6', label: 'Слабый' },
          { id: generateId(), minRoll: 6, maxRoll: 10, formula: '2d8', label: 'Средний' },
          { id: generateId(), minRoll: 11, maxRoll: 15, formula: '3d10', label: 'Сильный' },
          { id: generateId(), minRoll: 16, maxRoll: 20, formula: '4d12', label: 'Мощный' },
        ],
        damageType: 'огонь'
      };
    case 'set_value':
      return { ...base, setKey: '', setValue: '' };
    case 'modify_resource':
      return { ...base, resourceType: 'mana', resourceAmount: 0, resourceOperation: 'spend' };
    case 'message':
      return { ...base, messageTemplate: '', messageType: 'info' };
    case 'branch':
      return { 
        ...base, 
        branchCondition: { type: 'value_equals', key: '', value: '' },
        branchTrueStepId: 'next',
        branchFalseStepId: 'stop'
      };
    case 'goto':
      return { ...base, gotoStepId: 'next' };
    case 'stop':
      return base;
    case 'apply_damage':
      return base;
    default:
      return base;
  }
}

export function createEmptySpellV2(): SpellV2 {
  return {
    id: generateId(),
    name: 'Новое заклинание',
    version: 2,
    cost: 10,
    costResource: 'mana',
    spellType: 'targeted',
    projectiles: '1',
    elements: [],
    description: '',
    actions: [],
    modifiers: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ШАБЛОНЫ ЗАКЛИНАНИЙ
// ═══════════════════════════════════════════════════════════════════════════

export function createSimpleDamageSpell(): SpellV2 {
  return {
    id: generateId(),
    name: 'Огненный шар',
    version: 2,
    cost: 15,
    costResource: 'mana',
    spellType: 'targeted',
    projectiles: '1',
    elements: ['огонь'],
    description: 'Простое заклинание огненного урона',
    actions: [
      {
        id: generateId(),
        type: 'roll_cast', // Новое
        label: 'Каст',
        order: 0,
        diceFormula: 'd20',
        bonuses: [{ type: 'from_elements', elementBonusType: 'cast' }],
        transitions: [
          { id: generateId(), condition: 'crit_fail', targetStepId: 'stop', priority: 0 },
          { id: generateId(), condition: 'fail', targetStepId: 'stop', priority: 1 },
          { id: generateId(), condition: 'always', targetStepId: 'next', priority: 99 },
        ],
      },
      {
        id: generateId(),
        type: 'roll_damage',
        label: 'Урон',
        order: 1,
        damageFormula: '2d6',
        damageType: 'огонь',
        critMultiplier: 2,
        addDamageBonus: true,
      },
    ],
    modifiers: [],
  };
}

export function createMultiStepSpell(): SpellV2 {
  return {
    id: generateId(),
    name: 'Хаотичная сфера',
    version: 2,
    cost: 20,
    costResource: 'mana',
    spellType: 'targeted',
    projectiles: '1',
    elements: ['астрал'],
    description: 'Каст → элемент → сила → урон',
    actions: [
      {
        id: generateId(),
        type: 'roll_cast',
        label: 'Каст',
        order: 0,
        diceFormula: 'd20',
        bonuses: [],
        transitions: [
          { id: generateId(), condition: 'crit_fail', targetStepId: 'stop', priority: 0 },
          { id: generateId(), condition: 'fail', targetStepId: 'stop', priority: 1 },
          { id: generateId(), condition: 'always', targetStepId: 'next', priority: 99 },
        ],
      },
      {
        id: generateId(),
        type: 'roll_table',
        label: 'Элемент',
        order: 1,
        diceFormula: 'd12',
        resultTable: [
          { id: generateId(), min: 1, max: 2, resultValue: 'огонь', resultLabel: 'Огонь', resultIcon: '🔥' },
          { id: generateId(), min: 3, max: 4, resultValue: 'вода', resultLabel: 'Вода', resultIcon: '💧' },
          { id: generateId(), min: 5, max: 6, resultValue: 'электричество', resultLabel: 'Молния', resultIcon: '⚡' },
          { id: generateId(), min: 7, max: 8, resultValue: 'земля', resultLabel: 'Земля', resultIcon: '🪨' },
          { id: generateId(), min: 9, max: 10, resultValue: 'тьма', resultLabel: 'Тьма', resultIcon: '🌑' },
          { id: generateId(), min: 11, max: 12, resultValue: 'свет', resultLabel: 'Свет', resultIcon: '✨' },
        ],
        saveResultAs: 'element',
      },
      {
        id: generateId(),
        type: 'damage_tiers',
        label: 'Сила',
        order: 2,
        diceFormula: 'd20',
        damageTiers: [
          { id: generateId(), minRoll: 1, maxRoll: 5, formula: 'd6', label: 'Слабый' },
          { id: generateId(), minRoll: 6, maxRoll: 10, formula: '2d8', label: 'Средний' },
          { id: generateId(), minRoll: 11, maxRoll: 15, formula: '3d10', label: 'Сильный' },
          { id: generateId(), minRoll: 16, maxRoll: 20, formula: '4d12', label: 'Мощный' },
        ],
        damageType: 'from_context',
        damageTypeContextKey: 'element',
      },
    ],
    modifiers: [],
  };
}

export function createBranchingSpell(): SpellV2 {
  const stepCastId = generateId();
  const stepBranchId = generateId();
  const stepDamageFireId = generateId();
  const stepDamageIceId = generateId();
  
  return {
    id: generateId(),
    name: 'Двойственность',
    version: 2,
    cost: 25,
    costResource: 'mana',
    spellType: 'targeted',
    projectiles: '1',
    elements: ['огонь', 'вода'],
    description: 'Случайно огонь или вода с разным уроном',
    actions: [
      {
        id: stepCastId,
        type: 'roll_cast',
        label: 'Каст',
        order: 0,
        diceFormula: 'd20',
        bonuses: [],
        transitions: [
          { id: generateId(), condition: 'crit_fail', targetStepId: 'stop', priority: 0 },
          { id: generateId(), condition: 'fail', targetStepId: 'stop', priority: 1 },
          { id: generateId(), condition: 'always', targetStepId: 'next', priority: 99 },
        ],
      },
      {
        id: generateId(),
        type: 'roll_dice',
        label: 'Выбор стихии',
        order: 1,
        diceFormula: 'd2',
        saveResultAs: 'elementChoice',
      },
      {
        id: stepBranchId,
        type: 'branch',
        label: 'Ветвление',
        order: 2,
        branchCondition: { type: 'value_equals', key: 'elementChoice', value: 1 },
        branchTrueStepId: stepDamageFireId,
        branchFalseStepId: stepDamageIceId,
      },
      {
        id: stepDamageFireId,
        type: 'roll_damage',
        label: 'Урон огнём',
        order: 3,
        damageFormula: '3d6',
        damageType: 'огонь',
        critMultiplier: 2,
      },
      {
        id: stepDamageIceId,
        type: 'roll_damage',
        label: 'Урон водой',
        order: 4,
        damageFormula: '2d8+4',
        damageType: 'вода',
        critMultiplier: 2,
      },
    ],
    modifiers: [],
  };
}

export const SPELL_TEMPLATES: {
  id: string;
  name: string;
  description: string;
  icon: string;
  create: () => SpellV2;
}[] = [
  {
    id: 'empty',
    name: 'Пустое',
    description: 'Чистый лист для создания с нуля',
    icon: '📄',
    create: createEmptySpellV2,
  },
  {
    id: 'simple_damage',
    name: 'Простой урон',
    description: 'Каст → урон',
    icon: '🔥',
    create: createSimpleDamageSpell,
  },
  {
    id: 'multi_step',
    name: 'Многошаговое',
    description: 'Каст → таблица элементов → tier урона',
    icon: '🌀',
    create: createMultiStepSpell,
  },
  {
    id: 'branching',
    name: 'С ветвлением',
    description: 'Случайный выбор между двумя вариантами',
    icon: '🔀',
    create: createBranchingSpell,
  },
];
