// src/services/spellExecutor.ts

import type { 
  SpellV2, 
  SpellAction, 
  CastContext, 
  Unit,
  RollModifier,
  DamageType
} from '../types';
import { ELEMENT_ICONS } from '../constants/elements';
import { DAMAGE_TYPE_NAMES, ELEMENT_NAMES } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export interface ExecuteSpellOptions {
  spell: SpellV2;
  caster: Unit;
  targetCount?: number;
  rollModifier?: RollModifier;
  onStepComplete?: (stepId: string, context: CastContext) => void;
  onLog?: (message: string) => void;
}

export interface ExecuteSpellResult {
  success: boolean;
  context: CastContext;
  totalDamage: number;
  damageType?: string;
  manaCost: number;
  log: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ЛОКАЛЬНЫЙ ПАРСЕР КУБИКОВ (чтобы не зависеть от внешнего модуля)
// ═══════════════════════════════════════════════════════════════════════════

interface DiceGroup {
  count: number;
  sides: number;
}

interface ParsedFormula {
  dice: DiceGroup[];
  bonus: number;
}

function parseFormula(formula: string): ParsedFormula {
  const dice: DiceGroup[] = [];
  let bonus = 0;
  
  const tokens = formula.toLowerCase().replace(/\s/g, '').match(/[+-]?(\d*d\d+|\d+)/g) || [];
  
  for (const token of tokens) {
    const diceMatch = token.match(/([+-]?)(\d*)d(\d+)/);
    if (diceMatch) {
      const sign = diceMatch[1] === '-' ? -1 : 1;
      const count = parseInt(diceMatch[2] || '1', 10) * sign;
      const sides = parseInt(diceMatch[3]!, 10);
      dice.push({ count: Math.abs(count), sides });
    } else {
      const num = parseInt(token, 10);
      if (!isNaN(num)) bonus += num;
    }
  }
  
  return { dice, bonus };
}

function rollDice(formula: string): { formula: string; rolls: number[]; bonus: number; total: number } {
  const { dice, bonus } = parseFormula(formula);
  const rolls: number[] = [];
  
  for (const { count, sides } of dice) {
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
  }
  
  const total = rolls.reduce((sum, r) => sum + r, 0) + bonus;
  
  return { formula, rolls, bonus, total };
}

// ═══════════════════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════

/** Бросок кубиков с модификатором преимущества/помехи */
function rollWithModifier(formula: string, modifier: RollModifier = 'normal'): {
  result: ReturnType<typeof rollDice>;
  rawD20?: number;
  allD20Rolls?: number[];
  isCrit: boolean;
  isCritFail: boolean;
} {
  const result = rollDice(formula);
  
  // Проверяем, есть ли d20 в формуле
  const hasD20 = formula.toLowerCase().includes('d20');
  
  if (!hasD20 || modifier === 'normal') {
    const rawD20 = hasD20 ? result.rolls[0] : undefined;
    return {
      result,
      rawD20,
      allD20Rolls: rawD20 !== undefined ? [rawD20] : undefined,
      isCrit: rawD20 === 20,
      isCritFail: rawD20 === 1
    };
  }
  
  // Преимущество или помеха — бросаем 2d20
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  
  const chosen = modifier === 'advantage' 
    ? Math.max(roll1, roll2) 
    : Math.min(roll1, roll2);
  
  // Пересчитываем результат с выбранным d20
  const parsed = parseFormula(formula);
  let total = chosen;
  const rolls = [chosen];
  
  // Добавляем остальные кубики (если есть)
  for (let i = 1; i < parsed.dice.length; i++) {
    const die = parsed.dice[i];
    if (die) {
      for (let j = 0; j < die.count; j++) {
        const roll = Math.floor(Math.random() * die.sides) + 1;
        rolls.push(roll);
        total += roll;
      }
    }
  }
  total += parsed.bonus;
  
  return {
    result: { formula, rolls, bonus: parsed.bonus, total },
    rawD20: chosen,
    allD20Rolls: [roll1, roll2],
    isCrit: chosen === 20,
    isCritFail: chosen === 1
  };
}

/** Получить бонус от элементов персонажа */
function getElementBonus(unit: Unit, elements: string[], bonusType: 'cast' | 'damage' | 'mana'): number {
  let total = 0;
  
  for (const element of elements) {
    const modifier = unit.elementModifiers.find(m => m.element === element && m.isActive);
    if (modifier) {
      switch (bonusType) {
        case 'cast':
          total += modifier.castBonus;
          break;
        case 'damage':
          total += modifier.damageBonus;
          break;
        case 'mana':
          total += modifier.manaReduction;
          break;
      }
    }
  }
  
  return total;
}

/** Вычислить бонус к броску */
function calculateBonus(unit: Unit, bonuses: SpellAction['bonuses'], spellElements: string[]): number {
  if (!bonuses) return 0;
  
  let total = 0;
  
  for (const bonus of bonuses) {
    switch (bonus.type) {
      case 'flat':
        total += bonus.flatValue ?? 0;
        break;
        
      case 'stat':
        if (bonus.statKey) {
          const statValue = unit.stats[bonus.statKey as keyof typeof unit.stats] ?? 0;
          total += statValue * (bonus.multiplier ?? 1);
        }
        break;
        
      case 'proficiency':
        if (bonus.proficiencyKey) {
          total += unit.proficiencies[bonus.proficiencyKey as keyof typeof unit.proficiencies] ?? 0;
        }
        break;
        
      case 'from_elements':
        if (bonus.elementBonusType === 'cast') {
          total += getElementBonus(unit, spellElements, 'cast');
        }
        break;
        
      case 'from_context':
        // Будет обработано позже с доступом к контексту
        break;
    }
  }
  
  return total;
}

/** Интерполяция шаблона сообщения */
function interpolateMessage(template: string, context: CastContext): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = context.values[key];
    if (value === undefined) return `{${key}}`;
    return String(value);
  });
}

/** Создать начальный контекст */
function createInitialContext(spell: SpellV2, caster: Unit, targetCount: number): CastContext {
  return {
    casterId: caster.id,
    casterName: caster.shortName || caster.name,
    targetCount,
    currentTargetIndex: 0,
    currentProjectileIndex: 0,
    
    values: {},
    log: [],
    rolls: [],
    
    totalDamage: 0,
    damageBreakdown: [],
    
    isCrit: false,
    isCritFail: false,
    
    currentStepIndex: 0,
    stopped: false,
    success: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ИСПОЛНИТЕЛИ ШАГОВ
// ═══════════════════════════════════════════════════════════════════════════

type StepExecutor = (
  action: SpellAction,
  context: CastContext,
  spell: SpellV2,
  caster: Unit,
  rollModifier: RollModifier
) => string | null; // Возвращает ID следующего шага или null для 'next'

const stepExecutors: Record<string, StepExecutor> = {
  
  // ─────────────────────────────────────────────────────────────────────────
  // roll_check: d20 + бонусы (vs порог)
  // ─────────────────────────────────────────────────────────────────────────
  roll_check: (action, context, spell, caster, rollModifier) => {
    const bonus = calculateBonus(caster, action.bonuses, spell.elements);
    const formula = bonus >= 0 ? `d20+${bonus}` : `d20${bonus}`;
    
    const { result, rawD20, allD20Rolls, isCrit, isCritFail } = rollWithModifier(formula, rollModifier);
    
    context.rolls.push({
      stepId: action.id,
      formula,
      rolls: result.rolls,
      total: result.total,
      rawD20,
      isCrit,
      isCritFail
    });
    
    context.lastRoll = result.total;
    context.lastD20 = rawD20;
    context.isCrit = isCrit;
    context.isCritFail = isCritFail;
    context.values['lastRoll'] = result.total;
    context.values['lastD20'] = rawD20;
    
    // Формируем лог
    const modText = allD20Rolls && allD20Rolls.length > 1
      ? ` (${rollModifier === 'advantage' ? '🎯' : '💨'}[${allD20Rolls.join(',')}])`
      : '';
    
    if (isCritFail) {
      context.log.push(`💀 ${action.label}: [${rawD20}]${modText} = КРИТ ПРОВАЛ!`);
      context.success = false;
    } else if (isCrit) {
      context.log.push(`✨ ${action.label}: [${rawD20}] + ${bonus} = ${result.total}${modText} — КРИТ!`);
    } else {
      context.log.push(`🎯 ${action.label}: [${rawD20}] + ${bonus} = ${result.total}${modText}`);
    }
    
    // Проверяем переходы
    return evaluateTransitions(action, context);
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // roll_dice: Просто бросить кубики
  // ─────────────────────────────────────────────────────────────────────────
  roll_dice: (action, context) => {
    const formula = action.diceFormula ?? 'd6';
    const result = rollDice(formula);
    
    context.rolls.push({
      stepId: action.id,
      formula,
      rolls: result.rolls,
      total: result.total
    });
    
    context.lastRoll = result.total;
    context.values['lastRoll'] = result.total;
    
    if (action.saveResultAs) {
      context.values[action.saveResultAs] = result.total;
    }
    
    context.log.push(`🎲 ${action.label}: ${formula} = [${result.rolls.join(', ')}] = ${result.total}`);
    
    return evaluateTransitions(action, context);
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // roll_table: Бросок → таблица
  // ─────────────────────────────────────────────────────────────────────────
  roll_table: (action, context) => {
    const formula = action.diceFormula ?? 'd12';
    const result = rollDice(formula);
    
    context.rolls.push({
      stepId: action.id,
      formula,
      rolls: result.rolls,
      total: result.total
    });
    
    context.lastRoll = result.total;
    
    // Ищем в таблице
    const table = action.resultTable ?? [];
    const entry = table.find(e => result.total >= e.min && result.total <= e.max);
    
    if (entry) {
      if (action.saveResultAs) {
        context.values[action.saveResultAs] = entry.resultValue;
      }
      
      const icon = entry.resultIcon ?? ELEMENT_ICONS[entry.resultValue] ?? '✨';
      const label = entry.resultLabel ?? ELEMENT_NAMES[entry.resultValue] ?? entry.resultValue;
      
      context.log.push(`📋 ${action.label}: [${result.total}] → ${icon} ${label}`);
    } else {
      context.log.push(`📋 ${action.label}: [${result.total}] → (не найдено в таблице)`);
    }
    
    return evaluateTransitions(action, context);
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // roll_damage: Бросок урона
  // ─────────────────────────────────────────────────────────────────────────
  roll_damage: (action, context, spell, caster) => {
    let formula = action.damageFormula ?? 'd6';
    
    // Добавляем бонус от элементов
    if (action.addDamageBonus) {
      const dmgBonus = getElementBonus(caster, spell.elements, 'damage');
      if (dmgBonus > 0) {
        formula = `${formula}+${dmgBonus}`;
      }
    }
    
    const result = rollDice(formula);
    let total = result.total;
    
    // Удваиваем при крите
    if (context.isCrit) {
      const multiplier = action.critMultiplier ?? 2;
      total = total * multiplier;
    }
    
    // Определяем тип урона
    let damageType: string | undefined;
    if (action.damageType === 'from_context' && action.damageTypeContextKey) {
      damageType = context.values[action.damageTypeContextKey] as string;
    } else if (action.damageType && action.damageType !== 'from_context') {
      damageType = action.damageType;
    }
    
    context.totalDamage += total;
    context.damageType = damageType;
    context.damageBreakdown.push({
      formula,
      result: total,
      type: damageType,
      isCrit: context.isCrit
    });
    
    if (action.saveDamageAs) {
      context.values[action.saveDamageAs] = total;
    }
    
    const typeLabel = damageType 
      ? (DAMAGE_TYPE_NAMES[damageType as DamageType] ?? ELEMENT_NAMES[damageType] ?? damageType)
      : '';
    const critText = context.isCrit ? ' ×2' : '';
    
    context.log.push(`💥 ${action.label}: ${formula} = ${total}${critText} ${typeLabel}`);
    
    return evaluateTransitions(action, context);
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // damage_tiers: Бросок → tier → урон
  // ─────────────────────────────────────────────────────────────────────────
  damage_tiers: (action, context, spell, caster) => {
    const formula = action.diceFormula ?? 'd20';
    const result = rollDice(formula);
    
    context.rolls.push({
      stepId: action.id,
      formula,
      rolls: result.rolls,
      total: result.total
    });
    
    context.lastRoll = result.total;
    
    // Ищем tier
    const tiers = action.damageTiers ?? [];
    const tier = tiers.find(t => result.total >= t.minRoll && result.total <= t.maxRoll);
    
    if (!tier) {
      context.log.push(`⚔️ ${action.label}: [${result.total}] — нет подходящего tier!`);
      return evaluateTransitions(action, context);
    }
    
    context.log.push(`⚔️ ${action.label}: [${result.total}] → ${tier.label ?? tier.formula}`);
    
    // Бросаем урон по tier'у
    let dmgFormula = tier.formula;
    if (action.addDamageBonus) {
      const dmgBonus = getElementBonus(caster, spell.elements, 'damage');
      if (dmgBonus > 0) {
        dmgFormula = `${dmgFormula}+${dmgBonus}`;
      }
    }
    
    const dmgResult = rollDice(dmgFormula);
    let dmgTotal = dmgResult.total;
    
    // Крит на 20 в этом броске?
    const isTierCrit = result.total === 20;
    if (isTierCrit) {
      context.isCrit = true;
      dmgTotal *= (action.critMultiplier ?? 2);
    }
    
    // Определяем тип урона
    let damageType: string | undefined;
    if (action.damageType === 'from_context' && action.damageTypeContextKey) {
      damageType = context.values[action.damageTypeContextKey] as string;
    } else if (action.damageType && action.damageType !== 'from_context') {
      damageType = action.damageType;
    }
    
    context.totalDamage += dmgTotal;
    context.damageType = damageType;
    context.damageBreakdown.push({
      formula: dmgFormula,
      result: dmgTotal,
      type: damageType,
      isCrit: isTierCrit
    });
    
    const typeLabel = damageType 
      ? (DAMAGE_TYPE_NAMES[damageType as DamageType] ?? ELEMENT_NAMES[damageType] ?? damageType)
      : '';
    const critText = isTierCrit ? ' ×2 КРИТ!' : '';
    
    context.log.push(`💥 Урон: ${dmgFormula} = ${dmgTotal}${critText} ${typeLabel}`);
    
    return evaluateTransitions(action, context);
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // set_value: Установить значение
  // ─────────────────────────────────────────────────────────────────────────
  set_value: (action, context) => {
    if (action.setKey) {
      if (action.setValueFromContext) {
        context.values[action.setKey] = context.values[action.setValueFromContext];
      } else if (action.setValueFormula) {
        const result = rollDice(action.setValueFormula);
        context.values[action.setKey] = result.total;
      } else {
        context.values[action.setKey] = action.setValue;
      }
      
      context.log.push(`📝 ${action.setKey} = ${context.values[action.setKey]}`);
    }
    
    return evaluateTransitions(action, context);
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // message: Показать сообщение
  // ─────────────────────────────────────────────────────────────────────────
  message: (action, context) => {
    if (action.messageTemplate) {
      const message = interpolateMessage(action.messageTemplate, context);
      context.log.push(`💬 ${message}`);
    }
    
    return evaluateTransitions(action, context);
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // branch: Условный переход
  // ─────────────────────────────────────────────────────────────────────────
  branch: (action, context) => {
    if (!action.branchCondition) {
      return action.branchFalseStepId ?? 'next';
    }
    
    const { type, key, value, valueMax } = action.branchCondition;
    const actualValue = context.values[key];
    
    let conditionMet = false;
    
    switch (type) {
      case 'value_exists':
        conditionMet = actualValue !== undefined;
        break;
      case 'value_equals':
        conditionMet = actualValue == value;
        break;
      case 'value_gte':
        conditionMet = typeof actualValue === 'number' && actualValue >= (value as number);
        break;
      case 'value_lte':
        conditionMet = typeof actualValue === 'number' && actualValue <= (value as number);
        break;
      case 'value_in_range':
        conditionMet = typeof actualValue === 'number' 
          && actualValue >= (value as number) 
          && actualValue <= (valueMax ?? value as number);
        break;
    }
    
    context.log.push(`🔀 ${action.label}: ${key}=${actualValue} ${type} ${value} → ${conditionMet ? 'ДА' : 'НЕТ'}`);
    
    return conditionMet ? (action.branchTrueStepId ?? 'next') : (action.branchFalseStepId ?? 'stop');
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // goto: Безусловный переход
  // ─────────────────────────────────────────────────────────────────────────
  goto: (action, context) => {
    context.log.push(`➡️ Переход к: ${action.gotoStepId}`);
    return action.gotoStepId ?? 'next';
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // stop: Остановка
  // ─────────────────────────────────────────────────────────────────────────
  stop: (action, context) => {
    context.log.push(`🛑 ${action.label ?? 'Стоп'}`);
    context.stopped = true;
    return 'stop';
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // modify_resource: Изменить ресурс
  // ─────────────────────────────────────────────────────────────────────────
  modify_resource: (action, context) => {
    // Фактическое изменение ресурсов происходит в MagicTab после выполнения
    // Здесь только логируем
    const amount = action.resourceAmount ?? 0;
    const op = action.resourceOperation === 'restore' ? '+' : '-';
    const type = action.resourceType ?? 'mana';
    
    context.log.push(`💠 ${op}${amount} ${type}`);
    
    // Сохраняем в контекст для применения позже
    if (!context.values._resourceChanges) {
      context.values._resourceChanges = [];
    }
    (context.values._resourceChanges as any[]).push({
      type,
      amount: action.resourceOperation === 'restore' ? amount : -amount,
      resourceId: action.resourceId
    });
    
    return evaluateTransitions(action, context);
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // apply_damage: Применить урон (маркер)
  // ─────────────────────────────────────────────────────────────────────────
  apply_damage: (action, context) => {
    context.log.push(`🩸 Итоговый урон: ${context.totalDamage}`);
    return evaluateTransitions(action, context);
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ОЦЕНКА ПЕРЕХОДОВ
// ═══════════════════════════════════════════════════════════════════════════

function evaluateTransitions(action: SpellAction, context: CastContext): string | null {
  if (!action.transitions || action.transitions.length === 0) {
    return action.defaultNextStepId ?? null;
  }
  
  // Сортируем по приоритету
  const sorted = [...action.transitions].sort((a, b) => a.priority - b.priority);
  
  for (const transition of sorted) {
    if (checkTransitionCondition(transition, context)) {
      return transition.targetStepId;
    }
  }
  
  return action.defaultNextStepId ?? null;
}

function checkTransitionCondition(transition: { condition: string; conditionKey?: string; conditionValue?: any; conditionValueMax?: number }, context: CastContext): boolean {
  switch (transition.condition) {
    case 'always':
      return true;
      
    case 'crit':
      return context.isCrit;
      
    case 'crit_fail':
      return context.isCritFail;
      
    case 'success':
      return context.success && !context.isCritFail;
      
    case 'fail':
      return !context.success || context.isCritFail;
      
    case 'value_equals':
      return transition.conditionKey 
        ? context.values[transition.conditionKey] == transition.conditionValue
        : false;
      
    case 'value_gte':
      return transition.conditionKey && typeof context.values[transition.conditionKey] === 'number'
        ? context.values[transition.conditionKey] >= (transition.conditionValue as number)
        : false;
      
    case 'value_lte':
      return transition.conditionKey && typeof context.values[transition.conditionKey] === 'number'
        ? context.values[transition.conditionKey] <= (transition.conditionValue as number)
        : false;
      
    case 'value_in_range':
      if (!transition.conditionKey || typeof context.values[transition.conditionKey] !== 'number') {
        return false;
      }
      const val = context.values[transition.conditionKey] as number;
      const min = transition.conditionValue as number;
      const max = transition.conditionValueMax ?? min;
      return val >= min && val <= max;
      
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ ВЫПОЛНЕНИЯ
// ═══════════════════════════════════════════════════════════════════════════

export async function executeSpell(options: ExecuteSpellOptions): Promise<ExecuteSpellResult> {
  const { 
    spell, 
    caster, 
    targetCount = 1, 
    rollModifier = 'normal',
    onStepComplete,
    onLog
  } = options;
  
  const context = createInitialContext(spell, caster, targetCount);
  
  // Сортируем шаги по order
  const sortedActions = [...spell.actions].sort((a, b) => a.order - b.order);
  
  // Создаём карту id → индекс
  const actionMap = new Map<string, number>();
  sortedActions.forEach((action, index) => {
    actionMap.set(action.id, index);
  });
  
  // Рассчитываем стоимость
  let manaCost = spell.cost;
  const manaReduction = getElementBonus(caster, spell.elements, 'mana');
  manaCost = Math.max(0, manaCost - manaReduction);
  
  // Лог начала
  context.log.push(`═══ ${spell.name} ═══`);
  if (manaReduction > 0) {
    context.log.push(`💠 Мана: ${spell.cost} - ${manaReduction} (предрасп.) = ${manaCost}`);
  }
  
  // Определяем количество снарядов
  let projectileCount = 1;
  if (spell.projectiles && spell.projectiles !== '1') {
    if (/^\d+$/.test(spell.projectiles)) {
      projectileCount = parseInt(spell.projectiles, 10);
    } else {
      const projResult = rollDice(spell.projectiles);
      projectileCount = projResult.total;
      context.log.push(`🎲 Снарядов: ${spell.projectiles} = ${projectileCount}`);
    }
  }
  
  // Выполняем цепочку для каждого снаряда
  let currentIndex = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 100; // Защита от бесконечных циклов
  
  while (currentIndex < sortedActions.length && !context.stopped && iterations < MAX_ITERATIONS) {
    iterations++;
    
    const action = sortedActions[currentIndex];
    if (!action) break;
    
    context.currentStepIndex = currentIndex;
    context.currentStepId = action.id;
    
    // Проверяем условие выполнения шага
    if (action.condition && action.condition.type !== 'always') {
      const condMet = checkStepCondition(action.condition, context);
      if (!condMet) {
        currentIndex++;
        continue;
      }
    }
    
    // Выполняем шаг
    const executor = stepExecutors[action.type];
    let nextStepId: string | null = null;
    
    if (executor) {
      // Используем модификатор только для первого броска
      const useModifier = iterations === 1 ? rollModifier : 'normal';
      nextStepId = executor(action, context, spell, caster, useModifier);
    } else {
      context.log.push(`⚠️ Неизвестный тип шага: ${action.type}`);
    }
    
    // Коллбэк
    if (onStepComplete) {
      onStepComplete(action.id, context);
    }
    
    // Определяем следующий шаг
    if (nextStepId === 'stop' || context.stopped) {
      break;
    } else if (nextStepId === 'next' || nextStepId === null) {
      currentIndex++;
    } else {
      // Переход к конкретному шагу по ID
      const targetIndex = actionMap.get(nextStepId);
      if (targetIndex !== undefined) {
        currentIndex = targetIndex;
      } else {
        context.log.push(`⚠️ Шаг не найден: ${nextStepId}`);
        currentIndex++;
      }
    }
  }
  
  if (iterations >= MAX_ITERATIONS) {
    context.log.push(`⚠️ Превышен лимит итераций!`);
    context.error = 'Max iterations exceeded';
  }
  
  // Логируем в консоль
  if (onLog) {
    context.log.forEach(line => onLog(line));
  }
  
  return {
    success: context.success && !context.isCritFail,
    context,
    totalDamage: context.totalDamage,
    damageType: context.damageType,
    manaCost,
    log: context.log
  };
}

function checkStepCondition(
  condition: NonNullable<SpellAction['condition']>, 
  context: CastContext
): boolean {
  const { type, key, value } = condition;
  
  switch (type) {
    case 'always':
      return true;
    case 'value_exists':
      return key ? context.values[key] !== undefined : false;
    case 'value_equals':
      return key ? context.values[key] == value : false;
    case 'value_gte':
      return key && typeof context.values[key] === 'number' 
        ? context.values[key] >= (value as number) 
        : false;
    case 'value_lte':
      return key && typeof context.values[key] === 'number' 
        ? context.values[key] <= (value as number) 
        : false;
    default:
      return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════════════════════════════

export const spellExecutor = {
  execute: executeSpell,
  calculateManaCost: (spell: SpellV2, caster: Unit): number => {
    const manaReduction = getElementBonus(caster, spell.elements, 'mana');
    return Math.max(0, spell.cost - manaReduction);
  },
  getElementBonus,
};
