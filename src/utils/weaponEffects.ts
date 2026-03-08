// src/utils/weaponEffects.ts
import type { SpellAction } from '../types';

/**
 * Контекст для выполнения оружейных эффектов.
 * Все поля доступны через {ключ} в message templates и branch conditions.
 */
export interface WeaponEffectContext {
  hitRoll: number;       // Сырой d20
  hitTotal: number;      // Итого (d20 + бонусы)
  isCrit: boolean;       // Крит
  isCritFail: boolean;   // Крит промах
  damage: number;        // Нанесённый урон
  weaponName: string;    // Название оружия/боеприпаса
  unitName: string;      // Имя юнита
  targetIndex: number;   // Номер цели (0-based)
  shotIndex: number;     // Номер выстрела (0-based)
  values: Record<string, unknown>;   // Пользовательские переменные
  log: string[];         // Лог сообщений
}

/**
 * Выполняет цепочку SpellAction[] как оружейные эффекты.
 * Поддерживает: branch, message, set_value, goto, stop
 * 
 * Переиспользует ту же систему что заклинания — максимальная гибкость.
 */
export function executeWeaponEffects(
  actions: SpellAction[],
  ctx: WeaponEffectContext,
  addCombatLog: (unitName: string, action: string, details: string) => void
): void {
  if (!actions.length) return;
  
  const sorted = [...actions].sort((a, b) => a.order - b.order);
  let currentIndex = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 50;
  
  while (currentIndex >= 0 && currentIndex < sorted.length && iterations < MAX_ITERATIONS) {
    iterations++;
    const action = sorted[currentIndex]!;
    
    // Проверяем condition если задан
    if (action.condition && action.condition.type !== 'always') {
      if (!evaluateCondition(action.condition, ctx)) {
        currentIndex++;
        continue;
      }
    }
    
    switch (action.type) {
      case 'branch': {
        const cond = action.branchCondition;
        if (!cond) { currentIndex++; break; }
        
        const condMet = evaluateBranchCondition(cond, ctx);
        const targetId = condMet ? action.branchTrueStepId : action.branchFalseStepId;
        currentIndex = resolveTarget(targetId, sorted, currentIndex);
        break;
      }
      
      case 'message': {
        const msg = interpolateTemplate(action.messageTemplate ?? '', ctx);
        if (msg) {
          ctx.log.push(msg);
          addCombatLog(ctx.unitName, ctx.weaponName, msg);
        }
        currentIndex++;
        break;
      }
      
      case 'set_value': {
        if (action.setKey) {
          if (action.setValueFromContext) {
            ctx.values[action.setKey] = resolveValue(action.setValueFromContext, ctx);
          } else {
            ctx.values[action.setKey] = action.setValue;
          }
        }
        currentIndex++;
        break;
      }
      
      case 'goto': {
        currentIndex = resolveTarget(action.gotoStepId, sorted, currentIndex);
        break;
      }
      
      case 'stop':
        return;
      
      default:
        // Для неподдерживаемых типов — пропускаем (roll_damage и т.п. не имеют смысла здесь)
        currentIndex++;
    }
  }
  
  if (iterations >= MAX_ITERATIONS) {
    console.warn('[WeaponFX] Max iterations reached, possible infinite loop');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ВНУТРЕННИЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════

function resolveValue(key: string, ctx: WeaponEffectContext): unknown {
  // Сначала пользовательские значения
  if (key in ctx.values) return ctx.values[key];
  
  // Потом встроенные поля контекста
  switch (key) {
    case 'hitRoll': return ctx.hitRoll;
    case 'hitTotal': return ctx.hitTotal;
    case 'isCrit': return ctx.isCrit;
    case 'isCritFail': return ctx.isCritFail;
    case 'damage': return ctx.damage;
    case 'weaponName': return ctx.weaponName;
    case 'unitName': return ctx.unitName;
    case 'targetIndex': return ctx.targetIndex;
    case 'shotIndex': return ctx.shotIndex;
    default: return undefined;
  }
}

function evaluateCondition(
  condition: NonNullable<SpellAction['condition']>,
  ctx: WeaponEffectContext
): boolean {
  if (condition.type === 'always') return true;
  
  const val = condition.key ? resolveValue(condition.key, ctx) : undefined;
  
  switch (condition.type) {
    case 'value_equals': return String(val) === String(condition.value);
    case 'value_gte': return Number(val) >= Number(condition.value);
    case 'value_lte': return Number(val) <= Number(condition.value);
    case 'value_exists': return val !== undefined && val !== null;
    default: return true;
  }
}

function evaluateBranchCondition(
  cond: NonNullable<SpellAction['branchCondition']>,
  ctx: WeaponEffectContext
): boolean {
  const val = resolveValue(cond.key, ctx);
  
  switch (cond.type) {
    case 'value_gte': return Number(val) >= Number(cond.value);
    case 'value_lte': return Number(val) <= Number(cond.value);
    case 'value_equals': return String(val) === String(cond.value);
    case 'value_exists': return val !== undefined && val !== null;
    case 'value_in_range': {
      const n = Number(val);
      return n >= Number(cond.value) && n <= Number(cond.valueMax ?? cond.value);
    }
    default: return false;
  }
}

function interpolateTemplate(template: string, ctx: WeaponEffectContext): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = resolveValue(key, ctx);
    return v !== undefined ? String(v) : `{${key}}`;
  });
}

function resolveTarget(
  targetId: string | undefined,
  sorted: SpellAction[],
  currentIndex: number
): number {
  if (!targetId || targetId === 'next') return currentIndex + 1;
  if (targetId === 'stop') return -1;
  const idx = sorted.findIndex(a => a.id === targetId);
  return idx >= 0 ? idx : currentIndex + 1;
}
