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
// ЛОКАЛЬНЫЙ ПАРСЕР КУБИКОВ
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

function doubleDiceInFormula(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/gi, (_, count, sides) => {
    const c = parseInt(count || '1', 10);
    return `${c * 2}d${sides}`;
  });
}

function rollWithModifier(formula: string, modifier: RollModifier = 'normal'): {
  result: ReturnType<typeof rollDice>;
  rawD20?: number;
  allD20Rolls?: number[];
  isCrit: boolean;
  isCritFail: boolean;
} {
  const result = rollDice(formula);
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
  
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  const chosen = modifier === 'advantage' ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
  
  const parsed = parseFormula(formula);
  let total = chosen;
  const rolls = [chosen];
  
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

function getElementBonus(unit: Unit, elements: string[], bonusType: 'cast' | 'damage' | 'mana'): number {
  let total = 0;
  for (const element of elements) {
    const modifier = unit.elementModifiers.find(m => m.element === element && m.isActive);
    if (modifier) {
      switch (bonusType) {
        case 'cast': total += modifier.castBonus; break;
        case 'damage': total += modifier.damageBonus; break;
        case 'mana': total += modifier.manaReduction; break;
      }
    }
  }
  return total;
}

function calculateBonus(unit: Unit, bonuses: SpellAction['bonuses'], spellElements: string[]): number {
  if (!bonuses) return 0;
  let total = 0;
  for (const bonus of bonuses) {
    switch (bonus.type) {
      case 'flat': total += bonus.flatValue ?? 0; break;
      case 'stat': if (bonus.statKey) total += (unit.stats[bonus.statKey as keyof typeof unit.stats] ?? 0) * (bonus.multiplier ?? 1); break;
      case 'proficiency': if (bonus.proficiencyKey) total += unit.proficiencies[bonus.proficiencyKey as keyof typeof unit.proficiencies] ?? 0; break;
      case 'from_elements': if (bonus.elementBonusType === 'cast') total += getElementBonus(unit, spellElements, 'cast'); break;
    }
  }
  return total;
}

function interpolateMessage(template: string, context: CastContext): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = context.values[key];
    if (value === undefined) return `{${key}}`;
    return String(value);
  });
}

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
) => string | null;

const stepExecutors: Record<string, StepExecutor> = {
  
  // ⚔️ roll_attack: Попадание (Крит = удвоение кубов)
  roll_attack: (action, context, spell, caster, rollModifier) => {
    const bonus = calculateBonus(caster, action.bonuses, spell.elements);
    const formula = bonus >= 0 ? `d20+${bonus}` : `d20${bonus}`;
    const { result, rawD20, allD20Rolls, isCrit, isCritFail } = rollWithModifier(formula, rollModifier);
    
    context.rolls.push({ stepId: action.id, formula, rolls: result.rolls, total: result.total, rawD20, isCrit, isCritFail });
    context.lastRoll = result.total;
    context.lastD20 = rawD20;
    
    const threshold = action.successThreshold ?? 10;
    const isSuccess = !isCritFail && (isCrit || result.total >= threshold);
    
    context.success = isSuccess;
    context.isCrit = isCrit;
    context.isCritFail = isCritFail;
    
    if (isCrit) {
      context.doubleDamageDice = true;
    }

    const rollsStr = `[${result.rolls.join(', ')}]`;
    const modText = allD20Rolls && allD20Rolls.length > 1 ? ` (${rollModifier === 'advantage' ? '🎯' : '💨'}[${allD20Rolls.join(',')}])` : '';
    
    if (isCritFail) context.log.push(`💀 Попадание: ${rollsStr}${modText} = КРИТ ПРОВАЛ!`);
    else if (!isSuccess) context.log.push(`💨 Попадание: ${rollsStr} + ${bonus} = ${result.total}${modText} (мимо, AC ${threshold})`);
    else if (isCrit) context.log.push(`✨ Попадание: ${rollsStr} + ${bonus} = ${result.total}${modText} — КРИТ! (Кубы ×2)`);
    else context.log.push(`🎯 Попадание: ${rollsStr} + ${bonus} = ${result.total}${modText}`);
    
    return evaluateTransitions(action, context);
  },

  // ✨ roll_cast: Каст (Крит = половина маны)
  roll_cast: (action, context, spell, caster, rollModifier) => {
    const bonus = calculateBonus(caster, action.bonuses, spell.elements);
    const formula = bonus >= 0 ? `d20+${bonus}` : `d20${bonus}`;
    const { result, rawD20, allD20Rolls, isCrit, isCritFail } = rollWithModifier(formula, rollModifier);
    
    context.rolls.push({ stepId: action.id, formula, rolls: result.rolls, total: result.total, rawD20, isCrit, isCritFail });
    context.lastRoll = result.total;
    context.lastD20 = rawD20;

    const threshold = action.successThreshold ?? 10;
    const isSuccess = !isCritFail && (isCrit || result.total >= threshold);
    
    context.success = isSuccess;
    context.isCrit = isCrit;
    context.isCritFail = isCritFail;
    
    if (isCrit) {
      context.manaDiscount = 0.5;
    }

    const rollsStr = `[${result.rolls.join(', ')}]`;
    const modText = allD20Rolls && allD20Rolls.length > 1 ? ` (${rollModifier === 'advantage' ? '🎯' : '💨'}[${allD20Rolls.join(',')}])` : '';
    
    if (isCritFail) context.log.push(`💀 Каст: ${rollsStr}${modText} = ПРОВАЛ!`);
    else if (!isSuccess) context.log.push(`💨 Каст: ${rollsStr} + ${bonus} = ${result.total}${modText} (сложность ${threshold})`);
    else if (isCrit) context.log.push(`✨ Каст: ${rollsStr} + ${bonus} = ${result.total}${modText} — ИДЕАЛЬНО! (Мана ×0.5)`);
    else context.log.push(`✨ Каст: ${rollsStr} + ${bonus} = ${result.total}${modText}`);
    
    return evaluateTransitions(action, context);
  },

  // 🎯 roll_check (Старая)
  roll_check: (action, context, spell, caster, rollModifier) => {
    const bonus = calculateBonus(caster, action.bonuses, spell.elements);
    const formula = bonus >= 0 ? `d20+${bonus}` : `d20${bonus}`;
    const { result, rawD20, allD20Rolls, isCrit, isCritFail } = rollWithModifier(formula, rollModifier);
    
    context.rolls.push({ stepId: action.id, formula, rolls: result.rolls, total: result.total, rawD20, isCrit, isCritFail });
    context.lastRoll = result.total;
    context.lastD20 = rawD20;
    context.isCrit = isCrit;
    context.isCritFail = isCritFail;
    
    const threshold = action.successThreshold ?? 10;
    const isSuccess = !isCritFail && (isCrit || result.total >= threshold);
    context.success = isSuccess;

    const rollsStr = `[${result.rolls.join(', ')}]`;
    const modText = allD20Rolls && allD20Rolls.length > 1 ? ` (${rollModifier === 'advantage' ? '🎯' : '💨'}[${allD20Rolls.join(',')}])` : '';
    
    if (isCritFail) context.log.push(`💀 Проверка: ${rollsStr}${modText} = КРИТ ПРОВАЛ!`);
    else if (!isSuccess) context.log.push(`💨 Проверка: ${rollsStr} + ${bonus} = ${result.total}${modText} (нужно ${threshold})`);
    else if (isCrit) context.log.push(`✨ Проверка: ${rollsStr} + ${bonus} = ${result.total}${modText} — КРИТ!`);
    else context.log.push(`🎯 Проверка: ${rollsStr} + ${bonus} = ${result.total}${modText}`);
    
    return evaluateTransitions(action, context);
  },

  // 🎲 roll_dice
  roll_dice: (action, context) => {
    const formula = action.diceFormula ?? 'd6';
    const result = rollDice(formula);
    context.rolls.push({ stepId: action.id, formula, rolls: result.rolls, total: result.total });
    context.lastRoll = result.total;
    context.values['lastRoll'] = result.total;
    if (action.saveResultAs) context.values[action.saveResultAs] = result.total;
    
    const rollsStr = `[${result.rolls.join(', ')}]`;
    context.log.push(`🎲 ${action.label}: ${formula} = ${rollsStr} = ${result.total}`);
    
    return evaluateTransitions(action, context);
  },
  
  // 📋 roll_table
  roll_table: (action, context) => {
    const formula = action.diceFormula ?? 'd12';
    const result = rollDice(formula);
    context.rolls.push({ stepId: action.id, formula, rolls: result.rolls, total: result.total });
    context.lastRoll = result.total;
    const table = action.resultTable ?? [];
    const entry = table.find(e => result.total >= e.min && result.total <= e.max);
    
    const rollsStr = `[${result.rolls.join(', ')}]`;
    
    if (entry) {
      if (action.saveResultAs) context.values[action.saveResultAs] = entry.resultValue;
      const icon = entry.resultIcon ?? ELEMENT_ICONS[entry.resultValue] ?? '✨';
      const label = entry.resultLabel ?? ELEMENT_NAMES[entry.resultValue] ?? entry.resultValue;
      context.log.push(`📋 ${action.label}: ${rollsStr} = ${result.total} → ${icon} ${label}`);
    } else {
      context.log.push(`📋 ${action.label}: ${rollsStr} = ${result.total} → (не найдено)`);
    }
    return evaluateTransitions(action, context);
  },
  
  // 💥 roll_damage
  roll_damage: (action, context, spell, caster) => {
    let formula = action.damageFormula ?? 'd6';
    
    if (action.addDamageBonus) {
      const dmgBonus = getElementBonus(caster, spell.elements, 'damage');
      if (dmgBonus > 0) formula = `${formula}+${dmgBonus}`;
    }
    
    // 🔥 УДВОЕНИЕ КУБОВ
    if (context.doubleDamageDice) {
      formula = doubleDiceInFormula(formula);
    }
    
    const result = rollDice(formula);
    let total = result.total;
    
    let damageType: string | undefined;
    if (context.isCrit && action.forcePureOnCrit) {
      damageType = 'pure';
    } else {
      if (action.damageType === 'from_context' && action.damageTypeContextKey) {
        damageType = context.values[action.damageTypeContextKey] as string;
      } else {
        damageType = action.damageType;
      }
    }
    
    context.totalDamage += total;
    context.damageType = damageType;
    context.damageBreakdown.push({ formula, result: total, type: damageType, isCrit: context.isCrit });
    
    const typeLabel = damageType ? (DAMAGE_TYPE_NAMES[damageType as DamageType] ?? ELEMENT_NAMES[damageType] ?? damageType) : '';
    const pureLabel = damageType === 'pure' ? ' (ЧИСТЫЙ)' : '';
    const critLabel = context.doubleDamageDice ? ' (КРИТ! Кубы ×2)' : '';
    const rollsStr = `[${result.rolls.join(', ')}]`;
    
    context.log.push(`💥 Урон: ${formula} = ${rollsStr} = ${total} ${typeLabel}${pureLabel}${critLabel}`);
    
    return evaluateTransitions(action, context);
  },
  
  // ⚖️ damage_tiers
  damage_tiers: (action, context, spell, caster) => {
    const formula = action.diceFormula ?? 'd20';
    const result = rollDice(formula);
    
    context.rolls.push({ stepId: action.id, formula, rolls: result.rolls, total: result.total });
    context.lastRoll = result.total;
    
    const tiers = action.damageTiers ?? [];
    const tier = tiers.find(t => result.total >= t.minRoll && result.total <= t.maxRoll);
    
    const tierRollsStr = `[${result.rolls.join(', ')}]`;
    
    if (!tier) {
      context.log.push(`⚖️ ${action.label}: ${formula} = ${tierRollsStr} = ${result.total} — нет tier!`);
      return evaluateTransitions(action, context);
    }
    
    context.log.push(`⚖️ ${action.label}: ${formula} = ${tierRollsStr} = ${result.total} → ${tier.label ?? tier.formula}`);
    
    let dmgFormula = tier.formula;
    if (action.addDamageBonus) {
      const dmgBonus = getElementBonus(caster, spell.elements, 'damage');
      if (dmgBonus > 0) dmgFormula = `${dmgFormula}+${dmgBonus}`;
    }

    // 🔥 УДВОЕНИЕ КУБОВ
    if (context.doubleDamageDice) {
      dmgFormula = doubleDiceInFormula(dmgFormula);
    }
    
    const dmgResult = rollDice(dmgFormula);
    let dmgTotal = dmgResult.total;
    
    const isTierCrit = result.total === 20; 
    if (isTierCrit || context.isCrit) {
      context.isCrit = true;
    }
    
    let damageType: string | undefined;
    if (context.isCrit && action.forcePureOnCrit) {
      damageType = 'pure';
    } else {
      if (action.damageType === 'from_context' && action.damageTypeContextKey) {
        damageType = context.values[action.damageTypeContextKey] as string;
      } else {
        damageType = action.damageType;
      }
    }
    
    context.totalDamage += dmgTotal;
    context.damageType = damageType;
    context.damageBreakdown.push({ formula: dmgFormula, result: dmgTotal, type: damageType, isCrit: context.isCrit });
    
    const typeLabel = damageType ? (DAMAGE_TYPE_NAMES[damageType as DamageType] ?? ELEMENT_NAMES[damageType] ?? damageType) : '';
    const pureLabel = damageType === 'pure' ? ' (ЧИСТЫЙ)' : '';
    const critLabel = context.doubleDamageDice ? ' (КРИТ! Кубы ×2)' : (isTierCrit ? ' (КРИТ ТИРА!)' : '');
    const dmgRollsStr = `[${dmgResult.rolls.join(', ')}]`;
    
    context.log.push(`💥 Урон: ${dmgFormula} = ${dmgRollsStr} = ${dmgTotal} ${typeLabel}${pureLabel}${critLabel}`);
    
    return evaluateTransitions(action, context);
  },
  
  set_value: (action, context) => {
    if (action.setKey) {
      if (action.setValueFromContext) context.values[action.setKey] = context.values[action.setValueFromContext];
      else if (action.setValueFormula) context.values[action.setKey] = rollDice(action.setValueFormula).total;
      else context.values[action.setKey] = action.setValue;
      context.log.push(`📝 ${action.setKey} = ${context.values[action.setKey]}`);
    }
    return evaluateTransitions(action, context);
  },

  message: (action, context) => {
    if (action.messageTemplate) context.log.push(`💬 ${interpolateMessage(action.messageTemplate, context)}`);
    return evaluateTransitions(action, context);
  },

  branch: (action, context) => {
    if (!action.branchCondition) return action.branchFalseStepId ?? 'next';
    const { type, key, value, valueMax } = action.branchCondition;
    const actualValue = context.values[key];
    let conditionMet = false;
    switch (type) {
      case 'value_exists': conditionMet = actualValue !== undefined; break;
      case 'value_equals': conditionMet = actualValue == value; break;
      case 'value_gte': conditionMet = typeof actualValue === 'number' && actualValue >= (value as number); break;
      case 'value_lte': conditionMet = typeof actualValue === 'number' && actualValue <= (value as number); break;
      case 'value_in_range': conditionMet = typeof actualValue === 'number' && actualValue >= (value as number) && actualValue <= (valueMax ?? value as number); break;
    }
    context.log.push(`🔀 ${action.label}: ${key}=${actualValue} ${type} ${value} → ${conditionMet ? 'ДА' : 'НЕТ'}`);
    return conditionMet ? (action.branchTrueStepId ?? 'next') : (action.branchFalseStepId ?? 'stop');
  },

  goto: (action, context) => {
    context.log.push(`➡️ Переход к: ${action.gotoStepId}`);
    return action.gotoStepId ?? 'next';
  },

  stop: (action, context) => {
    context.log.push(`🛑 ${action.label ?? 'Стоп'}`);
    context.stopped = true;
    return 'stop';
  },

  modify_resource: (action, context) => {
    // 🔥 ИЗМЕНЕНО: Поддержка формул в resourceAmount
    let amount = action.resourceAmount ?? 0;
    if (typeof amount === 'string') {
        try {
            amount = rollDice(amount).total;
        } catch (e) {
            console.error('Invalid resource formula', amount);
            amount = 0;
        }
    }

    const op = action.resourceOperation === 'restore' ? '+' : '-';
    const type = action.resourceType ?? 'mana';
    context.log.push(`💠 ${op}${amount} ${type}`);
    if (!context.values._resourceChanges) context.values._resourceChanges = [];
    (context.values._resourceChanges as any[]).push({ type, amount: action.resourceOperation === 'restore' ? amount : -amount, resourceId: action.resourceId });
    return evaluateTransitions(action, context);
  },

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
    case 'always': return true;
    case 'crit': return context.isCrit;
    case 'crit_fail': return context.isCritFail;
    case 'success': return context.success && !context.isCritFail;
    case 'fail': return !context.success || context.isCritFail;
    case 'value_equals': return transition.conditionKey ? context.values[transition.conditionKey] == transition.conditionValue : false;
    case 'value_gte': return transition.conditionKey && typeof context.values[transition.conditionKey] === 'number' ? context.values[transition.conditionKey] >= (transition.conditionValue as number) : false;
    case 'value_lte': return transition.conditionKey && typeof context.values[transition.conditionKey] === 'number' ? context.values[transition.conditionKey] <= (transition.conditionValue as number) : false;
    case 'value_in_range': 
      if (!transition.conditionKey || typeof context.values[transition.conditionKey] !== 'number') return false;
      const val = context.values[transition.conditionKey] as number;
      const min = transition.conditionValue as number;
      const max = transition.conditionValueMax ?? min;
      return val >= min && val <= max;
    default: return false;
  }
}

function checkStepCondition(condition: any, context: CastContext): boolean {
    // Упрощенная проверка для условий шагов
    if (condition.type === 'always') return true;
    // Можно расширить логику при необходимости
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ ВЫПОЛНЕНИЯ
// ═══════════════════════════════════════════════════════════════════════════

export async function executeSpell(options: ExecuteSpellOptions): Promise<ExecuteSpellResult> {
  const { spell, caster, targetCount = 1, rollModifier = 'normal', onStepComplete, onLog } = options;
  const context = createInitialContext(spell, caster, targetCount);
  const sortedActions = [...spell.actions].sort((a, b) => a.order - b.order);
  const actionMap = new Map<string, number>();
  sortedActions.forEach((action, index) => actionMap.set(action.id, index));
  
  // 🔥 ИЗМЕНЕНО: Вычисление стоимости (поддержка формул)
  let baseCost: number = 0;
  if (typeof spell.cost === 'string') {
    try {
        const roll = rollDice(spell.cost);
        baseCost = roll.total;
        context.log.push(`💠 Стоимость (бросок): ${spell.cost} = ${baseCost}`);
    } catch (e) {
        console.error('Invalid cost formula', spell.cost);
        baseCost = 0;
    }
  } else {
    baseCost = spell.cost;
  }

  let manaCost = baseCost;
  const manaReduction = getElementBonus(caster, spell.elements, 'mana');
  manaCost = Math.max(0, manaCost - manaReduction);
  
  context.log.push(`═══ ${spell.name} ═══`);
  if (manaReduction > 0) context.log.push(`💠 Мана: ${baseCost} - ${manaReduction} (предрасп.) = ${manaCost}`);
  
  let projectileCount = 1;
  if (spell.projectiles && spell.projectiles !== '1') {
    if (/^\d+$/.test(spell.projectiles)) projectileCount = parseInt(spell.projectiles, 10);
    else {
      const projResult = rollDice(spell.projectiles);
      projectileCount = projResult.total;
      context.log.push(`🎲 Снарядов: ${spell.projectiles} = ${projectileCount}`);
    }
  }
  
  let currentIndex = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 100;
  
  while (currentIndex < sortedActions.length && !context.stopped && iterations < MAX_ITERATIONS) {
    iterations++;
    const action = sortedActions[currentIndex];
    if (!action) break;
    context.currentStepIndex = currentIndex;
    context.currentStepId = action.id;
    
    if (action.condition && action.condition.type !== 'always') {
      const condMet = checkStepCondition(action.condition, context);
      if (!condMet) { currentIndex++; continue; }
    }
    
    const executor = stepExecutors[action.type];
    let nextStepId: string | null = null;
    if (executor) {
      const useModifier = iterations === 1 ? rollModifier : 'normal';
      nextStepId = executor(action, context, spell, caster, useModifier);
    } else {
      context.log.push(`⚠️ Неизвестный тип шага: ${action.type}`);
    }
    
    if (onStepComplete) onStepComplete(action.id, context);
    
    if (nextStepId === 'stop' || context.stopped) break;
    else if (nextStepId === 'next' || nextStepId === null) currentIndex++;
    else {
      const targetIndex = actionMap.get(nextStepId);
      if (targetIndex !== undefined) currentIndex = targetIndex;
      else { context.log.push(`⚠️ Шаг не найден: ${nextStepId}`); currentIndex++; }
    }
  }
  
  if (iterations >= MAX_ITERATIONS) {
    context.log.push(`⚠️ Превышен лимит итераций!`);
    context.error = 'Max iterations exceeded';
  }
  
  if (context.manaDiscount) {
    const oldCost = manaCost;
    manaCost = Math.floor(manaCost * (1 - context.manaDiscount));
    context.log.push(`✨ КРИТ КАСТ! Мана снижена: ${oldCost} → ${manaCost}`);
  }
  
  if (onLog) context.log.forEach(line => onLog(line));
  
  return {
    success: context.success && !context.isCritFail,
    context,
    totalDamage: context.totalDamage,
    damageType: context.damageType,
    manaCost,
    log: context.log
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════════════════════════════

export const spellExecutor = {
  execute: executeSpell,
  calculateManaCost: (spell: SpellV2, caster: Unit): number => {
    const manaReduction = getElementBonus(caster, spell.elements, 'mana');
    // Базовая стоимость без броска (для превью)
    const base = typeof spell.cost === 'number' ? spell.cost : 0;
    return Math.max(0, base - manaReduction);
  },
  getElementBonus,
};
